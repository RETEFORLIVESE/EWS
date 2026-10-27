// assets/js/pdf-export.js
// Motore comune per scaricare in PDF gli atti (NormAktiv) e i progetti (CTSU).
// Viene caricato al volo da atto.js e progetto.js al primo click su "Scarica in PDF".
// Il PDF è generato nel browser con jsPDF (caricata da cdnjs).
//
// Uso:
//   const pdf = await PdfExport.crea({ marca: { nome, sottotitolo, logo } });
//   pdf.scrivi(...); pdf.dati([...]); await pdf.immagine(url, didascalia); ...
//   pdf.salva("nome-file.pdf", "testo del piè di pagina");
//
// La "marca" disegna in alto, su OGNI pagina, una barra blu con il logo e il nome
// del sito che genera il PDF (NormAktiv oppure CTSU).
(function () {
  "use strict";

  const JSPDF_URL = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
  const PW = 210, PH = 297, MX = 20, MB = 20;
  const BAR = 18;              // altezza della barra in alto
  const MT = BAR + 10;         // inizio del contenuto su ogni pagina
  const W = PW - MX * 2;
  const MM = 0.3528;           // 1 pt in mm

  const COLORI = {
    blu: [11, 61, 110],
    scuro: [11, 31, 56],
    testo: [20, 30, 40],
    tenue: [75, 88, 102],
    linea: [214, 226, 237],
    link: [46, 119, 201]
  };

  function urlSicuro(valore) {
    const u = (valore || "").toString().trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }

  function caricaJsPdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = JSPDF_URL;
      s.onload = () => (window.jspdf && window.jspdf.jsPDF)
        ? resolve(window.jspdf.jsPDF)
        : reject(new Error("Libreria PDF non disponibile"));
      s.onerror = () => reject(new Error("Impossibile caricare la libreria PDF"));
      document.head.appendChild(s);
    });
  }

  // Da HTML (i testi possono contenere formattazione o tabelle) a testo semplice.
  // DOMParser non esegue script né gestori di eventi.
  function htmlInTesto(html) {
    let src = (html == null ? "" : html).toString()
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr)>/gi, "\n");
    const haTabella = /<t[dh][\s>]/i.test(src);
    if (haTabella) src = src.replace(/<\/(td|th)>/gi, " | ");
    let t = new DOMParser().parseFromString(src, "text/html").body.textContent || "";
    if (haTabella) t = t.replace(/[ \t]*\|[ \t]*(\n|$)/g, "\n");
    return t
      .replace(/\u00a0/g, " ")
      // i font standard del PDF coprono il set Latin-1 e la punteggiatura tipografica comune
      .replace(/[^\x09\x0A\x20-\x7E\u00A1-\u00FF\u2018-\u201F\u2013\u2014\u2026\u2022\u20AC]/g, "?")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  // Scarica un'immagine e la converte in dati incorporabili nel PDF.
  // Restituisce null se non è raggiungibile o se il server non consente l'uso (CORS).
  function caricaImmagine(src, formato) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timer = setTimeout(() => resolve(null), 15000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (!w || !h) return resolve(null);
          const k = Math.min(1, 1600 / Math.max(w, h));
          w = Math.round(w * k); h = Math.round(h * k);
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          const png = formato === "png";
          if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
          ctx.drawImage(img, 0, 0, w, h);
          resolve({ data: c.toDataURL(png ? "image/png" : "image/jpeg", 0.88), tipo: png ? "PNG" : "JPEG", w, h });
        } catch (e) { resolve(null); }
      };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = src;
    });
  }


  /* ---------- MAPPE DI TRASPORTI ---------- */
  // Stessi blocchi { tipo:"mappa", righe:[...] } usati dal sito (vedi ctsuMappaHtml in ctsu-core.js e
  // mappa-trasporti.js). Nel PDF la mappa viene disegnata con le stesse icone BSicon di Wikimedia Commons
  // (scaricate al momento dell'esportazione e inserite come immagini); se un'icona non è raggiungibile
  // (rete assente o server che non consente l'uso, CORS) si ripiega su un disegno semplificato fatto
  // con linee e cerchi, così la mappa compare comunque.
  const PX = 0.2646;   // 1 px CSS in mm
  const MAPPA_RE_LINEA = /^[a-z]{0,4}STR(\+[a-z0-9]{1,3})?$/;
  const MAPPA_DEFAULT = [190, 45, 44];   // rosso standard dei BSicon

  function mappaColore(c) {
    c = (c || "").toString().trim();
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(c)) return "";
    return c.length === 4 ? ("#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toLowerCase() : c.toLowerCase();
  }
  const mappaRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  function mappaTestoSu(bg) {
    const [r, g, b] = mappaRgb(bg);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? [31, 42, 51] : [255, 255, 255];
  }
  const mappaCodici = t => (t || "").toString().split(/[\s,;]+/).filter(Boolean);
  function mappaUrlWeb(u) {
    u = (u || "").toString().trim();
    return /^https?:\/\/[^\s"'<>()]+$/i.test(u) ? u : "";
  }
  function mappaIconaUrl(codice) {
    if (/^https?:\/\//i.test(codice)) return mappaUrlWeb(codice);
    const c = codice.replace(/[^\w+~.@-]/g, "");
    return c ? "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent("BSicon_" + c + ".svg") : "";
  }

  // Icona -> PNG trasparente (ricolorata se serve, come il filtro SVG del sito). In cache per codice+colore.
  const cacheIcone = new Map();
  function caricaIcona(codice, colore) {
    const chiave = codice + "|" + (colore || "");
    if (cacheIcone.has(chiave)) return cacheIcone.get(chiave);
    const p = new Promise(resolve => {
      const url = mappaIconaUrl(codice);
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      const timer = setTimeout(() => resolve(null), 15000);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const S = 96;
          const c = document.createElement("canvas");
          c.width = S; c.height = S;
          const ctx = c.getContext("2d");
          ctx.drawImage(img, 0, 0, S, S);
          if (colore) {
            ctx.globalCompositeOperation = "source-in";
            ctx.fillStyle = colore;
            ctx.fillRect(0, 0, S, S);
          }
          resolve({ data: c.toDataURL("image/png"), chiave });
        } catch (e) { resolve(null); }
      };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url;
    });
    cacheIcone.set(chiave, p);
    return p;
  }

  async function crea(opzioni) {
    const marca = (opzioni && opzioni.marca) || {};
    const jsPDF = await caricaJsPdf();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const logo = marca.logo ? await caricaImmagine(marca.logo, "png") : null;
    let y = MT;

    // Immagini che non entravano nello spazio rimasto: il testo prosegue senza buchi e
    // l'immagine viene posata in cima alla pagina successiva.
    let inAttesa = [];
    // Zone occupate da immagini a destra sulla pagina corrente: il testo si stringe per aggirarle.
    let zone = [];
    const GAP = 5;
    const riduzioneAt = (y0, y1) => {
      let r = 0;
      zone.forEach(z => { if (z.y0 < y1 && z.y1 > y0) r = Math.max(r, z.w + GAP); });
      return r;
    };
    const fineZone = () => zone.reduce((m, z) => Math.max(m, z.y1), 0);
    function nuovaPagina() {
      doc.addPage(); y = MT; zone = [];
      const coda = inAttesa; inAttesa = [];
      coda.forEach(c => c.destra ? posaDestra(c.img, c.didascalia, c.w, c.h) : posaImmagine(c.img, c.didascalia, c.w, c.h));
    }
    const nuovaPaginaSe = h => { if (y + h > PH - MB) nuovaPagina(); };

    // Testo semplice con a capo automatico; spezza le pagine riga per riga e si stringe
    // accanto alle immagini posate a destra.
    function scriviTesto(testo, o = {}) {
      const { font = "times", stile = "normal", size = 11, x = MX, larghezza = W - (x - MX),
              align = "left", colore = COLORI.testo, dopo = 2, interlinea = 1.35 } = o;
      const hRiga = size * MM * interlinea;
      const imposta = () => {
        doc.setFont(font, stile);
        doc.setFontSize(size);
        doc.setTextColor(colore[0], colore[1], colore[2]);
      };
      htmlInTesto(testo).split("\n").forEach(p => {
        const parole = p.trim() === "" ? [] : p.trim().split(/\s+/);
        if (!parole.length) { nuovaPaginaSe(hRiga); y += hRiga; return; }
        let i = 0;
        while (i < parole.length) {
          nuovaPaginaSe(hRiga);
          imposta();
          const lw = Math.max(40, larghezza - riduzioneAt(y, y + hRiga));
          let riga = parole[i++];
          if (doc.getTextWidth(riga) > lw) {
            const pezzi = doc.splitTextToSize(riga, lw);
            riga = pezzi[0];
            if (pezzi.length > 1) parole.splice(i, 0, pezzi.slice(1).join(""));
          } else {
            while (i < parole.length && doc.getTextWidth(riga + " " + parole[i]) <= lw) riga += " " + parole[i++];
          }
          const px = align === "center" ? x + lw / 2 : x;
          doc.text(riga, px, y + size * MM, { align });
          y += hRiga;
        }
      });
      y += dopo;
    }

    // Tabella HTML (es. .tabella-progetto): griglia con bordi, intestazione evidenziata,
    // righe alternate e riga d'intestazione ripetuta se la tabella continua su un'altra pagina.
    function tabella(html, o = {}) {
      const { x = MX, larghezza = W - (x - MX), size = 9 } = o;
      if (zone.some(z => z.y1 > y)) y = Math.max(y, fineZone());
      const d = new DOMParser().parseFromString(html, "text/html");
      const righe = [...d.querySelectorAll("tr")].map(tr => {
        const celle = [...tr.children].filter(c => /^(TD|TH)$/.test(c.tagName)).map(c => ({
          testo: htmlInTesto(c.innerHTML),
          span: Math.max(1, parseInt(c.getAttribute("colspan"), 10) || 1),
          th: c.tagName === "TH"
        }));
        return { celle, intestazione: celle.length > 0 && (celle.every(c => c.th) || !!tr.closest("thead")) };
      }).filter(r => r.celle.length);
      if (!righe.length) return;

      const nCol = Math.max(...righe.map(r => r.celle.reduce((s, c) => s + c.span, 0)));
      // larghezza delle colonne in proporzione al contenuto (con un minimo e un massimo di "peso")
      const peso = new Array(nCol).fill(4);
      righe.forEach(r => {
        let j = 0;
        r.celle.forEach(c => {
          if (c.span === 1) {
            const parolaLunga = Math.max(0, ...c.testo.split(/\s+/).map(p => p.length));
            peso[j] = Math.max(peso[j], Math.min(40, Math.max(parolaLunga, Math.min(c.testo.length, 28))));
          }
          j += c.span;
        });
      });
      const somma = peso.reduce((a, b) => a + b, 0);
      const largCol = peso.map(p => larghezza * p / somma);

      const pad = 1.6, lh = size * MM * 1.3;
      const misura = r => {
        let j = 0, cx = x, h = 0;
        const celle = r.celle.map(c => {
          const w = largCol.slice(j, j + c.span).reduce((a, b) => a + b, 0);
          doc.setFont("helvetica", (r.intestazione || c.th) ? "bold" : "normal");
          doc.setFontSize(size);
          const righeTesto = doc.splitTextToSize(c.testo, Math.max(4, w - pad * 2));
          h = Math.max(h, righeTesto.length * lh + pad * 2);
          const cella = { righe: righeTesto, w, x: cx, th: c.th };
          j += c.span; cx += w;
          return cella;
        });
        return { celle, h };
      };
      const disegna = (m, r, zebra) => {
        m.celle.forEach(c => {
          if (r.intestazione) { doc.setFillColor(231, 241, 250); doc.rect(c.x, y, c.w, m.h, "F"); }
          else if (zebra) { doc.setFillColor(245, 249, 253); doc.rect(c.x, y, c.w, m.h, "F"); }
          doc.setDrawColor(160, 182, 204); doc.setLineWidth(0.25);
          doc.rect(c.x, y, c.w, m.h, "S");
          doc.setFont("helvetica", (r.intestazione || c.th) ? "bold" : "normal");
          doc.setFontSize(size);
          const col = r.intestazione ? COLORI.scuro : COLORI.testo;
          doc.setTextColor(col[0], col[1], col[2]);
          c.righe.forEach((rg, i) => doc.text(rg, c.x + pad, y + pad + size * MM + i * lh));
        });
        y += m.h;
      };

      const intest = righe[0].intestazione ? righe[0] : null;
      y += 1.5;
      let corpo = 0;
      righe.forEach(r => {
        const m = misura(r);
        if (y + m.h > PH - MB) {
          nuovaPagina();
          if (intest && r !== intest) disegna(misura(intest), intest, false);
        }
        if (!r.intestazione) corpo++;
        disegna(m, r, !r.intestazione && corpo % 2 === 0);
      });
      y += 1.5;
    }

    // Testo che può contenere tabelle: il testo viene scritto a paragrafi, le tabelle disegnate come tabelle.
    function scrivi(testo, o = {}) {
      const s = (testo == null ? "" : testo).toString();
      if (!/<table[\s>]/i.test(s)) return scriviTesto(s, o);
      s.split(/(<table[\s\S]*?<\/table>)/i).forEach((parte, i) => {
        if (i % 2 === 1) tabella(parte, o);
        else if (htmlInTesto(parte)) scriviTesto(parte, Object.assign({}, o, { dopo: 0.5 }));
      });
      y += (o.dopo == null ? 2 : o.dopo);
    }

    function linea(colore = COLORI.blu, spessore = 0.5) {
      nuovaPaginaSe(2);
      doc.setDrawColor(colore[0], colore[1], colore[2]);
      doc.setLineWidth(spessore);
      doc.line(MX, y, PW - MX - riduzioneAt(y, y + 1), y);
      y += 4;
    }

    function spazio(mm) { y += mm; }
    function riservaSpazio(mm) { nuovaPaginaSe(mm); }

    // Coppie [etichetta, valore] su due colonne.
    function dati(coppie) {
      coppie.forEach(([k, v]) => {
        nuovaPaginaSe(6);
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        doc.setTextColor(COLORI.blu[0], COLORI.blu[1], COLORI.blu[2]);
        doc.text(k + ":", MX, y + 3.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(COLORI.testo[0], COLORI.testo[1], COLORI.testo[2]);
        const val = doc.splitTextToSize(htmlInTesto(v) || "—", W - 52);
        val.forEach((r, i) => doc.text(r, MX + 52, y + 3.5 + i * 4.8));
        y += Math.max(1, val.length) * 4.8 + 1;
      });
      y += 2;
    }

    function posaImmagine(img, didascalia, w, h) {
      nuovaPaginaSe(h + (didascalia ? 8 : 0) + 2);
      doc.addImage(img.data, img.tipo, MX + (W - w) / 2, y, w, h);
      y += h + 2;
      if (didascalia) scrivi(didascalia, { font: "helvetica", stile: "italic", size: 9, colore: COLORI.tenue, align: "center", dopo: 3 });
      else y += 2;
    }

    // Immagine centrata con didascalia, senza spostare il testo:
    //  - se entra nello spazio rimasto, va qui;
    //  - se ne manca poco, viene rimpicciolita per starci;
    //  - altrimenti il testo continua e l'immagine va in cima alla pagina dopo.
    // Se non si riesce a incorporarla (file non raggiungibile o server che non lo consente), resta la didascalia.
    async function immagine(src, didascalia, o = {}) {
      const { maxW = W, maxH = 90 } = o;
      const url = urlSicuro(src);
      if (!url) return;
      const img = await caricaImmagine(url, "jpeg");
      if (!img) {
        if (didascalia) scrivi("[Immagine: " + didascalia + "]", { font: "helvetica", stile: "italic", size: 9, colore: COLORI.tenue });
        return;
      }
      const rapporto = img.w / img.h;
      let w = maxW, h = w / rapporto;
      if (h > maxH) { h = maxH; w = h * rapporto; }
      const extra = (didascalia ? 8 : 0) + 2;
      const libero = PH - MB - y;
      if (h + extra <= libero) {
        posaImmagine(img, didascalia, w, h);
      } else {
        const h2 = libero - extra;
        if (h2 >= Math.max(30, h * 0.6)) posaImmagine(img, didascalia, h2 * rapporto, h2);
        else inAttesa.push({ img, didascalia, w, h });
      }
    }

    // Immagine a destra: il testo che segue le scorre accanto, a sinistra.
    // Più immagini di fila si impilano sulla colonna di destra.
    function posaDestra(img, didascalia, w, h) {
      const testoDida = didascalia ? htmlInTesto(didascalia) : "";
      const righeDida = ww => {
        if (!testoDida) return [];
        doc.setFont("helvetica", "italic"); doc.setFontSize(8);
        return doc.splitTextToSize(testoDida, ww);
      };
      const hDida = ww => { const r = righeDida(ww); return r.length ? r.length * 3.4 + 1.5 : 0; };
      const yPos = Math.max(y, fineZone());
      const libero = PH - MB - yPos;
      if (h + hDida(w) + 2 > libero) {
        const h2 = libero - hDida(w) - 2;
        if (h2 >= Math.max(30, h * 0.6)) { w = w * h2 / h; h = h2; }
        else { inAttesa.push({ destra: true, img, didascalia, w, h }); return; }
      }
      const xImg = PW - MX - w;
      doc.addImage(img.data, img.tipo, xImg, yPos, w, h);
      const righe = righeDida(w);
      if (righe.length) {
        doc.setTextColor(COLORI.tenue[0], COLORI.tenue[1], COLORI.tenue[2]);
        righe.forEach((r, i) => doc.text(r, xImg + w / 2, yPos + h + 3 + i * 3.4, { align: "center" }));
      }
      zone.push({ y0: yPos, y1: yPos + h + hDida(w) + 2, w });
    }

    async function immagineDestra(src, didascalia, o = {}) {
      const { maxW = 62, maxH = 85 } = o;
      const url = urlSicuro(src);
      if (!url) return;
      const img = await caricaImmagine(url, "jpeg");
      if (!img) {
        if (didascalia) scrivi("[Immagine: " + didascalia + "]", { font: "helvetica", stile: "italic", size: 9, colore: COLORI.tenue });
        return;
      }
      const rapporto = img.w / img.h;
      let w = maxW, h = w / rapporto;
      if (h > maxH) { h = maxH; w = h * rapporto; }
      posaDestra(img, didascalia, w, h);
    }

    // Mappa di trasporti (diagramma di linea): titolo, righe con icone / km / nome / dettaglio, rami, didascalia.
    // Va a tutta larghezza di blocco (non scorre il testo accanto) ed è allineata come da "allineamento".
    // Se non entra nella pagina continua su quella successiva, chiudendo e riaprendo il riquadro.
    async function mappa(m) {
      if (!m || typeof m !== "object") return;
      const righe = (Array.isArray(m.righe) ? m.righe : []).filter(r => r && typeof r === "object");
      if (!righe.length) return;

      const sz = Math.max(12, Math.min(40, parseInt(m.dimensione_icone, 10) || 20)) * PX;   // lato icona, mm
      const larg = Math.max(220, Math.min(1000, parseInt(m.larghezza, 10) || 420));
      const allin = ["destra", "sinistra", "centro", "intera"].includes(m.allineamento) ? m.allineamento : "centro";
      const wMap = allin === "intera" ? W : Math.min(W, larg * PX);
      const x0 = allin === "sinistra" || allin === "intera" ? MX : allin === "destra" ? PW - MX - wMap : MX + (W - wMap) / 2;
      const coloreLinee = mappaColore(m.colore_linee);
      const bgTitolo = mappaColore(m.colore_intestazione) || "#eaecf0";
      const bgCorpo = mappaColore(m.colore_sfondo) || "#ffffff";
      const mostraKm = m.mostra_km !== false && righe.some(r => r.tipo !== "ramo" && (r.km || "").toString().trim());
      const nCol = Math.max(1, ...righe.filter(r => r.tipo !== "ramo").map(r => mappaCodici(r.icone).length));

      const fs = Math.min(8.5, sz * 0.8 / MM);          // corpo del testo, pt
      const BORDO = [162, 169, 177];
      const xIcone = x0 + 1.6;
      const kmW = mostraKm ? 14 : 0;
      const xKm = xIcone + nCol * sz + 1;
      const xTesto = xKm + kmW + 1;
      const wTesto = Math.max(20, x0 + wMap - xTesto - 2.5);

      // Scarica prima tutte le icone (in parallelo): il disegno poi è sincrono.
      const icone = new Map();
      const richieste = [];
      righe.forEach(r => {
        if (r.tipo === "ramo") return;
        const col = mappaColore(r.colore) || coloreLinee;
        mappaCodici(r.icone).forEach(c => {
          if (c === "-" || c === "_") return;
          const k = c + "|" + col;
          if (!icone.has(k)) { icone.set(k, null); richieste.push(caricaIcona(c, col).then(ic => icone.set(k, ic))); }
        });
      });
      await Promise.all(richieste);

      // Disegno semplificato di riserva (icona non scaricabile).
      const iconaDiRiserva = (codice, col, cx, cy) => {
        const rgb = col ? mappaRgb(col) : MAPPA_DEFAULT;
        doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
        doc.setLineWidth(Math.max(0.5, sz * 0.14));
        doc.line(cx + sz / 2, cy, cx + sz / 2, cy + sz);
        if (/BHF|HST/.test(codice)) {
          doc.setFillColor(255, 255, 255);
          doc.setLineWidth(Math.max(0.35, sz * 0.09));
          doc.circle(cx + sz / 2, cy + sz / 2, sz * (/HST/.test(codice) ? 0.2 : 0.3), "FD");
        }
      };

      const impostaTesto = (stile, size, colore) => {
        doc.setFont("helvetica", stile); doc.setFontSize(size);
        doc.setTextColor(colore[0], colore[1], colore[2]);
      };

      // Misura di una riga: righe di testo già spezzate. Altezza = multiplo del lato dell'icona,
      // così le icone di tratto continuo si ripetono in verticale senza tagli.
      const misura = r => {
        const tipo = r.tipo === "nota" || r.tipo === "ramo" ? r.tipo : "fermata";
        const nome = htmlInTesto(r.nome || "");
        const dett = htmlInTesto(r.dettaglio || "");
        if (tipo === "ramo") {
          if (!nome) return null;
          doc.setFont("helvetica", "bold"); doc.setFontSize(9);
          const linee = doc.splitTextToSize(nome, wMap - 6);
          return { tipo, linee, h: linee.length * 4.2 + 2.6 };
        }
        const size = tipo === "nota" ? fs * 0.9 : fs;
        doc.setFont("helvetica", "normal"); doc.setFontSize(size);
        const linee = nome ? doc.splitTextToSize(nome, wTesto) : [];
        let dettInLinea = false;
        if (dett) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(size * 0.85);
          const wd = doc.getTextWidth(" " + dett);
          doc.setFontSize(size);
          const wUltima = linee.length ? doc.getTextWidth(linee[linee.length - 1]) : 0;
          if (linee.length && wUltima + wd <= wTesto) dettInLinea = true;
        }
        const n = Math.max(1, linee.length + (dett && !dettInLinea ? 1 : 0));
        return { tipo, nome, dett, linee, dettInLinea, size, n, h: n * sz };
      };

      const misure = righe.map(r => ({ r, m: misura(r) })).filter(x => x.m);
      if (!misure.length) return;
      const titolo = htmlInTesto(m.titolo || "");
      let hTitolo = 0, lineeTitolo = [];
      if (titolo) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(10);
        lineeTitolo = doc.splitTextToSize(titolo, wMap - 6);
        hTitolo = lineeTitolo.length * 4.6 + 3;
      }

      if (zone.some(z => z.y1 > y)) y = Math.max(y, fineZone());
      y += 2;
      nuovaPaginaSe(hTitolo + misure[0].m.h + 4);

      let segY = y;
      const chiudiSegmento = () => {
        doc.setDrawColor(BORDO[0], BORDO[1], BORDO[2]); doc.setLineWidth(0.25);
        doc.rect(x0, segY, wMap, y - segY, "S");
      };

      if (titolo) {
        const bg = mappaRgb(bgTitolo), tc = mappaTestoSu(bgTitolo);
        doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(x0, y, wMap, hTitolo, "F");
        impostaTesto("bold", 10, tc);
        lineeTitolo.forEach((l, i) => doc.text(l, x0 + wMap / 2, y + 1.5 + (i + 1) * 4.6 - 1, { align: "center" }));
        y += hTitolo;
        doc.setDrawColor(BORDO[0], BORDO[1], BORDO[2]); doc.setLineWidth(0.25);
        doc.line(x0, y, x0 + wMap, y);
      }

      const bc = mappaRgb(bgCorpo);
      for (const { r, m: mi } of misure) {
        if (y + mi.h > PH - MB) { chiudiSegmento(); nuovaPagina(); segY = y; }

        if (mi.tipo === "ramo") {
          const bg = mappaRgb(bgTitolo), tc = mappaTestoSu(bgTitolo);
          doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(x0, y, wMap, mi.h, "F");
          doc.setDrawColor(BORDO[0], BORDO[1], BORDO[2]); doc.setLineWidth(0.25);
          doc.line(x0, y, x0 + wMap, y); doc.line(x0, y + mi.h, x0 + wMap, y + mi.h);
          impostaTesto("bold", 9, tc);
          mi.linee.forEach((l, i) => doc.text(l, x0 + wMap / 2, y + 1.3 + (i + 1) * 4.2 - 0.9, { align: "center" }));
          y += mi.h;
          continue;
        }

        doc.setFillColor(bc[0], bc[1], bc[2]); doc.rect(x0, y, wMap, mi.h, "F");

        // icone (anche sulle note), ripetute in verticale se di tratto continuo
        const col = mappaColore(r.colore) || coloreLinee;
        mappaCodici(r.icone).forEach((c, j) => {
          if (c === "-" || c === "_") return;
          const ic = icone.get(c + "|" + col);
          const continua = MAPPA_RE_LINEA.test(c);
          for (let k = 0; k < (continua ? mi.n : 1); k++) {
            const cx = xIcone + j * sz, cy = y + k * sz;
            if (ic) doc.addImage(ic.data, "PNG", cx, cy, sz, sz, ic.chiave);
            else iconaDiRiserva(c, col, cx, cy);
          }
        });

        // chilometrica
        const km = mostraKm ? htmlInTesto(r.km || "") : "";
        if (km) {
          impostaTesto("normal", fs * 0.9, COLORI.tenue);
          doc.text(km, xKm + kmW - 1.5, y + sz / 2 + fs * 0.9 * MM * 0.33, { align: "right" });
        }

        // nome (con eventuale collegamento) e dettaglio
        const url = mappaUrlWeb(r.url);
        const colNome = mi.tipo === "nota" ? COLORI.tenue : (url ? [6, 69, 173] : COLORI.scuro);
        mi.linee.forEach((l, i) => {
          impostaTesto("normal", mi.size, colNome);
          const ty = y + i * sz + sz / 2 + mi.size * MM * 0.33;
          if (url) doc.textWithLink(l, xTesto, ty, { url }); else doc.text(l, xTesto, ty);
        });
        if (mi.dett) {
          const iLinea = mi.dettInLinea ? mi.linee.length - 1 : mi.linee.length;
          const ty = y + iLinea * sz + sz / 2 + mi.size * MM * 0.33;
          let dx = xTesto;
          if (mi.dettInLinea) {
            impostaTesto("normal", mi.size, colNome);
            dx += doc.getTextWidth(mi.linee[mi.linee.length - 1] + " ");
          }
          impostaTesto("normal", mi.size * 0.85, COLORI.tenue);
          doc.text(mi.dett, dx, ty);
        }
        y += mi.h;
      }
      chiudiSegmento();
      y += 2;

      const dida = htmlInTesto(m.didascalia || "");
      if (dida) scrivi(dida, { font: "helvetica", stile: "italic", size: 8, colore: COLORI.tenue, align: "center", x: x0, larghezza: wMap, dopo: 3 });
      else y += 2;
    }

    /* ---------- DOSSIER: fascia, iter, testo a fronte ---------- */
    function fascia(testo) {
      nuovaPaginaSe(18);
      if (zone.some(z => z.y1 > y)) y = Math.max(y, fineZone());
      doc.setFillColor(207, 227, 245);
      doc.rect(MX, y, W, 8, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
      doc.setTextColor(COLORI.scuro[0], COLORI.scuro[1], COLORI.scuro[2]);
      doc.text(htmlInTesto(testo).toUpperCase(), PW / 2, y + 5.5, { align: "center" });
      y += 12;
    }

    function pagina() { nuovaPagina(); }

    const ITER_COL = {
      blu:     { bg: [222, 236, 250], fr: [46, 119, 201] },
      arancio: { bg: [253, 236, 222], fr: [196, 61, 52] },
      verde:   { bg: [225, 242, 229], fr: [40, 140, 70] },
      grigio:  { bg: [234, 237, 241], fr: [110, 120, 132] }
    };

    // Iter: riquadri colorati (fase, data, organo/atto, esito) collegati da frecce, + riquadro finale.
    function iter(tappe, conclusione) {
      const L = tappe.length;
      const freccia = col => {
        doc.setFillColor(col[0], col[1], col[2]);
        doc.triangle(PW / 2 - 3.2, y + 1.2, PW / 2 + 3.2, y + 1.2, PW / 2, y + 6.2, "F");
        y += 8;
      };
      tappe.forEach((t, i) => {
        const col = ITER_COL[t.colore] || ITER_COL.blu;
        const xEs = MX + 124, wEs = W - 124 - 3;
        doc.setFont("helvetica", "bold"); doc.setFontSize(8);
        const esito = doc.splitTextToSize(htmlInTesto(t.esito || "").toUpperCase(), wEs);
        const h = Math.max(24, esito.length * 3.5 + 9);
        nuovaPaginaSe(h + 9);
        doc.setFillColor(col.bg[0], col.bg[1], col.bg[2]);
        doc.roundedRect(MX, y, W, h, 2, 2, "F");

        doc.setFont("helvetica", "bold"); doc.setFontSize(7);
        doc.setTextColor(COLORI.scuro[0], COLORI.scuro[1], COLORI.scuro[2]);
        doc.text(htmlInTesto(t.fase || "").toUpperCase(), MX + 3, y + 4.2);

        const mid = y + h / 2;
        const dt = (t.data || "").toString().trim().match(/^(\d{1,2})\s+([^\d\s]+)\s+(\d{4})$/);
        if (dt) {
          doc.setFontSize(22); doc.text(dt[1], MX + 5, mid + 4);
          const wd = doc.getTextWidth(dt[1]);
          doc.setFontSize(8.5);
          doc.text(htmlInTesto(dt[2]), MX + 5 + wd + 2, mid - 1);
          doc.text(dt[3], MX + 5 + wd + 2, mid + 4);
        } else if (t.data) {
          doc.setFontSize(9);
          doc.splitTextToSize(htmlInTesto(t.data), 38).forEach((r, k) => doc.text(r, MX + 5, mid - 1 + k * 4));
        }

        const org = htmlInTesto(t.organo || ""), rif = htmlInTesto(t.riferimento || "");
        const cx = MX + 84;
        if (org) {
          doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
          doc.setTextColor(COLORI.tenue[0], COLORI.tenue[1], COLORI.tenue[2]);
          doc.text(org, cx, rif ? mid - 1 : mid + 1.5, { align: "center" });
        }
        if (rif) {
          let fs = 12;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(fs);
          while (fs > 8 && doc.getTextWidth(rif) > 72) { fs -= 0.5; doc.setFontSize(fs); }
          doc.setTextColor(COLORI.scuro[0], COLORI.scuro[1], COLORI.scuro[2]);
          doc.text(rif, cx, org ? mid + 5.5 : mid + 1.5, { align: "center" });
        }

        doc.setFont("helvetica", "bold"); doc.setFontSize(8);
        doc.setTextColor(COLORI.scuro[0], COLORI.scuro[1], COLORI.scuro[2]);
        const y0 = mid - (esito.length * 3.5) / 2 + 2.6;
        esito.forEach((r, k) => doc.text(r, xEs + wEs / 2, y0 + k * 3.5, { align: "center" }));

        y += h;
        if (i < L - 1 || conclusione) freccia(col.fr);
      });
      if (conclusione) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        const ls = doc.splitTextToSize(htmlInTesto(conclusione), W - 10);
        const h = ls.length * 5.2 + 6;
        nuovaPaginaSe(h + 3);
        doc.setDrawColor(COLORI.blu[0], COLORI.blu[1], COLORI.blu[2]); doc.setLineWidth(0.5);
        doc.roundedRect(MX, y, W, h, 2, 2, "S");
        doc.setTextColor(COLORI.scuro[0], COLORI.scuro[1], COLORI.scuro[2]);
        ls.forEach((r, k) => doc.text(r, PW / 2, y + 6.2 + k * 5.2, { align: "center" }));
        y += h + 3;
      }
    }

    // Testo a fronte: tabella a due colonne uguali con parole in grassetto / barrate.
    // righe: { tipo:"titolo", segs } | { tipo:"intestazione", sx, dx } | { tipo:"rif", testo } | { tipo:"riga", sx, dx }
    // segmenti: { t, b (grassetto), c (corsivo), s (barrato, in rosso) }; { t:"\n" } = a capo.
    // Le righe lunghe continuano sulla pagina dopo; l'intestazione delle colonne si ripete.
    function confronto(righe, o = {}) {
      const size = 8.5, lh = size * MM * 1.32, pad = 1.8, cw = W / 2;
      const etich = o.etichette || null;
      const puro = s => (s == null ? "" : s).toString().replace(/\u00a0/g, " ")
        .replace(/[^\x09\x0A\x20-\x7E\u00A1-\u00FF\u2018-\u201F\u2013\u2014\u2026\u2022\u20AC]/g, "?");
      const stileDi = (s, base) => {
        const b = s.b || base.b, c = s.c || base.c;
        return b && c ? "bolditalic" : b ? "bold" : c ? "italic" : "normal";
      };
      const larghezzaSpazio = () => { doc.setFont("helvetica", "normal"); doc.setFontSize(size); return doc.getTextWidth(" "); };

      function avvolgi(segs, larg, base) {
        const sp = larghezzaSpazio();
        const linee = []; let cur = [], w = 0;
        (segs || []).forEach(s => {
          if (s.t === "\n") { linee.push(cur); cur = []; w = 0; return; }
          const st = stileDi(s, base), testo = puro(s.t);
          doc.setFont("helvetica", st); doc.setFontSize(size);
          const pezzi = doc.getTextWidth(testo) > larg ? doc.splitTextToSize(testo, larg) : [testo];
          pezzi.forEach((p, ip) => {
            doc.setFont("helvetica", st); doc.setFontSize(size);
            const pw = doc.getTextWidth(p);
            if (ip > 0 || (cur.length && w + sp + pw > larg)) { linee.push(cur); cur = []; w = 0; }
            w += (cur.length ? sp : 0) + pw;
            cur.push({ t: p, w: pw, st, s: !!s.s });
          });
        });
        if (cur.length || !linee.length) linee.push(cur);
        return linee;
      }

      function disegna(linee, x, larg, allinea, colore, yTop) {
        const sp = larghezzaSpazio();
        linee.forEach((ln, i) => {
          const tot = ln.reduce((a, p) => a + p.w, 0) + sp * Math.max(0, ln.length - 1);
          let cx = allinea === "centro" ? x + (larg - tot) / 2 : allinea === "destra" ? x + larg - tot : x;
          const base = yTop + pad + size * MM + i * lh;
          ln.forEach(p => {
            doc.setFont("helvetica", p.st); doc.setFontSize(size);
            const c = p.s ? [167, 46, 35] : colore;
            doc.setTextColor(c[0], c[1], c[2]);
            doc.text(p.t, cx, base);
            if (p.s) {
              doc.setDrawColor(167, 46, 35); doc.setLineWidth(0.2);
              doc.line(cx, base - size * MM * 0.3, cx + p.w, base - size * MM * 0.3);
            }
            cx += p.w + sp;
          });
        });
      }

      function stampa(c0, c1, op) {
        let i0 = 0, i1 = 0;
        while (i0 < c0.length || i1 < c1.length) {
          const n = Math.floor((PH - MB - y - pad * 2) / lh);
          const resto = Math.max(c0.length - i0, c1.length - i1);
          // niente righe spezzate se brevi: meglio spostarle intere sulla pagina dopo
          if (n < 1 || (resto > n && resto <= 7 && i0 === 0 && i1 === 0)) { nuovaPaginaConIntestazione(); continue; }
          const s0 = c0.slice(i0, i0 + n), s1 = c1.slice(i1, i1 + n);
          const h = Math.max(s0.length, s1.length, 1) * lh + pad * 2;
          doc.setDrawColor(160, 182, 204); doc.setLineWidth(0.25);
          if (op.unita) {
            if (op.fill) { doc.setFillColor(op.fill[0], op.fill[1], op.fill[2]); doc.rect(MX, y, W, h, "F"); }
            doc.rect(MX, y, W, h, "S");
            disegna(s0, MX + pad, W - pad * 2, op.allinea[0], op.colore, y);
          } else {
            [0, 1].forEach(k => {
              const x = MX + k * cw;
              if (op.fill) { doc.setFillColor(op.fill[0], op.fill[1], op.fill[2]); doc.rect(x, y, cw, h, "F"); }
              doc.rect(x, y, cw, h, "S");
            });
            const ri = op.rientro || 0;
            disegna(s0, MX + pad + ri, cw - pad * 2 - ri, op.allinea[0], op.colore, y);
            disegna(s1, MX + cw + pad + ri, cw - pad * 2 - ri, op.allinea[1], op.colore, y);
          }
          y += h; i0 += s0.length; i1 += s1.length;
          if (i0 < c0.length || i1 < c1.length) nuovaPaginaConIntestazione();
        }
      }

      const intestazione = () => {
        if (!etich) return;
        const larg = cw - pad * 2;
        stampa(avvolgi([{ t: etich[0], b: true }], larg, {}), avvolgi([{ t: etich[1], b: true }], larg, {}),
          { fill: [207, 227, 245], colore: COLORI.scuro, allinea: ["centro", "centro"] });
      };
      function nuovaPaginaConIntestazione() { nuovaPagina(); intestazione(); }

      if (zone.some(z => z.y1 > y)) y = Math.max(y, fineZone());
      y += 1;
      intestazione();
      righe.forEach(r => {
        const larg = cw - pad * 2;
        if (r.tipo === "titolo") {
          stampa(avvolgi(r.segs, W - pad * 2, { b: true }), [], { fill: [231, 241, 250], colore: COLORI.scuro, allinea: ["centro", "centro"], unita: true });
        } else if (r.tipo === "intestazione") {
          stampa(avvolgi(r.sx, larg, { b: true }), avvolgi(r.dx, larg, { b: true }),
            { fill: COLORI.blu, colore: [255, 255, 255], allinea: ["centro", "centro"] });
        } else if (r.tipo === "rif") {
          stampa([], avvolgi([{ t: r.testo, c: true }], larg, {}), { fill: null, colore: COLORI.tenue, allinea: ["sinistra", "destra"] });
        } else {
          const ri = r.rientro || 0;
          stampa(avvolgi(r.sx, larg - ri, {}), avvolgi(r.dx, larg - ri, {}), { fill: null, colore: COLORI.testo, allinea: ["sinistra", "sinistra"], rientro: ri });
        }
      });
      y += 3;
    }

    // Riquadro evidenziato (avvisi, note): fascia colorata a sinistra, titolo in grassetto e righe di testo.
    // o: { titolo, righe:[testo], elenco:true (puntato), colore:"rosso"|"ambra"|"blu", size }
    // Se non entra nella pagina corrente passa alla successiva; se è più lungo di una pagina continua.
    function riquadro(o = {}) {
      const { titolo = "", righe = [], elenco = false, colore = "blu", size = 9.5 } = o;
      const T = {
        rosso: { bg: [253, 236, 235], br: [167, 46, 35], tx: [110, 28, 20] },
        ambra: { bg: [255, 247, 222], br: [201, 162, 39], tx: [105, 78, 0] },
        blu:   { bg: [231, 241, 250], br: [18, 80, 140],  tx: COLORI.scuro }
      }[colore] || { bg: [231, 241, 250], br: [18, 80, 140], tx: COLORI.scuro };
      const pad = 3, band = 1.6, lh = size * MM * 1.35, ind = elenco ? 3.5 : 0;
      const wTesto = W - pad * 2 - band - 1;
      if (zone.some(z => z.y1 > y)) y = Math.max(y, fineZone());

      const linee = [];
      if (titolo) {
        doc.setFont("helvetica", "bold"); doc.setFontSize(size + 0.5);
        doc.splitTextToSize(htmlInTesto(titolo), wTesto).forEach(t => linee.push({ t, b: true, x: 0 }));
      }
      doc.setFont("helvetica", "normal"); doc.setFontSize(size);
      righe.forEach(r => {
        const testo = htmlInTesto(r);
        if (!testo) return;
        doc.splitTextToSize(testo, wTesto - ind).forEach((t, i) => linee.push({ t, b: false, x: ind, punto: elenco && i === 0 }));
      });
      if (!linee.length) return;

      let i = 0;
      while (i < linee.length) {
        const n = Math.floor((PH - MB - y - pad * 2) / lh);
        // un riquadro che sta in una pagina non viene spezzato
        if (n < 1 || (i === 0 && linee.length > n && linee.length <= 40)) { nuovaPagina(); continue; }
        const parte = linee.slice(i, i + n);
        const h = parte.length * lh + pad * 2;
        doc.setFillColor(T.bg[0], T.bg[1], T.bg[2]); doc.rect(MX, y, W, h, "F");
        doc.setDrawColor(T.br[0], T.br[1], T.br[2]); doc.setLineWidth(0.25); doc.rect(MX, y, W, h, "S");
        doc.setFillColor(T.br[0], T.br[1], T.br[2]); doc.rect(MX, y, band, h, "F");
        parte.forEach((l, k) => {
          doc.setFont("helvetica", l.b ? "bold" : "normal");
          doc.setFontSize(l.b ? size + 0.5 : size);
          doc.setTextColor(T.tx[0], T.tx[1], T.tx[2]);
          const ty = y + pad + size * MM + k * lh;
          if (l.punto) doc.text("\u2022", MX + band + pad, ty);
          doc.text(l.t, MX + band + pad + l.x, ty);
        });
        y += h; i += parte.length;
        if (i < linee.length) nuovaPagina();
      }
      y += 3;
    }

    // Testo cliccabile che apre un indirizzo.
    function link(testo, url, o = {}) {
      const { size = 10, x = MX } = o;
      let href = url;
      try { href = new URL(url, window.location.href).href; } catch (e) {}
      doc.setFont("helvetica", "normal"); doc.setFontSize(size);
      doc.setTextColor(COLORI.link[0], COLORI.link[1], COLORI.link[2]);
      doc.splitTextToSize(htmlInTesto(testo), W - (x - MX)).forEach(r => {
        nuovaPaginaSe(size * MM * 1.4);
        doc.textWithLink(r, x, y + size * MM, { url: href });
        y += size * MM * 1.4;
      });
      y += 2;
    }

    // Barra in alto (logo + nome) e numerazione, su tutte le pagine.
    function disegnaBarra() {
      doc.setFillColor(COLORI.blu[0], COLORI.blu[1], COLORI.blu[2]);
      doc.rect(0, 0, PW, BAR, "F");
      let xTesto = MX;
      if (logo) {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(MX, 2.5, 13, 13, 1.5, 1.5, "F");
        const box = 11;
        let lw = box, lh = box * logo.h / logo.w;
        if (lh > box) { lh = box; lw = box * logo.w / logo.h; }
        doc.addImage(logo.data, "PNG", MX + 6.5 - lw / 2, 9 - lh / 2, lw, lh);
        xTesto = MX + 17;
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(15);
      doc.text((marca.nome || "").toString(), xTesto, marca.sottotitolo ? 9.2 : 10.8);
      if (marca.sottotitolo) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8);
        doc.text(htmlInTesto(marca.sottotitolo), xTesto, 14.3);
      }
    }

    function salva(nomeFile, piede) {
      while (inAttesa.length) nuovaPagina();
      const n = doc.getNumberOfPages();
      for (let i = 1; i <= n; i++) {
        doc.setPage(i);
        disegnaBarra();
        doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
        doc.setTextColor(120, 130, 140);
        doc.text(htmlInTesto(piede || "").slice(0, 80), MX, PH - 10);
        doc.text(`Pagina ${i} di ${n}`, PW - MX, PH - 10, { align: "right" });
      }
      doc.save(nomeFile);
    }

    return { scrivi, linea, spazio, riservaSpazio, dati, immagine, immagineDestra, mappa, link, salva, fascia, pagina, iter, confronto, riquadro };
  }

  function nomeFile(titolo, predefinito) {
    const base = (titolo || predefinito || "documento").toString()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return (base || predefinito || "documento") + ".pdf";
  }

  window.PdfExport = { crea, nomeFile, htmlInTesto, colori: COLORI };
})();