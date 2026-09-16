// assets/js/config.js
//
// ⚠️ ATTENZIONE: questo file NON deve contenere credenziali (binId, apiKey).
// Le chiavi JSONBin vivono solo come variabili d'ambiente su Vercel
// (BIN_ID, API_KEY) e vengono fornite al browser solo dopo il login,
// tramite /api/login → vedi assets/js/api.js.
//
// Qui dentro metti SOLO la configurazione pubblica del sito.

const SITE_CONFIG = {
  // ---- Identità della fazione ----
  nomeFazione: "NormAktiv",
  motto: "Union der Wohlfartsstaaten von Estji",
  annoFondazione: 2024,
  emblema: "lex/NormaAktiv.png",
  // ---- Link esterni (facoltativi) ----
  discord: "",                      // es. "https://discord.gg/xxxxx"
  sitoServer: "",                   // es. "https://minecraft-server.example"

  // ---- Testi / branding (facoltativo) ----
  titoloSito: "NormAktiv",
  descrizioneSito: "-USSE"
};

// Espone una "config API" vuota per retrocompatibilità:
// eventuale codice vecchio che legge API_CONFIG non crasha,
// ma non contiene più nulla di sensibile.
const API_CONFIG = Object.freeze({
  binId: null,
  apiKey: null,
  baseUrl: "/api/atti",   // le letture ora passano dal proxy server-side
  key: "atti"             // chiave dentro il record JSONBin
});

