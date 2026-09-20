// api/elezioni.js — lettura pubblica delle elezioni (CEPU.html).
// Prima leggeva da JSONBin (BIN_ID_ELEZIONI); ora legge elezioni.json dalla repo DATA.

import { leggiFileJson } from './_github.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo non consentito.' });
    }

    try {
        const elezioni = await leggiFileJson('elezioni.json', []);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ elezioni: Array.isArray(elezioni) ? elezioni : [] });
    } catch (error) {
        return res.status(500).json({ error: 'Errore lettura: ' + error.message });
    }
}
