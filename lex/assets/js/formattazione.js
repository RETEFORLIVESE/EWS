// assets/js/formattazione.js
//
// Utility condivise per la struttura di commi e sottocommi degli articoli.
// Usato sia in lettura (atto.js) sia in scrittura (redazione.js), così che
// la logica di suddivisione del testo sia identica ovunque.
//
// Struttura di un articolo:
//   {
//     numero: "1",
//     rubrica: "Ambito di applicazione",
//     commi: [
//       { testo: "Testo del comma 1.", sottocommi: ["primo sottocomma", "secondo sottocomma"] },
//       { testo: "Testo del comma 2.", sottocommi: [] }
//     ]
//   }
//
// Compatibilità: gli atti vecchi salvati con un unico campo "testo" (senza
// "commi") continuano a funzionare: vengono suddivisi automaticamente al volo.

// Converte un indice progressivo in lettera (0 -> a, 1 -> b, ... 25 -> z, 26 -> aa, ...)
function letteraDa(indice) {
  let i = indice + 1, s = "";
  while (i > 0) {
    const resto = (i - 1) % 26;
    s = String.fromCharCode(97 + resto) + s;
    i = Math.floor((i - 1) / 26);
  }
  return s;
}

// Analizza un blocco di testo grezzo — una riga per comma/sottocomma, es.
//   1. Testo del primo comma
//   a) primo sottocomma
//   b) secondo sottocomma
//   2. Testo del secondo comma
// e lo trasforma nella struttura [{ testo, sottocommi[] }, ...].
// Le righe senza numerazione riconosciuta vengono accodate al comma corrente
// (continuazione del paragrafo); se non c'è ancora un comma aperto, ne aprono uno nuovo.
function analizzaTesto(testo) {
  const righe = (testo || "").split(/\r?\n/).map(r => r.trim()).filter(r => r !== "");
  if (righe.length === 0) return [{ testo: "", sottocommi: [] }];

  const reComma = /^(\d{1,3})[\.\)]\s*(.*)$/;
  const reSottocomma = /^([a-z]{1,2})[\.\)]\s*(.*)$/i;

  const commi = [];
  let commaCorrente = null;

  righe.forEach(riga => {
    const mComma = riga.match(reComma);
    const mSotto = !mComma ? riga.match(reSottocomma) : null;

    if (mComma) {
      commaCorrente = { testo: mComma[2], sottocommi: [] };
      commi.push(commaCorrente);
    } else if (mSotto && commaCorrente) {
      commaCorrente.sottocommi.push(mSotto[2]);
    } else if (commaCorrente) {
      commaCorrente.testo = commaCorrente.testo ? commaCorrente.testo + " " + riga : riga;
    } else {
      commaCorrente = { testo: riga, sottocommi: [] };
      commi.push(commaCorrente);
    }
  });

  return commi;
}

// Ricava l'elenco dei commi di un articolo, con compatibilità verso i vecchi
// atti salvati con un unico campo "testo" privo di struttura.
function commiDiArticolo(art) {
  if (Array.isArray(art.commi) && art.commi.length) return art.commi;
  if (art.testo) return analizzaTesto(art.testo);
  return [{ testo: "", sottocommi: [] }];
}
