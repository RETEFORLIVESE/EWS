// api/ctsu.js — un solo endpoint per il sistema CTSU (ctsu.html, progetto.html, redazione-ctsu.html):
//   GET                                            -> lettura pubblica di ctsu.json
//   POST { azione: "login", username, password }   -> login redazione
//   POST { azione: "salva", progetti: [...] }       -> salvataggio (richiede Authorization: Bearer <token>)
//
// Stessa struttura di api/atti.js: usa gli stessi helper condivisi
//   ./_github.js   (leggiFileJson / scriviFileJson: legge e scrive il file nel repo DATA)
//   ./_sessione.js (creaToken / sessioneDaRichiesta: sessione firmata)
// così token, chiavi e permessi GitHub sono esattamente quelli già funzionanti per NormAktiv
// e non serve nessuna variabile d'ambiente nuova.
//
// Accesso: come in api/atti.js, utenti e password sono scritti qui sotto in VALID_USERS.

import crypto from 'crypto';
import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';

const FILE = 'ctsu.json';
const MAX_PROGETTI = 500;

// ⚠️ Utenti della redazione CTSU: "nome utente": "password".
// Modifica qui per aggiungere, togliere o cambiare le credenziali (poi ricarica il file su GitHub).
// Attenzione: se il repository è pubblico, queste password sono leggibili da chiunque.
const VALID_USERS = {
  "TandeePetrenka": "TandeePetrenka",
  "admin": "admin"
};

const hash = s => crypto.createHash('sha256').update(String(s == null ? '' : s)).digest();
const uguali = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const pausa = ms => new Promise(r => setTimeout(r, ms));

function credenzialiValide(username, password) {
  if (typeof username !== 'string' || !Object.prototype.hasOwnProperty.call(VALID_USERS, username)) return false;
  return uguali(password, VALID_USERS[username]);
}

function estraiProgetti(registro) {
  if (Array.isArray(registro)) return registro;
  if (registro && Array.isArray(registro.progetti)) return registro.progetti;
  return [];
}

function validaProgetti(progetti) {
  if (!Array.isArray(progetti)) return 'Formato non valido: atteso { progetti: [...] }.';
  if (progetti.length > MAX_PROGETTI) return `Troppi progetti (massimo ${MAX_PROGETTI}).`;
  const visti = new Set();
  for (const p of progetti) {
    if (!p || typeof p !== 'object') return 'Progetto non valido.';
    if (typeof p.id !== 'string' || !p.id.trim()) return 'Ogni progetto deve avere un identificativo.';
    if (typeof p.titolo !== 'string' || !p.titolo.trim()) return `Il progetto "${p.id}" non ha un titolo.`;
    if (visti.has(p.id)) return `Identificativo duplicato: "${p.id}".`;
    visti.add(p.id);
  }
  return null;
}

async function gestisciGet(req, res) {
  try {
    const registro = await leggiFileJson(FILE, { progetti: [] });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ progetti: estraiProgetti(registro) });
  } catch (e) {
    return res.status(500).json({ error: 'Errore lettura: ' + e.message });
  }
}

async function gestisciLogin(corpo, res) {
  const username = typeof corpo.username === 'string' ? corpo.username.trim() : '';
  if (!credenzialiValide(username, corpo.password)) {
    await pausa(700);   // rallenta i tentativi ripetuti
    return res.status(401).json({ success: false, error: 'Credenziali errate' });
  }
  return res.status(200).json({ success: true, message: 'Login effettuato', token: creaToken(username), username });
}

async function gestisciSalva(req, corpo, res) {
  const sessione = sessioneDaRichiesta(req);
  if (!sessione) return res.status(401).json({ error: 'Sessione scaduta: effettua di nuovo il login.' });
  const errore = validaProgetti(corpo.progetti);
  if (errore) return res.status(400).json({ error: errore });
  try {
    // conserva eventuali altri campi già presenti nel file, aggiorna solo "progetti"
    let attuale = {};
    try { const r = await leggiFileJson(FILE, { progetti: [] }); if (r && !Array.isArray(r)) attuale = r; } catch (e) { /* file nuovo */ }
    await scriviFileJson(FILE, { ...attuale, progetti: corpo.progetti }, `Aggiornamento progetti CTSU (${sessione.username})`);
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Errore salvataggio: ' + e.message });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') return gestisciGet(req, res);

  if (req.method === 'POST') {
    let corpo = req.body;
    if (typeof corpo === 'string') {
      try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
    }
    corpo = corpo && typeof corpo === 'object' ? corpo : {};
    if (corpo.azione === 'login') return gestisciLogin(corpo, res);
    if (corpo.azione === 'salva') return gestisciSalva(req, corpo, res);
    return res.status(400).json({ error: 'Azione non riconosciuta: atteso "login" o "salva".' });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Metodo non consentito' });
}