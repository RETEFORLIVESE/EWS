// api/estji.js — UNICA funzione di Estji ID + tessere (così si usa un solo slot dei 12 del piano Hobby di Vercel).
// Smista in base al metodo, all'azione e al parametro ?r=; la logica sta nei file _id.js, _sso.js, _jwks.js, _tessere.js
// (i file che iniziano con "_" in api/ non contano come funzioni).
//   POST /api/tessere  (rewrite -> /api/estji?r=tessere) -> _tessere.js  { azione: accedi|carte|mia|iscrivi }
//   GET                                          -> chiave pubblica (jwks)
//   POST { azione: richiedi|stato|info|approva|rifiuta }   -> accesso ai portali con QR
//   POST { azione: registra|accedi|profilo|cambia-password|tf } -> identità personale
// NB: "accedi" esiste sia in _id.js sia in _tessere.js: li distingue solo ?r=tessere, non l'azione.
import id from './_id.js';
import sso from './_sso.js';
import jwks from './_jwks.js';
import tessere from './_tessere.js';
import { corpoJson } from './_idstore.js';

const AZIONI_SSO = ['richiedi', 'stato', 'info', 'approva', 'rifiuta'];

export default async function handler(req, res) {
  // Tessere: va controllato per primo, anche per OPTIONS (preflight CORS gestito da _tessere.js)
  if (req.query && req.query.r === 'tessere') return tessere(req, res);

  if (req.method === 'GET') return jwks(req, res);
  if (req.method === 'OPTIONS') return sso(req, res);
  const c = await corpoJson(req);
  return AZIONI_SSO.includes(c.azione) ? sso(req, res) : id(req, res);
}