// assets/js/api-elezioni.js
const APIElezioni = {
  _creds: { binId: null, apiKey: null },

  setCredentials(binId, apiKey) {
    this._creds = { binId, apiKey };
    try { sessionStorage.setItem('fz_creds_elezioni', JSON.stringify(this._creds)); } catch (e) {}
  },

  loadCredentials() {
    try {
      const raw = sessionStorage.getItem('fz_creds_elezioni');
      if (raw) this._creds = JSON.parse(raw);
    } catch (e) {}
    return this._creds;
  },

  clearCredentials() {
    this._creds = { binId: null, apiKey: null };
    try { sessionStorage.removeItem('fz_creds_elezioni'); } catch (e) {}
  },

  isAuthenticated() {
    return !!(this._creds.binId && this._creds.apiKey);
  },

  // LETTURA — passa dal server (nessuna chiave nel browser)
  async loadElezioni() {
    const res = await fetch('/api/elezioni');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data.elezioni) ? data.elezioni : [];
  },

  // SCRITTURA — usa le chiavi ottenute dal login
  async saveElezioni(elezioni) {
    if (!this.isAuthenticated()) throw new Error("Non autenticato: effettua il login.");
    const res = await fetch(`https://api.jsonbin.io/v3/b/${this._creds.binId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': this._creds.apiKey
      },
      body: JSON.stringify({ elezioni })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  },

  // Login verso il backend dedicato alle elezioni
  async login(username, password) {
    const res = await fetch('/api/login-elezioni', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Credenziali errate');
    }
    this.setCredentials(data.token.binId, data.token.apiKey);
    return data;
  }
};

// Carica le credenziali se presenti (es. dopo un refresh della pagina)
APIElezioni.loadCredentials();
