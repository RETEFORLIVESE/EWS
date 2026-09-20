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

function estraiProgetti(registro) {
    if (Array.isArray(registro)) return registro;
    if (registro && Array.isArray(registro.progetti)) return registro.progetti;
    return [];
}

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
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ progetti: estraiProgetti(registro) });
    } catch (error) {
        return res.status(500).json({ error: 'Errore lettura: ' + error.message });
    }
}

function gestisciLogin(corpo, res) {
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
}

async function gestisciSalva(req, corpo, res) {
    const sessione = sessioneDaRichiesta(req);
    if (!sessione) return res.status(401).json({ error: 'Sessione scaduta: effettua di nuovo il login.' });

    const progetti = corpo && Array.isArray(corpo.progetti) ? corpo.progetti : null;
    if (!progetti) return res.status(400).json({ error: 'Corpo della richiesta non valido: atteso { progetti: [...] }.' });
    if (!progettiValidi(progetti)) return res.status(400).json({ error: 'Ogni progetto deve avere un "id" testuale non vuoto.' });

    try {
        await scriviFileJson(FILE_DATI, { progetti }, `Aggiornamento progetti CTSU (${sessione.username})`);
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
