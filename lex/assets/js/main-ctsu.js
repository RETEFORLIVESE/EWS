// assets/js/main-ctsu.js — pagina elenco dei progetti CTSU (stesso pattern di main.js/NormAktiv).
(function () {
  let progetti = [];
  const parametri = new URLSearchParams(window.location.search);
  let categoriaAttiva = parametri.get("categoria") || "Tutti";
  let statoAttivo = parametri.get("stato") || "Tutti";
  let testoRicerca = "";

  const escAttr = t => (t == null ? "" : t).toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function urlSicuro(valore) {
    const u = (valore || "").toString().trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }

  function categorieDisponibili() {
    return ["Tutti", ...new Set(progetti.map(p => p.categoria).filter(Boolean))];
  }

  function statiDisponibili() {
    return ["Tutti", ...new Set(progetti.map(p => p.stato).filter(Boolean))];
  }

  function filtrati() {
    const q = testoRicerca.trim().toLowerCase();
    return progetti
      .filter(p => {
        const okCat = categoriaAttiva === "Tutti" || p.categoria === categoriaAttiva;
        const okStato = statoAttivo === "Tutti" || p.stato === statoAttivo;
        const okTxt = !q ||
          (p.titolo || "").toLowerCase().includes(q) ||
          (p.sommario || "").toLowerCase().includes(q) ||
          (p.categoria || "").toLowerCase().includes(q);
        return okCat && okStato && okTxt;
      })
      .sort((a, b) => (b.data_inizio || "").localeCompare(a.data_inizio || ""));
  }

  function scheda(progetto) {
    const copertina = urlSicuro(progetto.copertina);
    const immagineHtml = copertina
      ? `<img class="scheda-atto__immagine" src="${escAttr(copertina)}" alt="" loading="lazy" onerror="this.style.display='none'">`
      : "";
    return `
      <a class="scheda-atto" href="progetto.html?id=${encodeURIComponent(progetto.id)}">
        ${immagineHtml}
        <div class="scheda-atto__meta">
          <span class="badge-categoria">${escAttr(progetto.categoria)}</span>
          <span class="badge-stato">${escAttr(progetto.stato)}</span>
        </div>
        <h3 class="scheda-atto__titolo">${escAttr(progetto.titolo)}</h3>
        <p class="scheda-atto__sommario">${escAttr(progetto.sommario)}</p>
      </a>`;
  }

  function renderFiltri() {
    const el = document.getElementById("filtri-root");
    const categorie = categorieDisponibili().map(cat =>
      `<button type="button" class="filtro ${cat === categoriaAttiva ? "attivo" : ""}" data-tipo="categoria" data-valore="${escAttr(cat)}">${escAttr(cat)}</button>`
    ).join("");
    const stati = statiDisponibili().map(st =>
      `<button type="button" class="filtro ${st === statoAttivo ? "attivo" : ""}" data-tipo="stato" data-valore="${escAttr(st)}">${escAttr(st)}</button>`
    ).join("");
    el.innerHTML = `<div>${categorie}</div><div style="margin-top:8px;">${stati}</div>`;
    el.querySelectorAll(".filtro").forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tipo === "categoria") categoriaAttiva = btn.dataset.valore;
        else statoAttivo = btn.dataset.valore;
        renderFiltri();
        renderElenco();
      });
    });
  }

  function renderElenco() {
    const el = document.getElementById("elenco-root");
    const r = filtrati();
    document.getElementById("conteggio-risultati").textContent =
      r.length === progetti.length ? `${progetti.length} progetti pubblicati` : `${r.length} risultati su ${progetti.length} progetti`;
    el.innerHTML = r.length === 0
      ? `<div class="nessun-risultato">Nessun progetto corrisponde alla ricerca effettuata.</div>`
      : r.map(scheda).join("");
  }

  function renderStatistiche() {
    const inCorso = progetti.filter(p => p.stato === "In corso").length;
    const categorie = new Set(progetti.map(p => p.categoria).filter(Boolean)).size;
    document.getElementById("stat-totale").textContent = progetti.length;
    document.getElementById("stat-in-corso").textContent = inCorso;
    document.getElementById("stat-categorie").textContent = categorie;
  }

  async function init() {
    renderTestataCtsu(
      statoAttivo === "In corso" ? "in-corso"
      : statoAttivo === "Completato" ? "completati"
      : "home"
    );
    renderFooterCtsu();

    try {
      progetti = await APICtsu.loadProgetti();
    } catch (e) {
      console.error(e);
      const dettaglio = e && e.message ? e.message : "errore sconosciuto";
      document.getElementById("elenco-root").innerHTML =
        `<div class="nessun-risultato">Errore nel caricamento dei progetti (${dettaglio}).</div>`;
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
