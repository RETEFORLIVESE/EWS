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

  async function crea(opzioni) {
    const marca = (opzioni && opzioni.marca) || {};
    const jsPDF = await caricaJsPdf();
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const logo = marca.logo ? await caricaImmagine(marca.logo, "png") : null;
    let y = MT;

    const nuovaPaginaSe = h => { if (y + h > PH - MB) { doc.addPage(); y = MT; } };

    // Testo semplice con a capo automatico; spezza le pagine riga per riga.
    function scriviTesto(testo, o = {}) {
      const { font = "times", stile = "normal", size = 11, x = MX, larghezza = W - (x - MX),
              align = "left", colore = COLORI.testo, dopo = 2, interlinea = 1.35 } = o;
      doc.setFont(font, stile);
      doc.setFontSize(size);
      doc.setTextColor(colore[0], colore[1], colore[2]);
      const hRiga = size * MM * interlinea;
      htmlInTesto(testo).split("\n").forEach(p => {
        const righe = p.trim() === "" ? [""] : doc.splitTextToSize(p, larghezza);
        righe.forEach(r => {
          nuovaPaginaSe(hRiga);
          const px = align === "center" ? x + larghezza / 2 : x;
          doc.text(r, px, y + size * MM, { align });
          y += hRiga;
        });
      });
      y += dopo;
    }

    // Tabella HTML (es. .tabella-progetto): griglia con bordi, intestazione evidenziata,
    // righe alternate e riga d'intestazione ripetuta se la tabella continua su un'altra pagina.
    function tabella(html, o = {}) {
      const { x = MX, larghezza = W - (x - MX), size = 9 } = o;
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
          doc.addPage(); y = MT;
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
      doc.line(MX, y, PW - MX, y);
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

    // Immagine centrata con didascalia. Se non si riesce a incorporarla, resta la didascalia.
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
      const hDida = didascalia ? 8 : 0;
      nuovaPaginaSe(h + hDida + 2);
      doc.addImage(img.data, img.tipo, MX + (W - w) / 2, y, w, h);
      y += h + 2;
      if (didascalia) scrivi(didascalia, { font: "helvetica", stile: "italic", size: 9, colore: COLORI.tenue, align: "center", dopo: 3 });
      else y += 2;
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

    return { scrivi, linea, spazio, riservaSpazio, dati, immagine, link, salva };
  }

  function nomeFile(titolo, predefinito) {
    const base = (titolo || predefinito || "documento").toString()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return (base || predefinito || "documento") + ".pdf";
  }

  window.PdfExport = { crea, nomeFile, htmlInTesto, colori: COLORI };
})();
