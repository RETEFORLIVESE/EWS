// assets/js/progetto.js — pagina di dettaglio di un progetto CTSU (stesso pattern di atto.js/NormAktiv).
(function () {
  const escAttr = t => (t == null ? "" : t).toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function urlSicuro(valore) {
    const u = (valore || "").toString().trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }

  // Immagine di copertina: va SOPRA l'indice, nella colonna di sinistra
  // (stessa posizione dell'immagine di un atto in NormAktiv).
  function htmlCopertina(progetto) {
    const src = urlSicuro(progetto.copertina);
    if (!src) return "";
    return `
      <figure class="immagine-atto">
        <img src="${escAttr(src)}" alt="${escAttr(progetto.titolo)}" loading="lazy"
             onerror="this.closest('figure').style.display='none'">
      </figure>`;
  }

  function htmlIndice(progetto) {
    const sezioni = progetto.sezioni || [];
    if (!sezioni.length) return "";
    const voci = sezioni.map((s, i) =>
      `<li><a href="#sez-${i + 1}">${escAttr(s.titolo || `Sezione ${i + 1}`)}</a></li>`
    ).join("");
    let extra = "";
    if ((progetto.galleria || []).length) extra += `<li><a href="#galleria-progetto">Galleria fotografica</a></li>`;
    if ((progetto.allegati || []).length) extra += `<li><a href="#allegati-progetto">Allegati</a></li>`;
    return `
      <nav class="indice-articoli" aria-label="Indice del progetto">
        <h2>Indice</h2>
        <ol>${voci}${extra}</ol>
      </nav>`;
  }

  function htmlSezioni(progetto) {
    return (progetto.sezioni || []).map((s, i) => `
      <article class="articolo" id="sez-${i + 1}">
        <h3>${escAttr(s.titolo || `Sezione ${i + 1}`)}</h3>
        <div class="comma"><p>${s.testo || ""}</p></div>
      </article>`).join("");
  }

  function htmlGalleria(progetto) {
    const galleria = progetto.galleria || [];
    if (!galleria.length) return "";
    const celle = galleria.map(g => {
      const src = urlSicuro(g.url);
      if (!src) return "";
      return `
        <figure class="immagine-atto" style="margin:0;">
          <img src="${escAttr(src)}" alt="${escAttr(g.didascalia || progetto.titolo)}" loading="lazy"
               onerror="this.closest('figure').style.display='none'">
          ${g.didascalia ? `<figcaption>${escAttr(g.didascalia)}</figcaption>` : ""}
        </figure>`;
    }).join("");
    return `
      <section id="galleria-progetto" style="margin-top:32px;">
        <h2 class="sezione-titolo">Galleria fotografica</h2>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px;">
          ${celle}
        </div>
      </section>`;
  }

  function htmlAllegati(progetto) {
    const allegati = progetto.allegati || [];
    if (!allegati.length) return "";
    const righe = allegati.map(a => {
      const href = urlSicuro(a.url);
      if (!href) return "";
      return `<li><a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer">📎 ${escAttr(a.titolo || href)}</a></li>`;
    }).join("");
    return `
      <section id="allegati-progetto" style="margin-top:32px;">
        <h2 class="sezione-titolo">Allegati</h2>
        <ul class="elenco-allegati">${righe}</ul>
      </section>`;
  }

  async function init() {
    renderTestataCtsu("home");
    renderFooterCtsu();

    const id = new URLSearchParams(window.location.search).get("id");
    const root = document.getElementById("progetto-root");

    let progetti = [];
    try {
      progetti = await APICtsu.loadProgetti();
    } catch (e) {
      root.innerHTML = `<div class="nessun-risultato">Errore nel caricamento del progetto.</div>`;
      return;
    }

    const progetto = progetti.find(p => p.id === id);
    if (!progetto) {
      root.innerHTML = `
        <p class="breadcrumb"><a href="ctsu.html">Home</a> &rsaquo; Progetto non trovato</p>
        <div class="nessun-risultato">
          Il progetto richiesto non è stato trovato. Torna alla <a href="ctsu.html">home</a>.
        </div>`;
      document.title = "Progetto non trovato — " + SITE_CONFIG_CTSU.nomeFazione;
      return;
    }

    document.title = progetto.titolo + " — " + SITE_CONFIG_CTSU.nomeFazione;

    root.innerHTML = `
      <p class="breadcrumb">
        <a href="ctsu.html">Home</a> &rsaquo;
        <a href="ctsu.html?categoria=${encodeURIComponent(progetto.categoria || "")}">${escAttr(progetto.categoria)}</a> &rsaquo;
        ${escAttr(progetto.titolo)}
      </p>
      <section class="intestazione-atto">
        <div class="intestazione-atto__meta">
          <span class="badge-categoria">${escAttr(progetto.categoria)}</span>
          <span class="badge-stato">${escAttr(progetto.stato)}</span>
        </div>
        <h1>${escAttr(progetto.titolo)}</h1>
        <p>${escAttr(progetto.sommario)}</p>
        <dl class="intestazione-atto__dati">
          <div><dt>Organo responsabile</dt><dd>${escAttr(progetto.organo_responsabile || "—")}</dd></div>
          <div><dt>Luogo</dt><dd>${escAttr(progetto.luogo || "—")}</dd></div>
          <div><dt>Responsabile di progetto</dt><dd>${escAttr(progetto.responsabile || "—")}</dd></div>
          <div><dt>Data di inizio</dt><dd>${escAttr(progetto.data_inizio || "—")}</dd></div>
          <div><dt>Fine prevista</dt><dd>${escAttr(progetto.data_fine_prevista || "—")}</dd></div>
          <div><dt>Completamento</dt><dd>${escAttr(progetto.data_completamento || "—")}</dd></div>
          <div><dt>Budget previsto</dt><dd>${escAttr(progetto.budget_previsto || "—")}</dd></div>
          <div><dt>Costo effettivo</dt><dd>${escAttr(progetto.costo_effettivo || "—")}</dd></div>
        </dl>
      </section>
      <div class="corpo-atto">
        <div class="colonna-indice">
          ${htmlCopertina(progetto)}
          ${htmlIndice(progetto)}
        </div>
        <div class="articoli">
          ${htmlSezioni(progetto)}
          ${htmlGalleria(progetto)}
          ${htmlAllegati(progetto)}
        </div>
      </div>`;
  }

  document.addEventListener("DOMContentLoaded", init);
})();
