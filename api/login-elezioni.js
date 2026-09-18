// Funzione serverless Vercel — login della redazione elezioni.
// Se le credenziali sono corrette restituisce BIN_ID_ELEZIONI e la Master Key:
// è l'UNICO momento in cui le chiavi arrivano al browser.
//
// Variabili d'ambiente richieste su Vercel:
//   BIN_ID_ELEZIONI     -> id del bin JSONBin delle elezioni
//   API_KEY_ELEZIONI    -> Master Key di JSONBin (fallback: API_KEY)
// Opzionali (consigliate, per non tenere le credenziali nel codice):
//   REDAZIONE_USER      -> nome utente della redazione
//   REDAZIONE_PASSWORD  -> password della redazione

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

    const BIN_ID = process.env.BIN_ID_ELEZIONI;
    const API_KEY = process.env.API_KEY_ELEZIONI || process.env.API_KEY;

    if (!BIN_ID || !API_KEY) {
        return res.status(500).json({ error: 'Configurazione del server mancante.' });
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
    return res.status(200).json({
        username: utente.username,
        token: {
            binId: BIN_ID,
            apiKey: API_KEY
        }
    });
}
