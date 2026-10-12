// api/estji.js — UNICA funzione di Estji ID (così si usa un solo slot dei 12 del piano Hobby di Vercel).
// Smista in base al metodo e all'azione; la logica sta nei file _id.js, _sso.js, _jwks.js
// (i file che iniziano con "_" in api/ non contano come funzioni).
//   GET                                          -> chiave pubblica (jwks)
//   POST { azione: richiedi|stato|info|approva|rifiuta }   -> accesso ai portali con QR
//   POST { azione: registra|accedi|profilo|cambia-password|tf } -> identità personale
import id from './_id.js';
import sso from './_sso.js';
import jwks from './_jwks.js';
import { corpoJson } from './_idstore.js';

const AZIONI_SSO = ['richiedi', 'stato', 'info', 'approva', 'rifiuta'];

export default async function handler(req, res) {
  if (req.method === 'GET') return jwks(req, res);
  if (req.method === 'OPTIONS') return sso(req, res);
  const c = await corpoJson(req);
  return AZIONI_SSO.includes(c.azione) ? sso(req, res) : id(req, res);
}
