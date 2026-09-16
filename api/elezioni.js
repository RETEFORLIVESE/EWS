// api/elezioni.js
export default async function handler(req, res) {
  const BIN_ID = process.env.BIN_ID_ELEZIONI;
  const API_KEY = process.env.API_KEY_ELEZIONI || process.env.API_KEY;
  const KEY = 'elezioni'; // la chiave nel JSONBin dedicato alle elezioni

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ message: "Configurazione del server mancante (BIN_ID_ELEZIONI / API_KEY_ELEZIONI)." });
  }

  // LETTURA (GET) — pubblica, senza autenticazione
  if (req.method === 'GET') {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      if (!r.ok) throw new Error(`JSONBin ${r.status}`);
      const data = await r.json();
      const record = data.record || data;
      return res.status(200).json({ elezioni: Array.isArray(record[KEY]) ? record[KEY] : [] });
    } catch (e) {
      return res.status(500).json({ message: "Errore lettura: " + e.message });
    }
  }

  // Le scritture restano client-side (dopo login), come per gli atti.
  return res.status(405).json({ message: "Metodo non consentito" });
}
