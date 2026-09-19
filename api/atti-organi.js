// api/atti-organi.js
// Lettura pubblica degli atti (norme) per CA.html.
//
// Variabili d'ambiente richieste su Vercel:
//   BIN_ID    -> id del bin JSONBin che contiene gli atti
//   API_KEY   -> Master Key di JSONBin (la stessa usata dagli altri endpoint)

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: "Metodo non consentito" });
    }

    const { BIN_ID, API_KEY } = process.env;
    if (!BIN_ID || !API_KEY) {
        return res.status(500).json({ error: "Configurazione del server mancante (BIN_ID / API_KEY)." });
    }

    try {
        const risposta = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
        });
        if (!risposta.ok) {
            return res.status(502).json({ error: "Errore di lettura da JSONBin: HTTP " + risposta.status });
        }
        const json = await risposta.json();
        const record = (json && json.record !== undefined) ? json.record : json;

        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ atti: estraiAtti(record) });
    } catch (e) {
        return res.status(502).json({ error: "Impossibile leggere gli atti." });
    }
}

// Il bin può contenere direttamente l'elenco degli atti oppure un oggetto con la chiave "atti".
function estraiAtti(record) {
    if (Array.isArray(record)) return record;
    if (record && typeof record === 'object') {
        if (Array.isArray(record.atti)) return record.atti;
        const primoElenco = Object.values(record).find(Array.isArray);
        if (primoElenco) return primoElenco;
    }
    return [];
}
