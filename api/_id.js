// api/_id.js — identità digitale: registrazione, accesso personale, profilo, password, 2FA.
//   POST { azione: "registra", nick, discordTicket (verifica Discord), residenza (ID di un luogo di organi.json), password }
//   POST { azione: "accedi", nick, password }                        -> token di sessione personale
//   POST { azione: "profilo" | "cambia-password" | "tf" } + Authorization: Bearer <token>
// Ruolo, CUP, verificato, uuid NON si leggono mai dalla richiesta: li decide il sistema / lo staff (ide.json).
// Sessioni, avvisi, verifica Discord e pannello staff stanno in api/idx.js.
import { verificaJwt, redis, trovaLuogo, leggiIde, scriviIde, trovaId, nuovoHash, passwordOk, nuovoCup, creaSessione, sessioneAttiva, registraAccesso, revocaSessioni,
         discordAttivo, eStaff, limite, ipDi, ruoliTecnici, corpoJson } from './_idstore.js';

const str = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);
export const profilo = p => ({ id: p.id, cup: p.cup, nick: p.nick, discord: p.discord, discordVerificato: !!p.discordVerificato, stato: p.stato, sezione: p.sezione, residenza: p.residenza, residenzaNome: p.residenzaNome, uuid: p.uuid,
  statoSociale: p.statoSociale || '', indirizzo: p.indirizzo || '', delegazione: p.delegazione || '', emissioneId: p.emissioneId, emissioneFisc: p.emissioneFisc, emissioneElet: p.emissioneElet,
  revocati: p.revocati || {}, avvisiTutti: !!p.avvisiTutti, staff: eStaff(p),
  ruoli: p.ruoli || [], ruoliTecnici: ruoliTecnici(p), verificato: !!p.verificato, iscritto: p.iscritto, tf: !!p.tf, haPassword: !!p.password });
const msgSospeso = p => 'Questa identità è sospesa' + (p.sospesoMotivo ? ': ' + p.sospesoMotivo : '') + '. Contatta lo staff.';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Metodo non consentito' }); }
  const c = await corpoJson(req);
  const err = (s, m) => res.status(s).json({ error: m });
  try {
    if (c.azione === 'registra') {
      if (!(await limite('reg:' + ipDi(req), 5, 3600))) return err(429, 'Troppe registrazioni: riprova più tardi.');
      const nick = str(c.nick, 16), residenza = str(c.residenza, 80);
      let discord = str(c.discord, 40).toLowerCase(), discordId = '', discordVer = false, ticket = '';
      if (discordAttivo()) {   // con la verifica attiva il nome Discord viene SOLO dal ticket, mai dalla richiesta
        ticket = str(c.discordTicket, 64);
        const raw = ticket ? await redis('GET', 'dcreg:' + ticket) : null;
        if (!raw) return err(400, 'Verifica il tuo account Discord prima di registrarti.');
        try { const d = JSON.parse(raw); discord = String(d.nome || '').toLowerCase(); discordId = String(d.id || ''); discordVer = !!discordId; } catch (e) { return err(400, 'Verifica Discord non valida: riprova.'); }
      }
      if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) return err(400, 'Il nome in gioco deve avere 3-16 caratteri (lettere, numeri, _).');
      if (discord.length < 2) return err(400, "Inserisci l'account Discord.");
      const luogo = await trovaLuogo(residenza);
      if (!luogo) return err(400, 'Residenza non valida.');
      if (typeof c.password !== 'string' || c.password.length < 8 || c.password.length > 128) return err(400, 'La password deve avere almeno 8 caratteri.');
      const ide = await leggiIde();
      if (ide.identita.some(p => discordVer ? (p.discordId === discordId || (p.discordVerificato && p.discord === discord)) : p.discord === discord)) return err(409, 'Questo account Discord ha già un\'identità.');
      if (ide.identita.some(p => p.nick.toLowerCase() === nick.toLowerCase())) return err(409, 'Il nome in gioco è già registrato.');
      const p = { id: 'EST-' + new Date().getFullYear() + '-' + String(ide.identita.length + 1).padStart(6, '0'), cup: '', nick, discord, discordId, discordVerificato: discordVer, uuid: '',
        residenza: luogo.id, residenzaNome: luogo.nome, statoSociale: luogo.stato, stato: luogo.nome, sezione: '', indirizzo: str(c.indirizzo, 80), delegazione: str(c.delegazione, 2).toLowerCase(), ruoli: [], verificato: false, iscritto: new Date().toISOString().slice(0, 10), password: nuovoHash(c.password), tf: false };
      p.cup = nuovoCup(p, ide);
      ide.identita.push(p);
      await scriviIde(ide, 'Nuova identità ' + p.id);
      if (ticket) await redis('DEL', 'dcreg:' + ticket);   // il ticket vale una sola registrazione
      return res.status(200).json({ ok: true, id: p.id, cup: p.cup });
    }
    if (c.azione === 'accedi') {
      const nick = str(c.nick, 16).toLowerCase();
      if (!(await limite('log:' + nick, 8, 600)) || !(await limite('logip:' + ipDi(req), 30, 600))) return err(429, 'Troppi tentativi: riprova tra qualche minuto.');
      const p = (await leggiIde()).identita.find(x => x.nick.toLowerCase() === nick);
      if (!passwordOk(c.password, p && p.password)) return err(401, 'Nome o password errati.');
      if (p.sospeso) return err(403, msgSospeso(p));   // solo dopo la password giusta: niente enumerazione degli account
      const sess = await creaSessione(req, p.id, 'password');
      await registraAccesso(p, req, sess);
      return res.status(200).json({ ok: true, token: sess.token, profilo: profilo(p) });
    }
    if (c.azione === 'accedi-qr') {   // il token arriva dal widget QR (client "id"), dopo l'approvazione dal telefono con numero
      if (!(await limite('qr:' + ipDi(req), 20, 600))) return err(429, 'Troppi tentativi: riprova tra qualche minuto.');
      const t = verificaJwt(c.id_token, 'id');
      if (!t || !t.jti || !String(t.scope || '').split(' ').includes('id.session')) return err(401, 'Accesso con QR non valido o scaduto: genera un nuovo QR.');
      if ((await redis('SET', 'idtok:' + t.jti, '1', 'NX', 'EX', 700)) !== 'OK') return err(401, 'Questo accesso è già stato utilizzato.');
      const q = trovaId(await leggiIde(), t.sub);
      if (!q) return err(401, 'Identità non trovata.');
      if (q.sospeso) return err(403, msgSospeso(q));
      const sess = await creaSessione(req, q.id, 'QR');
      await registraAccesso(q, req, sess);
      return res.status(200).json({ ok: true, token: sess.token, profilo: profilo(q) });
    }
    const s = await sessioneAttiva(req);   // controlla firma, scadenza e revoca
    if (!s) return err(401, 'Sessione scaduta: accedi di nuovo.');
    const ide = await leggiIde(), p = trovaId(ide, s.id);
    if (!p) return err(401, 'Identità non trovata.');
    if (p.sospeso) return err(403, msgSospeso(p));
    if (c.azione === 'profilo') return res.status(200).json({ profilo: profilo(p) });
    if (c.azione === 'cambia-password') {
      if (!passwordOk(c.attuale, p.password)) return err(403, 'La password attuale non è corretta.');
      if (typeof c.nuova !== 'string' || c.nuova.length < 8 || c.nuova.length > 128) return err(400, 'La nuova password deve avere almeno 8 caratteri.');
      p.password = nuovoHash(c.nuova);
      await scriviIde(ide, 'Cambio password ' + p.id);
      await revocaSessioni(p.id, s.sid);   // chiude tutte le altre sessioni
      return res.status(200).json({ ok: true });
    }
    if (c.azione === 'tf') {
      p.tf = !!c.attiva;
      await scriviIde(ide, 'Impostazione 2FA ' + p.id);
      return res.status(200).json({ ok: true, profilo: profilo(p) });
    }
    if (c.azione === 'cambia-residenza') {
      if (!(await limite('res:' + p.id, 5, 86400))) return err(429, 'Hai cambiato residenza troppe volte oggi: riprova domani.');
      const luogo = await trovaLuogo(str(c.residenza, 80));
      if (!luogo) return err(400, 'Residenza non valida.');
      if (luogo.id !== p.residenza) { p.sezione = ''; p.residenzaDal = new Date().toISOString().slice(0, 10); }
      p.residenza = luogo.id; p.residenzaNome = luogo.nome; p.statoSociale = luogo.stato; p.stato = luogo.nome;   // il CUP non cambia: lo decide il sistema
      p.indirizzo = str(c.indirizzo, 80);
      await scriviIde(ide, 'Cambio residenza ' + p.id);
      return res.status(200).json({ ok: true, profilo: profilo(p) });
    }
    if (c.azione === 'rinnova') {
      const campo = { id: 'emissioneId', fisc: 'emissioneFisc', elet: 'emissioneElet' }[c.documento];
      if (!campo) return err(400, 'Documento non valido.');
      if (p.revocati && p.revocati[campo]) return err(403, 'Questo documento è stato revocato dallo staff: contattalo per ripristinarlo.');
      if (!(await limite('rin:' + p.id, 10, 86400))) return err(429, 'Troppi rinnovi oggi: riprova domani.');
      p[campo] = new Date().toISOString().slice(0, 10);
      await scriviIde(ide, 'Rinnovo ' + c.documento + ' ' + p.id);
      return res.status(200).json({ ok: true, profilo: profilo(p) });
    }
    return err(400, 'Azione non riconosciuta.');
  } catch (e) { return err(500, 'Errore: ' + e.message); }
}