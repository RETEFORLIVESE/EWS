// assets/js/corte-layout.js — testata e piè di pagina della Corte (indipendenti da layout.js)
function renderTestataCorte(attiva) {
  const v = (k, href, t) => `<li><a href="${href}" class="${attiva === k ? "attiva" : ""}">${t}</a></li>`;
  document.getElementById("testata-root").innerHTML = `
    <div class="striscia-top"><div class="container"><span>Verfassungsgericht [estjibundes.me.ei]</span>
      <span><a href="normaktiv.html">NormAktiv</a></span></div></div>
    <header class="testata"><div class="container testata__riga">
      <div class="testata__emblema"><img src="CorteCostituzionale.png" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'⚖'}))"></div>
      <div class="testata__testi">
        <p class="testata__eyebrow">Einheitliche Verfassungsgerichtsbarkeit</p>
        <h1 class="testata__nome">Corte Costituzionale</h1>
        <p class="testata__motto">Garante della legalità degli atti normativi</p>
      </div></div></header>
    <nav class="nav-principale"><div class="container"><ul>
      ${v("home", "corte.html", "Pronunce")}
      ${v("normaktiv", "normaktiv.html", "NormAktiv")}
      ${v("redazione", "redazioneCorte.html", "Area di redazione")}
    </ul></div></nav>`;
}
function renderFooterCorte() {
  document.getElementById("footer-root").innerHTML = `
    <footer><div class="container"><div class="footer__contenuto">
      <span>© Corte Costituzionale — le pronunce sono pubblicate anche negli atti su <a href="normaktiv.html">NormAktiv</a>.</span>
      <span><a href="redazioneCorte.html">Area riservata</a></span>
    </div></div></footer>`;
}
