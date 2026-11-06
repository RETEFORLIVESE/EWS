// api/_corte-store.js — lettura e scrittura di atti.json nel repo DATI PRIVATO.
// Stesso metodo di NormAktiv (api/data.js): GitHub Contents API autenticata con GITHUB_TOKEN,
// mai raw.githubusercontent.com (che non funziona sui repo privati).
//
// Variabili d'ambiente (le stesse di NormAktiv; vanno bene entrambe le denominazioni):
//   GITHUB_TOKEN                      token con "Contents" in lettura E scrittura sul repo dati
//   DATA_REPO  o GITHUB_DATA_REPO     default "RETEFORLIVESE/DATA"
//   DATA_BRANCH o GITHUB_DATA_BRANCH  default: il ramo predefinito del repo
//
// Uso (identico a prima):
//   const letto = await leggiAtti();            // { atti, json, sha, percorso }
//   await scriviAtti(letto, attiModificati, "messaggio di commit");

const FILE = "atti.json";
const API = "https://api.github.com";

const repo = () => process.env.DATA_REPO || process.env.GITHUB_DATA_REPO || "RETEFORLIVESE/DATA";
const ramo = () => process.env.DATA_BRANCH || process.env.GITHUB_DATA_BRANCH || "";

function intestazioni() {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN non configurato: il repo dati è privato.");
  return {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + process.env.GITHUB_TOKEN,
    "User-Agent": "ews-corte",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

async function errGitHub(r, azione) {
  let dettaglio = "";
  try { dettaglio = (await r.json()).message || ""; } catch (e) { /* nessun dettaglio */ }
  if (r.status === 401 || r.status === 403) return new Error(`${azione}: token GitHub non valido o senza permessi sul repo dati (${r.status}).`);
  if (r.status === 404) return new Error(`${azione}: file o repo dati non trovato (il token deve avere accesso al repo privato).`);
  if (r.status === 409 || r.status === 422) return new Error(`${azione}: l'archivio è stato modificato nel frattempo, riprova (${dettaglio || r.status}).`);
  return new Error(`${azione}: GitHub ${r.status} ${dettaglio}`.trim());
}

// il nome nel repo può essere minuscolo o con la maiuscola iniziale (come in api/data.js)
const NOMI = [FILE, FILE.charAt(0).toUpperCase() + FILE.slice(1)];

export async function leggiAtti() {
  const q = ramo() ? "?ref=" + encodeURIComponent(ramo()) : "";
  let meta = null, percorso = "";
  for (const nome of NOMI) {
    const r = await fetch(`${API}/repos/${repo()}/contents/${nome}${q}`, { headers: intestazioni(), cache: "no-store" });
    if (r.ok) { meta = await r.json(); percorso = nome; break; }
    if (r.status !== 404) throw await errGitHub(r, "Lettura archivio");
  }
  if (!meta) throw new Error("Lettura archivio: atti.json non trovato nel repo dati.");

  let testo;
  if (meta.content && meta.encoding === "base64") {
    testo = Buffer.from(meta.content, "base64").toString("utf8");
  } else {
    // file sopra 1 MB: la Contents API non include il contenuto, si legge il blob
    const rb = await fetch(`${API}/repos/${repo()}/git/blobs/${meta.sha}`, { headers: intestazioni(), cache: "no-store" });
    if (!rb.ok) throw await errGitHub(rb, "Lettura archivio");
    const b = await rb.json();
    testo = Buffer.from(b.content || "", b.encoding === "base64" ? "base64" : "utf8").toString("utf8");
  }

  let json;
  try { json = JSON.parse(testo); } catch (e) { throw new Error("atti.json non è un JSON valido."); }
  const atti = Array.isArray(json) ? json : (json && json.atti) || [];
  return { atti, json, sha: meta.sha, percorso };
}

export async function scriviAtti(letto, atti, messaggio) {
  // si conserva il resto del file (altre chiavi accanto a "atti"), formattazione a 2 spazi come l'originale
  const json = Array.isArray(letto.json) ? atti : { ...(letto.json || {}), atti };
  const corpo = {
    message: messaggio || "Aggiornamento atti.json",
    content: Buffer.from(JSON.stringify(json, null, 2), "utf8").toString("base64"),
    sha: letto.sha
  };
  if (ramo()) corpo.branch = ramo();
  const r = await fetch(`${API}/repos/${repo()}/contents/${letto.percorso || FILE}`, {
    method: "PUT",
    headers: { ...intestazioni(), "Content-Type": "application/json" },
    body: JSON.stringify(corpo)
  });
  if (!r.ok) throw await errGitHub(r, "Salvataggio archivio");
  const esito = await r.json();
  letto.sha = (esito.content && esito.content.sha) || letto.sha;   // utile per scritture successive
  letto.json = json;
  return esito;
}