// api/corte.js — endpoint della Corte Costituzionale.
//   GET  /api/corte                -> elenco pubblico delle pronunce (derivato dagli atti)
//   GET  /api/corte?atti=1         -> (con token) elenco sintetico degli atti per la redazione
//   GET  /api/corte?atto=<id>      -> (con token) atto completo da modificare
//   POST {azione:"login", username, password}
//   POST {azione:"login-estji", id_token}   -> accesso con Estji ID (portale "corte", permesso "corte.edit")
//   POST {azione:"pubblica", ...}  -> (con token) applica la pronuncia all'atto
//
// Variabili d'ambiente: CORTE_SECRET (stringa lunga casuale) e, facoltativa se si usa solo Estji ID,
// CORTE_USERS = "utente1:password1:Nome da mostrare,utente2:password2:Altro nome"
// Più quelle dell'archivio (vedi _corte-store.js).

import crypto from "crypto";
import { leggiAtti, scriviAtti } from "./_corte-store.js";
import { diffArticoli } from "./_corte-diff.js";
import { verificaIdToken, haScope } from "./_estji-verifica.js";   // già presente nelle api dei portali

const TIPI = ["modifica", "annullamento", "abrogazione"];
const PERICOLOSO = /<\s*(script|iframe|object|embed|style)|\son\w+\s*=|javascript:/i;

/* ---------- autenticazione ---------- */
const b64 = b => Buffer.from(b).toString("base64url");
const hmac = s => crypto.createHmac("sha256", process.env.CORTE_SECRET || "").update(s).digest("base64url");

function uguali(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function utenti() {
  return (process.env.CORTE_USERS || "").split(",").map(s => s.trim()).filter(Boolean).map(s => {
    const [u, p, ...n] = s.split(":");
    return { u, p, nome: n.join(":") || u };
  });
}
function creaToken(u) {
  const corpo = b64(JSON.stringify({ u: u.u, nome: u.nome, exp: Date.now() + 8 * 3600 * 1000 }));
  return corpo + "." + hmac(corpo);
}
function leggiToken(req) {
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [corpo, firma] = t.split(".");
  if (!corpo || !firma || !process.env.CORTE_SECRET || !uguali(hmac(corpo), firma)) return null;
  try {
    const p = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}

/* ---------- utilità ---------- */
const testo = (v, max) => (v == null ? "" : String(v)).trim().slice(0, max);
function errore(res, code, message) { res.status(code).json({ success: false, message }); }

function pulisciArticoli(arr) {
  if (!Array.isArray(arr) || !arr.length) throw new Error("Elenco articoli mancante.");
  if (arr.length > 500) throw new Error("Troppi articoli.");
  const out = arr.map(a => {
    if (a && a.tipo === "titolo") return { tipo: "titolo", testo: testo(a.testo, 300) };
    const commi = (Array.isArray(a.commi) ? a.commi : []).map(c => ({
      testo: testo(c.testo, 20000),
      sottocommi: (Array.isArray(c.sottocommi) ? c.sottocommi : []).map(s => testo(s, 10000)).filter(Boolean)
    }));
    if (!commi.length) commi.push({ testo: "", sottocommi: [] });
    return { numero: testo(a.numero, 20) || "1", rubrica: testo(a.rubrica, 300), commi };
  });
  if (PERICOLOSO.test(JSON.stringify(out))) throw new Error("Il testo contiene codice non consentito.");
  return out;
}

function pronunceDi(atti) {
  const out = [];
  atti.forEach(a => (a.pronunce || []).forEach(p => out.push({
    ...p,
    atto: { id: a.id, titolo: a.titolo, categoria: a.categoria, numero: a.numero, anno: a.anno, stato: a.stato }
  })));
  return out.sort((x, y) => (y.creataIl || "").localeCompare(x.creataIl || ""));
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const q = req.query || {};
      const { atti } = await leggiAtti();

      if (q.atti || q.atto) {
        if (!leggiToken(req)) return errore(res, 401, "Sessione scaduta: effettua di nuovo l'accesso.");
        if (q.atto) {
          const a = atti.find(x => x.id === q.atto);
          return a ? res.status(200).json({ success: true, atto: a }) : errore(res, 404, "Atto non trovato.");
        }
        return res.status(200).json({
          success: true,
          atti: atti.map(a => ({
            id: a.id, titolo: a.titolo, categoria: a.categoria, numero: a.numero, anno: a.anno,
            stato: a.stato, nArticoli: (a.articoli || []).filter(x => x.tipo !== "titolo").length
          }))
        });
      }
      return res.status(200).json({ success: true, pronunce: pronunceDi(atti) });
    }

    if (req.method !== "POST") return errore(res, 405, "Metodo non consentito.");
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

    if (b.azione === "login") {
      if (!process.env.CORTE_SECRET) return errore(res, 500, "CORTE_SECRET non configurata.");
      const u = utenti().find(x => uguali(x.u, testo(b.username, 80)) && uguali(x.p, testo(b.password, 200)));
      if (!u) return errore(res, 401, "Credenziali errate");
      return res.status(200).json({ success: true, token: creaToken(u), username: u.nome });
    }

    if (b.azione === "login-estji") {
      if (!process.env.CORTE_SECRET) return errore(res, 500, "CORTE_SECRET non configurata.");
      let c;
      try { c = await verificaIdToken(b.id_token, "corte"); }
      catch (e) { return errore(res, 502, "Estji ID non raggiungibile: riprova tra poco."); }
      if (!c) return errore(res, 401, "Accesso Estji ID non valido o scaduto.");
      if (!haScope(c, "corte.edit")) return errore(res, 403, "Il tuo profilo Estji ID non è abilitato alla redazione della Corte.");
      const nome = String(c.name || c.nick || c.preferred_username || c.sub || "Estji ID").slice(0, 80);
      return res.status(200).json({ success: true, token: creaToken({ u: "estji:" + (c.sub || nome), nome }), username: nome });
    }

    if (b.azione === "pubblica") {
      const sess = leggiToken(req);
      if (!sess) return errore(res, 401, "Sessione scaduta: effettua di nuovo l'accesso.");

      const tipo = testo(b.tipo, 20);
      if (!TIPI.includes(tipo)) return errore(res, 400, "Tipo di pronuncia non valido.");
      const meta = {
        numero: testo(b.numero, 12), anno: testo(b.anno, 4), data: testo(b.data, 60),
        oggetto: testo(b.oggetto, 300), motivazione: testo(b.motivazione, 20000),
        dispositivo: testo(b.dispositivo, 5000), effetto: testo(b.effetto, 300),
        collegio: testo(b.collegio, 500)
      };
      for (const k of ["numero", "anno", "data", "oggetto", "motivazione", "dispositivo"])
        if (!meta[k]) return errore(res, 400, "Campo obbligatorio mancante: " + k + ".");
      if (PERICOLOSO.test(JSON.stringify(meta))) return errore(res, 400, "Il testo contiene codice non consentito.");

      const letto = await leggiAtti();           // riletto subito prima di scrivere
      const atti = letto.atti;
      const i = atti.findIndex(a => a.id === b.attoId);
      if (i < 0) return errore(res, 404, "Atto non trovato.");
      const atto = { ...atti[i] };

      if (atto.stato === "annullato") return errore(res, 409, "L'atto è già stato annullato: non può essere ulteriormente modificato.");
      if (tipo !== "annullamento" && atto.stato === "abrogato")
        return errore(res, 409, "L'atto è già abrogato: si può solo annullare.");

      const id = `s-${meta.anno}-${meta.numero}-${atto.id}`.slice(0, 120);
      if ((atto.pronunce || []).some(p => p.id === id))
        return errore(res, 409, "Esiste già una pronuncia con questo numero per questo atto.");

      const pronuncia = {
        id, tipo, ...meta,
        creataIl: new Date().toISOString(), firmataDa: sess.nome,
        statoPrecedente: atto.stato || "vigente", modifiche: []
      };

      if (tipo === "modifica") {
        let nuovi;
        try { nuovi = pulisciArticoli(b.articoli); } catch (e) { return errore(res, 400, e.message); }
        pronuncia.modifiche = diffArticoli(atto.articoli || [], nuovi);
        if (!pronuncia.modifiche.length) return errore(res, 400, "Nessuna modifica rilevata rispetto al testo vigente.");
        atto.articoli = nuovi;
      } else {
        atto.stato = tipo === "annullamento" ? "annullato" : "abrogato";
      }

      atto.pronunce = [...(atto.pronunce || []), pronuncia];
      atti[i] = atto;
      await scriviAtti(letto, atti);
      return res.status(200).json({ success: true, pronuncia: { ...pronuncia, atto: { id: atto.id, titolo: atto.titolo } } });
    }

    return errore(res, 400, "Azione non riconosciuta.");
  } catch (e) {
    return errore(res, 500, e.message || "Errore del server");
  }
}
