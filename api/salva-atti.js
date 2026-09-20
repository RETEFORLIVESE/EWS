// api/salva-atti.js — salva l'elenco atti (redazione.html / NormAktiv).
// Scrive nel formato { "atti": [...] }, coerente con quello già presente in atti.json.

import { sessioneDaRichiesta } from './_sessione.js';
import { scriviFileJson } from './_github.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Metodo non consentito' });
    }

    const sessione = sessioneDaRichiesta(req);
    if (!sessione) {
        return res.status(401).json({ message: "Sessione scaduta: effettua di nuovo il login." });
    }

    let corpo = req.body;
    if (typeof corpo === 'string') {
        try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
    }
    const atti = corpo && Array.isArray(corpo.atti) ? corpo.atti : null;
    if (!atti) {
        return res.status(400).json({ message: 'Corpo della richiesta non valido: atteso { atti: [...] }.' });
    }

    try {
        await scriviFileJson('atti.json', { atti }, `Aggiornamento atti (${sessione.username})`);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Errore salvataggio: ' + error.message });
    }
}
