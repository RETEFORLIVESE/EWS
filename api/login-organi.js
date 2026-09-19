// api/login-organi.js
// Login della redazione Congressi e Assemblee (Organi).
// Stessa struttura e stesse credenziali di login-elezioni.js.
//
// Variabili d'ambiente richieste su Vercel:
//   BIN_ID_ORGANI    -> id del bin JSONBin degli organi
//   API_KEY          -> Master Key di JSONBin (condivisa con gli altri endpoint)
// Opzionali (per non tenere le credenziali nel codice):
//   REDAZIONE_USER      -> nome utente della redazione
//   REDAZIONE_PASSWORD  -> password della redazione

const VALID_USERS = [
    {
        username: process.env.REDAZIONE_USER || 'TandeePetrenka',
        password: process.env.REDAZIONE_PASSWORD || 'TandeePetrenka'
    }
];

export default function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: "Metodo non consentito" });
    }

    const { BIN_ID_ORGANI, API_KEY } = process.env;

    if (!BIN_ID_ORGANI || !API_KEY) {
        return res.status(500).json({ error: "Configurazione del server mancante." });
    }

    let corpo = req.body;
    if (typeof corpo === 'string') {
        try { corpo = JSON.parse(corpo); } catch (e) { corpo = {}; }
    }

    const username = (corpo && corpo.username ? String(corpo.username) : '').trim();
    const password = corpo && corpo.password ? String(corpo.password) : '';

    const utente = VALID_USERS.find(u => u.username === username && u.password === password);

    if (!utente) {
        return res.status(401).json({ error: "Credenziali non valide" });
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
        success: true,
        username: utente.username,
        binId: BIN_ID_ORGANI,
        apiKey: API_KEY
    });
}
