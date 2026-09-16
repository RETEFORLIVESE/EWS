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

    // Indice: per ogni articolo mostriamo il link principale e, quando
    // l'articolo ha più di un comma, un sotto-elenco con i link ai singoli commi.
    const indice = atto.articoli.map(art => {
      const commi = commiDiArticolo(art);
      const sottoIndice = commi.length > 1
        ? `<ul class="indice-commi">${commi.map((c, ic) =>
            `<li><a href="#art-${art.numero}-c${ic + 1}">Comma ${ic + 1}</a></li>`).join("")}</ul>`
        : "";
      return `<li><a href="#art-${art.numero}">Art. ${art.numero} &mdash; ${art.rubrica}</a>${sottoIndice}</li>`;
    }).join("");

    // Corpo degli articoli: ogni comma è un blocco separato e numerato (solo se
    // ce n'è più d'uno, per non appesantire gli articoli semplici a comma unico);
    // i sottocommi, se presenti, sono resi come elenco lettera a), b), c)...
    const articoli = atto.articoli.map(art => {
      const commi = commiDiArticolo(art);
      const corpoCommi = commi.map((comma, ic) => {
        const sottocommi = (comma.sottocommi || []).filter(s => s && s.trim() !== "");
        const listaSottocommi = sottocommi.length
          ? `<ol class="sottocommi">${sottocommi.map(s => `<li>${s}</li>`).join("")}</ol>`
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
