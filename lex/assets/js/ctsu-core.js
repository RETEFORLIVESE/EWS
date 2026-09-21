// assets/js/ctsu-core.js
// Config pubblica + header/footer + libreria client, in un solo file.
// Login e salvataggio ora passano dallo STESSO endpoint della lettura
// (/api/ctsu, distinto da un campo "azione" nel corpo della richiesta POST);
// l'endpoint separato /api/ctsu-redazione non esiste più.
//
// Questo file, caricato da TUTTE le pagine CTSU, si occupa anche di:
//   - impostare l'icona della scheda del browser (CTSU.png) su ogni pagina;
//   - iniettare gli stili per titoli, commi, sottocommi e immagini nel testo;
//   - offrire ctsuRomano() per la numerazione dei TITOLI (I, II, III...).

const SITE_CONFIG_CTSU = {
  nomeFazione: "CTSU",
  motto: "Consiglio Tecnico-Scentifico dell'Unione",
  annoFondazione: 2024,
  emblema: "CTSU.png",
  icona: "CTSU.png",
  discord: "",
  sitoServer: "",
  titoloSito: "CTSU",
  descrizioneSito: "Raccolta ufficiale dei progetti tecnici e delle relazioni della fazione"
};

/* ---------- ICONA DELLA PAGINA (favicon) ---------- */

// Toglie qualunque icona già dichiarata nella pagina (anche quella di un altro sito, o
// dimenticata) e mette CTSU.png. Il "?v=" serve a far riscaricare l'icona al browser,
// che altrimenti si ricorda a lungo anche un tentativo fallito.
function impostaIconaCtsu() {
  if (!document.head) return;
  const href = (SITE_CONFIG_CTSU.icona || "CTSU.png") + "?v=2";
  document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(l => l.remove());
  [["icon", "image/png"], ["shortcut icon", "image/png"], ["apple-touch-icon", ""]].forEach(([rel, type]) => {
    const l = document.createElement("link");
    l.rel = rel;
    if (type) l.type = type;
    l.href = href;
    document.head.appendChild(l);
  });
}

/* ---------- NUMERI ROMANI (per i TITOLI) ---------- */

function ctsuRomano(n) {
  const tabella = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
                   [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = "";
  n = Math.max(0, Math.floor(Number(n) || 0));
  for (const [valore, simbolo] of tabella) {
    while (n >= valore) { r += simbolo; n -= valore; }
  }
  return r;
}

/* ---------- STILI AGGIUNTIVI (titoli, commi, sottocommi, immagini nel testo) ---------- */

// Le pagine pubbliche (ctsu.html, progetto.html) hanno già gli stili di articoli, commi e
// titoli-gruppo copiati da NormAktiv; qui si aggiunge solo ciò che manca per le immagini
// inserite nel testo e per i nuovi campi dell'editor.
function iniettaStiliCtsu() {
  if (!document.head || document.getElementById("ctsu-stili-extra")) return;
  const st = document.createElement("style");
  st.id = "ctsu-stili-extra";
  st.textContent = `
/* immagini inserite fra le sezioni, come comma o come sottocomma */
.immagine-atto.immagine-testo{margin:0 0 14px;text-align:center;}
.immagine-atto.immagine-testo img{width:auto;max-width:100%;max-height:520px;aspect-ratio:auto;margin:0 auto;object-fit:contain;}
.articoli > .immagine-atto.immagine-testo{margin:0;}
.articolo .comma > .immagine-atto.immagine-testo{margin:4px 0 0;}
.titolo-gruppo{scroll-margin-top:76px;}
.sottocommi > li.sottocomma-immagine{list-style:none;}
.sottocommi > li.sottocomma-immagine .immagine-atto{margin:4px 0 4px;}
/* titolo cliccabile nell'indice */
.indice-titolo-gruppo a{display:inline;padding:0;font-size:inherit;font-weight:inherit;color:inherit;letter-spacing:inherit;}
.indice-titolo-gruppo a:hover{background:none;text-decoration:underline;}

/* editor di redazione */
.redazione-azioni-riga{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}
.redazione-titolo-riga{display:flex;gap:8px;}
.redazione-form .redazione-titolo-riga input.redazione-titolo-numero{flex:0 0 130px;width:130px;}
.redazione-immagine-campi{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;}
.redazione-sottocomma .redazione-testo-campo,.redazione-sottocomma .redazione-immagine-campi{flex:1;min-width:0;}
.redazione-sottocomma__strumenti{display:grid;grid-template-columns:auto auto;gap:4px;flex:none;}
.redazione-sottocomma .redazione-btn--piccolo{padding:4px 9px;}
`;
  document.head.appendChild(st);
}

/* ---------- HEADER / FOOTER ---------- */

function renderTestataCtsu(paginaAttiva) {
  const el = document.getElementById("testata-root");
  if (!el) return;
  el.innerHTML = `
    <div class="striscia-top">
      <div class="container">
        <span>${SITE_CONFIG_CTSU.nomeFazione} &middot; [estjibundes.me.ei]</span>
        <span>
          ${SITE_CONFIG_CTSU.discord ? `<a href="${SITE_CONFIG_CTSU.discord}" target="_blank" rel="noopener">Discord</a>` : ""}
        </span>
      </div>
    </div>
    <header class="testata">
      <div class="container testata__riga">
        <div class="testata__emblema" aria-hidden="true">
          <img src="${SITE_CONFIG_CTSU.emblema}" alt="CTSU" onerror="this.parentNode.style.display='none'">
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

  async loadProgetti() {
    const res = await fetch('/api/ctsu');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ? `HTTP ${res.status}: ${data.error}` : `HTTP ${res.status}`);
    }
    return Array.isArray(data.progetti) ? data.progetti : [];
  },

  async saveProgetti(progetti) {
    if (!this.isAuthenticated()) throw new Error("Non autenticato: effettua il login.");
    const res = await fetch('/api/ctsu', {
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
    const res = await fetch('/api/ctsu', {
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

impostaIconaCtsu();
iniettaStiliCtsu();