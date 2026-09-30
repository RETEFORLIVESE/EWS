// assets/js/cp.js — Consiglio di Pianificazione: piani economici (statali e unitari).
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
    const numero = (b.dati.numero || "").toString().trim() || ctsuRomano(b.n);
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

  /* ---------- VISTA: LETTURA DI UN PIANO ---------- */

  async function mostraPiano(root, piano) {
    document.title = piano.titolo + " — " + SITE_CONFIG_CTSU.nomeConsiglioPianificazione;
    const amb = ambitoDi(piano);

    let nomeLuogo = piano.luogo_piano || "";
    if (nomeLuogo) {
      try {
        const voce = ctsuCercaLuogo(await APICtsu.loadLuoghi(), nomeLuogo);
        if (voce && voce.nome) nomeLuogo = voce.nome;
      } catch (e) { /* resta il valore salvato */ }
    }

    const dato = (nome, valore) => `<div><dt>${nome}</dt><dd>${esc(valore || "—")}</dd></div>`;
    root.innerHTML = `
      <p class="breadcrumb">
        <a href="ctsu.html">Home</a> &rsaquo;
        <a href="CP.html">${SITE_CONFIG_CTSU.nomeConsiglioPianificazione}</a> &rsaquo;
        <a href="CP.html?ambito=${amb}">${AMBITI[amb].plurale}</a> &rsaquo;
        ${esc(piano.titolo)}
      </p>
      <section class="intestazione-atto">
        <div class="intestazione-atto__meta">
          ${badgeAmbito(piano)}
          <span class="badge-stato">${esc(piano.stato)}</span>
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
        <div class="scheda-atto__meta">${badgeAmbito(p)}<span class="badge-stato">${esc(p.stato)}</span></div>
        <h3 class="scheda-atto__titolo">${esc(p.titolo)}</h3>
        ${p.sommario ? `<p class="scheda-atto__sommario">${esc(p.sommario)}</p>` : ""}
        ${dati ? `<ul class="scheda-atto__dati">${dati}</ul>` : ""}
      </a>`;
  }

  function mostraElenco(root, piani) {
    document.title = SITE_CONFIG_CTSU.nomeConsiglioPianificazione + " — Piani economici";
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
            <span class="hero__kicker">${esc(SITE_CONFIG_CTSU.nomeConsiglioPianificazione)}</span>
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
    renderTestataCtsu("cp");
    renderFooterCtsu();
    const root = document.getElementById("cp-root");
    let piani = [];
    try {
      piani = await APICtsu.loadPiani();
    } catch (e) {
      root.innerHTML = `<div class="nessun-risultato" style="margin-top:40px;">Non è stato possibile caricare i piani economici (${esc(e.message)}). Ricarica la pagina tra qualche istante.</div>`;
      return;
    }

    const id = new URLSearchParams(location.search).get("id");
    if (id) {
      const piano = piani.find(p => p.id === id);
      if (piano) return mostraPiano(root, piano);
      document.title = "Piano non trovato — " + SITE_CONFIG_CTSU.nomeConsiglioPianificazione;
      root.innerHTML = `
        <p class="breadcrumb"><a href="ctsu.html">Home</a> &rsaquo; <a href="CP.html">${SITE_CONFIG_CTSU.nomeConsiglioPianificazione}</a> &rsaquo; Piano non trovato</p>
        <div class="nessun-risultato">Il piano richiesto non esiste o è stato rimosso. Torna all'<a href="CP.html">elenco dei piani</a>.</div>`;
      return;
    }
    mostraElenco(root, piani);
  }

  document.addEventListener("DOMContentLoaded", init);
})();