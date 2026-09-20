// api/atti-organi.js — lettura pubblica degli atti per la sezione "Norme collegate" di CA.html.
// Stessa fonte dati di api/atti.js (atti.json), endpoint separato per non dover
// toccare lex/assets/js/api-organi.js più del necessario.

import { leggiFileJson } from './_github.js';

function estraiAtti(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.atti)) return registro.atti;
    return [];
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    try {
        const registro = await leggiFileJson('atti.json', { atti: [] });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ atti: estraiAtti(registro) });
    } catch (error) {
        return res.status(500).json({ error: 'Impossibile leggere gli atti: ' + error.message });
    }
}
