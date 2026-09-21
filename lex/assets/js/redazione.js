// assets/js/redazione.js
(function () {
  let vista = "menu";
  let idInModifica = null;
  let atti = [];

  // ---- Luoghi collegabili all'atto: letti da organi.json (repo pubblico
  // RETEFORLIVESE/DATA), alla voce "luoghi". Non richiedono login: si legge
  // il raw file direttamente dal browser, stesso repo dove vive atti.json.
  const URL_ORGANI_JSON = "https://raw.githubusercontent.com/RETEFORLIVESE/DATA/main/organi.json";
  const ETICHETTE_CATEGORIE_LUOGHI = {
    livello_federale: "Livello federale",
    livello_statale: "Livello statale",
    citta_principali: "Città principali",
    distretti: "Distretti",
    assemblee_locali: "Assemblee locali",
    regione: "Regioni",
    organi: "Organi"
  };
  let luoghiDisponibili = []; // [{ codice, nome, categoria }]

  // Una voce di organi.json > luoghi > <categoria> > <codice> può essere una
  // semplice stringa (il nome) oppure un oggetto { nome, tipo }.
  function normalizzaLuogo(codice, voce) {
    if (typeof voce === "string") return { codice, nome: voce };
    if (voce && typeof voce === "object") return { codice, nome: voce.nome || codice };
    return { codice, nome: codice };
  }

  async function caricaLuoghi() {
    try {
      const res = await fetch(URL_ORGANI_JSON, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const dati = await res.json();
      const luoghi = (dati && dati.luoghi) || {};
      const elenco = [];
      for (const [chiaveCategoria, valoreCategoria] of Object.entries(luoghi)) {
        if (!valoreCategoria || typeof valoreCategoria !== "object") continue; // salta voci non a elenco (es. "Unione": "Unione")
        for (const [codice, voce] of Object.entries(valoreCategoria)) {
          elenco.push({ ...normalizzaLuogo(codice, voce), categoria: chiaveCategoria });
        }
      }
      return elenco;
    } catch (e) {
      console.error("Errore nel caricamento dei luoghi da organi.json:", e);
      return [];
    }
  }

  const slugify = t => (t || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  const escapeHtml = t => (t || "").toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Indirizzo dell'immagine dell'atto: accetta link http(s) (o //...) e percorsi
  // relativi alla cartella del sito (es. "immagini/stemma.png"); scarta qualunque
  // altro schema (javascript:, data:, ...). Stessa regola usata in atto.js.
  function urlImmagineSicuro(valore) {
    const u = (valore || "").toString().trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }

  function aggiornaAnteprimaImmagine() {
    const campo = document.getElementById("f-immagine");
    const box = document.getElementById("f-immagine-anteprima");
    if (!campo || !box) return;
    const grezzo = campo.value.trim();
    const src = urlImmagineSicuro(grezzo);
    if (!grezzo) {
      box.innerHTML = "";
      box.style.display = "none";
      return;
    }
    box.style.display = "block";
    if (!src) {
      box.innerHTML = '<span style="color:#a72e23;font-size:.82rem;">Indirizzo non valido: usa un link http(s) o un percorso del sito.</span>';
      return;
    }
    box.innerHTML = '<img alt="Anteprima" style="width:120px;height:120px;object-fit:contain;background:#fff;border:1px solid var(--bordo);border-radius:var(--radius);" />' +
      '<span class="redazione-anteprima-errore" style="display:none;color:#a72e23;font-size:.82rem;">Immagine non trovata: controlla il percorso o il link.</span>';
    const img = box.querySelector("img");
    const errore = box.querySelector(".redazione-anteprima-errore");
    img.onerror = () => { img.style.display = "none"; errore.style.display = "inline"; };
    img.src = src;
  }

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
        <button type="button" class="redazione-btn redazione-btn--piccolo" data-inserisci-link onmousedown="event.preventDefault()" title="Inserisci un collegamento nel testo selezionato">🔗</button>
        <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-sottocomma title="Rimuovi sottocomma">✕</button>
      </div>`;
  }

  function renderComma(comma, iComma) {
    const sottocommi = (comma.sottocommi || []).map((s, iSotto) => renderSottocomma(s, iSotto)).join("");
    return `
      <div class="redazione-comma">
        <div class="redazione-comma__intestazione">
          <span class="redazione-comma__numero">Comma ${iComma + 1}</span>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-inserisci-link onmousedown="event.preventDefault()" title="Inserisci un collegamento nel testo selezionato">🔗 Link</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-aggiungi-sottocomma>+ sottocomma</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-comma style="margin-left:auto;">Rimuovi comma</button>
        </div>
        <textarea class="redazione-comma-testo" placeholder="Testo del comma" rows="2">${escapeHtml(comma.testo)}</textarea>
        <div class="redazione-sottocommi">${sottocommi}</div>
      </div>`;
  }

  // Chiede all'utente dove deve puntare il collegamento e lo inserisce
  // avvolgendo il testo selezionato nella textarea con un tag <a>.
  //
  // Formati accettati per la destinazione:
  //   - https://... oppure http://...            -> link esterno (si apre in una nuova scheda)
  //   - "1,3" (articolo,comma)                    -> #art-1-c3   (link interno allo stesso atto)
  //   - "1"   (solo articolo)                     -> #art-1
  //   - "#qualcosa"                                -> usato così com'è (avanzato)
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
      "• Riferimento interno ad articolo e comma DI QUESTO ATTO: 1,3  (= art. 1, comma 3)\n" +
      "• Solo articolo: 1  (= art. 1)",
      ""
    );
    if (!destinazione) return;
    const valore = destinazione.trim();

    const mArtComma = valore.match(/^(\d+)\s*,\s*(\d+)$/);
    const mArt = valore.match(/^(\d+)$/);

    let href, attributiExtra = "";
    if (/^https?:\/\//i.test(valore)) {
      href = valore;
      attributiExtra = ' target="_blank" rel="noopener noreferrer"';
    } else if (mArtComma) {
      href = `#art-${mArtComma[1]}-c${mArtComma[2]}`;
    } else if (mArt) {
      href = `#art-${mArt[1]}`;
    } else if (valore.startsWith("#")) {
      href = valore;
    } else {
      alert('Formato non riconosciuto. Usa un indirizzo che inizi con http/https, oppure "articolo,comma" (es. 1,3) o solo "articolo" (es. 1).');
      return;
    }

    const tag = `<a href="${href}"${attributiExtra}>${testoSelezionato}</a>`;
    textarea.value = textarea.value.slice(0, inizio) + tag + textarea.value.slice(fine);

    // Riporta il focus e il cursore subito dopo il collegamento appena inserito.
    const nuovaPosizione = inizio + tag.length;
    textarea.focus();
    textarea.setSelectionRange(nuovaPosizione, nuovaPosizione);
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
      <div class="redazione-articolo redazione-blocco" data-indice="${i}">
        <div class="redazione-articolo__intestazione">
          <span>Articolo</span>
          <input type="text" class="redazione-art-numero" value="${escapeHtml(art.numero)}" style="width:70px;" />
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-sposta="su" title="Sposta su">↑</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-sposta="giu" title="Sposta giù">↓</button>
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

  // Blocco "titolo di gruppo": un'intestazione (es. "TITOLO I — Disposizioni
  // generali") che raggruppa visivamente gli articoli successivi, senza essere
  // essa stessa un articolo numerato. Corrisponde a { tipo: "titolo", testo }
  // nell'array atto.articoli (vedi eTitoloGruppo in formattazione.js).
  function renderRigaTitolo(item, i) {
    return `
      <div class="redazione-titolo-gruppo redazione-blocco" data-indice="${i}">
        <div class="redazione-articolo__intestazione">
          <span>Titolo di gruppo</span>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-sposta="su" title="Sposta su">↑</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-sposta="giu" title="Sposta giù">↓</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-titolo style="margin-left:auto;">Rimuovi</button>
        </div>
        <input type="text" class="redazione-titolo-testo" placeholder='es. "TITOLO I — Disposizioni generali"' value="${escapeHtml(item.testo || "")}" />
      </div>`;
  }

  // Selettore multiplo dei luoghi collegati all'atto: checkbox raggruppate
  // per categoria (come in organi.json), con un campo di filtro testuale.
  // "selezionati" è l'elenco dei codici già salvati sull'atto (se in modifica).
  function renderCampoLuoghi(selezionati) {
    const giaSelezionati = new Set(selezionati || []);

    if (!luoghiDisponibili.length) {
      return `
        <div class="redazione-campo">
          <label>Luoghi collegati</label>
          <p style="color:var(--inchiostro-tenue);font-size:.85rem;margin:4px 0 0;">
            Elenco dei luoghi non disponibile al momento (errore nel caricamento da organi.json).
          </p>
        </div>`;
    }

    const gruppi = {};
    luoghiDisponibili.forEach(l => {
      (gruppi[l.categoria] = gruppi[l.categoria] || []).push(l);
    });

    const html = Object.keys(gruppi).map(cat => {
      const etichetta = ETICHETTE_CATEGORIE_LUOGHI[cat] || cat;
      const righe = gruppi[cat]
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(v => `
          <label class="redazione-luogo-riga" style="display:flex; align-items:center; gap:6px; padding:3px 0; font-weight:400; cursor:pointer;">
            <input type="checkbox" class="redazione-luogo-checkbox" value="${escapeHtml(v.codice)}" ${giaSelezionati.has(v.codice) ? "checked" : ""} />
            <span>${escapeHtml(v.nome)}</span>
            <small style="color:var(--inchiostro-tenue);font-size:.75rem;">${escapeHtml(v.codice)}</small>
          </label>`).join("");
      return `
        <div class="redazione-luoghi-gruppo" data-gruppo-luoghi>
          <strong style="display:block; margin:10px 0 4px; font-family:var(--font-chrome,'Titillium Web',sans-serif); font-size:.78rem; letter-spacing:.04em; text-transform:uppercase; color:var(--blu-800, #0b3d6e);">${escapeHtml(etichetta)}</strong>
          ${righe}
        </div>`;
    }).join("");

    return `
      <div class="redazione-campo">
        <label for="f-luoghi-filtro">Luoghi collegati (facoltativo)</label>
        <input type="text" id="f-luoghi-filtro" placeholder="Filtra per nome o codice…" autocomplete="off" style="margin-bottom:8px;" />
        <div id="redazione-luoghi-lista" style="max-height:260px; overflow-y:auto; border:1px solid var(--bordo, #d6e2ed); border-radius:4px; padding:8px 10px;">
          ${html}
        </div>
        <small style="color:var(--inchiostro-tenue);font-size:.78rem;">
          Seleziona uno o più luoghi a cui l'atto si applica. L'elenco è letto da organi.json (repo RETEFORLIVESE/DATA).
        </small>
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
        </div>
        <div class="redazione-campo">
          <label for="f-sommario">Sommario (mostrato nell'elenco)</label>
          <textarea id="f-sommario" rows="2">${atto ? escapeHtml(atto.sommario) : ""}</textarea>
        </div>
        <div class="redazione-campo">
          <label for="f-immagine">Immagine dell'atto (facoltativa)</label>
          <input type="text" id="f-immagine" value="${atto ? escapeHtml(atto.immagine || "") : ""}"
                 placeholder="link https://... oppure percorso nella repo, es. immagini/stemma.png" autocomplete="off" />
          <small style="color:var(--inchiostro-tenue);font-size:.78rem;">
            Viene mostrata sopra l'indice, sotto il pannello dei dati generali. Puoi incollare un link
            oppure indicare il percorso di un file già presente nella repository (relativo alla cartella del sito).
          </small>
          <div id="f-immagine-anteprima" style="display:none;margin-top:6px;"></div>
        </div>
        <div class="redazione-campo">
          <label for="f-didascalia">Didascalia dell'immagine (facoltativa)</label>
          <input type="text" id="f-didascalia" value="${atto ? escapeHtml(atto.didascalia || "") : ""}" />
        </div>
        ${renderCampoLuoghi(atto ? atto.luoghi : [])}
        <div class="redazione-campo">
          <label for="f-id">Identificativo URL (id)</label>
          <input type="text" id="f-id" value="${atto ? escapeHtml(atto.id) : ""}" placeholder="generato dal titolo se vuoto" />
        </div>
        <h3>Articoli</h3>
        <div id="redazione-articoli">${articoli.map((a, i) => eTitoloGruppo(a) ? renderRigaTitolo(a, i) : renderRigaArticolo(a, i)).join("")}</div>
        <div class="redazione-riga-campi">
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-articolo">+ Aggiungi articolo</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-titolo">+ Aggiungi titolo di gruppo</button>
        </div>
        <div class="redazione-azioni-form">
          <button type="submit" class="redazione-btn redazione-btn--primario">💾 Salva sul database</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">Annulla</button>
          ${atto ? `<button type="button" class="redazione-btn redazione-btn--pericolo" id="redazione-elimina-corrente">Elimina questo atto</button>` : ""}
        </div>
      </form>`;
  }

  /* ---------- RACCOLTA E SALVATAGGIO ---------- */

  function leggiArticoli() {
    return [...document.querySelectorAll("#redazione-articoli > .redazione-articolo, #redazione-articoli > .redazione-titolo-gruppo")].map(el => {
      if (el.classList.contains("redazione-titolo-gruppo")) {
        return { tipo: "titolo", testo: el.querySelector(".redazione-titolo-testo").value.trim() };
      }
      return {
        numero: el.querySelector(".redazione-art-numero").value.trim() || "1",
        rubrica: el.querySelector(".redazione-art-rubrica").value.trim(),
        commi: raccogliCommiDalDOM(el).map(c => ({
          testo: c.testo.trim(),
          sottocommi: c.sottocommi.map(s => s.trim()).filter(s => s !== "")
        })),
      };
    });
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
      immagine: urlImmagineSicuro(document.getElementById("f-immagine").value),
      didascalia: document.getElementById("f-didascalia").value.trim(),
      luoghi: [...document.querySelectorAll(".redazione-luogo-checkbox:checked")].map(el => el.value),
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
    else if (vista === "editor") { root.innerHTML = renderEditor(extra || null); aggiornaAnteprimaImmagine(); }
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

      if (e.target.id === "redazione-aggiungi-titolo") {
        const c = document.getElementById("redazione-articoli");
        c.insertAdjacentHTML("beforeend", renderRigaTitolo({ tipo: "titolo", testo: "" }, 0));
        return;
      }

      // ---- Rimuovi un blocco titolo di gruppo ----
      const rimTitolo = e.target.closest("[data-rimuovi-titolo]");
      if (rimTitolo) {
        rimTitolo.closest(".redazione-titolo-gruppo").remove();
        return;
      }

      // ---- Sposta su/giù un blocco (articolo o titolo di gruppo) ----
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

      // ---- Inserisci collegamento nel testo selezionato (comma o sottocomma) ----
      const link = e.target.closest("[data-inserisci-link]");
      if (link) {
        const contenitore = link.closest(".redazione-comma, .redazione-sottocomma");
        const textarea = contenitore ? contenitore.querySelector("textarea") : null;
        if (textarea) inserisciCollegamento(textarea);
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
      if (e.target.id === "f-immagine") aggiornaAnteprimaImmagine();
      if (e.target.id === "redazione-filtro") {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll("#redazione-elenco-carica .redazione-riga").forEach(r => {
          r.style.display = r.textContent.toLowerCase().includes(q) ? "" : "none";
        });
      }
      if (e.target.id === "f-luoghi-filtro") {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll("#redazione-luoghi-lista .redazione-luogo-riga").forEach(r => {
          r.style.display = r.textContent.toLowerCase().includes(q) ? "flex" : "none";
        });
        // Nasconde anche le intestazioni di gruppo rimaste senza righe visibili.
        document.querySelectorAll("#redazione-luoghi-lista [data-gruppo-luoghi]").forEach(g => {
          const haRigheVisibili = [...g.querySelectorAll(".redazione-luogo-riga")].some(r => r.style.display !== "none");
          g.style.display = haRigheVisibili ? "" : "none";
        });
      }
    });
  }

  /* ---------- AVVIO REDAZIONE (ex-init) ---------- */

  async function avviaRedazione() {
    initEventi();

    luoghiDisponibili = await caricaLuoghi(); // non lancia mai: [] in caso di errore

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
