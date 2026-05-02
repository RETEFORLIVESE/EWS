// api/article.js

export default async function handler(req, res) {
  const BIN_ID = process.env.BIN_ID;
  const API_KEY = process.env.API_KEY;

  if (!BIN_ID || !API_KEY) {
    return res.status(500).json({ message: "Configurazione del server mancante." });
  }

  // LETTURA ARTICOLI (GET)
  if (req.method === 'GET') {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ message: "Errore nel recupero degli articoli" });
    }
  }

  // AGGIORNAMENTO VOTI LIKE/DISLIKE (PUT)
  if (req.method === 'PUT') {
    try {
      const { articleId, deltaLikes, deltaDislikes } = req.body;
      
      // 1. Scarica il record attuale
      const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
        headers: { 'X-Master-Key': API_KEY }
      });
      const data = await response.json();
      const record = data.record;
      const allArticles = record.articles || [];
      
      // 2. Trova l'articolo da votare
      const idx = allArticles.findIndex(a => a.id === articleId);
      if (idx === -1) return res.status(404).json({ message: "Articolo non trovato" });
      
      let art = allArticles[idx];
      if (typeof art.likes !== 'number') art.likes = 0;
      if (typeof art.dislikes !== 'number') art.dislikes = 0;
      
      // 3. Applica il delta voti
      art.likes += deltaLikes;
      art.dislikes += deltaDislikes;
      if (art.likes < 0) art.likes = 0;
      if (art.dislikes < 0) art.dislikes = 0;

      // 4. Salva sul DB
      const putRes = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json', 
          'X-Master-Key': API_KEY 
        },
        body: JSON.stringify({ ...record, articles: allArticles })
      });

      if (!putRes.ok) throw new Error("Errore nel salvataggio su JSONBin");
      
      return res.status(200).json({ success: true, likes: art.likes, dislikes: art.dislikes });
    } catch (error) {
      return res.status(500).json({ message: "Errore nel salvataggio del voto" });
    }
  }

  return res.status(405).json({ message: "Metodo non consentito" });
}