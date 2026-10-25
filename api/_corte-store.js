// api/_corte-store.js
// Accesso all'archivio degli atti: LO STESSO usato da /api/atti (NormAktiv).
// Non avendo visto api/atti.js, qui si usano le variabili d'ambiente citate dal messaggio d'errore di NormAktiv:
//   - JSONBin:  BIN_ID + API_KEY
//   - GitHub:   GITHUB_TOKEN + ATTI_REPO ("utente/repo") + ATTI_PATH (default "atti.json") [+ ATTI_BRANCH]
// Se NormAktiv salva in un altro modo, basta adattare queste due funzioni: leggiAtti() e scriviAtti().

const GH = "https://api.github.com";

function backend() {
  if (process.env.BIN_ID && process.env.API_KEY) return "jsonbin";
  if (process.env.GITHUB_TOKEN && process.env.ATTI_REPO) return "github";
  return null;
}

function estrai(rec) {
  if (Array.isArray(rec)) return { atti: rec, forma: "array", resto: null };
  const r = rec && rec.atti ? rec : { atti: [] };
  return { atti: Array.isArray(r.atti) ? r.atti : [], forma: "oggetto", resto: r };
}
function ricomponi(letto, atti) {
  return letto.forma === "array" ? atti : { ...(letto.resto || {}), atti };
}

export async function leggiAtti() {
  const b = backend();
  if (b === "jsonbin") {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${process.env.BIN_ID}/latest`, {
      headers: { "X-Master-Key": process.env.API_KEY }
    });
    if (!r.ok) throw new Error("Lettura archivio: HTTP " + r.status);
    const j = await r.json();
    return { ...estrai(j.record), ctx: {} };
  }
  if (b === "github") {
    const path = process.env.ATTI_PATH || "atti.json";
    const ref = process.env.ATTI_BRANCH ? "?ref=" + encodeURIComponent(process.env.ATTI_BRANCH) : "";
    const r = await fetch(`${GH}/repos/${process.env.ATTI_REPO}/contents/${path}${ref}`, {
      headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN, Accept: "application/vnd.github+json" },
      cache: "no-store"
    });
    if (!r.ok) throw new Error("Lettura archivio: HTTP " + r.status);
    const j = await r.json();
    const rec = JSON.parse(Buffer.from(j.content, "base64").toString("utf8"));
    return { ...estrai(rec), ctx: { sha: j.sha, path } };
  }
  throw new Error("Archivio non configurato (BIN_ID/API_KEY oppure GITHUB_TOKEN/ATTI_REPO).");
}

export async function scriviAtti(letto, atti) {
  const b = backend();
  const corpo = ricomponi(letto, atti);
  if (b === "jsonbin") {
    const r = await fetch(`https://api.jsonbin.io/v3/b/${process.env.BIN_ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Master-Key": process.env.API_KEY },
      body: JSON.stringify(corpo)
    });
    if (!r.ok) throw new Error("Scrittura archivio: HTTP " + r.status);
    return;
  }
  if (b === "github") {
    const r = await fetch(`${GH}/repos/${process.env.ATTI_REPO}/contents/${letto.ctx.path}`, {
      method: "PUT",
      headers: { Authorization: "Bearer " + process.env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Corte Costituzionale: pubblicazione pronuncia",
        content: Buffer.from(JSON.stringify(corpo, null, 2), "utf8").toString("base64"),
        sha: letto.ctx.sha,
        ...(process.env.ATTI_BRANCH ? { branch: process.env.ATTI_BRANCH } : {})
      })
    });
    if (!r.ok) throw new Error("Scrittura archivio: HTTP " + r.status);
    return;
  }
  throw new Error("Archivio non configurato.");
}

