// assets/js/api.js
// Libreria client per normaktiv.html / atto.html / redazione.html.
// Login e salvataggio ora passano dallo STESSO endpoint della lettura
// (/api/atti, distinto da un campo "azione" nel corpo della richiesta POST).

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

  async loadAtti() {
    const res = await fetch('/api/atti');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message ? `HTTP ${res.status}: ${data.message}` : `HTTP ${res.status}`);
    }
    return Array.isArray(data.atti) ? data.atti : [];
  },

  async saveAtti(atti) {
    if (!this.isAuthenticated()) throw new Error("Non autenticato: effettua il login.");
    const res = await fetch('/api/atti', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this._sessione.token
      },
      body: JSON.stringify({ azione: 'salva', atti })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    return true;
  },

  async login(username, password) {
    const res = await fetch('/api/atti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'login', username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Credenziali errate');
    }
    this.setSessione(data.token, username);
    return data;
  }
};

API.loadCredentials();
