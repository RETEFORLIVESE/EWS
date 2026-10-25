// api/_corte-diff.js — confronto tra due versioni degli articoli (copia lato server di assets/js/corte-diff.js:
// se cambi la logica di diffArticoli, aggiorna entrambi i file).
export const eTitolo = a => !!a && a.tipo === "titolo";

export function commiDi(art) {
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
const istantanea = a => ({ numero: chiaveArt(a), rubrica: (a.rubrica || "").trim(), commi: commiDi(a) });

export function diffArticoli(prima, dopo) {
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
