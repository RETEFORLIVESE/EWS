// api/atti.js — lettura pubblica degli atti (NormAktiv: normaktiv.html, atto.html).
// atti.json nella repo DATA è salvato come { "atti": [ ... ] }: gestiamo anche
// il caso in cui sia un array nudo, per robustezza.

import { leggiFileJson } from './_github.js';

function estraiAtti(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.atti)) return registro.atti;
    return [];
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ message: 'Metodo non consentito' });
    }

    try {
        const registro = await leggiFileJson('atti.json', { atti: [] });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ atti: estraiAtti(registro) });
    } catch (error) {
        return res.status(500).json({ message: 'Errore lettura: ' + error.message });
    }
}
