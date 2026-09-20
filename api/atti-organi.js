// api/atti-organi.js — lettura pubblica degli atti per la sezione "Norme collegate" di CA.html.
// Stessa fonte dati di api/atti.js (atti.json), endpoint separato per non dover
// toccare lex/assets/js/api-organi.js più del necessario.

import { leggiFileJson } from './_github.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    try {
        const atti = await leggiFileJson('atti.json', []);
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ atti: Array.isArray(atti) ? atti : [] });
    } catch (error) {
        return res.status(500).json({ error: 'Impossibile leggere gli atti: ' + error.message });
    }
}
