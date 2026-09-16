(function () {
  let elezioni = [];
  let filtroStato = "Tutte";
  let testoRicerca = "";

  const ETICHETTE_STATO = {
    programmata: "programmata",
    in_corso: "scrutinio in corso",
    chiusa: "scrutinio chiuso",
    definitiva: "risultato definitivo"
  };
  const ETICHETTE_TIPO = {
    carica_unica: "Carica unica",
    assemblea: "Assemblea"
  };

  function statiDisponibili() {
    return ["Tutte", ...new Set(elezioni.map(e => e.stato))];
  }

  function filtrate() {
    const q = testoRicerca.trim().toLowerCase();
    return elezioni
      .filter(e => {
        const okStato = filtroStato === "Tutte" || e.stato === filtroStato;
        const okTxt = !q || (e.titolo || "").toLowerCase().includes(q) || (e.sottotitolo || "").toLowerCase().includes(q);
        return okStato && okTxt;
      })
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }

  function scheda(e) {
    return `
      <a class="scheda-elezione" href="risultato.html?id=${encodeURIComponent(e.id)}">
        <div class="scheda-elezione__meta">
          <span class="badge-tipo">${ETICHETTE_TIPO[e.tipo] || e.tipo}</span>
          <span class="badge-stato stato-${e.stato}">${ETICHETTE_STATO[e.stato] || e.stato}</span>
          <span>${e.data || ""}</span>
        </div>
        <h3 class="scheda-elezione__titolo">${e.titolo}</h3>
        <p class="scheda-elezione__sommario">${e.sottotitolo || ""}</p>
      </a>`;
  }

  function renderFiltri() {
    const el = document.getElementById("filtri-root");
    el.innerHTML = statiDisponibili().map(s =>
      `<button type="button" class="filtro ${s === filtroStato ? "attivo" : ""}" data-stato="${s}">${s === "Tutte" ? "Tutte" : (ETICHETTE_STATO[s] || s)}</button>`
    ).join("");
    el.querySelectorAll(".filtro").forEach(btn => {
      btn.addEventListener("click", () => {
        filtroStato = btn.dataset.stato;
        renderFiltri();
        renderElenco();
      });
    });
  }

  function renderElenco() {
    const el = document.getElementById("elenco-root");
    const r = filtrate();
    document.getElementById("conteggio-risultati").textContent =
      r.length === elezioni.length ? `${elezioni.length} consultazioni pubblicate` : `${r.length} risultati su ${elezioni.length} consultazioni`;
    el.innerHTML = r.length === 0
      ? `<div class="nessun-risultato">Nessuna consultazione corrisponde alla ricerca effettuata.</div>`
      : r.map(scheda).join("");
  }

  function renderStatistiche() {
    document.getElementById("stat-totale").textContent = elezioni.length;
    document.getElementById("stat-corso").textContent = elezioni.filter(e => e.stato === "in_corso").length;
    document.getElementById("stat-definitive").textContent = elezioni.filter(e => e.stato === "definitiva").length;
  }

  async function init() {
    renderTestata("elezioni");
    renderFooter();

    try {
      elezioni = await APIElezioni.loadElezioni();
    } catch (e) {
      console.error(e);
      document.getElementById("elenco-root").innerHTML =
        `<div class="nessun-risultato">Errore nel caricamento delle elezioni. Verifica la configurazione del server (BIN_ID_ELEZIONI).</div>`;
      return;
    }

    renderStatistiche();
    renderFiltri();
    renderElenco();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
