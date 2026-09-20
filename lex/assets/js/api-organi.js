// lex/assets/js/api-organi.js
// Libreria client per CA.html / redazioneCA.html.
// Login e salvataggio ora passano dallo STESSO endpoint della lettura
// (/api/organi, distinto da un campo "azione" nel corpo della richiesta POST),
// per ridurre il numero di funzioni serverless. Le norme collegate leggono
// da /api/atti (prima era /api/atti-organi, rimosso).

const ApiOrgani = (function () {
    const STORAGE_KEY = 'organi_sessione';

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

    async function login(username, password) {
        const risposta = await fetch('/api/organi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ azione: 'login', username, password })
        });

        let dati = {};
        try { dati = await risposta.json(); } catch (e) { /* ignora */ }

        if (!risposta.ok || !dati.success) {
            throw new Error(dati.error || 'Credenziali non valide.');
        }

        saveCredentials({ token: dati.token, username: dati.username || username });
        return dati;
    }

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

    // --- Lettura pubblica degli atti (norme) collegati — ora da /api/atti ---

    async function loadAtti() {
        const risposta = await fetch('/api/atti', { cache: 'no-store' });
        let dati = {};
        try { dati = await risposta.json(); } catch (e) { /* ignora */ }
        if (!risposta.ok || !dati || dati.error) {
            throw new Error((dati && dati.error) || ('HTTP ' + risposta.status));
        }
        return Array.isArray(dati.atti) ? dati.atti : [];
    }

    async function saveDati(datiCompleti) {
        const sessione = loadCredentials();
        if (!sessione) {
            throw new Error('Sessione scaduta: effettua di nuovo il login.');
        }

        const risposta = await fetch('/api/organi', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + sessione.token
            },
            body: JSON.stringify({ azione: 'salva', ...datiCompleti })
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
