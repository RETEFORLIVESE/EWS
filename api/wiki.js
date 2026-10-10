// api/wiki.js — endpoint unico della wiki (come /api/atti):
//   GET                              -> { pagine }  (pubblico, legge wiki.json dalla repo DATA)
//   POST { azione:'login', ... }     -> { success, token }
//   POST { azione:'salva', pagina }  -> crea/aggiorna UNA pagina (richiede Bearer token)
//   POST { azione:'elimina', id }    -> elimina UNA pagina       (richiede Bearer token)
// Usa gli stessi helper già presenti: ./_github.js e ./_sessione.js.
//
// Variabili d'ambiente: AUTH_SECRET, GITHUB_TOKEN, GITHUB_DATA_REPO, GITHUB_DATA_BRANCH (come per gli atti)
// Login: stessi utenti di api/atti.js (vedi VALID_USERS qui sotto).

import { timingSafeEqual } from 'crypto';
import { leggiFileJson, scriviFileJson } from './_github.js';
import { creaToken, sessioneDaRichiesta } from './_sessione.js';

const FILE = 'wiki.json';

// Stessi account della redazione degli atti (copia di VALID_USERS in api/atti.js).
// Se cambi gli utenti in atti.js, aggiornali anche qui.
const VALID_USERS = { "TandeePetrenka": "TandeePetrenka", "PyrreHankonen": "PyrreHankonen" };

function verificaCredenziali(username, password) {
    if (!Object.prototype.hasOwnProperty.call(VALID_USERS, username)) return false;
    const a = Buffer.from(String(VALID_USERS[username])), b = Buffer.from(String(password));
    return a.length === b.length && timingSafeEqual(a, b);
}

const txt = (v, max) => (v == null ? '' : String(v)).trim().slice(0, max);
const slug = t => txt(t, 200).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const fine = (stato, corpo) => res.status(stato).json(corpo);
    try {
        if (req.method === 'GET') {
            const d = await leggiFileJson(FILE, { pagine: [] });
            res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120');
            return fine(200, { pagine: Array.isArray(d.pagine) ? d.pagine : [] });
        }
        if (req.method !== 'POST') return fine(405, { message: 'Metodo non consentito' });

        const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

        if (corpo.azione === 'login') {
            const u = txt(corpo.username, 60);
            if (!u || !verificaCredenziali(u, corpo.password || '')) {
                await new Promise(r => setTimeout(r, 800)); // rallenta i tentativi a raffica
                return fine(401, { success: false, message: 'Credenziali errate' });
            }
            return fine(200, { success: true, token: creaToken(u) });
        }

        const sessione = sessioneDaRichiesta(req);
        if (!sessione) return fine(401, { message: 'Sessione scaduta: effettua di nuovo il login.' });

        // rilegge il file ad ogni scrittura: si modifica solo la pagina interessata, senza sovrascrivere il lavoro altrui
        const dati = await leggiFileJson(FILE, { pagine: [] });
        let pagine = Array.isArray(dati.pagine) ? dati.pagine : [];

        if (corpo.azione === 'salva') {
            const p = corpo.pagina || {};
            const titolo = txt(p.titolo, 150);
            if (!titolo) return fine(400, { message: 'Il titolo è obbligatorio.' });
            const id = slug(p.id || titolo);
            if (!id) return fine(400, { message: 'Identificativo non valido.' });
            const prec = txt(corpo.idPrecedente, 80);
            if (pagine.some(x => x.id === id && x.id !== prec)) return fine(409, { message: `Esiste già una pagina con id "${id}".` });

            const vecchia = pagine.find(x => x.id === (prec || id));
            const ora = new Date().toISOString();
            const nuova = {
                id, titolo,
                categoria: txt(p.categoria, 60),
                tag: (Array.isArray(p.tag) ? p.tag : []).map(t => txt(t, 40)).filter(Boolean).slice(0, 20),
                sommario: txt(p.sommario, 400),
                immagine: /^https?:\/\//i.test(txt(p.immagine, 500)) ? txt(p.immagine, 500) : '',
                contenuto: txt(p.contenuto, 100000),
                autore: vecchia ? vecchia.autore : sessione.username,
                creata: vecchia ? vecchia.creata : ora,
                modificata: ora,
                modificataDa: sessione.username
            };
            pagine = pagine.filter(x => x.id !== (prec || id) && x.id !== id);
            pagine.push(nuova);
            await scriviFileJson(FILE, { ...dati, pagine }, `Wiki: ${vecchia ? 'modifica' : 'nuova pagina'} "${titolo}" (${sessione.username})`);
            return fine(200, { success: true, pagina: nuova });
        }

        if (corpo.azione === 'elimina') {
            const id = txt(corpo.id, 80), v = pagine.find(x => x.id === id);
            if (!v) return fine(404, { message: 'Pagina non trovata.' });
            await scriviFileJson(FILE, { ...dati, pagine: pagine.filter(x => x.id !== id) }, `Wiki: eliminata "${v.titolo}" (${sessione.username})`);
            return fine(200, { success: true });
        }
        return fine(400, { message: 'Azione non valida' });
    } catch (e) {
        console.error('api/wiki:', e);
        return fine(500, { message: 'Errore del server: ' + e.message });
    }
}