// api/_jwks.js — chiave pubblica di Estji ID: i portali la usano per verificare i token.
import { jwkPubblica } from './_idstore.js';
export default function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).json({ keys: [jwkPubblica()] });
  } catch (e) { return res.status(500).json({ error: e.message }); }
}
