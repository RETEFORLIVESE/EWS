// api/_estji-verifica.js — verifica dei token di Estji ID (RS256) nei portali.
// Nessun segreto: usa solo la chiave pubblica di Estji ID (GET /api/estji), quindi va bene anche con la repo pubblica.
// Il nome inizia con "_": non conta come funzione serverless di Vercel.
import crypto from 'crypto';

const ISS = process.env.ESTJI_ISS || 'https://ews-rose.vercel.app';
let cache = { chiavi: null, fino: 0 };

async function chiavi(forza) {
  if (!forza && cache.chiavi && Date.now() < cache.fino) return cache.chiavi;
  const r = await fetch(ISS + '/api/estji');
  if (!r.ok) throw new Error('JWKS non raggiungibile');
  cache = { chiavi: (await r.json()).keys || [], fino: Date.now() + 10 * 60 * 1000 };
  return cache.chiavi;
}

// Restituisce i claim se il token è valido per il portale "aud", altrimenti null.
// Lancia un errore solo se Estji ID non è raggiungibile (il chiamante risponde 502).
export async function verificaIdToken(token, aud) {
  const p = typeof token === 'string' ? token.split('.') : [];
  if (p.length !== 3) return null;
  let h, c;
  try {
    h = JSON.parse(Buffer.from(p[0], 'base64url').toString());
    c = JSON.parse(Buffer.from(p[1], 'base64url').toString());
  } catch (e) { return null; }
  if (!h || h.alg !== 'RS256' || !c) return null;
  const trova = ks => ks.find(x => !h.kid || x.kid === h.kid);
  const k = trova(await chiavi(false)) || trova(await chiavi(true));   // la seconda copre una chiave ruotata
  if (!k) return null;
  const ok = crypto.verify('RSA-SHA256', Buffer.from(p[0] + '.' + p[1]),
    crypto.createPublicKey({ key: k, format: 'jwk' }), Buffer.from(p[2], 'base64url'));
  if (!ok || c.iss !== ISS || ![].concat(c.aud).includes(aud) || !(c.exp * 1000 > Date.now())) return null;
  return c;
}

export const haScope = (c, s) => String(c.scope || '').split(' ').includes(s);