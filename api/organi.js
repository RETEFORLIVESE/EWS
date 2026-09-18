export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Metodo non consentito" });
    }

    const { BIN_ID_ORGANI, API_KEY } = process.env;

    if (!BIN_ID_ORGANI || !API_KEY) {
        return res.status(500).json({ error: "Configurazione del server mancante." }); //
    }

    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID_ORGANI}/latest`, {
            headers: {
                'X-Master-Key': API_KEY //
            }
        });

        if (!response.ok) {
            return res.status(500).json({ error: `Errore lettura: JSONBin ${response.status}` }); //
        }

        const data = await response.json();
        res.status(200).json(data.record);
    } catch (error) {
        res.status(500).json({ error: "Errore interno del server." });
    }
}
