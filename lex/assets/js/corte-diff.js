// assets/js/corte-diff.js
// Modulo condiviso (browser + server): confronto tra due versioni degli articoli di un atto.
// Nel browser espone window.CorteDiff; su Node si usa con require().
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CorteDiff = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const esc = t => (t == null ? "" : String(t)).replace(/[&<>"']/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const soloTesto = t => (t == null ? "" : String(t)).replace(/<[^>]+>/g, "");
  const eTitolo = a => !!a && a.tipo === "titolo";

  // Commi di un articolo (compatibile con gli atti vecchi che hanno solo "testo").
  function commiDi(art) {
    if (art && Array.isArray(art.commi) && art.commi.length) {
      return art.commi.map(c => ({
        testo: (c.testo || "").trim(),
        sottocommi: (c.sottocommi || []).map(s => (s || "").trim()).filter(Boolean)
      }));
    }
    return [{ testo: ((art && art.testo) || "").trim(), sottocommi: [] }];
  }

  const chiaveArt = a => String(a.numero == null ? "" : a.numero).trim();
  const firma = a => JSON.stringify({ r: (a.rubrica || "").trim(), c: commiDi(a) });

  function istantanea(a) {
    return { numero: chiaveArt(a), rubrica: (a.rubrica || "").trim(), commi: commiDi(a) };
  }

  // Confronta due elenchi di articoli/titoli. Il riordino non è considerato una modifica.
  function diffArticoli(prima, dopo) {
    prima = prima || []; dopo = dopo || [];
    const out = [];
    const mapPrima = new Map(), mapDopo = new Map();
    prima.filter(a => !eTitolo(a)).forEach(a => { if (!mapPrima.has(chiaveArt(a))) mapPrima.set(chiaveArt(a), a); });
    dopo.filter(a => !eTitolo(a)).forEach(a => { if (!mapDopo.has(chiaveArt(a))) mapDopo.set(chiaveArt(a), a); });

    mapPrima.forEach((a, k) => {
      const b = mapDopo.get(k);
      if (!b) out.push({ azione: "soppresso", riferimento: "Art. " + k, numero: k, prima: istantanea(a), dopo: null });
      else if (firma(a) !== firma(b)) out.push({ azione: "modificato", riferimento: "Art. " + k, numero: k, prima: istantanea(a), dopo: istantanea(b) });
    });
    mapDopo.forEach((b, k) => {
      if (!mapPrima.has(k)) out.push({ azione: "aggiunto", riferimento: "Art. " + k, numero: k, prima: null, dopo: istantanea(b) });
    });

    const tPrima = prima.filter(eTitolo).map(t => (t.testo || "").trim());
    const tDopo = dopo.filter(eTitolo).map(t => (t.testo || "").trim());
    tPrima.filter(t => !tDopo.includes(t)).forEach(t => out.push({ azione: "titolo-soppresso", riferimento: t, testoTitolo: t }));
    tDopo.filter(t => !tPrima.includes(t)).forEach(t => out.push({ azione: "titolo-aggiunto", riferimento: t, testoTitolo: t }));
    return out;
  }

  // Evidenziazione per parole (LCS): restituisce HTML con <del> nella versione "prima" e <ins> in quella "dopo".
  function htmlDiff(a, b) {
    const A = soloTesto(a).split(/(\s+)/).filter(x => x !== "");
    const B = soloTesto(b).split(/(\s+)/).filter(x => x !== "");
    if (A.length * B.length > 600000) return { prima: esc(soloTesto(a)), dopo: esc(soloTesto(b)) };
    const n = A.length, m = B.length;
    const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0, p = "", d = "";
    while (i < n && j < m) {
      if (A[i] === B[j]) { p += esc(A[i]); d += esc(B[j]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { p += "<del>" + esc(A[i]) + "</del>"; i++; }
      else { d += "<ins>" + esc(B[j]) + "</ins>"; j++; }
    }
    while (i < n) p += "<del>" + esc(A[i++]) + "</del>";
    while (j < m) d += "<ins>" + esc(B[j++]) + "</ins>";
    return { prima: p, dopo: d };
  }

  // Testo di un articolo (rubrica + commi) in forma lineare, per mostrarlo e confrontarlo.
  function righeArticolo(snap) {
    if (!snap) return [];
    const r = [];
    snap.commi.forEach((c, ic) => {
      const pref = snap.commi.length > 1 ? (ic + 1) + ". " : "";
      r.push(pref + c.testo);
      c.sottocommi.forEach((s, is) => r.push("   " + String.fromCharCode(97 + (is % 26)) + ") " + s));
    });
    return r;
  }

  return { esc, soloTesto, eTitolo, commiDi, diffArticoli, htmlDiff, righeArticolo };
});
