<<<<<<< HEAD
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
=======
// api/ctsu.js — un solo endpoint per i progetti tecnici CTSU (ctsu.html,
// progetto.html, redazione-ctsu.html), stesso schema di api/atti.js:
//   GET                                              -> lettura pubblica di ctsu.json
//   POST { azione: "login", username, password }     -> login redazione
//   POST { azione: "salva", progetti: [...] }         -> salvataggio (richiede Authorization: Bearer <token>)
//
// I dati stanno nel repository DATA, nel file ctsu.json, con questa forma:
//   { "progetti": [ { "id": "...", "titolo": "...", ... } ] }
//
// Gli errori sono restituiti nel campo "error" (è quello che legge assets/js/ctsu-core.js).
//
// Credenziali della redazione: variabili d'ambiente su Vercel
//   REDAZIONE_USER_CTSU
//   REDAZIONE_PASSWORD_CTSU

import crypto from 'node:crypto';
import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';

const FILE_DATI = 'ctsu.json';
>>>>>>> 3dcb2829230ba0b998190e68f934fc6d8846d91b

function estraiProgetti(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.progetti)) return registro.progetti;
    return [];
}

<<<<<<< HEAD
async function gestisciGet(req, res) {
    try {
        const registro = await leggiFileJson('ctsu.json', { progetti: [] });
=======
// Confronto a tempo costante (evita di rivelare quanti caratteri coincidono)
function uguali(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Un progetto è valido se è un oggetto con un id testuale non vuoto
// (l'id serve a progetto.html?id=... per ritrovarlo).
function progettiValidi(progetti) {
    return progetti.every(p => p && typeof p === 'object' && typeof p.id === 'string' && p.id.trim() !== '');
}

async function gestisciGet(req, res) {
    try {
        const registro = await leggiFileJson(FILE_DATI, { progetti: [] });
>>>>>>> 3dcb2829230ba0b998190e68f934fc6d8846d91b
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ progetti: estraiProgetti(registro) });
    } catch (error) {
        return res.status(500).json({ error: 'Errore lettura: ' + error.message });
    }
}

function gestisciLogin(corpo, res) {
<<<<<<< HEAD
    const username = (corpo && corpo.username ? String(corpo.username) : '').trim();
    const password = corpo && corpo.password ? String(corpo.password) : '';
    const utente = VALID_USERS.find(u => u.username === username && u.password === password);
    if (!utente) return res.status(401).json({ error: 'Credenziali non valide' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, username: utente.username, token: creaToken(utente.username) });
=======
    const utenteAtteso = process.env.REDAZIONE_USER_CTSU;
    const passwordAttesa = process.env.REDAZIONE_PASSWORD_CTSU;
    if (!utenteAtteso || !passwordAttesa) {
        return res.status(500).json({
            success: false,
            error: 'Login non configurato: imposta REDAZIONE_USER_CTSU e REDAZIONE_PASSWORD_CTSU su Vercel.'
        });
    }
    const { username, password } = corpo || {};
    if (typeof username === 'string' && typeof password === 'string' &&
        uguali(username, utenteAtteso) && uguali(password, passwordAttesa)) {
        return res.status(200).json({
            success: true,
            message: 'Login effettuato',
            token: creaToken(username),
            username
        });
    }
    return res.status(401).json({ success: false, error: 'Credenziali errate' });
>>>>>>> 3dcb2829230ba0b998190e68f934fc6d8846d91b
}

async function gestisciSalva(req, corpo, res) {
    const sessione = sessioneDaRichiesta(req);
    if (!sessione) return res.status(401).json({ error: 'Sessione scaduta: effettua di nuovo il login.' });
<<<<<<< HEAD
    const progetti = corpo && Array.isArray(corpo.progetti) ? corpo.progetti : null;
    if (!progetti) return res.status(400).json({ error: 'Corpo della richiesta non valido: atteso { progetti: [...] }.' });
    try {
        await scriviFileJson('ctsu.json', { progetti }, `Aggiornamento CTSU (${sessione.username})`);
=======

    const progetti = corpo && Array.isArray(corpo.progetti) ? corpo.progetti : null;
    if (!progetti) return res.status(400).json({ error: 'Corpo della richiesta non valido: atteso { progetti: [...] }.' });
    if (!progettiValidi(progetti)) return res.status(400).json({ error: 'Ogni progetto deve avere un "id" testuale non vuoto.' });

    try {
        await scriviFileJson(FILE_DATI, { progetti }, `Aggiornamento progetti CTSU (${sessione.username})`);
>>>>>>> 3dcb2829230ba0b998190e68f934fc6d8846d91b
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
