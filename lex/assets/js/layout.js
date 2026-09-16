/* ============================================================
   Genera testata, fascia tricolore, barra blu e footer,
   comuni a tutte le pagine. Legge i dati da config.js.
   ============================================================ */

function renderTestata(paginaAttiva) {
  const el = document.getElementById("testata-root");
  if (!el) return;

  el.innerHTML = `
    <header class="testata">
      <div class="container testata__riga">
        <div class="testata__emblema" aria-hidden="true">${SITE_CONFIG.emblema}</div>
        <div class="testata__testi">
          <p class="testata__eyebrow">Raccolta ufficiale degli atti normativi</p>
          <h2 class="testata__nome">${SITE_CONFIG.nomeFazione}</h2>
          <p class="testata__motto">${SITE_CONFIG.motto}</p>
        </div>
      </div>
    </header>
    <div class="fascia-tricolore" role="presentation">
      <span class="verde"></span><span class="bianco"></span><span class="rosso"></span>
    </div>
    <nav class="nav-principale" aria-label="Navigazione principale">
      <div class="container">
        <ul>
          <li><a href="index.html" class="${paginaAttiva === "home" ? "attiva" : ""}">Home</a></li>
          <li><a href="index.html?categoria=Statuto%20Costituzionale" class="${paginaAttiva === "statuto" ? "attiva" : ""}">Statuto</a></li>
          <li><a href="index.html?categoria=Regolamento" class="${paginaAttiva === "regolamenti" ? "attiva" : ""}">Regolamenti</a></li>
          <li><a href="index.html?categoria=Codice" class="${paginaAttiva === "codici" ? "attiva" : ""}">Codici</a></li>
        </ul>
      </div>
    </nav>
  `;
}

function renderFooter() {
  const el = document.getElementById("footer-root");
  if (!el) return;

  const linkExtra = [];
  if (SITE_CONFIG.discord) {
    linkExtra.push(`<a href="${SITE_CONFIG.discord}" target="_blank" rel="noopener">Discord</a>`);
  }
  if (SITE_CONFIG.sitoServer) {
    linkExtra.push(`<a href="${SITE_CONFIG.sitoServer}" target="_blank" rel="noopener">Sito del server</a>`);
  }

  el.innerHTML = `
    <div class="fascia-tricolore" role="presentation">
      <span class="verde"></span><span class="bianco"></span><span class="rosso"></span>
    </div>
    <footer>
      <div class="container footer__contenuto">
        <span>&copy; ${SITE_CONFIG.annoFondazione}&ndash;${new Date().getFullYear()} ${SITE_CONFIG.nomeFazione}. Raccolta amministrata a fini interni, senza valore legale reale.</span>
        <span>${linkExtra.join(" &middot; ")}</span>
      </div>
    </footer>
  `;
}
