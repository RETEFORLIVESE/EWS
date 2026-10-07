// api/unitext.js — un solo endpoint per UniText (unitext.html e unitext-redazione.html):
//   GET                                            -> lettura pubblica di unitext.json (solo testi "Pubblicato")
//   GET  + Authorization: Bearer <token>           -> lettura completa per la redazione (bozze incluse)
//   POST { azione: "login", username, password }   -> login redazione
//   POST { azione: "salva", testi: [...] }          -> salvataggio (richiede Authorization: Bearer <token>)
//
// Stessa struttura di api/ctsu.js: usa gli helper condivisi già funzionanti
//   ./_github.js   (leggiFileJson / scriviFileJson: legge e scrive il file nella repo DATA)
//   ./_sessione.js (creaToken / sessioneDaRichiesta: sessione firmata)
// quindi non servono variabili d'ambiente nuove (token GitHub, repo e permessi sono quelli esistenti).
//
// File nella repo DATA: unitext.json  ->  { "testi": [ ... ] }
//
// Accesso: utenti e password della redazione. Meglio NON lasciarli nel codice se la repo del sito
// è pubblica: su Vercel (Settings > Environment Variables) crea UNITEXT_USERS con un JSON del tipo
//   {"nome":"password","altro":"password2"}
// e viene usato al posto di VALID_USERS_DEFAULT.

import crypto from 'crypto';
import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';

const FILE = 'unitext.json';
const MAX_TESTI = 500;
const MAX_BYTE = 900000;           // la API contenuti di GitHub non gestisce bene file oltre ~1 MB
const STATI = ['Bozza', 'Pubblicato'];
const TIPI_BLOCCO = ['capitolo', 'sottocapitolo', 'paragrafo', 'citazione', 'immagine'];

// ⚠️ Cambia queste credenziali (o usa UNITEXT_USERS): "nome utente": "password".
const VALID_USERS_DEFAULT = {
  "TandeePetrenka": "TandeePetrenka  "
};

function utenti() {
  if (process.env.UNITEXT_USERS) {
    try {
      const u = JSON.parse(process.env.UNITEXT_USERS);
      if (u && typeof u === 'object' && !Array.isArray(u)) return u;
    } catch (e) { /* JSON non valido: si usano i valori nel codice */ }
  }
  return VALID_USERS_DEFAULT;
}

const hash = s => crypto.createHash('sha256').update(String(s == null ? '' : s)).digest();
const uguali = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));
const pausa = ms => new Promise(r => setTimeout(r, ms));

function credenzialiValide(username, password) {
  const elenco = utenti();
  if (typeof username !== 'string' || !Object.prototype.hasOwnProperty.call(elenco, username)) return false;
  return uguali(password, elenco[username]);
}

function estraiTesti(registro) {
  if (Array.isArray(registro)) return registro;
  if (registro && Array.isArray(registro.testi)) return registro.testi;
  return [];
}

const testo = (v, max) => (typeof v === 'string' ? v : '').slice(0, max || 20000);

// Tiene solo i campi previsti (niente campi sconosciuti nel database) e scarta i blocchi non validi.
function normalizzaTesto(t) {
  const corpo = (Array.isArray(t.corpo) ? t.corpo : []).filter(b => b && typeof b === 'object' && TIPI_BLOCCO.includes(b.tipo)).map(b => {
    if (b.tipo === 'capitolo' || b.tipo === 'sottocapitolo') return { tipo: b.tipo, titolo: testo(b.titolo, 300) };
    if (b.tipo === 'citazione') return { tipo: b.tipo, testo: testo(b.testo, 20000), fonte: testo(b.fonte, 500) };
    if (b.tipo === 'immagine') return { tipo: b.tipo, url: testo(b.url, 2000), didascalia: testo(b.didascalia, 500) };
    return { tipo: 'paragrafo', testo: testo(b.testo, 30000) };
  });
  const voci = lista => (Array.isArray(lista) ? lista : []).filter(x => x && typeof x === 'object').map(x => ({ testo: testo(x.testo, 3000) }));
  return {
    id: testo(t.id, 80),
    titolo: testo(t.titolo, 300),
    sottotitolo: testo(t.sottotitolo, 400),
    autore: testo(t.autore, 200),
    categoria: testo(t.categoria, 60),
    stato: t.stato === 'Pubblicato' ? 'Pubblicato' : 'Bozza',
    data: testo(t.data, 40),
    abstract: testo(t.abstract, 3000),
    parole_chiave: (Array.isArray(t.parole_chiave) ? t.parole_chiave : []).filter(p => typeof p === 'string' && p.trim()).map(p => p.slice(0, 60)).slice(0, 30),
    copertina: testo(t.copertina, 2000),
    corpo,
    note: voci(t.note),
    bibliografia: voci(t.bibliografia)
  };
}

function validaTesti(testi) {
  if (!Array.isArray(testi)) return 'Formato non valido: atteso { testi: [...] }.';
  if (testi.length > MAX_TESTI) return `Troppi testi (massimo ${MAX_TESTI}).`;
  const visti = new Set();
  for (const t of testi) {
    if (!t || typeof t !== 'object') return 'Testo non valido.';
    if (typeof t.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.id)) return 'Identificativo non valido: solo minuscole, numeri e trattini.';
    if (typeof t.titolo !== 'string' || !t.titolo.trim()) return `Il testo "${t.id}" non ha un titolo.`;
    if (visti.has(t.id)) return `Identificativo duplicato: "${t.id}".`;
    visti.add(t.id);
  }
  return null;
}

async function gestisciGet(req, res) {
  // Se arriva un token deve essere valido: mai una lista parziale a chi sta per salvare.
  const conToken = !!(req.headers && req.headers.authorization);
  const sessione = conToken ? sessioneDaRichiesta(req) : null;
  if (conToken && !sessione) return res.status(401).json({ error: 'Sessione scaduta: effettua di nuovo il login.' });
  try {
    const registro = await leggiFileJson(FILE, { testi: [] });
    const tutti = estraiTesti(registro);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ testi: sessione ? tutti : tutti.filter(t => t && t.stato === 'Pubblicato') });
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
  const errore = validaTesti(corpo.testi);
  if (errore) return res.status(400).json({ error: errore });
  const testi = corpo.testi.map(normalizzaTesto);
  if (JSON.stringify(testi).length > MAX_BYTE) {
    return res.status(413).json({ error: 'L\'archivio supera la dimensione massima: dividi i testi più lunghi o sposta le immagini su un host esterno.' });
  }
  try {
    // conserva eventuali altri campi già presenti nel file, aggiorna solo "testi"
    let attuale = {};
    try { const r = await leggiFileJson(FILE, { testi: [] }); if (r && !Array.isArray(r)) attuale = r; } catch (e) { /* file nuovo */ }
    await scriviFileJson(FILE, { ...attuale, testi }, `Aggiornamento testi UniText (${sessione.username})`);
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
