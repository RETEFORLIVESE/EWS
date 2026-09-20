// api/atti.js — lettura pubblica degli atti (NormAktiv: normaktiv.html, atto.html).
// Prima leggeva da JSONBin (BIN_ID, chiave "atti"); ora legge atti.json dalla repo DATA.

import { leggiFileJson } from './_github.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ message: 'Metodo non consentito' });
    }

    try {
        const atti = await leggiFileJson('atti.json', []);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ atti: Array.isArray(atti) ? atti : [] });
    } catch (error) {
        return res.status(500).json({ message: 'Errore lettura: ' + error.message });
    }
}
