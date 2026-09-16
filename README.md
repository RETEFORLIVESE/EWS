# Normattiva di Fazione

Sito statico in stile "Normattiva" per raccogliere lo statuto, i regolamenti e i codici della tua fazione Minecraft. Grafica istituzionale (ispirata ai siti della Pubblica Amministrazione italiana) con fascia tricolore tra la testata e la barra di navigazione blu. Nessun server o database necessario: funziona interamente con file statici, pronto per **GitHub Pages**.

## 🚀 Pubblicare il sito (nessuna riga di codice da scrivere)

1. Crea un nuovo repository su GitHub (es. `normattiva-fazione`).
2. Carica **tutto il contenuto di questa cartella** nel repository (trascina i file dalla pagina "Add file → Upload files" su GitHub, oppure usa `git push`).
3. Nel repository vai su **Settings → Pages**.
4. In "Build and deployment", sotto "Source", scegli **Deploy from a branch**.
5. Seleziona il branch `main` e la cartella `/ (root)`, poi salva.
6. Dopo circa un minuto il sito sarà online all'indirizzo indicato in cima alla pagina Settings → Pages (di solito `https://tuonome.github.io/normattiva-fazione/`).

Non serve alcuna build: sono solo file HTML, CSS e JavaScript statici.

## ✏️ Personalizzare nome ed emblema

Apri `assets/js/config.js` e modifica:

- `nomeFazione` — il nome completo mostrato in testata
- `siglaFazione` — sigla breve
- `emblema` — le iniziali nel cerchio (max 3 caratteri)
- `motto` — il motto sotto il nome
- `annoFondazione` — anno mostrato nel footer
- `discord` / `sitoServer` — link opzionali nel footer

## 📜 Aggiungere o modificare le leggi

Tutti gli atti normativi si trovano in `assets/js/data.js`, nell'array `ATTI`. Ogni atto è un blocco così strutturato:

```js
{
  id: "id-univoco-senza-spazi",     // usato nell'URL (atto.html?id=...)
  categoria: "Regolamento",          // Statuto Costituzionale | Regolamento | Codice | Editto | Decreto
  numero: "8",
  anno: "2024",
  titolo: "Titolo dell'atto",
  dataEmanazione: "12 agosto 2024",
  promulgatoDa: "Comandante di Fazione",
  stato: "vigente",                  // "vigente" oppure "abrogato"
  sommario: "Breve descrizione dell'atto, mostrata in elenco.",
  articoli: [
    { numero: 1, rubrica: "Titolo dell'articolo", testo: "Testo dell'articolo." },
    { numero: 2, rubrica: "...", testo: "..." },
  ],
},
```

Per aggiungere un nuovo atto, copia un blocco esistente, incollalo nell'array e modificane i contenuti. Per creare una nuova categoria basta scrivere un nome diverso in `categoria`: comparirà automaticamente tra i filtri della home.

Per rimuovere un atto, elimina semplicemente il suo blocco.

## 🗂️ Struttura dei file

```
index.html                 → home page con ricerca ed elenco atti
atto.html                  → pagina di dettaglio di un singolo atto
assets/css/style.css       → tutto lo stile grafico del sito
assets/js/config.js        → nome fazione, motto, emblema (personalizza qui)
assets/js/data.js          → il testo delle leggi (personalizza qui)
assets/js/layout.js        → genera testata, fascia tricolore e footer
assets/js/main.js          → logica di ricerca e filtro della home
assets/js/atto.js          → logica della pagina di dettaglio atto
```

## 🎨 Cambiare i colori

I colori sono definiti come variabili in cima a `assets/css/style.css`, nel blocco `:root`. Cambiando ad esempio `--blu-700` e `--blu-800` si aggiorna automaticamente l'intero sito.
