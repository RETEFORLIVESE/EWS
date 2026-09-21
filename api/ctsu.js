// api/ctsu.js — UNICA funzione serverless del sistema CTSU.
//
//   GET  /api/ctsu                          → { progetti: [...] }   (pubblico)
//   POST /api/ctsu { azione:"login", username, password }  → { success, token, username }
//   POST /api/ctsu { azione:"salva", progetti }  (Authorization: Bearer <token>)
//
// Il database è il file ctsu.json nel repository GitHub RETEFORLIVESE/DATA:
// la lettura usa l'API "contents" di GitHub, il salvataggio è un commit.
//
// Accesso alla redazione: la password da inserire è il valore di SESSION_SECRET.
// Il "nome utente" è solo un'etichetta libera (compare nel messaggio del commit).
//
// Variabili d'ambiente su Vercel:
//   SESSION_SECRET   password di accesso alla redazione + chiave che firma le sessioni
//   GITHUB_TOKEN     token fine-grained con "Contents: Read and write" sul solo repo DATA
//   (facoltative)    DATA_REPO=RETEFORLIVESE/DATA · DATA_BRANCH=main · CTSU_FILE=ctsu.json

const crypto = require('crypto');

const REPO = process.env.DATA_REPO || 'RETEFORLIVESE/DATA';
const BRANCH = process.env.DATA_BRANCH || 'main';
const FILE = process.env.CTSU_FILE || 'ctsu.json';
const URL_FILE = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
const DURATA_SESSIONE_MS = 8 * 60 * 60 * 1000;
const MAX_PROGETTI = 500;

/* ---------- GitHub ---------- */

const gh = accept => {
  const h = { Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'ctsu-portale' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
};

// Restituisce { sha, dati } dove dati è il contenuto JSON di ctsu.json.
async function leggiFile() {
  const r = await fetch(`${URL_FILE}?ref=${encodeURIComponent(BRANCH)}`, { headers: gh('application/vnd.github+json') });
  if (r.status === 404) return { sha: null, dati: { progetti: [] } };
  if (!r.ok) throw new Error(`GitHub ha risposto ${r.status} in lettura`);
  const meta = await r.json();

  let testo;
  if (meta.encoding === 'base64' && meta.content) {
    testo = Buffer.from(meta.content, 'base64').toString('utf8');
  } else {
    // file oltre 1 MB: l'API JSON non include il contenuto, si rilegge in formato raw
    const raw = await fetch(`${URL_FILE}?ref=${encodeURIComponent(BRANCH)}`, { headers: gh('application/vnd.github.raw+json') });
    if (!raw.ok) throw new Error(`GitHub ha risposto ${raw.status} in lettura`);
    testo = await raw.text();
  }

  let dati;
  try { dati = testo.trim() ? JSON.parse(testo) : { progetti: [] }; }
  catch (e) { throw new Error('ctsu.json non è un JSON valido'); }
  return { sha: meta.sha, dati };
}

const elencoProgetti = dati => Array.isArray(dati) ? dati : (Array.isArray(dati && dati.progetti) ? dati.progetti : []);

async function scriviFile(progetti, utente) {
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    const { sha, dati } = await leggiFile();
    // conserva la forma del file: array puro oppure oggetto { progetti, ...altro }
    const nuovo = Array.isArray(dati) ? progetti : { ...dati, progetti };
    const corpo = {
      message: `CTSU: aggiornamento progetti (${utente})`,
      content: Buffer.from(JSON.stringify(nuovo, null, 2) + '\n', 'utf8').toString('base64'),
      branch: BRANCH
    };
    if (sha) corpo.sha = sha;

    const r = await fetch(URL_FILE, {
      method: 'PUT',
      headers: { ...gh('application/vnd.github+json'), 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
    if (r.ok) return;
    if (r.status === 409 || r.status === 422) continue;   // qualcuno ha salvato nel frattempo: rilegge lo sha e riprova
    throw new Error(`GitHub ha risposto ${r.status} in scrittura`);
  }
  throw new Error('Salvataggio in conflitto con un altro aggiornamento: riprova.');
}

/* ---------- Sessione (token firmato con SESSION_SECRET, senza stato) ---------- */

const firma = payload => crypto.createHmac('sha256', process.env.SESSION_SECRET || '').update(payload).digest('base64url');

function creaToken(utente) {
  const payload = Buffer.from(JSON.stringify({ u: utente, exp: Date.now() + DURATA_SESSIONE_MS })).toString('base64url');
  return `${payload}.${firma(payload)}`;
}

function verificaToken(token) {
  const [payload, sig] = (token || '').split('.');
  if (!payload || !sig || !process.env.SESSION_SECRET) return null;
  const atteso = Buffer.from(firma(payload));
  const ricevuto = Buffer.from(sig);
  if (atteso.length !== ricevuto.length || !crypto.timingSafeEqual(atteso, ricevuto)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return d.exp > Date.now() ? d : null;
  } catch (e) { return null; }
}

const hash = s => crypto.createHash('sha256').update(String(s == null ? '' : s)).digest();
const uguali = (a, b) => !!b && crypto.timingSafeEqual(hash(a), hash(b));
const pausa = ms => new Promise(r => setTimeout(r, ms));

// Il nome è solo un'etichetta: tolgo caratteri di controllo e lo limito a 40 caratteri.
const pulisciNome = n => String(n == null ? '' : n).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);

/* ---------- Validazione ---------- */

function validaProgetti(progetti) {
  if (!Array.isArray(progetti)) return 'Formato non valido: "progetti" deve essere un elenco.';
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

/* ---------- Handler ---------- */

module.exports = async function handler(req, res) {
  const rispondi = (stato, corpo) => res.status(stato).json(corpo);

  try {
    if (req.method === 'GET') {
      const { dati } = await leggiFile();
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=50');
      return rispondi(200, { progetti: elencoProgetti(dati) });
    }

    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      return rispondi(405, { error: 'Metodo non consentito.' });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
    if (!body || typeof body !== 'object') return rispondi(400, { error: 'Richiesta non valida.' });

    if (body.azione === 'login') {
      if (!process.env.AUTH_SECRET) {
        return rispondi(500, { success: false, error: 'Server non configurato (AUTH_SECRET).' });
      }
      const nome = pulisciNome(body.username);
      if (!nome) return rispondi(400, { success: false, error: 'Inserisci il tuo nome.' });
      if (!uguali(body.password, process.env.AUTH_SECRET)) {
        await pausa(700);   // rallenta i tentativi ripetuti
        return rispondi(401, { success: false, error: 'Credenziali errate' });
      }
      return rispondi(200, { success: true, token: creaToken(nome), username: nome });
    }

    if (body.azione === 'salva') {
      const sessione = verificaToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
      if (!sessione) return rispondi(401, { error: 'Sessione scaduta: effettua di nuovo il login.' });
      if (!process.env.GITHUB_TOKEN) return rispondi(500, { error: 'Server non configurato (GITHUB_TOKEN).' });
      const errore = validaProgetti(body.progetti);
      if (errore) return rispondi(400, { error: errore });
      await scriviFile(body.progetti, sessione.u);
      return rispondi(200, { success: true });
    }

    return rispondi(400, { error: 'Azione non riconosciuta.' });
  } catch (e) {
    console.error('[api/ctsu]', e);
    return rispondi(502, { error: e.message || 'Errore del server.' });
  }
};
