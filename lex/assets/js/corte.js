// assets/js/corte.js — pagina pubblica della Corte Costituzionale (browser).
//   corte.html            -> menu con tutte le sentenze
//   corte.html?id=<id>    -> la singola pronuncia, con testo prima/dopo se presente
// Dipende da: corte-diff.js (CorteDiff), corte-api.js (CorteAPI), corte-layout.js.
// NON è l'endpoint server: quello sta in api/corte.js.
(function () {
  "use strict";

  const esc = CorteDiff.esc;
  const root = document.getElementById("corte-root");

  const TIPI = { modifica: "Modifica", annullamento: "Annullamento", abrogazione: "Abrogazione" };
  const STATI = { vigente: "Vigente", annullato: "Annullato", abrogato: "Abrogato" };

  /* ---------- stili (si aggiungono a corte.css) ---------- */
  const st = document.createElement("style");
  st.textContent = `
  .cc-titolo{margin:1.5rem 0 .3rem}
  .cc-sub{opacity:.75;margin:0 0 1.2rem}
  .cc-filtri{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0}
  .cc-filtri input,.cc-filtri select{padding:.55rem .7rem;font:inherit;border:1px solid #8885;border-radius:4px;background:transparent;color:inherit}
  .cc-filtri input{flex:1 1 240px}
  .cc-menu{list-style:none;margin:0 0 2rem;padding:0;display:grid;gap:.6rem}
  .cc-voce{display:block;text-decoration:none;color:inherit;border:1px solid #8885;border-left:4px solid #888;border-radius:4px;padding:.8rem 1.1rem;transition:background .15s}
  .cc-voce:hover,.cc-voce:focus-visible{background:#8881}
  .t-modifica{border-left-color:#d9a400}
  .t-annullamento{border-left-color:#c0392b}
  .t-abrogazione{border-left-color:#7f8c8d}
  .cc-riga{display:flex;flex-wrap:wrap;gap:.3rem 1rem;align-items:baseline;justify-content:space-between}
  .cc-num{font-weight:700}
  .cc-badge{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;padding:.1rem .5rem;border-radius:3px;border:1px solid currentColor;white-space:nowrap}
  .cc-ogg{margin:.35rem 0 .2rem}
  .cc-meta{opacity:.7;font-size:.85rem;margin:0}
  .cc-indietro{display:inline-block;margin:1.2rem 0 .5rem}
  .cc-sez{margin:1.6rem 0 .5rem;padding-bottom:.3rem;border-bottom:1px solid #8885;font-size:1rem;text-transform:uppercase;letter-spacing:.05em}
  .cc-testo{white-space:pre-wrap;margin:0;line-height:1.55}
  .cc-avviso{border:1px solid #8885;border-radius:4px;padding:.8rem 1rem;margin:1rem 0;background:#8881}
  .cc-mod{margin:1.2rem 0}
  .cc-mod h4{margin:0 0 .5rem;font-size:1rem}
  .cc-az{font-size:.72rem;text-transform:uppercase;opacity:.7;margin-left:.5rem;font-weight:400}
  .cc-colonne{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}
  @media(max-width:760px){.cc-colonne{grid-template-columns:1fr}}
  .cc-col{border:1px solid #8885;border-radius:4px;padding:.7rem .9rem}
  .cc-col>.cc-lbl{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;opacity:.7;margin:0 0 .4rem}
  .cc-col.vuota{opacity:.55;font-style:italic}
  .cc-rub{font-weight:600;margin:0 0 .4rem}
  .cc-col del{background:#e74c3c33;text-decoration:line-through}
  .cc-col ins{background:#27ae6033;text-decoration:none}
  .cc-testata{border:1px solid #8885;border-left:4px solid #888;border-radius:4px;padding:1rem 1.2rem;margin:.5rem 0 1.2rem}
  .cc-testata .cc-titolo{margin:0}
  .cc-lead{font-size:1.1rem;line-height:1.45;margin:.7rem 0 1rem}
  .cc-dati{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.7rem 1.5rem;margin:0;padding-top:.8rem;border-top:1px solid #8885}
  .cc-dati dt{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;opacity:.65;margin:0 0 .15rem}
  .cc-dati dd{margin:0;font-size:.92rem}
  .cc-pareri{align-items:start}
  .cc-pareri .cc-lbl{font-size:.8rem;font-weight:600;margin:0 0 .5rem}
  .cc-vuoto,.cc-err{padding:2rem 0;text-align:center}
  .cc-err{color:#c0392b}
  `;
  document.head.appendChild(st);

  /* ---------- utilità ---------- */
  function dataDi(p) {
    if (p.data) return p.data;
    const d = p.creataIl ? new Date(p.creataIl) : null;
    return d && !isNaN(d) ? d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) : "";
  }
  const titoloSentenza = p => `Sentenza n. ${p.numero}/${p.anno}`;
  const linkPronuncia = id => "corte.html?id=" + encodeURIComponent(id);
  const testoCommi = snap => (snap ? CorteDiff.righeArticolo(snap).join("\n") : "");

  /* ---------- MENU ---------- */
  const filtro = { tipo: "", q: "" };
  let tutte = [];

  function voceMenu(p) {
    const tipo = TIPI[p.tipo] ? p.tipo : "modifica";
    const a = p.atto || {};
    return `<li><a class="cc-voce t-${tipo}" href="${esc(linkPronuncia(p.id))}">
      <div class="cc-riga"><span class="cc-num">${esc(titoloSentenza(p))}</span><span class="cc-badge">${esc(TIPI[tipo])}</span></div>
      <p class="cc-ogg">${esc(p.oggetto)}</p>
      <p class="cc-meta">${esc(a.titolo || a.id || "")}${dataDi(p) ? " · " + esc(dataDi(p)) : ""}</p>
    </a></li>`;
  }

  function filtrate() {
    const q = filtro.q.trim().toLowerCase();
    return tutte.filter(p => {
      if (filtro.tipo && p.tipo !== filtro.tipo) return false;
      if (!q) return true;
      const a = p.atto || {};
      return [p.numero, p.anno, p.oggetto, p.dispositivo, a.titolo, a.id]
        .some(v => String(v == null ? "" : v).toLowerCase().includes(q));
    });
  }

  function aggiornaMenu() {
    const f = filtrate();
    document.getElementById("cc-menu").innerHTML =
      f.length ? f.map(voceMenu).join("") : `<li class="cc-vuoto">Nessuna pronuncia trovata.</li>`;
  }

  function mostraMenu() {
    document.title = "Corte Costituzionale";
    root.innerHTML = `
      <h2 class="cc-titolo">Pronunce della Corte</h2>
      <p class="cc-sub">Seleziona una sentenza per leggerla.</p>
      <div class="cc-filtri">
        <input id="cc-q" type="search" placeholder="Cerca per numero, atto, oggetto…" aria-label="Cerca">
        <select id="cc-tipo" aria-label="Tipo di pronuncia">
          <option value="">Tutti i tipi</option>
          ${Object.keys(TIPI).map(k => `<option value="${k}">${TIPI[k]}</option>`).join("")}
        </select>
      </div>
      <ul class="cc-menu" id="cc-menu"></ul>`;
    document.getElementById("cc-q").addEventListener("input", e => { filtro.q = e.target.value; aggiornaMenu(); });
    document.getElementById("cc-tipo").addEventListener("change", e => { filtro.tipo = e.target.value; aggiornaMenu(); });
    aggiornaMenu();
  }

  /* ---------- DETTAGLIO ---------- */
  function colonna(etichetta, snap, html) {
    if (!snap) return `<div class="cc-col vuota"><p class="cc-lbl">${etichetta}</p><p class="cc-testo">—</p></div>`;
    return `<div class="cc-col"><p class="cc-lbl">${etichetta}</p>
      ${html.rub ? `<p class="cc-rub">${html.rub}</p>` : ""}
      <p class="cc-testo">${html.testo}</p></div>`;
  }

  function renderModifica(m) {
    if (m.azione === "titolo-aggiunto" || m.azione === "titolo-soppresso") {
      const ins = m.azione === "titolo-aggiunto";
      return `<div class="cc-mod"><h4>Titolo<span class="cc-az">${ins ? "aggiunto" : "soppresso"}</span></h4>
        <div class="cc-colonne">
          ${ins ? colonna("Prima", null, {}) : `<div class="cc-col"><p class="cc-lbl">Prima</p><p class="cc-testo"><del>${esc(m.testoTitolo)}</del></p></div>`}
          ${ins ? `<div class="cc-col"><p class="cc-lbl">Dopo</p><p class="cc-testo"><ins>${esc(m.testoTitolo)}</ins></p></div>` : colonna("Dopo", null, {})}
        </div></div>`;
    }

    let p, d;
    if (m.prima && m.dopo) {
      const r = CorteDiff.htmlDiff(m.prima.rubrica || "", m.dopo.rubrica || "");
      const t = CorteDiff.htmlDiff(testoCommi(m.prima), testoCommi(m.dopo));
      p = { rub: r.prima, testo: t.prima };
      d = { rub: r.dopo, testo: t.dopo };
    } else if (m.prima) {
      p = { rub: `<del>${esc(m.prima.rubrica || "")}</del>`, testo: `<del>${esc(testoCommi(m.prima))}</del>` };
    } else if (m.dopo) {
      d = { rub: `<ins>${esc(m.dopo.rubrica || "")}</ins>`, testo: `<ins>${esc(testoCommi(m.dopo))}</ins>` };
    }
    return `<div class="cc-mod"><h4>${esc(m.riferimento)}<span class="cc-az">${esc(m.azione)}</span></h4>
      <div class="cc-colonne">${colonna("Prima", m.prima, p || {})}${colonna("Dopo", m.dopo, d || {})}</div></div>`;
  }

  function sezioneTesti(p) {
    const mods = Array.isArray(p.modifiche) ? p.modifiche : [];
    if (mods.length) {
      return `<h3 class="cc-sez">Testo prima e dopo la pronuncia</h3>${mods.map(renderModifica).join("")}`;
    }
    if (p.tipo === "annullamento")
      return `<div class="cc-avviso">L'atto è stato annullato: non esiste un testo sostitutivo da confrontare.</div>`;
    if (p.tipo === "abrogazione")
      return `<div class="cc-avviso">L'atto è stato abrogato: non esiste un testo sostitutivo da confrontare.</div>`;
    return "";
  }

  function mostraPronuncia(p) {
    const tipo = TIPI[p.tipo] ? p.tipo : "modifica";
    const a = p.atto || {};
    document.title = titoloSentenza(p) + " — Corte Costituzionale";
    root.innerHTML = `
      <a class="cc-indietro" href="corte.html">← Tutte le pronunce</a>
      <header class="cc-testata t-${tipo}">
        <div class="cc-riga">
          <h2 class="cc-titolo">${esc(titoloSentenza(p))}</h2>
          <span class="cc-badge">${esc(TIPI[tipo])}</span>
        </div>
        <p class="cc-lead">${esc(p.oggetto)}</p>
        <dl class="cc-dati">
          <div><dt>Data</dt><dd>${esc(dataDi(p) || "—")}</dd></div>
          <div><dt>Atto</dt><dd>${esc(a.titolo || a.id || "—")}${a.stato ? " <span class=\"cc-meta\">(" + esc(STATI[a.stato] || a.stato) + ")</span>" : ""}</dd></div>
          ${p.effetto ? `<div><dt>Effetto</dt><dd>${esc(p.effetto)}</dd></div>` : ""}
          ${p.firmataDa ? `<div><dt>Firmata da</dt><dd>${esc(p.firmataDa)}</dd></div>` : ""}
          ${p.collegio ? `<div><dt>Collegio</dt><dd>${esc(p.collegio)}</dd></div>` : ""}
        </dl>
      </header>
      <div class="cc-colonne cc-pareri">
        <section class="cc-col"><h3 class="cc-lbl">Motivazione</h3><p class="cc-testo">${esc(p.motivazione)}</p></section>
        <section class="cc-col"><h3 class="cc-lbl">Dispositivo</h3><p class="cc-testo">${esc(p.dispositivo)}</p></section>
      </div>
      ${sezioneTesti(p)}
      <a class="cc-indietro" href="corte.html">← Tutte le pronunce</a>`;
    window.scrollTo(0, 0);
  }

  /* ---------- avvio ---------- */
  async function avvia() {
    renderTestataCorte("home");
    renderFooterCorte();
    root.innerHTML = `<p class="cc-vuoto">Caricamento…</p>`;
    try {
      tutte = await CorteAPI.pronunce();
    } catch (e) {
      root.innerHTML = `<p class="cc-err">Impossibile caricare le pronunce: ${esc(e.message)}</p>`;
      return;
    }
    const id = new URLSearchParams(location.search).get("id");
    if (!id) return mostraMenu();
    const p = tutte.find(x => x.id === id);
    if (p) return mostraPronuncia(p);
    root.innerHTML = `<a class="cc-indietro" href="corte.html">← Tutte le pronunce</a>
      <p class="cc-err">Pronuncia non trovata.</p>`;
  }

  avvia();
})();