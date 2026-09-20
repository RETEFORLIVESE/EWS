// api/organi.js — un solo endpoint per Congressi e Assemblee (CA.html):
//   GET                                            -> lettura pubblica di organi.json
//   POST { azione: "login", username, password }   -> login redazione
//   POST { azione: "salva", ...datiCompleti }       -> salvataggio (richiede Authorization: Bearer <token>)
//
// Accorpato da organi.js + login-organi.js + salva-organi.js per stare sotto
// al limite di 12 funzioni serverless del piano gratuito di Vercel.

import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';

const VALID_USERS = [
    {
        username: process.env.REDAZIONE_USER || 'TandeePetrenka',
        password: process.env.REDAZIONE_PASSWORD || 'TandeePetrenka'
    }
];

async function gestisciGet(req, res) {
    try {
        const dati = await leggiFileJson('organi.json', { alberoOrgani: [], alberoLuoghi: [], luoghi: {} });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json(dati);
    } catch (error) {
        return res.status(500).json({ error: 'Errore interno del server: ' + error.message });
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
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
        return res.status(400).json({ error: 'Corpo della richiesta non valido.' });
    }
    const { azione, ...datiCompleti } = corpo;
    try {
        await scriviFileJson('organi.json', datiCompleti, `Aggiornamento organi (${sessione.username})`);
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
