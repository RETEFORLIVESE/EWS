const ApiOrgani = {
    binId: null,
    apiKey: null,

    loadCredentials: function() {
        this.binId = sessionStorage.getItem('organi_binId'); //[cite: 1]
        this.apiKey = sessionStorage.getItem('organi_apiKey'); //[cite: 1]
        return this.isLoggedIn();
    },

    isLoggedIn: function() {
        return !!(this.binId && this.apiKey);
    },

    loadDati: async function() {
        const response = await fetch('/api/organi');
        if (!response.ok) throw new Error("Impossibile caricare i dati.");
        return await response.json();
    },

    login: async function(username, password) {
        const response = await fetch('/api/login-organi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (data.success) {
            this.binId = data.binId;
            this.apiKey = data.apiKey;
            sessionStorage.setItem('organi_binId', data.binId); //[cite: 1]
            sessionStorage.setItem('organi_apiKey', data.apiKey); //[cite: 1]
            return true;
        }
        throw new Error(data.error);
    },

    saveDati: async function(nuoviDati) {
        if (!this.isLoggedIn()) throw new Error("Non autenticato");

        const response = await fetch(`https://api.jsonbin.io/v3/b/${this.binId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': this.apiKey //[cite: 1]
            },
            body: JSON.stringify(nuoviDati)
        });
        
        if (!response.ok) throw new Error("Errore durante il salvataggio su JSONBin");
        return await response.json();
    },

    logout: function() {
        this.binId = null;
        this.apiKey = null;
        sessionStorage.removeItem('organi_binId'); //[cite: 1]
        sessionStorage.removeItem('organi_apiKey'); //[cite: 1]
    }
};
