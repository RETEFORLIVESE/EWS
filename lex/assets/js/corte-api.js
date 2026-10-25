// assets/js/corte-api.js — client per /api/corte
const CorteAPI = {
  _s: { token: null, nome: null },
  _carica() { try { const r = sessionStorage.getItem("corte_sessione"); if (r) this._s = JSON.parse(r); } catch (e) {} },
  isAuthenticated() { return !!this._s.token; },
  nome() { return this._s.nome || ""; },
  esci() { this._s = { token: null, nome: null }; try { sessionStorage.removeItem("corte_sessione"); } catch (e) {} },
  _h(json) { const h = {}; if (json) h["Content-Type"] = "application/json"; if (this._s.token) h.Authorization = "Bearer " + this._s.token; return h; },
  async _json(res) {
    const d = await res.json().catch(() => ({}));
    if (res.status === 401 && this._s.token) { this.esci(); }
    if (!res.ok || d.success === false) throw new Error(d.message || "HTTP " + res.status);
    return d;
  },
  async pronunce() { return (await this._json(await fetch("/api/corte"))).pronunce || []; },
  async elencoAtti() { return (await this._json(await fetch("/api/corte?atti=1", { headers: this._h() }))).atti || []; },
  async atto(id) { return (await this._json(await fetch("/api/corte?atto=" + encodeURIComponent(id), { headers: this._h() }))).atto; },
  async login(username, password) {
    const d = await this._json(await fetch("/api/corte", { method: "POST", headers: this._h(true), body: JSON.stringify({ azione: "login", username, password }) }));
    this._s = { token: d.token, nome: d.username };
    try { sessionStorage.setItem("corte_sessione", JSON.stringify(this._s)); } catch (e) {}
    return d.username;
  },
  // Accesso con Estji ID (QR): invia il token firmato e apre la stessa sessione del login con password.
  async loginEstji(idToken) {
    const d = await this._json(await fetch("/api/corte", { method: "POST", headers: this._h(true), body: JSON.stringify({ azione: "login-estji", id_token: idToken }) }));
    this._s = { token: d.token, nome: d.username };
    try { sessionStorage.setItem("corte_sessione", JSON.stringify(this._s)); } catch (e) {}
    return d.username;
  },
  async pubblica(payload) {
    return (await this._json(await fetch("/api/corte", { method: "POST", headers: this._h(true), body: JSON.stringify({ azione: "pubblica", ...payload }) }))).pronuncia;
  }
};
CorteAPI._carica();
