// api/_corte-store.js
// Accesso agli atti: IDENTICO a NormAktiv (api/atti.js). Gli atti sono in atti.json nella repo DATA (privata),
// letti e scritti con api/_github.js. Variabili usate (già presenti su Vercel): GITHUB_TOKEN, GITHUB_DATA_REPO, GITHUB_DATA_BRANCH.
import { leggiFileJson, scriviFileJson } from "./_github.js";

const FILE = "atti.json";

// atti.json può essere un array oppure { atti: [...] } (stessa tolleranza di atti.js)
function estraiAtti(registro) {
  if (Array.isArray(registro)) return registro;
  if (registro && Array.isArray(registro.atti)) return registro.atti;
  return [];
}

export async function leggiAtti() {
  const registro = await leggiFileJson(FILE, { atti: [] });
  return { atti: estraiAtti(registro) };
}

// Come salva-atti di NormAktiv, scrive sempre { atti: [...] }.
export async function scriviAtti(_letto, atti, messaggio) {
  await scriviFileJson(FILE, { atti }, messaggio || "Corte Costituzionale: pubblicazione pronuncia");
}
