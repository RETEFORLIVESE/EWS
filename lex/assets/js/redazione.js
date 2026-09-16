/* ============================================================
   PAGINA DI REDAZIONE
   Permette di creare e modificare gli atti tramite un semplice
   editor a form, senza dover scrivere codice in data.js.

   Come funziona il salvataggio (importante):
   - Il sito è statico (GitHub Pages), quindi nulla può essere
     scritto automaticamente sul repository da qui.
   - "Salva nell'elenco di lavoro" salva la bozza nel browser
     (localStorage): resta lì anche chiudendo la pagina, ma è
     visibile solo a te, su questo browser/computer.
   - Quando l'atto è pronto, "Scarica data.js aggiornato" genera
     il file assets/js/data.js completo, pronto da caricare su
     GitHub al posto di quello vecchio: è quello il salvataggio
     "vero e definitivo", visibile a tutti sul sito pubblicato.
   ============================================================ */

(function () {
  const KEY_OVERRIDE = "redazione_override_v1";
  const KEY_DELETED = "redazione_deleted_v1";

  let vistaCorrente = "menu"; // "menu" | "nuovo" | "carica" | "editor" | "salva"
  let idInModifica = null; // id dell'atto attualmente aperto nel form (null = nuovo)
  let articoliCorrenti = []; // righe articolo nel form attualmente aperto

  /* ---------- storage ---------- */

  function leggiOverride() {
    try {
      return JSON.parse(localStorage.getItem(KEY_OVERRIDE) || "{}");
    } catch (e) {
      return {};
    }
  }

  function scriviOverride(obj) {
    localStorage.setItem(KEY_OVERRIDE, JSON.stringify(obj));
  }

  function leggiEliminati() {
    try {
      return JSON.parse(localStorage.getItem(KEY_DELETED) || "[]");
    } catch (e) {
      return [];
    }
  }

  function scriviEliminati(arr) {
    localStorage.setItem(KEY_DELETED, JSON.stringify(arr));
  }

  /* ---------- elenco di lavoro (base + bozze - eliminati) ---------- */

  function elencoLavoro() {
    const override = leggiOverride();
    const eliminati = leggiEliminati();
    const idsBase = new Set(ATTI.map((a) => a.id));

    const daBase = ATTI.filter((a) => !eliminati.includes(a.id)).map(
      (a) => override[a.id] || a
    );

    const nuovi = Object.keys(override)
      .filter((id) => !idsBase.has(id) && !eliminati.includes(id))
      .map((id) => override[id]);

    return daBase.concat(nuovi);
  }

  function statoAtto(id) {
    const override = leggiOverride();
    const eliminati = leggiEliminati();
    const idsBase = new Set(ATTI.map((a) => a.id));
    if (eliminati.includes(id)) return "eliminato";
    if (idsBase.has(id) && override[id]) return "modificato";
    if (!idsBase.has(id) && override[id]) return "nuovo";
    return "invariato";
  }

  /* ---------- utilità ---------- */

  function slugify(testo) {
    return (testo || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  function idUnivoco(base, idDaEscludere) {
    const lavoro = elencoLavoro();
    let candidato = base || "atto";
    let n = 2;
    while (lavoro.some((a) => a.id === candidato && a.id !== idDaEscludere)) {
      candidato = `${base}-${n}`;
      n += 1;
    }
    return candidato;
  }

  function escapeHtml(testo) {
    return (testo || "").toString().replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function categorieDisponibili() {
    const set = new Set(elencoLavoro().map((a) => a.categoria).filter(Boolean));
    ["Statuto Costituzionale", "Regolamento", "Codice", "Editto", "Decreto"].forEach((c) =>
      set.add(c)
    );
    return Array.from(set);
  }

  let messaggioStato = "";

  function mostraMessaggio(testo) {
    messaggioStato = testo;
    const el = document.getElementById("redazione-messaggio");
    if (el) {
      el.textContent = testo;
      el.style.display = testo ? "block" : "none";
    }
  }

  /* ---------- render: menu principale ---------- */

  function renderMenu() {
    const lavoro = elencoLavoro();
    const modificati = lavoro.filter((a) => statoAtto(a.id) !== "invariato").length;

    return `
      <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; Redazione</p>
      <h1 style="margin-bottom:4px;">Redazione degli atti</h1>
      <p style="color:var(--inchiostro-tenue); max-width:60ch; margin-top:0;">
        Crea o modifica gli atti compilando un semplice modulo, senza toccare il codice.
        Le modifiche restano salvate in questo browser finché non esporti il file aggiornato.
      </p>

      <div class="redazione-menu">
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
        <button type="button" class="redazione-card" data-azione="salva">
          <span class="redazione-card__numero">3</span>
          <span class="redazione-card__titolo">Salva ed esporta</span>
          <span class="redazione-card__desc">
            ${modificati > 0 ? modificati + " atto/i con modifiche non ancora esportate." : "Nessuna modifica in sospeso."}
          </span>
        </button>
      </div>
    `;
  }

  /* ---------- render: elenco per "carica esistente" ---------- */

  function renderCarica() {
    const lavoro = elencoLavoro().slice().sort((a, b) => a.titolo.localeCompare(b.titolo));

    const righe = lavoro
      .map((a) => {
        const st = statoAtto(a.id);
        const badge =
          st === "nuovo"
            ? `<span class="redazione-badge redazione-badge--nuovo">nuovo</span>`
            : st === "modificato"
            ? `<span class="redazione-badge redazione-badge--modificato">modificato</span>`
            : "";
        return `
          <div class="redazione-riga" data-id="${escapeHtml(a.id)}">
            <div>
              <span class="badge-categoria">${escapeHtml(a.categoria)}</span>
              ${badge}
              <p class="redazione-riga__titolo">${escapeHtml(a.titolo)}</p>
              <p class="redazione-riga__meta">n. ${escapeHtml(a.numero)}/${escapeHtml(a.anno)} &middot; ${a.articoli.length} articoli</p>
            </div>
            <div class="redazione-riga__azioni">
              <button type="button" class="redazione-btn redazione-btn--piccolo" data-modifica="${escapeHtml(a.id)}">Modifica</button>
              <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-elimina="${escapeHtml(a.id)}">Elimina</button>
            </div>
          </div>
        `;
      })
      .join("");

    return `
      <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; <a href="redazione.html">Redazione</a> &rsaquo; Carica atto esistente</p>
      <h1>Carica atto esistente</h1>
      <input type="text" id="redazione-filtro" placeholder="Filtra per titolo o categoria&hellip;" style="width:100%; max-width:420px; padding:10px 14px; border:1px solid var(--bordo); border-radius:var(--radius); font-family:var(--font-chrome); margin-bottom:16px;" />
      <div id="redazione-elenco-carica">${righe || "<p>Nessun atto presente.</p>"}</div>
      <p style="margin-top:20px;"><button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">&larr; Torna al menu</button></p>
    `;
  }

  /* ---------- render: pannello salva/esporta ---------- */

  function generaContenutoDataJs() {
    const lavoro = elencoLavoro();

    const blocchi = lavoro.map((atto) => {
      const articoli = atto.articoli
        .map(
          (art) => `      {
        numero: ${JSON.stringify(art.numero)},
        rubrica: ${JSON.stringify(art.rubrica)},
        testo: ${JSON.stringify(art.testo)},
      }`
        )
        .join(",\n");

      return `  {
    id: ${JSON.stringify(atto.id)},
    categoria: ${JSON.stringify(atto.categoria)},
    numero: ${JSON.stringify(atto.numero)},
    anno: ${JSON.stringify(atto.anno)},
    titolo: ${JSON.stringify(atto.titolo)},
    dataEmanazione: ${JSON.stringify(atto.dataEmanazione)},
    promulgatoDa: ${JSON.stringify(atto.promulgatoDa)},
    stato: ${JSON.stringify(atto.stato)},
    sommario: ${JSON.stringify(atto.sommario)},
    articoli: [
${articoli}
    ],
  }`;
    });

    return `/* ============================================================
   BASE DATI DEGLI ATTI NORMATIVI
   File generato dalla pagina di redazione (redazione.html).
   Puoi continuare a modificarlo a mano oppure tramite la
   pagina di redazione.
   ============================================================ */

const ATTI = [
${blocchi.join(",\n")}
];
`;
  }

  function scaricaTesto(nomeFile, contenuto) {
    const blob = new Blob([contenuto], { type: "text/javascript;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function renderSalva() {
    const lavoro = elencoLavoro();
    const conModifiche = lavoro.filter((a) => statoAtto(a.id) !== "invariato");

    const righe = conModifiche
      .map((a) => {
        const st = statoAtto(a.id);
        return `<li><strong>${escapeHtml(a.titolo)}</strong> — <em>${st}</em></li>`;
      })
      .join("");

    return `
      <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; <a href="redazione.html">Redazione</a> &rsaquo; Salva ed esporta</p>
      <h1>Salva ed esporta</h1>

      <div class="redazione-riquadro">
        <h3 style="margin-top:0;">Come funziona qui</h3>
        <p>Il sito è statico: la redazione non può scrivere da sola sul repository GitHub. Le bozze restano salvate <strong>in questo browser</strong> (localStorage) finché non le esporti.</p>
        <p>Quando sei pronto, premi <strong>"Scarica data.js aggiornato"</strong>: otterrai il file completo, pronto da caricare su GitHub al posto di <code>assets/js/data.js</code> (Add file &rarr; Upload files, sovrascrivendo il file esistente). Da quel momento le modifiche saranno visibili sul sito pubblicato.</p>
      </div>

      <h3>Modifiche in sospeso (${conModifiche.length})</h3>
      ${conModifiche.length ? `<ul>${righe}</ul>` : "<p>Nessuna modifica in sospeso: l'elenco corrisponde a data.js.</p>"}

      <div class="redazione-azioni-form" style="margin-top:20px;">
        <button type="button" class="redazione-btn redazione-btn--primario" id="redazione-esporta">Scarica data.js aggiornato</button>
        <button type="button" class="redazione-btn redazione-btn--pericolo" id="redazione-reset">Annulla tutte le bozze locali</button>
        <button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">&larr; Torna al menu</button>
      </div>
    `;
  }

  /* ---------- render: editor (nuovo / modifica) ---------- */

  function nuovoArticoloVuoto(numero) {
    return { numero: numero, rubrica: "", testo: "" };
  }

  function renderRigaArticolo(art, indice) {
    return `
      <div class="redazione-articolo" data-indice="${indice}">
        <div class="redazione-articolo__intestazione">
          <span>Articolo</span>
          <input type="text" class="redazione-art-numero" value="${escapeHtml(art.numero)}" style="width:70px;" />
          <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi-articolo="${indice}" style="margin-left:auto;">Rimuovi</button>
        </div>
        <input type="text" class="redazione-art-rubrica" placeholder="Rubrica dell'articolo" value="${escapeHtml(art.rubrica)}" />
        <textarea class="redazione-art-testo" placeholder="Testo dell'articolo" rows="4">${escapeHtml(art.testo)}</textarea>
      </div>
    `;
  }

  function renderEditor(atto) {
    idInModifica = atto ? atto.id : null;
    articoliCorrenti = atto ? atto.articoli.map((a) => ({ ...a })) : [nuovoArticoloVuoto(1)];

    const cat = atto ? atto.categoria : "";
    const opzioniCategoria = categorieDisponibili()
      .map((c) => `<option value="${escapeHtml(c)}" ${c === cat ? "selected" : ""}>${escapeHtml(c)}</option>`)
      .join("");

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
            <select id="f-categoria">${opzioniCategoria}</select>
          </div>
          <div class="redazione-campo">
            <label for="f-categoria-nuova">Oppure nuova categoria</label>
            <input type="text" id="f-categoria-nuova" placeholder="Lascia vuoto per usare quella scelta sopra" />
          </div>
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo">
            <label for="f-numero">Numero</label>
            <input type="text" id="f-numero" value="${atto ? escapeHtml(atto.numero) : ""}" />
          </div>
          <div class="redazione-campo">
            <label for="f-anno">Anno</label>
            <input type="text" id="f-anno" value="${atto ? escapeHtml(atto.anno) : new Date().getFullYear()}" />
          </div>
          <div class="redazione-campo">
            <label for="f-stato">Stato</label>
            <select id="f-stato">
              <option value="vigente" ${!atto || atto.stato === "vigente" ? "selected" : ""}>vigente</option>
              <option value="abrogato" ${atto && atto.stato === "abrogato" ? "selected" : ""}>abrogato</option>
            </select>
          </div>
        </div>

        <div class="redazione-riga-campi">
          <div class="redazione-campo">
            <label for="f-data">Data di emanazione</label>
            <input type="text" id="f-data" placeholder="es. 12 agosto 2024" value="${atto ? escapeHtml(atto.dataEmanazione) : ""}" />
          </div>
          <div class="redazione-campo">
            <label for="f-promulgato">Promulgato da</label>
            <input type="text" id="f-promulgato" value="${atto ? escapeHtml(atto.promulgatoDa) : ""}" />
          </div>
        </div>

        <div class="redazione-campo">
          <label for="f-sommario">Sommario (mostrato nell'elenco)</label>
          <textarea id="f-sommario" rows="2">${atto ? escapeHtml(atto.sommario) : ""}</textarea>
        </div>

        <div class="redazione-campo">
          <label for="f-id">Identificativo URL (id)</label>
          <input type="text" id="f-id" value="${atto ? escapeHtml(atto.id) : ""}" placeholder="generato automaticamente dal titolo se lasciato vuoto" />
        </div>

        <h3>Articoli</h3>
        <div id="redazione-articoli">
          ${articoliCorrenti.map((a, i) => renderRigaArticolo(a, i)).join("")}
        </div>
        <button type="button" class="redazione-btn redazione-btn--secondario" id="redazione-aggiungi-articolo">+ Aggiungi articolo</button>

        <div class="redazione-azioni-form">
          <button type="submit" class="redazione-btn redazione-btn--primario">Salva nell'elenco di lavoro</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" data-azione="menu">Annulla</button>
          ${atto ? `<button type="button" class="redazione-btn redazione-btn--pericolo" id="redazione-elimina-corrente">Elimina questo atto</button>` : ""}
        </div>
      </form>
    `;
  }

  /* ---------- raccolta dati dal form ---------- */

  function leggiArticoliDalForm() {
    return Array.from(document.querySelectorAll("#redazione-articoli .redazione-articolo")).map(
      (el) => ({
        numero: el.querySelector(".redazione-art-numero").value.trim() || "1",
        rubrica: el.querySelector(".redazione-art-rubrica").value.trim(),
        testo: el.querySelector(".redazione-art-testo").value.trim(),
      })
    );
  }

  function raccogliAtto() {
    const titolo = document.getElementById("f-titolo").value.trim();
    const categoriaNuova = document.getElementById("f-categoria-nuova").value.trim();
    const categoria = categoriaNuova || document.getElementById("f-categoria").value;
    const idCampo = document.getElementById("f-id").value.trim();
    const idBase = slugify(idCampo || titolo);
    const id = idUnivoco(idBase, idInModifica);

    return {
      id,
      categoria,
      numero: document.getElementById("f-numero").value.trim(),
      anno: document.getElementById("f-anno").value.trim(),
      titolo,
      dataEmanazione: document.getElementById("f-data").value.trim(),
      promulgatoDa: document.getElementById("f-promulgato").value.trim(),
      stato: document.getElementById("f-stato").value,
      sommario: document.getElementById("f-sommario").value.trim(),
      articoli: leggiArticoliDalForm(),
    };
  }

  /* ---------- salvataggio/eliminazione nell'elenco di lavoro ---------- */

  function salvaNellElencoDiLavoro(atto) {
    const override = leggiOverride();
    let eliminati = leggiEliminati();

    // se stavo modificando un id e l'ho cambiato, sposto la vecchia voce
    if (idInModifica && idInModifica !== atto.id && override[idInModifica]) {
      delete override[idInModifica];
    }

    override[atto.id] = atto;
    eliminati = eliminati.filter((id) => id !== atto.id);

    scriviOverride(override);
    scriviEliminati(eliminati);
  }

  function eliminaAtto(id) {
    const override = leggiOverride();
    const idsBase = new Set(ATTI.map((a) => a.id));

    if (idsBase.has(id)) {
      const eliminati = leggiEliminati();
      if (!eliminati.includes(id)) eliminati.push(id);
      scriviEliminati(eliminati);
      delete override[id];
      scriviOverride(override);
    } else {
      delete override[id];
      scriviOverride(override);
    }
  }

  /* ---------- routing interno ---------- */

  function vai(vista, extra) {
    vistaCorrente = vista;
    const root = document.getElementById("redazione-root");

    if (vista === "menu") {
      root.innerHTML = renderMenu();
    } else if (vista === "carica") {
      root.innerHTML = renderCarica();
    } else if (vista === "salva") {
      root.innerHTML = renderSalva();
    } else if (vista === "editor") {
      root.innerHTML = renderEditor(extra || null);
    }

    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  /* ---------- eventi (delegazione sul contenitore principale) ---------- */

  function initEventi() {
    const root = document.getElementById("redazione-root");

    root.addEventListener("click", function (e) {
      const btnAzione = e.target.closest("[data-azione]");
      if (btnAzione) {
        const azione = btnAzione.getAttribute("data-azione");
        if (azione === "nuovo") vai("editor", null);
        else if (azione === "carica") vai("carica");
        else if (azione === "salva") vai("salva");
        else if (azione === "menu") vai("menu");
        return;
      }

      const btnModifica = e.target.closest("[data-modifica]");
      if (btnModifica) {
        const id = btnModifica.getAttribute("data-modifica");
        const atto = elencoLavoro().find((a) => a.id === id);
        if (atto) vai("editor", atto);
        return;
      }

      const btnElimina = e.target.closest("[data-elimina]");
      if (btnElimina) {
        const id = btnElimina.getAttribute("data-elimina");
        const atto = elencoLavoro().find((a) => a.id === id);
        if (atto && confirm(`Eliminare "${atto.titolo}" dall'elenco di lavoro?`)) {
          eliminaAtto(id);
          vai("carica");
        }
        return;
      }

      const btnRimuoviArt = e.target.closest("[data-rimuovi-articolo]");
      if (btnRimuoviArt) {
        const righe = document.querySelectorAll("#redazione-articoli .redazione-articolo");
        if (righe.length <= 1) {
          alert("Deve rimanere almeno un articolo.");
          return;
        }
        btnRimuoviArt.closest(".redazione-articolo").remove();
        return;
      }

      if (e.target.id === "redazione-aggiungi-articolo") {
        const contenitore = document.getElementById("redazione-articoli");
        const n = contenitore.querySelectorAll(".redazione-articolo").length + 1;
        contenitore.insertAdjacentHTML("beforeend", renderRigaArticolo(nuovoArticoloVuoto(n), n));
        return;
      }

      if (e.target.id === "redazione-elimina-corrente" && idInModifica) {
        const override = leggiOverride();
        const atto = override[idInModifica] || ATTI.find((a) => a.id === idInModifica);
        if (atto && confirm(`Eliminare "${atto.titolo}"?`)) {
          eliminaAtto(idInModifica);
          vai("menu");
        }
        return;
      }

      if (e.target.id === "redazione-esporta") {
        const contenuto = generaContenutoDataJs();
        scaricaTesto("data.js", contenuto);
        mostraMessaggio("File data.js scaricato. Caricalo su GitHub al posto di assets/js/data.js.");
        return;
      }

      if (e.target.id === "redazione-reset") {
        if (confirm("Annullare tutte le bozze salvate in questo browser? L'operazione non è reversibile.")) {
          localStorage.removeItem(KEY_OVERRIDE);
          localStorage.removeItem(KEY_DELETED);
          vai("menu");
        }
        return;
      }
    });

    root.addEventListener("submit", function (e) {
      if (e.target.id !== "redazione-form") return;
      e.preventDefault();

      const titolo = document.getElementById("f-titolo").value.trim();
      if (!titolo) {
        alert("Inserisci almeno il titolo dell'atto.");
        return;
      }

      const atto = raccogliAtto();
      salvaNellElencoDiLavoro(atto);
      vai("editor", atto);
      mostraMessaggio("Bozza salvata in questo browser. Esporta il data.js quando hai finito (menu &rarr; Salva ed esporta).");
    });

    root.addEventListener("input", function (e) {
      if (e.target.id === "redazione-filtro") {
        const q = e.target.value.trim().toLowerCase();
        document.querySelectorAll("#redazione-elenco-carica .redazione-riga").forEach((riga) => {
          const testo = riga.textContent.toLowerCase();
          riga.style.display = testo.includes(q) ? "" : "none";
        });
      }
    });
  }

  /* ---------- init ---------- */

  function init() {
    renderTestata("redazione");
    renderFooter();
    initEventi();
    vai("menu");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
