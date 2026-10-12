// api/idx.js — Estji ID, estensioni: verifica Discord (OAuth), sessioni e avvisi di sicurezza, pannello staff.
//   GET  ?code=&state=                                  callback OAuth di Discord (poi rimanda a id.html)
//   POST { azione: 'discord-stato' | 'discord-avvia' }
//   POST { azione: 'sicurezza' | 'sessioni-esci' | 'avvisi-svuota' | 'avvisi-impostazione' }   + Bearer
//   POST { azione: 'staff-...' }                                                                + Bearer, solo staff
// Variabili d'ambiente: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, (opz.) DISCORD_REDIRECT_URI, DISCORD_BOT_TOKEN,
//                       ESTJI_STAFF (super-amministratori), ESTJI_ID_URL (pagina id.html)
import crypto from 'crypto';
import { ISS, redis, limite, ipDi, corpoJson, leggiIde, scriviIde, trovaId, nuovoHash, sessioneAttiva, listaSessioni, revocaSessioni, etichetta, maskIp,
         leggiAvvisi, discordAttivo, eStaff, eSuper, audit, leggiAudit } from './_idstore.js';
import { profilo } from './_id.js';

const str = (v, max) => (typeof v === 'string' ? v.trim() : '').slice(0, max);
const REDIRECT = () => process.env.DISCORD_REDIRECT_URI || ISS + '/api/idx';
const PAGINA_ID = () => process.env.ESTJI_ID_URL || ISS + '/id.html';

/* ---------- Discord: ritorno dall'autorizzazione ---------- */
async function discordCallback(req, res) {
  const u = new URL(req.url, ISS), code = u.searchParams.get('code'), state = u.searchParams.get('state');
  const torna = q => { res.statusCode = 302; res.setHeader('Location', PAGINA_ID() + '?' + q); res.end(); };
  const ko = m => torna('dcerr=' + encodeURIComponent(m));
  if (u.searchParams.get('error')) return ko('Accesso a Discord annullato.');
  const raw = state && code ? await redis('GETDEL', 'dcst:' + state) : null;
  if (!raw) return ko('Richiesta scaduta o non valida: riprova.');
  try {
    const st = JSON.parse(raw);
    const tr = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, client_secret: process.env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: REDIRECT() }) });
    const t = await tr.json().catch(() => ({}));
    if (!tr.ok || !t.access_token) return ko('Discord ha rifiutato la verifica: riprova.');
    const ur = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + t.access_token } });
    const d = await ur.json().catch(() => ({}));
    if (!ur.ok || !d.id) return ko('Non riesco a leggere il tuo account Discord.');
    const nome = String(d.username || '').toLowerCase(), ide = await leggiIde();
    const occupato = pid => ide.identita.some(x => x.id !== pid && (x.discordId === d.id || (x.discordVerificato && x.discord === nome)));
    if (st.scopo === 'link') {
      const p = trovaId(ide, st.id);
      if (!p) return ko('Identità non trovata.');
      if (occupato(p.id)) return ko("Questo account Discord è già collegato a un'altra identità.");
      p.discord = nome; p.discordId = d.id; p.discordVerificato = true;
      await scriviIde(ide, 'Discord verificato ' + p.id);
      return torna('dcok=1');
    }
    if (occupato('')) return ko("Questo account Discord ha già un'identità.");
    const tk = crypto.randomBytes(18).toString('base64url');
    await redis('SET', 'dcreg:' + tk, JSON.stringify({ id: d.id, nome }), 'EX', 900);
    return torna('dcreg=' + tk + '&dcn=' + encodeURIComponent(nome));
  } catch (e) { return ko('Errore: ' + e.message); }
}

/* ---------- Staff ---------- */
const PRIV = /^(Staff|Generale)$/i;   // ruoli che può assegnare solo un super-amministratore
const DOCS = { id: 'emissioneId', fisc: 'emissioneFisc', elet: 'emissioneElet' };
const riassunto = x => ({ id: x.id, nick: x.nick, discord: x.discord || '', discordVerificato: !!x.discordVerificato, residenzaNome: x.residenzaNome || x.stato || '', ruoli: x.ruoli || [],
  verificato: !!x.verificato, sospeso: !!x.sospeso, staff: eStaff(x), iscritto: x.iscritto, tf: !!x.tf, cup: x.cup });
const pulisciRuoli = a => [...new Set((Array.isArray(a) ? a : []).map(r => String(r).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40)).filter(Boolean))].slice(0, 12);

async function staff(a, c, me, ide, res, err) {
  const chi = me.id + ' ' + me.nick;
  const ok = (o, dettaglio, bersaglio) => audit(chi, a, bersaglio || '', dettaglio).then(() => res.status(200).json(Object.assign({ ok: true }, o)));
  const salva = (msg, t) => scriviIde(ide, 'Staff ' + me.id + ': ' + msg + ' ' + t.id);
  if (a === 'staff-statistiche') {
    const l = ide.identita, sette = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), res10 = {};
    l.forEach(x => { const k = x.residenzaNome || x.stato || '—'; res10[k] = (res10[k] || 0) + 1; });
    return res.status(200).json({ totale: l.length, verificati: l.filter(x => x.verificato).length, nonVerificati: l.filter(x => !x.verificato).length, sospesi: l.filter(x => x.sospeso).length,
      staff: l.filter(eStaff).length, discordVerificato: l.filter(x => x.discordVerificato).length, conTf: l.filter(x => x.tf).length, nuovi7g: l.filter(x => (x.iscritto || '') >= sette).length,
      perResidenza: Object.entries(res10).sort((x, y) => y[1] - x[1]).slice(0, 10) });
  }
  if (a === 'staff-registro') return res.status(200).json({ voci: await leggiAudit(100) });
  if (a === 'staff-lista') {
    const q = str(c.q, 60).toLowerCase(), f = str(c.filtro, 20), PAG = 40, pg = Math.max(0, parseInt(c.pagina, 10) || 0);
    let l = ide.identita.filter(x => !q || [x.nick, x.id, x.discord, x.cup, x.residenzaNome].some(v => String(v || '').toLowerCase().includes(q)));
    if (f === 'non-verificati') l = l.filter(x => !x.verificato); else if (f === 'sospesi') l = l.filter(x => x.sospeso);
    else if (f === 'staff') l = l.filter(eStaff); else if (f === 'senza-discord') l = l.filter(x => !x.discordVerificato);
    l = l.slice().sort((x, y) => String(y.id).localeCompare(String(x.id)));
    return res.status(200).json({ totale: l.length, pagina: pg, perPagina: PAG, righe: l.slice(pg * PAG, pg * PAG + PAG).map(riassunto) });
  }
  const t = trovaId(ide, str(c.id, 40));
  if (!t) return err(404, 'Identità non trovata.');
  if (a === 'staff-dettaglio') {
    const ss = await listaSessioni(t.id);
    return res.status(200).json({ identita: Object.assign(riassunto(t), { uuid: t.uuid || '', discordId: t.discordId || '', indirizzo: t.indirizzo || '', residenza: t.residenza || '', delegazione: t.delegazione || '',
      sospesoMotivo: t.sospesoMotivo || '', revocati: t.revocati || {}, emissioneId: t.emissioneId, emissioneFisc: t.emissioneFisc, emissioneElet: t.emissioneElet,
      sessioni: ss.map(x => ({ etichetta: etichetta(x.ua), ip: maskIp(x.ip), creata: x.creata, metodo: x.metodo })) }) });
  }
  // da qui in poi si modifica: un membro dello staff può essere toccato solo da un super-amministratore (o da sé stesso dove ha senso)
  if (eStaff(t) && !eSuper(me) && t.id !== me.id) return err(403, 'Solo un super-amministratore può modificare un membro dello staff.');
  if (a === 'staff-verifica') {
    t.verificato = !!c.valore;
    await salva(t.verificato ? 'verifica' : 'toglie verifica a', t);
    return ok({ identita: riassunto(t) }, t.verificato ? 'verificata' : 'verifica rimossa', t.id);
  }
  if (a === 'staff-sospendi') {
    if (t.id === me.id) return err(400, 'Non puoi sospendere te stesso.');
    t.sospeso = !!c.valore; t.sospesoMotivo = t.sospeso ? str(c.motivo, 120) : '';
    if (t.sospeso) await revocaSessioni(t.id);
    await salva(t.sospeso ? 'sospende' : 'riattiva', t);
    return ok({ identita: riassunto(t) }, t.sospeso ? 'sospesa: ' + t.sospesoMotivo : 'riattivata', t.id);
  }
  if (a === 'staff-ruoli') {
    const nuovi = pulisciRuoli(c.ruoli), vecchi = t.ruoli || [];
    const cambiati = nuovi.filter(r => !vecchi.includes(r)).concat(vecchi.filter(r => !nuovi.includes(r)));
    if (cambiati.some(r => PRIV.test(r)) && !eSuper(me)) return err(403, 'I ruoli "Staff" e "Generale" li può assegnare solo un super-amministratore.');
    if (t.id === me.id && !eSuper(me)) return err(403, 'Non puoi modificare i tuoi stessi ruoli.');
    t.ruoli = nuovi;
    await salva('ruoli di', t);
    return ok({ identita: riassunto(t) }, vecchi.join(', ') + ' → ' + nuovi.join(', '), t.id);
  }
  if (a === 'staff-documento') {
    const campo = DOCS[c.documento], op = c.op;
    if (!campo || !['revoca', 'ripristina', 'rinnova'].includes(op)) return err(400, 'Richiesta non valida.');
    t.revocati = t.revocati || {};
    if (op === 'revoca') t.revocati[campo] = true;
    else { delete t.revocati[campo]; if (op === 'rinnova') t[campo] = new Date().toISOString().slice(0, 10); }
    await salva(op + ' ' + c.documento + ' di', t);
    return ok({ identita: Object.assign(riassunto(t), { revocati: t.revocati }) }, op + ' ' + c.documento, t.id);
  }
  if (a === 'staff-reset-password') {
    const temp = crypto.randomBytes(9).toString('base64url');   // 12 caratteri, mostrata una sola volta allo staff
    t.password = nuovoHash(temp);
    await revocaSessioni(t.id);
    await salva('reimposta password di', t);
    return ok({ password: temp }, 'password reimpostata (sessioni chiuse)', t.id);
  }
  if (a === 'staff-revoca-sessioni') {
    const n = await revocaSessioni(t.id);
    return ok({ chiuse: n }, n + ' sessioni chiuse', t.id);
  }
  return err(400, 'Azione staff non riconosciuta.');
}

/* ---------- handler ---------- */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') return await discordCallback(req, res);
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ error: 'Metodo non consentito' }); }
    const c = await corpoJson(req), a = String(c.azione || '');
    const err = (s, m) => res.status(s).json({ error: m });
    if (a === 'discord-stato') return res.status(200).json({ attivo: discordAttivo() });
    if (a === 'discord-avvia') {
      if (!discordAttivo()) return err(400, 'La verifica Discord non è attiva.');
      const scopo = c.scopo === 'link' ? 'link' : 'reg';
      let id = '';
      if (scopo === 'link') { const s = await sessioneAttiva(req); if (!s) return err(401, 'Sessione scaduta: accedi di nuovo.'); id = s.id; }
      else if (!(await limite('dcav:' + ipDi(req), 20, 600))) return err(429, 'Troppi tentativi: riprova tra qualche minuto.');
      const state = crypto.randomBytes(18).toString('base64url');
      await redis('SET', 'dcst:' + state, JSON.stringify({ scopo, id }), 'EX', 600);
      const url = 'https://discord.com/oauth2/authorize?' + new URLSearchParams({ client_id: process.env.DISCORD_CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT(), scope: 'identify', state });
      return res.status(200).json({ url });
    }
    const s = await sessioneAttiva(req);
    if (!s) return err(401, 'Sessione scaduta: accedi di nuovo.');
    const ide = await leggiIde(), p = trovaId(ide, s.id);
    if (!p) return err(401, 'Identità non trovata.');
    if (p.sospeso) return err(403, 'Identità sospesa.');
    if (a === 'sicurezza') {
      const ss = await listaSessioni(p.id);
      return res.status(200).json({ corrente: s.sid, avvisiTutti: !!p.avvisiTutti, avvisi: await leggiAvvisi(p.id),
        sessioni: ss.map(x => ({ sid: x.sid, etichetta: etichetta(x.ua), ip: maskIp(x.ip), creata: x.creata, metodo: x.metodo, corrente: x.sid === s.sid })) });
    }
    if (a === 'sessioni-esci') {   // modo: 'altre' (tranne questa) | 'tutte'
      const n = await revocaSessioni(p.id, c.modo === 'altre' ? s.sid : '');
      return res.status(200).json({ ok: true, chiuse: n });
    }
    if (a === 'avvisi-svuota') { await redis('DEL', 'notif:' + p.id); return res.status(200).json({ ok: true }); }
    if (a === 'avvisi-impostazione') {
      p.avvisiTutti = !!c.tutti;
      await scriviIde(ide, 'Impostazione avvisi ' + p.id);
      return res.status(200).json({ ok: true, profilo: profilo(p) });
    }
    if (a.startsWith('staff-')) {
      if (!eStaff(p)) return err(403, 'Accesso riservato allo staff.');
      return await staff(a, c, p, ide, res, err);
    }
    return err(400, 'Azione non riconosciuta.');
  } catch (e) { return res.status(500).json({ error: 'Errore: ' + e.message }); }
}