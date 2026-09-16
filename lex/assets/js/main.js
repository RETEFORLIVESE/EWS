/* ============================================================
   Logica della homepage: ricerca testuale e filtro per categoria
   sulla base dati in data.js.
   ============================================================ */

(function () {
  const params = new URLSearchParams(window.location.search);
  let categoriaAttiva = params.get("categoria") || "Tutti";
  let testoRicerca = "";

  function categorieDisponibili() {
    const set = new Set(ATTI.map((a) => a.categoria));
    return ["Tutti", ...Array.from(set)];
  }

  function attiFiltrati() {
    return ATTI.filter((atto) => {
      const passaCategoria =
        categoriaAttiva === "Tutti" || atto.categoria === categoriaAttiva;
      const q = testoRicerca.trim().toLowerCase();
      const passaTesto =
        q === "" ||
        atto.titolo.toLowerCase().includes(q) ||
        atto.sommario.toLowerCase().includes(q) ||
        atto.categoria.toLowerCase().includes(q);
      return passaCategoria && passaTesto;
    }).sort((a, b) => Number(a.numero) - Number(b.numero));
  }

  function schedaAtto(atto) {
    const badgeStato =
      atto.stato === "vigente"
        ? `<span class="badge-stato">vigente</span>`
        : `<span class="badge-stato abrogato">abrogato</span>`;

    return `
      <a class="scheda-atto" href="atto.html?id=${encodeURIComponent(atto.id)}">
        <div class="scheda-atto__meta">
          <span class="badge-categoria">${atto.categoria}</span>
          ${badgeStato}
          <span>n. ${atto.numero}/${atto.anno} &middot; ${atto.dataEmanazione}</span>
        </div>
        <h3 class="scheda-atto__titolo">${atto.titolo}</h3>
        <p class="scheda-atto__sommario">${atto.sommario}</p>
      </a>
    `;
  }

  function renderFiltri() {
    const el = document.getElementById("filtri-root");
    el.innerHTML = categorieDisponibili()
      .map(
        (cat) => `
        <button type="button" class="filtro ${cat === categoriaAttiva ? "attivo" : ""}" data-categoria="${cat}">
          ${cat}
        </button>`
      )
      .join("");

    el.querySelectorAll(".filtro").forEach((btn) => {
      btn.addEventListener("click", () => {
        categoriaAttiva = btn.dataset.categoria;
        renderFiltri();
        renderElenco();
      });
    });
  }

  function renderElenco() {
    const el = document.getElementById("elenco-root");
    const risultati = attiFiltrati();

    document.getElementById("conteggio-risultati").textContent =
      risultati.length === ATTI.length
        ? `${ATTI.length} atti pubblicati`
        : `${risultati.length} risultati su ${ATTI.length} atti`;

    if (risultati.length === 0) {
      el.innerHTML = `<div class="nessun-risultato">Nessun atto corrisponde alla ricerca effettuata.</div>`;
      return;
    }
    el.innerHTML = risultati.map(schedaAtto).join("");
  }

  function renderStatistiche() {
    const vigenti = ATTI.filter((a) => a.stato === "vigente").length;
    const categorie = new Set(ATTI.map((a) => a.categoria)).size;
    document.getElementById("stat-totale").textContent = ATTI.length;
    document.getElementById("stat-vigenti").textContent = vigenti;
    document.getElementById("stat-categorie").textContent = categorie;
  }

  function init() {
    renderTestata(
      categoriaAttiva === "Statuto Costituzionale"
        ? "statuto"
        : categoriaAttiva === "Regolamento"
        ? "regolamenti"
        : categoriaAttiva === "Codice"
        ? "codici"
        : "home"
    );
    renderFooter();
    renderStatistiche();
    renderFiltri();
    renderElenco();

    const input = document.getElementById("campo-ricerca");
    const form = document.getElementById("form-ricerca");
    form.addEventListener("submit", (e) => {
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
