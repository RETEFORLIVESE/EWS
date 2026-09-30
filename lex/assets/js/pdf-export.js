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

    // Testo con a capo automatico; spezza le pagine riga per riga.
    function scrivi(testo, o = {}) {
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
