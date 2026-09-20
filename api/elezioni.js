// api/elezioni.js — lettura pubblica delle elezioni (CEPU.html).
// elezioni.json nella repo DATA è salvato come { "elezioni": [ ... ] }: gestiamo
// anche il caso in cui sia un array nudo, per robustezza.

import { leggiFileJson } from './_github.js';

function estraiElezioni(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.elezioni)) return registro.elezioni;
    return [];
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo non consentito.' });
    }

    try {
        const registro = await leggiFileJson('elezioni.json', { elezioni: [] });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ elezioni: estraiElezioni(registro) });
    } catch (error) {
        return res.status(500).json({ error: 'Errore lettura: ' + error.message });
    }
}
