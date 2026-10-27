// assets/js/copertina.js
// Editor delle copertine personalizzate dei PDF (atti e dossier), con anteprima A4 e trascinamento.
//
// Una copertina è salvata come oggetto semplice (atto.copertina / atto.dossier.copertina):
// {
//   attiva, sfondo:"#rrggbb", immagineSfondo:"url", nascondiBarra,
//   cornice:{ attiva, colore, spessore, margine },
//   elementi:[
//     { tipo:"testo", testo, x, y, w, size, colore, font, stile, align },
//     { tipo:"immagine", src, x, y, w, h, adatta:"contieni"|"riempi" },
//     { tipo:"rettangolo", x, y, w, h, pieno, riempimento, spessore, bordo },
//     { tipo:"linea", x, y, x2, y2, colore, spessore }
//   ]
// }
// Tutte le misure sono in millimetri su un foglio A4 (210 x 297). Nei testi si possono usare i
// segnaposto {titolo} {sottotitolo} {numero} {anno} {data} {categoria} {ente} {atto}.
// Il disegno nel PDF è fatto da PdfExport.crea(...).copertina() (assets/js/pdf-export.js).
(function () {
  "use strict";

  const PW = 210, PH = 297, S = 2;          // S = pixel per mm nell'anteprima
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const esc = t => (t == null ? "" : t).toString().replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v, d) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  function colore(v, d) {
    v = (v || "").toString().trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    const m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    return m ? ("#" + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toLowerCase() : d;
  }
  function urlSicuro(valore) {
    const u = (valore || "").toString().trim();
    if (!u) return "";
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return "";
    return u;
  }
  const sost = (t, vars) => (t == null ? "" : String(t))
    .replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? vars[k] : "");

  const FONTS = { helvetica: "Sans-serif", times: "Serif", courier: "Monospazio" };
  const STILI = { normal: "Normale", bold: "Grassetto", italic: "Corsivo", bolditalic: "Grassetto corsivo" };
  const ALLIN = { left: "Sinistra", center: "Centro", right: "Destra" };
  const ADATTA = { contieni: "Contieni (intera)", riempi: "Riempi (ritaglia)" };
  const TIPI = { testo: "Testo", immagine: "Immagine", rettangolo: "Rettangolo", linea: "Linea" };
  const CSS_FONT = {
    helvetica: "Helvetica,Arial,sans-serif",
    times: "'Times New Roman',Times,serif",
    courier: "'Courier New',Courier,monospace"
  };
  const scelta = (v, ok, d) => has(ok, v) ? v : d;

  /* ---------- modello ---------- */

  function normEl(e) {
    if (!e || typeof e !== "object") return null;
    switch (e.tipo) {
      case "testo": return {
        tipo: "testo", testo: e.testo == null ? "" : String(e.testo),
        x: num(e.x, 20), y: num(e.y, 20), w: clamp(num(e.w, 150), 10, PW),
        size: clamp(num(e.size, 14), 4, 120), colore: colore(e.colore, "#000000"),
        font: scelta(e.font, FONTS, "helvetica"), stile: scelta(e.stile, STILI, "normal"), align: scelta(e.align, ALLIN, "left")
      };
      case "immagine": return {
        tipo: "immagine", src: (e.src || "").toString().trim(),
        x: num(e.x, 75), y: num(e.y, 40), w: clamp(num(e.w, 60), 1, PW), h: clamp(num(e.h, 60), 1, PH),
        adatta: scelta(e.adatta, ADATTA, "contieni")
      };
      case "rettangolo": return {
        tipo: "rettangolo", x: num(e.x, 0), y: num(e.y, 0), w: clamp(num(e.w, 210), 0, PW), h: clamp(num(e.h, 40), 0, PH),
        pieno: e.pieno !== false && e.pieno !== "false", riempimento: colore(e.riempimento, "#0b3d6e"),
        spessore: clamp(num(e.spessore, 0), 0, 20), bordo: colore(e.bordo, "#000000")
      };
      case "linea": return {
        tipo: "linea", x: num(e.x, 30), y: num(e.y, 150), x2: num(e.x2, 180), y2: num(e.y2, 150),
        colore: colore(e.colore, "#c9a227"), spessore: clamp(num(e.spessore, 1), 0.1, 20)
      };
      default: return null;
    }
  }

  function normalizza(c) {
    c = c || {};
    const co = c.cornice || {};
    return {
      attiva: !!c.attiva,
      sfondo: colore(c.sfondo, "#ffffff"),
      immagineSfondo: (c.immagineSfondo || "").toString().trim(),
      nascondiBarra: c.nascondiBarra !== false,
      cornice: { attiva: !!co.attiva, colore: colore(co.colore, "#0b3d6e"), spessore: clamp(num(co.spessore, 1), 0.1, 10), margine: clamp(num(co.margine, 10), 0, 60) },
      elementi: (Array.isArray(c.elementi) ? c.elementi : []).map(normEl).filter(Boolean)
    };
  }

  const T = (testo, x, y, w, size, col, font, stile, align) => ({ tipo: "testo", testo, x, y, w, size, colore: col, font, stile, align });

  const PRESET = {
    istituzionale: () => ({
      attiva: true, sfondo: "#f5f9fd",
      elementi: [
        { tipo: "rettangolo", x: 0, y: 0, w: 22, h: 297, pieno: true, riempimento: "#0b3d6e", spessore: 0 },
        T("{categoria}", 36, 70, 150, 11, "#12508c", "helvetica", "bold", "left"),
        T("{titolo}", 36, 82, 150, 30, "#0b1f38", "helvetica", "bold", "left"),
        { tipo: "linea", x: 36, y: 150, x2: 100, y2: 150, colore: "#c9a227", spessore: 1.2 },
        T("{sottotitolo}", 36, 158, 150, 14, "#4b5866", "helvetica", "normal", "left"),
        T("{numero}/{anno}  -  {data}", 36, 255, 150, 11, "#1f2a33", "helvetica", "normal", "left"),
        T("NormAktiv - Raccolta ufficiale degli atti normativi", 36, 270, 150, 9, "#4b5866", "helvetica", "normal", "left")
      ]
    }),
    classica: () => ({
      attiva: true, sfondo: "#ffffff",
      cornice: { attiva: true, colore: "#0b3d6e", spessore: 1.2, margine: 12 },
      elementi: [
        T("{categoria}", 20, 55, 170, 11, "#12508c", "helvetica", "bold", "center"),
        { tipo: "linea", x: 80, y: 66, x2: 130, y2: 66, colore: "#c9a227", spessore: 1 },
        T("{titolo}", 25, 85, 160, 28, "#0b1f38", "times", "bold", "center"),
        T("{sottotitolo}", 25, 150, 160, 14, "#4b5866", "times", "italic", "center"),
        { tipo: "linea", x: 80, y: 220, x2: 130, y2: 220, colore: "#c9a227", spessore: 1 },
        T("{ente}", 25, 230, 160, 12, "#0b1f38", "helvetica", "bold", "center"),
        T("{data}", 25, 242, 160, 11, "#4b5866", "helvetica", "normal", "center")
      ]
    }),
    scura: () => ({
      attiva: true, sfondo: "#0b1f38",
      elementi: [
        T("{categoria}", 25, 60, 160, 11, "#c9a227", "helvetica", "bold", "left"),
        T("{titolo}", 25, 72, 160, 32, "#ffffff", "helvetica", "bold", "left"),
        { tipo: "rettangolo", x: 25, y: 150, w: 40, h: 1.5, pieno: true, riempimento: "#c9a227", spessore: 0 },
        T("{sottotitolo}", 25, 160, 160, 14, "#cfe3f5", "helvetica", "normal", "left"),
        T("{ente}", 25, 262, 160, 11, "#ffffff", "helvetica", "bold", "left"),
        T("{data}", 25, 271, 160, 10, "#cfe3f5", "helvetica", "normal", "left")
      ]
    })
  };
  const NOMI_PRESET = { istituzionale: "Istituzionale", classica: "Classica con cornice", scura: "Scura" };

  const NUOVO = {
    testo: { tipo: "testo", testo: "Nuovo testo", x: 30, y: 100, w: 150, size: 16, colore: "#0b1f38", font: "helvetica", stile: "normal", align: "left" },
    immagine: { tipo: "immagine", src: "", x: 75, y: 40, w: 60, h: 60, adatta: "contieni" },
    rettangolo: { tipo: "rettangolo", x: 0, y: 0, w: 210, h: 40, pieno: true, riempimento: "#0b3d6e", spessore: 0, bordo: "#000000" },
    linea: { tipo: "linea", x: 30, y: 150, x2: 180, y2: 150, colore: "#c9a227", spessore: 1 }
  };

  /* ---------- editor (HTML) ---------- */

  const campo = (et, inner) => `<label>${et}${inner}</label>`;
  const numIn = (k, v, step) => `<input type="number" data-f="${k}" value="${esc(v)}" step="${step || 1}" />`;
  const colIn = (k, v) => `<input type="color" data-f="${k}" value="${esc(v)}" />`;
  const sel = (k, opts, v) => `<select data-f="${k}">${Object.keys(opts).map(o =>
    `<option value="${o}" ${o === v ? "selected" : ""}>${opts[o]}</option>`).join("")}</select>`;
  const MOV = `
    <button type="button" class="redazione-btn redazione-btn--piccolo" data-cop-su title="Porta sotto/indietro">↓ sotto</button>
    <button type="button" class="redazione-btn redazione-btn--piccolo" data-cop-giu title="Porta sopra/avanti">↑ sopra</button>
    <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-cop-rimuovi title="Rimuovi elemento">✕</button>`;

  function htmlElemento(e) {
    let corpo = "";
    if (e.tipo === "testo") {
      corpo = `<label class="cop-largo">Testo (anche su più righe)<textarea data-f="testo" rows="2">${esc(e.testo)}</textarea></label>
        <div class="cop-riga">${campo("X (mm)", numIn("x", e.x, 0.5))}${campo("Y (mm)", numIn("y", e.y, 0.5))}${campo("Larghezza", numIn("w", e.w, 0.5))}${campo("Corpo (pt)", numIn("size", e.size, 0.5))}</div>
        <div class="cop-riga">${campo("Colore", colIn("colore", e.colore))}${campo("Carattere", sel("font", FONTS, e.font))}${campo("Stile", sel("stile", STILI, e.stile))}${campo("Allineamento", sel("align", ALLIN, e.align))}</div>`;
    } else if (e.tipo === "immagine") {
      corpo = `<label class="cop-largo">Immagine (link https://… o percorso nel sito, es. immagini/stemma.png)<input type="text" data-f="src" value="${esc(e.src)}" /></label>
        <div class="cop-riga">${campo("X (mm)", numIn("x", e.x, 0.5))}${campo("Y (mm)", numIn("y", e.y, 0.5))}${campo("Larghezza", numIn("w", e.w, 0.5))}${campo("Altezza", numIn("h", e.h, 0.5))}${campo("Adattamento", sel("adatta", ADATTA, e.adatta))}</div>`;
    } else if (e.tipo === "rettangolo") {
      corpo = `<div class="cop-riga">${campo("X (mm)", numIn("x", e.x, 0.5))}${campo("Y (mm)", numIn("y", e.y, 0.5))}${campo("Larghezza", numIn("w", e.w, 0.5))}${campo("Altezza", numIn("h", e.h, 0.5))}</div>
        <div class="cop-riga"><label class="cop-check"><input type="checkbox" data-f="pieno" ${e.pieno ? "checked" : ""} /> Riempimento</label>${campo("Colore riempimento", colIn("riempimento", e.riempimento))}${campo("Bordo (mm, 0 = nessuno)", numIn("spessore", e.spessore, 0.1))}${campo("Colore bordo", colIn("bordo", e.bordo))}</div>`;
    } else {
      corpo = `<div class="cop-riga">${campo("Da X", numIn("x", e.x, 0.5))}${campo("Da Y", numIn("y", e.y, 0.5))}${campo("A X", numIn("x2", e.x2, 0.5))}${campo("A Y", numIn("y2", e.y2, 0.5))}</div>
        <div class="cop-riga">${campo("Colore", colIn("colore", e.colore))}${campo("Spessore (mm)", numIn("spessore", e.spessore, 0.1))}</div>`;
    }
    return `<div class="cop-el" data-tipo="${e.tipo}"><div class="cop-el__barra"><strong>${TIPI[e.tipo]}</strong><span class="cop-spacer"></span>${MOV}</div>${corpo}</div>`;
  }

  function htmlCorpo(c) {
    return `
      <div class="cop-colonne">
        <div class="cop-pannello">
          <p class="cop-aiuto">Parti da un modello oppure componi da zero: gli elementi si possono trascinare nell'anteprima.
            Nei testi puoi usare i segnaposto <code>{titolo}</code> <code>{sottotitolo}</code> <code>{numero}</code> <code>{anno}</code>
            <code>{data}</code> <code>{categoria}</code> <code>{ente}</code>.</p>
          <div class="cop-preset"><strong>Modelli:</strong>${Object.keys(NOMI_PRESET).map(k =>
            `<button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-cop-preset="${k}">${NOMI_PRESET[k]}</button>`).join("")}
            <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-cop-preset="vuota">Pagina vuota</button></div>
          <div class="cop-riga">
            ${campo("Colore di sfondo", `<input type="color" data-cf="sfondo" value="${esc(c.sfondo)}" />`)}
            <label class="cop-largo">Immagine di sfondo a tutta pagina (facoltativa)<input type="text" data-cf="immagineSfondo" value="${esc(c.immagineSfondo)}" placeholder="https://… oppure immagini/sfondo.jpg" /></label>
          </div>
          <div class="cop-riga">
            <label class="cop-check"><input type="checkbox" data-cf="nascondiBarra" ${c.nascondiBarra ? "checked" : ""} /> Nascondi in copertina la barra con il logo e la numerazione</label>
          </div>
          <div class="cop-riga">
            <label class="cop-check"><input type="checkbox" data-cf="cornAttiva" ${c.cornice.attiva ? "checked" : ""} /> Cornice</label>
            ${campo("Colore", `<input type="color" data-cf="cornColore" value="${esc(c.cornice.colore)}" />`)}
            ${campo("Spessore (mm)", `<input type="number" data-cf="cornSpessore" value="${esc(c.cornice.spessore)}" step="0.1" />`)}
            ${campo("Distanza dal bordo (mm)", `<input type="number" data-cf="cornMargine" value="${esc(c.cornice.margine)}" step="0.5" />`)}
          </div>
          <h4 style="margin:14px 0 8px;">Elementi <small style="font-weight:400;">(l'ultimo della lista sta sopra gli altri)</small></h4>
          <div data-cop-lista>${c.elementi.map(htmlElemento).join("")}</div>
          <div class="cop-aggiungi">${Object.keys(TIPI).map(k =>
            `<button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-cop-aggiungi="${k}">+ ${TIPI[k]}</button>`).join("")}</div>
        </div>
        <div class="cop-anteprima">
          <div class="cop-pagina-wrap"><div class="cop-pagina" data-cop-pagina></div></div>
          <small>Anteprima indicativa (A4). Il PDF usa caratteri standard: Sans-serif, Serif, Monospazio.</small>
        </div>
      </div>`;
  }

  function htmlEditor(c) {
    c = normalizza(c);
    return `
      <div class="cop-ed ${c.attiva ? "" : "cop-ed--off"}" data-cop>
        <label class="cop-check cop-attiva"><input type="checkbox" data-cf="attiva" ${c.attiva ? "checked" : ""} /> Usa una copertina personalizzata nel PDF</label>
        <div class="cop-corpo" data-cop-corpo>${htmlCorpo(c)}</div>
      </div>`;
  }

  /* ---------- lettura dell'editor ---------- */

  function leggi(radice) {
    const g = k => radice.querySelector(`[data-cf="${k}"]`);
    const elementi = [...radice.querySelectorAll("[data-cop-lista] > .cop-el")].map(div => {
      const o = { tipo: div.dataset.tipo };
      div.querySelectorAll("[data-f]").forEach(i => { o[i.dataset.f] = i.type === "checkbox" ? i.checked : i.value; });
      return normEl(o);
    }).filter(Boolean);
    return normalizza({
      attiva: g("attiva").checked,
      sfondo: g("sfondo").value,
      immagineSfondo: g("immagineSfondo").value,
      nascondiBarra: g("nascondiBarra").checked,
      cornice: { attiva: g("cornAttiva").checked, colore: g("cornColore").value, spessore: g("cornSpessore").value, margine: g("cornMargine").value },
      elementi
    });
  }

  /* ---------- anteprima ---------- */

  function anteprima(pagina, c, vars) {
    const px = v => (v * S).toFixed(2) + "px";
    let h = "";
    const bg = urlSicuro(c.immagineSfondo);
    if (bg) h += `<img src="${esc(bg)}" alt="" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`;
    c.elementi.forEach((e, i) => {
      const base = `class="cop-p-el" data-i="${i}"`;
      if (e.tipo === "testo") {
        h += `<div ${base} style="left:${px(e.x)};top:${px(e.y)};width:${px(e.w)};font-size:${(e.size * 0.3528 * S).toFixed(2)}px;line-height:1.25;color:${e.colore};` +
          `font-family:${CSS_FONT[e.font]};font-weight:${/bold/.test(e.stile) ? 700 : 400};font-style:${/italic/.test(e.stile) ? "italic" : "normal"};text-align:${e.align};white-space:pre-wrap;overflow-wrap:anywhere;">${esc(sost(e.testo, vars))}</div>`;
      } else if (e.tipo === "immagine") {
        const src = urlSicuro(sost(e.src, vars));
        h += `<div ${base} style="left:${px(e.x)};top:${px(e.y)};width:${px(e.w)};height:${px(e.h)};${src ? "" : "border:1px dashed #8aa;"}">` +
          (src ? `<img src="${esc(src)}" alt="" draggable="false" style="width:100%;height:100%;object-fit:${e.adatta === "riempi" ? "cover" : "contain"};pointer-events:none;" onerror="this.style.display='none'">` : "") + `</div>`;
      } else if (e.tipo === "rettangolo") {
        h += `<div ${base} style="left:${px(e.x)};top:${px(e.y)};width:${px(e.w)};height:${px(e.h)};` +
          `${e.pieno ? "background:" + e.riempimento + ";" : ""}${e.spessore > 0 ? `border:${px(e.spessore)} solid ${e.bordo};box-sizing:border-box;` : ""}"></div>`;
      } else {
        const dx = e.x2 - e.x, dy = e.y2 - e.y, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
        h += `<div ${base} style="left:${px(e.x)};top:${px(e.y)};width:${px(len)};height:${Math.max(3, e.spessore * S).toFixed(2)}px;` +
          `background:${e.colore};transform-origin:0 0;transform:rotate(${ang.toFixed(3)}deg);"></div>`;
      }
    });
    if (c.cornice.attiva) {
      h += `<div style="position:absolute;pointer-events:none;left:${px(c.cornice.margine)};top:${px(c.cornice.margine)};right:${px(c.cornice.margine)};bottom:${px(c.cornice.margine)};` +
        `border:${px(c.cornice.spessore)} solid ${c.cornice.colore};box-sizing:border-box;"></div>`;
    }
    pagina.style.width = px(PW); pagina.style.height = px(PH); pagina.style.background = c.sfondo;
    pagina.innerHTML = h;
  }

  /* ---------- collegamento eventi ---------- */

  // radice: l'elemento [data-cop]; getVars: () => oggetto con i valori dei segnaposto (per l'anteprima)
  function collega(radice, getVars) {
    const pagina = () => radice.querySelector("[data-cop-pagina]");
    const disegna = () => anteprima(pagina(), leggi(radice), getVars ? getVars() : {});

    radice.addEventListener("input", disegna);
    radice.addEventListener("change", e => {
      if (e.target.matches('[data-cf="attiva"]')) radice.classList.toggle("cop-ed--off", !e.target.checked);
      disegna();
    });
    // Invio dentro un campo non deve salvare l'intero modulo
    radice.addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault();
    });

    radice.addEventListener("click", e => {
      const t = e.target;
      const lista = radice.querySelector("[data-cop-lista]");

      const agg = t.closest("[data-cop-aggiungi]");
      if (agg) { lista.insertAdjacentHTML("beforeend", htmlElemento(normEl(NUOVO[agg.dataset.copAggiungi]))); disegna(); return; }

      const el = t.closest(".cop-el");
      if (el && t.closest("[data-cop-rimuovi]")) { el.remove(); disegna(); return; }
      if (el && t.closest("[data-cop-su]") && el.previousElementSibling) { lista.insertBefore(el, el.previousElementSibling); disegna(); return; }
      if (el && t.closest("[data-cop-giu]") && el.nextElementSibling) { lista.insertBefore(el.nextElementSibling, el); disegna(); return; }

      const pre = t.closest("[data-cop-preset]");
      if (pre) {
        if (lista.children.length && !confirm("Sostituire la copertina attuale con questo modello?")) return;
        const nome = pre.dataset.copPreset;
        const nuova = normalizza(nome === "vuota" ? {} : PRESET[nome]());
        radice.querySelector("[data-cop-corpo]").innerHTML = htmlCorpo(nuova);
        disegna();
      }
    });

    // Trascinamento degli elementi nell'anteprima
    radice.addEventListener("pointerdown", ev => {
      const elP = ev.target.closest(".cop-p-el");
      if (!elP || !radice.contains(elP)) return;
      const item = radice.querySelectorAll("[data-cop-lista] > .cop-el")[+elP.dataset.i];
      if (!item) return;
      const inp = k => item.querySelector(`[data-f="${k}"]`);
      const chiavi = ["x", "y", "x2", "y2"].filter(k => inp(k));
      const orig = {}; chiavi.forEach(k => { orig[k] = num(inp(k).value, 0); });
      const sx = ev.clientX, sy = ev.clientY, l0 = parseFloat(elP.style.left), t0 = parseFloat(elP.style.top);
      ev.preventDefault();
      try { elP.setPointerCapture(ev.pointerId); } catch (e) {}
      const mv = m => {
        const dx = Math.round((m.clientX - sx) / S * 2) / 2, dy = Math.round((m.clientY - sy) / S * 2) / 2;
        chiavi.forEach(k => { inp(k).value = orig[k] + (k[0] === "x" ? dx : dy); });
        elP.style.left = (l0 + dx * S) + "px"; elP.style.top = (t0 + dy * S) + "px";
      };
      const su = () => { elP.removeEventListener("pointermove", mv); elP.removeEventListener("pointerup", su); disegna(); };
      elP.addEventListener("pointermove", mv);
      elP.addEventListener("pointerup", su);
    });

    disegna();
  }

  window.Copertina = { normalizza, htmlEditor, collega, leggi, anteprima, _preset: PRESET };
})();