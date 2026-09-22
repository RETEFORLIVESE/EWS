// assets/js/redazione-ctsu.js — redazione dei progetti tecnici CTSU.
//
// Struttura di un progetto (vedi anche progetto.js):
//   sezioni: [ TITOLO | sezione | immagine ]   ->  sezione = { titolo, testo, commi: [ comma | immagine ] }
//   comma    = { testo, sottocommi: [ sottocomma | immagine ] }
// I numeri (Sezione 1, Comma 2, lettera b, TITOLO I) non vengono salvati: si ricalcolano dall'ordine.
(function () {
  let vista = "menu";
  let idInModifica = null;
  let progetti = [];
  let luoghi = null;   // registro dei luoghi (lo stesso di CA.html); null = non disponibile

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
          <p class="redazione-riga__meta">${(p.sezioni || []).filter(b => b && (!b.tipo || b.tipo === "sezione")).length} sezioni &middot; ${(p.galleria || []).length} foto &middot; ${(p.allegati || []).length} allegati</p>
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

  // Stesso meccanismo già usato in NormAktiv, ma i riferimenti interni rapidi puntano
  // a sezioni, commi e sottocommi di QUESTO progetto (#sez-N, #sez-N-c-M, #sez-N-c-M-s-K, #tit-N).
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
      "• Sezione DI QUESTO PROGETTO: 2  (= Sezione 2)\n" +
      "• Comma: 2.3  (= Sezione 2, comma 3)\n" +
      "• Sottocomma: 2.3.b  (= Sezione 2, comma 3, lettera b)\n" +
      "• Titolo: T1  (= TITOLO I)\n" +
      "• Riferimento avanzato: #qualcosa",
      ""
    );
    if (!destinazione) return;
    const valore = destinazione.trim();

    let href, attributiExtra = "";
    const rif = valore.match(/^(\d+)(?:\.(\d+)(?:\.([a-z]|\d+))?)?$/i);
    const tit = valore.match(/^T(\d+)$/i);
    if (/^https?:\/\//i.test(valore)) {
      href = valore;
      attributiExtra = ' target="_blank" rel="noopener noreferrer"';
    } else if (rif) {
      href = `#sez-${rif[1]}`;
      if (rif[2]) href += `-c-${rif[2]}`;
      if (rif[3]) href += `-s-${/^\d+$/.test(rif[3]) ? rif[3] : rif[3].toLowerCase().charCodeAt(0) - 96}`;
    } else if (tit) {
      href = `#tit-${tit[1]}`;
    } else if (valore.startsWith("#")) {
      href = valore;
    } else {
      alert('Formato non riconosciuto. Usa un indirizzo che inizi con http/https, oppure un riferimento come 2, 2.3, 2.3.b oppure T1.');
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

  /* ---------- STRUTTURA DELLA RELAZIONE (editor) ---------- */

  const BTN = "redazione-btn redazione-btn--piccolo";

  const STRUMENTI_TESTO =
    `<button type="button" class="${BTN}" data-inserisci-link onmousedown="event.preventDefault()" title="Inserisci un collegamento nel testo selezionato">🔗 Link</button>` +
    `<button type="button" class="${BTN}" data-inserisci-tabella onmousedown="event.preventDefault()" title="Inserisci una tabella nel testo">📊 Tabella</button>`;

  const BOTTONI_SPOSTA =
    `<button type="button" class="${BTN}" data-sposta="su" title="Sposta su">↑</button>` +
    `<button type="button" class="${BTN}" data-sposta="giu" title="Sposta giù">↓</button>`;

  const bottoneRimuovi = (testo, stile) =>
    `<button type="button" class="${BTN} redazione-btn--pericolo" data-rimuovi ${stile ? `style="${stile}"` : ""} title="Rimuovi">${testo}</button>`;

  const bottoneAggiungi = (tipo, testo) =>
    `<button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-aggiungi="${tipo}">${testo}</button>`;

  function campiImmagine(g) {
    return `
      <div class="redazione-immagine-campi">
        <input type="text" class="redazione-img-url" placeholder="Indirizzo web dell'immagine (https://...)" value="${escapeHtml(g.url)}" />
        <input type="text" class="redazione-img-didascalia" placeholder="Didascalia (facoltativa)" value="${escapeHtml(g.didascalia)}" />
      </div>`;
  }

  /* --- sottocomma --- */
  function renderSottocomma(y) {
    if (y && y.tipo === "immagine") {
      return `
        <div class="redazione-sottocomma redazione-blocco" data-tipo="sottocomma-immagine">
          <span class="redazione-sottocomma__lettera redazione-etichetta">🖼</span>
          ${campiImmagine(y)}
          <div class="redazione-sottocomma__strumenti">${BOTTONI_SPOSTA}${bottoneRimuovi("✕")}</div>
        </div>`;
    }
    return `
      <div class="redazione-sottocomma redazione-blocco" data-tipo="sottocomma">
        <span class="redazione-sottocomma__lettera redazione-etichetta">a)</span>
        <textarea class="redazione-testo-campo redazione-sottocomma-testo" rows="2" placeholder="Testo del sottocomma">${escapeHtml(y && y.testo)}</textarea>
        <div class="redazione-sottocomma__strumenti">
          <button type="button" class="${BTN}" data-inserisci-link onmousedown="event.preventDefault()" title="Inserisci un collegamento nel testo selezionato">🔗</button>
          ${BOTTONI_SPOSTA}${bottoneRimuovi("✕")}
        </div>
      </div>`;
  }

  /* --- comma (di testo o immagine) --- */
  function renderComma(c) {
    if (c && c.tipo === "immagine") {
      return `
        <div class="redazione-comma redazione-blocco" data-tipo="comma-immagine">
          <div class="redazione-comma__intestazione redazione-intestazione-blocco">
            <span class="redazione-etichetta">Immagine (comma)</span>
            ${BOTTONI_SPOSTA}
            ${bottoneRimuovi("Rimuovi", "margin-left:auto;")}
          </div>
          ${campiImmagine(c)}
        </div>`;
    }
    const sotto = (c && Array.isArray(c.sottocommi) ? c.sottocommi : []).map(renderSottocomma).join("");
    const imgDestra = (c && c.immagine && typeof c.immagine === "object") ? c.immagine : { url: "", didascalia: "" };
    return `
      <div class="redazione-comma redazione-blocco" data-tipo="comma">
        <div class="redazione-comma__intestazione redazione-intestazione-blocco">
          <span class="redazione-etichetta">Comma</span>
          ${STRUMENTI_TESTO}${BOTTONI_SPOSTA}
          ${bottoneRimuovi("Rimuovi comma", "margin-left:auto;")}
        </div>
        <textarea class="redazione-testo-campo redazione-comma-testo" rows="3" placeholder="Testo del comma">${escapeHtml(c && c.testo)}</textarea>
        <div class="redazione-comma__immagine-destra">
          <span class="redazione-etichetta">🖼 Immagine a destra del comma (facoltativa)</span>
          <div class="redazione-immagine-campi">
            <input type="text" class="redazione-img-destra-url" placeholder="Indirizzo web dell'immagine (https://...)" value="${escapeHtml(imgDestra.url)}" />
            <input type="text" class="redazione-img-destra-didascalia" placeholder="Didascalia (facoltativa)" value="${escapeHtml(imgDestra.didascalia)}" />
          </div>
        </div>
        <div class="redazione-sottocommi">${sotto}</div>
        <div class="redazione-azioni-riga">
          ${bottoneAggiungi("sottocomma", "+ Sottocomma")}
          ${bottoneAggiungi("sottocomma-immagine", "🖼 + Immagine come sottocomma")}
        </div>
      </div>`;
  }

  /* --- sezione --- */
  function renderSezione(sez) {
    const commi = (Array.isArray(sez.commi) ? sez.commi : []).map(renderComma).join("");
    return `
      <div class="redazione-articolo redazione-blocco" data-tipo="sezione">
        <div class="redazione-articolo__intestazione redazione-intestazione-blocco">
          <span class="redazione-etichetta">Sezione</span>
          ${STRUMENTI_TESTO}${BOTTONI_SPOSTA}
          ${bottoneRimuovi("Rimuovi sezione", "margin-left:auto;")}
        </div>
        <input type="text" class="redazione-sez-titolo" placeholder="Titolo della sezione (es. Obiettivi del progetto)" value="${escapeHtml(sez.titolo)}" />
        <textarea class="redazione-testo-campo redazione-sez-testo" rows="4" placeholder="Testo della sezione (facoltativo se usi i commi)">${escapeHtml(sez.testo)}</textarea>
        <div class="redazione-commi">${commi}</div>
        <div class="redazione-azioni-riga">
          ${bottoneAggiungi("comma", "+ Comma")}
          ${bottoneAggiungi("comma-immagine", "🖼 + Immagine come comma")}
        </div>
      </div>`;
  }

  /* --- TITOLO (raggruppa le sezioni che seguono: "TITOLO I - FORMA DELLO STATO") --- */
  function renderTitolo(t) {
    return `
      <div class="redazione-titolo-gruppo redazione-blocco" data-tipo="titolo">
        <div class="redazione-titolo-gruppo__intestazione redazione-intestazione-blocco">
          <span class="redazione-etichetta">TITOLO</span>
          ${BOTTONI_SPOSTA}
          ${bottoneRimuovi("Rimuovi titolo", "margin-left:auto;")}
        </div>
        <div class="redazione-titolo-riga">
          <input type="text" class="redazione-titolo-numero" placeholder="Numero (auto)" value="${escapeHtml(t.numero)}" />
          <input type="text" class="redazione-titolo-testo" placeholder="Nome del titolo (es. Forma dello Stato)" value="${escapeHtml(t.titolo)}" />
        </div>
      </div>`;
  }

  /* --- immagine fra una sezione e l'altra --- */
  function renderImmagineBlocco(g) {
    return `
      <div class="redazione-articolo redazione-blocco" data-tipo="immagine">
        <div class="redazione-articolo__intestazione redazione-intestazione-blocco">
          <span class="redazione-etichetta">Immagine</span>
          ${BOTTONI_SPOSTA}
          ${bottoneRimuovi("Rimuovi immagine", "margin-left:auto;")}
        </div>
        ${campiImmagine(g)}
      </div>`;
  }

  function renderBlocco(b) {
    if (b && b.tipo === "titolo") return renderTitolo(b);
    if (b && b.tipo === "immagine") return renderImmagineBlocco(b);
    return renderSezione(b || { titolo: "", testo: "", commi: [] });
  }

  /* --- numerazione mostrata nelle etichette (Sezione 1, Comma 2, b), TITOLO I) --- */
  const letteraDi = n => (n <= 26 ? String.fromCharCode(96 + n) : String(n));
  const etichettaDi = el => el.querySelector(":scope > .redazione-etichetta, :scope > .redazione-intestazione-blocco > .redazione-etichetta");
  const figliBlocco = (el, contenitore) => [...el.querySelectorAll(`:scope > ${contenitore} > .redazione-blocco`)];

  function rinumera() {
    let s = 0, t = 0;
    document.querySelectorAll("#redazione-sezioni > .redazione-blocco").forEach(b => {
      const et = etichettaDi(b);
      if (b.dataset.tipo === "titolo") {
        t++;
        const campo = b.querySelector(".redazione-titolo-numero");
        campo.placeholder = ctsuRomano(t) + " (auto)";
        if (et) et.textContent = "TITOLO " + (campo.value.trim() || ctsuRomano(t));
      } else if (b.dataset.tipo === "immagine") {
        if (et) et.textContent = "Immagine";
      } else {
        s++;
        if (et) et.textContent = "Sezione " + s;
        let c = 0;
        figliBlocco(b, ".redazione-commi").forEach(cb => {
          const etc = etichettaDi(cb);
          if (cb.dataset.tipo === "comma-immagine") { if (etc) etc.textContent = "Immagine (comma)"; return; }
          c++;
          if (etc) etc.textContent = "Comma " + c;
          let l = 0;
          figliBlocco(cb, ".redazione-sottocommi").forEach(sb => {
            const ets = etichettaDi(sb);
            if (sb.dataset.tipo === "sottocomma-immagine") { if (ets) ets.textContent = "🖼"; return; }
            l++;
            if (ets) ets.textContent = letteraDi(l) + ")";
          });
        });
      }
    });
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

/* ---------- LUOGO (collegamento con CA.html) ---------- */

  const SUGGERIMENTO_LUOGO =
    `<span style="font-size:.75rem;color:var(--inchiostro-tenue);font-family:var(--font-testo);text-transform:none;letter-spacing:0;font-weight:400;">` +
    `Si salva l'ID del luogo: il progetto comparirà su CA.html sotto l'organo che usa questo luogo.</span>`;

  function campoLuogo(valore) {
    valore = (valore || "").toString().trim();

    // Elenco dei luoghi non raggiungibile: si può scrivere l'ID a mano.
    if (!luoghi) {
      return `
        <div class="redazione-campo">
          <label for="f-luogo">Luogo (ID)</label>
          <input type="text" id="f-luogo" value="${escapeHtml(valore)}" placeholder="ID della voce di luoghi, es. ELIN-TLN" />
          <span style="font-size:.75rem;color:#a72e23;">Impossibile leggere l'elenco dei luoghi: scrivi l'ID a mano oppure ricarica la pagina.</span>
        </div>`;
    }

    const gruppi = ctsuElencoLuoghi(luoghi);
    const presente = gruppi.some(g => g.voci.some(v => v.id === valore));
    const opzioni = gruppi.map(g => `
      <optgroup label="${escapeHtml(g.gruppo)}">
        ${g.voci.map(v => `<option value="${escapeHtml(v.id)}" ${v.id === valore ? "selected" : ""}>${escapeHtml(ctsuEtichettaLuogo(v))}</option>`).join("")}
      </optgroup>`).join("");
    // Un valore vecchio (es. un nome scritto a mano) non va perso: resta selezionabile, ma segnalato.
    const vecchio = valore && !presente
      ? `<option value="${escapeHtml(valore)}" selected>${escapeHtml(valore)} — non presente nei luoghi</option>`
      : "";

    return `
      <div class="redazione-campo">
        <label for="f-luogo">Luogo</label>
        <select id="f-luogo">
          <option value="">— nessun luogo —</option>
          ${vecchio}${opzioni}
        </select>
        ${SUGGERIMENTO_LUOGO}
      </div>`;
  }

  /* ---------- EDITOR COMPLETO ---------- */

  function renderEditor(progetto) {
    idInModifica = progetto ? progetto.id : null;
    const blocchi = progetto && Array.isArray(progetto.sezioni) && progetto.sezioni.length
      ? progetto.sezioni
      : [{ tipo: "sezione", titolo: "", testo: "", commi: [] }];
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
          ${campoLuogo(progetto ? progetto.luogo : "")}
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

        <h3>Struttura della relazione</h3>
        <p style="font-size:.82rem;color:var(--inchiostro-tenue);margin:0 0 10px;">
          Un <strong>TITOLO</strong> raggruppa le sezioni che lo seguono (es. &laquo;TITOLO I - FORMA DELLO STATO&raquo;).
          Ogni sezione può avere dei <strong>commi</strong>, e ogni comma dei <strong>sottocommi</strong> (a, b, c&hellip;).
          Le immagini si possono inserire fra le sezioni, oppure come comma o sottocomma.
        </p>
        <div id="redazione-sezioni">${blocchi.map(renderBlocco).join("")}</div>
        <div class="redazione-azioni-riga">
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-sezione">+ Aggiungi sezione</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-titolo">+ Aggiungi TITOLO</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-immagine">🖼 + Aggiungi immagine</button>
        </div>

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

  const valoreDi = (el, selettore) => {
    const campo = el.querySelector(selettore);
    return campo ? campo.value.trim() : "";
  };
  const testoDi = el => valoreDi(el, ":scope > .redazione-testo-campo");

  function leggiImmagine(el) {
    return { tipo: "immagine", url: valoreDi(el, ".redazione-img-url"), didascalia: valoreDi(el, ".redazione-img-didascalia") };
  }

  function leggiSottocommi(commaEl) {
    return figliBlocco(commaEl, ".redazione-sottocommi")
      .map(el => el.dataset.tipo === "sottocomma-immagine" ? leggiImmagine(el) : { testo: testoDi(el) })
      .filter(y => y.tipo === "immagine" ? y.url !== "" : y.testo !== "");
  }

  function leggiCommi(sezioneEl) {
    return figliBlocco(sezioneEl, ".redazione-commi")
      .map(el => {
        if (el.dataset.tipo === "comma-immagine") return leggiImmagine(el);
        const base = { testo: testoDi(el), sottocommi: leggiSottocommi(el) };
        const url = valoreDi(el, ".redazione-img-destra-url");
        return url ? { ...base, immagine: { url, didascalia: valoreDi(el, ".redazione-img-destra-didascalia") } } : base;
      })
      .filter(c => c.tipo === "immagine" ? c.url !== "" : (c.testo !== "" || c.sottocommi.length > 0 || !!c.immagine));
  }

  // Blocchi di primo livello nell'ordine in cui compaiono: TITOLI, sezioni (con commi) e immagini.
  function leggiSezioni() {
    return [...document.querySelectorAll("#redazione-sezioni > .redazione-blocco")].map(el => {
      switch (el.dataset.tipo) {
        case "titolo":
          return { tipo: "titolo", numero: valoreDi(el, ".redazione-titolo-numero"), titolo: valoreDi(el, ".redazione-titolo-testo") };
        case "immagine":
          return leggiImmagine(el);
        default:
          return { tipo: "sezione", titolo: valoreDi(el, ".redazione-sez-titolo"), testo: testoDi(el), commi: leggiCommi(el) };
      }
    }).filter(b => b.tipo !== "immagine" || b.url !== "");
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
    else if (vista === "editor") { root.innerHTML = renderEditor(extra || null); rinumera(); }
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

      // ---- Inserisci collegamento / tabella nel testo di una sezione, di un comma o di un sottocomma ----
      const textareaDi = el => {
        const blocco = el.closest(".redazione-blocco");
        return blocco ? blocco.querySelector(":scope > .redazione-testo-campo") : null;
      };

      const link = e.target.closest("[data-inserisci-link]");
      if (link) {
        const textarea = textareaDi(link);
        if (textarea) inserisciCollegamento(textarea);
        return;
      }

      const tabella = e.target.closest("[data-inserisci-tabella]");
      if (tabella) {
        const textarea = textareaDi(tabella);
        if (textarea) inserisciTabella(textarea);
        return;
      }

      // ---- Sposta su/giù un blocco (titolo, sezione, immagine, comma, sottocomma) ----
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
          rinumera();
        }
        return;
      }

      // ---- Aggiunge un blocco in fondo a un contenitore e mette il cursore nel primo campo ----
      const aggiungi = (contenitore, html) => {
        contenitore.insertAdjacentHTML("beforeend", html);
        rinumera();
        const nuovo = contenitore.lastElementChild;
        const campo = nuovo && nuovo.querySelector(".redazione-sez-titolo, .redazione-testo-campo, .redazione-img-url, .redazione-titolo-testo");
        if (campo) campo.focus();
      };

      // Primo livello: sezione, TITOLO, immagine
      const radice = document.getElementById("redazione-sezioni");
      if (e.target.id === "redazione-aggiungi-sezione") { aggiungi(radice, renderSezione({ titolo: "", testo: "", commi: [] })); return; }
      if (e.target.id === "redazione-aggiungi-titolo") { aggiungi(radice, renderTitolo({ numero: "", titolo: "" })); return; }
      if (e.target.id === "redazione-aggiungi-immagine") { aggiungi(radice, renderImmagineBlocco({ url: "", didascalia: "" })); return; }

      // Dentro una sezione (comma / immagine come comma) o dentro un comma (sottocomma / immagine come sottocomma)
      const agg = e.target.closest("[data-aggiungi]");
      if (agg) {
        const tipo = agg.getAttribute("data-aggiungi");
        const blocco = agg.closest(".redazione-blocco");
        if (!blocco) return;
        if (tipo === "comma") aggiungi(blocco.querySelector(":scope > .redazione-commi"), renderComma({ testo: "", sottocommi: [] }));
        else if (tipo === "comma-immagine") aggiungi(blocco.querySelector(":scope > .redazione-commi"), renderComma({ tipo: "immagine", url: "", didascalia: "" }));
        else if (tipo === "sottocomma") aggiungi(blocco.querySelector(":scope > .redazione-sottocommi"), renderSottocomma({ testo: "" }));
        else if (tipo === "sottocomma-immagine") aggiungi(blocco.querySelector(":scope > .redazione-sottocommi"), renderSottocomma({ tipo: "immagine", url: "", didascalia: "" }));
        return;
      }

      // ---- Rimuovi un blocco ----
      const rimuovi = e.target.closest("[data-rimuovi]");
      if (rimuovi) {
        const blocco = rimuovi.closest(".redazione-blocco");
        if (!blocco) return;
        if (blocco.dataset.tipo === "sezione" &&
            document.querySelectorAll('#redazione-sezioni > .redazione-blocco[data-tipo="sezione"]').length <= 1) {
          alert("Deve rimanere almeno una sezione.");
          return;
        }
        if (blocco.querySelector(".redazione-blocco") &&
            !confirm("Questo blocco contiene commi, sottocommi o immagini: verranno rimossi insieme a lui. Continuare?")) {
          return;
        }
        blocco.remove();
        rinumera();
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
      if (e.target.classList && e.target.classList.contains("redazione-titolo-numero")) rinumera();
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
    try {
      luoghi = await APICtsu.loadLuoghi();
    } catch (e) {
      console.warn("Elenco dei luoghi non disponibile:", e);
      luoghi = null;
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
