// api/salva-elezioni.js — salva l'elenco elezioni (redazioneCEPU.html).
// Sostituisce il PUT diretto dal browser a JSONBin.

import { sessioneDaRichiesta } from './_sessione.js';
import { scriviFileJson } from './_github.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Metodo non consentito.' });
    }

    const sessione = sessioneDaRichiesta(req);
    if (!sessione) {
        return res.status(401).json({ error: "Sessione scaduta: effettua di nuovo il login." });
    }

    let corpo = req.body;
    if (typeof corpo === 'string') {
        try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
    }
    const elezioni = corpo && Array.isArray(corpo.elezioni) ? corpo.elezioni : null;
    if (!elezioni) {
        return res.status(400).json({ error: 'Corpo della richiesta non valido: atteso { elezioni: [...] }.' });
    }

    try {
        await scriviFileJson('elezioni.json', elezioni, `Aggiornamento elezioni (${sessione.username})`);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Errore salvataggio: ' + error.message });
    }
}
