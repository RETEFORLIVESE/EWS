// assets/js/mappa-trasporti.js — mappe di trasporti (diagramma di linea stile Wikipedia) per le pagine
// che NON caricano ctsu-core.js, come CP.html (Consiglio di Pianificazione).
// È lo stesso codice di ctsu-core.js (ctsuMappaHtml): stessi blocchi { tipo:"mappa", righe:[...] }, stessa resa.
// Non tocca favicon, testata o altri stili della pagina: inietta solo il CSS delle mappe.
// Se ctsu-core.js è già caricato non fa niente (usa quello).
(function () {
  if (typeof window.ctsuMappaHtml === "function") return;

  if (document.head && !document.getElementById("mappa-trasporti-stili")) {
    const st = document.createElement("style");
    st.id = "mappa-trasporti-stili";
    st.textContent = `
/* ===== MAPPE DI TRASPORTI (diagramma di linea stile Wikipedia) ===== */
.mappa-trasporti{box-sizing:border-box;width:100%;margin:14px auto;border:1px solid #a2a9b1;background:var(--mappa-bg-corpo,#fff);font-family:var(--font-chrome);font-size:.82rem;color:var(--inchiostro);white-space:normal;text-align:left;overflow:hidden;}
.mappa-trasporti *{box-sizing:border-box;}
.mappa--destra{float:right;margin:4px 0 12px 18px;}
.mappa--sinistra{float:left;margin:4px 18px 12px 0;}
.mappa--intera{max-width:none !important;}
.articoli > .mappa-trasporti{float:none;margin:0;}
.articoli > .mappa--destra{align-self:flex-end;}
.articoli > .mappa--sinistra{align-self:flex-start;}
.articoli > .mappa--centro{align-self:center;}
.articoli > .mappa--intera{align-self:stretch;}
.comma:has(> .mappa-trasporti){overflow:hidden;}
.mappa__titolo{background:var(--mappa-bg-titolo,#eaecf0);color:var(--mappa-col-titolo,#1f2a33);font-weight:700;text-align:center;font-size:.95rem;padding:6px 10px;border-bottom:1px solid #a2a9b1;}
.mappa__riga{display:flex;align-items:flex-start;}
.mappa__icone{display:flex;flex:none;align-self:stretch;min-width:calc(var(--mappa-n,1) * var(--mappa-sz,20px));padding-left:6px;margin-right:4px;}
.mappa__ico{flex:none;width:var(--mappa-sz,20px);min-height:var(--mappa-sz,20px);background-repeat:no-repeat;background-position:center top;background-size:var(--mappa-sz,20px) var(--mappa-sz,20px);}
.mappa__ico--linea{background-repeat:repeat-y;}
.mappa__km{flex:none;width:5em;text-align:right;padding-right:10px;line-height:var(--mappa-sz,20px);color:#54595d;font-size:.88em;font-variant-numeric:tabular-nums;}
.mappa__testo{flex:1;min-width:0;line-height:var(--mappa-sz,20px);padding-right:10px;}
.mappa__testo a{color:#0645ad;}
.mappa__nome{color:var(--inchiostro);}
.mappa__riga--fermata .mappa__testo{font-size:1em;}
.mappa__riga--nota .mappa__testo{font-size:.86em;color:#54595d;}
.mappa__dett{font-size:.8em;color:#54595d;margin-left:2px;}
.mappa__ramo{background:var(--mappa-bg-titolo,#eaecf0);color:var(--mappa-col-titolo,#1f2a33);font-weight:700;text-align:center;padding:5px 10px;border-top:1px solid #a2a9b1;border-bottom:1px solid #a2a9b1;}
.mappa__didascalia{font-size:.76rem;font-style:italic;color:var(--inchiostro-tenue);text-align:center;padding:6px 10px;border-top:1px solid #d6dbe1;}
@media (max-width:640px){
  .mappa--destra,.mappa--sinistra{float:none;margin:10px auto;}
}
`;
    document.head.appendChild(st);
  }

  // Una mappa è un blocco { tipo:"mappa", titolo, didascalia, allineamento, larghezza, dimensione_icone,
  //   mostra_km, colore_linee, colore_intestazione, colore_sfondo,
  //   righe:[ { tipo:"fermata"|"nota"|"ramo", icone, km, nome, dettaglio, url, colore } ] }.
  // Le icone NON sono file locali: sono i pittogrammi BSicon di Wikimedia Commons (gli stessi delle
  // tabelle "Stazioni e fermate" di Wikipedia), caricati da internet solo al momento della visualizzazione.
  // In "icone" si scrivono i codici separati da spazio (es. "STR BHF STR+r"); "-" = cella vuota;
  // un indirizzo https:// completo = immagine personalizzata.
  // Catalogo dei codici: https://commons.wikimedia.org/wiki/BSicon/Catalogue
  const CTSU_MAPPA_PALETTE = [
    "STR", "BHF", "HST", "KBHFa", "KBHFe", "STR+l", "STR+r", "ABZgl", "ABZgr", "ABZg+l", "ABZg+r",
    "STRl", "STRr", "STRq", "KRZ", "uSTR", "uBHF", "tSTR", "tBHF", "exSTR", "exBHF"
  ];
  let _ctsuMappaContatore = 0;

  function ctsuEsc(t) {
    return (t == null ? "" : String(t)).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function ctsuMappaColore(c) {
    c = (c || "").toString().trim();
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return "";
    return c.length === 4 ? ("#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase() : c.toLowerCase();
  }

  function ctsuMappaTestoSu(bg) {   // testo chiaro o scuro, a seconda dello sfondo
    const n = parseInt(bg.slice(1), 16);
    const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lum > 0.55 ? "#1f2a33" : "#ffffff";
  }

  function ctsuMappaUrlWeb(u) {
    u = (u || "").toString().trim();
    return /^https?:\/\/[^\s"'<>()]+$/i.test(u) ? u : "";
  }

  function ctsuMappaCodici(testo) {
    return (testo || "").toString().split(/[\s,;]+/).filter(Boolean);
  }

  // Indirizzo dell'icona: codice BSicon -> Special:FilePath di Commons (reindirizza al file SVG vero).
  function ctsuMappaIconaUrl(codice) {
    if (/^https?:\/\//i.test(codice)) return ctsuMappaUrlWeb(codice);
    const c = codice.replace(/[^\w+~.@-]/g, "");
    return c ? "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent("BSicon_" + c + ".svg") : "";
  }

  // Le icone di tratto continuo (STR, uSTR, tSTR, STR+l...) vengono ripetute in verticale quando la riga è più alta.
  const CTSU_MAPPA_RE_LINEA = /^[a-z]{0,4}STR(\+[a-z0-9]{1,3})?$/;

  function ctsuMappaHtml(m) {
    if (!m || typeof m !== "object") return "";
    const righe = (Array.isArray(m.righe) ? m.righe : []).filter(r => r && typeof r === "object");
    if (!righe.length) return "";

    const uid = "ctsu-mappa-" + (++_ctsuMappaContatore);
    const sz = Math.max(12, Math.min(40, parseInt(m.dimensione_icone, 10) || 20));
    const larg = Math.max(220, Math.min(1000, parseInt(m.larghezza, 10) || 420));
    const allineamento = ["destra", "sinistra", "centro", "intera"].includes(m.allineamento) ? m.allineamento : "centro";
    const coloreLinee = ctsuMappaColore(m.colore_linee);
    const bgTitolo = ctsuMappaColore(m.colore_intestazione) || "#eaecf0";
    const bgCorpo = ctsuMappaColore(m.colore_sfondo) || "#ffffff";
    const mostraKm = m.mostra_km !== false && righe.some(r => r.tipo !== "ramo" && (r.km || "").toString().trim());

    const nCol = Math.max(1, ...righe.filter(r => r.tipo !== "ramo").map(r => ctsuMappaCodici(r.icone).length));

    // Per ricolorare le icone (sostituendo il rosso standard dei BSicon) si usa un filtro SVG: ogni pixel
    // visibile prende il colore scelto, la trasparenza resta.
    const filtri = new Map();
    const filtroPer = col => {
      if (!col) return "";
      if (!filtri.has(col)) filtri.set(col, uid + "-f" + filtri.size);
      return filtri.get(col);
    };

    const htmlRighe = righe.map(r => {
      const tipo = r.tipo === "nota" || r.tipo === "ramo" ? r.tipo : "fermata";
      const nome = ctsuEsc((r.nome || "").toString().trim());
      if (tipo === "ramo") return nome ? `<div class="mappa__ramo">${nome}</div>` : "";

      const col = ctsuMappaColore(r.colore) || coloreLinee;
      const f = filtroPer(col);
      const icone = ctsuMappaCodici(r.icone).map(c => {
        if (c === "-" || c === "_") return `<span class="mappa__ico"></span>`;
        const url = ctsuMappaIconaUrl(c);
        if (!url) return `<span class="mappa__ico"></span>`;
        const sicuro = url.replace(/[ '"()<>]/g, ch => "%" + ch.charCodeAt(0).toString(16).toUpperCase());
        const stile = `background-image:url('${sicuro}');` + (f ? `filter:url(#${f});` : "");
        return `<span class="mappa__ico${CTSU_MAPPA_RE_LINEA.test(c) ? " mappa__ico--linea" : ""}" title="${ctsuEsc(c)}" style="${ctsuEsc(stile)}"></span>`;
      }).join("");

      const url = ctsuMappaUrlWeb(r.url);
      const nomeHtml = nome
        ? (url ? `<a href="${ctsuEsc(url)}" target="_blank" rel="noopener noreferrer">${nome}</a>` : `<span class="mappa__nome">${nome}</span>`)
        : "";
      const dett = (r.dettaglio || "").toString().trim();
      const dettHtml = dett ? ` <small class="mappa__dett">${ctsuEsc(dett)}</small>` : "";
      const km = mostraKm ? `<span class="mappa__km">${ctsuEsc((r.km || "").toString().trim())}</span>` : "";
      return `<div class="mappa__riga mappa__riga--${tipo}"><span class="mappa__icone">${icone}</span>${km}<span class="mappa__testo">${nomeHtml}${dettHtml}</span></div>`;
    }).join("");

    const defs = [...filtri.entries()].map(([col, id]) => {
      const [r, g, b] = [1, 3, 5].map(i => (parseInt(col.slice(i, i + 2), 16) / 255).toFixed(3));
      return `<filter id="${id}" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 1 0"/></filter>`;
    }).join("");

    const titolo = (m.titolo || "").toString().trim();
    const didascalia = (m.didascalia || "").toString().trim();
    const stile = `max-width:${larg}px;--mappa-sz:${sz}px;--mappa-n:${nCol};--mappa-bg-titolo:${bgTitolo};--mappa-col-titolo:${ctsuMappaTestoSu(bgTitolo)};--mappa-bg-corpo:${bgCorpo};`;

    // Tutto su una riga: dentro i commi vale "white-space:pre-line" e gli a-capo diventerebbero spazi vuoti.
    return `<figure class="mappa-trasporti mappa--${allineamento}" style="${stile}">`
      + (defs ? `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>${defs}</defs></svg>` : "")
      + (titolo ? `<div class="mappa__titolo">${ctsuEsc(titolo)}</div>` : "")
      + `<div class="mappa__corpo">${htmlRighe}</div>`
      + (didascalia ? `<figcaption class="mappa__didascalia">${ctsuEsc(didascalia)}</figcaption>` : "")
      + `</figure>`;
  }

  window.ctsuMappaHtml = ctsuMappaHtml;
})();