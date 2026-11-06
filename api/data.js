// Vercel Serverless Function: legge un JSON dal repo privato RETEFORLIVESE/DATA
// e lo restituisce al browser, senza mai esporre il token.
// In piu': con ?cerca=1 fa da motore di ricerca su EWS, IMG e DATA (vedi cercaTutto).
//
// Variabili d'ambiente (Vercel > Project > Settings > Environment Variables):
//   GITHUB_TOKEN  (obbligatoria)  token fine-grained con sola lettura "Contents" sul repo DATA
//   DATA_REPO     (facoltativa)   default "RETEFORLIVESE/DATA"
//   DATA_BRANCH   (facoltativa)   default: il ramo predefinito del repo
//   _ACCESS_KEY   (facoltativa)   se impostata, la ricerca richiede ?k=<chiave>
//   SITO_IMG      (facoltativa)   indirizzo online delle immagini (default: lo stesso di NormAktiv)
const ALLOWED = ['atti.json', 'ctsu.json', 'elezioni.json', 'organi.json'];   // unitext.json NON va qui: contiene le bozze, UniText si legge solo da /api/unitext

// ---------------------------------------------------------------- RICERCA
const SITO = 'https://ews-rose.vercel.app';                 // dove vive NormAktiv (repo EWS)
const SITO_IMG = (process.env.SITO_IMG || SITO).replace(/\/+$/, '');   // dove vivono online le immagini (repo IMG)
const ICONA = process.env.SITO_LOGO || '';                   // ultima riserva per il logo (facoltativa); il logo vero si legge dall'HTML della pagina
const ICONA_SENTENZE = SITO + '/lex/CorteCostituzionale.png';   // favicon delle sentenze
const SCADENZA = 10 * 60 * 1000;                             // cache in memoria: 10 minuti
const ESCLUSI = ['unitext.json'];                            // bozze: mai nei risultati
const IGNORATI = /(^|\/)(node_modules|\.git|\.github|api)\//i;   // cartelle tecniche: mai nei risultati
const JSONF = /\.(json|jsonl|geojson)$/i;                    // file JSON: mai nei risultati (i dati di DATA si cercano come schede)
const SCRIPT = /\.(m?js|cjs|jsx|tsx?|css|scss|sass|less|map)$/i;   // codice e stili (.js, .css...): mai cercati, mai letti, mai nei risultati
// Dati di DATA che si cercano come "schede": ognuna descrive dove sta la lista nel JSON,
// come si presenta il risultato e a quale pagina del SITO rimanda.
const via = (...v) => v.filter(Boolean).join(' · ');
const DATASET = {
  'atti.json': {
    chiave: 'atti', tipo: 'atto', allegati: true, label: 'Apri su NormAktiv', pagina: '/lex/atto.html',
    scheda: (it) => ({
      name: it.titolo || it.nome || it.id,
      path: via(it.categoria, it.numero && it.anno ? 'n. ' + it.numero + '/' + it.anno : '', it.stato),
      snippet: it.sommario || it.descrizione || '',
      url: SITO + '/lex/atto.html?id=' + encodeURIComponent(it.id),
    }),
  },
  'progetti.json': {
    chiave: 'progetti', tipo: 'progetto', label: 'Apri su NormAktiv', pagina: '/lex/progetto.html',
    scheda: (it) => ({
      name: it.titolo || it.nome || it.id,
      path: via(it.categoria, it.numero && it.anno ? 'n. ' + it.numero + '/' + it.anno : '', it.stato),
      snippet: it.sommario || it.descrizione || '',
      url: SITO + '/lex/progetto.html?id=' + encodeURIComponent(it.id),
    }),
  },
  'ctsu.json': {                                             // progetti del CTSU -> /lex/ctsu.html?id=<id>
    chiave: 'progetti', tipo: 'progetto', label: 'Apri sul CTSU', pagina: '/lex/ctsu.html',
    escludi: ['copertina', 'galleria'], html: true,          // niente indirizzi di immagini nel testo cercato; i tag HTML delle sezioni vengono tolti
    scheda: (it) => ({
      name: it.titolo || it.nome || it.id,
      path: via('CTSU', it.categoria, it.stato, it.organo_responsabile),
      snippet: it.sommario || it.descrizione || '',
      url: SITO + '/lex/ctsu.html?id=' + encodeURIComponent(it.id),
    }),
  },
  'wiki.json': {                                             // pagine della wiki -> /lex/wiki.html#id
    chiave: 'pagine', tipo: 'wiki', label: 'Apri sulla Wiki', pagina: '/lex/wiki.html',
    scheda: (it) => ({
      name: it.titolo || it.id,
      path: via(it.categoria, ...(Array.isArray(it.tag) ? it.tag : [])),
      snippet: it.sommario || '',
      url: SITO + '/lex/wiki.html#' + encodeURIComponent(it.id),
    }),
  },
  'elezioni.json': {                                         // consultazioni -> /CEPU.html?tipo=..&data=..&comune=..
    chiave: 'elezioni', tipo: 'elezione', label: 'Apri i risultati', pagina: '/CEPU.html',
    scheda: (it) => {
      const partiti = (it.risultati_partiti || []).map((p) => p.nome).filter(Boolean);
      return {
        name: via(it.tipo, it.comune, it.data),
        path: via(it.data, it.affluenza ? 'affluenza ' + it.affluenza : '', it.id_organo),
        snippet: via(it.area, it.candidato_vincente ? 'Vincitore: ' + it.candidato_vincente : '', partiti.length ? partiti.join(', ') : ''),
        url: SITO + '/CEPU.html?' + new URLSearchParams({ tipo: it.tipo_codice || '', data: it.data || '', comune: it.comune || '' }).toString(),
      };
    },
  },
};

// prima immagine (https) di un testo markdown: ![](https://...)
// testo "da leggere" di una scheda: niente link, immagini o marcatori wiki (per cercare e per mostrare l'estratto)
const testoPulito = (s) => String(s || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')                     // immagini markdown
  .replace(/\[([^\]]*)\]\(([^)]*)\)/g, '$1')                 // [testo](url) -> testo
  .replace(/https?:\/\/\S+/g, ' ')                           // indirizzi nudi
  .replace(/\{\{infobox[^\n]*\n?|\}\}|\[\[|\]\]|[#*{}|]/g, ' ')
  .replace(/\s+/g, ' ').trim();

// piccolo estratto attorno alla prima parola trovata
function estratto(plain, termini) {
  const basso = plain.toLowerCase();
  let i = -1;
  for (const t of termini) { i = basso.indexOf(t); if (i >= 0) break; }
  if (i < 0) return plain.slice(0, 160);
  const da = Math.max(0, i - 60);
  return (da > 0 ? '… ' : '') + plain.slice(da, da + 180) + (da + 180 < plain.length ? ' …' : '');
}

// ---- sentenze della Corte Costituzionale e dossier, scritti dentro atti.json ----
// Si riconoscono in 3 modi: (a) liste dentro ogni atto con una chiave tipo "sentenze", "dossier", "corte_costituzionale";
// (b) liste a livello alto del file (accanto a "atti"); (c) atti la cui categoria/tipo dice "sentenza" o "dossier".
const RX_ALLEGATI = /pronunc|sentenz|dossier|cortecost|corte_cost|corte-cost|consulta/i;   // nel tuo atti.json: "pronunce" (sentenze), "dossier" e "dossiers"
const NON_TESTO = (k, v) => (k === 'logo' || k === 'colore' || k === 'immagine' || k === 'contenuto' ? undefined : v);
const primo = (...v) => v.find((x) => typeof x === 'string' && x.trim()) || '';
const soloHttp = (s) => (/^https?:\/\//i.test(String(s || '').trim()) ? String(s).trim() : '');
const RUMORE = new Set(['copertina', 'creataIl', 'aggiornato', 'firmataDa', 'statoPrecedente', 'etichettaPrima', 'etichettaDopo', 'colore', 'livello', 'modifiche', 'marcaPdf']);
const testoDi = (o, escludi) => JSON.stringify(o, (k, v) => (escludi && escludi(k) ? undefined : NON_TESTO(k, v)), ' ').replace(/[{}\[\]":,]/g, ' ').replace(/\s+/g, ' ');

function classifica(it) {                                   // un atto che e' in realta' una sentenza o un dossier
  const c = [it.categoria, it.tipo, it.tipologia, it.fonte, it.organo].filter((x) => typeof x === 'string').join(' ');
  if (/dossier/i.test(c)) return 'dossier';
  if (/sentenz|corte\s*costituzionale/i.test(c)) return 'sentenza';
  return null;
}
const ETICHETTA = { sentenza: 'Sentenza', dossier: 'Dossier' };

// Pagine dedicate: la sentenza si apre da /lex/corte.html?id=<id della sentenza>,
// il dossier da /lex/dossier.html?id=<id dell'ATTO> (l'id interno del dossier, es. "principale", non basta: e' univoco solo dentro l'atto).
function urlAllegato(e, tipo, genitore) {
  if (tipo === 'sentenza' && e && e.id) return SITO + '/lex/corte.html?id=' + encodeURIComponent(e.id);
  if (tipo === 'dossier') {
    const idAtto = (genitore && genitore.id) || (e && (e.id_atto || e.atto_id || e.atto));
    if (idAtto) return SITO + '/lex/dossier.html?id=' + encodeURIComponent(idAtto);
  }
  return '';
}

function schedaAllegato(e, tipo, genitore, urlGenitore, cfg) {
  if (typeof e === 'string') e = soloHttp(e) ? { url: e } : { titolo: e };
  const nGen = genitore && (genitore.titolo || genitore.nome || genitore.id) ? String(genitore.titolo || genitore.nome || genitore.id) : '';
  const num = e.numero && e.anno ? 'n. ' + e.numero + '/' + e.anno : e.numero ? 'n. ' + e.numero : '';
  let name;
  if (tipo === 'sentenza') {                               // pronunce: "Sentenza n. 1/2026 — oggetto"
    const ogg = primo(e.oggetto, e.titolo, e.nome);
    name = ogg ? via('Sentenza ' + num, ogg).replace(' · ', ' — ') : via('Sentenza', num, nGen);
  } else {
    name = primo(e.titolo, e.nome, e.oggetto, e.denominazione) || via('Dossier', num, nGen);
  }
  const proprio = soloHttp(e.url || e.link || e.pdf || e.href);
  const plain = testoPulito(primo(e.testo, e.contenuto));
  const s = {
    name,
    path: tipo === 'sentenza'
      ? via('Corte Costituzionale', num, e.data || '', e.effetto || '', nGen ? 'in: ' + nGen : '')
      : via('Dossier', e.ente || '', e.data || '', nGen ? 'in: ' + nGen : ''),
    snippet: testoPulito(primo(e.massima, e.sommario, e.sintesi, e.presentazione, e.motivazione, e.descrizione, e.dispositivo, e.sottotitolo)),
    url: proprio || urlAllegato(e, tipo, genitore) || urlGenitore,
  };
  const labelPagina = tipo === 'sentenza' ? 'Apri sulla Corte Costituzionale' : tipo === 'dossier' ? 'Apri il dossier' : cfg.label;
  return { tipo, label: proprio ? 'Apri il documento' : labelPagina, s, plain, dati: testoDi(e, (k) => RUMORE.has(k)), proprio: !!proprio };
}

function allegatiDi(json, lista, cfg) {
  const out = [];
  const urlPagina = SITO + cfg.pagina;
  // (a) dentro ogni atto
  for (const it of lista) {
    for (const [k, v] of Object.entries(it)) {
      if (!RX_ALLEGATI.test(k) || v == null || v === '') continue;
      const els = Array.isArray(v) ? v : [v];
      const tipo = /dossier/i.test(k) ? 'dossier' : 'sentenza';
      for (const e of els) if (e && (typeof e === 'object' || typeof e === 'string')) out.push(schedaAllegato(e, tipo, it, cfg.scheda(it).url, cfg));
    }
  }
  // (b) liste a livello alto del file
  if (json && !Array.isArray(json)) {
    for (const [k, v] of Object.entries(json)) {
      if (k === cfg.chiave || !Array.isArray(v) || !RX_ALLEGATI.test(k)) continue;
      const tipo = /dossier/i.test(k) ? 'dossier' : 'sentenza';
      for (const e of v) {
        const idg = e && typeof e === 'object' ? e.id_atto || e.atto_id || e.atto : '';
        const gen = idg ? lista.find((a) => a.id === idg) : null;
        out.push(schedaAllegato(e, tipo, gen, gen ? cfg.scheda(gen).url : urlPagina, cfg));
      }
    }
  }
  return out;
}

const memoria = {};

const nomeFile = (p) => p.split('/').pop().toLowerCase();
const datasetDi = (p) => DATASET[nomeFile(p)];
const escluso = (p) => ESCLUSI.includes(nomeFile(p)) || SCRIPT.test(p) || JSONF.test(p) || IGNORATI.test(p);

// indirizzo pubblico sul SITO (non sulla repo): lex/atto.html -> https://sito/lex/atto.html
// (index.html diventa la cartella: lex/index.html -> https://sito/lex/)
function urlSito(base, p) {
  const pulito = p.replace(/(^|\/)index\.html?$/i, '$1');
  return base + '/' + pulito.split('/').map(encodeURIComponent).join('/');
}

// nome leggibile: "legge-regionale_2024.html" -> "legge regionale 2024"
const nomeBello = (p) => {
  const f = p.split('/').pop().replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return f || p.split('/').pop();
};

function intestazioni(raw) {
  const h = {
    Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
    'User-Agent': 'ews-data-proxy',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;
  return h;
}

async function inMemoria(chiave, calcola) {
  const c = memoria[chiave];
  if (c && Date.now() - c.t < SCADENZA) return c.v;
  const v = await calcola();
  memoria[chiave] = { t: Date.now(), v };
  return v;
}

const tipoFile = (p) =>
  /\.(png|apng|jpe?g|jfif|gif|webp|svg|avif|bmp|ico)$/i.test(p) ? 'img' :
  /\.html?$/i.test(p) ? 'pagina' :
  /\.(pdf|docx?|txt|md)$/i.test(p) ? 'documento' :
  /\.(json|csv|xlsx?|geojson)$/i.test(p) ? 'dato' : 'altro';

function elencoFile(repo) {
  return inMemoria('albero:' + repo, async () => {
    const ramo = repo === dataRepo() && process.env.DATA_BRANCH ? process.env.DATA_BRANCH : 'HEAD';
    const r = await fetch('https://api.github.com/repos/' + repo + '/git/trees/' + encodeURIComponent(ramo) + '?recursive=1', { headers: intestazioni(false) });
    if (!r.ok) throw new Error(repo + ': GitHub ' + r.status);
    return (await r.json()).tree.filter((n) => n.type === 'blob').map((n) => n.path);
  });
}

const dataRepo = () => process.env.DATA_REPO || 'RETEFORLIVESE/DATA';

async function cercaNeiDataset(repo, termini) {
  const risultati = [];
  const ref = process.env.DATA_BRANCH ? '?ref=' + encodeURIComponent(process.env.DATA_BRANCH) : '';
  const file = (await elencoFile(repo)).filter(datasetDi);
  for (const percorso of file) {
    const cfg = datasetDi(percorso);
    const schede = await inMemoria('ds:' + percorso, async () => {
      const r = await fetch('https://api.github.com/repos/' + repo + '/contents/' + encodeURI(percorso) + ref, { headers: intestazioni(true) });
      if (!r.ok) throw new Error(percorso + ': GitHub ' + r.status);
      const json = await r.json();
      const lista = Array.isArray(json) ? json : json[cfg.chiave] || [];
      const nested = (k) => (cfg.allegati && RX_ALLEGATI.test(k)) || (cfg.escludi && cfg.escludi.includes(k));   // sentenze/dossier sono risultati a parte; copertina/galleria non sono testo
      const voci = lista.map((it) => {
        const s = cfg.scheda(it);
        const plain = testoPulito(it.contenuto);
        const dati = cfg.html ? testoDi(it, nested).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : testoDi(it, nested);
        return {
          tipo: (cfg.allegati && classifica(it)) || cfg.tipo, label: cfg.label, proprio: false,
          s, plain,
          titolo: String(s.name || '').toLowerCase(),
          sommario: String(s.snippet || '').toLowerCase(),
          testo: (s.name + ' ' + s.path + ' ' + dati + ' ' + plain + ' ' + (it.numero || '') + '/' + (it.anno || '')).toLowerCase(),
        };
      });
      if (cfg.allegati) {
        for (const a of allegatiDi(json, lista, cfg)) {
          voci.push({
            tipo: a.tipo, label: a.label, proprio: a.proprio, s: a.s, plain: a.plain,
            titolo: String(a.s.name || '').toLowerCase(),
            sommario: String(a.s.snippet || '').toLowerCase(),
            testo: (a.s.name + ' ' + a.s.path + ' ' + a.dati + ' ' + a.plain).toLowerCase(),
          });
        }
      }
      return voci;
    });
    for (const { tipo, label, proprio, s, plain, titolo, sommario, testo } of schede) {
      if (!termini.every((t) => testo.includes(t))) continue;
      let score = 20;
      for (const t of termini) score += titolo.includes(t) ? 20 : sommario.includes(t) ? 8 : 0;
      risultati.push({
        repo: 'DATA',
        type: tipo,
        name: s.name,
        path: s.path,
        snippet: s.snippet || estratto(plain, termini),
        url: s.url,
        label,
        icon: '',
        _url: s.url.startsWith(SITO) ? SITO + cfg.pagina : '', _rp: cfg.pagina.slice(1),   // pagina da cui leggere il logo
        score,
      });
    }
  }
  return risultati;
}

async function cercaNellaRepo(nome, repo, termini, q, soloImg) {
  const trovati = new Map();
  const file = (await elencoFile(repo)).filter((p) => !datasetDi(p) && !escluso(p) && !(soloImg && tipoFile(p) !== 'img'));   // atti/progetti = schede; bozze, script, JSON e cartelle tecniche = mai
  // variabili delle pagine del sito EWS (nome, descrizione, tag): lette dal loro <head>
  const infos = new Map();
  if (nome === 'EWS' && !soloImg) {
    const pagine = file.filter((p) => tipoFile(p) === 'pagina').slice(0, 300);
    await inParallelo(pagine, 8, async (p) => { const i = await infoPagina(urlSito(SITO, p), p); if (i) infos.set(p, i); });
  }
  for (const p of file) {
    const basso = p.toLowerCase();
    const i = infos.get(p);
    const extra = i ? (i.nome + ' ' + i.descrizione + ' ' + i.tag.join(' ')).toLowerCase() : '';
    if (termini.every((t) => basso.includes(t) || extra.includes(t))) {
      const f = nomeFile(p);
      const sc = 10 + termini.filter((t) => f.includes(t)).length * 5
        + (i ? termini.filter((t) => i.nome.toLowerCase().includes(t)).length * 8 + termini.filter((t) => i.tag.some((g) => g.toLowerCase().includes(t))).length * 6 : 0);
      trovati.set(p, { path: p, score: sc });
    }
  }
  if (nome !== 'IMG' && !soloImg) {                          // ricerca nel contenuto: non serve per le immagini
    try {
      const r = await fetch('https://api.github.com/search/code?per_page=30&q=' + encodeURIComponent(q) + '+repo:' + repo, { headers: intestazioni(false) });
      if (r.ok) {
        for (const it of (await r.json()).items || []) {
          if (datasetDi(it.path) || escluso(it.path)) continue;
          const gia = trovati.get(it.path);
          if (gia) gia.score += 3; else trovati.set(it.path, { path: it.path, score: 4 });
        }
      }
    } catch (_) { /* la ricerca nel contenuto e' facoltativa */ }
  }
  return [...trovati.values()].filter((o) => !(infos.get(o.path) || {}).nascondi).map((o) => {
    const tipo = tipoFile(o.path);
    const info = infos.get(o.path);
    // EWS e IMG: si apre il SITO online. DATA e' privata e non ha un sito: resta il link alla repo.
    const sulSito = nome === 'EWS' ? urlSito(SITO, o.path) : nome === 'IMG' ? urlSito(SITO_IMG, o.path) : null;
    return {
      repo: nome,
      path: o.path,
      score: o.score,
      name: (info && info.nome) || (tipo === 'pagina' || tipo === 'documento' ? nomeBello(o.path) : o.path.split('/').pop()),
      descrizione: (info && info.descrizione) || o.path,    // riga grigia sotto il titolo: di base il percorso
      tags: info ? info.tag : [],
      file: o.path.split('/').pop(),
      type: tipo,
      url: sulSito || 'https://github.com/' + repo + '/blob/HEAD/' + o.path,
      label: sulSito ? (tipo === 'img' ? 'Apri immagine' : 'Apri pagina') : '',
      raw: tipo === 'img' ? sulSito : null,               // anteprima: dal sito
      // anteprima di riserva se il sito non serve il file (le immagini del sito e di IMG sono anche su GitHub)
      alt: tipo === 'img' && sulSito ? 'https://raw.githubusercontent.com/' + repo + '/HEAD/' + o.path.split('/').map(encodeURIComponent).join('/') : '',
      icon: '',
      _url: sulSito && tipo === 'pagina' ? sulSito : '', _rp: o.path,   // pagina da cui leggere il logo
    };
  });
}

// ---------------------------------------------------------------- LOGO DELLA PAGINA
// Si legge l'HTML della pagina che si apre e si prende il <link rel="icon"> (poi apple-touch-icon).
function iconaDaHtml(html, base) {
  const tag = String(html).slice(0, 80000).match(/<link\b[^>]*>/gi) || [];
  let scelta = '', apple = '';
  for (const t of tag) {
    const a = {};
    t.replace(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, k, d, s, n) => { a[k.toLowerCase()] = d ?? s ?? n; return ''; });
    const rel = String(a.rel || '').toLowerCase().split(/\s+/);          // "shortcut icon" -> ['shortcut','icon']
    const ic = rel.includes('icon'), ap = rel.includes('apple-touch-icon');
    if (!a.href || (!ic && !ap)) continue;
    const href = String(a.href).trim().replace(/&amp;/g, '&');
    let url;
    if (/^data:image\//i.test(href)) { if (href.length > 4000) continue; url = href; }      // icona incorporata nella pagina
    else { try { url = new URL(href, base).href; } catch (_) { continue; } if (!/^https?:/i.test(url)) continue; }
    if (ic && !scelta) scelta = url; else if (ap && !apple) apple = url;
  }
  return scelta || apple;
}

// HTML della pagina: prima dal sito online, poi (se non risponde) dal repo EWS
async function htmlDi(url, percorsoRepo) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'ews-data-proxy', Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(3000) });
    if (r.ok) return { html: await r.text(), base: r.url || url };
  } catch (_) { /* si prova il repo */ }
  if (percorsoRepo) {
    try {
      const org = dataRepo().split('/')[0];
      const r = await fetch('https://api.github.com/repos/' + org + '/EWS/contents/' + percorsoRepo.split('/').map(encodeURIComponent).join('/'),
        { headers: intestazioni(true), signal: AbortSignal.timeout(3000) });
      if (r.ok) return { html: await r.text(), base: url };
    } catch (_) { /* nessun logo */ }
  }
  return null;
}
// ---- variabili della pagina, scritte nel suo <head>:
//   <meta name="ews-nome" content="UniText">                     nome mostrato nella ricerca
//   <meta name="ews-descrizione" content="Bozze e testi">        riga grigia sotto il titolo (se manca: il percorso, es. lex/unitext.html)
//   <meta name="ews-tag" content="uni, testi, bozze">            parole extra per trovare la pagina (separate da virgola o ;)
//   <meta name="ews-nascondi" content="true">                    la pagina non compare mai nei risultati
const decodifica = (s) => String(s).replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
function metaDaHtml(html) {
  const out = { nome: '', descrizione: '', tag: [], nascondi: false };
  const tag = String(html).slice(0, 80000).match(/<meta\b[^>]*>/gi) || [];
  for (const t of tag) {
    const a = {};
    t.replace(/([a-zA-Z:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g, (_, k, dq, sq, n) => { a[k.toLowerCase()] = dq ?? sq ?? n; return ''; });
    const nome = String(a.name || '').toLowerCase();
    if (a.content == null) continue;
    const v = decodifica(a.content);
    if (nome === 'ews-nome') out.nome = v;
    else if (nome === 'ews-descrizione') out.descrizione = v;
    else if (nome === 'ews-nascondi') out.nascondi = /^(true|1|si|sì|yes)$/i.test(v);
    else if (nome === 'ews-tag') out.tag = v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  }
  return out;
}
// icona + variabili di una pagina: si legge l'HTML una volta sola (cache 10 minuti)
const infoPagina = (url, percorsoRepo) => inMemoria('info:' + url, async () => {
  const h = await htmlDi(url, percorsoRepo);
  return h ? { icon: iconaDaHtml(h.html, h.base), ...metaDaHtml(h.html) } : null;
});
const logoDi = async (url, percorsoRepo) => (await infoPagina(url, percorsoRepo))?.icon || '';

// esegue lavori con al massimo n richieste in parallelo
async function inParallelo(lista, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, async () => {
    while (i < lista.length) { const x = lista[i++]; try { await fn(x); } catch (_) { /* pagina non leggibile: si usano i valori di base */ } }
  }));
}

// assegna a ogni risultato il logo letto dalla SUA pagina; se non c'e', quello della home del sito
async function arricchisciIcone(lista) {
  const bersagli = new Map();                                // pagina -> percorso nel repo (massimo 30 pagine diverse per ricerca)
  for (const d of lista) if (d._url && !bersagli.has(d._url) && bersagli.size < 30) bersagli.set(d._url, d._rp);
  const trovate = new Map();
  const [logoHome] = await Promise.all([
    logoDi(SITO + '/', 'index.html'),
    ...[...bersagli].map(async ([u, p]) => { trovate.set(u, await logoDi(u, p)); }),
  ]);
  for (const d of lista) {
    const delSito = d.url.startsWith(SITO) || d.url.startsWith(SITO_IMG);
    d.icon = d.type === 'img' ? '' : (d._url && trovate.get(d._url)) || (delSito ? logoHome : '') || (delSito ? ICONA : '');
    if (d.type === 'sentenza') d.icon = ICONA_SENTENZE;          // le sentenze usano sempre il logo della Corte Costituzionale
    delete d._url; delete d._rp;
  }
}

const PRIORITA = { pagina: 0, wiki: 1, progetto: 2, elezione: 2, documento: 2, img: 2, atto: 3, sentenza: 3, dossier: 3, dato: 4, altro: 4 };

async function cercaTutto(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const chiave = process.env._ACCESS_KEY;
    if (chiave && req.query.k !== chiave) return res.status(401).json({ error: 'Chiave non valida' });

    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.status(400).json({ error: 'Scrivi almeno 2 caratteri' });
    const termini = q.toLowerCase().split(/\s+/);

    const repoData = dataRepo();
    const org = repoData.split('/')[0];
    const tutte = { EWS: org + '/EWS', IMG: org + '/IMG', DATA: repoData };
    const voluta = String(req.query.repo || 'all').toUpperCase();
    // ?tipo=img = sezione Immagini: tutte le immagini di EWS e IMG (DATA e' privata e non ha un sito: niente anteprime)
    const soloImg = String(req.query.tipo || '').toLowerCase() === 'img';
    const nomi = Object.keys(tutte).filter((n) => (voluta === 'ALL' || n === voluta) && !(soloImg && n === 'DATA'));

    const lavori = nomi.map((n) => cercaNellaRepo(n, tutte[n], termini, q, soloImg));
    if (!soloImg && nomi.includes('DATA')) lavori.push(cercaNeiDataset(repoData, termini));
    const esiti = await Promise.allSettled(lavori);

    const results = esiti.flatMap((e) => (e.status === 'fulfilled' ? e.value : []));
    const errors = esiti.filter((e) => e.status === 'rejected').map((e) => e.reason.message);
    // i siti (pagine) vengono per primi; atti, sentenze e dossier in fondo; a parita' di gruppo conta il punteggio
    results.sort((a, b) => (PRIORITA[a.type] ?? 4) - (PRIORITA[b.type] ?? 4) || b.score - a.score || String(a.name).localeCompare(String(b.name)));
    const fuori = results.slice(0, soloImg ? 400 : 200);
    if (!soloImg) await arricchisciIcone(fuori);              // logo della pagina (letto dal suo HTML)
    else fuori.forEach((d) => { delete d._url; delete d._rp; });
    res.status(200).json({ count: results.length, results: fuori, errors });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ---------------------------------------------------------------- LETTURA JSON (invariata)
module.exports = async (req, res) => {
  if (req.query && req.query.cerca) return cercaTutto(req, res);

  const wanted = String((req.query && req.query.file) || '').toLowerCase();
  if (!ALLOWED.includes(wanted)) {
    res.status(400).json({ error: 'file non consentito' });
    return;
  }
  const repo = process.env.DATA_REPO || 'RETEFORLIVESE/DATA';
  const ref = process.env.DATA_BRANCH ? '?ref=' + encodeURIComponent(process.env.DATA_BRANCH) : '';
  const headers = {
    Accept: 'application/vnd.github.raw+json',
    'User-Agent': 'ews-data-proxy',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = 'Bearer ' + process.env.GITHUB_TOKEN;

  // il nome nel repo puo' essere minuscolo o con la maiuscola iniziale
  const names = [wanted, wanted.charAt(0).toUpperCase() + wanted.slice(1)];
  for (const name of names) {
    const r = await fetch('https://api.github.com/repos/' + repo + '/contents/' + name + ref, { headers });
    if (r.ok) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      res.status(200).send(await r.text());
      return;
    }
  }
  res.status(502).json({ error: 'impossibile leggere il file dal repo dati' });
};