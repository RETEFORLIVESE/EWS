// lex/assets/js/api-organi.js
// Libreria client per CA.html / redazioneCA.html.
// Le letture (/api/organi, /api/atti-organi) NON cambiano URL: la migrazione
// è avvenuta dietro le quinte (ora leggono da GitHub invece che da JSONBin).
// La scrittura ora passa da /api/salva-organi con un token di sessione,
// invece del PUT diretto a JSONBin con la Master Key.

const ApiOrgani = (function () {
    const STORAGE_KEY = 'organi_sessione';

    // --- Sessione (token, non più binId/apiKey) ---

    function loadCredentials() {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        try {
            const sessione = JSON.parse(raw);
            if (sessione && sessione.token) return sessione;
            return null;
        } catch (e) {
            return null;
        }
    }

    function saveCredentials(sessione) {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessione));
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

        saveCredentials({ token: dati.token, username: dati.username || username });
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

    // --- Lettura pubblica degli atti (norme) collegati ---

    async function loadAtti() {
        const risposta = await fetch('/api/atti-organi', { cache: 'no-store' });
        let dati = {};
        try { dati = await risposta.json(); } catch (e) { /* ignora */ }
        if (!risposta.ok || !dati || dati.error) {
            throw new Error((dati && dati.error) || ('HTTP ' + risposta.status));
        }
        return Array.isArray(dati.atti) ? dati.atti : [];
    }

    // --- Scrittura (solo dopo login, tramite il server: /api/salva-organi) ---

    async function saveDati(datiCompleti) {
        const sessione = loadCredentials();
        if (!sessione) {
            throw new Error('Sessione scaduta: effettua di nuovo il login.');
        }

        const risposta = await fetch('/api/salva-organi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessione.token
            },
            body: JSON.stringify(datiCompleti)
        });

        if (!risposta.ok) {
            let dati = {};
            try { dati = await risposta.json(); } catch (e) { /* ignora */ }
            throw new Error(dati.error || ('Errore salvataggio: HTTP ' + risposta.status));
        }
        return risposta.json();
    }

    return { loadCredentials, login, logout, loadDati, loadAtti, saveDati };
})();
