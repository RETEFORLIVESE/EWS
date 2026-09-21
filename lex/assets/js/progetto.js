// assets/js/progetto.js — pagina di dettaglio di un progetto CTSU (stesso pattern di atto.js/NormAktiv).
//
// Struttura di progetto.sezioni (retrocompatibile: i vecchi progetti, con solo { titolo, testo }, funzionano invariati):
//   { tipo: "sezione", titolo, testo, commi: [ ... ] }   // "tipo" assente = sezione
//   { tipo: "titolo",  numero, titolo }                   // TITOLO I - NOME: raggruppa le sezioni che seguono
//   { tipo: "immagine", url, didascalia }                 // immagine fra una sezione e l'altra
//
// Un comma è  { testo, sottocommi: [ ... ] }  oppure  { tipo: "immagine", url, didascalia }.
// Un sottocomma è  { testo }  oppure  { tipo: "immagine", url, didascalia }.
//
// Numerazione (fatta qui, non salvata): le sezioni contano solo le sezioni, i commi solo i commi di testo,
// i sottocommi (a, b, c...) solo i sottocommi di testo; le immagini non consumano numeri.
// Ancore: #sez-N, #sez-N-c-M, #sez-N-c-M-s-K, #tit-N.
(function () {
  const escAttr = t => (t == null ? "" : t).toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function urlSicuro(valore) {
    const u = (valore || "").toString().trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }

  const lettera = n => (n <= 26 ? String.fromCharCode(96 + n) : String(n));   // 1 -> a, 2 -> b ...

  /* ---------- LETTURA DELLA STRUTTURA ---------- */

  // Sottocommi di un comma, con la lettera già calcolata.
  function leggiSottocommi(comma) {
    let l = 0;
    return (Array.isArray(comma.sottocommi) ? comma.sottocommi : []).map(y => {
      if (!y || typeof y !== "object") return null;
      if (y.tipo === "immagine") return { immagine: true, dati: y };
      l++;
      return { immagine: false, n: l, dati: y };
    }).filter(Boolean);
  }

  // Commi di una sezione, con il numero già calcolato.
  function leggiCommi(sezione) {
    let c = 0;
    return (Array.isArray(sezione.commi) ? sezione.commi : []).map(x => {
      if (!x || typeof x !== "object") return null;
      if (x.tipo === "immagine") return { immagine: true, dati: x };
      c++;
      return { immagine: false, n: c, dati: x, sotto: leggiSottocommi(x) };
    }).filter(Boolean);
  }

  // Blocchi di primo livello (sezioni, titoli, immagini) con numerazione separata per tipo.
  function leggiBlocchi(progetto) {
    let s = 0, t = 0;
    return (Array.isArray(progetto.sezioni) ? progetto.sezioni : []).map(b => {
      if (!b || typeof b !== "object") return null;
      if (b.tipo === "titolo") { t++; return { tipo: "titolo", n: t, dati: b }; }
      if (b.tipo === "immagine") return { tipo: "immagine", n: 0, dati: b };
      s++;
      return { tipo: "sezione", n: s, dati: b, commi: leggiCommi(b) };
    }).filter(Boolean);
  }

  // "TITOLO I - FORMA DELLO STATO": senza numero d'articolo/sezione accanto.
  function etichettaTitolo(b) {
    const numero = (b.dati.numero || "").toString().trim() || ctsuRomano(b.n);
    const nome = (b.dati.titolo || "").toString().trim();
    return ("TITOLO " + numero + (nome ? " - " + nome : "")).toLocaleUpperCase("it-IT");
  }

  /* ---------- HTML ---------- */

  // Copertina: va SOPRA l'indice, nella colonna di sinistra
  // (stessa posizione dell'immagine di un atto in NormAktiv).
  function htmlCopertina(progetto) {
    const src = urlSicuro(progetto.copertina);
    if (!src) return "";
    return `
      <figure class="immagine-atto">
        <img src="${escAttr(src)}" alt="${escAttr(progetto.titolo)}" loading="lazy"
             onerror="this.closest('figure').style.display='none'">
      </figure>`;
  }

  // Immagine inserita nel testo (fra le sezioni, come comma o come sottocomma).
  function htmlImmagineTesto(g, progetto) {
    const src = urlSicuro(g.url);
    if (!src) return "";
    const didascalia = (g.didascalia || "").toString().trim();
    return `<figure class="immagine-atto immagine-testo"><img src="${escAttr(src)}" alt="${escAttr(didascalia || progetto.titolo)}" loading="lazy" onerror="this.closest('figure').style.display='none'">${didascalia ? `<figcaption>${escAttr(didascalia)}</figcaption>` : ""}</figure>`;
  }

  function htmlIndice(progetto) {
    const voci = leggiBlocchi(progetto).map(b => {
      if (b.tipo === "titolo") {
        return `<li class="indice-titolo-gruppo"><a href="#tit-${b.n}">${escAttr(etichettaTitolo(b))}</a></li>`;
      }
      if (b.tipo !== "sezione") return "";

      const commi = b.commi.filter(c => !c.immagine).map(c => {
        const sotto = c.sotto.filter(y => !y.immagine).map(y =>
          `<li><a href="#sez-${b.n}-c-${c.n}-s-${y.n}">lett. ${lettera(y.n)})</a></li>`
        ).join("");
        return `<li><a href="#sez-${b.n}-c-${c.n}">Comma ${c.n}</a>${sotto ? `<ul class="indice-sottocommi">${sotto}</ul>` : ""}</li>`;
      }).join("");

      return `<li><a href="#sez-${b.n}">${escAttr(b.dati.titolo || `Sezione ${b.n}`)}</a>${commi ? `<ul class="indice-commi">${commi}</ul>` : ""}</li>`;
    }).join("");

    if (!voci) return "";
    let extra = "";
    if ((progetto.galleria || []).length) extra += `<li><a href="#galleria-progetto">Galleria fotografica</a></li>`;
    if ((progetto.allegati || []).length) extra += `<li><a href="#allegati-progetto">Allegati</a></li>`;
    return `
      <nav class="indice-articoli" aria-label="Indice del progetto">
        <h2>Indice</h2>
        <ol>${voci}${extra}</ol>
      </nav>`;
  }

  // ATTENZIONE: dentro ".comma" gli a-capo del sorgente HTML verrebbero mostrati
  // (il CSS usa white-space: pre-line), quindi questi pezzi sono costruiti senza spazi né a-capo.
  function htmlSottocommi(sotto, idBase, progetto) {
    if (!sotto.length) return "";
    const voci = sotto.map(y => {
      if (y.immagine) {
        const img = htmlImmagineTesto(y.dati, progetto);
        return img ? `<li class="sottocomma-immagine">${img}</li>` : "";
      }
      // value = numero d'ordine: così la lettera resta giusta anche con immagini in mezzo
      return `<li value="${y.n}" id="${idBase}-s-${y.n}">${y.dati.testo || ""}</li>`;
    }).join("");
    return `<ol class="sottocommi">${voci}</ol>`;
  }

  function htmlCommi(sezione, progetto) {
    return sezione.commi.map(c => {
      if (c.immagine) {
        const img = htmlImmagineTesto(c.dati, progetto);
        return img ? `<div class="comma">${img}</div>` : "";
      }
      const id = `sez-${sezione.n}-c-${c.n}`;
      return `<div class="comma" id="${id}"><p><span class="comma__numero">${c.n}.</span> ${c.dati.testo || ""}</p>${htmlSottocommi(c.sotto, id, progetto)}</div>`;
    }).join("");
  }

  function htmlBlocchi(progetto) {
    return leggiBlocchi(progetto).map(b => {
      if (b.tipo === "titolo") {
        return `<div class="titolo-gruppo" id="tit-${b.n}"><h2>${escAttr(etichettaTitolo(b))}</h2></div>`;
      }
      if (b.tipo === "immagine") {
        return htmlImmagineTesto(b.dati, progetto);
      }
      const intro = (b.dati.testo || "").toString().trim()
        ? `<div class="comma"><p>${b.dati.testo}</p></div>`
        : "";
      return `
      <article class="articolo" id="sez-${b.n}">
        <h3>${escAttr(b.dati.titolo || `Sezione ${b.n}`)}</h3>
        ${intro}${htmlCommi(b, progetto)}
      </article>`;
    }).join("");
  }

  function htmlGalleria(progetto) {
    const galleria = progetto.galleria || [];
    if (!galleria.length) return "";
    const celle = galleria.map(g => {
      const src = urlSicuro(g.url);
      if (!src) return "";
      return `
        <figure class="immagine-atto" style="margin:0;">
          <img src="${escAttr(src)}" alt="${escAttr(g.didascalia || progetto.titolo)}" loading="lazy"
               onerror="this.closest('figure').style.display='none'">
          ${g.didascalia ? `<figcaption>${escAttr(g.didascalia)}</figcaption>` : ""}
        </figure>`;
    }).join("");
    return `
      <section id="galleria-progetto" style="margin-top:32px;">
        <h2 class="sezione-titolo">Galleria fotografica</h2>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px;">
          ${celle}
        </div>
      </section>`;
  }

  function htmlAllegati(progetto) {
    const allegati = progetto.allegati || [];
    if (!allegati.length) return "";
    const righe = allegati.map(a => {
      const href = urlSicuro(a.url);
      if (!href) return "";
      return `<li><a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">📎 ${escAttr(a.titolo || href)}</a></li>`;
    }).join("");
    return `
      <section id="allegati-progetto" style="margin-top:32px;">
        <h2 class="sezione-titolo">Allegati</h2>
        <ul class="elenco-allegati">${righe}</ul>
      </section>`;
  }

  async function init() {
    renderTestataCtsu("home");
    renderFooterCtsu();

    const id = new URLSearchParams(window.location.search).get("id");
    const root = document.getElementById("progetto-root");

    let progetti = [];
    try {
      progetti = await APICtsu.loadProgetti();
    } catch (e) {
      root.innerHTML = `<div class="nessun-risultato">Errore nel caricamento del progetto.</div>`;
      return;
    }

    const progetto = progetti.find(p => p.id === id);
    if (!progetto) {
      root.innerHTML = `
        <p class="breadcrumb"><a href="ctsu.html">Home</a> &rsaquo; Progetto non trovato</p>
        <div class="nessun-risultato">
          Il progetto richiesto non è stato trovato. Torna alla <a href="ctsu.html">home</a>.
        </div>`;
      document.title = "Progetto non trovato — " + SITE_CONFIG_CTSU.nomeFazione;
      return;
    }

    document.title = progetto.titolo + " — " + SITE_CONFIG_CTSU.nomeFazione;

    // Il campo "luogo" contiene l'ID di una voce di luoghi (lo stesso di CA.html):
    // qui si mostra il nome. Se l'ID non si trova (o i luoghi non si leggono) resta il valore salvato.
    let nomeLuogo = progetto.luogo || "";
    if (nomeLuogo) {
      try {
        const voce = ctsuCercaLuogo(await APICtsu.loadLuoghi(), nomeLuogo);
        if (voce && voce.nome) nomeLuogo = voce.nome;
      } catch (e) { /* si lascia il valore salvato */ }
    }

    root.innerHTML = `
      <p class="breadcrumb">
        <a href="ctsu.html">Home</a> &rsaquo;
        <a href="ctsu.html?categoria=${encodeURIComponent(progetto.categoria || "")}">${escAttr(progetto.categoria)}</a> &rsaquo;
        ${escAttr(progetto.titolo)}
      </p>
      <section class="intestazione-atto">
        <div class="intestazione-atto__meta">
          <span class="badge-categoria">${escAttr(progetto.categoria)}</span>
          <span class="badge-stato">${escAttr(progetto.stato)}</span>
        </div>
        <h1>${escAttr(progetto.titolo)}</h1>
        <p>${escAttr(progetto.sommario)}</p>
        <dl class="intestazione-atto__dati">
          <div><dt>Organo responsabile</dt><dd>${escAttr(progetto.organo_responsabile || "—")}</dd></div>
          <div><dt>Luogo</dt><dd>${escAttr(nomeLuogo || "—")}</dd></div>
          <div><dt>Responsabile di progetto</dt><dd>${escAttr(progetto.responsabile || "—")}</dd></div>
          <div><dt>Data di inizio</dt><dd>${escAttr(progetto.data_inizio || "—")}</dd></div>
          <div><dt>Fine prevista</dt><dd>${escAttr(progetto.data_fine_prevista || "—")}</dd></div>
          <div><dt>Completamento</dt><dd>${escAttr(progetto.data_completamento || "—")}</dd></div>
          <div><dt>Budget previsto</dt><dd>${escAttr(progetto.budget_previsto || "—")}</dd></div>
          <div><dt>Costo effettivo</dt><dd>${escAttr(progetto.costo_effettivo || "—")}</dd></div>
        </dl>
      </section>
      <div class="corpo-atto">
        <div class="colonna-indice">
          ${htmlCopertina(progetto)}
          ${htmlIndice(progetto)}
        </div>
        <div class="articoli">
          ${htmlBlocchi(progetto)}
          ${htmlGalleria(progetto)}
          ${htmlAllegati(progetto)}
        </div>
      </div>`;

    // Se l'indirizzo contiene un'ancora (#sez-2-c-1...), il contenuto è stato creato dopo il
    // caricamento della pagina: si riposiziona a mano la vista.
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
