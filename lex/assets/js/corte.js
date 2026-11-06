// assets/js/corte.js — pagina pubblica "Pronunce" della Corte Costituzionale (browser).
// Dipende da: corte-diff.js (CorteDiff), corte-api.js (CorteAPI), corte-layout.js (renderTestataCorte/Footer).
// NON è l'endpoint server: quello sta in api/corte.js.
(function () {
  "use strict";

  const esc = CorteDiff.esc;
  const root = document.getElementById("corte-root");

  const TIPI = {
    modifica: "Modifica",
    annullamento: "Annullamento",
    abrogazione: "Abrogazione"
  };
  const stato = { tutte: [], tipo: "", q: "" };

  /* ---------- stili minimi (si aggiungono a corte.css, non lo sostituiscono) ---------- */
  const css = `
  .cc-filtri{display:flex;flex-wrap:wrap;gap:.6rem;margin:1.5rem 0}
  .cc-filtri input,.cc-filtri select{padding:.55rem .7rem;font:inherit;border:1px solid #8884;border-radius:4px;background:transparent;color:inherit}
  .cc-filtri input{flex:1 1 240px}
  .cc-conteggio{opacity:.7;margin:0 0 1rem;font-size:.9rem}
  .cc-lista{display:grid;gap:1rem;margin-bottom:2rem}
  .cc-card{border:1px solid #8884;border-left:4px solid #888;border-radius:4px;padding:1rem 1.2rem}
  .cc-card.t-modifica{border-left-color:#d9a400}
  .cc-card.t-annullamento{border-left-color:#c0392b}
  .cc-card.t-abrogazione{border-left-color:#7f8c8d}
  .cc-testa{display:flex;flex-wrap:wrap;gap:.5rem 1rem;align-items:baseline;justify-content:space-between}
  .cc-sent{font-weight:700;font-size:1.05rem;margin:0}
  .cc-badge{font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;padding:.15rem .5rem;border-radius:3px;border:1px solid currentColor}
  .cc-meta{opacity:.75;font-size:.88rem;margin:.3rem 0}
  .cc-ogg{margin:.6rem 0;font-weight:600}
  .cc-card h4{margin:1rem 0 .3rem;font-size:.85rem;text-transform:uppercase;letter-spacing:.05em;opacity:.8}
  .cc-testo{white-space:pre-wrap;margin:0}
  .cc-card details{margin-top:.8rem}
  .cc-card summary{cursor:pointer;font-weight:600}
  .cc-mod{border:1px solid #8883;border-radius:4px;padding:.7rem .9rem;margin:.6rem 0}
  .cc-mod strong{display:block;margin-bottom:.3rem}
  .cc-az{font-size:.75rem;text-transform:uppercase;opacity:.7;margin-left:.4rem}
  .cc-diff{white-space:pre-wrap;margin:.3rem 0;font-family:inherit}
  .cc-diff del{background:#e74c3c33;text-decoration:line-through}
  .cc-diff ins{background:#27ae6033;text-decoration:none}
  .cc-vuoto,.cc-err{padding:2rem 0;text-align:center;opacity:.8}
  .cc-err{color:#c0392b;opacity:1}
  `;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  /* ---------- utilità ---------- */
  function dataLeggibile(p) {
    if (p.data) return p.data;
    if (p.creataIl) {
      const d = new Date(p.creataIl);
      if (!isNaN(d)) return d.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
    }
    return "";
  }

  function righeBlocco(snap, rubricaAltro) {
    if (!snap) return "";
    const righe = CorteDiff.righeArticolo(snap);
    return (snap.rubrica ? "(" + snap.rubrica + ")\n" : "") + righe.join("\n");
  }

  /* ---------- rendering di una modifica ---------- */
  function renderModifica(m) {
    if (m.azione === "titolo-aggiunto" || m.azione === "titolo-soppresso") {
      const ins = m.azione === "titolo-aggiunto";
      return `<div class="cc-mod"><strong>Titolo<span class="cc-az">${ins ? "aggiunto" : "soppresso"}</span></strong>
        <p class="cc-diff">${ins ? "<ins>" : "<del>"}${esc(m.testoTitolo)}${ins ? "</ins>" : "</del>"}</p></div>`;
    }
    const etichetta = { modificato: "modificato", aggiunto: "aggiunto", soppresso: "soppresso" }[m.azione] || m.azione;
    let corpo = "";
    if (m.azione === "modificato") {
      const d = CorteDiff.htmlDiff(righeBlocco(m.prima), righeBlocco(m.dopo));
      corpo = `<h4>Testo previgente</h4><p class="cc-diff">${d.prima}</p>
               <h4>Nuovo testo</h4><p class="cc-diff">${d.dopo}</p>`;
    } else if (m.azione === "aggiunto") {
      corpo = `<h4>Nuovo testo</h4><p class="cc-diff"><ins>${esc(righeBlocco(m.dopo))}</ins></p>`;
    } else {
      corpo = `<h4>Testo soppresso</h4><p class="cc-diff"><del>${esc(righeBlocco(m.prima))}</del></p>`;
    }
    return `<div class="cc-mod"><strong>${esc(m.riferimento)}<span class="cc-az">${esc(etichetta)}</span></strong>${corpo}</div>`;
  }

  /* ---------- rendering di una pronuncia ---------- */
  function renderPronuncia(p) {
    const tipo = TIPI[p.tipo] ? p.tipo : "modifica";
    const a = p.atto || {};
    const mods = Array.isArray(p.modifiche) ? p.modifiche : [];
    const atto = [a.titolo, a.numero && a.anno ? `n. ${a.numero}/${a.anno}` : ""].filter(Boolean).join(" — ");

    return `
    <article class="cc-card t-${tipo}" id="${esc(p.id)}">
      <div class="cc-testa">
        <h3 class="cc-sent">Sentenza n. ${esc(p.numero)}/${esc(p.anno)}</h3>
        <span class="cc-badge">${esc(TIPI[tipo])}</span>
      </div>
      <p class="cc-meta">${esc(dataLeggibile(p))}${p.collegio ? " · Collegio: " + esc(p.collegio) : ""}</p>
      <p class="cc-meta">Atto: ${esc(atto || a.id || "—")}${a.stato ? " (" + esc(a.stato) + ")" : ""}</p>
      <p class="cc-ogg">${esc(p.oggetto)}</p>
      <h4>Dispositivo</h4><p class="cc-testo">${esc(p.dispositivo)}</p>
      ${p.effetto ? `<h4>Effetto</h4><p class="cc-testo">${esc(p.effetto)}</p>` : ""}
      <details><summary>Motivazione</summary><p class="cc-testo">${esc(p.motivazione)}</p></details>
      ${mods.length ? `<details><summary>Modifiche al testo (${mods.length})</summary>${mods.map(renderModifica).join("")}</details>` : ""}
      ${p.firmataDa ? `<p class="cc-meta">Firmata da ${esc(p.firmataDa)}</p>` : ""}
    </article>`;
  }

  /* ---------- filtri ---------- */
  function filtrate() {
    const q = stato.q.trim().toLowerCase();
    return stato.tutte.filter(p => {
      if (stato.tipo && p.tipo !== stato.tipo) return false;
      if (!q) return true;
      const a = p.atto || {};
      return [p.numero, p.anno, p.oggetto, p.dispositivo, p.motivazione, p.collegio, a.titolo, a.id]
        .some(v => String(v == null ? "" : v).toLowerCase().includes(q));
    });
  }

  function aggiornaLista() {
    const f = filtrate();
    document.getElementById("cc-conteggio").textContent =
      f.length === 1 ? "1 pronuncia" : f.length + " pronunce";
    document.getElementById("cc-lista").innerHTML = f.length
      ? f.map(renderPronuncia).join("")
      : `<p class="cc-vuoto">Nessuna pronuncia trovata.</p>`;
  }

  function costruisciPagina() {
    root.innerHTML = `
      <h2>Pronunce della Corte</h2>
      <div class="cc-filtri">
        <input id="cc-q" type="search" placeholder="Cerca per numero, atto, oggetto…" aria-label="Cerca">
        <select id="cc-tipo" aria-label="Tipo di pronuncia">
          <option value="">Tutti i tipi</option>
          ${Object.keys(TIPI).map(k => `<option value="${k}">${TIPI[k]}</option>`).join("")}
        </select>
      </div>
      <p class="cc-conteggio" id="cc-conteggio"></p>
      <div class="cc-lista" id="cc-lista"></div>`;
    document.getElementById("cc-q").addEventListener("input", e => { stato.q = e.target.value; aggiornaLista(); });
    document.getElementById("cc-tipo").addEventListener("change", e => { stato.tipo = e.target.value; aggiornaLista(); });
    aggiornaLista();

    // link diretto: corte.html#s-2026-1-atto
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
    }
  }

  /* ---------- avvio ---------- */
  async function avvia() {
    renderTestataCorte("home");
    renderFooterCorte();
    root.innerHTML = `<p class="cc-vuoto">Caricamento delle pronunce…</p>`;
    try {
      stato.tutte = await CorteAPI.pronunce();
      costruisciPagina();
    } catch (e) {
      root.innerHTML = `<p class="cc-err">Impossibile caricare le pronunce: ${esc(e.message)}</p>`;
    }
  }

  avvia();
})();