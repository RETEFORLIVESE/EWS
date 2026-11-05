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
const SCADENZA = 10 * 60 * 1000;                             // cache in memoria: 10 minuti
const ESCLUSI = ['unitext.json'];                            // bozze: mai nei risultati
const IGNORATI = /(^|\/)(node_modules|\.git|\.github|api)\//i;   // cartelle tecniche: mai nei risultati
const SCRIPT = /\.(m?js|cjs|jsx|tsx?|css|scss|sass|less|map)$/i;   // codice e stili (.js, .css...): mai cercati, mai letti, mai nei risultati
// Dati di DATA che si cercano come "schede": ognuna descrive dove sta la lista nel JSON,
// come si presenta il risultato e a quale pagina del SITO rimanda.
const via = (...v) => v.filter(Boolean).join(' · ');
const DATASET = {
  'atti.json': {
    chiave: 'atti', tipo: 'atto', label: 'Apri su NormAktiv',
    scheda: (it) => ({
      name: it.titolo || it.nome || it.id,
      path: via(it.categoria, it.numero && it.anno ? 'n. ' + it.numero + '/' + it.anno : '', it.stato),
      snippet: it.sommario || it.descrizione || '',
      url: SITO + '/lex/atto.html?id=' + encodeURIComponent(it.id),
    }),
  },
  'progetti.json': {
    chiave: 'progetti', tipo: 'progetto', label: 'Apri su NormAktiv',
    scheda: (it) => ({
      name: it.titolo || it.nome || it.id,
      path: via(it.categoria, it.numero && it.anno ? 'n. ' + it.numero + '/' + it.anno : '', it.stato),
      snippet: it.sommario || it.descrizione || '',
      url: SITO + '/lex/progetto.html?id=' + encodeURIComponent(it.id),
    }),
  },
  'wiki.json': {                                             // pagine della wiki -> /lex/wiki.html#id
    chiave: 'pagine', tipo: 'wiki', label: 'Apri sulla Wiki',
    scheda: (it) => ({
      name: it.titolo || it.id,
      path: via(it.categoria, ...(Array.isArray(it.tag) ? it.tag : [])),
      snippet: it.sommario || '',
      url: SITO + '/lex/wiki.html#' + encodeURIComponent(it.id),
    }),
  },
  'elezioni.json': {                                         // consultazioni -> /CEPU.html?tipo=..&data=..&comune=..
    chiave: 'elezioni', tipo: 'elezione', label: 'Apri i risultati',
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
const memoria = {};

const nomeFile = (p) => p.split('/').pop().toLowerCase();
const datasetDi = (p) => DATASET[nomeFile(p)];
const escluso = (p) => ESCLUSI.includes(nomeFile(p)) || SCRIPT.test(p) || IGNORATI.test(p);

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
  /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(p) ? 'img' :
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
      return lista.map((it) => {
        const s = cfg.scheda(it);
        // si cerca nel contenuto leggibile, non negli indirizzi delle immagini o nei colori
        const plain = testoPulito(it.contenuto);
        const dati = JSON.stringify(it, (k, v) => (k === 'logo' || k === 'colore' || k === 'immagine' || k === 'contenuto' ? undefined : v), ' ')
          .replace(/[{}\[\]":,]/g, ' ').replace(/\s+/g, ' ');
        return {
          s, plain,
          titolo: String(s.name || '').toLowerCase(),
          sommario: String(s.snippet || '').toLowerCase(),
          testo: (s.name + ' ' + s.path + ' ' + dati + ' ' + plain + ' ' + (it.numero || '') + '/' + (it.anno || '')).toLowerCase(),
        };
      });
    });
    for (const { s, plain, titolo, sommario, testo } of schede) {
      if (!termini.every((t) => testo.includes(t))) continue;
      let score = 20;
      for (const t of termini) score += titolo.includes(t) ? 20 : sommario.includes(t) ? 8 : 0;
      risultati.push({
        repo: 'DATA',
        type: cfg.tipo,
        name: s.name,
        path: s.path,
        snippet: s.snippet || estratto(plain, termini),
        url: s.url,
        label: cfg.label,
        score,
      });
    }
  }
  return risultati;
}

async function cercaNellaRepo(nome, repo, termini, q) {
  const trovati = new Map();
  for (const p of await elencoFile(repo)) {
    if (datasetDi(p) || escluso(p)) continue;                // atti/progetti = schede; bozze, script e cartelle tecniche = mai
    const basso = p.toLowerCase();
    if (termini.every((t) => basso.includes(t))) {
      const f = nomeFile(p);
      trovati.set(p, { path: p, score: 10 + termini.filter((t) => f.includes(t)).length * 5 });
    }
  }
  if (nome !== 'IMG') {
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
  return [...trovati.values()].map((o) => {
    const tipo = tipoFile(o.path);
    // EWS e IMG: si apre il SITO online. DATA e' privata e non ha un sito: resta il link alla repo.
    const sulSito = nome === 'EWS' ? urlSito(SITO, o.path) : nome === 'IMG' ? urlSito(SITO_IMG, o.path) : null;
    return {
      repo: nome,
      path: o.path,
      score: o.score,
      name: tipo === 'pagina' || tipo === 'documento' ? nomeBello(o.path) : o.path.split('/').pop(),
      file: o.path.split('/').pop(),
      type: tipo,
      url: sulSito || 'https://github.com/' + repo + '/blob/HEAD/' + o.path,
      label: sulSito ? (tipo === 'img' ? 'Apri immagine' : 'Apri pagina') : '',
      raw: tipo === 'img' ? sulSito : null,               // anteprima: dal sito, mai da raw.githubusercontent
    };
  });
}

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
    const nomi = Object.keys(tutte).filter((n) => voluta === 'ALL' || n === voluta);

    const lavori = nomi.map((n) => cercaNellaRepo(n, tutte[n], termini, q));
    if (nomi.includes('DATA')) lavori.push(cercaNeiDataset(repoData, termini));
    const esiti = await Promise.allSettled(lavori);

    const results = esiti.flatMap((e) => (e.status === 'fulfilled' ? e.value : []));
    const errors = esiti.filter((e) => e.status === 'rejected').map((e) => e.reason.message);
    results.sort((a, b) => b.score - a.score);
    res.status(200).json({ count: results.length, results: results.slice(0, 200), errors });
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