// Funzione serverless Vercel — lettura pubblica delle elezioni.
// Le chiavi restano SOLO qui (variabili d'ambiente), mai nel browser.
//
// Variabili d'ambiente richieste su Vercel:
//   BIN_ID_ELEZIONI   -> id del bin JSONBin delle elezioni
//   API_KEY_ELEZIONI  -> Master Key di JSONBin (fallback: API_KEY)

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Metodo non consentito.' });
    }

    const BIN_ID = process.env.BIN_ID_ELEZIONI;
    const API_KEY = process.env.API_KEY_ELEZIONI || process.env.API_KEY;

    if (!BIN_ID || !API_KEY) {
        return res.status(500).json({ error: 'Configurazione del server mancante.' });
    }

    try {
        const risposta = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
            method: 'GET',
            headers: {
                'X-Master-Key': API_KEY,
                'X-Bin-Meta': 'false'
            }
        });

        if (!risposta.ok) {
            return res.status(500).json({ error: `Errore lettura: JSONBin ${risposta.status}` });
        }

        const risultato = await risposta.json();
        // Con X-Bin-Meta:false JSONBin restituisce direttamente il contenuto del bin,
        // ma gestiamo comunque il caso in cui arrivi incapsulato in "record".
        const contenuto = risultato && risultato.record ? risultato.record : risultato;
        const elezioni = (contenuto && contenuto.elezioni) || [];

        // Nessuna cache: i dati della redazione devono essere subito visibili.
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ elezioni });
    } catch (errore) {
        return res.status(500).json({ error: 'Errore lettura: impossibile contattare JSONBin.' });
    }
}
