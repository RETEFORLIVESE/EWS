// assets/js/dossier.js
// Dossier delle modifiche di un atto (stile "dossier di legge": iter, testo a fronte, tabelle, glossario).
//
// Il dossier è salvato DENTRO l'atto (atto.dossier), quindi viaggia con lo stesso
// salvataggio (API.saveAtti) e non richiede modifiche al backend.
//
// Usato da:
//   - redazione.js  -> Dossier.htmlEditor / Dossier.collega  (creazione e modifica)
//   - dossier.html  -> Dossier.htmlPagina / Dossier.collegaPdf (pagina pubblica)
//
// Struttura di atto.dossier:
// {
//   titolo, sottotitolo, ente, data, presentazione,
//   etichettaPrima, etichettaDopo,
//   iter: [{ fase, organo, riferimento, data, esito, colore }],
//   pubblicazione,
//   articoli: [ { tipo:"titolo", testo } | { tipo:"articolo", numero, riferimento,
//                 righe:[{ etichetta:"1." | "a)", livello:0 (comma) | 1 (sottocomma), prima, dopo }] } ],
//   sezioni:  [{ titolo, testo }],
//   fonti:    "una per riga",
//   glossario:[{ termine, definizione }],
//   aggiornato: ISO
// }
(function () {
  "use strict";

  const esc = t => (t == null ? "" : t).toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = s => (s == null ? "" : s).toString().replace(/\s+/g, " ").trim();
  const lettera = i => typeof letteraDa === "function" ? letteraDa(i) : String.fromCharCode(97 + i);
  const COLORI_TAPPA = { blu: "Blu", arancio: "Arancio", verde: "Verde", grigio: "Grigio" };

  function testoPuro(html) {
    const s = (html == null ? "" : html).toString()
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li)>/gi, "\n");
    return (new DOMParser().parseFromString(s, "text/html").body.textContent || "")
      .replace(/\u00a0/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  }

  /* ====================================================================
     MODELLO
     ==================================================================== */

  function normalizza(d) {
    d = d || {};
    const arr = x => Array.isArray(x) ? x : [];
    return {
      titolo: d.titolo || "",
      sottotitolo: d.sottotitolo || "",
      ente: d.ente || "",
      data: d.data || "",
      presentazione: d.presentazione || "",
      etichettaPrima: d.etichettaPrima || "Testo vigente",
      etichettaDopo: d.etichettaDopo || "Testo modificato",
      iter: arr(d.iter).map(t => ({
        fase: t.fase || "", organo: t.organo || "", riferimento: t.riferimento || "",
        data: t.data || "", esito: t.esito || "", colore: COLORI_TAPPA[t.colore] ? t.colore : "blu"
      })),
      pubblicazione: d.pubblicazione || "",
      articoli: arr(d.articoli).map(b => (b && b.tipo === "titolo")
        ? { tipo: "titolo", testo: b.testo || "" }
        : { tipo: "articolo", numero: b && b.numero != null ? String(b.numero) : "", riferimento: (b && b.riferimento) || "",
            righe: arr(b && b.righe).map(r => ({ prima: r.prima || "", dopo: r.dopo || "", etichetta: r.etichetta || "", livello: r.livello === 1 ? 1 : 0 })) }),
      sezioni: arr(d.sezioni).map(s => ({ titolo: s.titolo || "", testo: s.testo || "" })),
      fonti: d.fonti || "",
      glossario: arr(d.glossario).map(g => ({ termine: g.termine || "", definizione: g.definizione || "" })),
      copertina: d.copertina || null,
      aggiornato: d.aggiornato || ""
    };
  }

  // valori dei segnaposto {titolo}, {data}… usati nelle copertine personalizzate
  function varsDocumento(d, atto) {
    return { titolo: d.titolo || "", sottotitolo: d.sottotitolo || "", ente: d.ente || "", data: d.data || "",
      atto: (atto && atto.titolo) || "", numero: (atto && atto.numero) || "", anno: (atto && atto.anno) || "", categoria: (atto && atto.categoria) || "" };
  }

  function nuovo(atto) {
    return normalizza({
      titolo: "Dossier: " + ((atto && atto.titolo) || ""),
      sottotitolo: "Le modifiche a fronte del testo vigente"
    });
  }

  /* ====================================================================
     CONFRONTO PRIMA / DOPO (diff parola per parola)
     ==================================================================== */

  // Token = parola oppure "\n" (a capo). Gli spazi multipli si azzerano.
  function tok(s) {
    const t = (s == null ? "" : s).toString().replace(/\r/g, "").match(/\n|[^\s]+/g) || [];
    const out = [];
    t.forEach(x => { if (x === "\n" && (!out.length || out[out.length - 1] === "\n")) return; out.push(x); });
    while (out.length && out[out.length - 1] === "\n") out.pop();
    return out;
  }

  // LCS sulle parole: restituisce i token di "prima" e "dopo" con x=true dove differiscono.
  function diff(prima, dopo) {
    const a = tok(prima), b = tok(dopo), n = a.length, m = b.length;
    if (n * m > 4e6) return { prima: a.map(t => ({ t })), dopo: b.map(t => ({ t })) };   // testi enormi: niente evidenziazione
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const pa = [], pb = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i] === b[j]) { pa.push({ t: a[i++] }); pb.push({ t: b[j++] }); }
      else if (L[i + 1][j] >= L[i][j + 1]) pa.push({ t: a[i++], x: true });
      else pb.push({ t: b[j++], x: true });
    }
    while (i < n) pa.push({ t: a[i++], x: true });
    while (j < m) pb.push({ t: b[j++], x: true });
    return { prima: pa, dopo: pb };
  }

  function statoRiga(r) {
    const p = norm(r.prima), d = norm(r.dopo);
    if (!p && !d) return "vuota";
    if (!p) return "aggiunto";
    if (!d) return "soppresso";
    return p === d ? "identico" : "modificato";
  }

  // Cosa mostrare nelle due celle di una riga.
  function confrontaRiga(r) {
    const stato = statoRiga(r);
    if (stato === "vuota") return null;
    if (stato === "identico") return { stato, prima: tok(r.prima).map(t => ({ t })), dopo: [], speciale: "Identico" };
    if (stato === "soppresso") return { stato, prima: tok(r.prima).map(t => ({ t, x: true })), dopo: [], speciale: "Soppresso" };
    if (stato === "aggiunto") return { stato, prima: [], dopo: tok(r.dopo).map(t => ({ t, x: true })), speciale: null };
    const df = diff(r.prima, r.dopo);
    return { stato, prima: df.prima, dopo: df.dopo, speciale: null };
  }

  // token -> HTML; i gruppi con x=true sono avvolti in <tag class="cls">
  function tokHtml(toks, tag, cls) {
    let html = "", buf = [], flag = null;
    const chiudi = () => {
      if (!buf.length) return;
      const s = buf.map(esc).join(" ");
      html += flag ? `<${tag} class="${cls}">${s}</${tag}>` : s;
      buf = [];
    };
    toks.forEach(k => {
      if (k.t === "\n") { chiudi(); html += "<br>"; flag = null; return; }
      const f = !!k.x;
      if (buf.length && f !== flag) { chiudi(); html += " "; }
      else if (!buf.length && html && !html.endsWith("<br>")) html += " ";
      flag = f;
      buf.push(k.t);
    });
    chiudi();
    return html;
  }

  function riepilogo(d) {
    const righe = [];
    const tot = { modificato: 0, aggiunto: 0, soppresso: 0, identico: 0 };
    d.articoli.forEach(b => {
      if (b.tipo !== "articolo") return;
      const c = { modificato: 0, aggiunto: 0, soppresso: 0, identico: 0 };
      b.righe.forEach(r => { const s = statoRiga(r); if (c[s] != null) { c[s]++; tot[s]++; } });
      righe.push({ numero: b.numero, riferimento: b.riferimento, ...c });
    });
    return { righe, tot };
  }

  function tabellaRiepilogo(rp, classe) {
    const corpo = rp.righe.map(r =>
      `<tr><td>Art. ${esc(r.numero)}</td><td>${esc(r.riferimento || "—")}</td><td>${r.modificato}</td><td>${r.aggiunto}</td><td>${r.soppresso}</td><td>${r.identico}</td></tr>`).join("");
    return `<table class="${classe || ""}"><thead><tr><th>Articolo</th><th>Riferimento</th><th>Modificati</th><th>Aggiunti</th><th>Soppressi</th><th>Invariati</th></tr></thead><tbody>${corpo}` +
      `<tr><td><b>Totale</b></td><td></td><td><b>${rp.tot.modificato}</b></td><td><b>${rp.tot.aggiunto}</b></td><td><b>${rp.tot.soppresso}</b></td><td><b>${rp.tot.identico}</b></td></tr></tbody></table>`;
  }

  const LEGENDA = "Nella colonna di destra sono in grassetto le parti nuove o modificate. " +
    "«Identico» indica che il testo non cambia; «Soppresso» che la disposizione è eliminata. " +
    "Nella colonna di sinistra le parti eliminate sono barrate.";

  function dividiData(s) {
    const m = (s || "").toString().trim().match(/^(\d{1,2})\s+([^\d\s]+)\s+(\d{4})$/);
    return m ? { g: m[1], m: m[2], a: m[3] } : null;
  }

  /* ====================================================================
     PAGINA PUBBLICA (dossier.html)
     ==================================================================== */

  function htmlIter(d) {
    if (!d.iter.length && !d.pubblicazione) return "";
    const tappe = d.iter.map((t, i) => {
      const dt = dividiData(t.data);
      const data = dt
        ? `<div class="dos-tappa__data"><b>${esc(dt.g)}</b><span>${esc(dt.m)}</span><span>${esc(dt.a)}</span></div>`
        : `<div class="dos-tappa__data dos-tappa__data--testo">${esc(t.data)}</div>`;
      const ultima = i === d.iter.length - 1 && !d.pubblicazione;
      return `
        <li class="dos-tappa dos-tappa--${esc(t.colore)}${ultima ? " dos-tappa--ultima" : ""}">
          <div class="dos-tappa__fase">${esc(t.fase)}</div>
          <div class="dos-tappa__corpo">
            ${data}
            <div class="dos-tappa__org">${t.organo ? `<small>${esc(t.organo)}</small>` : ""}<strong>${esc(t.riferimento)}</strong></div>
            <div class="dos-tappa__esito">${esc(t.esito)}</div>
          </div>
        </li>`;
    }).join("");
    const pub = d.pubblicazione ? `<div class="dos-pubblicazione">${esc(d.pubblicazione)}</div>` : "";
    return `<section class="dos-sezione" id="dos-iter"><h2 class="dos-fascia">L'iter di approvazione</h2>
      <ol class="dos-iter">${tappe}</ol>${pub}</section>`;
  }

  function htmlConfronto(d) {
    if (!d.articoli.length) return "";
    let righe = "";
    d.articoli.forEach(b => {
      if (b.tipo === "titolo") {
        righe += `<tr class="dos-t-titolo"><td colspan="2">${esc(b.testo).replace(/\n/g, "<br>")}</td></tr>`;
        return;
      }
      righe += `<tr class="dos-t-art"><th>articolo ${esc(b.numero)}</th><th>articolo ${esc(b.numero)}</th></tr>`;
      if (b.riferimento) righe += `<tr class="dos-t-rif"><td></td><td>${esc(b.riferimento)}</td></tr>`;
      b.righe.forEach(r => {
        const c = confrontaRiga(r);
        if (!c) return;
        const et = r.etichetta ? `<span class="dos-et">${esc(r.etichetta)}</span> ` : "";
        const sx = c.prima.length ? et + tokHtml(c.prima, "del", "dos-tolto") : "";
        const dx = et + (c.speciale ? `<em class="dos-spec">${c.speciale}</em>` : tokHtml(c.dopo, "strong", "dos-nuovo"));
        righe += `<tr class="dos-r dos-r--${c.stato}${r.livello === 1 ? " dos-r--sotto" : ""}"><td>${sx}</td><td>${dx}</td></tr>`;
      });
    });
    return `<section class="dos-sezione" id="dos-fronte"><h2 class="dos-fascia">Il testo a fronte</h2>
      <div class="dos-legenda"><span>ℹ️</span><span>${esc(LEGENDA)}</span></div>
      <div class="dos-tabella-wrap"><table class="dos-tabella">
        <thead><tr><th>${esc(d.etichettaPrima)}</th><th>${esc(d.etichettaDopo)}</th></tr></thead>
        <tbody>${righe}</tbody></table></div></section>`;
  }

  function htmlPagina(atto, dIn) {
    const d = normalizza(dIn || atto.dossier);
    const rp = riepilogo(d);
    const agg = d.aggiornato && !isNaN(new Date(d.aggiornato))
      ? new Date(d.aggiornato).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";
    const fonti = d.fonti.split("\n").map(s => s.trim()).filter(Boolean);

    const sezioniLibere = d.sezioni.filter(s => s.titolo || s.testo).map((s, i) =>
      `<section class="dos-sezione" id="dos-sez-${i + 1}">${s.titolo ? `<h2 class="dos-fascia">${esc(s.titolo)}</h2>` : ""}<div class="dos-testo">${esc(s.testo)}</div></section>`).join("");
    const glossario = d.glossario.filter(g => g.termine).length
      ? `<section class="dos-sezione" id="dos-glossario"><h2 class="dos-fascia">Glossario</h2><dl class="dos-glossario">${
          d.glossario.filter(g => g.termine).map(g => `<dt>${esc(g.termine)}</dt><dd>${esc(g.definizione)}</dd>`).join("")}</dl></section>` : "";
    const fontiHtml = fonti.length
      ? `<section class="dos-sezione" id="dos-fonti"><h2 class="dos-fascia">Le fonti normative</h2><ul class="dos-fonti">${
          fonti.map(f => /^https?:\/\/\S+$/i.test(f)
            ? `<li><a href="${esc(f)}" target="_blank" rel="noopener noreferrer">${esc(f)}</a></li>` : `<li>${esc(f)}</li>`).join("")}</ul></section>` : "";
    const riepHtml = rp.righe.length
      ? `<section class="dos-sezione" id="dos-riepilogo"><h2 class="dos-fascia">Riepilogo delle modifiche</h2>
          <div class="dos-tabella-wrap">${tabellaRiepilogo(rp, "dos-riepilogo")}</div></section>` : "";

    const indice = [
      d.presentazione && ["dos-presentazione", "Presentazione"],
      (d.iter.length || d.pubblicazione) && ["dos-iter", "Iter"],
      d.articoli.length && ["dos-fronte", "Testo a fronte"],
      rp.righe.length && ["dos-riepilogo", "Riepilogo"],
      ...d.sezioni.filter(s => s.titolo).map((s, i) => [`dos-sez-${i + 1}`, s.titolo]),
      fonti.length && ["dos-fonti", "Fonti"],
      d.glossario.some(g => g.termine) && ["dos-glossario", "Glossario"]
    ].filter(Boolean).map(([id, et]) => `<a href="#${esc(id)}">${esc(et)}</a>`).join("");

    return `
      <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo;
        <a href="atto.html?id=${encodeURIComponent(atto.id)}">${esc(atto.titolo)}</a> &rsaquo; Dossier</p>
      <article class="dossier">
        <section class="intestazione-atto">
          <div class="intestazione-atto__meta"><span class="badge-categoria">Dossier</span></div>
          <h1>${esc(d.titolo || "Dossier: " + atto.titolo)}</h1>
          ${d.sottotitolo ? `<p>${esc(d.sottotitolo)}</p>` : ""}
          <dl class="intestazione-atto__dati">
            <div><dt>Atto</dt><dd><a href="atto.html?id=${encodeURIComponent(atto.id)}">n. ${esc(atto.numero)}/${esc(atto.anno)}</a></dd></div>
            ${d.ente ? `<div><dt>A cura di</dt><dd>${esc(d.ente)}</dd></div>` : ""}
            ${d.data ? `<div><dt>Data</dt><dd>${esc(d.data)}</dd></div>` : ""}
            ${agg ? `<div><dt>Aggiornato il</dt><dd>${esc(agg)}</dd></div>` : ""}
          </dl>
          <div class="intestazione-atto__azioni" style="margin-top:16px;">
            <button type="button" id="btn-dossier-pdf" class="dos-btn-pdf">⬇ Scarica il dossier in PDF</button>
          </div>
          ${indice ? `<nav class="dos-indice" aria-label="Contenuto del dossier">${indice}</nav>` : ""}
        </section>
        ${d.presentazione ? `<section class="dos-sezione" id="dos-presentazione"><h2 class="dos-fascia">Presentazione</h2><div class="dos-testo">${esc(d.presentazione)}</div></section>` : ""}
        ${htmlIter(d)}
        ${htmlConfronto(d)}
        ${riepHtml}
        ${sezioniLibere}
        ${fontiHtml}
        ${glossario}
      </article>`;
  }

  /* ====================================================================
     ESPORTAZIONE IN PDF (usa assets/js/pdf-export.js)
     ==================================================================== */

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

  const segsPdf = (toks, lato) => toks.map(k => k.t === "\n" ? { t: "\n" }
    : { t: k.t, b: lato === "dopo" && !!k.x, s: lato === "prima" && !!k.x });

  async function scaricaPdf(atto, dIn) {
    const d = normalizza(dIn || atto.dossier);
    const PE = await caricaPdfExport();
    const C = PE.colori;
    const pdf = await PE.crea({
      marca: { nome: "NormAktiv", sottotitolo: "Dossier delle modifiche", logo: "NormAktiv.png" }
    });

    // --- copertina ---
    if (d.copertina && d.copertina.attiva) {
      await pdf.copertina(d.copertina, varsDocumento(d, atto));      // copertina personalizzata (copertina.js)
    } else {
    pdf.spazio(48);
    pdf.scrivi("DOSSIER", { font: "helvetica", stile: "bold", size: 12, colore: C.blu, align: "center", dopo: 6 });
    pdf.scrivi(d.titolo || ("Dossier: " + atto.titolo), { font: "helvetica", stile: "bold", size: 26, colore: C.scuro, align: "center", interlinea: 1.2, dopo: 8 });
    if (d.sottotitolo) pdf.scrivi(d.sottotitolo, { font: "helvetica", size: 13, colore: C.tenue, align: "center", dopo: 40 });
    if (d.ente) pdf.scrivi("A cura di", { font: "helvetica", size: 9, colore: C.tenue, align: "center", dopo: 1 });
    if (d.ente) pdf.scrivi(d.ente, { font: "helvetica", stile: "bold", size: 12, colore: C.scuro, align: "center", dopo: 8 });
    if (d.data) pdf.scrivi(d.data, { font: "helvetica", size: 11, colore: C.tenue, align: "center" });
    pdf.pagina();
    }

    // --- presentazione + dati dell'atto ---
    pdf.fascia("Presentazione");
    if (d.presentazione) pdf.scrivi(d.presentazione, { dopo: 5 });
    pdf.dati([
      ["Atto", atto.titolo],
      ["Numero", `${atto.numero}/${atto.anno}`],
      ["Data di emanazione", atto.dataEmanazione],
      ["Promulgato da", atto.promulgatoDa]
    ]);

    // --- iter ---
    if (d.iter.length || d.pubblicazione) {
      pdf.pagina();
      pdf.fascia("L'iter di approvazione");
      pdf.iter(d.iter, d.pubblicazione);
    }

    // --- testo a fronte ---
    const rp = riepilogo(d);
    if (d.articoli.length) {
      pdf.pagina();
      pdf.fascia("Il testo a fronte");
      pdf.scrivi(LEGENDA, { font: "helvetica", size: 9, colore: C.tenue, dopo: 4 });
      const righe = [];
      d.articoli.forEach(b => {
        if (b.tipo === "titolo") { righe.push({ tipo: "titolo", segs: tok(b.testo).map(t => ({ t })) }); return; }
        const et = tok(`articolo ${b.numero}`).map(t => ({ t }));
        righe.push({ tipo: "intestazione", sx: et, dx: et });
        if (b.riferimento) righe.push({ tipo: "rif", testo: b.riferimento });
        b.righe.forEach(r => {
          const c = confrontaRiga(r);
          if (!c) return;
          const et = r.etichetta ? [{ t: r.etichetta }] : [];
          righe.push({
            tipo: "riga",
            rientro: r.livello === 1 ? 6 : 0,
            sx: c.prima.length ? et.concat(segsPdf(c.prima, "prima")) : [],
            dx: et.concat(c.speciale ? [{ t: c.speciale, c: true }] : segsPdf(c.dopo, "dopo"))
          });
        });
      });
      pdf.confronto(righe, { etichette: [d.etichettaPrima, d.etichettaDopo] });
    }

    // --- riepilogo ---
    if (rp.righe.length) {
      pdf.spazio(6);
      pdf.fascia("Riepilogo delle modifiche");
      pdf.scrivi(tabellaRiepilogo(rp, ""), { size: 9 });
    }

    // --- sezioni libere ---
    d.sezioni.filter(s => s.titolo || s.testo).forEach(s => {
      pdf.pagina();
      if (s.titolo) pdf.fascia(s.titolo);
      pdf.scrivi(s.testo, { dopo: 4 });
    });

    // --- fonti ---
    const fonti = d.fonti.split("\n").map(s => s.trim()).filter(Boolean);
    if (fonti.length) {
      pdf.pagina();
      pdf.fascia("Le fonti normative");
      fonti.forEach(f => /^https?:\/\/\S+$/i.test(f) ? pdf.link(f, f, { size: 10 }) : pdf.scrivi("• " + f, { dopo: 1.5 }));
    }

    // --- glossario ---
    const voci = d.glossario.filter(g => g.termine);
    if (voci.length) {
      pdf.pagina();
      pdf.fascia("Glossario");
      voci.forEach(g => {
        pdf.riservaSpazio(16);
        pdf.scrivi(g.termine, { font: "helvetica", stile: "bold", size: 10.5, colore: C.blu, dopo: 0.5 });
        pdf.scrivi(g.definizione, { dopo: 3 });
      });
    }

    pdf.salva(PE.nomeFile("dossier " + atto.titolo, "dossier"), d.titolo || atto.titolo);
  }

  function collegaPdf(radice, atto, getDossier) {
    const btn = radice.querySelector("#btn-dossier-pdf, [data-dos-pdf]");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const testo = btn.textContent;
      btn.disabled = true; btn.style.opacity = "0.6"; btn.textContent = "Generazione PDF…";
      try { await scaricaPdf(atto, getDossier ? getDossier() : atto.dossier); }
      catch (e) { alert("Errore nella creazione del PDF: " + e.message); }
      finally { btn.disabled = false; btn.style.opacity = ""; btn.textContent = testo; }
    });
  }

  /* ====================================================================
     EDITOR (usato da redazione.js)
     ==================================================================== */

  const bottoniMov = () => `
    <button type="button" class="redazione-btn redazione-btn--piccolo" data-dos-su title="Sposta su">↑</button>
    <button type="button" class="redazione-btn redazione-btn--piccolo" data-dos-giu title="Sposta giù">↓</button>
    <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-dos-rimuovi title="Rimuovi">✕</button>`;

  function htmlTappa(t) {
    const col = Object.keys(COLORI_TAPPA).map(k =>
      `<option value="${k}" ${t.colore === k ? "selected" : ""}>${COLORI_TAPPA[k]}</option>`).join("");
    return `
      <div class="dos-mov dos-ed-tappa">
        <div class="dos-ed-barra"><strong>Tappa</strong><span class="dos-spacer"></span>${bottoniMov()}</div>
        <div class="dos-grid">
          <label>Fase<input type="text" data-k="fase" value="${esc(t.fase)}" placeholder="es. Inizio prima lettura" /></label>
          <label>Organo<input type="text" data-k="organo" value="${esc(t.organo)}" placeholder="es. Senato" /></label>
          <label>Riferimento<input type="text" data-k="riferimento" value="${esc(t.riferimento)}" placeholder="es. atto S.1429" /></label>
          <label>Data<input type="text" data-k="data" value="${esc(t.data)}" placeholder="es. 15 aprile 2014" /></label>
        </div>
        <div class="dos-grid dos-grid--2">
          <label>Esito<input type="text" data-k="esito" value="${esc(t.esito)}" placeholder="es. Approvato in prima deliberazione" /></label>
          <label>Colore del riquadro<select data-k="colore">${col}</select></label>
        </div>
      </div>`;
  }

  function htmlRiga(r) {
    const sotto = r.livello === 1;
    return `
      <div class="dos-mov dos-ed-riga${sotto ? " dos-ed-riga--sotto" : ""}" data-livello="${sotto ? 1 : 0}">
        <div class="dos-ed-riga__celle">
          <textarea data-prima rows="3" placeholder="Testo prima (vuoto = disposizione nuova)">${esc(r.prima)}</textarea>
          <textarea data-dopo rows="3" placeholder="Testo dopo (vuoto = disposizione soppressa)">${esc(r.dopo)}</textarea>
        </div>
        <div class="dos-ed-riga__az">
          <input type="text" class="dos-etichetta-input" data-etichetta value="${esc(r.etichetta || "")}" placeholder="1. / a)" title="Numero del comma o lettera del sottocomma" />
          <span class="dos-stato" data-stato></span>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-dos-copia title="Copia il testo di sinistra a destra">Copia → destra</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-dos-sotto title="Aggiungi un sottocomma sotto questa riga">+ sottocomma</button>
          <button type="button" class="redazione-btn redazione-btn--piccolo" data-dos-livello title="Trasforma in comma / sottocomma">${sotto ? "↰ comma" : "↳ sottocomma"}</button>
          <span class="dos-spacer"></span>${bottoniMov()}
        </div>
      </div>`;
  }

  function htmlBloccoTitolo(b) {
    return `
      <div class="dos-mov dos-ed-blocco dos-ed-blocco--titolo" data-tipo="titolo">
        <div class="dos-ed-barra"><strong>Titolo di gruppo</strong><span class="dos-spacer"></span>${bottoniMov()}</div>
        <textarea data-k="testo" rows="2" placeholder="es. PARTE I&#10;DIRITTI E DOVERI DEI CITTADINI">${esc(b.testo)}</textarea>
      </div>`;
  }

  function htmlBloccoArticolo(b) {
    return `
      <div class="dos-mov dos-ed-blocco" data-tipo="articolo">
        <div class="dos-ed-barra">
          <strong>Articolo</strong>
          <input type="text" data-k="numero" value="${esc(b.numero)}" style="width:90px" placeholder="n." />
          <input type="text" data-k="riferimento" value="${esc(b.riferimento)}" style="flex:1;min-width:200px" placeholder="Riferimento nel testo modificato (facoltativo), es. articolo 38, comma 1" />
          ${bottoniMov()}
        </div>
        <div class="dos-ed-righe">${b.righe.map(htmlRiga).join("")}</div>
        <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-dos-aggiungi="riga">+ Aggiungi comma</button>
      </div>`;
  }

  function htmlSezione(s) {
    return `
      <div class="dos-mov dos-ed-sezione">
        <div class="dos-ed-barra"><strong>Sezione</strong><span class="dos-spacer"></span>${bottoniMov()}</div>
        <input type="text" data-k="titolo" value="${esc(s.titolo)}" placeholder="Titolo della sezione" />
        <textarea data-k="testo" rows="5" placeholder="Testo (gli a capo vengono mantenuti)">${esc(s.testo)}</textarea>
      </div>`;
  }

  function htmlVoce(g) {
    return `
      <div class="dos-mov dos-ed-voce">
        <div class="dos-ed-barra"><strong>Voce</strong><span class="dos-spacer"></span>${bottoniMov()}</div>
        <input type="text" data-k="termine" value="${esc(g.termine)}" placeholder="Termine" />
        <textarea data-k="definizione" rows="2" placeholder="Definizione">${esc(g.definizione)}</textarea>
      </div>`;
  }

  function htmlEditor(atto, dIn, atti) {
    const d = normalizza(dIn || nuovo(atto));
    const esiste = !!(atto && atto.dossier);
    const agg = d.aggiornato && !isNaN(new Date(d.aggiornato))
      ? " · ultimo salvataggio " + new Date(d.aggiornato).toLocaleString("it-IT") : "";
    const opzAtti = (atti || []).filter(a => a.articoli && a.articoli.length)
      .slice().sort((a, b) => (a.titolo || "").localeCompare(b.titolo || ""))
      .map(a => `<option value="${esc(a.id)}" ${a.id === atto.id ? "selected" : ""}>${esc(a.titolo)} (n. ${esc(a.numero)}/${esc(a.anno)})</option>`).join("");

    return `
      <p class="breadcrumb"><a href="index.html">Home</a> &rsaquo; <a href="redazione.html">Redazione</a> &rsaquo;
        <a href="#" data-azione="dossier">Dossier</a> &rsaquo; ${esc(atto.titolo)}</p>
      <h1>${esiste ? "Modifica dossier" : "Nuovo dossier"}</h1>
      <p style="color:var(--inchiostro-tenue);margin-top:0;">Atto: <strong>${esc(atto.titolo)}</strong> (n. ${esc(atto.numero)}/${esc(atto.anno)})${esc(agg)}</p>
      <p id="dos-messaggio" class="redazione-messaggio" style="display:none;"></p>

      <form id="dossier-form" class="redazione-form redazione-form--dossier" novalidate>

        <fieldset class="dos-ed-sez"><legend>1 · Intestazione</legend>
          <div class="dos-grid dos-grid--2">
            <label>Titolo del dossier<input type="text" data-campo="titolo" value="${esc(d.titolo)}" /></label>
            <label>Sottotitolo<input type="text" data-campo="sottotitolo" value="${esc(d.sottotitolo)}" /></label>
            <label>A cura di<input type="text" data-campo="ente" value="${esc(d.ente)}" placeholder="es. Ufficio studi" /></label>
            <label>Data<input type="text" data-campo="data" value="${esc(d.data)}" placeholder="es. 26 ottobre 2026" /></label>
          </div>
          <label class="dos-etichetta-blocco">Presentazione
            <textarea data-campo="presentazione" rows="5" placeholder="Introduzione al dossier: cosa contiene e a chi serve.">${esc(d.presentazione)}</textarea></label>
        </fieldset>

        <fieldset class="dos-ed-sez"><legend>2 · Iter giuridico</legend>
          <p class="dos-aiuto">Le tappe dell'approvazione, dall'alto in basso. Ogni tappa diventa un riquadro colorato con freccia, come nel dossier cartaceo.</p>
          <div id="dos-iter-lista">${d.iter.map(htmlTappa).join("")}</div>
          <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-dos-aggiungi="tappa">+ Aggiungi tappa</button>
          <label class="dos-etichetta-blocco" style="margin-top:14px;">Pubblicazione finale (riquadro conclusivo)
            <input type="text" data-campo="pubblicazione" value="${esc(d.pubblicazione)}" placeholder="es. Gazzetta Ufficiale n. 88 del 15 aprile 2016" /></label>
        </fieldset>

        <fieldset class="dos-ed-sez"><legend>3 · Testo a fronte</legend>
          <p class="dos-aiuto">A sinistra il testo vigente, a destra quello modificato. Le differenze vengono evidenziate in automatico
            (grassetto a destra, barrato a sinistra); se i due testi sono uguali compare «Identico».</p>
          <div class="dos-grid dos-grid--2">
            <label>Intestazione colonna sinistra<input type="text" data-campo="etichettaPrima" value="${esc(d.etichettaPrima)}" /></label>
            <label>Intestazione colonna destra<input type="text" data-campo="etichettaDopo" value="${esc(d.etichettaDopo)}" /></label>
          </div>
          <div class="dos-import">
            <strong>Precompila da un atto</strong>
            <select id="dos-imp-atto">${opzAtti}</select>
            <input type="text" id="dos-imp-art" placeholder="Articoli, es. 1, 3-5 (vuoto = tutti)" />
            <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-dos-importa>Importa articoli</button>
            <select id="dos-imp-titolo" title="Titolo di gruppo dell'atto scelto">${htmlOpzioniTitoli(atto)}</select>
            <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-dos-importa-titolo>Importa titolo intero</button>
            <small>Copia i commi e i sottocommi in entrambe le colonne: poi modifichi solo la colonna di destra.
              «Importa titolo intero» porta il titolo di gruppo con tutti i suoi articoli, fino al titolo successivo.</small>
          </div>
          <div id="dos-blocchi">${d.articoli.map(b => b.tipo === "titolo" ? htmlBloccoTitolo(b) : htmlBloccoArticolo(b)).join("")}</div>
          <div class="dos-azioni-riga">
            <button type="button" class="redazione-btn redazione-btn--secondario" data-dos-aggiungi="articolo">+ Articolo</button>
            <button type="button" class="redazione-btn redazione-btn--secondario" data-dos-aggiungi="titolo">+ Titolo di gruppo</button>
          </div>
        </fieldset>

        <fieldset class="dos-ed-sez"><legend>4 · Altre sezioni (facoltative)</legend>
          <p class="dos-aiuto">Approfondimenti liberi: contesto storico, tabelle descrittive, note procedurali…</p>
          <div id="dos-sezioni-lista">${d.sezioni.map(htmlSezione).join("")}</div>
          <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-dos-aggiungi="sezione">+ Aggiungi sezione</button>
        </fieldset>

        <fieldset class="dos-ed-sez"><legend>5 · Fonti normative e glossario</legend>
          <label class="dos-etichetta-blocco">Fonti normative (una per riga; i link http(s) diventano cliccabili)
            <textarea data-campo="fonti" rows="4">${esc(d.fonti)}</textarea></label>
          <h4 style="margin:16px 0 8px;">Glossario</h4>
          <div id="dos-glossario-lista">${d.glossario.map(htmlVoce).join("")}</div>
          <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-dos-aggiungi="voce">+ Aggiungi voce</button>
        </fieldset>

        <fieldset class="dos-ed-sez"><legend>6 · Copertina del PDF</legend>
          ${typeof Copertina !== "undefined" ? Copertina.htmlEditor(d.copertina) : '<p class="dos-aiuto">Modulo copertine non caricato (assets/js/copertina.js).</p>'}
        </fieldset>

        <div class="redazione-azioni-form">
          <button type="submit" class="redazione-btn redazione-btn--primario">💾 Salva dossier</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" data-dos-pdf>⬇ Esporta in PDF</button>
          ${esiste ? `<a class="redazione-btn redazione-btn--secondario" style="text-decoration:none;display:inline-block;" href="dossier.html?id=${encodeURIComponent(atto.id)}" target="_blank" rel="noopener">👁 Apri pagina pubblica</a>` : ""}
          <button type="button" class="redazione-btn redazione-btn--secondario" data-azione="dossier">&larr; Elenco dossier</button>
          ${esiste ? `<button type="button" class="redazione-btn redazione-btn--pericolo" data-dos-elimina>Elimina dossier</button>` : ""}
        </div>
      </form>`;
  }

  function leggi(form) {
    const campo = k => { const el = form.querySelector(`[data-campo="${k}"]`); return el ? el.value.trim() : ""; };
    const k = (el, nome, scope) => { const x = el.querySelector(scope ? `:scope > ${scope} [data-k="${nome}"]` : `[data-k="${nome}"]`); return x ? x.value.trim() : ""; };

    const iter = [...form.querySelectorAll("#dos-iter-lista > .dos-ed-tappa")].map(el => ({
      fase: k(el, "fase"), organo: k(el, "organo"), riferimento: k(el, "riferimento"),
      data: k(el, "data"), esito: k(el, "esito"), colore: k(el, "colore") || "blu"
    })).filter(t => t.fase || t.organo || t.riferimento || t.data || t.esito);

    const articoli = [...form.querySelectorAll("#dos-blocchi > .dos-ed-blocco")].map(el => {
      if (el.dataset.tipo === "titolo") return { tipo: "titolo", testo: k(el, "testo") };
      return {
        tipo: "articolo",
        numero: k(el, "numero", ".dos-ed-barra"),
        riferimento: k(el, "riferimento", ".dos-ed-barra"),
        righe: [...el.querySelectorAll(":scope > .dos-ed-righe > .dos-ed-riga")].map(r => ({
          etichetta: r.querySelector("[data-etichetta]").value.trim(),
          livello: r.dataset.livello === "1" ? 1 : 0,
          prima: r.querySelector("[data-prima]").value.trim(),
          dopo: r.querySelector("[data-dopo]").value.trim()
        })).filter(r => r.prima || r.dopo)
      };
    }).filter(b => b.tipo === "titolo" ? b.testo : (b.numero || b.righe.length));

    const sezioni = [...form.querySelectorAll("#dos-sezioni-lista > .dos-ed-sezione")]
      .map(el => ({ titolo: k(el, "titolo"), testo: k(el, "testo") })).filter(s => s.titolo || s.testo);
    const glossario = [...form.querySelectorAll("#dos-glossario-lista > .dos-ed-voce")]
      .map(el => ({ termine: k(el, "termine"), definizione: k(el, "definizione") })).filter(g => g.termine);

    return normalizza({
      titolo: campo("titolo"), sottotitolo: campo("sottotitolo"), ente: campo("ente"), data: campo("data"),
      presentazione: campo("presentazione"),
      etichettaPrima: campo("etichettaPrima"), etichettaDopo: campo("etichettaDopo"),
      iter, pubblicazione: campo("pubblicazione"), articoli, sezioni, fonti: campo("fonti"), glossario,
      copertina: (form.querySelector("[data-cop]") && window.Copertina) ? Copertina.leggi(form.querySelector("[data-cop]")) : null
    });
  }

  function messaggio(testo, errore) {
    const el = document.getElementById("dos-messaggio");
    if (!el) return;
    el.textContent = testo || "";
    el.style.display = testo ? "block" : "none";
    el.classList.toggle("dos-messaggio--errore", !!errore);
    if (testo) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const ETICHETTE_STATO = { identico: "Identico", modificato: "Modificato", aggiunto: "Aggiunto", soppresso: "Soppresso", vuota: "—" };
  function aggiornaStato(riga) {
    const st = statoRiga({ prima: riga.querySelector("[data-prima]").value, dopo: riga.querySelector("[data-dopo]").value });
    const b = riga.querySelector("[data-stato]");
    b.textContent = ETICHETTE_STATO[st];
    b.className = "dos-stato dos-stato--" + st;
  }

  // "1, 3-5, 12-bis" -> Set di etichette (null = tutti)
  function parseNumeri(s) {
    const t = (s || "").trim();
    if (!t) return null;
    const out = new Set();
    t.split(/[,;]+/).map(x => x.trim().toLowerCase()).filter(Boolean).forEach(x => {
      const m = x.match(/^(\d+)\s*-\s*(\d+)$/);
      if (m && +m[2] >= +m[1] && +m[2] - +m[1] < 500) { for (let i = +m[1]; i <= +m[2]; i++) out.add(String(i)); }
      else out.add(x);
    });
    return out;
  }

  function blocchiDaAtto(atto, numeri) {
    const eTit = a => typeof eTitoloGruppo === "function" ? eTitoloGruppo(a) : a && a.tipo === "titolo";
    const out = [];
    (atto.articoli || []).forEach(art => {
      if (eTit(art)) { if (!numeri) out.push({ tipo: "titolo", testo: testoPuro(art.testo) }); return; }
      if (numeri && !numeri.has(String(art.numero).trim().toLowerCase())) return;
      const commi = typeof commiDiArticolo === "function" ? commiDiArticolo(art) : (art.commi || []);
      // un box per ogni comma e uno per ogni sottocomma, con la numerazione dell'atto (1., 2. … / a), b) …)
      const righe = [];
      commi.forEach((c, ic) => {
        const t = testoPuro(c.testo);
        righe.push({ etichetta: commi.length > 1 ? `${ic + 1}.` : "", livello: 0, prima: t, dopo: t });
        (c.sottocommi || []).filter(s => s && s.trim()).forEach((s, is) => {
          const ts = testoPuro(s);
          righe.push({ etichetta: `${lettera(is)})`, livello: 1, prima: ts, dopo: ts });
        });
      });
      out.push({ tipo: "articolo", numero: String(art.numero), riferimento: "", righe });
    });
    return out;
  }

  const eTitolo = a => typeof eTitoloGruppo === "function" ? eTitoloGruppo(a) : !!(a && a.tipo === "titolo");

  // <option> dei titoli di gruppo di un atto: il valore è la posizione nell'elenco degli articoli
  function htmlOpzioniTitoli(atto) {
    const arts = (atto && atto.articoli) || [], out = [];
    arts.forEach((a, i) => {
      if (!eTitolo(a)) return;
      let n = 0;
      for (let j = i + 1; j < arts.length && !eTitolo(arts[j]); j++) n++;
      out.push(`<option value="${i}">${esc(testoPuro(a.testo).replace(/\s*\n\s*/g, " — "))} (${n} art.)</option>`);
    });
    return out.join("") || '<option value="">Nessun titolo di gruppo in questo atto</option>';
  }

  function sposta(el, dir) {
    if (dir < 0 && el.previousElementSibling) el.parentElement.insertBefore(el, el.previousElementSibling);
    else if (dir > 0 && el.nextElementSibling) el.parentElement.insertBefore(el.nextElementSibling, el);
  }

  // opz: { atto, atti, salva(dossier) -> Promise<{ok, errore}>, elimina() -> Promise<{ok, errore}> }
  function collega(form, opz) {
    form.querySelectorAll(".dos-ed-riga").forEach(aggiornaStato);

    const aggiungi = (contenitore, html) => { contenitore.insertAdjacentHTML("beforeend", html); return contenitore.lastElementChild; };

    form.addEventListener("click", async e => {
      const t = e.target;
      const su = t.closest("[data-dos-su]"), giu = t.closest("[data-dos-giu]"), rim = t.closest("[data-dos-rimuovi]");
      if (su || giu || rim) {
        const el = t.closest(".dos-mov");
        if (!el) return;
        if (rim) { el.remove(); return; }
        sposta(el, su ? -1 : 1);
        return;
      }

      const agg = t.closest("[data-dos-aggiungi]");
      if (agg) {
        const cosa = agg.getAttribute("data-dos-aggiungi");
        if (cosa === "tappa") aggiungi(form.querySelector("#dos-iter-lista"), htmlTappa({ colore: "blu", fase: "", organo: "", riferimento: "", data: "", esito: "" }));
        else if (cosa === "articolo") aggiungi(form.querySelector("#dos-blocchi"), htmlBloccoArticolo({ numero: "", riferimento: "", righe: [{ prima: "", dopo: "" }] }));
        else if (cosa === "titolo") aggiungi(form.querySelector("#dos-blocchi"), htmlBloccoTitolo({ testo: "" }));
        else if (cosa === "riga") { const r = aggiungi(agg.closest(".dos-ed-blocco").querySelector(".dos-ed-righe"), htmlRiga({ prima: "", dopo: "" })); aggiornaStato(r); }
        else if (cosa === "sezione") aggiungi(form.querySelector("#dos-sezioni-lista"), htmlSezione({ titolo: "", testo: "" }));
        else if (cosa === "voce") aggiungi(form.querySelector("#dos-glossario-lista"), htmlVoce({ termine: "", definizione: "" }));
        return;
      }

      const sottoBtn = t.closest("[data-dos-sotto]");
      if (sottoBtn) {
        const riga = sottoBtn.closest(".dos-ed-riga");
        let inizio = riga;                                   // risale al comma da cui parte il gruppo
        while (inizio.dataset.livello === "1" && inizio.previousElementSibling) inizio = inizio.previousElementSibling;
        let ultima = inizio, n = 0;                          // scende fino all'ultimo sottocomma del gruppo
        while (ultima.nextElementSibling && ultima.nextElementSibling.dataset.livello === "1") { ultima = ultima.nextElementSibling; n++; }
        ultima.insertAdjacentHTML("afterend", htmlRiga({ prima: "", dopo: "", livello: 1, etichetta: `${lettera(n)})` }));
        const nuova = ultima.nextElementSibling;
        aggiornaStato(nuova);
        nuova.querySelector("[data-prima]").focus();
        return;
      }

      const livelloBtn = t.closest("[data-dos-livello]");
      if (livelloBtn) {
        const riga = livelloBtn.closest(".dos-ed-riga");
        const sotto = riga.dataset.livello !== "1";
        riga.dataset.livello = sotto ? "1" : "0";
        riga.classList.toggle("dos-ed-riga--sotto", sotto);
        livelloBtn.textContent = sotto ? "↰ comma" : "↳ sottocomma";
        return;
      }

      const copia = t.closest("[data-dos-copia]");
      if (copia) {
        const riga = copia.closest(".dos-ed-riga");
        riga.querySelector("[data-dopo]").value = riga.querySelector("[data-prima]").value;
        aggiornaStato(riga);
        return;
      }

      const impArt = t.closest("[data-dos-importa]"), impTit = t.closest("[data-dos-importa-titolo]");
      if (impArt || impTit) {
        const id = form.querySelector("#dos-imp-atto").value;
        const sorgente = (opz.atti || []).find(a => a.id === id);
        if (!sorgente) { messaggio("Seleziona un atto da cui importare.", true); return; }
        let blocchi;
        if (impTit) {
          const v = form.querySelector("#dos-imp-titolo").value;
          const arts = sorgente.articoli || [];
          if (v === "" || !eTitolo(arts[+v])) { messaggio("Questo atto non ha titoli di gruppo da importare.", true); return; }
          let fine = arts.length;
          for (let j = +v + 1; j < arts.length; j++) if (eTitolo(arts[j])) { fine = j; break; }
          blocchi = blocchiDaAtto({ articoli: arts.slice(+v, fine) }, null);   // titolo + articoli fino al titolo successivo
        } else {
          blocchi = blocchiDaAtto(sorgente, parseNumeri(form.querySelector("#dos-imp-art").value));
        }
        if (!blocchi.length) { messaggio("Nessun articolo trovato con quei numeri.", true); return; }
        const cont = form.querySelector("#dos-blocchi");
        blocchi.forEach(b => aggiungi(cont, b.tipo === "titolo" ? htmlBloccoTitolo(b) : htmlBloccoArticolo(b)));
        cont.querySelectorAll(".dos-ed-riga").forEach(aggiornaStato);
        const nRighe = blocchi.reduce((n, b) => n + (b.righe ? b.righe.length : 0), 0);
        messaggio(`✅ Importati ${blocchi.filter(b => b.tipo === "articolo").length} articoli (${nRighe} tra commi e sottocommi, ciascuno nel suo box): modifica ora la colonna di destra.`);
        return;
      }

      if (t.closest("[data-dos-elimina]")) {
        if (!confirm("Eliminare definitivamente il dossier di questo atto?")) return;
        const r = await opz.elimina();
        if (!r.ok) messaggio("Errore eliminazione: " + r.errore, true);
      }
    });

    form.addEventListener("change", e => {
      if (e.target.id !== "dos-imp-atto") return;
      const sorg = (opz.atti || []).find(a => a.id === e.target.value);
      form.querySelector("#dos-imp-titolo").innerHTML = htmlOpzioniTitoli(sorg);
    });

    form.addEventListener("input", e => {
      if (e.target.matches("[data-prima],[data-dopo]")) aggiornaStato(e.target.closest(".dos-ed-riga"));
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true; btn.textContent = "Salvataggio…";
      const r = await opz.salva(leggi(form));
      btn.disabled = false; btn.textContent = "💾 Salva dossier";
      if (!r.ok) messaggio("Errore salvataggio: " + r.errore, true);
    });

    const cop = form.querySelector("[data-cop]");
    if (cop && window.Copertina) {
      const v = k => { const el = form.querySelector(`[data-campo="${k}"]`); return el ? el.value.trim() : ""; };
      Copertina.collega(cop, () => varsDocumento({ titolo: v("titolo"), sottotitolo: v("sottotitolo"), ente: v("ente"), data: v("data") }, opz.atto));
    }

    collegaPdf(form, opz.atto, () => leggi(form));
  }

  window.Dossier = {
    normalizza, nuovo, htmlEditor, collega, leggi, messaggio,
    htmlPagina, collegaPdf, scaricaPdf,
    // esposti per test
    _diff: diff, _statoRiga: statoRiga, _confrontaRiga: confrontaRiga, _tokHtml: tokHtml, _riepilogo: riepilogo, _parseNumeri: parseNumeri, _blocchiDaAtto: blocchiDaAtto, _htmlOpzioniTitoli: htmlOpzioniTitoli
  };
})();