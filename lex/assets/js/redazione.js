// assets/js/redazione.js
(function () {
  let vista = "menu";
  let idInModifica = null;
  let atti = [];
  let luoghi = {}; // { codice: "Nome visualizzato" }, letti da /api/organi

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

  const ETICHETTE_TIPO_LUOGO = {
    assemblea: "Assemblea",
    distretto: "Distretto",
    citta_metropolitana: "Città metropolitana",
    cittametropolitana: "Città metropolitana",
    congresso: "Congresso",
    citta: "Città",
    regione: "Regione"
  };

  // I valori dentro "luoghi" possono essere una semplice stringa oppure un oggetto
  // tipo { nome: "Roma", tipo: "citta_metropolitana" }. Qui estraiamo sempre un testo leggibile.
  function descrizioneLuogo(valore) {
    if (!valore) return "";
    if (typeof valore === "string") return valore;
    if (typeof valore === "object") {
      const nome = valore.nome || valore.nome_display || valore.citta || valore.nomeCitta || valore.label || valore.title || "";
      const tipoGrezzo = (valore.tipo || valore.categoria || "").toString().toLowerCase();
      const tipo = ETICHETTE_TIPO_LUOGO[tipoGrezzo] || (tipoGrezzo ? tipoGrezzo : "");
      if (nome && tipo) return `${nome} (${tipo})`;
      if (nome) return nome;
      const primaStringa = Object.values(valore).find(v => typeof v === "string" && v.trim() !== "");
      if (primaStringa) return primaStringa;
    }
    return String(valore);
  }

  // "luoghi" può essere raggruppato, ad esempio:
  //   { livello_statale: { TALEEN: "Taleen", ... }, citta_principali: { ... } }
  // I nomi dei gruppi (livello_statale, citta_principali...) NON sono luoghi: nell'atto va salvato
  // l'ID della singola voce (TALEEN), mai il nome del gruppo.
  const CAMPI_NOME_LUOGO = ["nome", "nome_display", "citta", "nomeCitta", "label", "title"];

  // Una voce è una stringa oppure un oggetto con un campo nome; ogni altro oggetto è un gruppo.
  function eVoceLuogo(v) {
    if (typeof v === "string") return true;
    return v !== null && typeof v === "object" && !Array.isArray(v) && CAMPI_NOME_LUOGO.some(c => typeof v[c] === "string");
  }
  function eGruppoLuogo(v) {
    return v !== null && typeof v === "object" && !Array.isArray(v) && !eVoceLuogo(v);
  }

  const etichettaGruppo = chiave => {
    const t = (chiave || "").toString().replace(/_/g, " ");
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  // Elenco piatto di tutte le voci, a qualsiasi profondità, senza doppioni:
  // [{ id, testo, gruppo }] dove "gruppo" è il percorso leggibile (es. "Assemblee quartieri › Forli").
  function elencoLuoghi() {
    const risultato = [];
    const visti = new Set();
    (function scorri(contenitore, percorso) {
      Object.keys(contenitore || {}).forEach(chiave => {
        const v = contenitore[chiave];
        if (eVoceLuogo(v)) {
          if (!visti.has(chiave)) {
            visti.add(chiave);
            risultato.push({ id: chiave, testo: descrizioneLuogo(v), gruppo: percorso.map(etichettaGruppo).join(" › ") });
          }
        } else if (eGruppoLuogo(v)) {
          scorri(v, [...percorso, chiave]);
        }
      });
    })(luoghi, []);
    return risultato;
  }

  function esisteGruppoLuogo(chiaveCercata) {
    return (function cerca(contenitore) {
      return Object.keys(contenitore || {}).some(chiave => {
        const v = contenitore[chiave];
        return eGruppoLuogo(v) && (chiave === chiaveCercata || cerca(v));
      });
    })(luoghi);
  }

  function opzioniLuogo(luogoSelezionato) {
    const voci = elencoLuoghi();
    const opzione = l =>
      `<option value="${escapeHtml(l.id)}" ${l.id === luogoSelezionato ? "selected" : ""}>${escapeHtml(l.testo)}</option>`;

    let html = `<option value="">-- Nessun luogo --</option>`;
    html += voci.filter(l => !l.gruppo).map(opzione).join("");
    [...new Set(voci.filter(l => l.gruppo).map(l => l.gruppo))].forEach(g => {
      html += `<optgroup label="${escapeHtml(g)}">${voci.filter(l => l.gruppo === g).map(opzione).join("")}</optgroup>`;
    });

    // Valore salvato che non corrisponde a nessun luogo: lo mostriamo comunque, ben segnalato,
    // così non passa inosservato (capita se in passato è stato salvato il nome di un gruppo).
    if (luogoSelezionato && !voci.some(l => l.id === luogoSelezionato)) {
      const nota = esisteGruppoLuogo(luogoSelezionato)
        ? "è un gruppo, non un luogo: scegli una voce dall'elenco"
        : "non più nell'elenco";
      html += `<option value="${escapeHtml(luogoSelezionato)}" selected>${escapeHtml(luogoSelezionato)} (${nota})</option>`;
    }
    return html;
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
  err.classList.add('show');
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

  /* ---------- COMMI E SOTTOCOMMI (editor) ---------- */

  function renderSottocomma(testo, iSotto) {
    return `
      <div class="redazione-sottocomma">
        <span class="redazione-sottocomma__lettera">${letteraDa(iSotto)})</span>
        <textarea class="redazione-sottocomma-testo" rows="1" placeholder="Testo del sottocomma">${escapeHtml(testo)}</textarea>
        <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-sottocomma title="Rimuovi sottocomma">✕</button>
      </div>`;
  }

  function renderComma(comma, iComma) {
    const sottocommi = (comma.sottocommi || []).map((s, iSotto) => renderSottocomma(s, iSotto)).join("");
    return `
      <div class="redazione-comma">
        <div class="redazione-comma__intestazione">
          <span class="redazione-comma__numero">Comma ${iComma + 1}</span>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-aggiungi-sottocomma>+ sottocomma</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-comma style="margin-left:auto;">Rimuovi comma</button>
        </div>
        <textarea class="redazione-comma-testo" placeholder="Testo del comma" rows="2">${escapeHtml(comma.testo)}</textarea>
        <div class="redazione-sottocommi">${sottocommi}</div>
      </div>`;
  }

  // Legge lo stato attuale dei commi/sottocommi direttamente dal DOM di un articolo.
  function raccogliCommiDalDOM(articoloEl) {
    return [...articoloEl.querySelectorAll(":scope > .redazione-commi > .redazione-comma")].map(commaEl => ({
      testo: commaEl.querySelector(".redazione-comma-testo").value,
      sottocommi: [...commaEl.querySelectorAll(".redazione-sottocomma-testo")].map(t => t.value)
    }));
  }

  function renderRigaArticolo(art, i) {
    const commi = commiDiArticolo(art);
    const commiHtml = commi.map((c, ic) => renderComma(c, ic)).join("");
    return `
      <div class="redazione-articolo" data-indice="${i}">
        <div class="redazione-articolo__intestazione">
          <span>Articolo</span>
          <input type="text" class="redazione-art-numero" value="${escapeHtml(art.numero)}" style="width:70px;" />
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-articolo="${i}" style="margin-left:auto;">Rimuovi articolo</button>
        </div>
        <input type="text" class="redazione-art-rubrica" placeholder="Rubrica dell'articolo" value="${escapeHtml(art.rubrica)}" />
        <div class="redazione-commi">${commiHtml}</div>
        <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-aggiungi-comma>+ Aggiungi comma</button>
        <details class="redazione-strumento-analisi">
          <summary>Strumento: suddividi automaticamente un testo incollato</summary>
          <p style="font-size:.82rem;color:var(--inchiostro-tenue);margin:6px 0;">
            Incolla qui il testo completo dell'articolo, un comma o sottocomma per riga
            (es. "1. Testo del comma", "a) testo del sottocomma"). Verrà suddiviso automaticamente,
            <strong>sostituendo</strong> i commi attualmente presenti qui sopra.
          </p>
          <textarea class="redazione-analisi-testo" rows="4" placeholder="1. Testo del primo comma...&#10;a) primo sottocomma&#10;b) secondo sottocomma&#10;2. Testo del secondo comma..."></textarea>
          <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-analizza-testo>Suddividi automaticamente</button>
        </details>
      </div>`;
  }

  function renderEditor(atto) {
    idInModifica = atto ? atto.id : null;
    const articoli = atto ? atto.articoli.map(a => ({ ...a })) : [{ numero: 1, rubrica: "", commi: [{ testo: "", sottocommi: [] }] }];
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
          <div class="redazione-campo">
            <label for="f-luogo">Luogo</label>
            <select id="f-luogo">${opzioniLuogo(atto ? atto.luogo : "")}</select>
          </div>
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
      commi: raccogliCommiDalDOM(el).map(c => ({
        testo: c.testo.trim(),
        sottocommi: c.sottocommi.map(s => s.trim()).filter(s => s !== "")
      })),
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
      luogo: document.getElementById("f-luogo").value,
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
        c.insertAdjacentHTML("beforeend", renderRigaArticolo({ numero: n, rubrica: "", commi: [{ testo: "", sottocommi: [] }] }, n));
        return;
      }

      // ---- Aggiungi comma a un articolo ----
      const aggComma = e.target.closest("[data-aggiungi-comma]");
      if (aggComma) {
        const articoloEl = aggComma.closest(".redazione-articolo");
        const commi = raccogliCommiDalDOM(articoloEl);
        commi.push({ testo: "", sottocommi: [] });
        articoloEl.querySelector(".redazione-commi").innerHTML =
          commi.map((c, ic) => renderComma(c, ic)).join("");
        return;
      }

      // ---- Rimuovi comma ----
      const rimComma = e.target.closest("[data-rimuovi-comma]");
      if (rimComma) {
        const articoloEl = rimComma.closest(".redazione-articolo");
        if (articoloEl.querySelectorAll(".redazione-comma").length <= 1) {
          alert("Deve rimanere almeno un comma per articolo.");
          return;
        }
        rimComma.closest(".redazione-comma").remove();
        // Rinumera le etichette "Comma N" rimaste, preservando i testi già inseriti.
        const commi = raccogliCommiDalDOM(articoloEl);
        articoloEl.querySelector(".redazione-commi").innerHTML =
          commi.map((c, ic) => renderComma(c, ic)).join("");
        return;
      }

      // ---- Aggiungi sottocomma a un comma ----
      const aggSotto = e.target.closest("[data-aggiungi-sottocomma]");
      if (aggSotto) {
        const commaEl = aggSotto.closest(".redazione-comma");
        const valori = [...commaEl.querySelectorAll(".redazione-sottocomma-testo")].map(t => t.value);
        valori.push("");
        commaEl.querySelector(".redazione-sottocommi").innerHTML =
          valori.map((v, iv) => renderSottocomma(v, iv)).join("");
        return;
      }

      // ---- Rimuovi sottocomma ----
      const rimSotto = e.target.closest("[data-rimuovi-sottocomma]");
      if (rimSotto) {
        const commaEl = rimSotto.closest(".redazione-comma");
        rimSotto.closest(".redazione-sottocomma").remove();
        // Rilettera i sottocommi rimasti (a, b, c...), preservando i testi.
        const valori = [...commaEl.querySelectorAll(".redazione-sottocomma-testo")].map(t => t.value);
        commaEl.querySelector(".redazione-sottocommi").innerHTML =
          valori.map((v, iv) => renderSottocomma(v, iv)).join("");
        return;
      }

      // ---- Suddividi automaticamente un testo incollato ----
      const analizza = e.target.closest("[data-analizza-testo]");
      if (analizza) {
        const articoloEl = analizza.closest(".redazione-articolo");
        const ta = articoloEl.querySelector(".redazione-analisi-testo");
        const testo = ta.value.trim();
        if (!testo) {
          alert("Incolla prima il testo da suddividere.");
          return;
        }
        if (!confirm("Questo sostituirà i commi attualmente presenti in questo articolo. Continuare?")) return;
        const commi = analizzaTesto(testo);
        articoloEl.querySelector(".redazione-commi").innerHTML =
          commi.map((c, ic) => renderComma(c, ic)).join("");
        ta.value = "";
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

    try {
      const risposta = await fetch('/api/organi', { cache: 'no-store' });
      if (risposta.ok) {
        const dati = await risposta.json();
        luoghi = (dati && dati.luoghi) || {};
      } else {
        luoghi = {};
      }
    } catch (e) {
      luoghi = {}; // non bloccante: il menu a tendina resterà vuoto/con solo il valore esistente
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
