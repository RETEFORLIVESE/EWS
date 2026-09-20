// assets/js/api.js
// Libreria client per normaktiv.html / atto.html / redazione.html.
// La lettura (/api/atti) NON cambia URL. La scrittura ora passa da
// /api/salva-atti con un token di sessione, invece del PUT diretto a JSONBin.

const API = {
  _sessione: { token: null, username: null },

  setSessione(token, username) {
    this._sessione = { token, username };
    try { sessionStorage.setItem('fz_sessione', JSON.stringify(this._sessione)); } catch (e) {}
  },

  loadCredentials() {
    try {
      const raw = sessionStorage.getItem('fz_sessione');
      if (raw) this._sessione = JSON.parse(raw);
    } catch (e) {}
    return this._sessione;
  },

  clearCredentials() {
    this._sessione = { token: null, username: null };
    try { sessionStorage.removeItem('fz_sessione'); } catch (e) {}
  },

  isAuthenticated() {
    return !!this._sessione.token;
  },

  // LETTURA — pubblica, URL invariato
  async loadAtti() {
    const res = await fetch('/api/atti');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message ? `HTTP ${res.status}: ${data.message}` : `HTTP ${res.status}`);
    }
    return Array.isArray(data.atti) ? data.atti : [];
  },

  // SCRITTURA — ora passa dal server con il token di sessione
  async saveAtti(atti) {
    if (!this.isAuthenticated()) throw new Error("Non autenticato: effettua il login.");
    const res = await fetch('/api/salva-atti', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this._sessione.token
      },
      body: JSON.stringify({ atti })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    return true;
  },

  // Login verso il backend
  async login(username, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Credenziali errate');
    }
    this.setSessione(data.token, username);
    return data;
  }
};

// Carica la sessione se presente (es. dopo un refresh della pagina)
API.loadCredentials();
