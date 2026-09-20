// api/login.js — login redazione NormAktiv (atti.json).
// Stessa lista utenti di prima; cambia solo cosa viene restituito al browser:
// prima binId+apiKey di JSONBin, ora un token di sessione firmato (nessun segreto reale esce dal server).

import { creaToken } from './_sessione.js';

// ⚠️ Stessa nota di prima: valuta di spostare queste credenziali in variabili
// d'ambiente (REDAZIONE_USER_ATTI / REDAZIONE_PASSWORD_ATTI) quando vorrai
// occupartene — non l'ho toccato ora perché la richiesta era solo lo spostamento dati.
const VALID_USERS = {
    "TandeePetrenka": "TandeePetrenka",
    "admin": "CambiamiAnche"
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Metodo non consentito' });
    }

    let corpo = req.body;
    if (typeof corpo === 'string') {
        try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
    }
    const { username, password } = corpo || {};

    if (VALID_USERS[username] && VALID_USERS[username] === password) {
        return res.status(200).json({
            success: true,
            message: 'Login effettuato',
            token: creaToken(username)
        });
    }

    return res.status(401).json({ success: false, message: 'Credenziali errate' });
}
