// api/organi.js — lettura pubblica dell'albero Organi (CA.html).
// Prima leggeva da JSONBin (BIN_ID_ORGANI); ora legge organi.json dalla repo DATA.

import { leggiFileJson } from './_github.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    try {
        const dati = await leggiFileJson('organi.json', { alberoOrgani: [], alberoLuoghi: [], luoghi: {} });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(dati);
    } catch (error) {
        return res.status(500).json({ error: 'Errore interno del server: ' + error.message });
    }
}
