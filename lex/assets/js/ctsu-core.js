// assets/js/ctsu-core.js
// Config pubblica + header/footer + libreria client, in un solo file.
// Login e salvataggio ora passano dallo STESSO endpoint della lettura
// (/api/ctsu, distinto da un campo "azione" nel corpo della richiesta POST);
// l'endpoint separato /api/ctsu-redazione non esiste più.
//
// Questo file, caricato da TUTTE le pagine CTSU, si occupa anche di:
//   - impostare l'icona della scheda del browser (CTSU.png) su ogni pagina;
//   - iniettare gli stili per titoli, commi, sottocommi e immagini nel testo;
//   - offrire ctsuRomano() per la numerazione dei TITOLI (I, II, III...).

const SITE_CONFIG_CTSU = {
  nomeFazione: "CTSU",
  motto: "Consiglio Tecnico-Scientifico dell'Unione",
  annoFondazione: 2024,
  emblema: "CTSU.png",
  icona: "CTSU.png",
  discord: "",
  sitoServer: "",
  titoloSito: "CTSU",
  descrizioneSito: "Raccolta ufficiale dei progetti tecnici e delle relazioni della fazione",
  nomeConsiglioPianificazione: "Consiglio di Pianificazione"
};

/* ---------- ICONA DELLA PAGINA (favicon) ---------- */

// Toglie qualunque icona già dichiarata nella pagina (anche quella di un altro sito, o
// dimenticata) e mette CTSU.png. Il "?v=" serve a far riscaricare l'icona al browser,
// che altrimenti si ricorda a lungo anche un tentativo fallito.
function impostaIconaCtsu() {
  if (!document.head) return;
  const href = (SITE_CONFIG_CTSU.icona || "CTSU.png") + "?v=2";
  document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(l => l.remove());
  [["icon", "image/png"], ["shortcut icon", "image/png"], ["apple-touch-icon", ""]].forEach(([rel, type]) => {
    const l = document.createElement("link");
    l.rel = rel;
    if (type) l.type = type;
    l.href = href;
    document.head.appendChild(l);
  });
}

/* ---------- NUMERI ROMANI (per i TITOLI) ---------- */

function ctsuRomano(n) {
  const tabella = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
                   [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let r = "";
  n = Math.max(0, Math.floor(Number(n) || 0));
  for (const [valore, simbolo] of tabella) {
    while (n >= valore) { r += simbolo; n -= valore; }
  }
  return r;
}

/* ---------- STILI AGGIUNTIVI (titoli, commi, sottocommi, immagini nel testo) ---------- */

// Le pagine pubbliche (ctsu.html, progetto.html) hanno già gli stili di articoli, commi e
// titoli-gruppo copiati da NormAktiv; qui si aggiunge solo ciò che manca per le immagini
// inserite nel testo e per i nuovi campi dell'editor.
function iniettaStiliCtsu() {
  if (!document.head || document.getElementById("ctsu-stili-extra")) return;
  const st = document.createElement("style");
  st.id = "ctsu-stili-extra";
  st.textContent = `
/* immagini inserite fra le sezioni, come comma o come sottocomma */
.immagine-atto.immagine-testo{margin:0 0 14px;text-align:center;}
.immagine-atto.immagine-testo img{width:auto;max-width:100%;max-height:520px;aspect-ratio:auto;margin:0 auto;object-fit:contain;}
.articoli > .immagine-atto.immagine-testo{margin:0;}
.articolo .comma > .immagine-atto.immagine-testo{margin:4px 0 0;}
.titolo-gruppo{scroll-margin-top:76px;}
/* immagine affiancata a destra del comma di testo che la precede */
.comma--con-immagine-destra{overflow:hidden;}
.comma__immagine-destra{float:right;margin:0 0 8px 18px;max-width:55%;}
.comma__immagine-destra .immagine-atto.immagine-testo{margin:0;}
.comma__immagine-destra .immagine-atto.immagine-testo img{max-height:420px;}
@media (max-width: 640px){
  .comma__immagine-destra{float:none;max-width:100%;margin:0 0 10px;}
}
.sottocommi > li.sottocomma-immagine{list-style:none;}
.sottocommi > li.sottocomma-immagine .immagine-atto{margin:4px 0 4px;}
/* titolo cliccabile nell'indice */
.indice-titolo-gruppo a{display:inline;padding:0;font-size:inherit;font-weight:inherit;color:inherit;letter-spacing:inherit;}
.indice-titolo-gruppo a:hover{background:none;text-decoration:underline;}

/* Consiglio di Pianificazione: etichetta dell'ambito del piano */
.badge-ambito{display:inline-block;font-family:var(--font-chrome);font-size:.68rem;font-weight:700;letter-spacing:.03em;color:var(--blu-900);background:var(--carta-scura-mid);border-radius:999px;padding:3px 10px;}
.badge-ambito--unitario{color:#6b5000;background:#f6ecc7;}
.scheda-atto__dati{display:flex;flex-wrap:wrap;gap:6px 18px;margin:10px 0 0;padding:0;list-style:none;font-family:var(--font-chrome);font-size:.8rem;color:var(--inchiostro-tenue);}
.scheda-atto__dati b{color:var(--inchiostro);font-weight:600;}

/* editor di redazione */
.redazione-azioni-riga{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}
.redazione-titolo-riga{display:flex;gap:8px;}
.redazione-form .redazione-titolo-riga input.redazione-titolo-numero{flex:0 0 130px;width:130px;}
.redazione-immagine-campi{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0;}
.redazione-sottocomma .redazione-testo-campo,.redazione-sottocomma .redazione-immagine-campi{flex:1;min-width:0;}
.redazione-sottocomma__strumenti{display:grid;grid-template-columns:auto auto;gap:4px;flex:none;}
.redazione-sottocomma .redazione-btn--piccolo{padding:4px 9px;}
.redazione-comma__immagine-destra{margin:8px 0;padding:8px 10px;border:1px dashed rgba(0,0,0,.2);border-radius:6px;background:rgba(0,0,0,.02);}
.redazione-comma__immagine-destra > .redazione-etichetta{display:block;margin-bottom:6px;font-size:.82rem;font-weight:600;}

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

/* editor delle mappe */
.redazione-mappa{display:flex;flex-direction:column;gap:10px;flex:1;min-width:0;}
.redazione-mappa input[type=number]{font-family:var(--font-testo);font-size:.95rem;padding:9px 12px;border:1px solid var(--bordo);border-radius:var(--radius);background:#fff;color:var(--inchiostro);width:100%;}
.rm-colori{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;font-family:var(--font-chrome);font-size:.78rem;}
.rm-colore{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--inchiostro-tenue);}
.rm-colore input[type=color]{width:34px;height:26px;padding:0;border:1px solid var(--bordo);border-radius:4px;background:#fff;cursor:pointer;}
.rm-colore input[type=color][data-vuoto="1"]{opacity:.45;}
.rm-spunta{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--inchiostro-tenue);}
.rm-righe{display:flex;flex-direction:column;gap:8px;}
.rm-riga{background:#fff;border:1px solid var(--bordo);border-left:3px solid var(--blu-accento);border-radius:var(--radius);padding:8px 10px;display:flex;flex-direction:column;gap:6px;}
.rm-riga[data-tipo-riga="nota"]{border-left-color:#9aa5b1;}
.rm-riga[data-tipo-riga="ramo"]{border-left-color:var(--oro);background:var(--carta-scura);}
.rm-riga__testa{display:flex;align-items:center;gap:8px;}
.rm-riga__testa select{flex:1;min-width:0;}
.rm-riga__tools{display:flex;gap:4px;flex:none;}
.rm-riga__campi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px;align-items:center;}
.rm-riga[data-tipo-riga="ramo"] .rm-opz{display:none;}
.rm-palette{background:var(--carta-scura);border-radius:var(--radius);padding:8px 10px;}
.rm-palette summary{cursor:pointer;font-family:var(--font-chrome);font-size:.8rem;font-weight:600;color:var(--blu-800);}
.rm-palette__chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.rm-chip{display:inline-flex;flex-direction:column;align-items:center;gap:2px;min-width:52px;padding:4px 6px;background:#fff;border:1px solid var(--bordo);border-radius:4px;cursor:pointer;font-family:var(--font-chrome);}
.rm-chip:hover{border-color:var(--blu-accento);}
.rm-chip small{font-size:.62rem;color:var(--inchiostro-tenue);}
.rm-chip .mappa__ico{--mappa-sz:22px;}
.rm-aiuto{font-size:.76rem;color:var(--inchiostro-tenue);margin:0;font-family:var(--font-testo);}
.rm-anteprima{background:#fff;border:1px dashed var(--bordo);border-radius:var(--radius);padding:10px;overflow-x:auto;min-height:48px;}
.rm-anteprima .mappa-trasporti{float:none;}
.rm-anteprima-vuota{color:var(--inchiostro-tenue);font-style:italic;font-size:.85rem;}
`;
  document.head.appendChild(st);
}

/* ---------- LUOGHI (registro condiviso con CA.html, NormAktiv e CEPU) ---------- */

// "luoghi" (letto da /api/organi) è raggruppato: { livello_statale: { TDR: "Nome", ... },
// citta_principali: { "ELIN-TLN": { nome: "Taleen", tipo: "citta_metropolitana" } }, ... }.
// Nei progetti si salva l'ID della voce (es. "ELIN-TLN"), MAI il nome del gruppo: è lo
// stesso ID con cui CA.html collega norme, elezioni e progetti agli organi.
const CTSU_ETICHETTE_GRUPPO = {
  livello_federale: "Livello federale", livello_statale: "Livello statale",
  citta_principali: "Città principali", distretti: "Distretti",
  assemblee_locali: "Assemblee locali", regione: "Regioni", organi: "Organi"
};
const CTSU_ETICHETTE_TIPO = {
  citta_metropolitana: "Città metropolitana", cittametropolitana: "Città metropolitana",
  distretto: "Distretto", assemblea: "Assemblea", regione: "Regione", congresso: "Congresso"
};

// Una voce è una stringa ("Köln") oppure { nome, tipo }. Restituisce sempre { nome, tipo } o null.
function ctsuVoceLuogo(v) {
  if (typeof v === "string") return { nome: v, tipo: "" };
  if (v && typeof v === "object" && typeof v.nome === "string") return { nome: v.nome, tipo: (v.tipo || "").toString() };
  return null;
}

// Cerca un ID a qualsiasi profondità (come cercaLuogo() di CA.html).
function ctsuCercaLuogo(nodo, id) {
  if (!nodo || typeof nodo !== "object" || !id) return null;
  if (Object.prototype.hasOwnProperty.call(nodo, id)) {
    const v = ctsuVoceLuogo(nodo[id]);
    if (v) return v;
  }
  for (const chiave of Object.keys(nodo)) {
    const figlio = nodo[chiave];
    if (figlio && typeof figlio === "object" && !ctsuVoceLuogo(figlio)) {
      const trovato = ctsuCercaLuogo(figlio, id);
      if (trovato) return trovato;
    }
  }
  return null;
}

// Elenco piatto per il menu a tendina: [{ gruppo, voci: [{ id, nome, tipo }] }] nell'ordine del registro.
function ctsuElencoLuoghi(luoghi) {
  const gruppi = new Map();
  const visita = (nodo, chiaveGruppo) => {
    Object.keys(nodo).forEach(chiave => {
      const voce = ctsuVoceLuogo(nodo[chiave]);
      if (voce) {
        if (!gruppi.has(chiaveGruppo)) gruppi.set(chiaveGruppo, []);
        gruppi.get(chiaveGruppo).push({ id: chiave, nome: voce.nome, tipo: voce.tipo });
      } else if (nodo[chiave] && typeof nodo[chiave] === "object" && !Array.isArray(nodo[chiave])) {
        visita(nodo[chiave], chiave);
      }
    });
  };
  if (luoghi && typeof luoghi === "object") visita(luoghi, "");
  return [...gruppi.entries()].map(([chiave, voci]) => ({
    gruppo: chiave === "" ? "Altri luoghi"
      : (CTSU_ETICHETTE_GRUPPO[chiave] || (chiave.charAt(0).toUpperCase() + chiave.slice(1).replace(/_/g, " "))),
    voci
  }));
}

// "Taleen (Città metropolitana) · ELIN-TLN"
function ctsuEtichettaLuogo(voce) {
  const tipo = voce.tipo ? (CTSU_ETICHETTE_TIPO[voce.tipo.toLowerCase()] || voce.tipo) : "";
  return voce.nome + (tipo ? " (" + tipo + ")" : "") + " · " + voce.id;
}

/* ---------- MAPPE DI TRASPORTI ---------- */

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

/* ---------- HEADER / FOOTER ---------- */

function renderTestataCtsu(paginaAttiva) {
  const el = document.getElementById("testata-root");
  if (!el) return;
  el.innerHTML = `
    <div class="striscia-top">
      <div class="container">
        <span>${SITE_CONFIG_CTSU.nomeFazione} &middot; [estjibundes.me.ei]</span>
        <span>
          ${SITE_CONFIG_CTSU.discord ? `<a href="${SITE_CONFIG_CTSU.discord}" target="_blank" rel="noopener">Discord</a>` : ""}
        </span>
      </div>
    </div>
    <header class="testata">
      <div class="container testata__riga">
        <div class="testata__emblema" aria-hidden="true">
          <img src="${SITE_CONFIG_CTSU.emblema}" alt="CTSU" onerror="this.parentNode.style.display='none'">
        </div>
        <div class="testata__testi">
          <p class="testata__eyebrow"></p>
          <h2 class="testata__nome">${SITE_CONFIG_CTSU.nomeFazione}</h2>
          <p class="testata__motto">${SITE_CONFIG_CTSU.motto}</p>
        </div>
      </div>
    </header>
    <div class="fascia-tricolore" role="presentation">
      <span class="verde"></span><span class="bianco"></span><span class="rosso"></span>
    </div>
    <nav class="nav-principale" aria-label="Navigazione principale">
      <div class="container">
        <ul>
          <li><a href="ctsu.html" class="${paginaAttiva === "home" ? "attiva" : ""}">Home</a></li>
          <li><a href="ctsu.html?stato=In+corso" class="${paginaAttiva === "in-corso" ? "attiva" : ""}">Progetti in corso</a></li>
          <li><a href="ctsu.html?stato=Completato" class="${paginaAttiva === "completati" ? "attiva" : ""}">Progetti completati</a></li>
          <li><a href="CP.html" class="${paginaAttiva === "cp" ? "attiva" : ""}">${SITE_CONFIG_CTSU.nomeConsiglioPianificazione}</a></li>
        </ul>
      </div>
    </nav>`;
}

function renderFooterCtsu() {
  const el = document.getElementById("footer-root");
  if (!el) return;
  const linkExtra = [];
  if (SITE_CONFIG_CTSU.discord) linkExtra.push(`<a href="${SITE_CONFIG_CTSU.discord}" target="_blank" rel="noopener">Discord</a>`);
  if (SITE_CONFIG_CTSU.sitoServer) linkExtra.push(`<a href="${SITE_CONFIG_CTSU.sitoServer}" target="_blank" rel="noopener">Sito del server</a>`);
  el.innerHTML = `
    <div class="fascia-tricolore" role="presentation">
      <span class="verde"></span><span class="bianco"></span><span class="rosso"></span>
    </div>
    <footer>
      <div class="container footer__contenuto">
        <span>&copy; ${SITE_CONFIG_CTSU.annoFondazione}&ndash;${new Date().getFullYear()} ${SITE_CONFIG_CTSU.nomeFazione}. Raccolta amministrata a fini interni, senza valore legale reale.</span>
        <span>${linkExtra.join(" &middot; ")}</span>
      </div>
    </footer>`;
}

/* ---------- LIBRERIA API (lettura pubblica + login/salvataggio redazione) ---------- */

const APICtsu = {
  _sessione: { token: null, username: null },

  setSessione(token, username) {
    this._sessione = { token, username };
    try { sessionStorage.setItem('ctsu_sessione', JSON.stringify(this._sessione)); } catch (e) {}
  },

  loadCredentials() {
    try {
      const raw = sessionStorage.getItem('ctsu_sessione');
      if (raw) this._sessione = JSON.parse(raw);
    } catch (e) {}
    return this._sessione;
  },

  clearCredentials() {
    this._sessione = { token: null, username: null };
    try { sessionStorage.removeItem('ctsu_sessione'); } catch (e) {}
  },

  isAuthenticated() {
    return !!this._sessione.token;
  },

  // Registro dei luoghi, lo stesso di CA.html: si legge da /api/organi (campo "luoghi").
  _luoghi: null,
  async loadLuoghi() {
    if (!this._luoghi) {
      this._luoghi = fetch('/api/organi', { cache: 'no-store' })
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(j => (j && j.luoghi && typeof j.luoghi === 'object' && !Array.isArray(j.luoghi)) ? j.luoghi : {})
        .catch(e => { this._luoghi = null; throw e; });
    }
    return this._luoghi;
  },

  // I piani economici (Consiglio di Pianificazione) vivono nello stesso archivio dei progetti
  // (/api/ctsu), riconoscibili da tipo_documento === "piano_economico". Qui si separano:
  //  - loadProgetti() restituisce SOLO i progetti (le pagine CTSU esistenti non vedono i piani);
  //  - loadPiani()    restituisce SOLO i piani;
  //  - ogni salvataggio rimette insieme le due liste, così salvare gli uni non cancella gli altri.
  _progetti: null,
  _piani: null,

  _eUnPiano(p) {
    return !!p && typeof p === 'object' && p.tipo_documento === 'piano_economico';
  },

  async _leggiTutti() {
    const res = await fetch('/api/ctsu');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ? `HTTP ${res.status}: ${data.error}` : `HTTP ${res.status}`);
    }
    const tutti = Array.isArray(data.progetti) ? data.progetti : [];
    this._progetti = tutti.filter(p => !this._eUnPiano(p));
    this._piani = tutti.filter(p => this._eUnPiano(p));
  },

  async loadProgetti() { await this._leggiTutti(); return this._progetti; },
  async loadPiani() { await this._leggiTutti(); return this._piani; },
  async loadTutti() { await this._leggiTutti(); return { progetti: this._progetti, piani: this._piani }; },

  async _invia(lista) {
    if (!this.isAuthenticated()) throw new Error("Non autenticato: effettua il login.");
    const res = await fetch('/api/ctsu', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this._sessione.token
      },
      body: JSON.stringify({ azione: 'salva', progetti: lista })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return true;
  },

  async saveProgetti(progetti) {
    if (this._piani === null) await this._leggiTutti();
    await this._invia([...progetti, ...this._piani]);
    this._progetti = progetti;
    return true;
  },

  async savePiani(piani) {
    if (this._progetti === null) await this._leggiTutti();
    await this._invia([...this._progetti, ...piani]);
    this._piani = piani;
    return true;
  },

  // Accesso con Estji ID (QR): restituisce il nome dell'utente
  async loginEstji(id_token) {
    const res = await fetch('/api/ctsu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'estji', id_token })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) throw new Error(data.error || 'Accesso non riuscito');
    this.setSessione(data.token, data.username);
    return data.username;
  },

  async login(username, password) {
    const res = await fetch('/api/ctsu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ azione: 'login', username, password })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Credenziali errate');
    }
    this.setSessione(data.token, username);
    return data;
  }
};

APICtsu.loadCredentials();

impostaIconaCtsu();
iniettaStiliCtsu();