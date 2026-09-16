// api/atti.js
export default async function handler(req, res) {
  const BIN_ID = process.env.BIN_ID;
  const API_KEY = process.env.API_KEY;
  const KEY = 'atti'; // la chiave nel tuo JSONBin

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ message: "Configurazione del server mancante." });
  }

  // LETTURA (GET) — pubblica, senza autenticazione
  if (req.method === 'GET') {
    try {
      const r = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      if (!r.ok) throw new Error(`JSONBin ${r.status}`);
      const data = await r.json();
      // Rimandiamo indietro solo il record, non i metadati
      const record = data.record || data;
      return res.status(200).json({ atti: Array.isArray(record[KEY]) ? record[KEY] : [] });
    } catch (e) {
      return res.status(500).json({ message: "Errore lettura: " + e.message });
    }
  }

  // Le scritture restano client-side (dopo login), come in adminNL.html.
  // Se vuoi spostare anche le PUT qui, vedi la nota in fondo.
  return res.status(405).json({ message: "Metodo non consentito" });
}
