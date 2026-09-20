// assets/js/ctsu-core.js
// Config pubblica + header/footer + libreria client, in un solo file per
// tenere basso il numero di file: viene incluso da ctsu.html, progetto.html
// e redazione-ctsu.html.

const SITE_CONFIG_CTSU = {
  nomeFazione: "CTSU",
  motto: "Centro Tecnico per gli Studi e le Relazioni sui progetti dell'Unione",
  annoFondazione: 2024,
  emblema: "CTSU.png",
  discord: "",
  sitoServer: "",
  titoloSito: "CTSU",
  descrizioneSito: "Raccolta ufficiale dei progetti tecnici e delle relazioni della fazione"
};

/* ---------- HEADER / FOOTER ---------- */

function renderTestataCtsu(paginaAttiva) {
  const el = document.getElementById("testata-root");
  if (!el) return;
  el.innerHTML = `
    <div class="striscia-top">
      <div class="container">
        <span>${SITE_CONFIG_CTSU.nomeFazione} &middot; [estjibundes.me.ei]</span>
        <span>
          <a href="redazione-ctsu.html">Area Amministrativa</a>
          ${SITE_CONFIG_CTSU.discord ? `<a href="${SITE_CONFIG_CTSU.discord}" target="_blank" rel="noopener">Discord</a>` : ""}
        </span>
      </div>
    </div>
    <header class="testata">
      <div class="container testata__riga">
        <div class="testata__emblema" aria-hidden="true">
          <img src="${SITE_CONFIG_CTSU.emblema}" alt="CTSU">
        </div>
        <div class="testata__testi">
          <p class="testata__eyebrow"></p>
          <h2 class="testata__nome">${SITE_CONFIG_CTSU.nomeFazione}</h2>
          <p class="testata__motto">${SITE_CONFIG_CTSU.motto}</p>
        </div>
      </div>
    </header>
    <div class="fascia-tricolore" role="presentation">
      <span class="verde"></span><span class="bianco"></span><span class="rosso"></span>
    </div>
    <nav class="nav-principale" aria-label="Navigazione principale">
      <div class="container">
        <ul>
          <li><a href="ctsu.html" class="${paginaAttiva === "home" ? "attiva" : ""}">Home</a></li>
          <li><a href="ctsu.html?stato=In+corso" class="${paginaAttiva === "in-corso" ? "attiva" : ""}">Progetti in corso</a></li>
          <li><a href="ctsu.html?stato=Completato" class="${paginaAttiva === "completati" ? "attiva" : ""}">Progetti completati</a></li>
          <li><a href="redazione-ctsu.html" class="${paginaAttiva === "redazione" ? "attiva" : ""}">Redazione</a></li>
        </ul>
      </div>
    </nav>`;
}

function renderFooterCtsu() {
  const el = document.getElementById("footer-root");
  if (!el) return;
  const linkExtra = [];
  if (SITE_CONFIG_CTSU.discord) linkExtra.push(`<a href="${SITE_CONFIG_CTSU.discord}" target="_blank" rel="noopener">Discord</a>`);
  if (SITE_CONFIG_CTSU.sitoServer) linkExtra.push(`<a href="${SITE_CONFIG_CTSU.sitoServer}" target="_blank" rel="noopener">Sito del server</a>`);
  el.innerHTML = `
    <div class="fascia-tricolore" role="presentation">
      <span class="verde"></span><span class="bianco"></span><span class="rosso"></span>
    </div>
    <footer>
      <div class="container footer__contenuto">
        <span>&copy; ${SITE_CONFIG_CTSU.annoFondazione}&ndash;${new Date().getFullYear()} ${SITE_CONFIG_CTSU.nomeFazione}. Raccolta amministrata a fini interni, senza valore legale reale.</span>
        <span>${linkExtra.join(" &middot; ")}</span>
      </div>
    </footer>`;
}

/* ---------- LIBRERIA API (lettura pubblica + login/salvataggio redazione) ---------- */

const APICtsu = {
  _sessione: { token: null, username: null },

  setSessione(token, username) {
    this._sessione = { token, username };
    try { sessionStorage.setItem('ctsu_sessione', JSON.stringify(this._sessione)); } catch (e) {}
  },

  loadCredentials() {
    try {
      const raw = sessionStorage.getItem('ctsu_sessione');
      if (raw) this._sessione = JSON.parse(raw);
    } catch (e) {}
    return this._sessione;
  },

  clearCredentials() {
    this._sessione = { token: null, username: null };
    try { sessionStorage.removeItem('ctsu_sessione'); } catch (e) {}
  },

  isAuthenticated() {
    return !!this._sessione.token;
  },

  // LETTURA — pubblica, endpoint a parte (resta un semplice GET)
  async loadProgetti() {
    const res = await fetch('/api/ctsu');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ? `HTTP ${res.status}: ${data.error}` : `HTTP ${res.status}`);
    }
    return Array.isArray(data.progetti) ? data.progetti : [];
  },

  // SCRITTURA e LOGIN — passano entrambi da /api/ctsu-redazione, con "azione" nel corpo
  async saveProgetti(progetti) {
    if (!this.isAuthenticated()) throw new Error("Non autenticato: effettua il login.");
    const res = await fetch('/api/ctsu-redazione', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this._sessione.token
      },
      body: JSON.stringify({ azione: 'salva', progetti })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return true;
  },

  async login(username, password) {
    const res = await fetch('/api/ctsu-redazione', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'login', username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Credenziali errate');
    }
    this.setSessione(data.token, username);
    return data;
  }
};

APICtsu.loadCredentials();
