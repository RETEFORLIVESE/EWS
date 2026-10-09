// Vercel Serverless Function: legge un JSON dal repo privato RETEFORLIVESE/DATA
// e lo restituisce al browser, senza mai esporre il token.
//
// Variabili d'ambiente (Vercel > Project > Settings > Environment Variables):
//   GITHUB_TOKEN  (obbligatoria)  token fine-grained con sola lettura "Contents" sul repo DATA
//   DATA_REPO     (facoltativa)   default "RETEFORLIVESE/DATA"
//   DATA_BRANCH   (facoltativa)   default: il ramo predefinito del repo
const ALLOWED = ['atti.json', 'ctsu.json', 'elezioni.json', 'unitext.json', 'organi.json'];

module.exports = async (req, res) => {
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