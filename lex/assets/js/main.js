(function () {
  let atti = [];
  let categoriaAttiva = new URLSearchParams(window.location.search).get("categoria") || "Tutti";
  let testoRicerca = "";

  function categorieDisponibili() {
    return ["Tutti", ...new Set(atti.map(a => a.categoria))];
  }

  function filtrati() {
    const q = testoRicerca.trim().toLowerCase();
    return atti
      .filter(a => {
        const okCat = categoriaAttiva === "Tutti" || a.categoria === categoriaAttiva;
        const okTxt = !q || a.titolo.toLowerCase().includes(q) || a.sommario.toLowerCase().includes(q) || a.categoria.toLowerCase().includes(q);
        return okCat && okTxt;
      })
      .sort((a, b) => Number(a.numero) - Number(b.numero));
  }

  function scheda(atto) {
    const badge = atto.stato === "vigente"
      ? `<span class="badge-stato">vigente</span>`
      : `<span class="badge-stato abrogato">abrogato</span>`;
    return `
      <a class="scheda-atto" href="atto.html?id=${encodeURIComponent(atto.id)}">
        <div class="scheda-atto__meta">
          <span class="badge-categoria">${atto.categoria}</span>
          ${badge}
          <span>n. ${atto.numero}/${atto.anno} &middot; ${atto.dataEmanazione}</span>
        </div>
        <h3 class="scheda-atto__titolo">${atto.titolo}</h3>
        <p class="scheda-atto__sommario">${atto.sommario}</p>
      </a>`;
  }

  function renderFiltri() {
    const el = document.getElementById("filtri-root");
    el.innerHTML = categorieDisponibili().map(cat =>
      `<button type="button" class="filtro ${cat === categoriaAttiva ? "attivo" : ""}" data-categoria="${cat}">${cat}</button>`
    ).join("");
    el.querySelectorAll(".filtro").forEach(btn => {
      btn.addEventListener("click", () => {
        categoriaAttiva = btn.dataset.categoria;
        renderFiltri();
        renderElenco();
      });
    });
  }

  function renderElenco() {
    const el = document.getElementById("elenco-root");
    const r = filtrati();
    document.getElementById("conteggio-risultati").textContent =
      r.length === atti.length ? `${atti.length} atti pubblicati` : `${r.length} risultati su ${atti.length} atti`;
    el.innerHTML = r.length === 0
      ? `<div class="nessun-risultato">Nessun atto corrisponde alla ricerca effettuata.</div>`
      : r.map(scheda).join("");
  }

  function renderStatistiche() {
    const vigenti = atti.filter(a => a.stato === "vigente").length;
    const categorie = new Set(atti.map(a => a.categoria)).size;
    document.getElementById("stat-totale").textContent = atti.length;
    document.getElementById("stat-vigenti").textContent = vigenti;
    document.getElementById("stat-categorie").textContent = categorie;
  }

  async function init() {
    renderTestata(
      categoriaAttiva === "Statuto Costituzionale" ? "statuto"
      : categoriaAttiva === "Regolamento" ? "regolamenti"
      : categoriaAttiva === "Codice" ? "codici"
      : "home"
    );
    renderFooter();

    try {
      atti = await API.loadAtti();
    } catch (e) {
      console.error(e);
      document.getElementById("elenco-root").innerHTML =
        `<div class="nessun-risultato">Errore nel caricamento degli atti. Verifica la configurazione in config.js.</div>`;
      return;
    }

    renderStatistiche();
    renderFiltri();
    renderElenco();

    const input = document.getElementById("campo-ricerca");
    document.getElementById("form-ricerca").addEventListener("submit", e => {
      e.preventDefault();
      testoRicerca = input.value;
      renderElenco();
    });
    input.addEventListener("input", () => {
      testoRicerca = input.value;
      renderElenco();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
