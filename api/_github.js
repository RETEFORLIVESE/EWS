// api/_github.js
// Helper condiviso: legge e scrive file JSON nella repo DATA (privata) tramite
// le GitHub Contents API, usando un token con accesso in scrittura SOLO su quella repo.
//
// Variabili d'ambiente richieste su Vercel:
//   GITHUB_TOKEN        -> fine-grained PAT, permesso "Contents: Read and write" sulla sola repo DATA
//   GITHUB_DATA_REPO    -> es. "RETEFORLIVESE/DATA"
//   GITHUB_DATA_BRANCH  -> es. "main" (facoltativa, default "main")

const GITHUB_API = 'https://api.github.com';

function configurazione() {
    const repo = process.env.GITHUB_DATA_REPO;
    const branch = process.env.GITHUB_DATA_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    if (!repo || !token) {
        throw new Error('Configurazione GitHub mancante (GITHUB_DATA_REPO / GITHUB_TOKEN).');
    }
    return { repo, branch, token };
}

function intestazioni(token) {
    return {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

// Legge un file JSON dalla repo DATA. Se il file non esiste ancora (404),
// restituisce valoreDiDefault invece di lanciare un errore (utile ai primi avvii).
export async function leggiFileJson(percorso, valoreDiDefault) {
    const { repo, branch, token } = configurazione();
    const url = `${GITHUB_API}/repos/${repo}/contents/${percorso}?ref=${encodeURIComponent(branch)}`;

    const risposta = await fetch(url, { headers: intestazioni(token) });

    if (risposta.status === 404) return valoreDiDefault;
    if (!risposta.ok) {
        throw new Error(`GitHub ha risposto ${risposta.status} leggendo ${percorso}`);
    }

    const corpo = await risposta.json();
    const testo = Buffer.from(corpo.content, 'base64').toString('utf-8');
    return JSON.parse(testo);
}

// Scrive (crea o sovrascrive) un file JSON nella repo DATA con un commit.
export async function scriviFileJson(percorso, valore, messaggioCommit) {
    const { repo, branch, token } = configurazione();
    const url = `${GITHUB_API}/repos/${repo}/contents/${percorso}`;

    // Serve lo sha corrente per poter sovrascrivere; assente se il file non esiste ancora.
    let shaCorrente;
    const rispostaLettura = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers: intestazioni(token) });
    if (rispostaLettura.ok) {
        shaCorrente = (await rispostaLettura.json()).sha;
    } else if (rispostaLettura.status !== 404) {
        throw new Error(`GitHub ha risposto ${rispostaLettura.status} leggendo lo sha di ${percorso}`);
    }

    const contenutoBase64 = Buffer.from(JSON.stringify(valore, null, 2), 'utf-8').toString('base64');

    const rispostaScrittura = await fetch(url, {
        method: 'PUT',
        headers: { ...intestazioni(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
            message: messaggioCommit || `Aggiornamento ${percorso}`,
            content: contenutoBase64,
            sha: shaCorrente,
            branch
        })
    });

    if (!rispostaScrittura.ok) {
        const dettaglio = await rispostaScrittura.text();
        throw new Error(`Errore scrittura su GitHub (${rispostaScrittura.status}): ${dettaglio}`);
    }

    return rispostaScrittura.json();
}
