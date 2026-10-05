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
    const codice = (atto.luogo || "").toString().trim();
    if (!codice) return "";
    const nome = mappaLuoghi[codice] || codice;
    return `<div class="intestazione-atto__luogo" style="margin-top:10px;">
      <span class="badge-categoria" title="${escAttr(codice)}">📍 ${escAttr(nome)}</span>
    </div>`;
  }

  // ---------------------------------------------------------------------------
  // ESPORTAZIONE IN PDF (motore comune in assets/js/pdf-export.js)
  // Il PDF ha in alto, su ogni pagina, la barra con il logo di NormAktiv.
  // ---------------------------------------------------------------------------
  function caricaPdfExport() {
    if (window.PdfExport) return Promise.resolve(window.PdfExport);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "assets/js/pdf-export.js";
      s.onload = () => window.PdfExport ? resolve(window.PdfExport) : reject(new Error("Modulo PDF non valido"));
      s.onerror = () => reject(new Error("File assets/js/pdf-export.js non trovato"));
      document.head.appendChild(s);
    });
  }

  async function scaricaPdfAtto(atto, mappaLuoghi) {
    const PE = await caricaPdfExport();
    const C = PE.colori;
    const pdf = await PE.crea({
      marca: { nome: "NormAktiv", sottotitolo: "Raccolta ufficiale degli atti normativi", logo: "NormAktiv.png" }
    });

    const stato = atto.stato === "vigente" ? "VIGENTE" : atto.stato === "stesura" ? "IN STESURA" : "ABROGATO";
    pdf.scrivi(`${(atto.categoria || "").toString().toUpperCase()}  |  ${stato}`,
      { font: "helvetica", stile: "bold", size: 9, colore: C.blu, dopo: 3 });
    pdf.scrivi(atto.titolo, { font: "helvetica", stile: "bold", size: 20, colore: C.scuro, dopo: 3, interlinea: 1.25 });
    if (atto.sommario) pdf.scrivi(atto.sommario, { colore: C.tenue, dopo: 4 });

    const codiceLuogo = (atto.luogo || "").toString().trim();
    if (codiceLuogo) {
      pdf.scrivi("Luogo: " + (mappaLuoghi[codiceLuogo] || codiceLuogo),
        { font: "helvetica", size: 10, colore: C.tenue, dopo: 3 });
    }

    // immagine facoltativa dell'atto (in intestazione, a tutta larghezza)
    if (atto.immagine) await pdf.immagine(atto.immagine, atto.didascalia, { maxH: 60 });

    pdf.linea();
    pdf.dati([
      ["Numero", `${atto.numero}/${atto.anno}`],
      ["Data di emanazione", atto.dataEmanazione],
      ["Promulgato da", atto.promulgatoDa],
      ["Articoli", String(atto.articoli.filter(a => !eTitoloGruppo(a)).length)]
    ]);
    pdf.linea();
    pdf.spazio(3);

    atto.articoli.forEach(art => {
      if (eTitoloGruppo(art)) {
        pdf.spazio(4);
        pdf.riservaSpazio(20);
        pdf.scrivi(art.testo, { font: "helvetica", stile: "bold", size: 13, colore: C.blu, align: "center", dopo: 2 });
        pdf.linea(C.linea, 0.3);
        pdf.spazio(1);
        return;
      }
      pdf.riservaSpazio(28); // evita intestazione d'articolo isolata a fondo pagina
      pdf.scrivi(`Articolo ${art.numero}`, { font: "helvetica", stile: "bold", size: 9.5, colore: C.blu, dopo: 0.5 });
      pdf.scrivi(art.rubrica, { font: "helvetica", stile: "bold", size: 12.5, colore: C.scuro, dopo: 2.5 });

      const commi = commiDiArticolo(art);
      commi.forEach((comma, ic) => {
        const prefisso = commi.length > 1 ? `${ic + 1}. ` : "";
        pdf.scrivi(prefisso + (comma.testo || ""), { dopo: 1.5 });
        (comma.sottocommi || []).filter(s => s && s.trim() !== "").forEach((s, is) => {
          pdf.scrivi(`${letteraDa(is)}) ${s}`, { x: MX_SOTTO, dopo: 1 });
        });
        pdf.spazio(1);
      });
      pdf.spazio(4);
    });

    pdf.salva(PE.nomeFile(atto.titolo, "atto"), atto.titolo);
  }
  const MX_SOTTO = 28; // rientro dei sottocommi (mm dal bordo pagina)

  function htmlBottonePdf() {
    return `
      <div class="intestazione-atto__azioni" style="margin-top:16px;">
        <button type="button" id="btn-scarica-pdf"
          style="background:var(--blu-700,#12508c); color:#fff; border:none; border-radius:4px; padding:9px 18px;
                 font-family:var(--font-chrome,'Titillium Web',sans-serif); font-weight:700; font-size:0.9rem;
                 letter-spacing:0.03em; cursor:pointer;">
          ⬇ Scarica in PDF
        </button>
      </div>`;
  }

  function collegaBottonePdf(atto, mappaLuoghi) {
    const btn = document.getElementById("btn-scarica-pdf");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const testoOriginale = btn.textContent;
      btn.disabled = true; btn.style.opacity = "0.6"; btn.textContent = "Generazione PDF…";
      try {
        await scaricaPdfAtto(atto, mappaLuoghi);
      } catch (e) {
        alert("Errore nella creazione del PDF: " + e.message);
      } finally {
        btn.disabled = false; btn.style.opacity = ""; btn.textContent = testoOriginale;
      }
    });
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

    const mappaLuoghi = (atto.luogo && atto.luogo.toString().trim())
      ? await caricaMappaLuoghi()
      : {};

    const badgeStato = atto.stato === "stesura"
      ? `<span class="badge-stato stesura">stesura</span>`
      : atto.stato === "vigente"
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
        ${htmlBottonePdf()}
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

    collegaBottonePdf(atto, mappaLuoghi);
  }

  document.addEventListener("DOMContentLoaded", init);
})();