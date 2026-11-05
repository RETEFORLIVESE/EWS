// Vercel Serverless Function: legge un JSON dal repo privato RETEFORLIVESE/DATA
// e lo restituisce al browser, senza mai esporre il token.
// In piu': con ?cerca=1 fa da motore di ricerca su EWS, IMG e DATA (vedi cercaTutto).
//
// Variabili d'ambiente (Vercel > Project > Settings > Environment Variables):
//   GITHUB_TOKEN  (obbligatoria)  token fine-grained con sola lettura "Contents" sul repo DATA
//   DATA_REPO     (facoltativa)   default "RETEFORLIVESE/DATA"
//   DATA_BRANCH   (facoltativa)   default: il ramo predefinito del repo
//   _ACCESS_KEY   (facoltativa)   se impostata, la ricerca richiede ?k=<chiave>
const ALLOWED = ['atti.json', 'ctsu.json', 'elezioni.json', 'organi.json'];   // unitext.json NON va qui: contiene le bozze, UniText si legge solo da /api/unitext

// ---------------------------------------------------------------- RICERCA
const SITO = 'https://ews-rose.vercel.app';                 // dove vive NormAktiv
const SCADENZA = 10 * 60 * 1000;                             // cache in memoria: 10 minuti
const ESCLUSI = ['unitext.json'];                            // bozze: mai nei risultati
const DATASET = {                                            // file di DATA con schede che hanno "id"
  'atti.json':     { chiave: 'atti',     pagina: '/lex/atto.html',     tipo: 'atto' },
  'progetti.json': { chiave: 'progetti', pagina: '/lex/progetto.html', tipo: 'progetto' },
};
const memoria = {};

const nomeFile = (p) => p.split('/').pop().toLowerCase();
const datasetDi = (p) => DATASET[nomeFile(p)];
const escluso = (p) => ESCLUSI.includes(nomeFile(p));

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
  /\.(html?|css|js)$/i.test(p) ? 'sito' :
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
      return lista.map((it) => ({
        it,
        titolo: String(it.titolo || it.nome || it.id || '').toLowerCase(),
        sommario: String(it.sommario || it.descrizione || '').toLowerCase(),
        testo: (JSON.stringify(it) + ' ' + (it.categoria || '') + ' ' + it.numero + '/' + it.anno).toLowerCase(),
      }));
    });
    for (const { it, titolo, sommario, testo } of schede) {
      if (!termini.every((t) => testo.includes(t))) continue;
      let score = 20;
      for (const t of termini) score += titolo.includes(t) ? 20 : sommario.includes(t) ? 8 : 0;
      risultati.push({
        repo: 'DATA',
        type: cfg.tipo,
        name: it.titolo || it.nome || it.id,
        path: [it.categoria, it.numero && it.anno ? 'n. ' + it.numero + '/' + it.anno : '', it.stato].filter(Boolean).join(' · '),
        snippet: it.sommario || it.descrizione || '',
        url: SITO + cfg.pagina + '?id=' + encodeURIComponent(it.id),
        label: 'Apri su NormAktiv',
        score,
      });
    }
  }
  return risultati;
}

async function cercaNellaRepo(nome, repo, termini, q) {
  const trovati = new Map();
  for (const p of await elencoFile(repo)) {
    if (datasetDi(p) || escluso(p)) continue;                // atti/progetti = schede; bozze = mai
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
  return [...trovati.values()].map((o) => ({
    repo: nome,
    path: o.path,
    score: o.score,
    name: o.path.split('/').pop(),
    type: tipoFile(o.path),
    url: 'https://github.com/' + repo + '/blob/HEAD/' + o.path,
    raw: nome === 'DATA' ? null : 'https://raw.githubusercontent.com/' + repo + '/HEAD/' + o.path,
  }));
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