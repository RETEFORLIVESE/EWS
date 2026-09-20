// api/ctsu.js — lettura pubblica dei progetti/relazioni tecniche (CTSU).
// Stesso pattern di api/atti.js ed api/elezioni.js: legge da GitHub (repo DATA privata).

import { leggiFileJson } from './_github.js';

function estraiProgetti(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.progetti)) return registro.progetti;
    return [];
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    try {
        const registro = await leggiFileJson('ctsu.json', { progetti: [] });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ progetti: estraiProgetti(registro) });
    } catch (error) {
        return res.status(500).json({ error: 'Errore lettura: ' + error.message });
    }
}
