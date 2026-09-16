// api/login-elezioni.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' });
  }

  const { username, password } = req.body;

  // ⚠️ Cambia queste credenziali con quelle della tua redazione elettorale.
  // Possono essere uguali o diverse da quelle di api/login.js: sono indipendenti.
  const VALID_USERS = {
    "TandeePetrenka": "TandeePetrenka",
    "admin": "CambiamiAnche",
  };

  // Usa un BIN separato per le elezioni (il "secondo bin" su JSONBin.io).
  // Se le due chiavi API sono le stesse del tuo account, puoi lasciare
  // API_KEY_ELEZIONI non impostata: verrà usata API_KEY come fallback.
  const BIN_ID = process.env.BIN_ID_ELEZIONI;
  const API_KEY = process.env.API_KEY_ELEZIONI || process.env.API_KEY;

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ message: "Configurazione del server mancante." });
  }

  if (VALID_USERS[username] && VALID_USERS[username] === password) {
    return res.status(200).json({
      success: true,
      message: "Login effettuato",
      token: { binId: BIN_ID, apiKey: API_KEY }
    });
  }

  return res.status(401).json({ success: false, message: "Credenziali errate" });
}
