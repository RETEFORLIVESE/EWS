(function () {
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

    const badgeStato = atto.stato === "vigente"
      ? `<span class="badge-stato">vigente</span>`
      : `<span class="badge-stato abrogato">abrogato</span>`;

    const indice = atto.articoli.map(art =>
      `<li><a href="#art-${art.numero}">Art. ${art.numero} &mdash; ${art.rubrica}</a></li>`
    ).join("");

    const articoli = atto.articoli.map(art => `
      <article class="articolo" id="art-${art.numero}">
        <span class="articolo__numero">Articolo ${art.numero}</span>
        <h3>${art.rubrica}</h3>
        <p>${art.testo}</p>
      </article>`).join("");

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
        <dl class="intestazione-atto__dati">
          <div><dt>Numero</dt><dd>${atto.numero}/${atto.anno}</dd></div>
          <div><dt>Data di emanazione</dt><dd>${atto.dataEmanazione}</dd></div>
          <div><dt>Promulgato da</dt><dd>${atto.promulgatoDa}</dd></div>
          <div><dt>Articoli</dt><dd>${atto.articoli.length}</dd></div>
        </dl>
      </section>
      <div class="corpo-atto">
        <nav class="indice-articoli" aria-label="Indice degli articoli">
          <h2>Indice</h2>
          <ol>${indice}</ol>
        </nav>
        <div class="articoli">${articoli}</div>
      </div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
