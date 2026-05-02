// api/newsletter.js

export default async function handler(req, res) {
  const BIN_ID = process.env.BIN_ID;
  const API_KEY = process.env.API_KEY;

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ message: "Configurazione del server mancante." });
  }

  // LETTURA ARTICOLI PER LA NEWSLETTER (GET)
  if (req.method === 'GET') {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ message: "Errore nel recupero dati" });
    }
  }

  // ISCRIZIONE ALLA NEWSLETTER (POST)
  if (req.method === 'POST') {
    try {
      const { email, name } = req.body;
      
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      const data = await response.json();
      let record = data.record;
      if (!record.subscribers) record.subscribers = [];
      
      // Controllo se l'utente esiste già
      const existing = record.subscribers.find(s => s.email.toLowerCase() === email.toLowerCase());
      if (existing) {
        return res.status(400).json({ success: false, message: `L'email ${email} è già iscritta!` });
      }

      // Aggiungi utente
      record.subscribers.push({ email, name, subscribedAt: new Date().toISOString() });

      // Salva
      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'X-Master-Key': API_KEY 
        },
        body: JSON.stringify(record)
      });
      
      if (!putRes.ok) throw new Error("Errore salvataggio");

      return res.status(200).json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: "Errore durante l'iscrizione. Riprova più tardi." });
    }
  }

  return res.status(405).json({ message: "Metodo non consentito" });
}