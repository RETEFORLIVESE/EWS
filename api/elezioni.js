// api/elezioni.js — un solo endpoint per CEPU.html / redazioneCEPU.html:
//   GET                                            -> lettura pubblica di elezioni.json
//   POST { azione: "login", username, password }   -> login redazione
//   POST { azione: "salva", elezioni: [...] }       -> salvataggio (richiede Authorization: Bearer <token>)
//
// Accorpato da elezioni.js + login-elezioni.js + salva-elezioni.js per stare
// sotto al limite di 12 funzioni serverless del piano gratuito di Vercel.

import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';

const VALID_USERS = [
    {
        username: process.env.REDAZIONE_USER || 'TandeePetrenka',
        password: process.env.REDAZIONE_PASSWORD || 'TandeePetrenka'
    }
];

function estraiElezioni(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.elezioni)) return registro.elezioni;
    return [];
}

async function gestisciGet(req, res) {
    try {
        const registro = await leggiFileJson('elezioni.json', { elezioni: [] });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ elezioni: estraiElezioni(registro) });
    } catch (error) {
        return res.status(500).json({ error: 'Errore lettura: ' + error.message });
    }
}

function gestisciLogin(corpo, res) {
    const username = (corpo && corpo.username ? String(corpo.username) : '').trim();
    const password = corpo && corpo.password ? String(corpo.password) : '';
    const utente = VALID_USERS.find(u => u.username === username && u.password === password);
    if (!utente) return res.status(401).json({ error: 'Nome utente o password errati.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, username: utente.username, token: creaToken(utente.username) });
}

async function gestisciSalva(req, corpo, res) {
    const sessione = sessioneDaRichiesta(req);
    if (!sessione) return res.status(401).json({ error: 'Sessione scaduta: effettua di nuovo il login.' });
    const elezioni = corpo && Array.isArray(corpo.elezioni) ? corpo.elezioni : null;
    if (!elezioni) return res.status(400).json({ error: 'Corpo della richiesta non valido: atteso { elezioni: [...] }.' });
    try {
        await scriviFileJson('elezioni.json', { elezioni }, `Aggiornamento elezioni (${sessione.username})`);
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
    return res.status(405).json({ error: 'Metodo non consentito.' });
}
