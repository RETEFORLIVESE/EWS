// api/elezioni.js — un solo endpoint per CEPU.html / redazioneCEPU.html:
//   GET                                            -> lettura pubblica di elezioni.json
//   POST { azione: "login", username, password }   -> login redazione
//   POST { azione: "login-estji", id_token }       -> login redazione con Estji ID (QR + codice)
//   POST { azione: "salva", elezioni: [...] }       -> salvataggio (richiede Authorization: Bearer <token>)
//
// Accorpato da elezioni.js + login-elezioni.js + salva-elezioni.js per stare
// sotto al limite di 12 funzioni serverless del piano gratuito di Vercel.

import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';
import { verificaIdToken, haScope } from './_estji-verifica.js';

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
        res.setHeader('Access-Control-Allow-Origin', '*');   // lettura pubblica: la wiki può mostrare i grafici anche da un altro dominio
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

// ---- Login con Estji ID (QR) ----
// Il token deve essere per questo portale ("cepu") e contenere lo scope cepu.edit
// (Estji ID lo concede solo a identità verificate con il ruolo "Redattore CEPU", dopo la verifica con il codice).
// La sessione creata vale solo per CEPU (ambito 'cepu'): non apre gli altri sistemi.
async function gestisciLoginEstji(corpo, res) {
    let c = null;
    try { c = await verificaIdToken(corpo.id_token, 'cepu'); }
    catch (e) { return res.status(502).json({ error: 'Verifica Estji ID non disponibile: riprova.' }); }
    if (!c) return res.status(401).json({ error: 'Accesso Estji ID non valido o scaduto.' });
    if (!haScope(c, 'cepu.edit')) {
        const haRuolo = Array.isArray(c.roles) && c.roles.includes('redattore_cepu');
        return res.status(403).json({ error: haRuolo && !c.vote_eligible
            ? 'Hai il ruolo di Redattore CEPU, ma il tuo Estji ID è ancora "In verifica": serve la verifica dello staff.'
            : 'Per la redazione CEPU serve il ruolo di Redattore CEPU.' });
    }
    const nome = String(c.nick || c.sub);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ success: true, username: nome, token: creaToken(nome, 'cepu') });
}

async function gestisciSalva(req, corpo, res) {
    const sessione = sessioneDaRichiesta(req, 'cepu');   // accetta il login classico e quello con QR
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
        if (corpo && corpo.azione === 'login-estji') return gestisciLoginEstji(corpo, res);
        if (corpo && corpo.azione === 'salva') return gestisciSalva(req, corpo, res);
        return res.status(400).json({ error: 'Azione non riconosciuta: atteso "login", "login-estji" o "salva".' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Metodo non consentito.' });
}