// api/salva-organi.js — salva l'albero Organi (redazioneCA.html).
// Sostituisce il PUT diretto dal browser a JSONBin: ora il browser manda i dati
// qui con il token di sessione, e il server fa il commit su organi.json nella repo DATA.

import { sessioneDaRichiesta } from './_sessione.js';
import { scriviFileJson } from './_github.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    const sessione = sessioneDaRichiesta(req);
    if (!sessione) {
        return res.status(401).json({ error: "Sessione scaduta: effettua di nuovo il login." });
    }

    let corpo = req.body;
    if (typeof corpo === 'string') {
        try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
    }
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
        return res.status(400).json({ error: 'Corpo della richiesta non valido: atteso un oggetto con alberoOrgani/alberoLuoghi/luoghi.' });
    }

    try {
        await scriviFileJson('organi.json', corpo, `Aggiornamento organi (${sessione.username})`);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Errore salvataggio: ' + error.message });
    }
}
