// api/atti.js — un solo endpoint per gli atti/norme (NormAktiv: normaktiv.html,
// atto.html, redazione.html) e per le "norme collegate" di CA.html:
//   GET                                            -> lettura pubblica di atti.json
//   POST { azione: "login", username, password }   -> login redazione
//   POST { azione: "salva", atti: [...] }           -> salvataggio (richiede Authorization: Bearer <token>)
//
// Accorpato da atti.js + atti-organi.js + login.js + salva-atti.js per stare
// sotto al limite di 12 funzioni serverless del piano gratuito di Vercel.
// ⚠️ Nota: prima CA.html leggeva da /api/atti-organi (rimosso). Aggiorna
// lex/assets/js/api-organi.js perché ApiOrgani.loadAtti() ora chiami /api/atti.

import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';

// ⚠️ Stessa nota di sempre: valuta di spostare queste credenziali in
// REDAZIONE_USER_ATTI / REDAZIONE_PASSWORD_ATTI quando vorrai occupartene.
const VALID_USERS = { "TandeePetrenka": "TandeePetrenka", "admin": "CambiamiAnche" };

function estraiAtti(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.atti)) return registro.atti;
    return [];
}

async function gestisciGet(req, res) {
    try {
        const registro = await leggiFileJson('atti.json', { atti: [] });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ atti: estraiAtti(registro) });
    } catch (error) {
        return res.status(500).json({ message: 'Errore lettura: ' + error.message });
    }
}

function gestisciLogin(corpo, res) {
    const { username, password } = corpo || {};
    if (VALID_USERS[username] && VALID_USERS[username] === password) {
        return res.status(200).json({ success: true, message: 'Login effettuato', token: creaToken(username) });
    }
    return res.status(401).json({ success: false, message: 'Credenziali errate' });
}

async function gestisciSalva(req, corpo, res) {
    const sessione = sessioneDaRichiesta(req);
    if (!sessione) return res.status(401).json({ message: 'Sessione scaduta: effettua di nuovo il login.' });
    const atti = corpo && Array.isArray(corpo.atti) ? corpo.atti : null;
    if (!atti) return res.status(400).json({ message: 'Corpo della richiesta non valido: atteso { atti: [...] }.' });
    try {
        await scriviFileJson('atti.json', { atti }, `Aggiornamento atti (${sessione.username})`);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: 'Errore salvataggio: ' + error.message });
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
        return res.status(400).json({ message: 'Azione non riconosciuta: atteso "login" o "salva".' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Metodo non consentito' });
}
