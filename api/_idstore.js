// api/_idstore.js — helper condiviso di Estji ID (identità, QR, firma dei token).
//   Identità:  ide.json nella repo DATA (tramite _github.js)  ->  { "identita": [ ... ] }
//   Richieste QR (temporanee): Upstash Redis (variabili KV_REST_API_URL / KV_REST_API_TOKEN)
//   Firma token: ID_PRIVATE_KEY (chiave RSA privata, PEM). La chiave pubblica si ricava da sola.
import crypto from 'crypto';
import { leggiFileJson, scriviFileJson } from './_github.js';

export const ISS = process.env.ESTJI_ISS || 'https://ews-rose.vercel.app';
const FILE_IDE = 'ide.json';

export const STATI = {
  'EstjiFall': { cod: 'EFA', sezioni: ['Sezione 01', 'Sezione 02', 'Sezione 03'] },
  'EstjiKuro': { cod: 'EKU', sezioni: ['Sezione 01', 'Sezione 02'] },
  'Ile de USSE': { cod: 'IDU', sezioni: ['Sezione 01'] }
};

// permesso: [livello minimo, ruolo richiesto, descrizione]
export const SCOPES = {
  'id.session': [3, 'cittadino', "Accesso a Estji ID (sessione personale)"],
  'profile.basic': [1, 'cittadino', 'Nome e ID'],
  'profile.residence': [1, 'cittadino', 'Residenza elettorale'],
  'vote.eligibility': [2, 'cittadino', 'Idoneità al voto'],
  'wiki.edit': [2, 'redattore_wiki', 'Modifica della Wiki'],
  'normaktiv.sign': [3, 'delegato', 'Firma di atti normativi'],
  'agency.manage': [2, 'dirigente_agenzia', 'Gestione agenzia'],
  'unitext.edit': [2, 'redattore', 'Redazione UniText'],
  'normaktiv.edit': [2, 'redattore', 'Redazione atti NormAktiv'],
  'ctsu.edit': [2, 'redattore_ctsu', 'Redazione progetti CTSU']
};

const SITI = ['https://ews-rose.vercel.app', 'https://rtf-rose.vercel.app'];
export const PORTALI = {
  id:        { nome: 'Estji ID', origins: SITI, scopes: ['id.session'] },
  archive:   { nome: 'Estji Archive', origins: SITI, scopes: ['profile.basic'] },
  cepu:      { nome: 'CEPU', origins: SITI, scopes: ['profile.basic', 'profile.residence', 'vote.eligibility'] },
  normaktiv: { nome: 'NormAktiv', origins: SITI, scopes: ['profile.basic', 'normaktiv.edit', 'normaktiv.sign'] },
  wiki:      { nome: 'Estji Wiki', origins: SITI, scopes: ['profile.basic', 'wiki.edit'] },
  unitext:   { nome: 'UniText', origins: SITI, scopes: ['profile.basic', 'unitext.edit'] },
  ctsu:      { nome: 'CTSU', origins: SITI, scopes: ['profile.basic', 'ctsu.edit'] }
};

/* ---------- Redis (Upstash, REST) ---------- */
export async function redis(...cmd) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const tok = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !tok) throw new Error('Archivio temporaneo non configurato (KV_REST_API_URL / KV_REST_API_TOKEN).');
  const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.error) throw new Error(d.error || 'Redis ' + r.status);
  return d.result;
}
export async function limite(chiave, max, secondi) {
  const n = await redis('INCR', 'lim:' + chiave);
  if (n === 1) await redis('EXPIRE', 'lim:' + chiave, secondi);
  return n <= max;
}
export const ipDi = req => String((req.headers['x-forwarded-for'] || '').split(',')[0] || 'x').trim();

/* ---------- ide.json ---------- */
export async function leggiIde() {
  try {
    const r = await leggiFileJson(FILE_IDE, { identita: [] });
    return Array.isArray(r) ? { identita: r } : { identita: [], ...r };
  } catch (e) {
    if (/Unexpected end of JSON/i.test(e.message)) return { identita: [] };   // file ancora vuoto
    throw e;
  }
}
export const scriviIde = (dati, msg) => scriviFileJson(FILE_IDE, dati, msg);
export const trovaId = (ide, id) => ide.identita.find(p => p.id === id);

/* ---------- password ---------- */
export function nuovoHash(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, hash: crypto.scryptSync(String(pw), salt, 64).toString('hex') };
}
export function passwordOk(pw, rec) {
  const salt = rec ? rec.salt : 'x'.repeat(32);   // stesso lavoro anche se l'utente non esiste
  const h = crypto.scryptSync(String(pw == null ? '' : pw), salt, 64);
  if (!rec) return false;
  const a = Buffer.from(rec.hash, 'hex');
  return a.length === h.length && crypto.timingSafeEqual(a, h);
}

/* ---------- luoghi (organi.json, stessa logica di CA.html) ---------- */
// "luoghi" può essere piatto o raggruppato: l'ID si cerca a qualsiasi profondità.
export async function trovaLuogo(id) {
  if (!id) return null;
  const dati = await leggiFileJson('organi.json', { luoghi: {} });
  const eVoce = v => typeof v === 'string' || (v && typeof v === 'object' && typeof v.nome === 'string');
  const cerca = c => {
    if (!c || typeof c !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(c, id) && eVoce(c[id])) return c[id];
    for (const k of Object.keys(c)) {
      const v = c[k];
      if (v && typeof v === 'object' && !eVoce(v)) { const t = cerca(v); if (t) return t; }
    }
    return null;
  };
  const v = cerca(dati && dati.luoghi);
  return v ? { id, nome: typeof v === 'string' ? v : v.nome } : null;
}

/* ---------- CUP: LUOGO-SEZIONE-AAMMGG-PP-C ---------- */
// Account vecchi: codice e sezione di STATI. Account nuovi: 3 lettere dall'ID del luogo e sezione "00".
export function nuovoCup(p, ide) {
  const leg = Object.prototype.hasOwnProperty.call(STATI, p.stato) ? STATI[p.stato] : null;
  const cod = leg ? leg.cod : String(p.residenza || p.stato || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const sez = (p.sezione || '').replace(/\D/g, '') || '00';
  const pre = cod + '-' + sez + '-' + p.iscritto.slice(2).replace(/-/g, '');
  const n = ide.identita.filter(x => x.cup && x.cup.indexOf(pre + '-') === 0).length + 1;
  const corpo = pre + '-' + ('0' + n).slice(-2);
  let t = 0; const c = corpo.replace(/-/g, '');
  for (let i = 0; i < c.length; i++) t += parseInt(c[i], 36) * (i + 1);
  return corpo + '-' + String.fromCharCode(65 + t % 26);
}

/* ---------- ruoli ---------- */
export function ruoliTecnici(p) {
  const r = ['cittadino'];
  (p.ruoli || []).forEach(x => {
    if (/Redattore Wiki/i.test(x)) r.push('redattore_wiki');
    if (/^Redattore( UniText)?$/i.test(String(x).trim())) r.push('redattore');   // "Redattore" (e la vecchia etichetta "Redattore UniText")
    if (/Redattore CTSU/i.test(x)) r.push('redattore_ctsu');
    if (/^Generale$/i.test(String(x).trim())) r.push('generale');   // accesso a tutti i permessi (resta il livello minimo di sicurezza)
    if (/Dirigente/i.test(x)) r.push('dirigente_agenzia');
    if (/Presidente|Delegato/i.test(x)) r.push('delegato');
  });
  return r;
}
export function scopeConcessi(p, richiesti, loa) {
  const r = ruoliTecnici(p);
  const generale = r.includes('generale');   // il ruolo "Generale" soddisfa il ruolo richiesto da qualsiasi permesso
  return richiesti.filter(s => SCOPES[s] && (p.verificato || s === 'id.session') && (generale || r.includes(SCOPES[s][1])) && loa >= SCOPES[s][0]);
}

/* ---------- sessione personale (diversa da quella delle redazioni) ---------- */
const chiaveSess = () => {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET non configurato.');
  return crypto.createHmac('sha256', process.env.AUTH_SECRET).update('estji-id-sessione').digest();
};
export function creaSessioneId(id) {
  const p = id + '.' + (Date.now() + 2 * 60 * 60 * 1000);
  return Buffer.from(p + '.' + crypto.createHmac('sha256', chiaveSess()).update(p).digest('hex')).toString('base64url');
}
export function sessioneId(req) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    const [id, scad, firma] = Buffer.from(h.slice(7), 'base64url').toString().split('.');
    const att = crypto.createHmac('sha256', chiaveSess()).update(id + '.' + scad).digest('hex');
    const a = Buffer.from(String(firma)), b = Buffer.from(att);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b) || Date.now() > Number(scad)) return null;
    return { id };
  } catch (e) { return null; }
}

/* ---------- token firmati (RS256) ---------- */
function chiavePrivata() {
  const pem = (process.env.ID_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!pem) throw new Error('ID_PRIVATE_KEY non configurata.');
  return crypto.createPrivateKey(pem);
}
export function jwkPubblica() {
  const jwk = crypto.createPublicKey(chiavePrivata()).export({ format: 'jwk' });
  return { ...jwk, kid: crypto.createHash('sha256').update(jwk.n).digest('base64url').slice(0, 16), alg: 'RS256', use: 'sig' };
}
// Verifica locale (senza rete) di un token emesso da Estji ID per il portale "aud". Restituisce i claim o null.
export function verificaJwt(token, aud) {
  const p = typeof token === 'string' ? token.split('.') : [];
  if (p.length !== 3) return null;
  try {
    const h = JSON.parse(Buffer.from(p[0], 'base64url').toString());
    const c = JSON.parse(Buffer.from(p[1], 'base64url').toString());
    if (!h || h.alg !== 'RS256' || !c) return null;
    const ok = crypto.verify('RSA-SHA256', Buffer.from(p[0] + '.' + p[1]), crypto.createPublicKey(chiavePrivata()), Buffer.from(p[2], 'base64url'));
    if (!ok || c.iss !== ISS || ![].concat(c.aud).includes(aud) || !(c.exp * 1000 > Date.now())) return null;
    return c;
  } catch (e) { return null; }
}
export function firmaJwt(claims) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const dati = b({ alg: 'RS256', typ: 'JWT', kid: jwkPubblica().kid }) + '.' + b(claims);
  return dati + '.' + crypto.sign('RSA-SHA256', Buffer.from(dati), chiavePrivata()).toString('base64url');
}

export async function corpoJson(req) {
  let c = req.body;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch (e) { c = {}; } }
  return c && typeof c === 'object' ? c : {};
}