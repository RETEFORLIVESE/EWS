// assets/js/redazione-ctsu.js — redazione dei progetti tecnici CTSU.
(function () {
  let vista = "menu";
  let idInModifica = null;
  let progetti = [];

  const slugify = t => (t || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  const escapeHtml = t => (t || "").toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const STATI_PROGETTO = ["In progettazione", "Approvato", "In corso", "Sospeso", "Completato", "Annullato"];

  function idUnivoco(base, escludi) {
    let c = base || "progetto", n = 2;
    while (progetti.some(p => p.id === c && p.id !== escludi)) c = `${base}-${n++}`;
    return c;
  }

  function categorieDisponibili() {
    const set = new Set(progetti.map(p => p.categoria).filter(Boolean));
    ["Infrastrutture", "Edilizia", "Trasporti", "Ambiente", "Digitale", "Energia"].forEach(c => set.add(c));
    return [...set];
  }

  function mostraMessaggio(msg) {
    const el = document.getElementById("redazione-messaggio");
    if (el) { el.textContent = msg; el.style.display = msg ? "block" : "none"; }
  }

  /* ---------- LOGIN / LOGOUT ---------- */

  function mostraLogin() {
    const la = document.getElementById('login-area');
    const ac = document.getElementById('admin-content');
    if (la) la.style.display = 'block';
    if (ac) ac.style.display = 'none';
  }

  function mostraAdmin() {
    const la = document.getElementById('login-area');
    const ac = document.getElementById('admin-content');
    if (la) la.style.display = 'none';
    if (ac) ac.style.display = 'block';
  }

  function setupLoginUI() {
    const btn = document.getElementById('loginBtn');
    const err = document.getElementById('loginError');
    const user = document.getElementById('adminUsername');
    const pass = document.getElementById('adminPassword');
    const out = document.getElementById('logoutBtn');
    const label = document.getElementById('adminUsernameLabel');
    if (!btn || !user || !pass) return;

    btn.addEventListener('click', async () => {
      err.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Accesso…';
      const u = user.value.trim();
      const p = pass.value;
      try {
        await APICtsu.login(u, p);
        try { sessionStorage.setItem('ctsu_user', u); } catch (e) {}
        if (label) label.textContent = u;
        const avatar = document.getElementById('adminAvatar');
        if (avatar) avatar.textContent = (u.trim()[0] || '?').toUpperCase();
        mostraAdmin();
        await avviaRedazione();
      } catch (e) {
        err.textContent = '❌ ' + (e.message || 'Errore di accesso');
        err.classList.add('show');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Accedi';
      }
    });

    [user, pass].forEach(el => el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); btn.click(); }
    }));

    if (out) {
      out.addEventListener('click', () => {
        APICtsu.clearCredentials();
        try { sessionStorage.removeItem('ctsu_user'); } catch (e) {}
        location.reload();
      });
    }
  }

  /* ---------- VISTE: MENU / CARICA ---------- */

  function renderMenu() {
    return `
      <p class="breadcrumb"><a href="ctsu.html">Home</a> &rsaquo; Redazione</p>
      <h1 style="margin-bottom:4px;">Redazione dei progetti</h1>
      <p style="color:var(--inchiostro-tenue); max-width:60ch; margin-top:0;">
        Le modifiche vengono salvate direttamente sul database condiviso: saranno visibili a tutti gli utenti del sito.
      </p>
      <div class="redazione-menu" style="grid-template-columns:repeat(2,1fr);">
        <button type="button" class="redazione-card" data-azione="nuovo">
          <span class="redazione-card__numero">1</span>
          <span class="redazione-card__titolo">Crea nuovo progetto</span>
          <span class="redazione-card__desc">Apri un modulo vuoto per scrivere una relazione da zero.</span>
        </button>
        <button type="button" class="redazione-card" data-azione="carica">
          <span class="redazione-card__numero">2</span>
          <span class="redazione-card__titolo">Carica progetto esistente</span>
          <span class="redazione-card__desc">Scegli un progetto già presente e modificane il contenuto.</span>
        </button>
      </div>
      <p id="redazione-messaggio" class="redazione-messaggio" style="display:none;"></p>
      <p style="margin-top:20px; color:var(--inchiostro-tenue); font-size:0.85rem;">
        Progetti attualmente nel database: <strong>${progetti.length}</strong>
      </p>`;
  }

  function renderCarica() {
    const lista = [...progetti].sort((a, b) => (a.titolo || "").localeCompare(b.titolo || ""));
    const righe = lista.map(p => `
      <div class="redazione-riga" data-id="${escapeHtml(p.id)}">
        <div>
          <span class="badge-categoria">${escapeHtml(p.categoria)}</span>
          <span class="badge-stato">${escapeHtml(p.stato)}</span>
          <p class="redazione-riga__titolo">${escapeHtml(p.titolo)}</p>
          <p class="redazione-riga__meta">${(p.sezioni || []).length} sezioni &middot; ${(p.galleria || []).length} foto &middot; ${(p.allegati || []).length} allegati</p>
        </div>
        <div class="redazione-riga__azioni">
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-modifica="${escapeHtml(p.id)}">Modifica</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-elimina="${escapeHtml(p.id)}">Elimina</button>
        </div>
      </div>`).join("");

    return `
      <p class="breadcrumb"><a href="ctsu.html">Home</a> &rsaquo; <a href="redazione-ctsu.html">Redazione</a> &rsaquo; Carica progetto esistente</p>
      <h1>Carica progetto esistente</h1>
      <input type="text" id="redazione-filtro" placeholder="Filtra per titolo o categoria&hellip;" style="width:100%; max-width:420px; padding:10px 14px; border:1px solid var(--bordo); border-radius:var(--radius); font-family:var(--font-chrome); margin-bottom:16px;" />
      <div id="redazione-elenco-carica">${righe || "<p>Nessun progetto presente.</p>"}</div>
      <p style="margin-top:20px;"><button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">&larr; Torna al menu</button></p>`;
  }

  /* ---------- COLLEGAMENTI E TABELLE NEL TESTO DI UNA SEZIONE ---------- */

  // Stesso meccanismo già usato in NormAktiv, ma il riferimento interno rapido
  // punta a "#sez-N" (la sezione N di QUESTO progetto) invece che ad articolo/comma.
  function inserisciCollegamento(textarea) {
    const inizio = textarea.selectionStart;
    const fine = textarea.selectionEnd;
    if (inizio === fine) {
      alert("Seleziona prima, nel testo, la parola o la frase da collegare.");
      return;
    }
    const testoSelezionato = textarea.value.slice(inizio, fine);
    const destinazione = prompt(
      "Dove deve puntare il collegamento?\n\n" +
      "• Indirizzo web: https://esempio.example\n" +
      "• Riferimento interno a una sezione DI QUESTO PROGETTO: 2  (= Sezione 2)\n" +
      "• Riferimento avanzato: #qualcosa",
      ""
    );
    if (!destinazione) return;
    const valore = destinazione.trim();

    let href, attributiExtra = "";
    if (/^https?:\/\//i.test(valore)) {
      href = valore;
      attributiExtra = ' target="_blank" rel="noopener noreferrer"';
    } else if (/^\d+$/.test(valore)) {
      href = `#sez-${valore}`;
    } else if (valore.startsWith("#")) {
      href = valore;
    } else {
      alert('Formato non riconosciuto. Usa un indirizzo che inizi con http/https, oppure il numero di una sezione (es. 2).');
      return;
    }

    const tag = `<a href="${href}"${attributiExtra}>${testoSelezionato}</a>`;
    textarea.value = textarea.value.slice(0, inizio) + tag + textarea.value.slice(fine);
    const nuovaPosizione = inizio + tag.length;
    textarea.focus();
    textarea.setSelectionRange(nuovaPosizione, nuovaPosizione);
  }

  // Inserisce lo scheletro HTML di una tabella nel punto in cui si trova il
  // cursore (non serve selezionare nulla): righe/colonne si scelgono con un
  // prompt, poi si riempie il contenuto a mano dentro le celle.
  function inserisciTabella(textarea) {
    const dimensioni = prompt('Quante righe e colonne? (formato "righe x colonne", es. 3x4)', "3x3");
    if (!dimensioni) return;
    const m = dimensioni.trim().match(/^(\d+)\s*[x×,]\s*(\d+)$/i);
    if (!m) {
      alert('Formato non riconosciuto. Scrivi ad esempio "3x4".');
      return;
    }
    const righe = Math.max(1, Math.min(30, parseInt(m[1], 10)));
    const colonne = Math.max(1, Math.min(12, parseInt(m[2], 10)));

    const intestazione = `<tr>${Array.from({ length: colonne }, (_, c) => `<th>Colonna ${c + 1}</th>`).join("")}</tr>`;
    const corpo = Array.from({ length: righe }, () =>
      `<tr>${Array.from({ length: colonne }, () => `<td>Cella</td>`).join("")}</tr>`
    ).join("\n");
    const tabella = `\n<table class="tabella-progetto">\n<thead>${intestazione}</thead>\n<tbody>\n${corpo}\n</tbody>\n</table>\n`;

    const pos = textarea.selectionStart;
    textarea.value = textarea.value.slice(0, pos) + tabella + textarea.value.slice(pos);
    const nuovaPosizione = pos + tabella.length;
    textarea.focus();
    textarea.setSelectionRange(nuovaPosizione, nuovaPosizione);
  }

  /* ---------- SEZIONI (editor) ---------- */

  function renderSezione(sez, i) {
    return `
      <div class="redazione-articolo redazione-blocco" data-indice="${i}">
        <div class="redazione-articolo__intestazione">
          <span>Sezione ${i + 1}</span>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-inserisci-link onmousedown="event.preventDefault()" title="Inserisci un collegamento nel testo selezionato">🔗 Link</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-inserisci-tabella onmousedown="event.preventDefault()" title="Inserisci una tabella nel testo">📊 Tabella</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-sposta="su" title="Sposta su">↑</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-sposta="giu" title="Sposta giù">↓</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-sezione style="margin-left:auto;">Rimuovi sezione</button>
        </div>
        <input type="text" class="redazione-sez-titolo" placeholder="Titolo della sezione (es. Obiettivi del progetto)" value="${escapeHtml(sez.titolo)}" />
        <textarea class="redazione-sez-testo" placeholder="Testo della sezione" rows="5">${escapeHtml(sez.testo)}</textarea>
      </div>`;
  }

  /* ---------- GALLERIA (editor) ---------- */

  function renderGalleriaRiga(g, i) {
    return `
      <div class="redazione-comma redazione-blocco-galleria" data-indice="${i}">
        <input type="text" class="redazione-galleria-url" placeholder="Indirizzo web dell'immagine (https://...)" value="${escapeHtml(g.url)}" />
        <input type="text" class="redazione-galleria-didascalia" placeholder="Didascalia (facoltativa)" value="${escapeHtml(g.didascalia)}" style="margin-top:8px;" />
        <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-galleria style="margin-top:8px;">Rimuovi foto</button>
      </div>`;
  }

  /* ---------- ALLEGATI (editor) ---------- */

  function renderAllegatoRiga(a, i) {
    return `
      <div class="redazione-comma redazione-blocco-allegato" data-indice="${i}">
        <input type="text" class="redazione-allegato-titolo" placeholder="Titolo dell'allegato (es. Relazione geologica)" value="${escapeHtml(a.titolo)}" />
        <input type="text" class="redazione-allegato-url" placeholder="Indirizzo web del documento (https://...)" value="${escapeHtml(a.url)}" style="margin-top:8px;" />
        <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-allegato style="margin-top:8px;">Rimuovi allegato</button>
      </div>`;
  }

  /* ---------- EDITOR COMPLETO ---------- */

  function renderEditor(progetto) {
    idInModifica = progetto ? progetto.id : null;
    const sezioni = progetto && progetto.sezioni && progetto.sezioni.length ? progetto.sezioni : [{ titolo: "", testo: "" }];
    const galleria = (progetto && progetto.galleria) || [];
    const allegati = (progetto && progetto.allegati) || [];
    const cat = progetto ? progetto.categoria : "";
    const stato = progetto ? progetto.stato : "In progettazione";

    const opzioniCategoria = categorieDisponibili()
      .map(c => `<option value="${escapeHtml(c)}" ${c === cat ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");
    const opzioniStato = STATI_PROGETTO
      .map(s => `<option value="${escapeHtml(s)}" ${s === stato ? "selected" : ""}>${escapeHtml(s)}</option>`).join("");

    return `
      <p class="breadcrumb"><a href="ctsu.html">Home</a> &rsaquo; <a href="redazione-ctsu.html">Redazione</a> &rsaquo; ${progetto ? "Modifica progetto" : "Nuovo progetto"}</p>
      <h1>${progetto ? "Modifica progetto" : "Nuovo progetto"}</h1>
      <p id="redazione-messaggio" class="redazione-messaggio" style="display:none;"></p>
      <form id="redazione-form" class="redazione-form" novalidate>

        <div class="redazione-campo">
          <label for="f-titolo">Titolo del progetto</label>
          <input type="text" id="f-titolo" required value="${progetto ? escapeHtml(progetto.titolo) : ""}" />
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo">
            <label for="f-categoria">Categoria</label>
            <select id="f-categoria">${opzioniCategoria}</select>
          </div>
          <div class="redazione-campo">
            <label for="f-categoria-nuova">Oppure nuova categoria</label>
            <input type="text" id="f-categoria-nuova" placeholder="Lascia vuoto per usare quella scelta sopra" />
          </div>
          <div class="redazione-campo">
            <label for="f-stato">Stato</label>
            <select id="f-stato">${opzioniStato}</select>
          </div>
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-organo">Organo responsabile</label><input type="text" id="f-organo" value="${progetto ? escapeHtml(progetto.organo_responsabile) : ""}" /></div>
          <div class="redazione-campo"><label for="f-luogo">Luogo</label><input type="text" id="f-luogo" value="${progetto ? escapeHtml(progetto.luogo) : ""}" /></div>
          <div class="redazione-campo"><label for="f-responsabile">Responsabile di progetto</label><input type="text" id="f-responsabile" value="${progetto ? escapeHtml(progetto.responsabile) : ""}" /></div>
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-data-inizio">Data di inizio</label><input type="text" id="f-data-inizio" placeholder="es. 12 agosto 2026" value="${progetto ? escapeHtml(progetto.data_inizio) : ""}" /></div>
          <div class="redazione-campo"><label for="f-data-fine">Fine prevista</label><input type="text" id="f-data-fine" value="${progetto ? escapeHtml(progetto.data_fine_prevista) : ""}" /></div>
          <div class="redazione-campo"><label for="f-data-completamento">Completamento</label><input type="text" id="f-data-completamento" value="${progetto ? escapeHtml(progetto.data_completamento) : ""}" /></div>
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-budget">Budget previsto</label><input type="text" id="f-budget" placeholder='es. "€ 240.000"' value="${progetto ? escapeHtml(progetto.budget_previsto) : ""}" /></div>
          <div class="redazione-campo"><label for="f-costo">Costo effettivo</label><input type="text" id="f-costo" value="${progetto ? escapeHtml(progetto.costo_effettivo) : ""}" /></div>
        </div>

        <div class="redazione-campo">
          <label for="f-sommario">Sommario (mostrato nell'elenco)</label>
          <textarea id="f-sommario" rows="2">${progetto ? escapeHtml(progetto.sommario) : ""}</textarea>
        </div>

        <div class="redazione-campo">
          <label for="f-copertina">Immagine di copertina (indirizzo web)</label>
          <input type="text" id="f-copertina" placeholder="https://..." value="${progetto ? escapeHtml(progetto.copertina) : ""}" />
        </div>

        <div class="redazione-campo">
          <label for="f-id">Identificativo URL (id)</label>
          <input type="text" id="f-id" value="${progetto ? escapeHtml(progetto.id) : ""}" placeholder="generato dal titolo se vuoto" />
        </div>

        <h3>Sezioni della relazione</h3>
        <div id="redazione-sezioni">${sezioni.map((s, i) => renderSezione(s, i)).join("")}</div>
        <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-sezione">+ Aggiungi sezione</button>

        <h3 style="margin-top:28px;">Galleria fotografica</h3>
        <p style="font-size:.82rem;color:var(--inchiostro-tenue);margin:0 0 10px;">Un'immagine per riga, con indirizzo web e didascalia facoltativa.</p>
        <div id="redazione-galleria">${galleria.map((g, i) => renderGalleriaRiga(g, i)).join("")}</div>
        <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-galleria">+ Aggiungi foto</button>

        <h3 style="margin-top:28px;">Allegati</h3>
        <p style="font-size:.82rem;color:var(--inchiostro-tenue);margin:0 0 10px;">Documenti collegati alla relazione (PDF, planimetrie, capitolati...): titolo + indirizzo web del file.</p>
        <div id="redazione-allegati">${allegati.map((a, i) => renderAllegatoRiga(a, i)).join("")}</div>
        <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-allegato">+ Aggiungi allegato</button>

        <div class="redazione-azioni-form" style="margin-top:28px;">
          <button type="submit" class="redazione-btn redazione-btn--primario">💾 Salva sul database</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">Annulla</button>
          ${progetto ? `<button type="button" class="redazione-btn redazione-btn--pericolo" id="redazione-elimina-corrente">Elimina questo progetto</button>` : ""}
        </div>
      </form>`;
  }

  /* ---------- RACCOLTA E SALVATAGGIO ---------- */

  function leggiSezioni() {
    return [...document.querySelectorAll("#redazione-sezioni > .redazione-articolo")].map(el => ({
      titolo: el.querySelector(".redazione-sez-titolo").value.trim(),
      testo: el.querySelector(".redazione-sez-testo").value.trim()
    }));
  }

  function leggiGalleria() {
    return [...document.querySelectorAll("#redazione-galleria > .redazione-blocco-galleria")]
      .map(el => ({
        url: el.querySelector(".redazione-galleria-url").value.trim(),
        didascalia: el.querySelector(".redazione-galleria-didascalia").value.trim()
      }))
      .filter(g => g.url !== "");
  }

  function leggiAllegati() {
    return [...document.querySelectorAll("#redazione-allegati > .redazione-blocco-allegato")]
      .map(el => ({
        titolo: el.querySelector(".redazione-allegato-titolo").value.trim(),
        url: el.querySelector(".redazione-allegato-url").value.trim()
      }))
      .filter(a => a.url !== "");
  }

  function raccogliProgetto() {
    const titolo = document.getElementById("f-titolo").value.trim();
    const catNuova = document.getElementById("f-categoria-nuova").value.trim();
    const categoria = catNuova || document.getElementById("f-categoria").value;
    const idBase = slugify(document.getElementById("f-id").value.trim() || titolo);
    return {
      id: idUnivoco(idBase, idInModifica),
      titolo,
      categoria,
      stato: document.getElementById("f-stato").value,
      organo_responsabile: document.getElementById("f-organo").value.trim(),
      luogo: document.getElementById("f-luogo").value.trim(),
      responsabile: document.getElementById("f-responsabile").value.trim(),
      data_inizio: document.getElementById("f-data-inizio").value.trim(),
      data_fine_prevista: document.getElementById("f-data-fine").value.trim(),
      data_completamento: document.getElementById("f-data-completamento").value.trim(),
      budget_previsto: document.getElementById("f-budget").value.trim(),
      costo_effettivo: document.getElementById("f-costo").value.trim(),
      sommario: document.getElementById("f-sommario").value.trim(),
      copertina: document.getElementById("f-copertina").value.trim(),
      sezioni: leggiSezioni(),
      galleria: leggiGalleria(),
      allegati: leggiAllegati(),
    };
  }

  async function salvaProgetto(progetto) {
    const copia = progetti.filter(p => p.id !== idInModifica && p.id !== progetto.id);
    copia.push(progetto);
    try {
      await APICtsu.saveProgetti(copia);
      progetti = copia;
      return true;
    } catch (e) {
      mostraMessaggio("Errore salvataggio: " + e.message);
      return false;
    }
  }

  async function eliminaProgetto(id) {
    const copia = progetti.filter(p => p.id !== id);
    try {
      await APICtsu.saveProgetti(copia);
      progetti = copia;
      return true;
    } catch (e) {
      mostraMessaggio("Errore eliminazione: " + e.message);
      return false;
    }
  }

  /* ---------- ROUTING ---------- */

  function vai(vista_, extra) {
    vista = vista_;
    const root = document.getElementById("redazione-root");
    if (vista === "menu") root.innerHTML = renderMenu();
    else if (vista === "carica") root.innerHTML = renderCarica();
    else if (vista === "editor") root.innerHTML = renderEditor(extra || null);
    window.scrollTo(0, 0);
  }

  /* ---------- EVENTI ---------- */

  function initEventi() {
    const root = document.getElementById("redazione-root");

    root.addEventListener("click", async e => {
      const azione = e.target.closest("[data-azione]");
      if (azione) {
        const a = azione.getAttribute("data-azione");
        if (a === "nuovo") vai("editor", null);
        else if (a === "carica") vai("carica");
        else if (a === "menu") vai("menu");
        return;
      }

      const mod = e.target.closest("[data-modifica]");
      if (mod) {
        const progetto = progetti.find(p => p.id === mod.getAttribute("data-modifica"));
        if (progetto) vai("editor", progetto);
        return;
      }

      const del = e.target.closest("[data-elimina]");
      if (del) {
        const id = del.getAttribute("data-elimina");
        const progetto = progetti.find(p => p.id === id);
        if (progetto && confirm(`Eliminare "${progetto.titolo}"?`)) {
          if (await eliminaProgetto(id)) vai("carica");
        }
        return;
      }

      // ---- Inserisci collegamento nel testo selezionato di una sezione ----
      const link = e.target.closest("[data-inserisci-link]");
      if (link) {
        const contenitore = link.closest(".redazione-articolo");
        const textarea = contenitore ? contenitore.querySelector(".redazione-sez-testo") : null;
        if (textarea) inserisciCollegamento(textarea);
        return;
      }

      // ---- Inserisci una tabella nel testo di una sezione ----
      const tabella = e.target.closest("[data-inserisci-tabella]");
      if (tabella) {
        const contenitore = tabella.closest(".redazione-articolo");
        const textarea = contenitore ? contenitore.querySelector(".redazione-sez-testo") : null;
        if (textarea) inserisciTabella(textarea);
        return;
      }

      // ---- Sposta su/giù una sezione ----
      const sposta = e.target.closest("[data-sposta]");
      if (sposta) {
        const riga = sposta.closest(".redazione-blocco");
        if (riga) {
          const direzione = sposta.getAttribute("data-sposta");
          if (direzione === "su" && riga.previousElementSibling) {
            riga.parentElement.insertBefore(riga, riga.previousElementSibling);
          } else if (direzione === "giu" && riga.nextElementSibling) {
            riga.parentElement.insertBefore(riga.nextElementSibling, riga);
          }
        }
        return;
      }

      // ---- Aggiungi sezione ----
      if (e.target.id === "redazione-aggiungi-sezione") {
        const c = document.getElementById("redazione-sezioni");
        c.insertAdjacentHTML("beforeend", renderSezione({ titolo: "", testo: "" }, c.children.length));
        return;
      }

      // ---- Rimuovi sezione ----
      const rimSez = e.target.closest("[data-rimuovi-sezione]");
      if (rimSez) {
        if (document.querySelectorAll("#redazione-sezioni > .redazione-articolo").length <= 1) {
          alert("Deve rimanere almeno una sezione.");
          return;
        }
        rimSez.closest(".redazione-articolo").remove();
        return;
      }

      // ---- Aggiungi foto alla galleria ----
      if (e.target.id === "redazione-aggiungi-galleria") {
        const c = document.getElementById("redazione-galleria");
        c.insertAdjacentHTML("beforeend", renderGalleriaRiga({ url: "", didascalia: "" }, c.children.length));
        return;
      }

      // ---- Rimuovi foto dalla galleria ----
      const rimGalleria = e.target.closest("[data-rimuovi-galleria]");
      if (rimGalleria) {
        rimGalleria.closest(".redazione-blocco-galleria").remove();
        return;
      }

      // ---- Aggiungi allegato ----
      if (e.target.id === "redazione-aggiungi-allegato") {
        const c = document.getElementById("redazione-allegati");
        c.insertAdjacentHTML("beforeend", renderAllegatoRiga({ titolo: "", url: "" }, c.children.length));
        return;
      }

      // ---- Rimuovi allegato ----
      const rimAllegato = e.target.closest("[data-rimuovi-allegato]");
      if (rimAllegato) {
        rimAllegato.closest(".redazione-blocco-allegato").remove();
        return;
      }

      if (e.target.id === "redazione-elimina-corrente" && idInModifica) {
        const progetto = progetti.find(p => p.id === idInModifica);
        if (progetto && confirm(`Eliminare "${progetto.titolo}"?`)) {
          if (await eliminaProgetto(idInModifica)) vai("menu");
        }
        return;
      }
    });

    root.addEventListener("submit", async e => {
      if (e.target.id !== "redazione-form") return;
      e.preventDefault();
      if (!document.getElementById("f-titolo").value.trim()) {
        alert("Inserisci almeno il titolo del progetto.");
        return;
      }
      const progetto = raccogliProgetto();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Salvataggio…";
      const ok = await salvaProgetto(progetto);
      btn.disabled = false; btn.textContent = "💾 Salva sul database";
      if (ok) {
        vai("editor", progetto);
        mostraMessaggio("✅ Salvato sul database. Sarà visibile a tutti gli utenti del sito.");
      }
    });

    root.addEventListener("input", e => {
      if (e.target.id === "redazione-filtro") {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll("#redazione-elenco-carica .redazione-riga").forEach(r => {
          r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      }
    });
  }

  /* ---------- AVVIO REDAZIONE ---------- */

  async function avviaRedazione() {
    initEventi();
    try {
      progetti = await APICtsu.loadProgetti();
    } catch (e) {
      alert("Errore nel caricamento dei progetti: " + e.message);
      progetti = [];
    }
    vai("menu");
  }

  /* ---------- INIT ---------- */

  async function init() {
    renderTestataCtsu("redazione");
    renderFooterCtsu();

    setupLoginUI();

    if (APICtsu.isAuthenticated()) {
      const saved = (() => { try { return sessionStorage.getItem('ctsu_user'); } catch (e) { return null; } })();
      const label = document.getElementById('adminUsernameLabel');
      if (label && saved) label.textContent = saved;
      const avatar = document.getElementById('adminAvatar');
      if (avatar && saved) avatar.textContent = (saved.trim()[0] || '?').toUpperCase();
      mostraAdmin();
      await avviaRedazione();
    } else {
      mostraLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
