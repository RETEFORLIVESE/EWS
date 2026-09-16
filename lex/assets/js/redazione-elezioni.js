// assets/js/redazione-elezioni.js
(function () {
  let vista = "menu";
  let idInModifica = null;
  let elezioni = [];
  let bozza = null;
  let contatore = 1; // per generare id stabili di soggetti/circoscrizioni all'interno di una bozza

  const PALETTE = ["#12508c", "#c9302c", "#1c7a34", "#c9a227", "#7b4397", "#e07b39", "#1b5fa8", "#8a1f24", "#0b7285", "#93650b"];

  const slugify = t => (t || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  const escapeHtml = t => (t || "").toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function idUnivoco(base, escludi) {
    let c = base || "elezione", n = 2;
    while (elezioni.some(e => e.id === c && e.id !== escludi)) c = `${base}-${n++}`;
    return c;
  }

  function nuovoId(prefisso) { return `${prefisso}-${contatore++}`; }

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
        await APIElezioni.login(u, p);
        try { sessionStorage.setItem('fz_user_elezioni', u); } catch (e) {}
        if (label) label.textContent = u;
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
        APIElezioni.clearCredentials();
        try { sessionStorage.removeItem('fz_user_elezioni'); } catch (e) {}
        location.reload();
      });
    }
  }

  /* ---------- MODELLO BOZZA ---------- */

  function nuovaBozza() {
    return {
      id: null,
      tipo: "carica_unica",
      titolo: "",
      sottotitolo: "",
      data: "",
      stato: "programmata",
      candidati: [],
      liste: [],
      circoscrizioni: []
    };
  }

  function bozzaDaElezione(e) {
    return {
      id: e.id,
      tipo: e.tipo,
      titolo: e.titolo || "",
      sottotitolo: e.sottotitolo || "",
      data: e.data || "",
      stato: e.stato || "programmata",
      candidati: (e.candidati || []).map(s => ({ ...s })),
      liste: (e.liste || []).map(s => ({ ...s })),
      circoscrizioni: (e.circoscrizioni || []).map(c => ({ ...c, voti: { ...(c.voti || {}) } }))
    };
  }

  function nuovoSoggetto(indiceEsistenti) {
    return { id: nuovoId("s"), nome: "", partito: "", colore: PALETTE[indiceEsistenti % PALETTE.length] };
  }

  function nuovaCirc() {
    return { id: nuovoId("c"), nome: "", aventiDiritto: "", votanti: "", seggi: "", voti: {} };
  }

  /* ---------- VISTE ---------- */

  const ETICHETTE_STATO = { programmata: "programmata", in_corso: "scrutinio in corso", chiusa: "scrutinio chiuso", definitiva: "risultato definitivo" };
  const ETICHETTE_TIPO = { carica_unica: "Carica unica", assemblea: "Assemblea" };

  function renderMenu() {
    return `
      <p class="breadcrumb"><a href="elezioni.html">Elezioni</a> &rsaquo; Redazione</p>
      <h1 style="margin-bottom:4px;">Redazione elettorale</h1>
      <p style="color:var(--inchiostro-tenue); max-width:60ch; margin-top:0;">
        Le modifiche vengono salvate sul database elettorale condiviso: saranno visibili subito a tutti gli utenti del sito.
      </p>
      <div class="redazione-menu" style="grid-template-columns:repeat(2,1fr);">
        <button type="button" class="redazione-card" data-azione="nuovo">
          <span class="redazione-card__numero">1</span>
          <span class="redazione-card__titolo">Nuova consultazione</span>
          <span class="redazione-card__desc">Crea un'elezione a carica unica o un'assemblea da zero.</span>
        </button>
        <button type="button" class="redazione-card" data-azione="carica">
          <span class="redazione-card__numero">2</span>
          <span class="redazione-card__titolo">Gestisci esistenti</span>
          <span class="redazione-card__desc">Modifica stato, candidati/liste e voti di una consultazione già creata.</span>
        </button>
      </div>
      <p id="redazione-messaggio" class="redazione-messaggio" style="display:none;"></p>
      <p style="margin-top:20px; color:var(--inchiostro-tenue); font-size:0.85rem;">
        Consultazioni nel database: <strong>${elezioni.length}</strong>
      </p>`;
  }

  function renderCarica() {
    const lista = [...elezioni].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    const righe = lista.map(e => `
      <div class="redazione-riga" data-id="${escapeHtml(e.id)}">
        <div>
          <span class="badge-tipo">${ETICHETTE_TIPO[e.tipo] || e.tipo}</span>
          <span class="badge-stato stato-${e.stato}">${ETICHETTE_STATO[e.stato] || e.stato}</span>
          <p class="redazione-riga__titolo">${escapeHtml(e.titolo)}</p>
          <p class="redazione-riga__meta">${escapeHtml(e.data || "")} &middot; ${(e.circoscrizioni || []).length} circoscrizioni</p>
        </div>
        <div class="redazione-riga__azioni">
          <a class="redazione-btn redazione-btn--piccolo redazione-btn--secondario" href="risultato.html?id=${encodeURIComponent(e.id)}" target="_blank">Vedi risultato</a>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-modifica="${escapeHtml(e.id)}">Modifica</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-elimina="${escapeHtml(e.id)}">Elimina</button>
        </div>
      </div>`).join("");

    return `
      <p class="breadcrumb"><a href="elezioni.html">Elezioni</a> &rsaquo; <a href="redazione-elezioni.html">Redazione</a> &rsaquo; Gestisci esistenti</p>
      <h1>Gestisci consultazioni</h1>
      <input type="text" id="redazione-filtro" placeholder="Filtra per titolo…" style="width:100%; max-width:420px; padding:10px 14px; border:1px solid var(--bordo); border-radius:var(--radius); font-family:var(--font-chrome); margin-bottom:16px;" />
      <div id="redazione-elenco-carica">${righe || "<p>Nessuna consultazione presente.</p>"}</div>
      <p style="margin-top:20px;"><button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">&larr; Torna al menu</button></p>`;
  }

  function etichettaSoggettoLabel(s) {
    return `<span class="soggetto-label" data-soggetto-id="${escapeHtml(s.id)}">${escapeHtml(s.nome || "(senza nome)")}</span>`;
  }

  function renderEditor() {
    const isCarica = bozza.tipo === "carica_unica";
    const soggetti = isCarica ? bozza.candidati : bozza.liste;
    const etichetta = isCarica ? "Candidato" : "Lista";

    const righeSoggetti = soggetti.map((s, i) => `
      <div class="redazione-articolo" data-soggetto-idx="${i}">
        <div class="redazione-articolo__intestazione">
          <span>${etichetta} ${i + 1}</span>
          <input type="color" class="redazione-soggetto-colore soggetto-colore" data-idx="${i}" value="${s.colore}" title="Colore" />
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-soggetto="${i}">Rimuovi</button>
        </div>
        <div class="redazione-riga-campi">
          <input type="text" class="soggetto-nome" data-idx="${i}" placeholder="Nome ${etichetta.toLowerCase()}" value="${escapeHtml(s.nome)}" />
          ${isCarica ? `<input type="text" class="soggetto-partito" data-idx="${i}" placeholder="Partito / coalizione (facoltativo)" value="${escapeHtml(s.partito || "")}" />` : ""}
        </div>
      </div>`).join("");

    const righeCirc = bozza.circoscrizioni.map((c, ci) => `
      <div class="redazione-articolo" data-circ-idx="${ci}">
        <div class="redazione-articolo__intestazione">
          <span>Circoscrizione ${ci + 1}</span>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-circ="${ci}" style="margin-left:auto;">Rimuovi</button>
        </div>
        <div class="redazione-riga-campi">
          <input type="text" class="circ-nome" data-idx="${ci}" placeholder="Nome circoscrizione" value="${escapeHtml(c.nome)}" />
          <input type="number" min="0" class="circ-aventi" data-idx="${ci}" placeholder="Aventi diritto" value="${c.aventiDiritto ?? ""}" />
          <input type="number" min="0" class="circ-votanti" data-idx="${ci}" placeholder="Votanti" value="${c.votanti ?? ""}" />
          ${!isCarica ? `<input type="number" min="0" class="circ-seggi" data-idx="${ci}" placeholder="Seggi in palio" value="${c.seggi ?? ""}" />` : ""}
        </div>
        ${soggetti.length ? `
        <div class="redazione-riga-campi" style="margin-top:4px;">
          ${soggetti.map(s => `
            <div class="redazione-campo">
              <label>Voti — ${etichettaSoggettoLabel(s)}</label>
              <input type="number" min="0" class="circ-voto" data-circ-idx="${ci}" data-soggetto-id="${escapeHtml(s.id)}" value="${c.voti[s.id] ?? 0}" />
            </div>`).join("")}
        </div>` : `<p style="color:var(--inchiostro-tenue); font-size:.85rem;">Aggiungi almeno un ${etichetta.toLowerCase()} per poter inserire i voti.</p>`}
      </div>`).join("");

    return `
      <p class="breadcrumb"><a href="elezioni.html">Elezioni</a> &rsaquo; <a href="redazione-elezioni.html">Redazione</a> &rsaquo; ${bozza.id ? "Modifica" : "Nuova"} consultazione</p>
      <h1>${bozza.id ? "Modifica consultazione" : "Nuova consultazione"}</h1>
      <p id="redazione-messaggio" class="redazione-messaggio" style="display:none;"></p>
      <form id="redazione-form" class="redazione-form" novalidate>
        <div class="redazione-campo"><label for="f-titolo">Titolo della consultazione</label><input type="text" id="f-titolo" required value="${escapeHtml(bozza.titolo)}" /></div>
        <div class="redazione-campo"><label for="f-sottotitolo">Sottotitolo / descrizione breve</label><input type="text" id="f-sottotitolo" value="${escapeHtml(bozza.sottotitolo)}" /></div>
        <div class="redazione-riga-campi">
          <div class="redazione-campo">
            <label for="f-tipo">Tipo di elezione</label>
            <select id="f-tipo">
              <option value="carica_unica" ${isCarica ? "selected" : ""}>Carica unica (candidati)</option>
              <option value="assemblea" ${!isCarica ? "selected" : ""}>Assemblea (liste e seggi)</option>
            </select>
          </div>
          <div class="redazione-campo"><label for="f-data">Data</label><input type="text" id="f-data" placeholder="es. 15 novembre 2026" value="${escapeHtml(bozza.data)}" /></div>
          <div class="redazione-campo">
            <label for="f-stato">Stato</label>
            <select id="f-stato">
              <option value="programmata" ${bozza.stato === "programmata" ? "selected" : ""}>Programmata</option>
              <option value="in_corso" ${bozza.stato === "in_corso" ? "selected" : ""}>Scrutinio in corso</option>
              <option value="chiusa" ${bozza.stato === "chiusa" ? "selected" : ""}>Scrutinio chiuso</option>
              <option value="definitiva" ${bozza.stato === "definitiva" ? "selected" : ""}>Risultato definitivo</option>
            </select>
          </div>
        </div>

        <h2 class="sezione-titolo" style="font-size:.85rem; margin-top:30px;">${isCarica ? "Candidati" : "Liste"}</h2>
        <div id="redazione-soggetti">${righeSoggetti || "<p>Nessuno inserito.</p>"}</div>
        <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-soggetto">+ Aggiungi ${etichetta.toLowerCase()}</button>

        <h2 class="sezione-titolo" style="font-size:.85rem; margin-top:30px;">Circoscrizioni e voti</h2>
        <p style="color:var(--inchiostro-tenue); font-size:.85rem; margin-top:-8px;">
          ${isCarica
            ? "I voti di ogni circoscrizione vengono sommati per determinare il totale nazionale."
            : "I seggi vengono calcolati automaticamente per ciascuna circoscrizione con il metodo del quoziente e dei resti più alti, poi sommati a livello nazionale."}
        </p>
        <div id="redazione-circoscrizioni">${righeCirc || "<p>Nessuna circoscrizione inserita.</p>"}</div>
        <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-circ">+ Aggiungi circoscrizione</button>

        <div class="redazione-azioni-form">
          <button type="submit" class="redazione-btn redazione-btn--primario">💾 Salva sul database</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">Annulla</button>
          ${bozza.id ? `<button type="button" class="redazione-btn redazione-btn--pericolo" id="redazione-elimina-corrente">Elimina questa consultazione</button>` : ""}
        </div>
      </form>`;
  }

  /* ---------- SALVATAGGIO ---------- */

  function raccogliElezioneFinale() {
    const idBase = slugify(bozza.titolo) || "elezione";
    return {
      id: idUnivoco(idBase, idInModifica),
      tipo: bozza.tipo,
      titolo: bozza.titolo,
      sottotitolo: bozza.sottotitolo,
      data: bozza.data,
      stato: bozza.stato,
      candidati: bozza.candidati.map(s => ({ id: s.id, nome: s.nome, partito: s.partito, colore: s.colore })),
      liste: bozza.liste.map(s => ({ id: s.id, nome: s.nome, colore: s.colore })),
      circoscrizioni: bozza.circoscrizioni.map(c => ({
        id: c.id,
        nome: c.nome,
        aventiDiritto: Number(c.aventiDiritto) || 0,
        votanti: Number(c.votanti) || 0,
        seggi: Number(c.seggi) || 0,
        voti: Object.fromEntries(Object.entries(c.voti || {}).map(([k, v]) => [k, Number(v) || 0]))
      }))
    };
  }

  async function salvaElezione(elezione) {
    const copia = elezioni.filter(e => e.id !== idInModifica && e.id !== elezione.id);
    copia.push(elezione);
    try {
      await APIElezioni.saveElezioni(copia);
      elezioni = copia;
      return true;
    } catch (e) {
      mostraMessaggio("Errore salvataggio: " + e.message);
      return false;
    }
  }

  async function eliminaElezione(id) {
    const copia = elezioni.filter(e => e.id !== id);
    try {
      await APIElezioni.saveElezioni(copia);
      elezioni = copia;
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
    else if (vista === "editor") {
      if (extra !== undefined) {
        idInModifica = extra ? extra.id : null;
        bozza = extra ? bozzaDaElezione(extra) : nuovaBozza();
      }
      root.innerHTML = renderEditor();
    }
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
        const el = elezioni.find(x => x.id === mod.getAttribute("data-modifica"));
        if (el) vai("editor", el);
        return;
      }

      const del = e.target.closest("[data-elimina]");
      if (del) {
        const id = del.getAttribute("data-elimina");
        const el = elezioni.find(x => x.id === id);
        if (el && confirm(`Eliminare "${el.titolo}"? L'operazione non è reversibile.`)) {
          if (await eliminaElezione(id)) vai("carica");
        }
        return;
      }

      // Aggiungi candidato/lista
      if (e.target.id === "redazione-aggiungi-soggetto") {
        const soggetti = bozza.tipo === "carica_unica" ? bozza.candidati : bozza.liste;
        soggetti.push(nuovoSoggetto(soggetti.length));
        vai("editor");
        return;
      }

      // Rimuovi candidato/lista
      const rimSogg = e.target.closest("[data-rimuovi-soggetto]");
      if (rimSogg) {
        const idx = Number(rimSogg.getAttribute("data-rimuovi-soggetto"));
        const soggetti = bozza.tipo === "carica_unica" ? bozza.candidati : bozza.liste;
        const rimosso = soggetti.splice(idx, 1)[0];
        if (rimosso) bozza.circoscrizioni.forEach(c => { delete c.voti[rimosso.id]; });
        vai("editor");
        return;
      }

      // Aggiungi circoscrizione
      if (e.target.id === "redazione-aggiungi-circ") {
        bozza.circoscrizioni.push(nuovaCirc());
        vai("editor");
        return;
      }

      // Rimuovi circoscrizione
      const rimCirc = e.target.closest("[data-rimuovi-circ]");
      if (rimCirc) {
        const idx = Number(rimCirc.getAttribute("data-rimuovi-circ"));
        bozza.circoscrizioni.splice(idx, 1);
        vai("editor");
        return;
      }

      if (e.target.id === "redazione-elimina-corrente" && idInModifica) {
        const el = elezioni.find(x => x.id === idInModifica);
        if (el && confirm(`Eliminare "${el.titolo}"? L'operazione non è reversibile.`)) {
          if (await eliminaElezione(idInModifica)) vai("menu");
        }
        return;
      }
    });

    root.addEventListener("change", e => {
      if (e.target.id === "f-tipo") { bozza.tipo = e.target.value; vai("editor"); return; }
      if (e.target.id === "f-stato") { bozza.stato = e.target.value; return; }

      if (e.target.classList.contains("soggetto-colore")) {
        const idx = Number(e.target.dataset.idx);
        const soggetti = bozza.tipo === "carica_unica" ? bozza.candidati : bozza.liste;
        if (soggetti[idx]) soggetti[idx].colore = e.target.value;
        return;
      }
    });

    root.addEventListener("input", e => {
      if (e.target.id === "f-titolo") { bozza.titolo = e.target.value; return; }
      if (e.target.id === "f-sottotitolo") { bozza.sottotitolo = e.target.value; return; }
      if (e.target.id === "f-data") { bozza.data = e.target.value; return; }

      if (e.target.classList.contains("soggetto-nome")) {
        const idx = Number(e.target.dataset.idx);
        const soggetti = bozza.tipo === "carica_unica" ? bozza.candidati : bozza.liste;
        if (soggetti[idx]) {
          soggetti[idx].nome = e.target.value;
          document.querySelectorAll(`.soggetto-label[data-soggetto-id="${soggetti[idx].id}"]`)
            .forEach(el => { el.textContent = e.target.value || "(senza nome)"; });
        }
        return;
      }
      if (e.target.classList.contains("soggetto-partito")) {
        const idx = Number(e.target.dataset.idx);
        const soggetti = bozza.tipo === "carica_unica" ? bozza.candidati : bozza.liste;
        if (soggetti[idx]) soggetti[idx].partito = e.target.value;
        return;
      }

      if (e.target.classList.contains("circ-nome")) {
        const idx = Number(e.target.dataset.idx);
        if (bozza.circoscrizioni[idx]) bozza.circoscrizioni[idx].nome = e.target.value;
        return;
      }
      if (e.target.classList.contains("circ-aventi")) {
        const idx = Number(e.target.dataset.idx);
        if (bozza.circoscrizioni[idx]) bozza.circoscrizioni[idx].aventiDiritto = e.target.value;
        return;
      }
      if (e.target.classList.contains("circ-votanti")) {
        const idx = Number(e.target.dataset.idx);
        if (bozza.circoscrizioni[idx]) bozza.circoscrizioni[idx].votanti = e.target.value;
        return;
      }
      if (e.target.classList.contains("circ-seggi")) {
        const idx = Number(e.target.dataset.idx);
        if (bozza.circoscrizioni[idx]) bozza.circoscrizioni[idx].seggi = e.target.value;
        return;
      }
      if (e.target.classList.contains("circ-voto")) {
        const ci = Number(e.target.dataset.circIdx);
        const soggId = e.target.dataset.soggettoId;
        if (bozza.circoscrizioni[ci]) bozza.circoscrizioni[ci].voti[soggId] = Number(e.target.value) || 0;
        return;
      }

      if (e.target.id === "redazione-filtro") {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll("#redazione-elenco-carica .redazione-riga").forEach(r => {
          r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      }
    });

    root.addEventListener("submit", async e => {
      if (e.target.id !== "redazione-form") return;
      e.preventDefault();
      if (!bozza.titolo.trim()) {
        alert("Inserisci almeno il titolo della consultazione.");
        return;
      }
      const elezioneFinale = raccogliElezioneFinale();
      const btn = e.target.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Salvataggio…";
      const ok = await salvaElezione(elezioneFinale);
      btn.disabled = false; btn.textContent = "💾 Salva sul database";
      if (ok) {
        idInModifica = elezioneFinale.id;
        vai("editor", elezioneFinale);
        mostraMessaggio("✅ Salvato sul database. Sarà visibile subito sul sito pubblico.");
      }
    });
  }

  /* ---------- AVVIO REDAZIONE ---------- */

  async function avviaRedazione() {
    initEventi();
    try {
      elezioni = await APIElezioni.loadElezioni();
    } catch (e) {
      alert("Errore nel caricamento delle elezioni: " + e.message);
      elezioni = [];
    }
    vai("menu");
  }

  /* ---------- INIT ---------- */

  async function init() {
    renderTestata("elezioni");
    renderFooter();

    setupLoginUI();

    if (APIElezioni.isAuthenticated()) {
      const saved = (() => { try { return sessionStorage.getItem('fz_user_elezioni'); } catch (e) { return null; } })();
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
