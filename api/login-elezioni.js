// api/login-elezioni.js — login redazione CEPU (elezioni.json).
//
// Variabili d'ambiente (invariate rispetto a prima):
//   REDAZIONE_USER      -> nome utente della redazione
//   REDAZIONE_PASSWORD  -> password della redazione

import { creaToken } from './_sessione.js';

const VALID_USERS = [
    {
        username: process.env.REDAZIONE_USER || 'TandeePetrenka',
        password: process.env.REDAZIONE_PASSWORD || 'TandeePetrenka'
    }
];

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Metodo non consentito.' });
    }

    let corpo = req.body;
    if (typeof corpo === 'string') {
        try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
    }

    const username = (corpo && corpo.username ? String(corpo.username) : '').trim();
    const password = corpo && corpo.password ? String(corpo.password) : '';

    const utente = VALID_USERS.find(u => u.username === username && u.password === password);
    if (!utente) {
        return res.status(401).json({ error: 'Nome utente o password errati.' });
    }

    res.setHeader('Cache-Control', 'no-store');
    // NB: prima qui c'era "token: { binId, apiKey }" (oggetto). Ora è una stringa.
    // redazioneCEPU.html va adeguato di conseguenza (vedi patch dedicata).
    return res.status(200).json({
        success: true,
        username: utente.username,
        token: creaToken(utente.username)
    });
}
