// api/ctsu-redazione.js — un solo endpoint per login e salvataggio della redazione CTSU,
// per avere un file in meno da mantenere. Il corpo della richiesta dice cosa fare:
//   POST { azione: "login", username, password }                → restituisce un token di sessione
//   POST { azione: "salva", progetti: [...] } + header Authorization: Bearer <token> → commit su GitHub

import { creaToken, sessioneDaRichiesta } from './_sessione.js';
import { scriviFileJson } from './_github.js';

const VALID_USERS = [
    {
        username: process.env.CTSU_USER || process.env.REDAZIONE_USER || 'TandeePetrenka',
        password: process.env.CTSU_PASSWORD || process.env.REDAZIONE_PASSWORD || 'TandeePetrenka'
    }
];

async function gestisciLogin(corpo, res) {
    const username = (corpo && corpo.username ? String(corpo.username) : '').trim();
    const password = corpo && corpo.password ? String(corpo.password) : '';

    const utente = VALID_USERS.find(u => u.username === username && u.password === password);
    if (!utente) {
        return res.status(401).json({ error: 'Credenziali non valide' });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
        success: true,
        username: utente.username,
        token: creaToken(utente.username)
    });
}

async function gestisciSalvataggio(req, corpo, res) {
    const sessione = sessioneDaRichiesta(req);
    if (!sessione) {
        return res.status(401).json({ error: 'Sessione scaduta: effettua di nuovo il login.' });
    }

    const progetti = corpo && Array.isArray(corpo.progetti) ? corpo.progetti : null;
    if (!progetti) {
        return res.status(400).json({ error: 'Corpo della richiesta non valido: atteso { progetti: [...] }.' });
    }

    try {
        await scriviFileJson('ctsu.json', { progetti }, `Aggiornamento CTSU (${sessione.username})`);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Errore salvataggio: ' + error.message });
    }
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Metodo non consentito' });
    }

    let corpo = req.body;
    if (typeof corpo === 'string') {
        try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
    }

    if (corpo && corpo.azione === 'login') return gestisciLogin(corpo, res);
    if (corpo && corpo.azione === 'salva') return gestisciSalvataggio(req, corpo, res);

    return res.status(400).json({ error: 'Azione non riconosciuta: atteso "login" o "salva".' });
}
