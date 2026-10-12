// api/_sso.js — accesso ai portali con Estji ID (QR).
//   PC (widget, da un portale registrato):   richiedi -> stato (ogni 2 s)
//   Telefono (pagina id.html, con sessione): info -> approva | rifiuta
// Il PC tiene un segreto (verifier) che non lascia mai il browser: solo chi ha avviato la richiesta può ritirare il token.
import crypto from 'crypto';
import { ISS, SCOPES, PORTALI, redis, limite, ipDi, trovaId, leggiIde, sessioneId, scopeConcessi, ruoliTecnici,
         firmaJwt, corpoJson } from './_idstore.js';

const TTL = 120;
const TUTTE_LE_ORIGINI = [...new Set(Object.values(PORTALI).flatMap(p => p.origins))];
const hard = scopes => scopes.some(s => SCOPES[s][0] >= 3);
const chiave = id => 'ssoreq:' + id;
const idValido = id => typeof id === 'string' && /^[A-Za-z0-9_-]{20,32}$/.test(id);

export default async function handler(req, res) {
  const origin = req.headers.origin;
  if (origin && TUTTE_LE_ORIGINI.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo non consentito' });
  const c = await corpoJson(req);
  const err = (s, m) => res.status(s).json({ error: m });
  try {
    if (c.azione === 'richiedi') {
      const portale = PORTALI[c.client_id];
      if (!portale) return err(400, 'Sito non registrato.');
      if (!portale.origins.includes(origin)) return err(403, 'Sito non registrato.');
      const scopes = Array.isArray(c.scopes) ? c.scopes.filter(s => typeof s === 'string') : [];
      if (!scopes.length || scopes.some(s => !portale.scopes.includes(s))) return err(400, 'Permessi non assegnati a questo portale.');
      if (typeof c.vh !== 'string' || !/^[a-f0-9]{64}$/.test(c.vh)) return err(400, 'Richiesta non valida.');
      if (!(await limite('sso:' + ipDi(req), 30, 600))) return err(429, 'Troppe richieste: riprova tra poco.');
      const id = crypto.randomBytes(18).toString('base64url'), h = hard(scopes), numero = 10 + crypto.randomInt(90);
      await redis('SET', chiave(id), JSON.stringify({ c: c.client_id, s: scopes, vh: c.vh, st: 'attesa', n: h ? numero : 0,
        da: String(req.headers['user-agent'] || '').slice(0, 80) }), 'EX', TTL);
      return res.status(200).json({ id, qr_payload: ISS + '/id.html?r=' + id, expires_in: TTL, numero: h ? numero : null });
    }
    if (c.azione === 'stato') {
      if (!idValido(c.id) || typeof c.verifier !== 'string') return err(400, 'Richiesta non valida.');
      const raw = await redis('GET', chiave(c.id));
      if (!raw) return res.status(200).json({ stato: 'scaduta' });
      const r = JSON.parse(raw);
      if (crypto.createHash('sha256').update(c.verifier).digest('hex') !== r.vh) return err(403, 'Richiesta non valida.');
      if (r.st === 'rifiutata') { await redis('DEL', chiave(c.id)); return res.status(200).json({ stato: 'rifiutata' }); }
      if (r.st !== 'approvata') return res.status(200).json({ stato: 'attesa' });
      await redis('DEL', chiave(c.id));   // monouso
      const p = trovaId(await leggiIde(), r.sub);
      if (!p) return err(401, 'Identità non trovata.');
      const iat = Math.floor(Date.now() / 1000);
      const claims = { iss: ISS, aud: r.c, sub: p.id, nick: p.nick, scope: scopeConcessi(p, r.s, r.loa).join(' '), loa: r.loa,
        roles: ruoliTecnici(p), vote_eligible: !!p.verificato, iat, exp: iat + 600 };
      return res.status(200).json({ stato: 'approvata', claims, id_token: firmaJwt(claims) });
    }
    // ---- dal telefono: serve la sessione personale ----
    const s = sessioneId(req);
    if (!s) return err(401, 'Accedi per continuare.');
    if (!idValido(c.id)) return err(400, 'Richiesta non valida.');
    const raw = await redis('GET', chiave(c.id));
    if (!raw) return err(410, 'QR scaduto: generane uno nuovo sul PC.');
    const r = JSON.parse(raw);
    if (c.azione === 'info') {
      const o = [r.n, 10 + (r.n + 17) % 90, 10 + (r.n + 53) % 90].sort((a, b) => (a * 7 % 11) - (b * 7 % 11));
      return res.status(200).json({ portale: PORTALI[r.c].nome, permessi: r.s.map(k => SCOPES[k][2]), da: r.da, stato: r.st, numero: r.n ? o : null });
    }
    if (r.st !== 'attesa') return err(409, 'Richiesta già gestita.');
    if (c.azione === 'rifiuta') { await redis('SET', chiave(c.id), JSON.stringify({ ...r, st: 'rifiutata' }), 'EX', 60); return res.status(200).json({ ok: true }); }
    if (c.azione === 'approva') {
      if (r.n && Number(c.scelta) !== r.n) {   // numero sbagliato: richiesta annullata (possibile phishing)
        await redis('DEL', chiave(c.id));
        return err(403, 'Numero errato: richiesta annullata. Se non hai avviato tu l\'accesso, potrebbe essere un tentativo di phishing.');
      }
      await redis('SET', chiave(c.id), JSON.stringify({ ...r, st: 'approvata', sub: s.id, loa: r.n ? 3 : 2 }), 'EX', 60);
      return res.status(200).json({ ok: true });
    }
    return err(400, 'Azione non riconosciuta.');
  } catch (e) { return err(500, 'Errore: ' + e.message); }
}
