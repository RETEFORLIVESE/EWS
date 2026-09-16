// assets/js/redazione.js
(function () {
  let vista = "menu";
  let idInModifica = null;
  let atti = [];

  const slugify = t => (t || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  const escapeHtml = t => (t || "").toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function idUnivoco(base, escludi) {
    let c = base || "atto", n = 2;
    while (atti.some(a => a.id === c && a.id !== escludi)) c = `${base}-${n++}`;
    return c;
  }

  function categorieDisponibili() {
    const set = new Set(atti.map(a => a.categoria).filter(Boolean));
    ["Statuto Costituzionale", "Regolamento", "Codice", "Editto", "Decreto"]
      .forEach(c => set.add(c));
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
    const btn   = document.getElementById('loginBtn');
    const err   = document.getElementById('loginError');
    const user  = document.getElementById('adminUsername');
    const pass  = document.getElementById('adminPassword');
    const out   = document.getElementById('logoutBtn');
    const label = document.getElementById('adminUsernameLabel');

    if (!btn || !user || !pass) return; // sicurezza se il markup non c'è

    btn.addEventListener('click', async () => {
      err.textContent = '';
      btn.disabled = true;
      btn.textContent = 'Accesso…';
      const u = user.value.trim();
      const p = pass.value;
      try {
        await API.login(u, p);
        // salva il nome utente per la topbar (sopravvive al refresh)
        try { sessionStorage.setItem('fz_user', u); } catch (e) {}
        if (label) label.textContent = u;
        mostraAdmin();
        await avviaRedazione();
      } catch (e) {
        err.textContent = '❌ ' + (e.message || 'Errore di accesso');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Accedi';
      }
    });

    // Invio da qualsiasi campo → click sul bottone
    [user, pass].forEach(el => el.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); btn.click(); }
    }));

    if (out) {
      out.addEventListener('click', () => {
        API.clearCredentials();
        try { sessionStorage.removeItem('fz_user'); } catch (e) {}
        location.reload();
      });
    }
  }

  /* ---------- VISTE ---------- */

  function renderMenu() {
    return `
      <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; Redazione</p>
      <h1 style="margin-bottom:4px;">Redazione degli atti</h1>
      <p style="color:var(--inchiostro-tenue); max-width:60ch; margin-top:0;">
        Le modifiche vengono salvate direttamente sul database condiviso: saranno visibili a tutti gli utenti del sito.
      </p>
      <div class="redazione-menu" style="grid-template-columns:repeat(2,1fr);">
        <button type="button" class="redazione-card" data-azione="nuovo">
          <span class="redazione-card__numero">1</span>
          <span class="redazione-card__titolo">Crea nuovo atto</span>
          <span class="redazione-card__desc">Apri un modulo vuoto per scrivere un atto da zero.</span>
        </button>
        <button type="button" class="redazione-card" data-azione="carica">
          <span class="redazione-card__numero">2</span>
          <span class="redazione-card__titolo">Carica atto esistente</span>
          <span class="redazione-card__desc">Scegli un atto già presente e modificane il contenuto.</span>
        </button>
      </div>
      <p id="redazione-messaggio" class="redazione-messaggio" style="display:none;"></p>
      <p style="margin-top:20px; color:var(--inchiostro-tenue); font-size:0.85rem;">
        Atti attualmente nel database: <strong>${atti.length}</strong>
      </p>`;
  }

  function renderCarica() {
    const lista = [...atti].sort((a, b) => (a.titolo || "").localeCompare(b.titolo || ""));
    const righe = lista.map(a => `
      <div class="redazione-riga" data-id="${escapeHtml(a.id)}">
        <div>
          <span class="badge-categoria">${escapeHtml(a.categoria)}</span>
          <p class="redazione-riga__titolo">${escapeHtml(a.titolo)}</p>
          <p class="redazione-riga__meta">n. ${escapeHtml(a.numero)}/${escapeHtml(a.anno)} &middot; ${a.articoli.length} articoli</p>
        </div>
        <div class="redazione-riga__azioni">
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-modifica="${escapeHtml(a.id)}">Modifica</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-elimina="${escapeHtml(a.id)}">Elimina</button>
        </div>
      </div>`).join("");

    return `
      <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; <a href="redazione.html">Redazione</a> &rsaquo; Carica atto esistente</p>
      <h1>Carica atto esistente</h1>
      <input type="text" id="redazione-filtro" placeholder="Filtra per titolo o categoria&hellip;" style="width:100%; max-width:420px; padding:10px 14px; border:1px solid var(--bordo); border-radius:var(--radius); font-family:var(--font-chrome); margin-bottom:16px;" />
      <div id="redazione-elenco-carica">${righe || "<p>Nessun atto presente.</p>"}</div>
      <p style="margin-top:20px;"><button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">&larr; Torna al menu</button></p>`;
  }

  function renderRigaArticolo(art, i) {
    return `
      <div class="redazione-articolo" data-indice="${i}">
        <div class="redazione-articolo__intestazione">
          <span>Articolo</span>
          <input type="text" class="redazione-art-numero" value="${escapeHtml(art.numero)}" style="width:70px;" />
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-articolo="${i}" style="margin-left:auto;">Rimuovi</button>
        </div>
        <input type="text" class="redazione-art-rubrica" placeholder="Rubrica dell'articolo" value="${escapeHtml(art.rubrica)}" />
        <textarea class="redazione-art-testo" placeholder="Testo dell'articolo" rows="4">${escapeHtml(art.testo)}</textarea>
      </div>`;
  }

  function renderEditor(atto) {
    idInModifica = atto ? atto.id : null;
    const articoli = atto ? atto.articoli.map(a => ({ ...a })) : [{ numero: 1, rubrica: "", testo: "" }];
    const cat = atto ? atto.categoria : "";
    const opzioni = categorieDisponibili()
      .map(c => `<option value="${escapeHtml(c)}" ${c === cat ? "selected" : ""}>${escapeHtml(c)}</option>`).join("");

    return `
      <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; <a href="redazione.html">Redazione</a> &rsaquo; ${atto ? "Modifica atto" : "Nuovo atto"}</p>
      <h1>${atto ? "Modifica atto" : "Nuovo atto"}</h1>
      <p id="redazione-messaggio" class="redazione-messaggio" style="display:none;"></p>
      <form id="redazione-form" class="redazione-form" novalidate>
        <div class="redazione-campo">
          <label for="f-titolo">Titolo</label>
          <input type="text" id="f-titolo" required value="${atto ? escapeHtml(atto.titolo) : ""}" />
        </div>
        <div class="redazione-riga-campi">
          <div class="redazione-campo">
            <label for="f-categoria">Categoria</label>
            <select id="f-categoria">${opzioni}</select>
          </div>
          <div class="redazione-campo">
            <label for="f-categoria-nuova">Oppure nuova categoria</label>
            <input type="text" id="f-categoria-nuova" placeholder="Lascia vuoto per usare quella scelta sopra" />
          </div>
        </div>
        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-numero">Numero</label><input type="text" id="f-numero" value="${atto ? escapeHtml(atto.numero) : ""}" /></div>
          <div class="redazione-campo"><label for="f-anno">Anno</label><input type="text" id="f-anno" value="${atto ? escapeHtml(atto.anno) : new Date().getFullYear()}" /></div>
          <div class="redazione-campo"><label for="f-stato">Stato</label>
            <select id="f-stato">
              <option value="vigente" ${!atto || atto.stato === "vigente" ? "selected" : ""}>vigente</option>
              <option value="abrogato" ${atto && atto.stato === "abrogato" ? "selected" : ""}>abrogato</option>
            </select>
          </div>
        </div>
        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-data">Data di emanazione</label><input type="text" id="f-data" placeholder="es. 12 agosto 2024" value="${atto ? escapeHtml(atto.dataEmanazione) : ""}" /></div>
          <div class="redazione-campo"><label for="f-promulgato">Promulgato da</label><input type="text" id="f-promulgato" value="${atto ? escapeHtml(atto.promulgatoDa) : ""}" /></div>
        </div>
        <div class="redazione-campo">
          <label for="f-sommario">Sommario (mostrato nell'elenco)</label>
          <textarea id="f-sommario" rows="2">${atto ? escapeHtml(atto.sommario) : ""}</textarea>
        </div>
        <div class="redazione-campo">
          <label for="f-id">Identificativo URL (id)</label>
          <input type="text" id="f-id" value="${atto ? escapeHtml(atto.id) : ""}" placeholder="generato dal titolo se vuoto" />
        </div>
        <h3>Articoli</h3>
        <div id="redazione-articoli">${articoli.map((a, i) => renderRigaArticolo(a, i)).join("")}</div>
        <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-articolo">+ Aggiungi articolo</button>
        <div class="redazione-azioni-form">
          <button type="submit" class="redazione-btn redazione-btn--primario">💾 Salva sul database</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">Annulla</button>
          ${atto ? `<button type="button" class="redazione-btn redazione-btn--pericolo" id="redazione-elimina-corrente">Elimina questo atto</button>` : ""}
        </div>
      </form>`;
  }

  /* ---------- RACCOLTA E SALVATAGGIO ---------- */

  function leggiArticoli() {
    return [...document.querySelectorAll("#redazione-articoli .redazione-articolo")].map(el => ({
      numero: el.querySelector(".redazione-art-numero").value.trim() || "1",
      rubrica: el.querySelector(".redazione-art-rubrica").value.trim(),
      testo: el.querySelector(".redazione-art-testo").value.trim(),
    }));
  }

  function raccogliAtto() {
    const titolo = document.getElementById("f-titolo").value.trim();
    const catNuova = document.getElementById("f-categoria-nuova").value.trim();
    const categoria = catNuova || document.getElementById("f-categoria").value;
    const idBase = slugify(document.getElementById("f-id").value.trim() || titolo);
    return {
      id: idUnivoco(idBase, idInModifica),
      categoria,
      numero: document.getElementById("f-numero").value.trim(),
      anno: document.getElementById("f-anno").value.trim(),
      titolo,
      dataEmanazione: document.getElementById("f-data").value.trim(),
      promulgatoDa: document.getElementById("f-promulgato").value.trim(),
      stato: document.getElementById("f-stato").value,
      sommario: document.getElementById("f-sommario").value.trim(),
      articoli: leggiArticoli(),
    };
  }

  async function salvaAtto(atto) {
    const copia = atti.filter(a => a.id !== idInModifica && a.id !== atto.id);
    copia.push(atto);
    try {
      await API.saveAtti(copia);
      atti = copia;
      return true;
    } catch (e) {
      mostraMessaggio("Errore salvataggio: " + e.message);
      return false;
    }
  }

  async function eliminaAtto(id) {
    const copia = atti.filter(a => a.id !== id);
    try {
      await API.saveAtti(copia);
      atti = copia;
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
        const atto = atti.find(a => a.id === mod.getAttribute("data-modifica"));
        if (atto) vai("editor", atto);
        return;
      }

      const del = e.target.closest("[data-elimina]");
      if (del) {
        const id = del.getAttribute("data-elimina");
        const atto = atti.find(a => a.id === id);
        if (atto && confirm(`Eliminare "${atto.titolo}"?`)) {
          if (await eliminaAtto(id)) vai("carica");
        }
        return;
      }

      const rim = e.target.closest("[data-rimuovi-articolo]");
      if (rim) {
        if (document.querySelectorAll("#redazione-articoli .redazione-articolo").length <= 1) {
          alert("Deve rimanere almeno un articolo.");
          return;
        }
        rim.closest(".redazione-articolo").remove();
        return;
      }

      if (e.target.id === "redazione-aggiungi-articolo") {
        const c = document.getElementById("redazione-articoli");
        const n = c.querySelectorAll(".redazione-articolo").length + 1;
        c.insertAdjacentHTML("beforeend", renderRigaArticolo({ numero: n, rubrica: "", testo: "" }, n));
        return;
      }

      if (e.target.id === "redazione-elimina-corrente" && idInModifica) {
        const atto = atti.find(a => a.id === idInModifica);
        if (atto && confirm(`Eliminare "${atto.titolo}"?`)) {
          if (await eliminaAtto(idInModifica)) vai("menu");
        }
        return;
      }
    });

    root.addEventListener("submit", async e => {
      if (e.target.id !== "redazione-form") return;
      e.preventDefault();
      if (!document.getElementById("f-titolo").value.trim()) {
        alert("Inserisci almeno il titolo dell'atto.");
        return;
      }
      const atto = raccogliAtto();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Salvataggio…";
      const ok = await salvaAtto(atto);
      btn.disabled = false; btn.textContent = "💾 Salva sul database";
      if (ok) {
        vai("editor", atto);
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

  /* ---------- AVVIO REDAZIONE (ex-init) ---------- */

  async function avviaRedazione() {
    initEventi();

    try {
      atti = await API.loadAtti();
    } catch (e) {
      alert("Errore nel caricamento degli atti: " + e.message);
      atti = [];
    }

    vai("menu");
  }

  /* ---------- INIT ---------- */

  async function init() {
    // Testata e footer sempre visibili (anche durante il login)
    renderTestata("redazione");
    renderFooter();

    setupLoginUI();

    if (API.isAuthenticated()) {
      // ripristina il nome utente mostrato in topbar
      const saved = (() => { try { return sessionStorage.getItem('fz_user'); } catch (e) { return null; } })();
      const label = document.getElementById('adminUsernameLabel');
      if (label && saved) label.textContent = saved;

      mostraAdmin();
      await avviaRedazione();
    } else {
      mostraLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
