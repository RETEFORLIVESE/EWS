// assets/js/corte.js — sito pubblico: elenco delle pronunce e dettaglio (?id=...)
(function () {
  const { esc, htmlDiff, commiDi } = CorteDiff;
  const ETICHETTE = { modifica: "Modifica", annullamento: "Annullamento", abrogazione: "Abrogazione" };
  let pronunce = [], tipoAttivo = "Tutte", q = "";

  const nomeStato = s => s === "annullato" ? "annullato" : s === "abrogato" ? "abrogato" : "vigente";

  function filtrate() {
    const t = q.trim().toLowerCase();
    return pronunce.filter(p =>
      (tipoAttivo === "Tutte" || p.tipo === tipoAttivo) &&
      (!t || [p.oggetto, p.atto.titolo, p.numero + "/" + p.anno, p.motivazione].join(" ").toLowerCase().includes(t)));
  }

  function scheda(p) {
    return `
      <a class="scheda-atto scheda-atto--${esc(p.tipo)}" href="corte.html?id=${encodeURIComponent(p.id)}">
        <div class="scheda-atto__meta">
          <span class="badge-tipo ${esc(p.tipo)}">${ETICHETTE[p.tipo] || esc(p.tipo)}</span>
          <span>Sentenza n. ${esc(p.numero)}/${esc(p.anno)} &middot; ${esc(p.data)}</span>
        </div>
        <h3 class="scheda-atto__titolo">${esc(p.oggetto)}</h3>
        <p class="scheda-atto__sommario">Atto: ${esc(p.atto.titolo)}</p>
      </a>`;
  }

  function renderElenco() {
    const r = filtrate();
    document.getElementById("conteggio").textContent =
      r.length === pronunce.length ? `${pronunce.length} pronunce pubblicate` : `${r.length} risultati su ${pronunce.length}`;
    document.getElementById("elenco").innerHTML = r.length
      ? r.map(scheda).join("") : `<div class="nessun-risultato">Nessuna pronuncia corrisponde alla ricerca.</div>`;
    document.getElementById("filtri").innerHTML = ["Tutte", "modifica", "annullamento", "abrogazione"].map(t =>
      `<button type="button" class="filtro ${t === tipoAttivo ? "attivo" : ""}" data-t="${t}">${t === "Tutte" ? "Tutte" : ETICHETTE[t]}</button>`).join("");
  }

  function vistaElenco(root) {
    const atti = new Set(pronunce.map(p => p.atto.id));
    const nulli = new Set(pronunce.filter(p => p.tipo !== "modifica").map(p => p.atto.id));
    root.innerHTML = `
      <section class="hero" style="margin:-1px -24px 0; padding-left:24px; padding-right:24px;">
        <div class="container hero__inner" style="padding:0;">
          <div>
            <span class="hero__kicker">Giurisdizione costituzionale</span>
            <h1 class="hero__titolo">Pronunce sugli atti normativi</h1>
            <p class="hero__sottotitolo">La Corte può modificare un atto o dichiararlo nullo, annullandolo o abrogandolo.
              Ogni pronuncia è applicata subito all'atto su NormAktiv e resta consultabile qui, con il confronto tra testo precedente e testo nuovo.</p>
            <form id="form-ricerca" class="ricerca" role="search">
              <input id="campo" type="text" placeholder="Cerca per oggetto, atto o numero&hellip;" autocomplete="off" />
              <button type="submit">Cerca</button>
            </form>
          </div>
          <div class="hero__pannello"><h2>Collegamenti</h2><ul>
            <li><a href="normaktiv.html">NormAktiv<span>La raccolta ufficiale degli atti</span></a></li>
            <li><a href="redazioneCorte.html">Area di redazione<span>Pubblica una nuova pronuncia</span></a></li>
          </ul></div>
        </div>
      </section>
      <section class="stats-band" style="margin:0 -24px; padding:0;"><div class="container">
        <div class="stat-item"><b>${pronunce.length}</b><span>Pronunce</span></div>
        <div class="stat-item"><b>${atti.size}</b><span>Atti toccati</span></div>
        <div class="stat-item"><b>${nulli.size}</b><span>Atti annullati o abrogati</span></div>
      </div></section>
      <h2 class="sezione-titolo" style="margin-top:40px;">Elenco delle pronunce</h2>
      <div id="filtri" class="filtri"></div>
      <p id="conteggio" style="font-family:var(--font-chrome); font-size:.85rem; color:var(--inchiostro-tenue); margin:0 0 16px;"></p>
      <div id="elenco" class="elenco-atti"></div>`;
    renderElenco();
    const campo = document.getElementById("campo");
    campo.addEventListener("input", () => { q = campo.value; renderElenco(); });
    document.getElementById("form-ricerca").addEventListener("submit", e => { e.preventDefault(); q = campo.value; renderElenco(); });
    document.getElementById("filtri").addEventListener("click", e => {
      const b = e.target.closest("[data-t]"); if (b) { tipoAttivo = b.dataset.t; renderElenco(); }
    });
  }

  function righeCommi(snap) {
    if (!snap) return `<p class="vuoto">— (non presente)</p>`;
    return `<p class="rubrica">${esc(snap.rubrica)}</p>` + snap.commi.map((c, i) =>
      `<p>${snap.commi.length > 1 ? (i + 1) + ". " : ""}${esc(c.testo)}</p>` +
      c.sottocommi.map((s, j) => `<p style="margin-left:18px">${String.fromCharCode(97 + j)}) ${esc(s)}</p>`).join("")).join("");
  }
  function confronto(m) {
    if (m.azione === "titolo-aggiunto" || m.azione === "titolo-soppresso")
      return `<div class="modifica-voce"><h3><span class="azione ${m.azione}">${m.azione === "titolo-aggiunto" ? "titolo aggiunto" : "titolo soppresso"}</span> ${esc(m.testoTitolo)}</h3></div>`;
    let p = m.prima, d = m.dopo, hp = righeCommi(p), hd = righeCommi(d);
    if (m.azione === "modificato") {
      const rub = htmlDiff(p.rubrica, d.rubrica);
      const n = Math.max(p.commi.length, d.commi.length);
      let cp = "", cd = "";
      for (let i = 0; i < n; i++) {
        const a = p.commi[i], b = d.commi[i];
        const t = htmlDiff(a ? a.testo : "", b ? b.testo : "");
        const pre = n > 1 ? (i + 1) + ". " : "";
        if (a) cp += `<p>${pre}${t.prima}</p>` + a.sottocommi.map((s, j) => {
          const bs = b && b.sottocommi[j] != null ? b.sottocommi[j] : ""; return `<p style="margin-left:18px">${String.fromCharCode(97 + j)}) ${htmlDiff(s, bs).prima}</p>`; }).join("");
        if (b) cd += `<p>${pre}${t.dopo}</p>` + b.sottocommi.map((s, j) => {
          const as = a && a.sottocommi[j] != null ? a.sottocommi[j] : ""; return `<p style="margin-left:18px">${String.fromCharCode(97 + j)}) ${htmlDiff(as, s).dopo}</p>`; }).join("");
      }
      hp = `<p class="rubrica">${rub.prima}</p>${cp}`; hd = `<p class="rubrica">${rub.dopo}</p>${cd}`;
    }
    return `<div class="modifica-voce"><h3><span class="azione ${m.azione}">${m.azione}</span> ${esc(m.riferimento)}</h3>
      <div class="confronto"><div class="prima"><h4>Prima</h4>${hp}</div><div class="dopo"><h4>Dopo</h4>${hd}</div></div></div>`;
  }

  function vistaDettaglio(root, id) {
    const p = pronunce.find(x => x.id === id);
    if (!p) { root.innerHTML = `<p class="breadcrumb"><a href="corte.html">Pronunce</a> &rsaquo; Non trovata</p><div class="nessun-risultato">Pronuncia non trovata. <a href="corte.html">Torna all'elenco</a>.</div>`; return; }
    document.title = `Sentenza n. ${p.numero}/${p.anno} — Corte Costituzionale`;
    const rif = p.tipo === "modifica" ? `<div class="blocco-corte"><h2>Modifiche apportate all'atto</h2>${(p.modifiche || []).map(confronto).join("")}</div>`
      : `<div class="blocco-corte"><h2>Effetto sull'atto</h2><p class="testo-lungo">L'atto è stato ${p.tipo === "annullamento" ? "annullato (nullo)" : "abrogato"}${p.effetto ? " — " + esc(p.effetto) : ""}. Stato precedente: ${esc(nomeStato(p.statoPrecedente))}.</p></div>`;
    root.innerHTML = `
      <p class="breadcrumb"><a href="corte.html">Pronunce</a> &rsaquo; Sentenza n. ${esc(p.numero)}/${esc(p.anno)}</p>
      <section class="intestazione-atto">
        <div class="intestazione-atto__meta"><span class="badge-tipo ${esc(p.tipo)}">${ETICHETTE[p.tipo] || esc(p.tipo)}</span></div>
        <h1>${esc(p.oggetto)}</h1>
        <p>Sull'atto: <a href="atto.html?id=${encodeURIComponent(p.atto.id)}"><strong>${esc(p.atto.titolo)}</strong></a>
          (n. ${esc(p.atto.numero)}/${esc(p.atto.anno)}, ora <em>${esc(nomeStato(p.atto.stato))}</em>)</p>
        <dl class="intestazione-atto__dati">
          <div><dt>Sentenza</dt><dd>${esc(p.numero)}/${esc(p.anno)}</dd></div>
          <div><dt>Data</dt><dd>${esc(p.data)}</dd></div>
          <div><dt>Decisa da</dt><dd>${esc(p.collegio || p.firmataDa || "—")}</dd></div>
          ${p.effetto ? `<div><dt>Effetti</dt><dd>${esc(p.effetto)}</dd></div>` : ""}
        </dl>
        <div class="intestazione-atto__azioni" style="margin-top:16px;">
          <a href="atto.html?id=${encodeURIComponent(p.atto.id)}" class="redazione-btn redazione-btn--primario" style="display:inline-block;">Vedi l'atto su NormAktiv</a>
        </div>
      </section>
      <div class="blocco-corte"><h2>Motivazione</h2><p class="testo-lungo">${esc(p.motivazione)}</p></div>
      <div class="blocco-corte dispositivo"><h2>Dispositivo</h2><p class="testo-lungo">${esc(p.dispositivo)}</p></div>
      ${rif}`;
  }

  async function init() {
    renderTestataCorte("home"); renderFooterCorte();
    const root = document.getElementById("corte-root");
    try { pronunce = await CorteAPI.pronunce(); }
    catch (e) { root.innerHTML = `<div class="nessun-risultato">Errore nel caricamento delle pronunce (${esc(e.message)}).</div>`; return; }
    const id = new URLSearchParams(location.search).get("id");
    id ? vistaDettaglio(root, id) : vistaElenco(root);
  }
  document.addEventListener("DOMContentLoaded", init);
})();
