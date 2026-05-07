// api/login.js

export default async function handler(req, res) {
  // Accetta solo richieste POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Metodo non consentito' });
  }

  const { username, password } = req.body;

  // Le tue password esatte
  const VALID_USERS = {
    "redazione": "RF2026Admin",
    "TandeePetrenka": "Yugoslavia",
    "giornalista": "reteforlivese",
    "RitaBoattini" : "diocane2007"
  };

  // Recuperiamo le chiavi da Vercel
  const BIN_ID = process.env.BIN_ID;
  const API_KEY = process.env.API_KEY;

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ message: "Configurazione del server mancante su Vercel." });
  }

  // Verifica delle credenziali
  if (VALID_USERS[username] && VALID_USERS[username] === password) {
    return res.status(200).json({
      success: true,
      message: "Login effettuato con successo",
      token: {
        binId: BIN_ID,
        apiKey: API_KEY
      }
    });
  } else {
    return res.status(401).json({
      success: false,
      message: "Nome utente o password non validi"
    });
  }
}