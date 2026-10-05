// assets/js/cp.js — Consiglio di Pianificazione: piani economici (statali e unitari).
// AUTONOMO: non richiede ctsu-core.js. Grafica in CP.html (<style>), testata/footer/dati qui sotto.
//
// Un piano è un documento salvato nello stesso archivio dei progetti CTSU (/api/ctsu),
// riconoscibile da tipo_documento === "piano_economico". Campi propri:
//   ambito ("statale" | "unitario"), periodo_validita, data_approvazione, risorse_totali, luogo_piano.
// La struttura del testo (titoli, sezioni, commi, sottocommi, immagini) è identica a quella dei progetti.
//
// CP.html                    -> elenco, con filtri per ambito e stato
// CP.html?ambito=statale     -> solo i piani statali (oppure unitario)
// CP.html?id=<id-del-piano>  -> lettura del piano
(function () {

  /* =====================================================================
     CONFIGURAZIONE, TESTATA, FOOTER E DATI — tutto qui dentro.
     CP non dipende più da ctsu-core.js: modifica liberamente questo file
     e lo <style> di CP.html senza toccare le pagine del CTSU.
     ===================================================================== */

  const CP_CONFIG = {
    nomeSito: "Zentraler Planungsrat",
    sigla: "CP",
    motto: "Piani economici dell'Unione",
    annoFondazione: 2024,
    emblema: "CCP.png",          // cambia qui l'emblema (o metti un file CP.png)
    homeCtsu: "ctsu.html"         // dove porta il link \"Home\" nel menu
  };

  const romano = n => {
    const t = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
    let r = ""; n = Math.max(0, Math.floor(Number(n) || 0));
    for (const [v, s] of t) while (n >= v) { r += s; n -= v; }
    return r;
  };

  function renderTestataCp() {
    const el = document.getElementById("testata-root");
    if (!el) return;
    el.innerHTML = `
      <div class="striscia-top">
        <div class="container"><span>${CP_CONFIG.sigla} &middot; [estjibundes.me.ei]</span><span></span></div>
      </div>
      <header class="testata">
        <div class="container testata__riga">
          <div class="testata__emblema" aria-hidden="true">
            <img src="${CP_CONFIG.emblema}" alt="${CP_CONFIG.sigla}" onerror="this.parentNode.style.display='none'">
          </div>
          <div class="testata__testi">
            <p class="testata__eyebrow"></p>
            <h2 class="testata__nome">${CP_CONFIG.nomeSito}</h2>
            <p class="testata__motto">${CP_CONFIG.motto}</p>
          </div>
        </div>
      </header>
      <div class="fascia-tricolore" role="presentation"><span class="verde"></span><span class="bianco"></span><span class="rosso"></span></div>
      <nav class="nav-principale" aria-label="Navigazione principale">
        <div class="container">
          <ul>
            <li><a href="${CP_CONFIG.homeCtsu}">Home CTSU</a></li>
            <li><a href="CP.html" class="attiva">Piani economici</a></li>
            <li><a href="CP.html?ambito=statale">Piani statali</a></li>
            <li><a href="CP.html?ambito=unitario">Piani unitari</a></li>
          </ul>
        </div>
      </nav>`;
  }

  function renderFooterCp() {
    const el = document.getElementById("footer-root");
    if (!el) return;
    el.innerHTML = `
      <div class="fascia-tricolore" role="presentation"><span class="verde"></span><span class="bianco"></span><span class="rosso"></span></div>
      <footer>
        <div class="container footer__contenuto">
          <span>&copy; ${CP_CONFIG.annoFondazione}&ndash;${new Date().getFullYear()} ${CP_CONFIG.nomeSito}. Raccolta amministrata a fini interni, senza valore legale reale.</span>
          <span></span>
        </div>
      </footer>`;
  }

  // Lettura (sola lettura) dei piani: stesso archivio dei progetti, /api/ctsu,
  // riconoscibili da tipo_documento === "piano_economico".
  async function leggiRisposta(res) {
    const testo = await res.text();
    try { return testo ? JSON.parse(testo) : {}; }
    catch (e) { return { error: `Risposta non valida dal server (HTTP ${res.status}).` }; }
  }

  async function caricaPiani() {
    const res = await fetch("/api/ctsu", { cache: "no-store" });
    const data = await leggiRisposta(res);
    if (!res.ok) throw new Error(data.error ? `HTTP ${res.status}: ${data.error}` : `HTTP ${res.status}`);
    const tutti = Array.isArray(data.progetti) ? data.progetti : [];
    return tutti.filter(p => p && typeof p === "object" && p.tipo_documento === "piano_economico");
  }

  // Registro dei luoghi (lo stesso di CA.html), da /api/organi (campo "luoghi").
  let _luoghi = null;
  function caricaLuoghi() {
    if (!_luoghi) {
      _luoghi = fetch("/api/organi", { cache: "no-store" })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(j => (j && j.luoghi && typeof j.luoghi === "object" && !Array.isArray(j.luoghi)) ? j.luoghi : {})
        .catch(e => { _luoghi = null; throw e; });
    }
    return _luoghi;
  }

  function voceLuogo(v) {
    if (typeof v === "string") return { nome: v, tipo: "" };
    if (v && typeof v === "object" && typeof v.nome === "string") return { nome: v.nome, tipo: (v.tipo || "").toString() };
    return null;
  }

  function cercaLuogo(nodo, id) {
    if (!nodo || typeof nodo !== "object" || !id) return null;
    if (Object.prototype.hasOwnProperty.call(nodo, id)) { const v = voceLuogo(nodo[id]); if (v) return v; }
    for (const k of Object.keys(nodo)) {
      const f = nodo[k];
      if (f && typeof f === "object" && !voceLuogo(f)) { const t = cercaLuogo(f, id); if (t) return t; }
    }
    return null;
  }

  const esc = t => (t == null ? "" : t).toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function urlSicuro(valore) {
    const u = (valore || "").toString().trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }

  const lettera = n => (n <= 26 ? String.fromCharCode(96 + n) : String(n));

  const AMBITI = {
    statale: { etichetta: "Statale", plurale: "Piani statali", descrizione: "I piani economici dei singoli Stati" },
    unitario: { etichetta: "Unitario", plurale: "Piani unitari", descrizione: "I piani economici dell'intera Unione" }
  };
  const ambitoDi = p => (p && p.ambito === "unitario" ? "unitario" : "statale");
  const badgeAmbito = p =>
    `<span class="badge-ambito ${ambitoDi(p) === "unitario" ? "badge-ambito--unitario" : ""}">${AMBITI[ambitoDi(p)].etichetta}</span>`;

  /* ---------- STRUTTURA DEL TESTO (come progetto.js) ---------- */

  function leggiSottocommi(comma) {
    let l = 0;
    return (Array.isArray(comma.sottocommi) ? comma.sottocommi : []).map(y => {
      if (!y || typeof y !== "object") return null;
      if (y.tipo === "immagine") return { immagine: true, dati: y };
      l++;
      return { immagine: false, n: l, dati: y };
    }).filter(Boolean);
  }

  function leggiCommi(sezione) {
    let c = 0;
    return (Array.isArray(sezione.commi) ? sezione.commi : []).map(x => {
      if (!x || typeof x !== "object") return null;
      if (x.tipo === "immagine") return { immagine: true, dati: x };
      c++;
      return { immagine: false, n: c, dati: x, sotto: leggiSottocommi(x) };
    }).filter(Boolean);
  }

  function leggiBlocchi(piano) {
    let s = 0, t = 0;
    return (Array.isArray(piano.sezioni) ? piano.sezioni : []).map(b => {
      if (!b || typeof b !== "object") return null;
      if (b.tipo === "titolo") { t++; return { tipo: "titolo", n: t, dati: b }; }
      if (b.tipo === "immagine") return { tipo: "immagine", n: 0, dati: b };
      s++;
      return { tipo: "sezione", n: s, dati: b, commi: leggiCommi(b) };
    }).filter(Boolean);
  }

  function etichettaTitolo(b) {
    const numero = (b.dati.numero || "").toString().trim() || romano(b.n);
    const nome = (b.dati.titolo || "").toString().trim();
    return ("TITOLO " + numero + (nome ? " - " + nome : "")).toLocaleUpperCase("it-IT");
  }

  /* ---------- HTML DEL PIANO ---------- */

  function htmlCopertina(piano) {
    const src = urlSicuro(piano.copertina);
    if (!src) return "";
    return `
      <figure class="immagine-atto">
        <img src="${esc(src)}" alt="${esc(piano.titolo)}" loading="lazy" onerror="this.closest('figure').style.display='none'">
      </figure>`;
  }

  function htmlImmagineTesto(g, piano) {
    const src = urlSicuro(g.url);
    if (!src) return "";
    const didascalia = (g.didascalia || "").toString().trim();
    return `<figure class="immagine-atto immagine-testo"><img src="${esc(src)}" alt="${esc(didascalia || piano.titolo)}" loading="lazy" onerror="this.closest('figure').style.display='none'">${didascalia ? `<figcaption>${esc(didascalia)}</figcaption>` : ""}</figure>`;
  }

  function htmlIndice(piano) {
    const voci = leggiBlocchi(piano).map(b => {
      if (b.tipo === "titolo") {
        return `<li class="indice-titolo-gruppo"><a href="#tit-${b.n}">${esc(etichettaTitolo(b))}</a></li>`;
      }
      if (b.tipo !== "sezione") return "";
      const commi = b.commi.filter(c => !c.immagine).map(c => {
        const sotto = c.sotto.filter(y => !y.immagine).map(y =>
          `<li><a href="#sez-${b.n}-c-${c.n}-s-${y.n}">lett. ${lettera(y.n)})</a></li>`).join("");
        return `<li><a href="#sez-${b.n}-c-${c.n}">Comma ${c.n}</a>${sotto ? `<ul class="indice-sottocommi">${sotto}</ul>` : ""}</li>`;
      }).join("");
      return `<li><a href="#sez-${b.n}">${esc(b.dati.titolo || `Sezione ${b.n}`)}</a>${commi ? `<ul class="indice-commi">${commi}</ul>` : ""}</li>`;
    }).join("");
    if (!voci) return "";
    let extra = "";
    if ((piano.galleria || []).length) extra += `<li><a href="#galleria-piano">Galleria fotografica</a></li>`;
    if ((piano.allegati || []).length) extra += `<li><a href="#allegati-piano">Allegati</a></li>`;
    return `
      <nav class="indice-articoli" aria-label="Indice del piano">
        <h2>Indice</h2>
        <ol>${voci}${extra}</ol>
      </nav>`;
  }

  // Dentro ".comma" gli a-capo del sorgente verrebbero mostrati (white-space: pre-line):
  // questi pezzi sono costruiti senza spazi né a-capo.
  function htmlSottocommi(sotto, idBase, piano) {
    if (!sotto.length) return "";
    const voci = sotto.map(y => {
      if (y.immagine) {
        const img = htmlImmagineTesto(y.dati, piano);
        return img ? `<li class="sottocomma-immagine">${img}</li>` : "";
      }
      return `<li value="${y.n}" id="${idBase}-s-${y.n}">${y.dati.testo || ""}</li>`;
    }).join("");
    return `<ol class="sottocommi">${voci}</ol>`;
  }

  function htmlCommi(sezione, piano) {
    return sezione.commi.map(c => {
      if (c.immagine) {
        const img = htmlImmagineTesto(c.dati, piano);
        return img ? `<div class="comma">${img}</div>` : "";
      }
      const id = `sez-${sezione.n}-c-${c.n}`;
      const immagineDestra = c.dati.immagine ? htmlImmagineTesto(c.dati.immagine, piano) : "";
      const classe = immagineDestra ? " comma--con-immagine-destra" : "";
      return `<div class="comma${classe}" id="${id}">${immagineDestra ? `<div class="comma__immagine-destra">${immagineDestra}</div>` : ""}<p><span class="comma__numero">${c.n}.</span> ${c.dati.testo || ""}</p>${htmlSottocommi(c.sotto, id, piano)}</div>`;
    }).join("");
  }

  function htmlBlocchi(piano) {
    return leggiBlocchi(piano).map(b => {
      if (b.tipo === "titolo") return `<div class="titolo-gruppo" id="tit-${b.n}"><h2>${esc(etichettaTitolo(b))}</h2></div>`;
      if (b.tipo === "immagine") return htmlImmagineTesto(b.dati, piano);
      const intro = (b.dati.testo || "").toString().trim() ? `<div class="comma"><p>${b.dati.testo}</p></div>` : "";
      return `
      <article class="articolo" id="sez-${b.n}">
        <h3>${esc(b.dati.titolo || `Sezione ${b.n}`)}</h3>
        ${intro}${htmlCommi(b, piano)}
      </article>`;
    }).join("");
  }

  function htmlGalleria(piano) {
    const celle = (piano.galleria || []).map(g => {
      const src = urlSicuro(g && g.url);
      if (!src) return "";
      return `
        <figure class="immagine-atto" style="margin:0;">
          <img src="${esc(src)}" alt="${esc(g.didascalia || piano.titolo)}" loading="lazy" onerror="this.closest('figure').style.display='none'">
          ${g.didascalia ? `<figcaption>${esc(g.didascalia)}</figcaption>` : ""}
        </figure>`;
    }).join("");
    if (!celle) return "";
    return `
      <section id="galleria-piano" style="margin-top:32px;">
        <h2 class="sezione-titolo">Galleria fotografica</h2>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px;">${celle}</div>
      </section>`;
  }

  function htmlAllegati(piano) {
    const righe = (piano.allegati || []).map(a => {
      const href = urlSicuro(a && a.url);
      if (!href) return "";
      return `<li><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">📎 ${esc(a.titolo || href)}</a></li>`;
    }).join("");
    if (!righe) return "";
    return `
      <section id="allegati-piano" style="margin-top:32px;">
        <h2 class="sezione-titolo">Allegati</h2>
        <ul class="elenco-allegati">${righe}</ul>
      </section>`;
  }

  /* ---------- ESPORTAZIONE IN PDF (motore comune in assets/js/pdf-export.js) ---------- */
  // Stesso motore di NormAktiv e CTSU: barra in alto su ogni pagina con logo e nome del sito.

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

  async function scaricaPdfPiano(piano, nomeLuogo) {
    const PE = await caricaPdfExport();
    const C = PE.colori;
    const pdf = await PE.crea({
      marca: { nome: CP_CONFIG.nomeSito, sottotitolo: CP_CONFIG.motto, logo: CP_CONFIG.emblema }
    });

    pdf.scrivi(`PIANO ${AMBITI[ambitoDi(piano)].etichetta.toUpperCase()}  |  ${(piano.stato || "").toString().toUpperCase()}`,
      { font: "helvetica", stile: "bold", size: 9, colore: C.blu, dopo: 3 });
    pdf.scrivi(piano.titolo, { font: "helvetica", stile: "bold", size: 20, colore: C.scuro, dopo: 3, interlinea: 1.25 });
    if (piano.sommario) pdf.scrivi(piano.sommario, { colore: C.tenue, dopo: 4 });
    if (piano.copertina) await pdf.immagine(piano.copertina, "", { maxH: 60 });

    pdf.linea();
    pdf.dati([
      ["Ente redattore", piano.organo_responsabile || "—"],
      ["Luogo", nomeLuogo || "—"],
      ["Responsabile del piano", piano.responsabile || "—"],
      ["Periodo di validità", piano.periodo_validita || "—"],
      ["Data di approvazione", piano.data_approvazione || "—"],
      ["Risorse totali", piano.risorse_totali || "—"]
    ]);
    pdf.linea();
    pdf.spazio(3);

    for (const b of leggiBlocchi(piano)) {
      if (b.tipo === "titolo") {
        pdf.spazio(4);
        pdf.riservaSpazio(20);
        pdf.scrivi(etichettaTitolo(b), { font: "helvetica", stile: "bold", size: 13, colore: C.blu, align: "center", dopo: 2 });
        pdf.linea(C.linea, 0.3);
        pdf.spazio(1);
        continue;
      }
      if (b.tipo === "immagine") {
        await pdf.immagineDestra(b.dati.url, b.dati.didascalia);
        continue;
      }

      pdf.riservaSpazio(28);
      pdf.scrivi(b.dati.titolo || `Sezione ${b.n}`,
        { font: "helvetica", stile: "bold", size: 12.5, colore: C.scuro, dopo: 2.5 });
      if ((b.dati.testo || "").toString().trim()) pdf.scrivi(b.dati.testo, { dopo: 1.5 });

      for (const c of b.commi) {
        if (c.immagine) {
          await pdf.immagineDestra(c.dati.url, c.dati.didascalia);
          continue;
        }
        if (c.dati.immagine) await pdf.immagineDestra(c.dati.immagine.url, c.dati.immagine.didascalia);
        pdf.scrivi(`${c.n}. ${c.dati.testo || ""}`, { dopo: 1.5 });
        for (const y of c.sotto) {
          if (y.immagine) await pdf.immagineDestra(y.dati.url, y.dati.didascalia);
          else pdf.scrivi(`${lettera(y.n)}) ${y.dati.testo || ""}`, { x: 28, dopo: 1 });
        }
        pdf.spazio(1);
      }
      pdf.spazio(4);
    }

    const galleria = (piano.galleria || []).filter(g => g && urlSicuro(g.url));
    if (galleria.length) {
      pdf.spazio(4);
      pdf.riservaSpazio(60);
      pdf.scrivi("Galleria fotografica", { font: "helvetica", stile: "bold", size: 13, colore: C.blu, dopo: 2 });
      pdf.linea(C.linea, 0.3);
      for (const g of galleria) await pdf.immagineDestra(g.url, g.didascalia);
    }

    const allegati = (piano.allegati || []).filter(a => a && urlSicuro(a.url));
    if (allegati.length) {
      pdf.spazio(4);
      pdf.riservaSpazio(30);
      pdf.scrivi("Allegati", { font: "helvetica", stile: "bold", size: 13, colore: C.blu, dopo: 2 });
      pdf.linea(C.linea, 0.3);
      allegati.forEach(a => pdf.link(a.titolo || a.url, urlSicuro(a.url)));
    }

    pdf.salva(PE.nomeFile(piano.titolo, "piano-economico"), piano.titolo);
  }

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

  function collegaBottonePdf(piano, nomeLuogo) {
    const btn = document.getElementById("btn-scarica-pdf");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const testoOriginale = btn.textContent;
      btn.disabled = true; btn.style.opacity = "0.6"; btn.textContent = "Generazione PDF…";
      try {
        await scaricaPdfPiano(piano, nomeLuogo);
      } catch (e) {
        alert("Errore nella creazione del PDF: " + e.message);
      } finally {
        btn.disabled = false; btn.style.opacity = ""; btn.textContent = testoOriginale;
      }
    });
  }

  /* ---------- VISTA: LETTURA DI UN PIANO ---------- */

  async function mostraPiano(root, piano) {
    document.title = piano.titolo + " — " + CP_CONFIG.nomeSito;
    const amb = ambitoDi(piano);

    let nomeLuogo = piano.luogo_piano || "";
    if (nomeLuogo) {
      try {
        const voce = cercaLuogo(await caricaLuoghi(), nomeLuogo);
        if (voce && voce.nome) nomeLuogo = voce.nome;
      } catch (e) { /* resta il valore salvato */ }
    }

    const dato = (nome, valore) => `<div><dt>${nome}</dt><dd>${esc(valore || "—")}</dd></div>`;
    root.innerHTML = `
      <p class="breadcrumb">
        <a href="${CP_CONFIG.homeCtsu}">Home</a> &rsaquo;
        <a href="CP.html">${CP_CONFIG.nomeSito}</a> &rsaquo;
        <a href="CP.html?ambito=${amb}">${AMBITI[amb].plurale}</a> &rsaquo;
        ${esc(piano.titolo)}
      </p>
      <section class="intestazione-atto">
        <div class="intestazione-atto__meta">
          ${badgeAmbito(piano)}
          <span class="badge-stato${/^stesura$/i.test(piano.stato||"")?" stesura":""}">${esc(piano.stato)}</span>
        </div>
        <h1>${esc(piano.titolo)}</h1>
        <p>${esc(piano.sommario)}</p>
        <dl class="intestazione-atto__dati">
          ${dato("Ente redattore", piano.organo_responsabile)}
          ${dato("Luogo", nomeLuogo)}
          ${dato("Responsabile del piano", piano.responsabile)}
          ${dato("Periodo di validità", piano.periodo_validita)}
          ${dato("Data di approvazione", piano.data_approvazione)}
          ${dato("Risorse totali", piano.risorse_totali)}
        </dl>
        ${htmlBottonePdf()}
      </section>
      <div class="corpo-atto">
        <div class="colonna-indice">
          ${htmlCopertina(piano)}
          ${htmlIndice(piano)}
        </div>
        <div class="articoli">
          ${htmlBlocchi(piano)}
          ${htmlGalleria(piano)}
          ${htmlAllegati(piano)}
        </div>
      </div>`;

    collegaBottonePdf(piano, nomeLuogo);

    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
    }
  }

  /* ---------- VISTA: ELENCO ---------- */

  function htmlScheda(p) {
    const src = urlSicuro(p.copertina);
    const dati = [
      p.periodo_validita ? `<li>Periodo <b>${esc(p.periodo_validita)}</b></li>` : "",
      p.risorse_totali ? `<li>Risorse <b>${esc(p.risorse_totali)}</b></li>` : "",
      p.data_approvazione ? `<li>Approvato il <b>${esc(p.data_approvazione)}</b></li>` : ""
    ].join("");
    return `
      <a class="scheda-atto" href="CP.html?id=${encodeURIComponent(p.id)}">
        ${src ? `<img class="scheda-atto__immagine" src="${esc(src)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
        <div class="scheda-atto__meta">${badgeAmbito(p)}<span class="badge-stato${/^stesura$/i.test(p.stato||"")?" stesura":""}">${esc(p.stato)}</span></div>
        <h3 class="scheda-atto__titolo">${esc(p.titolo)}</h3>
        ${p.sommario ? `<p class="scheda-atto__sommario">${esc(p.sommario)}</p>` : ""}
        ${dati ? `<ul class="scheda-atto__dati">${dati}</ul>` : ""}
      </a>`;
  }

  function mostraElenco(root, piani) {
    document.title = CP_CONFIG.nomeSito + " — Piani economici";
    const params = new URLSearchParams(location.search);
    const filtro = {
      ambito: AMBITI[params.get("ambito")] ? params.get("ambito") : "",
      stato: params.get("stato") || "",
      q: (params.get("q") || "").trim()
    };
    const nStatali = piani.filter(p => ambitoDi(p) === "statale").length;
    const nUnitari = piani.length - nStatali;
    const stati = [...new Set(piani.map(p => p.stato).filter(Boolean))];

    root.innerHTML = `
      <section class="hero" style="margin:-1px -24px 0; padding-left:24px; padding-right:24px;">
        <div class="container hero__inner" style="padding:0;">
          <div>
            <span class="hero__kicker">${esc(CP_CONFIG.nomeSito)}</span>
            <h1 class="hero__titolo">Piani economici dell'Unione</h1>
            <p class="hero__sottotitolo">
              I piani economici pubblicati dal Consiglio di Pianificazione, divisi in piani statali e piani unitari.
              Cerca per parola chiave o filtra per ambito e stato.
            </p>
            <form id="form-ricerca" class="ricerca" role="search">
              <label for="campo-ricerca" style="position:absolute; left:-9999px;">Cerca nei piani</label>
              <input id="campo-ricerca" type="text" placeholder="Cerca per titolo, periodo o ente&hellip;" autocomplete="off" />
              <button type="submit">Cerca</button>
            </form>
          </div>
          <div class="hero__pannello">
            <h2>Accesso rapido</h2>
            <ul>
              <li><a href="CP.html?ambito=statale">${AMBITI.statale.plurale}<span>${AMBITI.statale.descrizione}</span></a></li>
              <li><a href="CP.html?ambito=unitario">${AMBITI.unitario.plurale}<span>${AMBITI.unitario.descrizione}</span></a></li>
            </ul>
          </div>
        </div>
      </section>

      <section class="stats-band" style="margin:0 -24px; padding:0;">
        <div class="container">
          <div class="stat-item"><b>${piani.length}</b><span>Piani pubblicati</span></div>
          <div class="stat-item"><b>${nStatali}</b><span>Piani statali</span></div>
          <div class="stat-item"><b>${nUnitari}</b><span>Piani unitari</span></div>
        </div>
      </section>

      <h2 class="sezione-titolo" style="margin-top:40px;">Elenco dei piani</h2>
      <div id="filtri-ambito" class="filtri" style="margin-bottom:8px;"></div>
      <div id="filtri-stato" class="filtri" style="margin-top:0;"></div>
      <p id="conteggio-risultati" style="font-family:var(--font-chrome); font-size:.85rem; color:var(--inchiostro-tenue); margin:0 0 16px;"></p>
      <div id="elenco-root" class="elenco-atti"></div>`;

    const campo = document.getElementById("campo-ricerca");
    campo.value = filtro.q;

    const pill = (attivo, dati, testo) =>
      `<button type="button" class="filtro ${attivo ? "attivo" : ""}" ${dati}>${esc(testo)}</button>`;

    function aggiorna() {
      document.getElementById("filtri-ambito").innerHTML =
        pill(!filtro.ambito, 'data-ambito=""', "Tutti") +
        pill(filtro.ambito === "statale", 'data-ambito="statale"', AMBITI.statale.plurale) +
        pill(filtro.ambito === "unitario", 'data-ambito="unitario"', AMBITI.unitario.plurale);
      document.getElementById("filtri-stato").innerHTML = stati.length > 1
        ? pill(!filtro.stato, 'data-stato=""', "Ogni stato") + stati.map(s => pill(filtro.stato === s, `data-stato="${esc(s)}"`, s)).join("")
        : "";

      const q = filtro.q.toLowerCase();
      const risultati = piani.filter(p =>
        (!filtro.ambito || ambitoDi(p) === filtro.ambito) &&
        (!filtro.stato || p.stato === filtro.stato) &&
        (!q || [p.titolo, p.sommario, p.periodo_validita, p.organo_responsabile, p.stato].join(" ").toLowerCase().includes(q))
      ).reverse();   // l'ultimo salvato per primo

      document.getElementById("conteggio-risultati").textContent =
        risultati.length === 1 ? "1 piano" : `${risultati.length} piani`;
      document.getElementById("elenco-root").innerHTML = risultati.length
        ? risultati.map(htmlScheda).join("")
        : `<div class="nessun-risultato">${piani.length
            ? "Nessun piano corrisponde ai filtri scelti. Prova a togliere un filtro o a cambiare la ricerca."
            : "Non è ancora stato pubblicato nessun piano economico."}</div>`;

      const p = new URLSearchParams();
      if (filtro.ambito) p.set("ambito", filtro.ambito);
      if (filtro.stato) p.set("stato", filtro.stato);
      if (filtro.q) p.set("q", filtro.q);
      history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
    }

    root.addEventListener("click", e => {
      const a = e.target.closest("[data-ambito]");
      if (a) { filtro.ambito = a.getAttribute("data-ambito"); aggiorna(); return; }
      const s = e.target.closest("[data-stato]");
      if (s) { filtro.stato = s.getAttribute("data-stato"); aggiorna(); }
    });
    document.getElementById("form-ricerca").addEventListener("submit", e => {
      e.preventDefault(); filtro.q = campo.value.trim(); aggiorna();
    });
    campo.addEventListener("input", () => { filtro.q = campo.value.trim(); aggiorna(); });

    aggiorna();
  }

  /* ---------- AVVIO ---------- */

  async function init() {
    renderTestataCp();
    renderFooterCp();
    const root = document.getElementById("cp-root");
    let piani = [];
    try {
      piani = await caricaPiani();
    } catch (e) {
      root.innerHTML = `<div class="nessun-risultato" style="margin-top:40px;">Non è stato possibile caricare i piani economici (${esc(e.message)}). Ricarica la pagina tra qualche istante.</div>`;
      return;
    }

    const id = new URLSearchParams(location.search).get("id");
    if (id) {
      const piano = piani.find(p => p.id === id);
      if (piano) return mostraPiano(root, piano);
      document.title = "Piano non trovato — " + CP_CONFIG.nomeSito;
      root.innerHTML = `
        <p class="breadcrumb"><a href="${CP_CONFIG.homeCtsu}">Home</a> &rsaquo; <a href="CP.html">${CP_CONFIG.nomeSito}</a> &rsaquo; Piano non trovato</p>
        <div class="nessun-risultato">Il piano richiesto non esiste o è stato rimosso. Torna all'<a href="CP.html">elenco dei piani</a>.</div>`;
      return;
    }
    mostraElenco(root, piani);
  }

  document.addEventListener("DOMContentLoaded", init);
})();