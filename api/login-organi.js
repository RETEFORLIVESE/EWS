const VALID_USERS = {
    "admin": "passwordRedazione2026" // Modifica questa password prima del commit
};

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Metodo non consentito" });
    }

    const { username, password } = req.body;
    const { BIN_ID_ORGANI, API_KEY } = process.env;

    if (!BIN_ID_ORGANI || !API_KEY) {
        return res.status(500).json({ error: "Configurazione del server mancante." }); //[cite: 1]
    }

    if (VALID_USERS[username] && VALID_USERS[username] === password) {
        res.status(200).json({
            success: true,
            binId: BIN_ID_ORGANI,
            apiKey: API_KEY //[cite: 1]
        });
    } else {
        res.status(401).json({ error: "Credenziali non valide" });
    }
}
