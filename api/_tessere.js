// api/tessere.js — carte SECONDARIE (tessere di partito), salvate in carte.json nella repo DATA.
// Le carte primarie restano in ide.json: qui non si legge né si scrive mai quel file.
//   Sito del partito (client "partito"):  accedi -> mia | iscrivi        (token di sessione con ambito "partito")
//   id.html (sessione personale Estji ID): carte                          (restituisce le carte secondarie dell'account)
// Il legame con l'account è l'ID Estji (claim "sub" del token firmato): non si legge mai dalla richiesta.
import crypto from 'crypto';
import { leggiFileJson, scriviFileJson } from './_github.js';
import { verificaIdToken, haScope } from './_estji-verifica.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';
import { sessioneAttiva, redis, limite, ipDi, corpoJson, PORTALI } from './_idstore.js';

const FILE = 'carte.json';
export const PARTITO = { client: 'partito', nome: 'Alleanza Civica Estji', sigla: 'ACE', colore: '#8e1b2e' };   // <- cambia qui nome/sigla/colore

const leggi = async () => {
  try { const d = await leggiFileJson(FILE, { carte: [] }); return Array.isArray(d) ? { carte: d } : { carte: [], ...d }; }
  catch (e) { if (/Unexpected end of JSON/i.test(e.message)) return { carte: [] }; throw e; }   // file ancora vuoto
};
const pub = x => ({ id: x.id, tipo: x.tipo, emittente: x.emittente, nomeEmittente: x.nomeEmittente, colore: x.colore, numero: x.numero, emessa: x.emessa, stato: x.stato || 'attiva' });

// carte.json è un unico file: le scritture si serializzano con un lucchetto (Redis) per non perdere iscrizioni simultanee.
async function conLucchetto(fn) {
  for (let i = 0; i < 20; i++) {
    if ((await redis('SET', 'lock:carte', '1', 'NX', 'EX', 15)) === 'OK') {
      try { return await fn(); } finally { await redis('DEL', 'lock:carte'); }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Archivio occupato: riprova tra un attimo.');
}

export default async function handler(req, res) {
  const origin = req.headers.origin, origini = (PORTALI[PARTITO.client] || { origins: [] }).origins;
  if (origin && origini.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Metodo non consentito' }); }
  const c = await corpoJson(req);
  const err = (s, m) => res.status(s).json({ error: m });
  try {
    // ---- login al sito del partito: token firmato di Estji ID (dopo QR + numero) ----
    if (c.azione === 'accedi') {
      if (!(await limite('par:' + ipDi(req), 20, 600))) return err(429, 'Troppi tentativi: riprova tra qualche minuto.');
      let t;
      try { t = await verificaIdToken(c.id_token, PARTITO.client); } catch (e) { return err(502, 'Estji ID non raggiungibile: riprova.'); }
      if (!t || !t.jti || !t.sub) return err(401, 'Accesso non valido o scaduto: genera un nuovo QR.');
      if (!haScope(t, 'profile.basic')) return err(403, 'La tua identità non è ancora verificata dallo staff: non puoi iscriverti.');
      if ((await redis('SET', 'ptok:' + t.jti, '1', 'NX', 'EX', 700)) !== 'OK') return err(401, 'Questo accesso è già stato utilizzato.');
      return res.status(200).json({ ok: true, token: creaToken(t.sub, PARTITO.client), id: t.sub, nick: t.nick, partito: { nome: PARTITO.nome, sigla: PARTITO.sigla, colore: PARTITO.colore } });
    }
    // ---- id.html: le carte secondarie dell'account con sessione personale ----
    if (c.azione === 'carte') {
      const s = await sessioneAttiva(req);
      if (!s) return err(401, 'Sessione scaduta: accedi di nuovo.');
      return res.status(200).json({ carte: (await leggi()).carte.filter(x => x.idEstji === s.id).map(pub) });
    }
    // ---- sito del partito, con sessione "partito" ----
    const s = sessioneDaRichiesta(req, PARTITO.client);
    if (!s || s.ambito !== PARTITO.client || !/^EST-/.test(s.username)) return err(401, 'Sessione scaduta: accedi di nuovo con Estji ID.');
    const sub = s.username;
    const sua = d => d.carte.find(x => x.tipo === 'tessera-partito' && x.emittente === PARTITO.sigla && x.idEstji === sub);
    if (c.azione === 'mia') {
      const x = sua(await leggi());
      return res.status(200).json({ carta: x ? pub(x) : null });
    }
    if (c.azione === 'iscrivi') {
      if (c.statuto !== true) return err(400, 'Per iscriverti devi accettare lo statuto.');
      if (!(await limite('tes:' + sub, 5, 3600))) return err(429, 'Troppe richieste: riprova più tardi.');
      return await conLucchetto(async () => {
        const d = await leggi(), gia = sua(d);
        if (gia) return res.status(200).json({ ok: true, carta: pub(gia) });   // una sola tessera per account (anche se revocata)
        const anno = new Date().getFullYear(), mk = n => 'TES-' + PARTITO.sigla + '-' + anno + '-' + String(n).padStart(6, '0');
        let n = d.carte.filter(x => x.emittente === PARTITO.sigla).length + 1;
        while (d.carte.some(x => x.numero === mk(n))) n++;
        const x = { id: 'CS-' + crypto.randomUUID().slice(0, 8), tipo: 'tessera-partito', emittente: PARTITO.sigla, nomeEmittente: PARTITO.nome, colore: PARTITO.colore,
          idEstji: sub, numero: mk(n), emessa: new Date().toISOString().slice(0, 10), stato: 'attiva' };
        d.carte.push(x);
        await scriviFileJson(FILE, d, 'Nuova tessera ' + x.numero);
        return res.status(200).json({ ok: true, carta: pub(x) });
      });
    }
    return err(400, 'Azione non riconosciuta.');
  } catch (e) { return err(500, 'Errore: ' + e.message); }
}
