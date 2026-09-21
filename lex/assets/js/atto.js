(function () {
  // Immagine facoltativa dell'atto: un quadrato largo quanto l'indice, posizionato
  // sopra l'indice (colonna di sinistra) e sotto il pannello dei dati generali.
  // Nell'atto si salvano i campi "immagine" (nome del file o indirizzo) e "didascalia".
  // Sono accettati indirizzi http(s) e percorsi relativi al sito; qualunque altro schema
  // (javascript:, data:, ...) viene scartato.
  const escAttr = t => (t == null ? "" : t).toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function urlImmagineSicuro(valore) {
    const u = (valore || "").toString().trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }

  function htmlImmagineAtto(atto) {
    const src = urlImmagineSicuro(atto.immagine);
    if (!src) return "";
    const didascalia = (atto.didascalia || "").toString().trim();
    return `
      <figure class="immagine-atto">
        <img src="${escAttr(src)}" alt="${escAttr(didascalia || atto.titolo)}" loading="lazy"
             onerror="this.closest('figure').style.display='none'">
        ${didascalia ? `<figcaption>${escAttr(didascalia)}</figcaption>` : ""}
      </figure>`;
  }

  // Risolve i codici salvati in atto.luoghi nei rispettivi nomi leggibili,
  // leggendo organi.json dal repo pubblico RETEFORLIVESE/DATA (stessa fonte
  // usata in redazione.js per compilare l'elenco). Se un codice non viene
  // trovato nella mappa, si mostra il codice stesso.
  async function caricaMappaLuoghi() {
    try {
      const res = await fetch("https://raw.githubusercontent.com/RETEFORLIVESE/DATA/main/organi.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const dati = await res.json();
      const luoghi = (dati && dati.luoghi) || {};
      const mappa = {};
      Object.values(luoghi).forEach(valoreCategoria => {
        if (!valoreCategoria || typeof valoreCategoria !== "object") return;
        Object.entries(valoreCategoria).forEach(([codice, voce]) => {
          mappa[codice] = typeof voce === "string" ? voce : (voce && voce.nome) || codice;
        });
      });
      return mappa;
    } catch (e) {
      return {};
    }
  }

  function htmlLuoghiAtto(atto, mappaLuoghi) {
    const codici = Array.isArray(atto.luoghi) ? atto.luoghi : [];
    if (!codici.length) return "";
    const pillole = codici.map(c =>
      `<span class="badge-categoria" title="${escAttr(c)}">📍 ${escAttr(mappaLuoghi[c] || c)}</span>`
    ).join(" ");
    return `<div class="intestazione-atto__luoghi" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">${pillole}</div>`;
  }

  async function init() {
    renderTestata("home");
    renderFooter();

    const id = new URLSearchParams(window.location.search).get("id");
    const root = document.getElementById("atto-root");

    let atti = [];
    try {
      atti = await API.loadAtti();
    } catch (e) {
      root.innerHTML = `<div class="nessun-risultato">Errore nel caricamento dell'atto.</div>`;
      return;
    }

    const atto = atti.find(a => a.id === id);
    if (!atto) {
      root.innerHTML = `
        <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; Atto non trovato</p>
        <div class="nessun-risultato">
          L'atto richiesto non è stato trovato. Torna alla <a href="index.html">home</a>.
        </div>`;
      document.title = "Atto non trovato — " + SITE_CONFIG.nomeFazione;
      return;
    }

    document.title = atto.titolo + " — " + SITE_CONFIG.nomeFazione;

    const mappaLuoghi = (Array.isArray(atto.luoghi) && atto.luoghi.length)
      ? await caricaMappaLuoghi()
      : {};

    const badgeStato = atto.stato === "vigente"
      ? `<span class="badge-stato">vigente</span>`
      : `<span class="badge-stato abrogato">abrogato</span>`;

    // Indice: per ogni articolo mostriamo il link principale e, quando
    // l'articolo ha più di un comma, un sotto-elenco con i link ai singoli commi.
    const indice = atto.articoli.map(art => {
      if (eTitoloGruppo(art)) {
        return `<li class="indice-titolo-gruppo">${art.testo}</li>`;
      }
      const commi = commiDiArticolo(art);

      // Elenco delle lettere dei sottocommi di un comma, per l'indice
      const indiceSottocommi = (comma, ic) => {
        const sottocommi = (comma.sottocommi || []).filter(s => s && s.trim() !== "");
        return sottocommi.length
          ? `<ul class="indice-sottocommi">${sottocommi.map((s, is) =>
              `<li><a href="#art-${art.numero}-c${ic + 1}-s${is + 1}">${letteraDa(is)})</a></li>`).join("")}</ul>`
          : "";
      };

      let sottoIndice = "";
      if (commi.length > 1) {
        // Più commi: un livello "Comma N", ed eventuali sottocommi annidati sotto ciascuno
        sottoIndice = `<ul class="indice-commi">${commi.map((c, ic) =>
          `<li><a href="#art-${art.numero}-c${ic + 1}">Comma ${ic + 1}</a>${indiceSottocommi(c, ic)}</li>`
        ).join("")}</ul>`;
      } else {
        // Comma unico: se ha sottocommi, li mostriamo direttamente sotto l'articolo
        const soloSottocommi = indiceSottocommi(commi[0], 0);
        if (soloSottocommi) sottoIndice = soloSottocommi;
      }

      return `<li><a href="#art-${art.numero}">Art. ${art.numero} &mdash; ${art.rubrica}</a>${sottoIndice}</li>`;
    }).join("");

    // Corpo degli articoli: ogni comma è un blocco separato e numerato (solo se
    // ce n'è più d'uno, per non appesantire gli articoli semplici a comma unico);
    // i sottocommi, se presenti, sono resi come elenco lettera a), b), c)...
    const articoli = atto.articoli.map(art => {
      if (eTitoloGruppo(art)) {
        return `<div class="titolo-gruppo"><h2>${art.testo}</h2></div>`;
      }
      const commi = commiDiArticolo(art);
      const corpoCommi = commi.map((comma, ic) => {
        const sottocommi = (comma.sottocommi || []).filter(s => s && s.trim() !== "");
        const listaSottocommi = sottocommi.length
          ? `<ol class="sottocommi">${sottocommi.map((s, is) =>
              `<li id="art-${art.numero}-c${ic + 1}-s${is + 1}">${s}</li>`).join("")}</ol>`
          : "";
        const numeroComma = commi.length > 1 ? `<span class="comma__numero">${ic + 1}.</span> ` : "";
        return `
          <div class="comma" id="art-${art.numero}-c${ic + 1}">
            <p>${numeroComma}${comma.testo}</p>
            ${listaSottocommi}
          </div>`;
      }).join("");

      return `
        <article class="articolo" id="art-${art.numero}">
          <span class="articolo__numero">Articolo ${art.numero}</span>
          <h3>${art.rubrica}</h3>
          ${corpoCommi}
        </article>`;
    }).join("");

    root.innerHTML = `
      <p class="breadcrumb">
        <a href="index.html">Home</a> &rsaquo;
        <a href="index.html?categoria=${encodeURIComponent(atto.categoria)}">${atto.categoria}</a> &rsaquo;
        ${atto.titolo}
      </p>
      <section class="intestazione-atto">
        <div class="intestazione-atto__meta">
          <span class="badge-categoria">${atto.categoria}</span>
          ${badgeStato}
        </div>
        <h1>${atto.titolo}</h1>
        <p>${atto.sommario}</p>
        ${htmlLuoghiAtto(atto, mappaLuoghi)}
        <dl class="intestazione-atto__dati">
          <div><dt>Numero</dt><dd>${atto.numero}/${atto.anno}</dd></div>
          <div><dt>Data di emanazione</dt><dd>${atto.dataEmanazione}</dd></div>
          <div><dt>Promulgato da</dt><dd>${atto.promulgatoDa}</dd></div>
          <div><dt>Articoli</dt><dd>${atto.articoli.filter(a => !eTitoloGruppo(a)).length}</dd></div>
        </dl>
      </section>
      <div class="corpo-atto">
        <div class="colonna-indice">
          ${htmlImmagineAtto(atto)}
          <nav class="indice-articoli" aria-label="Indice degli articoli">
            <h2>Indice</h2>
            <ol>${indice}</ol>
          </nav>
        </div>
        <div class="articoli">${articoli}</div>
      </div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
