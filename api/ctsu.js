// api/ctsu.js — un solo endpoint per CTSU (ctsu.html, progetto.html, redazione-ctsu.html):
//   GET                                            -> lettura pubblica di ctsu.json
//   POST { azione: "login", username, password }   -> login redazione
//   POST { azione: "salva", progetti: [...] }       -> salvataggio (richiede Authorization: Bearer <token>)
//
// Sostituisce sia il vecchio api/ctsu.js (solo lettura) sia api/ctsu-redazione.js:
// ora è tutto in un solo file, per stare sotto al limite di 12 funzioni
// serverless del piano gratuito di Vercel. ⚠️ Elimina ctsu-redazione.js dal repo.

import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';

const VALID_USERS = [
    {
        username: process.env.CTSU_USER || process.env.REDAZIONE_USER || 'TandeePetrenka',
        password: process.env.CTSU_PASSWORD || process.env.REDAZIONE_PASSWORD || 'TandeePetrenka'
    }
];

function estraiProgetti(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.progetti)) return registro.progetti;
    return [];
}

async function gestisciGet(req, res) {
    try {
        const registro = await leggiFileJson('ctsu.json', { progetti: [] });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ progetti: estraiProgetti(registro) });
    } catch (error) {
        return res.status(500).json({ error: 'Errore lettura: ' + error.message });
    }
}

function gestisciLogin(corpo, res) {
    const username = (corpo && corpo.username ? String(corpo.username) : '').trim();
    const password = corpo && corpo.password ? String(corpo.password) : '';
    const utente = VALID_USERS.find(u => u.username === username && u.password === password);
    if (!utente) return res.status(401).json({ error: 'Credenziali non valide' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, username: utente.username, token: creaToken(utente.username) });
}

async function gestisciSalva(req, corpo, res) {
    const sessione = sessioneDaRichiesta(req);
    if (!sessione) return res.status(401).json({ error: 'Sessione scaduta: effettua di nuovo il login.' });
    const progetti = corpo && Array.isArray(corpo.progetti) ? corpo.progetti : null;
    if (!progetti) return res.status(400).json({ error: 'Corpo della richiesta non valido: atteso { progetti: [...] }.' });
    try {
        await scriviFileJson('ctsu.json', { progetti }, `Aggiornamento CTSU (${sessione.username})`);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Errore salvataggio: ' + error.message });
    }
}

export default async function handler(req, res) {
    if (req.method === 'GET') return gestisciGet(req, res);

    if (req.method === 'POST') {
        let corpo = req.body;
        if (typeof corpo === 'string') {
            try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
        }
        if (corpo && corpo.azione === 'login') return gestisciLogin(corpo, res);
        if (corpo && corpo.azione === 'salva') return gestisciSalva(req, corpo, res);
        return res.status(400).json({ error: 'Azione non riconosciuta: atteso "login" o "salva".' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metodo non consentito' });
}
