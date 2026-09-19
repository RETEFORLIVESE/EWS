// js/api-organi.js
// Libreria client per CA.html / redazioneCA.html.
// Gestisce login, lettura pubblica e salvataggio (dopo login) dell'albero Organi.

const ApiOrgani = (function () {
    const STORAGE_KEY = 'organi_credenziali';

    // --- Credenziali (memorizzate solo per la sessione del browser) ---

    function loadCredentials() {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        try {
            const cred = JSON.parse(raw);
            if (cred && cred.binId && cred.apiKey) return cred;
            return null;
        } catch (e) {
            return null;
        }
    }

    function saveCredentials(cred) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cred));
    }

    function logout() {
        sessionStorage.removeItem(STORAGE_KEY);
    }

    // --- Login ---

    async function login(username, password) {
        const risposta = await fetch('/api/login-organi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        let dati = {};
        try { dati = await risposta.json(); } catch (e) { /* ignora */ }

        if (!risposta.ok || !dati.success) {
            throw new Error(dati.error || 'Credenziali non valide.');
        }

        saveCredentials({ binId: dati.binId, apiKey: dati.apiKey, username: dati.username || username });
        return dati;
    }

    // --- Lettura pubblica (usata sia da CA.html che da redazioneCA.html) ---

    async function loadDati() {
        const risposta = await fetch('/api/organi', { cache: 'no-store' });
        if (!risposta.ok) {
            throw new Error('Errore lettura: HTTP ' + risposta.status);
        }
        const dati = await risposta.json();
        if (!dati || dati.error) {
            throw new Error((dati && dati.error) || 'Dati non disponibili.');
        }
        if (!dati.luoghi) dati.luoghi = {};
        if (!dati.alberoOrgani) dati.alberoOrgani = [];
        return dati;
    }

    // --- Lettura pubblica degli atti (norme), letti dal server con BIN_ID ---

    async function loadAtti() {
        const risposta = await fetch('/api/atti-organi', { cache: 'no-store' });
        let dati = {};
        try { dati = await risposta.json(); } catch (e) { /* ignora */ }
        if (!risposta.ok || !dati || dati.error) {
            throw new Error((dati && dati.error) || ('HTTP ' + risposta.status));
        }
        return Array.isArray(dati.atti) ? dati.atti : [];
    }

    // --- Scrittura (solo dopo login, direttamente su JSONBin) ---

    async function saveDati(datiCompleti) {
        const cred = loadCredentials();
        if (!cred) {
            throw new Error('Sessione scaduta: effettua di nuovo il login.');
        }

        const risposta = await fetch(`https://api.jsonbin.io/v3/b/${cred.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': cred.apiKey
            },
            body: JSON.stringify(datiCompleti)
        });

        if (!risposta.ok) {
            throw new Error('Errore salvataggio: HTTP ' + risposta.status);
        }
        return risposta.json();
    }

    return { loadCredentials, login, logout, loadDati, loadAtti, saveDati };
})();
