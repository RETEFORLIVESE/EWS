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
  'ctsu.edit': [2, 'redattore_ctsu', 'Redazione progetti CTSU'],
  'cepu.edit': [2, 'redattore_cepu', 'Redazione elezioni CEPU']
};

const SITI = ['https://ews-rose.vercel.app', 'https://rtf-rose.vercel.app'];
// codice: true -> l'accesso richiede sempre la verifica con il numero (come per i permessi di livello 3)
export const PORTALI = {
  id:        { nome: 'Estji ID', origins: SITI, scopes: ['id.session'], codice: true },
  archive:   { nome: 'Estji Archive', origins: SITI, scopes: ['profile.basic'], codice: true },
  cepu:      { nome: 'CEPU', origins: SITI, scopes: ['profile.basic', 'profile.residence', 'vote.eligibility', 'cepu.edit'], codice: true },
  normaktiv: { nome: 'NormAktiv', origins: SITI, scopes: ['profile.basic', 'normaktiv.edit', 'normaktiv.sign'], codice: true },
  wiki:      { nome: 'Estji Wiki', origins: SITI, scopes: ['profile.basic', 'wiki.edit'], codice: true },
  unitext:   { nome: 'UniText', origins: SITI, scopes: ['profile.basic', 'unitext.edit'], codice: true },
  ctsu:      { nome: 'CTSU', origins: SITI, scopes: ['profile.basic', 'ctsu.edit'], codice: true }
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
  // g = gruppo di primo livello sotto "luoghi" (lo stato sociale), come in id.html
  const cerca = (c, g) => {
    if (!c || typeof c !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(c, id) && eVoce(c[id])) return { v: c[id], g };
    for (const k of Object.keys(c)) {
      const v = c[k];
      if (v && typeof v === 'object' && !eVoce(v)) { const t = cerca(v, g || k); if (t) return t; }
    }
    return null;
  };
  const t = cerca(dati && dati.luoghi, '');
  if (!t) return null;
  // Lo stato si ricava dal prefisso dell'ID (ELIN-TLN-NII-TEG -> ELIN -> livello_statale), mai dal gruppo ("assemblee_locali" non è uno stato).
  const ALIAS = { TRD: 'TDR', EBHAN: 'EBHN', BSHSX: 'BSHS' };   // prefissi con refusi presenti in organi.json
  const pre = String(id).split('-')[0], sv = ((dati.luoghi || {}).livello_statale || {})[ALIAS[pre] || pre];
  const v = t.v, stato = (typeof v === 'object' && (v.stato || v.statoSociale || v.stato_sociale)) || (typeof sv === 'string' ? sv : sv && sv.nome) || '';
  return { id, nome: typeof v === 'string' ? v : v.nome, stato: String(stato).replace(/_/g, ' ') };
}

/* ---------- CUP: CCC-XXX-GG-M-AA-SSS ---------- */
//   CCC = prime 3 consonanti del nick (senza vocali, numeri, simboli)
//   XXX = prima parte dell'ID della residenza (es. ELIN, TDR)
//   GG  = giorno di registrazione     M = lettera del mese (A = gennaio ... L = dicembre)
//   AA  = anno di prima registrazione SSS = ultima parte dell'ID della residenza (es. TEG, TRN)
// Il CUP si genera una volta sola: un cambio di residenza successivo non lo modifica.
const MESI = 'ABCDEFGHIJKL';
const ALIAS_STATO = { TRD: 'TDR', EBHAN: 'EBHN', BSHSX: 'BSHS' };   // stessi refusi di organi.json gestiti in trovaLuogo
export function nuovoCup(p, ide) {
  const cons = String(p.nick || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
  const parti = String(p.residenza || '').toUpperCase().split('-').filter(Boolean);
  const stato = ALIAS_STATO[parti[0]] || parti[0] || 'XXX', sezione = parti[parti.length - 1] || 'XXX';
  const [aaaa, mm, gg] = String(p.iscritto || new Date().toISOString().slice(0, 10)).split('-');
  const coda = '-' + stato + '-' + gg + '-' + MESI[parseInt(mm, 10) - 1] + '-' + aaaa.slice(2) + '-' + sezione;
  const usati = new Set(ide.identita.map(x => x.cup));
  const piena = cons.padEnd(3, 'X');
  // se il CUP esiste già, prova le tre consonanti successive del nick
  for (let i = 0; i + 3 <= piena.length; i++) {
    const cup = piena.slice(i, i + 3) + coda;
    if (!usati.has(cup)) return cup;
  }
  // ultima risorsa: suffisso numerico
  const base = piena.slice(0, 3) + coda;
  let n = 2;
  while (usati.has(base + '-' + n)) n++;
  return base + '-' + n;
}

/* ---------- ruoli ---------- */
export function ruoliTecnici(p) {
  const r = ['cittadino'];
  (p.ruoli || []).forEach(x => {
    if (/Redattore Wiki/i.test(x)) r.push('redattore_wiki');
    if (/^Redattore( UniText)?$/i.test(String(x).trim())) r.push('redattore');   // "Redattore" (e la vecchia etichetta "Redattore UniText")
    if (/Redattore CTSU/i.test(x)) r.push('redattore_ctsu');
    if (/Redattore CEPU/i.test(x)) r.push('redattore_cepu');
    if (/^Generale$/i.test(String(x).trim())) r.push('generale');   // accesso a tutti i permessi (resta il livello minimo di sicurezza)
    if (/^(Staff|Admin(istrator)?|Amministratore)$/i.test(String(x).trim())) r.push('staff');   // accesso al pannello staff (non ai permessi dei portali)
    if (/Dirigente/i.test(x)) r.push('dirigente_agenzia');
    if (/Presidente|Delegato/i.test(x)) r.push('delegato');
  });
  return r;
}
export function scopeConcessi(p, richiesti, loa) {
  if (p.sospeso) return [];   // identità sospesa dallo staff: nessun permesso
  const r = ruoliTecnici(p);
  const generale = r.includes('generale');   // il ruolo "Generale" soddisfa il ruolo richiesto da qualsiasi permesso
  return richiesti.filter(s => SCOPES[s] && (p.verificato || s === 'id.session') && (generale || r.includes(SCOPES[s][1])) && loa >= SCOPES[s][0]);
}

/* ---------- sessione personale (diversa da quella delle redazioni) ---------- */
// Token: base64url( id.scadenza[.sid].firma ). Con "sid" la sessione è registrata in Redis e si può revocare;
// i vecchi token senza sid restano validi fino alla scadenza (max 2 ore).
export const SESS_MS = 2 * 60 * 60 * 1000;
const chiaveSess = () => {
  if (!process.env.AUTH_SECRET) throw new Error('AUTH_SECRET non configurato.');
  return crypto.createHmac('sha256', process.env.AUTH_SECRET).update('estji-id-sessione').digest();
};
const firmaSess = s => crypto.createHmac('sha256', chiaveSess()).update(s).digest('hex');
export function creaSessioneId(id, sid) {
  const p = id + '.' + (Date.now() + SESS_MS) + (sid ? '.' + sid : '');
  return Buffer.from(p + '.' + firmaSess(p)).toString('base64url');
}
// Verifica SOLO la firma e la scadenza (sincrona). Per rispettare le revoche usa sessioneAttiva().
export function sessioneId(req) {
  try {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    const parti = Buffer.from(h.slice(7), 'base64url').toString().split('.');
    const firma = parti.pop();
    if (parti.length < 2 || parti.length > 3) return null;
    const [id, scad, sid] = parti;
    const a = Buffer.from(String(firma)), b = Buffer.from(firmaSess(parti.join('.')));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b) || Date.now() > Number(scad)) return null;
    return { id, sid: sid || '' };
  } catch (e) { return null; }
}

/* ---------- sessioni revocabili, dispositivi, avvisi ---------- */
export async function creaSessione(req, id, metodo) {
  const sid = crypto.randomBytes(9).toString('base64url');
  const meta = { id, sid, creata: Date.now(), ip: ipDi(req), ua: String(req.headers['user-agent'] || '').slice(0, 300), metodo };
  const ttl = Math.ceil(SESS_MS / 1000) + 60;
  await redis('SET', 'ses:' + sid, JSON.stringify(meta), 'EX', ttl);
  await redis('SADD', 'sesl:' + id, sid);
  await redis('EXPIRE', 'sesl:' + id, ttl + 3600);
  return { token: creaSessioneId(id, sid), sid, meta };
}
// Come sessioneId, ma controlla anche che la sessione non sia stata revocata.
export async function sessioneAttiva(req) {
  const s = sessioneId(req);
  if (!s) return null;
  if (s.sid && (await redis('EXISTS', 'ses:' + s.sid)) !== 1) return null;
  return s;
}
export async function listaSessioni(id) {
  const sids = (await redis('SMEMBERS', 'sesl:' + id)) || [];
  if (!sids.length) return [];
  const vals = await redis('MGET', ...sids.map(x => 'ses:' + x));
  const out = [], morte = [];
  vals.forEach((v, i) => { if (v) { try { out.push(JSON.parse(v)); } catch (e) { morte.push(sids[i]); } } else morte.push(sids[i]); });
  if (morte.length) await redis('SREM', 'sesl:' + id, ...morte);
  return out.sort((a, b) => b.creata - a.creata);
}
// Chiude le sessioni di un'identità; "tranne" = sid da mantenere. Restituisce quante ne ha chiuse.
export async function revocaSessioni(id, tranne) {
  const sids = ((await redis('SMEMBERS', 'sesl:' + id)) || []).filter(x => x !== tranne);
  if (!sids.length) return 0;
  await redis('DEL', ...sids.map(x => 'ses:' + x));
  await redis('SREM', 'sesl:' + id, ...sids);
  return sids.length;
}
export function etichetta(ua) {
  ua = String(ua || '');
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS/.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'dispositivo sconosciuto';
  return b + ' su ' + o;
}
export function maskIp(ip) {
  ip = String(ip || '');
  if (ip.includes(':')) return ip.split(':').slice(0, 2).join(':') + ':…';
  const p = ip.split('.');
  return p.length === 4 ? p[0] + '.' + p[1] + '.•.•' : '—';
}
async function dmDiscord(uid, testo) {
  const H = { Authorization: 'Bot ' + process.env.DISCORD_BOT_TOKEN, 'Content-Type': 'application/json' };
  const ch = await (await fetch('https://discord.com/api/v10/users/@me/channels', { method: 'POST', headers: H, body: JSON.stringify({ recipient_id: uid }) })).json();
  if (ch && ch.id) await fetch('https://discord.com/api/v10/channels/' + ch.id + '/messages', { method: 'POST', headers: H, body: JSON.stringify({ content: testo }) });
}
// Avviso di sicurezza: sempre nell'elenco dell'app; in più un messaggio privato su Discord se c'è DISCORD_BOT_TOKEN.
export async function avvisa(p, tipo, testo) {
  try {
    await redis('LPUSH', 'notif:' + p.id, JSON.stringify({ t: Date.now(), tipo, testo }));
    await redis('LTRIM', 'notif:' + p.id, 0, 29);
    await redis('EXPIRE', 'notif:' + p.id, 90 * 86400);
    if (p.discordId && process.env.DISCORD_BOT_TOKEN) await Promise.race([dmDiscord(p.discordId, '🔔 Estji ID — ' + testo), new Promise(r => setTimeout(r, 2500))]);
  } catch (e) { /* l'avviso non deve mai bloccare l'accesso */ }
}
export async function leggiAvvisi(id) {
  return ((await redis('LRANGE', 'notif:' + id, 0, 29)) || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
}
// Da chiamare dopo ogni accesso riuscito: avvisa se il dispositivo è nuovo (o sempre, se l'utente lo ha chiesto).
export async function registraAccesso(p, req, sess) {
  try {
    const ua = String(req.headers['user-agent'] || '');
    const dev = crypto.createHash('sha256').update(ua).digest('hex').slice(0, 16);
    const prima = await redis('SCARD', 'dev:' + p.id);
    const nuovo = (await redis('SADD', 'dev:' + p.id, dev)) === 1;
    if (nuovo) await redis('EXPIRE', 'dev:' + p.id, 365 * 86400);
    if ((nuovo && prima > 0) || p.avvisiTutti)
      await avvisa(p, nuovo ? 'nuovo-dispositivo' : 'accesso', (nuovo ? 'Nuovo dispositivo: ' : 'Accesso: ') + etichetta(ua) + ', IP ' + maskIp(sess.meta.ip) + ' (' + sess.meta.metodo + '). Se non sei stato tu, esci da tutti i dispositivi e cambia la password.');
  } catch (e) { /* idem */ }
}

/* ---------- Discord (OAuth) e staff ---------- */
export const discordAttivo = () => !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
// Super-amministratori: variabile ESTJI_STAFF = elenco (virgole) di ID (EST-2026-000001) o nomi in gioco.
export const eSuper = p => String(process.env.ESTJI_STAFF || '').toLowerCase().split(',').map(x => x.trim()).filter(Boolean).some(x => x === String(p.id).toLowerCase() || x === String(p.nick).toLowerCase());
export const eStaff = p => eSuper(p) || ruoliTecnici(p).includes('staff');
export async function audit(da, azione, id, dettaglio) {
  try {
    await redis('LPUSH', 'audit', JSON.stringify({ t: Date.now(), da, azione, id, dettaglio: dettaglio || '' }));
    await redis('LTRIM', 'audit', 0, 999);
  } catch (e) { /* il registro non deve bloccare l'azione */ }
}
export async function leggiAudit(n) {
  return ((await redis('LRANGE', 'audit', 0, n - 1)) || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
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