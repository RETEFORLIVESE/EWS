// api/ire.js — registro imprese dell'IRE (Istituto per la Resilienza Economica)
// Salva tutto in IRE.json nella repo RETEFORLIVESE/DATA (stessi helper di atti.js).
//
//   GET                                   -> registro pubblico (solo campi pubblici, imprese non respinte).
//                                            Con Authorization: Bearer <token redazione> restituisce tutto.
//   POST { azione: "iscrivi", ... }       -> richiesta di iscrizione (pubblica). Risponde con un
//                                            "codice di riferimento" mostrato UNA volta sola.
//   POST { azione: "dichiarazione", id, codice, dichiarazione: {...} }
//                                         -> dichiarazione patrimoniale (pubblica, ma protetta dal codice).
//   POST { azione: "richiesta", tipo: fondo|assistenza|trasformazione, id, codice, richiesta: {...} }
//                                         -> Legge 12/2026 artt. 13, 14, 18 (pubblica, protetta dal codice).
//   POST { azione: "richiesta-stato", id, richiestaId, stato, note } -> gestione IRE.
//   POST { azione: "accedi-estji", id_token } -> accesso della redazione con Estji ID (QR): verifica l'id_token
//                                            e rilascia un token di sessione con ambito "ire".
//   POST { azione: "aggiorna", id, campi } / { azione: "elimina", id } /
//        { azione: "verifica", id, anno, stato } / { azione: "nuovo-codice", id }
//                                         -> gestione IRE (richiede Authorization: Bearer <token>).
//
// Forma di IRE.json:
//   { "imprese": [ {
//       id, nome, settore, classe, stato, statoCodice, lavoratori, comitato, referente, note,
//       esito, dataRichiesta, dataIscrizione, codiceHash,
//       dichiarazioni: [ { anno, data, liquidita, beni, crediti, debiti, attivo, passivo,
//                          patrimonioNetto, descrizioneBeni, note, stato } ]
//   } ] }
//
// ⚠️ È una funzione serverless in più: il piano gratuito di Vercel ne consente 12.

import crypto from 'node:crypto';
import { leggiFileJson, scriviFileJson } from './_github.js';
import { sessioneDaRichiesta, creaToken } from './_sessione.js';
import { verificaIdToken, haScope } from './_estji-verifica.js';
import { redis, limite, ipDi } from './_idstore.js';

const FILE = 'IRE.json';
const AMBITO_REDAZIONE = 'normaktiv';   // i token classici (login con password) e quelli QR di NormAktiv valgono anche qui
const AMBITO_IRE = 'ire';               // ambito dei token rilasciati dall'accesso con Estji ID di questo portale
const CLIENT_ID = process.env.IRE_CLIENT_ID || 'ire';                 // ID del portale in PORTALI (_idstore.js)
const SCOPE_REDAZIONE = process.env.IRE_SCOPE || 'ire.edit';     // permesso Estji ID richiesto alla redazione
const MAX_IN_ISTRUTTORIA = 300;         // freno anti-spam sulle richieste pubbliche in attesa
const CLASSI = ['strategica', 'lavoratori'];
const ESITI = ['In istruttoria', 'Iscritta', 'Respinta', 'In liquidazione', 'Sciolta'];
// Legge 12/2026 (cooperative e collettivi)
const FORME = ['Cooperativa', 'Collettivo di lavoratori', 'Consorzio cooperativo', 'Altra impresa'];
const MIN_SOCI = { 'Cooperativa': 5, 'Collettivo di lavoratori': 3 };   // art. 5 c.1 e art. 16 c.2
const TIPOLOGIE = ['Produzione e lavoro', 'Agricola', 'Consumo', 'Credito', 'Sociale', 'Abitazione'];   // art. 7
const ATTI_COSTITUTIVI = ['Atto pubblico', 'Scrittura privata autenticata'];   // art. 5 c.3
const MOTIVI_SCIOGLIMENTO = ['Deliberazione dell’Assemblea dei soci', 'Impossibilità di raggiungere lo scopo sociale', 'Gravi violazioni della legge o dello statuto', 'Perdita del numero minimo di soci'];   // art. 21 c.1
const AGEVOLAZIONI = ['Finanziamento a tasso agevolato', 'Garanzia per operazioni di credito', 'Contributo per progetto di innovazione'];   // art. 13 c.3
const ASSISTENZE = ['Consulenza legale', 'Consulenza amministrativa', 'Consulenza finanziaria', 'Consulenza tecnica', 'Formazione professionale', 'Pianificazione e marketing'];   // art. 14 c.1
const TIPI_RICHIESTA = ['fondo', 'assistenza', 'trasformazione'];
const STATI_RICHIESTA = ['Ricevuta', 'In istruttoria', 'Accolta', 'Respinta'];
const formaDi = i => i.forma || 'Altra impresa';
function scelta(v, lista, etichetta) {
    if (!lista.includes(v)) throw new ErroreHttp(400, `${etichetta} non valido.`);
    return v;
}

class ErroreHttp extends Error {
    constructor(status, message) { super(message); this.status = status; }
}

// ---------------------------------------------------------------- utilità

const dormi = ms => new Promise(r => setTimeout(r, ms));

function testo(v, max, obbligatorio, etichetta) {
    const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    if (obbligatorio && !s) throw new ErroreHttp(400, `Campo obbligatorio mancante: ${etichetta}.`);
    if (s.length > max) throw new ErroreHttp(400, `${etichetta} troppo lungo (massimo ${max} caratteri).`);
    return s;
}

function testoLungo(v, max, etichetta) {   // mantiene gli a capo
    const s = String(v == null ? '' : v).replace(/\r/g, '').trim();
    if (s.length > max) throw new ErroreHttp(400, `${etichetta} troppo lungo (massimo ${max} caratteri).`);
    return s;
}

function numero(v, etichetta) {
    const n = Number(String(v == null || v === '' ? 0 : v).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > 1e15) {
        throw new ErroreHttp(400, `${etichetta}: inserisci un numero valido, non negativo.`);
    }
    return Math.round(n * 100) / 100;
}

function hashCodice(codice) {
    return crypto.createHash('sha256').update(String(codice).trim().toUpperCase()).digest('hex');
}

function codiceUguale(codice, hashSalvato) {
    if (!codice || !hashSalvato) return false;
    const a = Buffer.from(hashCodice(codice), 'hex');
    const b = Buffer.from(String(hashSalvato), 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function nuovoCodice() {
    const h = crypto.randomBytes(6).toString('hex').toUpperCase();   // 12 caratteri
    return `IRE-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

// Sessione della redazione: token "ire" (Estji ID) oppure token di NormAktiv (password o QR).
function sessioneRedazione(req) {
    return sessioneDaRichiesta(req, AMBITO_IRE) || sessioneDaRichiesta(req, AMBITO_REDAZIONE);
}

function estraiImprese(reg) {
    if (Array.isArray(reg)) return reg;
    if (reg && Array.isArray(reg.imprese)) return reg.imprese;
    return [];
}

// Lettura-modifica-scrittura con qualche tentativo, per gestire due salvataggi ravvicinati
// (GitHub rifiuta la scrittura se il file è cambiato nel frattempo).
async function modifica(fn, messaggio) {
    let ultimoErrore;
    for (let tentativo = 0; tentativo < 3; tentativo++) {
        const imprese = estraiImprese(await leggiFileJson(FILE, { imprese: [] }));
        const risultato = fn(imprese);          // può lanciare ErroreHttp: in quel caso non si riprova
        try {
            await scriviFileJson(FILE, { imprese }, messaggio);
            return risultato;
        } catch (e) {
            ultimoErrore = e;
            await dormi(350 * (tentativo + 1));
        }
    }
    throw ultimoErrore;
}

// Cerca il codice dello Stato Sociale in organi.json (luoghi → categoria → codice → nome).
async function risolviStato(codice) {
    const organi = await leggiFileJson('organi.json', {});
    const luoghi = (organi && organi.luoghi) || {};
    for (const categoria of Object.values(luoghi)) {
        if (!categoria || typeof categoria !== 'object') continue;
        if (Object.prototype.hasOwnProperty.call(categoria, codice)) {
            const voce = categoria[codice];
            return typeof voce === 'string' ? voce : (voce && voce.nome) || codice;
        }
    }
    return null;
}

function vistaPubblica(i) {
    const ultima = (i.dichiarazioni || []).reduce((m, d) => Math.max(m, d.anno || 0), 0);
    return {
        id: i.id, nome: i.nome, classe: i.classe, settore: i.settore, stato: i.stato,
        lavoratori: i.lavoratori, comitato: i.comitato, esito: i.esito,
        forma: formaDi(i), tipologia: i.tipologia || '',
        dichiarazioneAnno: ultima || null
    };
}

function vistaRedazione(i) {
    const { codiceHash, ...resto } = i;
    return resto;
}

// ---------------------------------------------------------------- azioni

async function gestisciGet(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const imprese = estraiImprese(await leggiFileJson(FILE, { imprese: [] }));
        const staff = sessioneRedazione(req);
        if (staff) return res.status(200).json({ imprese: imprese.map(vistaRedazione) });
        return res.status(200).json({
            imprese: imprese.filter(i => i.esito !== 'Respinta').map(vistaPubblica)
        });
    } catch (e) {
        return res.status(500).json({ message: 'Errore lettura: ' + e.message });
    }
}

async function gestisciIscrivi(corpo, res) {
    if (corpo.sito) return res.status(200).json({ success: true });   // campo-trappola per i bot

    const nome = testo(corpo.nome, 120, true, 'Nome dell’impresa');
    const settore = testo(corpo.settore, 80, true, 'Settore');
    const lavoratori = Math.floor(Number(corpo.lavoratori));
    if (!Number.isFinite(lavoratori) || lavoratori < 1 || lavoratori > 1e7) {
        throw new ErroreHttp(400, 'Numero di lavoratori non valido.');
    }
    const classe = CLASSI.includes(corpo.classe) ? corpo.classe : null;
    if (!classe) throw new ErroreHttp(400, 'Classe proprietaria non valida.');
    const comitato = /^(già costituito|costituito)$/i.test(String(corpo.comitato).trim())
        ? 'Costituito' : 'Da costituire';
    const referente = testo(corpo.referente, 80, true, 'Referente');
    const note = testoLungo(corpo.note, 1000, 'Note');

    const forma = scelta(corpo.forma || 'Altra impresa', FORME, 'Forma');
    if (MIN_SOCI[forma] && lavoratori < MIN_SOCI[forma]) {
        throw new ErroreHttp(400, `Numero minimo di lavoratori per ${forma === 'Cooperativa' ? 'una cooperativa' : 'un collettivo'}: ${MIN_SOCI[forma]}.`);
    }
    let tipologia = '', oggetto = '', atto = '', documento = '', attestazione = false;
    if (forma === 'Cooperativa') {
        tipologia = scelta(corpo.tipologia, TIPOLOGIE, 'Tipologia di cooperativa');
        oggetto = testoLungo(corpo.oggetto, 500, 'Oggetto sociale');
        if (!oggetto) throw new ErroreHttp(400, 'Campo obbligatorio mancante: Oggetto sociale.');
        atto = scelta(corpo.atto, ATTI_COSTITUTIVI, 'Atto costitutivo');
    }
    if (MIN_SOCI[forma]) {
        if (!corpo.attestazione) throw new ErroreHttp(400, 'Devi confermare la dichiarazione sui requisiti (artt. 5 e 16 della Legge 12/2026).');
        attestazione = true;
        documento = testo(corpo.documento, 300, false, 'Link al documento');
        if (documento && !/^https?:\/\//i.test(documento)) throw new ErroreHttp(400, 'Il link al documento deve iniziare con http:// o https://.');
    }

    const codiceStato = testo(corpo.stato, 80, true, 'Stato Sociale');
    const nomeStato = await risolviStato(codiceStato);
    if (!nomeStato) throw new ErroreHttp(400, 'Stato Sociale non riconosciuto.');

    const codice = nuovoCodice();
    const id = 'imp-' + crypto.randomBytes(4).toString('hex');

    await modifica(imprese => {
        if (imprese.filter(i => i.esito === 'In istruttoria').length >= MAX_IN_ISTRUTTORIA) {
            throw new ErroreHttp(429, 'Troppe richieste in attesa: riprova più tardi.');
        }
        const gia = imprese.some(i => i.esito !== 'Respinta' && String(i.nome).toLowerCase() === nome.toLowerCase());
        if (gia) throw new ErroreHttp(409, 'Esiste già un’impresa con questo nome nel registro o in istruttoria.');
        imprese.push({
            id, nome, settore, classe, stato: nomeStato, statoCodice: codiceStato, lavoratori, comitato,
            forma, tipologia, oggetto, atto, documento, attestazione, richieste: [],
            referente, note, esito: 'In istruttoria',
            dataRichiesta: new Date().toISOString(), dataIscrizione: null,
            codiceHash: hashCodice(codice), dichiarazioni: []
        });
    }, `Richiesta di iscrizione IRE: ${nome}`);

    return res.status(200).json({ success: true, id, codice, stato: nomeStato });
}

async function gestisciDichiarazione(corpo, res) {
    const d = corpo.dichiarazione || {};
    const anno = Math.floor(Number(d.anno));
    if (!Number.isFinite(anno) || anno < 1900 || anno > 2200) throw new ErroreHttp(400, 'Anno di riferimento non valido.');

    const liquidita = numero(d.liquidita, 'Liquidità');
    const beni = numero(d.beni, 'Valore dei beni');
    const crediti = numero(d.crediti, 'Crediti');
    const debiti = numero(d.debiti, 'Debiti');
    const attivo = Math.round((liquidita + beni + crediti) * 100) / 100;
    const patrimonioNetto = Math.round((attivo - debiti) * 100) / 100;
    const descrizioneBeni = testoLungo(d.descrizioneBeni, 2000, 'Descrizione dei beni');
    const note = testoLungo(d.note, 1000, 'Note');

    let nome = '';
    await modifica(imprese => {
        const imp = imprese.find(i => i.id === corpo.id);
        // Stesso messaggio per "impresa inesistente" e "codice errato": non rivela quali id esistono.
        if (!imp || !codiceUguale(corpo.codice, imp.codiceHash)) {
            throw new ErroreHttp(403, 'Impresa o codice di riferimento non validi.');
        }
        if (imp.esito === 'Respinta') throw new ErroreHttp(403, 'La richiesta di iscrizione di questa impresa è stata respinta.');
        if (imp.esito === 'Sciolta') throw new ErroreHttp(403, 'Questa impresa è stata sciolta.');
        nome = imp.nome;
        if (!Array.isArray(imp.dichiarazioni)) imp.dichiarazioni = [];
        const nuova = {
            anno, data: new Date().toISOString(), liquidita, beni, crediti, debiti,
            attivo, passivo: debiti, patrimonioNetto, descrizioneBeni, note, stato: 'Da verificare'
        };
        const k = imp.dichiarazioni.findIndex(x => x.anno === anno);
        if (k >= 0) imp.dichiarazioni[k] = nuova; else imp.dichiarazioni.push(nuova);   // una per anno: la nuova sostituisce
        imp.dichiarazioni.sort((a, b) => b.anno - a.anno);
    }, `Dichiarazione patrimoniale ${anno}: ${corpo.id}`);

    return res.status(200).json({ success: true, nome, anno, attivo, passivo: debiti, patrimonioNetto });
}

// Richieste di imprese già nel registro (protette dal codice): Fondo di rotazione (art. 13),
// assistenza tecnica (art. 14), trasformazione di un collettivo in cooperativa (art. 18).
async function gestisciRichiesta(corpo, res) {
    const tipo = scelta(corpo.tipo, TIPI_RICHIESTA, 'Tipo di richiesta');
    const r = corpo.richiesta || {};
    const dettagli = {};
    if (tipo === 'fondo') {
        dettagli.agevolazione = scelta(r.agevolazione, AGEVOLAZIONI, 'Tipo di agevolazione');
        dettagli.importo = numero(r.importo, 'Importo');
        dettagli.finalita = testoLungo(r.finalita, 1000, 'Finalità');
        if (!dettagli.finalita) throw new ErroreHttp(400, 'Campo obbligatorio mancante: Finalità.');
    } else if (tipo === 'assistenza') {
        dettagli.servizio = scelta(r.servizio, ASSISTENZE, 'Servizio');
        dettagli.descrizione = testoLungo(r.descrizione, 1000, 'Descrizione');
        if (!dettagli.descrizione) throw new ErroreHttp(400, 'Campo obbligatorio mancante: Descrizione.');
    } else {
        dettagli.tipologia = scelta(r.tipologia, TIPOLOGIE, 'Tipologia di cooperativa');
        dettagli.lavoratori = Math.floor(Number(r.lavoratori));
        if (!(dettagli.lavoratori >= MIN_SOCI['Cooperativa'])) throw new ErroreHttp(400, `Una cooperativa richiede almeno ${MIN_SOCI['Cooperativa']} lavoratori (art. 5).`);
        if (!r.deliberata) throw new ErroreHttp(400, 'Devi confermare che la trasformazione è stata deliberata a maggioranza dei lavoratori (art. 18, c. 2).');
    }
    let nome = '', idRichiesta = 'ric-' + crypto.randomBytes(4).toString('hex');
    await modifica(imprese => {
        const imp = imprese.find(i => i.id === corpo.id);
        if (!imp || !codiceUguale(corpo.codice, imp.codiceHash)) throw new ErroreHttp(403, 'Impresa o codice di riferimento non validi.');
        if (imp.esito === 'Respinta' || imp.esito === 'Sciolta') throw new ErroreHttp(403, 'Impresa non abilitata a presentare richieste.');
        if (tipo === 'fondo' && !(formaDi(imp) === 'Cooperativa' && imp.esito === 'Iscritta')) {
            throw new ErroreHttp(403, 'Il Fondo di rotazione è riservato alle cooperative iscritte all’Anagrafe (artt. 8 e 13).');
        }
        if (tipo === 'trasformazione' && formaDi(imp) !== 'Collettivo di lavoratori') {
            throw new ErroreHttp(403, 'Solo un collettivo di lavoratori può trasformarsi in cooperativa (art. 18).');
        }
        if (!Array.isArray(imp.richieste)) imp.richieste = [];
        if (imp.richieste.filter(x => x.stato === 'Ricevuta' || x.stato === 'In istruttoria').length >= 10) {
            throw new ErroreHttp(429, 'Troppe richieste in attesa per questa impresa.');
        }
        nome = imp.nome;
        imp.richieste.unshift({ id: idRichiesta, tipo, data: new Date().toISOString(), dettagli, stato: 'Ricevuta', note: '' });
    }, `Richiesta ${tipo} IRE: ${corpo.id}`);
    return res.status(200).json({ success: true, nome, idRichiesta });
}

async function gestisciAccessoEstji(req, corpo, res) {
    if (!(await limite('ireacc:' + ipDi(req), 20, 600))) {
        throw new ErroreHttp(429, 'Troppi tentativi: riprova tra qualche minuto.');
    }
    let claims;
    try { claims = await verificaIdToken(corpo.id_token, CLIENT_ID); }
    catch (e) { throw new ErroreHttp(502, 'Estji ID non raggiungibile: riprova.'); }
    if (!claims || !claims.jti) throw new ErroreHttp(401, 'Accesso con Estji ID non valido o scaduto: genera un nuovo QR.');
    if (!haScope(claims, SCOPE_REDAZIONE)) throw new ErroreHttp(403, 'Questa identità non ha il permesso di accedere alla redazione IRE.');
    // il token Estji ID vale una sola volta
    if ((await redis('SET', 'idtok:' + claims.jti, '1', 'NX', 'EX', 700)) !== 'OK') {
        throw new ErroreHttp(401, 'Questo accesso è già stato utilizzato.');
    }
    const username = claims.nick || claims.sub;
    return res.status(200).json({ success: true, token: creaToken(username, AMBITO_IRE), username });
}

async function gestisciRedazione(req, corpo, res) {
    const sessione = sessioneRedazione(req);
    if (!sessione) return res.status(401).json({ message: 'Sessione scaduta o non autorizzata: effettua il login della redazione.' });

    let codiceNuovo = null;
    await modifica(imprese => {
        const k = imprese.findIndex(i => i.id === corpo.id);
        if (k < 0) throw new ErroreHttp(404, 'Impresa non trovata.');
        const imp = imprese[k];

        if (corpo.azione === 'elimina') {
            imprese.splice(k, 1);
        } else if (corpo.azione === 'nuovo-codice') {
            codiceNuovo = nuovoCodice();           // il vecchio codice smette di funzionare
            imp.codiceHash = hashCodice(codiceNuovo);
        } else if (corpo.azione === 'richiesta-stato') {
            const ric = (imp.richieste || []).find(x => x.id === corpo.richiestaId);
            if (!ric) throw new ErroreHttp(404, 'Richiesta non trovata.');
            ric.stato = scelta(corpo.stato, STATI_RICHIESTA, 'Stato');
            if (corpo.note !== undefined) ric.note = testoLungo(corpo.note, 500, 'Note');
            if (ric.tipo === 'trasformazione' && ric.stato === 'Accolta') {   // art. 18 c.3: personalità giuridica e agevolazioni
                imp.forma = 'Cooperativa';
                imp.tipologia = ric.dettagli.tipologia;
                imp.lavoratori = ric.dettagli.lavoratori;
                imp.dataTrasformazione = new Date().toISOString();
            }
        } else if (corpo.azione === 'verifica') {
            const dich = (imp.dichiarazioni || []).find(x => x.anno === Number(corpo.anno));
            if (!dich) throw new ErroreHttp(404, 'Dichiarazione non trovata.');
            if (!['Da verificare', 'Verificata', 'Respinta'].includes(corpo.stato)) throw new ErroreHttp(400, 'Stato non valido.');
            dich.stato = corpo.stato;
        } else {   // aggiorna
            const c = corpo.campi || {};
            if (c.forma !== undefined) imp.forma = scelta(c.forma, FORME, 'Forma');
            if (c.tipologia !== undefined) imp.tipologia = c.tipologia ? scelta(c.tipologia, TIPOLOGIE, 'Tipologia') : '';
            if (c.registrazioneCEFS !== undefined) imp.registrazioneCEFS = testo(c.registrazioneCEFS, 120, false, 'Riferimento CEFS');
            if (c.scioglimento !== undefined) {   // art. 21
                const sc = c.scioglimento || {};
                imp.scioglimento = {
                    motivo: sc.motivo ? scelta(sc.motivo, MOTIVI_SCIOGLIMENTO, 'Motivo') : '',
                    liquidatore: testo(sc.liquidatore, 120, false, 'Liquidatore'),
                    destinazionePatrimonio: testo(sc.destinazionePatrimonio, 300, false, 'Destinazione del patrimonio')
                };
            }
            if (c.esito !== undefined) {
                if (!ESITI.includes(c.esito)) throw new ErroreHttp(400, 'Esito non valido.');
                if ((c.esito === 'In liquidazione' || c.esito === 'Sciolta') && formaDi(imp) !== 'Cooperativa') {
                    throw new ErroreHttp(400, 'Lo scioglimento riguarda solo le cooperative (art. 21).');
                }
                if (c.esito === 'Iscritta' && imp.esito !== 'Iscritta') imp.dataIscrizione = new Date().toISOString();
                imp.esito = c.esito;
            }
            if (c.comitato !== undefined) imp.comitato = c.comitato === 'Costituito' ? 'Costituito' : 'Da costituire';
            if (c.classe !== undefined) {
                if (!CLASSI.includes(c.classe)) throw new ErroreHttp(400, 'Classe non valida.');
                imp.classe = c.classe;
            }
            if (c.nome !== undefined) imp.nome = testo(c.nome, 120, true, 'Nome');
            if (c.settore !== undefined) imp.settore = testo(c.settore, 80, true, 'Settore');
            if (c.lavoratori !== undefined) imp.lavoratori = Math.max(1, Math.floor(Number(c.lavoratori)) || imp.lavoratori);
            if (c.note !== undefined) imp.note = testoLungo(c.note, 1000, 'Note');
        }
    }, `IRE (${sessione.username}): ${corpo.azione} ${corpo.id}`);

    return res.status(200).json(codiceNuovo ? { success: true, codice: codiceNuovo } : { success: true });
}

// ---------------------------------------------------------------- handler

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') return await gestisciGet(req, res);

        if (req.method === 'POST') {
            let corpo = req.body;
            if (typeof corpo === 'string') {
                try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
            }
            corpo = corpo || {};
            res.setHeader('Cache-Control', 'no-store');
            switch (corpo.azione) {
                case 'iscrivi': return await gestisciIscrivi(corpo, res);
                case 'dichiarazione': return await gestisciDichiarazione(corpo, res);
                case 'accedi-estji': return await gestisciAccessoEstji(req, corpo, res);
                case 'richiesta': return await gestisciRichiesta(corpo, res);
                case 'richiesta-stato':
                case 'aggiorna':
                case 'nuovo-codice':
                case 'elimina':
                case 'verifica': return await gestisciRedazione(req, corpo, res);
                default:
                    return res.status(400).json({ message: 'Azione non riconosciuta.' });
            }
        }

        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ message: 'Metodo non consentito' });
    } catch (e) {
        if (e instanceof ErroreHttp) return res.status(e.status).json({ success: false, message: e.message });
        return res.status(500).json({ success: false, message: 'Errore del server: ' + e.message });
    }
}