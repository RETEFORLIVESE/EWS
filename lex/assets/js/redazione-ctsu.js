// assets/js/redazione-ctsu.js — redazione dei progetti tecnici CTSU.
//
// Struttura di un progetto (vedi anche progetto.js):
//   sezioni: [ TITOLO | sezione | immagine | mappa ]   ->  sezione = { titolo, testo, commi: [ comma | immagine | mappa ] }
//   comma    = { testo, sottocommi: [ sottocomma | immagine | mappa ] }
//   mappa    = diagramma di linea/stazioni con icone BSicon di Wikimedia (vedi ctsuMappaHtml in ctsu-core.js)
// I numeri (Sezione 1, Comma 2, lettera b, TITOLO I) non vengono salvati: si ricalcolano dall'ordine.
(function () {
  let vista = "menu";
  let idInModifica = null;
  let progetti = [];
  let piani = [];      // piani economici (Consiglio di Pianificazione), stesso archivio dei progetti
  let modo = "progetto";   // "progetto" | "piano": cosa si sta creando/modificando
  let luoghi = null;   // registro dei luoghi (lo stesso di CA.html); null = non disponibile

  const slugify = t => (t || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

  const escapeHtml = t => (t || "").toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const STATI_PIANO = ["In elaborazione", "In consultazione", "Approvato", "In vigore", "Concluso", "Archiviato"];
  const AMBITI_PIANO = { statale: "Statale", unitario: "Unitario" };
  const listaCorrente = () => (modo === "piano" ? piani : progetti);

  const STATI_PROGETTO = ["In progettazione", "Approvato", "In corso", "Sospeso", "Completato", "Annullato"];

  function idUnivoco(base, escludi) {
    let c = base || "progetto", n = 2;
    while ([...progetti, ...piani].some(p => p.id === c && p.id !== escludi)) c = `${base}-${n++}`;
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

    // Accesso con Estji ID (QR): il blocco compare solo se il widget è stato caricato
    const blocco = document.getElementById('estji-blocco');
    // come in redazione.html: il QR compare solo se il widget è caricato E APICtsu.loginEstji esiste
    if (blocco && window.EstjiLogin && typeof APICtsu !== 'undefined' && typeof APICtsu.loginEstji === 'function') {
      blocco.style.display = 'block';
      EstjiLogin.mount('#estji-login', {
        clientId: 'ctsu',
        scopes: ['profile.basic', 'ctsu.edit'],
        onLogin: async res => {
          err.classList.remove('show'); err.textContent = '';
          try {
            const nome = (await APICtsu.loginEstji(res.id_token)) || '';
            try { sessionStorage.setItem('ctsu_user', nome); } catch (e) {}
            if (label) label.textContent = nome;
            const avatar = document.getElementById('adminAvatar');
            if (avatar) avatar.textContent = (nome.trim()[0] || '?').toUpperCase();
            mostraAdmin();
            await avviaRedazione();
          } catch (e) {
            err.textContent = '❌ ' + (e.message || 'Accesso non riuscito');
            err.classList.add('show');
          }
        }
      });
    }

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
      <h1 style="margin-bottom:4px;">Redazione</h1>
      <p style="color:var(--inchiostro-tenue); max-width:60ch; margin-top:0;">
        Le modifiche vengono salvate direttamente sul database condiviso: saranno visibili a tutti gli utenti del sito.
      </p>

      <h2 style="font-family:var(--font-chrome); font-size:1.05rem; margin:24px 0 0;">Progetti tecnici</h2>
      <div class="redazione-menu" style="grid-template-columns:repeat(2,1fr); margin-top:12px;">
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

      <h2 style="font-family:var(--font-chrome); font-size:1.05rem; margin:8px 0 0;">Consiglio di Pianificazione &mdash; piani economici</h2>
      <p style="color:var(--inchiostro-tenue); max-width:60ch; margin:4px 0 0; font-size:.9rem;">
        I piani vengono pubblicati sulla pagina <a href="CP.html">CP.html</a>, divisi in statali e unitari.
      </p>
      <div class="redazione-menu" style="grid-template-columns:repeat(2,1fr); margin-top:12px;">
        <button type="button" class="redazione-card" data-azione="nuovo-piano">
          <span class="redazione-card__numero">3</span>
          <span class="redazione-card__titolo">Crea nuovo piano economico</span>
          <span class="redazione-card__desc">Scrivi un piano statale o unitario, con titoli, sezioni, commi e tabelle.</span>
        </button>
        <button type="button" class="redazione-card" data-azione="carica-piani">
          <span class="redazione-card__numero">4</span>
          <span class="redazione-card__titolo">Carica piano esistente</span>
          <span class="redazione-card__desc">Scegli un piano già pubblicato e modificane il contenuto.</span>
        </button>
      </div>

      <p id="redazione-messaggio" class="redazione-messaggio" style="display:none;"></p>
      <p style="margin-top:20px; color:var(--inchiostro-tenue); font-size:0.85rem;">
        Nel database: <strong>${progetti.length}</strong> progetti &middot; <strong>${piani.length}</strong> piani economici
      </p>`;
  }

  function renderCarica() {
    const eiPiano = modo === "piano";
    const lista = [...listaCorrente()].sort((a, b) => (a.titolo || "").localeCompare(b.titolo || ""));
    const righe = lista.map(p => {
      const nSez = (p.sezioni || []).filter(b => b && (!b.tipo || b.tipo === "sezione")).length;
      const badge = eiPiano
        ? `<span class="badge-ambito ${p.ambito === "unitario" ? "badge-ambito--unitario" : ""}">${escapeHtml(AMBITI_PIANO[p.ambito] || "Statale")}</span>`
        : `<span class="badge-categoria">${escapeHtml(p.categoria)}</span>`;
      const meta = eiPiano
        ? `${nSez} sezioni &middot; ${escapeHtml(p.periodo_validita || "periodo non indicato")} &middot; ${(p.allegati || []).length} allegati`
        : `${nSez} sezioni &middot; ${(p.galleria || []).length} foto &middot; ${(p.allegati || []).length} allegati`;
      return `
      <div class="redazione-riga" data-id="${escapeHtml(p.id)}">
        <div>
          ${badge}
          <span class="badge-stato">${escapeHtml(p.stato)}</span>
          <p class="redazione-riga__titolo">${escapeHtml(p.titolo)}</p>
          <p class="redazione-riga__meta">${meta}</p>
        </div>
        <div class="redazione-riga__azioni">
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-modifica="${escapeHtml(p.id)}">Modifica</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-elimina="${escapeHtml(p.id)}">Elimina</button>
        </div>
      </div>`;
    }).join("");

    const nome = eiPiano ? "piano esistente" : "progetto esistente";
    return `
      <p class="breadcrumb"><a href="ctsu.html">Home</a> &rsaquo; <a href="redazione-ctsu.html">Redazione</a> &rsaquo; Carica ${nome}</p>
      <h1>Carica ${nome}</h1>
      <input type="text" id="redazione-filtro" placeholder="Filtra per titolo${eiPiano ? " o ambito" : " o categoria"}&hellip;" style="width:100%; max-width:420px; padding:10px 14px; border:1px solid var(--bordo); border-radius:var(--radius); font-family:var(--font-chrome); margin-bottom:16px;" />
      <div id="redazione-elenco-carica">${righe || `<p>Nessun ${eiPiano ? "piano" : "progetto"} presente.</p>`}</div>
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

  /* --- MAPPE DI TRASPORTI (editor) --- */
  let ultimoCampoIcone = null;

  const MAPPA_ALLINEAMENTI = { centro: "Centrata", destra: "A destra del testo", sinistra: "A sinistra del testo", intera: "A tutta larghezza" };

  const MAPPA_NUOVA = () => ({
    tipo: "mappa", titolo: "", didascalia: "", allineamento: "centro", larghezza: 420, dimensione_icone: 20, mostra_km: true,
    righe: [
      { tipo: "fermata", icone: "KBHFa", km: "", nome: "", dettaglio: "", url: "", colore: "" },
      { tipo: "fermata", icone: "KBHFe", km: "", nome: "", dettaglio: "", url: "", colore: "" }
    ]
  });

  const MAPPA_ESEMPIO = () => ({
    titolo: "Stazioni e fermate", mostra_km: true,
    righe: [
      { tipo: "fermata", icone: "KBHFa", km: "0+000", nome: "Capolinea A", dettaglio: "* 1997" },
      { tipo: "nota", icone: "STR", nome: "Linea merci per Nord" },
      { tipo: "fermata", icone: "BHF", km: "2+400", nome: "Stazione B", dettaglio: "* 2002" },
      { tipo: "fermata", icone: "ABZgr", km: "4+050", nome: "Bivio C" },
      { tipo: "fermata", icone: "HST", km: "5+120", nome: "Fermata D" },
      { tipo: "ramo", nome: "Ramo per E" },
      { tipo: "fermata", icone: "KBHFe", km: "8+300", nome: "Capolinea E" }
    ]
  });

  function campoColoreMappa(classe, valore, predefinito, etichetta) {
    const v = ctsuMappaColore(valore);
    return `<label class="rm-colore"><span>${etichetta}</span>` +
      `<input type="color" class="${classe}" value="${v || predefinito}" data-default="${predefinito}" data-vuoto="${v ? 0 : 1}" />` +
      `<button type="button" class="${BTN}" data-mappa="reset-colore" title="Torna al colore predefinito">↺</button></label>`;
  }

  function renderMappaRiga(r) {
    r = r || {};
    const tipo = r.tipo === "nota" || r.tipo === "ramo" ? r.tipo : "fermata";
    const opz = (v, t) => `<option value="${v}" ${v === tipo ? "selected" : ""}>${t}</option>`;
    return `
      <div class="rm-riga" data-tipo-riga="${tipo}">
        <div class="rm-riga__testa">
          <select class="rm-tipo">${opz("fermata", "Fermata / stazione")}${opz("nota", "Nota / linea (testo piccolo)")}${opz("ramo", "Titolo di ramo (barra)")}</select>
          <span class="rm-riga__tools">
            <button type="button" class="${BTN}" data-mappa="su" title="Sposta su">↑</button>
            <button type="button" class="${BTN}" data-mappa="giu" title="Sposta giù">↓</button>
            <button type="button" class="${BTN}" data-mappa="dup" title="Duplica">⧉</button>
            <button type="button" class="${BTN} redazione-btn--pericolo" data-mappa="rimuovi" title="Rimuovi riga">✕</button>
          </span>
        </div>
        <div class="rm-riga__campi">
          <input type="text" class="rm-icone rm-opz" placeholder="Icone: es. STR BHF STR+r (- = vuoto)" value="${escapeHtml(r.icone)}" />
          <input type="text" class="rm-km rm-opz" placeholder="Km (es. 8+410)" value="${escapeHtml(r.km)}" />
          <input type="text" class="rm-nome" placeholder="Nome" value="${escapeHtml(r.nome)}" />
          <input type="text" class="rm-dett rm-opz" placeholder="Dettaglio (es. * 1997)" value="${escapeHtml(r.dettaglio)}" />
          <input type="text" class="rm-url rm-opz" placeholder="Link del nome (https://...)" value="${escapeHtml(r.url)}" />
          <span class="rm-opz">${campoColoreMappa("rm-col-riga", r.colore, "#be2d2c", "Colore icone")}</span>
        </div>
      </div>`;
  }

  function renderMappaCampi(m) {
    m = m || MAPPA_NUOVA();
    const allin = MAPPA_ALLINEAMENTI[m.allineamento] ? m.allineamento : "centro";
    const opzAllin = Object.entries(MAPPA_ALLINEAMENTI)
      .map(([k, v]) => `<option value="${k}" ${k === allin ? "selected" : ""}>${v}</option>`).join("");
    const chips = CTSU_MAPPA_PALETTE.concat(["-"]).map(c => {
      const url = c === "-" ? "" : ctsuMappaIconaUrl(c);
      return `<button type="button" class="rm-chip" data-mappa="codice" data-codice="${escapeHtml(c)}" title="Aggiungi ${escapeHtml(c)}">` +
        `<span class="mappa__ico" style="${url ? `background-image:url('${url}')` : ""}"></span><small>${c === "-" ? "vuoto" : escapeHtml(c)}</small></button>`;
    }).join("");
    return `
      <div class="redazione-mappa">
        <div class="redazione-campo">
          <label>Titolo della mappa</label>
          <input type="text" class="rm-titolo" placeholder="es. Stazioni e fermate" value="${escapeHtml(m.titolo)}" />
        </div>
        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label>Posizione</label><select class="rm-allineamento">${opzAllin}</select></div>
          <div class="redazione-campo"><label>Larghezza massima (px)</label><input type="number" class="rm-larghezza" min="220" max="1000" step="10" value="${parseInt(m.larghezza, 10) || 420}" /></div>
          <div class="redazione-campo"><label>Dimensione icone (px)</label><input type="number" class="rm-dim" min="12" max="40" step="1" value="${parseInt(m.dimensione_icone, 10) || 20}" /></div>
        </div>
        <div class="rm-colori">
          ${campoColoreMappa("rm-col-linee", m.colore_linee, "#be2d2c", "Colore di tutte le icone")}
          ${campoColoreMappa("rm-col-intest", m.colore_intestazione, "#eaecf0", "Sfondo titoli")}
          ${campoColoreMappa("rm-col-sfondo", m.colore_sfondo, "#ffffff", "Sfondo mappa")}
          <label class="rm-spunta"><input type="checkbox" class="rm-mostra-km" ${m.mostra_km === false ? "" : "checked"} /> Colonna chilometrica</label>
        </div>
        <div class="rm-righe">${(Array.isArray(m.righe) ? m.righe : []).map(renderMappaRiga).join("")}</div>
        <div class="redazione-azioni-riga">
          ${`<button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-mappa="aggiungi-fermata">+ Fermata</button>`}
          ${`<button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-mappa="aggiungi-nota">+ Nota / linea</button>`}
          ${`<button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-mappa="aggiungi-ramo">+ Titolo di ramo</button>`}
          ${`<button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-mappa="esempio">Carica un esempio</button>`}
        </div>
        <details class="rm-palette">
          <summary>Icone più usate (clic per aggiungerle alla riga selezionata)</summary>
          <div class="rm-palette__chips">${chips}</div>
        </details>
        <p class="rm-aiuto">Le icone si scaricano da internet (pittogrammi BSicon di Wikimedia Commons, gli stessi di Wikipedia): non occupano spazio nel sito.
          Scrivi i codici separati da spazio, uno per colonna; per altre icone vedi il
          <a href="https://commons.wikimedia.org/wiki/BSicon/Catalogue" target="_blank" rel="noopener">catalogo dei codici</a>.
          Puoi anche incollare l'indirizzo https:// di un'immagine tua.</p>
        <div class="redazione-campo">
          <label>Didascalia (facoltativa)</label>
          <input type="text" class="rm-didascalia" value="${escapeHtml(m.didascalia)}" />
        </div>
        <div class="redazione-campo"><label>Anteprima</label><div class="rm-anteprima"></div></div>
      </div>`;
  }

  const bloccoMappa = m => `
      <div class="redazione-articolo redazione-blocco" data-tipo="mappa">
        <div class="redazione-articolo__intestazione redazione-intestazione-blocco">
          <span class="redazione-etichetta">Mappa</span>
          ${BOTTONI_SPOSTA}
          ${bottoneRimuovi("Rimuovi mappa", "margin-left:auto;")}
        </div>
        ${renderMappaCampi(m)}
      </div>`;

  /* --- sottocomma --- */
  function renderSottocomma(y) {
    if (y && y.tipo === "mappa") {
      return `
        <div class="redazione-sottocomma redazione-blocco" data-tipo="sottocomma-mappa">
          <span class="redazione-sottocomma__lettera redazione-etichetta">🗺</span>
          ${renderMappaCampi(y)}
          <div class="redazione-sottocomma__strumenti">${BOTTONI_SPOSTA}${bottoneRimuovi("✕")}</div>
        </div>`;
    }
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
    if (c && c.tipo === "mappa") {
      return `
        <div class="redazione-comma redazione-blocco" data-tipo="comma-mappa">
          <div class="redazione-comma__intestazione redazione-intestazione-blocco">
            <span class="redazione-etichetta">Mappa (comma)</span>
            ${BOTTONI_SPOSTA}
            ${bottoneRimuovi("Rimuovi", "margin-left:auto;")}
          </div>
          ${renderMappaCampi(c)}
        </div>`;
    }
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
          ${bottoneAggiungi("sottocomma-mappa", "🗺 + Mappa come sottocomma")}
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
          ${bottoneAggiungi("comma-mappa", "🗺 + Mappa come comma")}
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
    if (b && b.tipo === "mappa") return bloccoMappa(b);
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
      } else if (b.dataset.tipo === "immagine" || b.dataset.tipo === "mappa") {
        if (et) et.textContent = b.dataset.tipo === "mappa" ? "Mappa" : "Immagine";
      } else {
        s++;
        if (et) et.textContent = "Sezione " + s;
        let c = 0;
        figliBlocco(b, ".redazione-commi").forEach(cb => {
          const etc = etichettaDi(cb);
          if (cb.dataset.tipo === "comma-immagine") { if (etc) etc.textContent = "Immagine (comma)"; return; }
          if (cb.dataset.tipo === "comma-mappa") { if (etc) etc.textContent = "Mappa (comma)"; return; }
          c++;
          if (etc) etc.textContent = "Comma " + c;
          let l = 0;
          figliBlocco(cb, ".redazione-sottocommi").forEach(sb => {
            const ets = etichettaDi(sb);
            if (sb.dataset.tipo === "sottocomma-immagine") { if (ets) ets.textContent = "🖼"; return; }
            if (sb.dataset.tipo === "sottocomma-mappa") { if (ets) ets.textContent = "🗺"; return; }
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

  function campoLuogo(valore, suggerimento, nomeCampo) {
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
        ${suggerimento || SUGGERIMENTO_LUOGO}
      </div>`;
  }

  /* ---------- CAMPI GENERALI DI UN PIANO ECONOMICO ---------- */

  const SUGGERIMENTO_LUOGO_PIANO =
    `<span style="font-size:.75rem;color:var(--inchiostro-tenue);font-family:var(--font-testo);text-transform:none;letter-spacing:0;font-weight:400;">` +
    `Si salva l'ID del luogo: il piano comparirà su CA.html sotto l'organo che usa questo luogo.</span>`;

  function campiPiano(p) {
    const ambito = p && p.ambito === "unitario" ? "unitario" : "statale";
    const stato = p && p.stato ? p.stato : "In elaborazione";
    const opzAmbito = Object.entries(AMBITI_PIANO)
      .map(([k, v]) => `<option value="${k}" ${k === ambito ? "selected" : ""}>${v}</option>`).join("");
    const opzStato = STATI_PIANO
      .map(x => `<option value="${escapeHtml(x)}" ${x === stato ? "selected" : ""}>${escapeHtml(x)}</option>`).join("");
    const v = k => (p ? escapeHtml(p[k]) : "");
    return `
        <div class="redazione-campo">
          <label for="f-titolo">Titolo del piano</label>
          <input type="text" id="f-titolo" required value="${v("titolo")}" placeholder="es. Piano economico quinquennale 2026-2030" />
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo">
            <label for="f-ambito">Ambito</label>
            <select id="f-ambito">${opzAmbito}</select>
          </div>
          <div class="redazione-campo">
            <label for="f-stato">Stato del piano</label>
            <select id="f-stato">${opzStato}</select>
          </div>
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-organo">Ente redattore</label><input type="text" id="f-organo" value="${v("organo_responsabile")}" /></div>
          ${campoLuogo(p ? (p.luogo || p.luogo_piano) : "", SUGGERIMENTO_LUOGO_PIANO)}
          <div class="redazione-campo"><label for="f-responsabile">Responsabile del piano</label><input type="text" id="f-responsabile" value="${v("responsabile")}" /></div>
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-periodo">Periodo di validità</label><input type="text" id="f-periodo" placeholder="es. 2026-2030" value="${v("periodo_validita")}" /></div>
          <div class="redazione-campo"><label for="f-data-approvazione">Data di approvazione</label><input type="text" id="f-data-approvazione" placeholder="es. 12 agosto 2026" value="${v("data_approvazione")}" /></div>
          <div class="redazione-campo"><label for="f-risorse">Risorse totali</label><input type="text" id="f-risorse" placeholder='es. "€ 2.400.000"' value="${v("risorse_totali")}" /></div>
        </div>

        `;
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
      <p class="breadcrumb"><a href="ctsu.html">Home</a> &rsaquo; <a href="redazione-ctsu.html">Redazione</a> &rsaquo; ${(progetto ? "Modifica " : "Nuovo ") + (modo === "piano" ? "piano economico" : "progetto")}</p>
      <h1>${(progetto ? "Modifica " : "Nuovo ") + (modo === "piano" ? "piano economico" : "progetto")}</h1>
      <p id="redazione-messaggio" class="redazione-messaggio" style="display:none;"></p>
      <form id="redazione-form" class="redazione-form" novalidate>

${modo === "piano" ? campiPiano(progetto) : `        <div class="redazione-campo">
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

`}

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
          Le immagini e le mappe di trasporti si possono inserire fra le sezioni, oppure come comma o sottocomma.
        </p>
        <div id="redazione-sezioni">${blocchi.map(renderBlocco).join("")}</div>
        <div class="redazione-azioni-riga">
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-sezione">+ Aggiungi sezione</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-titolo">+ Aggiungi TITOLO</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-immagine">🖼 + Aggiungi immagine</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-mappa">🗺 + Aggiungi mappa di trasporti</button>
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
          ${progetto ? `<button type="button" class="redazione-btn redazione-btn--pericolo" id="redazione-elimina-corrente">Elimina ${modo === "piano" ? "questo piano" : "questo progetto"}</button>` : ""}
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

  function leggiColoreMappa(el, selettore) {
    const c = el.querySelector(selettore);
    return c && c.dataset.vuoto !== "1" ? c.value : "";
  }

  function leggiRigaMappa(riga) {
    return {
      tipo: valoreDi(riga, ".rm-tipo") || "fermata",
      icone: valoreDi(riga, ".rm-icone"),
      km: valoreDi(riga, ".rm-km"),
      nome: valoreDi(riga, ".rm-nome"),
      dettaglio: valoreDi(riga, ".rm-dett"),
      url: valoreDi(riga, ".rm-url"),
      colore: leggiColoreMappa(riga, ".rm-col-riga")
    };
  }

  // "contenitore" = il blocco (.redazione-blocco) oppure direttamente l'editor .redazione-mappa
  function leggiMappa(contenitore) {
    const m = contenitore.classList.contains("redazione-mappa") ? contenitore : contenitore.querySelector(":scope > .redazione-mappa");
    const num = (sel, def, min, max) => Math.max(min, Math.min(max, parseInt(valoreDi(m, sel), 10) || def));
    return {
      tipo: "mappa",
      titolo: valoreDi(m, ".rm-titolo"),
      didascalia: valoreDi(m, ".rm-didascalia"),
      allineamento: valoreDi(m, ".rm-allineamento") || "centro",
      larghezza: num(".rm-larghezza", 420, 220, 1000),
      dimensione_icone: num(".rm-dim", 20, 12, 40),
      mostra_km: !!m.querySelector(".rm-mostra-km").checked,
      colore_linee: leggiColoreMappa(m, ".rm-col-linee"),
      colore_intestazione: leggiColoreMappa(m, ".rm-col-intest"),
      colore_sfondo: leggiColoreMappa(m, ".rm-col-sfondo"),
      righe: [...m.querySelectorAll(".rm-righe > .rm-riga")].map(leggiRigaMappa)
        .filter(r => r.nome || r.icone || r.km || r.dettaglio)
    };
  }

  const mappaNonVuota = m => m.righe.length > 0;

  function leggiSottocommi(commaEl) {
    return figliBlocco(commaEl, ".redazione-sottocommi")
      .map(el => el.dataset.tipo === "sottocomma-mappa" ? leggiMappa(el)
        : el.dataset.tipo === "sottocomma-immagine" ? leggiImmagine(el) : { testo: testoDi(el) })
      .filter(y => y.tipo === "mappa" ? mappaNonVuota(y) : y.tipo === "immagine" ? y.url !== "" : y.testo !== "");
  }

  function leggiCommi(sezioneEl) {
    return figliBlocco(sezioneEl, ".redazione-commi")
      .map(el => {
        if (el.dataset.tipo === "comma-mappa") return leggiMappa(el);
        if (el.dataset.tipo === "comma-immagine") return leggiImmagine(el);
        const base = { testo: testoDi(el), sottocommi: leggiSottocommi(el) };
        const url = valoreDi(el, ".redazione-img-destra-url");
        return url ? { ...base, immagine: { url, didascalia: valoreDi(el, ".redazione-img-destra-didascalia") } } : base;
      })
      .filter(c => c.tipo === "mappa" ? mappaNonVuota(c) : c.tipo === "immagine" ? c.url !== "" : (c.testo !== "" || c.sottocommi.length > 0 || !!c.immagine));
  }

  // Blocchi di primo livello nell'ordine in cui compaiono: TITOLI, sezioni (con commi) e immagini.
  function leggiSezioni() {
    return [...document.querySelectorAll("#redazione-sezioni > .redazione-blocco")].map(el => {
      switch (el.dataset.tipo) {
        case "titolo":
          return { tipo: "titolo", numero: valoreDi(el, ".redazione-titolo-numero"), titolo: valoreDi(el, ".redazione-titolo-testo") };
        case "immagine":
          return leggiImmagine(el);
        case "mappa":
          return leggiMappa(el);
        default:
          return { tipo: "sezione", titolo: valoreDi(el, ".redazione-sez-titolo"), testo: testoDi(el), commi: leggiCommi(el) };
      }
    }).filter(b => b.tipo === "mappa" ? mappaNonVuota(b) : (b.tipo !== "immagine" || b.url !== ""));
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
    const catNuova = modo === "piano" ? "" : document.getElementById("f-categoria-nuova").value.trim();
    const categoria = catNuova || (modo === "piano" ? "" : document.getElementById("f-categoria").value);
    const idBase = slugify(document.getElementById("f-id").value.trim() || titolo);
    const val = id => document.getElementById(id).value.trim();

    if (modo === "piano") {
      const ambito = val("f-ambito") === "unitario" ? "unitario" : "statale";
      return {
        id: idUnivoco(idBase || "piano", idInModifica),
        tipo_documento: "piano_economico",   // è ciò che separa i piani dai progetti nell'archivio
        ambito,
        titolo,
        categoria: "Piano economico " + ambito,
        stato: val("f-stato"),
        organo_responsabile: val("f-organo"),
        luogo: val("f-luogo"),             // stesso campo dei progetti: è quello che legge CA.html
        responsabile: val("f-responsabile"),
        periodo_validita: val("f-periodo"),
        data_approvazione: val("f-data-approvazione"),
        risorse_totali: val("f-risorse"),
        sommario: val("f-sommario"),
        copertina: val("f-copertina"),
        sezioni: leggiSezioni(),
        galleria: leggiGalleria(),
        allegati: leggiAllegati(),
      };
    }
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

  async function scrivi(lista) {
    if (modo === "piano") { await APICtsu.savePiani(lista); piani = lista; }
    else { await APICtsu.saveProgetti(lista); progetti = lista; }
  }

  async function salvaProgetto(progetto) {
    const copia = listaCorrente().filter(p => p.id !== idInModifica && p.id !== progetto.id);
    copia.push(progetto);
    try {
      await scrivi(copia);
      return true;
    } catch (e) {
      mostraMessaggio("Errore salvataggio: " + e.message);
      return false;
    }
  }

  async function eliminaProgetto(id) {
    const copia = listaCorrente().filter(p => p.id !== id);
    try {
      await scrivi(copia);
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
    else if (vista === "editor") { root.innerHTML = renderEditor(extra || null); rinumera(); aggiornaAnteprime(root); }
    window.scrollTo(0, 0);
  }

  /* ---------- MAPPE: ANTEPRIMA E AZIONI ---------- */

  function aggiornaAnteprima(mappaEl) {
    const box = mappaEl.querySelector(".rm-anteprima");
    if (!box) return;
    const m = leggiMappa(mappaEl);
    const html = m.righe.length ? ctsuMappaHtml({ ...m, allineamento: "centro" }) : "";
    box.innerHTML = html || `<span class="rm-anteprima-vuota">Aggiungi almeno una riga per vedere l'anteprima.</span>`;
  }

  function aggiornaAnteprime(radice) {
    radice.querySelectorAll(".redazione-mappa").forEach(aggiornaAnteprima);
  }

  function aggiornaAnteprimaConRitardo(mappaEl) {
    clearTimeout(mappaEl._timerAnteprima);
    mappaEl._timerAnteprima = setTimeout(() => aggiornaAnteprima(mappaEl), 250);
  }

  function azioneMappa(btn) {
    const az = btn.dataset.mappa;
    const mappaEl = btn.closest(".redazione-mappa");
    if (!mappaEl) return;
    const righe = mappaEl.querySelector(".rm-righe");
    const riga = btn.closest(".rm-riga");

    if (az.startsWith("aggiungi-")) {
      const tipo = az.slice(9);
      righe.insertAdjacentHTML("beforeend", renderMappaRiga({ tipo, icone: tipo === "fermata" ? "BHF" : tipo === "nota" ? "STR" : "" }));
      const nuova = righe.lastElementChild.querySelector(".rm-nome");
      if (nuova) nuova.focus();
    } else if (az === "esempio") {
      const conTesto = [...righe.querySelectorAll(".rm-nome, .rm-km, .rm-dett")].some(i => i.value.trim());
      if (conTesto && !confirm("Sostituire le righe attuali con l'esempio?")) return;
      const ex = MAPPA_ESEMPIO();
      righe.innerHTML = ex.righe.map(renderMappaRiga).join("");
      const t = mappaEl.querySelector(".rm-titolo");
      if (t && !t.value.trim()) t.value = ex.titolo;
    } else if (az === "su" && riga && riga.previousElementSibling) {
      righe.insertBefore(riga, riga.previousElementSibling);
    } else if (az === "giu" && riga && riga.nextElementSibling) {
      righe.insertBefore(riga.nextElementSibling, riga);
    } else if (az === "dup" && riga) {
      riga.insertAdjacentHTML("afterend", renderMappaRiga(leggiRigaMappa(riga)));
    } else if (az === "rimuovi" && riga) {
      riga.remove();
    } else if (az === "reset-colore") {
      const c = btn.parentElement.querySelector('input[type="color"]');
      if (c) { c.value = c.dataset.default; c.dataset.vuoto = "1"; }
    } else if (az === "codice") {
      let campo = ultimoCampoIcone && mappaEl.contains(ultimoCampoIcone) ? ultimoCampoIcone : mappaEl.querySelector(".rm-icone");
      if (!campo) { alert("Aggiungi prima una riga alla mappa."); return; }
      const v = campo.value.trim();
      campo.value = (v ? v + " " : "") + btn.dataset.codice;
      campo.focus();
    }
    aggiornaAnteprima(mappaEl);
  }

  /* ---------- EVENTI ---------- */

  function initEventi() {
    const root = document.getElementById("redazione-root");

    root.addEventListener("click", async e => {
      const mapBtn = e.target.closest("[data-mappa]");
      if (mapBtn) { azioneMappa(mapBtn); return; }

      const azione = e.target.closest("[data-azione]");
      if (azione) {
        const a = azione.getAttribute("data-azione");
        if (a === "nuovo") { modo = "progetto"; vai("editor", null); }
        else if (a === "carica") { modo = "progetto"; vai("carica"); }
        else if (a === "nuovo-piano") { modo = "piano"; vai("editor", null); }
        else if (a === "carica-piani") { modo = "piano"; vai("carica"); }
        else if (a === "menu") vai("menu");
        return;
      }

      const mod = e.target.closest("[data-modifica]");
      if (mod) {
        const progetto = listaCorrente().find(p => p.id === mod.getAttribute("data-modifica"));
        if (progetto) vai("editor", progetto);
        return;
      }

      const del = e.target.closest("[data-elimina]");
      if (del) {
        const id = del.getAttribute("data-elimina");
        const progetto = listaCorrente().find(p => p.id === id);
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
        const campo = nuovo && nuovo.querySelector(".redazione-sez-titolo, .redazione-testo-campo, .redazione-img-url, .redazione-titolo-testo, .rm-titolo");
        aggiornaAnteprime(nuovo);
        if (campo) campo.focus();
      };

      // Primo livello: sezione, TITOLO, immagine
      const radice = document.getElementById("redazione-sezioni");
      if (e.target.id === "redazione-aggiungi-sezione") { aggiungi(radice, renderSezione({ titolo: "", testo: "", commi: [] })); return; }
      if (e.target.id === "redazione-aggiungi-titolo") { aggiungi(radice, renderTitolo({ numero: "", titolo: "" })); return; }
      if (e.target.id === "redazione-aggiungi-mappa") { aggiungi(radice, bloccoMappa(MAPPA_NUOVA())); return; }
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
        else if (tipo === "comma-mappa") aggiungi(blocco.querySelector(":scope > .redazione-commi"), renderComma({ ...MAPPA_NUOVA(), allineamento: "destra" }));
        else if (tipo === "sottocomma-mappa") aggiungi(blocco.querySelector(":scope > .redazione-sottocommi"), renderSottocomma({ ...MAPPA_NUOVA(), allineamento: "destra" }));
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
        const haMappaGrande = /mappa/.test(blocco.dataset.tipo) && blocco.querySelectorAll(".rm-riga").length > 2;
        if ((blocco.querySelector(".redazione-blocco") || haMappaGrande) &&
            !confirm("Questo blocco contiene commi, sottocommi, immagini o una mappa: verranno rimossi insieme a lui. Continuare?")) {
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
        const progetto = listaCorrente().find(p => p.id === idInModifica);
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
        mostraMessaggio(modo === "piano"
          ? "✅ Piano salvato. È pubblicato su CP.html, nella sezione dei piani " + (progetto.ambito === "unitario" ? "unitari." : "statali.")
          : "✅ Salvato sul database. Sarà visibile a tutti gli utenti del sito.");
      }
    });

    root.addEventListener("focusin", e => {
      if (e.target.classList && e.target.classList.contains("rm-icone")) ultimoCampoIcone = e.target;
    });

    root.addEventListener("input", e => {
      const mappaEl = e.target.closest && e.target.closest(".redazione-mappa");
      if (mappaEl) {
        if (e.target.type === "color") e.target.dataset.vuoto = "0";
        if (e.target.classList.contains("rm-tipo")) e.target.closest(".rm-riga").dataset.tipoRiga = e.target.value;
        aggiornaAnteprimaConRitardo(mappaEl);
        return;
      }
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
      const tutti = await APICtsu.loadTutti();
      progetti = tutti.progetti;
      piani = tutti.piani;
    } catch (e) {
      alert("Errore nel caricamento dei dati: " + e.message);
      progetti = [];
      piani = [];
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