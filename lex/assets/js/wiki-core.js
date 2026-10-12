// assets/js/wiki-core.js — libreria condivisa da wiki.html e redazione-wiki.html
// (stessa logica di sessione di api.js: token firmato in sessionStorage, header Authorization: Bearer)
const Wiki = {
  esc: t => (t == null ? '' : String(t)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  norm: t => (t || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  slug: t => Wiki.norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60),
  data: it => { const d = new Date(it); return isNaN(d) ? '' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }); },

  /* ---------- immagini: ![didascalia|opzioni](https://...) ----------
     opzioni (in qualsiasi ordine, separate da |):  300 = larghezza px · 40% = larghezza % · h120 = altezza px
     sx / dx = a sinistra/destra con il testo intorno · centro = centrata su riga propria · riga = in mezzo alle parole (predefinito)
     grafici CEPU: barre = barre % al posto dell'emiciclo · scuro = sfondo scuro · noseggi = solo l'emiciclo (niente legenda, totale al centro)
     alto / medio / basso / base = allineamento verticale rispetto alle parole (in riga) · y-10 / y15 = sposta su/giù di N px
     cap = mostra la didascalia sotto · nobordo = senza bordo · adatta / riempi = come riempire il riquadro se larghezza e altezza sono fisse */
  imgOpz(alt) {
    const [d, ...r] = String(alt || '').split('|').map(s => s.trim());
    const o = { didas: d || '', w: '', h: '', pos: '', va: '', y: 0, cap: false, nob: false, fit: '', dark: false, ns: false, br: false };
    r.forEach(x => {
      x = x.toLowerCase(); let m;
      if ((m = /^(\d{1,4})(px|%)?$/.exec(x))) o.w = m[1] + (m[2] || 'px');
      else if ((m = /^h(\d{1,4})(px)?$/.exec(x))) o.h = m[1];
      else if ((m = /^y(-?\d{1,4})(px)?$/.exec(x))) o.y = +m[1];
      else if (x === 'sx' || x === 'sinistra') o.pos = 'sx';
      else if (x === 'dx' || x === 'destra') o.pos = 'dx';
      else if (x === 'centro') o.pos = 'c';
      else if (x === 'riga' || x === 'inline') o.pos = 'in';
      else if (['alto', 'medio', 'basso', 'base'].includes(x)) o.va = x;
      else if (x === 'cap') o.cap = true;
      else if (x === 'nobordo') o.nob = true;
      else if (x === 'scuro') o.dark = true;
      else if (x === 'noseggi') o.ns = true;
      else if (x === 'barre') o.br = true;
      else if (x === 'adatta' || x === 'riempi') o.fit = x;
    });
    return o;
  },
  imgSintassi(o, url) {
    const p = [o.didas || ''];
    if (o.pos && o.pos !== 'in') p.push({ sx: 'sx', dx: 'dx', c: 'centro' }[o.pos]);
    if (o.w) p.push(String(o.w).replace(/px$/, ''));
    if (o.h) p.push('h' + o.h);
    if (o.va) p.push(o.va);
    if (o.y) p.push('y' + o.y);
    if (o.fit) p.push(o.fit);
    if (o.cap) p.push('cap');
    if (o.nob) p.push('nobordo');
    if (o.dark) p.push('scuro');
    if (o.ns) p.push('noseggi');
    if (o.br) p.push('barre');
    return '![' + p.join('|') + '](' + url + ')';
  },

  /* ---------- GRAFICI DELLE ELEZIONI (CEPU) ----------
     Si scrivono come un'immagine il cui indirizzo è il link dell'elezione:
        ![didascalia|sx|300|cap](https://ews-rose.vercel.app/CEPU.html?tipo=K&data=12%2F09%2F2023)
     Accetta le stesse opzioni delle immagini (sx / dx / centro / riga (predefinito), larghezza, h…, y…, cap, nobordo) più due solo per i grafici:
     scuro = sfondo scuro · noseggi = solo l'emiciclo, senza legenda (il totale va al centro).
     Lo stile è in wiki.css (sezione «Grafici delle elezioni»).
     Senza didascalia, con "cap" compare "tipo — data" in automatico. Parametro facoltativo: &comune=… */
  _MAPPA_TIPO: { K: 'costituzionale', G: 'assemblea di sezione', C: 'congresso statale', S: 'congresso unitario', D: 'congresso distrettuale', M: 'congresso metropolitano', T: 'congresso regionale', R: 'referendum' },
  _PALETTE: ['#1B5FA8', '#C0392B', '#C9A227', '#2E9E5B', '#7A4FA3', '#E07B39', '#2E77C9', '#8A8F98', '#0B3D6E', '#B85C9E'],
  _gr: {}, _el: {},
  _k: (u, ns, br) => u + (ns ? '|noseggi' : '') + (br ? '|barre' : ''),   // chiave della cache: il testo del grafico cambia solo con noseggi
  eGrafico: url => /\/CEPU\.html\?/i.test(url) && /[?&;]tipo=/i.test(url),
  _dataEl: e => e.data ?? e.Data ?? e.data_elezione ?? e.dataElezione ?? e.date ?? e.anno ?? '',
  /* ---------- TABELLE ----------
     {{tabella Titolo (facoltativo)
     @piena                         tabella a tutta larghezza (senza: larga quanto serve)
     --                             inizio di una nuova riga
     | testo                        cella normale          ! testo = cella d'intestazione
     |{c2 r3 bg:#ffe599 tc:#000000 al:c va:m w:120 b i} testo      opzioni della cella: tutte facoltative, in qualsiasi ordine
     }}
     c2 = occupa 2 colonne · r3 = occupa 3 righe · bg:#rrggbb = colore di sfondo di TUTTA la cella · tc:#rrggbb = colore del testo
     al:s|c|d = testo a sinistra|centro|destra · va:a|m|b = in alto|al centro|in basso · w:120 (px) o w:30% = larghezza · b = grassetto · i = corsivo
     una cella può continuare nelle righe seguenti (a capo); dentro le celle funzionano link [[Pagina]], [testo](https://…) e immagini ![](https://…) */
  tabParse(titolo, linee) {
    const t = { titolo: titolo || '', piena: false, righe: [] }, col = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
    let riga = null, cella = null, m;
    for (const l of linee) {
      const r = l.trim(); if (!r) continue;
      if (/^---?$/.test(r)) { if (riga) t.righe.push(riga); riga = []; cella = null; }
      else if (/^@piena\b/i.test(r)) t.piena = true;
      else if (r[0] === '|' || (r[0] === '!' && r[1] !== '[')) {
        m = /^([|!])(?:\{([^}]*)\})?\s?(.*)$/.exec(r);
        cella = { th: m[1] === '!', t: m[3], cs: 1, rs: 1, bg: '', tc: '', al: '', va: '', w: '', b: false, i: false };
        (m[2] || '').split(/\s+/).forEach(k => {
          let x;
          if ((x = /^c(\d{1,2})$/.exec(k))) cella.cs = Math.min(50, Math.max(1, +x[1]));
          else if ((x = /^r(\d{1,2})$/.exec(k))) cella.rs = Math.min(50, Math.max(1, +x[1]));
          else if ((x = /^bg:(.+)$/.exec(k)) && col.test(x[1])) cella.bg = x[1].toLowerCase();
          else if ((x = /^tc:(.+)$/.exec(k)) && col.test(x[1])) cella.tc = x[1].toLowerCase();
          else if ((x = /^al:([scd])$/.exec(k))) cella.al = x[1];
          else if ((x = /^va:([amb])$/.exec(k))) cella.va = x[1];
          else if ((x = /^w:(\d{1,4})(px|%)?$/.exec(k))) cella.w = x[1] + (x[2] === '%' ? '%' : 'px');
          else if (k === 'b') cella.b = true;
          else if (k === 'i') cella.i = true;
        });
        if (!riga) riga = [];
        riga.push(cella);
      } else if (cella) cella.t += '\n' + r.replace(/^\\(?=[|!@}-])/, '');
    }
    if (riga) t.righe.push(riga);
    return t;
  },
  tabSintassi(t) {   // t = { titolo, piena, righe: [[cella, …], …] }  ->  testo del blocco {{tabella … }}
    const o = ['{{tabella' + (t.titolo ? ' ' + String(t.titolo).replace(/\s+/g, ' ').trim() : '')];
    if (t.piena) o.push('@piena');
    t.righe.forEach(riga => {
      o.push('--');
      riga.forEach(c => {
        const a = [];
        if (c.cs > 1) a.push('c' + c.cs); if (c.rs > 1) a.push('r' + c.rs);
        if (c.bg) a.push('bg:' + c.bg); if (c.tc) a.push('tc:' + c.tc);
        if (c.al) a.push('al:' + c.al); if (c.va) a.push('va:' + c.va);
        if (c.w) a.push('w:' + String(c.w).replace(/px$/, ''));
        if (c.b) a.push('b'); if (c.i) a.push('i');
        const ls = String(c.t || '').replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean);
        o.push((c.th ? '!' : '|') + (a.length ? '{' + a.join(' ') + '}' : '') + (ls.length ? ' ' + ls[0] : ''));
        ls.slice(1).forEach(x => o.push(x.replace(/^(?=[|!@}-])/, '\\')));
      });
    });
    o.push('}}');
    return o.join('\n');
  },
  tabContrasto(bg) {   // colore del testo leggibile (scuro o bianco) sopra uno sfondo #rgb / #rrggbb
    let h = String(bg).slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&');
    const v = [0, 2, 4].map(k => { const x = parseInt(h.substr(k, 2), 16) / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); });
    return .2126 * v[0] + .7152 * v[1] + .0722 * v[2] > .3 ? '#10203a' : '#ffffff';
  },

  _ymd(v) {   // data -> "AAAA-MM-GG" (oppure il solo valore, se è un anno)
    const s = String(v == null ? '' : v).trim(); let m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s))) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    return s;
  },
  _fmtData(v) {
    const y = Wiki._ymd(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(y)) return String(v);
    const d = new Date(y + 'T12:00:00');
    return isNaN(d) ? String(v) : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  },
  _cod(e) {
    if (e.tipo_codice) return String(e.tipo_codice).toUpperCase();
    const t = Wiki.norm(e.tipo);
    return Object.keys(Wiki._MAPPA_TIPO).find(k => t.includes(Wiki.norm(Wiki._MAPPA_TIPO[k]))) || '';
  },
  _perc: v => parseFloat(String(v).replace('%', '').replace(',', '.').trim()) || 0,
  _int: v => parseInt(String(v).replace(/\D/g, ''), 10) || 0,
  _fp: p => p.toFixed(2).replace('.', ',') + '%',
  _col: (p, i) => p.colore || Wiki._PALETTE[i % Wiki._PALETTE.length],

  elezioniDa(origin) {   // elenco elezioni dell'API del sito indicato nel link (una sola richiesta per sito)
    if (!Wiki._el[origin]) {
      Wiki._el[origin] = fetch((origin === location.origin ? '' : origin) + '/api/elezioni')
        .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(d => Array.isArray(d.elezioni) ? d.elezioni : [])
        .catch(err => { delete Wiki._el[origin]; throw err; });
    }
    return Wiki._el[origin];
  },
  async trovaElezione(u) {
    let url; try { url = new URL(String(u).replace(/&amp;/g, '&')); } catch (x) { throw new Error('link non valido'); }
    const p = url.searchParams, tipo = (p.get('tipo') || '').toUpperCase(), data = p.get('data') || '', comune = p.get('comune') || '';
    const lista = await Wiki.elezioniDa(url.origin);
    const ok = lista.filter(e => e && (!tipo || Wiki._cod(e) === tipo) && (!data || Wiki._ymd(Wiki._dataEl(e)) === Wiki._ymd(data)) && (!comune || Wiki.norm(e.comune) === Wiki.norm(comune)));
    if (!ok.length) throw new Error('elezione non trovata');
    return ok[0];
  },

  _gEmiciclo(partiti, ns) {
    const cs = partiti.map((p, i) => ({ p, i, seggi: parseInt(p.seggi, 10) || 0 })).filter(x => x.seggi > 0), n = cs.reduce((a, x) => a + x.seggi, 0);
    const rEst = 220, rInt = 90, cx = 250, cy = 230, righe = Math.max(1, Math.min(14, Math.round(Math.sqrt(n / 2)))), raggi = [];
    for (let r = 0; r < righe; r++) raggi.push(righe === 1 ? (rInt + rEst) / 2 : rInt + (rEst - rInt) * (r / (righe - 1)));
    const peso = raggi.reduce((a, b) => a + b, 0), grezzi = raggi.map(r => (r / peso) * n), perRiga = grezzi.map(Math.floor);
    let ass = perRiga.reduce((a, b) => a + b, 0);
    grezzi.map((g, i) => ({ i, resto: g - perRiga[i] })).sort((a, b) => b.resto - a.resto).forEach(o => { if (ass < n) { perRiga[o.i]++; ass++; } });
    for (let i = 0; i < righe && n >= righe; i++) if (perRiga[i] === 0) { perRiga[perRiga.indexOf(Math.max(...perRiga))]--; perRiga[i]++; }
    const punti = [];
    for (let r = 0; r < righe; r++) for (let s = 0; s < perRiga[r]; s++) {
      const t = perRiga[r] === 1 ? 0.5 : s / (perRiga[r] - 1), ang = Math.PI - t * Math.PI;
      punti.push({ x: cx + raggi[r] * Math.cos(ang), y: cy - raggi[r] * Math.sin(ang), ang });
    }
    punti.sort((a, b) => b.ang - a.ang);
    const spazio = righe > 1 ? (rEst - rInt) / (righe - 1) : (rEst - rInt), rp = Math.max(2.5, Math.min(9, spazio / 2.4));
    let k = 0, cerchi = '';
    cs.forEach(x => { for (let j = 0; j < x.seggi && k < punti.length; j++, k++) cerchi += `<circle cx="${punti[k].x.toFixed(1)}" cy="${punti[k].y.toFixed(1)}" r="${rp.toFixed(1)}" fill="${Wiki.esc(Wiki._col(x.p, x.i))}"><title>${Wiki.esc(x.p.nome)}${ns ? '' : ' (' + x.seggi + ' seggi)'}</title></circle>`; });
    const leg = cs.map(x => `<span><i style="background:${Wiki.esc(Wiki._col(x.p, x.i))}"></i>${Wiki.esc(x.p.nome)}${ns ? '' : ' — ' + x.seggi}</span>`).join('');
    // «solo emiciclo» (noseggi): niente legenda né numeri per partito; il totale va al centro del semicerchio
    const centro = ns ? `<text x="250" y="208" text-anchor="middle" font-size="38" font-weight="900" fill="currentColor">${n}</text><text x="250" y="232" text-anchor="middle" font-size="16" font-weight="700" fill="currentColor">seggi</text>` : '';
    return `<span class="wg-g"><svg viewBox="0 0 500 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Composizione dell'assemblea">${cerchi}${centro}</svg></span>` + (ns ? '' : `<span class="wg-tot">${n} seggi</span><span class="wg-leg">${leg}</span>`);
  },
  _gBarre(partiti, tutti) {   // barre %: usa "percentuale"; se manca, la ricava da voti o seggi
    const haPerc = partiti.some(p => Wiki._perc(p.percentuale) > 0), valore = p => Wiki._int(p.voti) || (parseInt(p.seggi, 10) || 0);
    const base = haPerc ? 0 : (partiti.some(p => Wiki._int(p.voti) > 0) ? 1 : 2), tot = partiti.reduce((a, p) => a + (base === 1 ? Wiki._int(p.voti) : (parseInt(p.seggi, 10) || 0)), 0);
    const r = partiti.map((p, i) => ({ p, i, perc: haPerc ? Wiki._perc(p.percentuale) : (tot ? (base === 1 ? Wiki._int(p.voti) : (parseInt(p.seggi, 10) || 0)) / tot * 100 : 0) })).sort((a, b) => b.perc - a.perc).slice(0, tutti ? 20 : 8)
      .map(x => `<span class="r"><span class="n">${Wiki.esc(x.p.nome)}</span><span class="t"><b style="width:${Math.min(100, x.perc).toFixed(2)}%;background:${Wiki.esc(Wiki._col(x.p, x.i))}"></b></span><span class="p">${Wiki.esc(haPerc && x.p.percentuale != null && x.p.percentuale !== '' ? x.p.percentuale : Wiki._fp(x.perc))}</span></span>`).join('');
    return `<span class="wg-g"><span class="wg-barre">${r}</span></span>`;
  },
  _gReferendum(partiti) {
    const tr = ch => partiti.find(p => ch.includes(Wiki.norm(p.nome)));
    const si = tr(['si', 'yes']) || partiti[0], no = tr(['no']) || partiti.find(p => p !== si);
    if (!si || !no) return Wiki._gBarre(partiti);
    const vSi = Wiki._int(si.voti), vNo = Wiki._int(no.voti);
    let pSi = Wiki._perc(si.percentuale), pNo = Wiki._perc(no.percentuale);
    if (pSi === 0 && pNo === 0 && (vSi + vNo) > 0) { pSi = vSi / (vSi + vNo) * 100; pNo = 100 - pSi; }
    const quota = (pSi + pNo) > 0 ? pSi / (pSi + pNo) * 100 : 50;
    return `<span class="wg-g"><span class="wg-ref"><span class="o s">${Wiki.esc(si.nome)}</span><span class="b"><b style="width:${quota.toFixed(2)}%"></b></span><span class="o n">${Wiki.esc(no.nome)}</span>` +
      `<span class="v">${vSi.toLocaleString('it-IT')}</span><span></span><span class="v">${vNo.toLocaleString('it-IT')}</span><span class="c">${Wiki._fp(pSi)}</span><span></span><span class="c">${Wiki._fp(pNo)}</span></span></span>`;
  },
  graficoElezione(e, ns, br) {
    const cod = Wiki._cod(e), partiti = Array.isArray(e.risultati_partiti) ? e.risultati_partiti : [];
    if (!partiti.length) throw new Error('nessun risultato registrato');
    const conSeggi = partiti.filter(p => (parseInt(p.seggi, 10) || 0) > 0);
    const g = cod === 'R' ? Wiki._gReferendum(partiti) : (conSeggi.length > 1 && !br ? Wiki._gEmiciclo(partiti, ns) : Wiki._gBarre(partiti, br));
    const cap = Wiki.esc(e.tipo || Wiki._MAPPA_TIPO[cod] || 'Elezione') + ' — ' + Wiki.esc(Wiki._fmtData(Wiki._dataEl(e))) + (e.comune && cod !== 'S' && cod !== 'R' ? ' · ' + Wiki.esc(e.comune) : '');
    return { html: `<span class="wg-card">${g}</span>`, cap };
  },
  graficoHtml(o, n, url) {   // segnaposto del grafico: i dati arrivano da Wiki.hydrate()
    const u = url.replace(/&amp;/g, '&'), pos = o.pos || 'in', c = Wiki._gr[Wiki._k(u, o.ns, o.br)];
    const va = { alto: 'text-top', medio: 'middle', basso: 'text-bottom', base: 'baseline' };
    let st = 'width:' + (o.w || '420px') + ';';
    if (pos === 'in') st += (o.va ? 'vertical-align:' + va[o.va] + ';' : '') + (o.y ? 'position:relative;top:' + o.y + 'px;' : '');
    else if (o.y) st += 'margin-top:' + o.y + 'px;';
    const auto = o.cap && !o.didas;
    return `<span class="im im-${pos} wg${o.nob ? ' nb' : ''}${o.dark ? ' wg-d' : ''}${o.h ? ' wg-h' : ''}" style="${st}" data-im="${n}" data-gr="${url}"${c ? ' data-ok="1"' : ''}${auto ? ' data-ac="1"' : ''}${o.ns ? ' data-ns="1"' : ''}${o.br ? ' data-br="1"' : ''}>` +
      `<span class="wg-body"${o.h ? ` style="height:${o.h}px"` : ''}>${c ? c.html : '<span class="wg-msg">Caricamento grafico…</span>'}</span>` +
      (o.cap ? `<span class="cap">${o.didas || (c ? c.cap : '')}</span>` : '') + '</span>';
  },
  async hydrate(root) {   // riempie i segnaposto (parte da sola: vedi _avvia)
    const els = (root || document).querySelectorAll('[data-gr]:not([data-ok])');
    for (const el of els) {
      el.setAttribute('data-ok', '1');
      const u = el.getAttribute('data-gr'), body = el.querySelector('.wg-body'), cap = el.querySelector('.cap');
      try {
        const ns = el.hasAttribute('data-ns'), br = el.hasAttribute('data-br'), r = Wiki.graficoElezione(await Wiki.trovaElezione(u), ns, br);
        Wiki._gr[Wiki._k(u, ns, br)] = r; body.innerHTML = r.html;
        if (cap && el.hasAttribute('data-ac')) cap.innerHTML = r.cap;
      } catch (err) { body.innerHTML = `<span class="wg-msg wg-err">Grafico non disponibile (${Wiki.esc(err.message)})</span>`; }
    }
  },
  _avvia() {
    if (Wiki._avviato) return; Wiki._avviato = true;
    const vai = () => { Wiki.hydrate(document); if (typeof MutationObserver !== 'undefined') new MutationObserver(() => Wiki.hydrate(document)).observe(document.body, { childList: true, subtree: true }); };
    document.body ? vai() : document.addEventListener('DOMContentLoaded', vai);
  },

  /* usata dal bottone "📊 Grafico" della redazione: chiede il link e inserisce il grafico nel testo, dove sta il cursore */
  async inserisciGrafico(ta) {
    const u = (prompt("Incolla il link dell'elezione (es. https://…/CEPU.html?tipo=K&data=12%2F09%2F2023):") || '').trim().replace(/&amp;/g, '&');
    if (!u) return;
    if (!Wiki.eGrafico(u)) { alert('Il link deve essere di una pagina CEPU.html con almeno il parametro tipo=…'); return; }
    try { await Wiki.trovaElezione(u); }
    catch (err) { if (!confirm('Controllo del link: ' + err.message + '.\nInserire comunque il grafico?')) return; }
    const md = '\n\n![|centro|420|cap](' + u + ')\n\n', a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, b = ta.selectionEnd == null ? a : ta.selectionEnd;
    ta.value = ta.value.slice(0, a) + md + ta.value.slice(b);
    ta.selectionStart = ta.selectionEnd = a + md.length; ta.focus();
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    return { i: a + 2, url: u };   // dove si trova il grafico appena inserito
  },

  /* ---------- rendering sicuro del testo (mini-markdown) ----------
     ## Titolo · ### Sottotitolo · **grassetto** · *corsivo* · `codice` · - elenco · 1. elenco numerato
     > citazione · --- linea · [testo](https://...) · ![didascalia](https://immagine) · [[Altra pagina]] · [[Altra pagina|testo]]
     {{infobox Titolo … }} scheda laterale stile Wikipedia (vedi sotto)
     {{tabella … }} tabelle con celle unite e colorate (vedi Wiki.tabParse)
     PIÙ PARTI SULLA STESSA RIGA:  {sx}[<(Costituente)](link) {dx}(I Lex) >   ·   {sx}A {centro}B {dx}C
     ALLINEAMENTO (titoli, paragrafi, citazioni, elenchi, tabelle, infobox):
       {centro} Testo…   {sx} Testo…   {dx} Testo…     a inizio riga: vale per quel blocco (anche se la riga è da sola, vale per il blocco dopo)
       {{centro            ·  {{sx  ·  {{dx            su una riga da sole, chiusi da }}: valgono per tutto ciò che sta in mezzo */
  render(src, pagine) {
    const e = Wiki.esc, trova = n => (pagine || []).find(p => Wiki.norm(p.titolo) === Wiki.norm(n) || p.id === Wiki.slug(n));
    let nImg = 0, inIb = false, nTab = 0;   // nImg: numero progressivo delle immagini (serve alla redazione per aprire l'immagine cliccata)
    const imm = (alt, url) => {
      const o = Wiki.imgOpz(alt), n = nImg++, va = { alto: 'text-top', medio: 'middle', basso: 'text-bottom', base: 'baseline' };
      const fit = o.fit === 'adatta' ? 'contain' : o.fit === 'riempi' ? 'cover' : '';
      const dim = (w, h) => (w ? 'width:' + w + ';' : '') + (h ? 'height:' + h + 'px;' : '') + (fit && w && h ? 'object-fit:' + fit + ';' : '');
      const base = `src="${url}" alt="${o.didas}" loading="lazy"`;
      if (Wiki.eGrafico(url)) return Wiki.graficoHtml(o, n, url);   // link CEPU.html?tipo=…&data=… -> grafico dell'elezione
      if (inIb) return `<img ${base} data-im="${n}"` + (o.w || o.h ? ` style="${o.w ? 'flex:none;' : ''}${dim(o.w, o.h)}${o.h ? 'max-height:none;' : ''}"` : '') + '>';
      if (o.pos === 'in' || (!o.pos && !o.cap)) {
        const s = dim(o.w, o.h) + (o.va ? 'vertical-align:' + va[o.va] + ';' : '') + (o.y ? 'position:relative;top:' + o.y + 'px;' : '') + (o.va || o.y ? 'margin:0 3px;' : '');
        return `<img ${base} data-im="${n}"${o.nob ? ' class="nb"' : ''}${s ? ` style="${s}"` : ''}>`;
      }
      const ss = (o.w ? 'width:' + o.w + ';' : '') + (o.y ? 'margin-top:' + o.y + 'px;' : '');
      const si = (o.w ? 'width:100%;' : '') + (o.h ? 'height:' + o.h + 'px;' : '') + (fit && o.w && o.h ? 'object-fit:' + fit + ';' : '');
      return `<span class="im im-${o.pos || 'c'}${o.nob ? ' nb' : ''}"${ss ? ` style="${ss}"` : ''} data-im="${n}"><img ${base}${si ? ` style="${si}"` : ''}>${o.cap && o.didas ? `<span class="cap">${o.didas}</span>` : ''}</span>`;
    };
    const inl = t => e(t)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, (m, a, u) => imm(a, u))
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => { a = a.replace(/&amp;/g, '&'); const p = trova(a); return p ? `<a href="wiki.html#${p.id}">${b || e(a)}</a>` : `<a class="red" href="redazione-wiki.html?nuova=${encodeURIComponent(a.replace(/&quot;|&#39;|&lt;|&gt;/g, ''))}" title="Pagina non ancora scritta">${b || e(a)}</a>`; })
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    // INFOBOX stile Wikipedia:  {{infobox Titolo  ...righe...  }}
    //   ![alt](url) ![alt](url)  -> riga di immagini (anche più affiancate) · testo semplice -> didascalia centrata
    //   ## Sezione               -> riga di intestazione · Etichetta: valore -> riga dati (se il valore è vuoto la riga non appare)
    const imgRiga = /^(!\[[^\]]*\]\(https?:\/\/[^)\s]+\)\s*)+$/;
    const infobox = (tit, righe) => {
      inIb = true;
      const fila = x => {
        let m;
        if (/^(!\[[^\]]*\]\(https?:\/\/\)\s*)+$/.test(x)) return '';   // segnaposto del modello non ancora compilato
        if (imgRiga.test(x)) return `<tr><td colspan="2" class="ib-img"><div class="ib-imgs">${inl(x)}</div></td></tr>`;
        if ((m = /^#{2,3}\s+(.*)/.exec(x))) return `<tr><th colspan="2" class="ib-h">${inl(m[1])}</th></tr>`;
        if ((m = /^(.+?):(?:\s+(.*))?$/.exec(x))) return (m[2] || '').trim() ? `<tr><th class="ib-l" scope="row">${inl(m[1])}</th><td class="ib-v">${inl(m[2])}</td></tr>` : '';
        return `<tr><td colspan="2" class="ib-c">${inl(x)}</td></tr>`;
      };
      // {sx} {centro} {dx} a inizio riga allineano la riga · {sx}A {dx}B: due (o tre) parti sulla stessa riga
      const rows = righe.map(x => {
        let m, a = '';
        if (!/^(#{2,3}\s|>|---+$)/.test(x) && (m = x.match(TAG)) && (m.length > 1 || x.search(TAG) > 0)) return `<tr><td colspan="2" class="ib-c ib-row">${riga(x)}</td></tr>`;
        if ((m = /^\{(sx|sinistra|dx|destra|centro|centrato)\}\s*/i.exec(x))) { a = ALN[m[1].toLowerCase()]; x = x.slice(m[0].length); if (!x) return ''; }
        const h = fila(x);
        return a && h ? h.replace('<tr>', `<tr class="al-${a}">`) : h;
      }).join('');
      inIb = false;
      return `<table class="ib">${tit ? `<caption class="ib-t">${inl(tit)}</caption>` : ''}<colgroup><col style="width:38%"><col></colgroup><tbody>${rows}</tbody></table>`;
    };
    // TABELLA: {{tabella Titolo … }}  (sintassi in Wiki.tabParse)
    const ALL = { s: 'left', c: 'center', d: 'right' }, VAL = { a: 'top', m: 'middle', b: 'bottom' };
    const tabella = (tit, linee) => {
      const t = Wiki.tabParse(tit, linee), n = nTab++;
      if (!t.righe.length) return '';
      const rows = t.righe.map(riga => '<tr>' + riga.map(c => {
        const st = [], tc = c.tc || (c.bg ? Wiki.tabContrasto(c.bg) : ''), tag = c.th ? 'th' : 'td';
        if (c.bg) st.push('background:' + c.bg);
        if (tc) st.push('color:' + tc);
        if (c.al) st.push('text-align:' + ALL[c.al]);
        if (c.va) st.push('vertical-align:' + VAL[c.va]);
        if (c.w) st.push('width:' + c.w);
        if (c.b) st.push('font-weight:700');
        if (c.i) st.push('font-style:italic');
        return `<${tag}${c.cs > 1 ? ` colspan="${c.cs}"` : ''}${c.rs > 1 ? ` rowspan="${c.rs}"` : ''}${c.bg ? ' class="cb"' : ''}${st.length ? ` style="${st.join(';')}"` : ''}>${inl(c.t).replace(/\n/g, '<br>')}</${tag}>`;
      }).join('') + '</tr>').join('');
      return `<div class="tw"><table class="tbl${t.piena ? ' tfull' : ''}" data-tb="${n}">${tit ? `<caption>${inl(tit)}</caption>` : ''}<tbody>${rows}</tbody></table></div>`;
    };
    const L = String(src || '').replace(/\r/g, '').split('\n'), out = [];
    // ALLINEAMENTO del testo: {sx} {centro} {dx} a inizio riga (vale per quel blocco) · {{centro … }} per più blocchi (vedi sopra)
    const ALN = { sx: 's', sinistra: 's', centro: 'c', centrato: 'c', dx: 'd', destra: 'd' };
    let blocco = '', pend = '', la = '';
    const allinea = (h, a) => h.replace(/^<(\w+)([^>]*)>/, (m, t, at) => /\bclass="/.test(at) ? `<${t}${at.replace('class="', `class="al-${a} `)}>` : `<${t}${at} class="al-${a}">`);
    const TAG = /\{(sx|sinistra|dx|destra|centro|centrato)\}/gi;
    const riga = t => {   // una riga con più parti: {sx}A {centro}B {dx}C  ->  A a sinistra, B al centro, C a destra, sulla stessa riga
      const seg = { s: [], c: [], d: [] }; let a = 's';
      t.split(TAG).forEach((x, k) => { if (k % 2) a = ALN[x.toLowerCase()]; else if (x.trim()) seg[a].push(x.trim()); });
      return `<div class="al-row">${['s', 'c', 'd'].map(k => `<span class="al-${k}">${inl(seg[k].join(' '))}</span>`).join('')}</div>`;
    };
    const add = h => { const a = la || pend || blocco; pend = ''; out.push(a && !/^<hr/.test(h) ? allinea(h, a) : h); };
    for (let i = 0; i < L.length; i++) {
      let r = L[i].trim(), m; la = '';
      if (!r) continue;
      if (r === '}}' && blocco) { blocco = ''; continue; }
      if ((m = /^\{\{\s*(sx|sinistra|dx|destra|centro|centrato)\s*$/i.exec(r))) { blocco = ALN[m[1].toLowerCase()]; continue; }
      if (!/^(#{2,3}\s|>|---+$|\{\{|([-*]|\d+\.)\s)/.test(r) && (m = r.match(TAG)) && (m.length > 1 || r.search(TAG) > 0)) { out.push(riga(r)); pend = ''; continue; }
      if ((m = /^\{(sx|sinistra|dx|destra|centro|centrato)\}\s*/i.exec(r))) { la = ALN[m[1].toLowerCase()]; r = L[i] = r.slice(m[0].length); if (!r) { pend = la; continue; } }
      if (/^\{\{\s*infobox\b/i.test(r)) {
        const tit = r.replace(/^\{\{\s*infobox\b\s*/i, '').replace(/\}\}\s*$/, ''), righe = [];
        if (!/\}\}\s*$/.test(r)) { i++; while (i < L.length && L[i].trim() !== '}}') { if (L[i].trim()) righe.push(L[i].trim()); i++; } }
        add(infobox(tit, righe)); continue;
      }
      if (/^\{\{\s*tabella\b/i.test(r)) {
        const tit = r.replace(/^\{\{\s*tabella\b\s*/i, '').replace(/\}\}\s*$/, ''), linee = [];
        if (!/\}\}\s*$/.test(r)) { i++; while (i < L.length && L[i].trim() !== '}}') linee.push(L[i++]); }
        add(tabella(tit, linee)); continue;
      }
      if ((m = /^(#{2,3})\s+(.*)/.exec(r))) add(`<h${m[1].length} id="s-${Wiki.slug(m[2])}">${inl(m[2])}</h${m[1].length}>`);
      else if (/^---+$/.test(r)) add('<hr>');
      else if (r[0] === '>') { const q = []; while (i < L.length && L[i].trim()[0] === '>') q.push(inl(L[i++].trim().replace(/^>\s?/, ''))); i--; add(`<blockquote>${q.join('<br>')}</blockquote>`); }
      else if (/^([-*]|\d+\.)\s/.test(r)) {
        const ol = /^\d/.test(r), it = []; while (i < L.length && /^([-*]|\d+\.)\s/.test(L[i].trim())) it.push(`<li>${inl(L[i++].trim().replace(/^([-*]|\d+\.)\s+/, ''))}</li>`); i--;
        add(`<${ol ? 'ol' : 'ul'}>${it.join('')}</${ol ? 'ol' : 'ul'}>`);
      } else { const p = []; while (i < L.length && L[i].trim() && !/^(#{2,3}\s|>|---+$|\{\{|\}\}$|\{(?:sx|sinistra|dx|destra|centro|centrato)\}|([-*]|\d+\.)\s)/.test(L[i].trim()) && !/\{(?:sx|sinistra|dx|destra|centro|centrato)\}/i.test(L[i])) p.push(inl(L[i++].trim())); i--; add(`<p>${p.join('<br>')}</p>`); }
    }
    return out.join('\n');
  },

  /* ---------- client API (stesso schema di api.js, endpoint /api/wiki) ---------- */
  _s: { token: null, username: null },
  loadCredentials() { try { const r = sessionStorage.getItem('wiki_sessione'); if (r) this._s = JSON.parse(r); } catch (e) {} return this._s; },
  clearCredentials() { this._s = { token: null, username: null }; try { sessionStorage.removeItem('wiki_sessione'); } catch (e) {} },
  isAuthenticated() { return !!this._s.token; },
  async _post(corpo) {
    const h = { 'Content-Type': 'application/json' };
    if (this._s.token) h.Authorization = 'Bearer ' + this._s.token;
    const res = await fetch('/api/wiki', { method: 'POST', headers: h, body: JSON.stringify(corpo) });
    const d = await res.json().catch(() => ({}));
    if (res.status === 401 && corpo.azione !== 'login' && corpo.azione !== 'estji') this.clearCredentials();
    if (!res.ok) throw new Error(d.message || 'HTTP ' + res.status);
    return d;
  },
  async load() {
    const res = await fetch('/api/wiki'); const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.message ? `HTTP ${res.status}: ${d.message}` : 'HTTP ' + res.status);
    return Array.isArray(d.pagine) ? d.pagine : [];
  },
  async login(username, password) {
    const d = await this._post({ azione: 'login', username, password });
    if (!d.success) throw new Error(d.message || 'Credenziali errate');
    this._s = { token: d.token, username }; try { sessionStorage.setItem('wiki_sessione', JSON.stringify(this._s)); } catch (e) {}
    return d;
  },
  async loginEstji(id_token) {   // accesso con Estji ID (QR): restituisce il nome dell'utente
    const d = await this._post({ azione: 'estji', id_token });
    if (!d.success) throw new Error(d.message || 'Accesso non riuscito');
    this._s = { token: d.token, username: d.username }; try { sessionStorage.setItem('wiki_sessione', JSON.stringify(this._s)); } catch (e) {}
    return d.username;
  },
  salvaPagina(pagina, idPrecedente) { return this._post({ azione: 'salva', pagina, idPrecedente }); },
  eliminaPagina(id) { return this._post({ azione: 'elimina', id }); }
};
Wiki.loadCredentials();
Wiki._avvia();

/* ---------- mobile: indice chiuso di default + "Articoli principali" nascosti (solo <= 720px, via CSS) ---------- */
Wiki.mobileSidebar = function () {
  const toc = document.getElementById('toc'); if (!toc) return;
  const grp = toc.closest('.sb-group') || toc.parentElement;
  // "Articoli principali": visibili solo su desktop
  const pr = document.getElementById('principali');
  if (pr) {
    const g = pr.closest('.sb-group');
    if (g && g !== grp && !g.contains(toc)) g.classList.add('solo-desk');
    else { pr.classList.add('solo-desk'); const h = pr.previousElementSibling; if (h && h.classList.contains('sb-head')) h.classList.add('solo-desk'); }
  }
  // indice: l'intestazione diventa un pulsante che apre/chiude
  let head = grp.querySelector(':scope > .sb-head');
  if (!head) { head = document.createElement('button'); head.type = 'button'; head.className = 'sb-head'; head.textContent = 'Indice'; grp.insertBefore(head, toc); }
  head.classList.add('sb-toggle'); head.setAttribute('role', 'button'); head.tabIndex = 0;
  const set = o => { grp.classList.toggle('toc-open', o); head.setAttribute('aria-expanded', o ? 'true' : 'false'); };
  set(false);
  const flip = () => set(!grp.classList.contains('toc-open'));
  head.addEventListener('click', flip);
  head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
};
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', () => Wiki.mobileSidebar()) : Wiki.mobileSidebar();

/* ---------- redazione: pulsanti per l'allineamento (niente codice da scrivere) ----------
   Compare da sola sopra l'editor (#fTesto). Funzioni di testo pure sotto, la barra in Wiki.barraAllinea. */
Wiki._TAGg = /\{(sx|sinistra|dx|destra|centro|centrato)\}/gi;
Wiki._ALN = { sx: 's', sinistra: 's', centro: 'c', centrato: 'c', dx: 'd', destra: 'd' };
Wiki._righe = v => { const L = String(v).split('\n'), off = []; let o = 0; L.forEach(l => { off.push(o); o += l.length + 1; }); return { L, off }; };
Wiki._blocchi = L => {   // intervalli {{infobox|tabella … }} (t:'b') e {{sx|centro|dx … }} (t:'w')
  const bl = []; let w = null;
  for (let i = 0; i < L.length; i++) {
    const t = L[i].trim().replace(/^\{(?:sx|sinistra|dx|destra|centro|centrato)\}\s*/i, '');
    if (/^\{\{\s*(infobox|tabella)\b/i.test(t)) {
      let e = i; if (!/\}\}\s*$/.test(t)) { e = i + 1; while (e < L.length && L[e].trim() !== '}}') e++; if (e >= L.length) e = L.length - 1; }
      bl.push({ t: 'b', k: /^\{\{\s*infobox/i.test(t) ? 'i' : 't', s: i, e }); i = e; continue;
    }
    if (/^\{\{\s*(sx|sinistra|dx|destra|centro|centrato)\s*$/i.test(L[i].trim())) { w = { t: 'w', s: i, e: L.length - 1, chiuso: false }; continue; }
    if (w && L[i].trim() === '}}') { w.e = i; w.chiuso = true; bl.push(w); w = null; }
  }
  if (w) bl.push(w);
  return bl;
};
Wiki._parti = l => {   // riga con più parti? -> { s, c, d } altrimenti null (stessa regola di Wiki.render)
  const t = l.trim();
  if (/^(#{2,3}\s|>|---+$|\{\{|([-*]|\d+\.)\s)/.test(t)) return null;
  const m = t.match(Wiki._TAGg);
  if (!m || !(m.length > 1 || t.search(Wiki._TAGg) > 0)) return null;
  const seg = { s: '', c: '', d: '' }; let a = 's';
  t.split(Wiki._TAGg).forEach((x, k) => { if (k % 2) a = Wiki._ALN[x.toLowerCase()]; else if (x.trim()) seg[a] += (seg[a] ? ' ' : '') + x.trim(); });
  return seg;
};
// al = 's' | 'c' | 'd' | '' (toglie). Restituisce { ini, fine, testo }: sostituire v.slice(ini, fine) con testo.
//  · parte di una riga selezionata -> la riga si divide: prima a sinistra, selezione dove scegli, resto a destra (stessa riga)
//  · righe dentro un infobox       -> si spostano solo quelle righe, non tutto l'infobox
//  · altrove                       -> blocchi interi (paragrafi, titoli, tabelle, infobox, {{centro … }})
Wiki.allineaTesto = (v, a, b, al) => {
  const { L, off } = Wiki._righe(v), bl = Wiki._blocchi(L), NM = { s: 'sx', c: 'centro', d: 'dx' };
  const lineOf = p => { let i = 0; while (i + 1 < L.length && off[i + 1] <= p) i++; return i; };
  const ra = lineOf(a), rb = lineOf(b > a && v[b - 1] === '\n' ? b - 1 : b);
  const inB = i => bl.find(y => y.t === 'b' && i >= y.s && i <= y.e);
  const fin = (r0, r1, righe) => ({ ini: off[r0], fine: off[r1] + L[r1].length, testo: righe.join('\n') });
  const TAG1 = /\{(?:sx|sinistra|dx|destra|centro|centrato)\}/i;
  const clean = t => t.replace(Wiki._TAGg, ' ').replace(/ {2,}/g, ' ').trim();
  const strip = l => TAG1.test(l) ? clean(l) : l;
  const B0 = inB(ra), B1 = inB(rb);

  // 1) selezionata solo una parte di una riga
  if (al && b > a && ra === rb) {
    const l = L[ra], x0 = a - off[ra], x1 = b - off[ra], sel = clean(l.slice(x0, x1)), tutto = clean(l);
    const dato = B0 && B0.k === 'i' && ra > B0.s && ra < B0.e && /^(.+?):(?:\s+(.*))?$/.test(tutto);   // riga "Etichetta: valore" dell'infobox
    if (sel && sel !== tutto && !(B0 && B0.k === 't') && !dato && !/^(#{2,3}\s|>|---+$|\{\{|([-*]|\d+\.)\s)/.test(tutto)) {
      const Z = { s: [], c: [], d: [] }, put = (z, t) => { t = clean(t); if (t) Z[z].push(t); };
      put('s', l.slice(0, x0)); put(al, l.slice(x0, x1)); put('d', l.slice(x1));
      return fin(ra, ra, [['s', 'c', 'd'].filter(z => Z[z].length).map(z => `{${NM[z]}}${Z[z].join(' ')}`).join(' ')]);
    }
  }

  // 2) righe dentro un infobox: solo quelle righe
  if (B0 && B0 === B1 && B0.k === 'i' && B0.s < B0.e && ra > B0.s) {
    const r1 = Math.min(rb, B0.e - 1);
    if (ra <= r1) return fin(ra, r1, L.slice(ra, r1 + 1).map(l => { const c = strip(l); return c.trim() && al ? `{${NM[al]}} ${c}` : c; }));
  }

  // 3) blocchi interi
  let i0 = ra, i1 = rb, x;
  if ((x = inB(i0))) i0 = x.s; if ((x = inB(i1))) i1 = x.e;
  // selezionato un intero blocco {{centro … }} (o cursore sulla sua prima riga): cambio/tolgo quel blocco
  const W = bl.find(y => y.t === 'w' && y.s === i0 && (y.e === i1 || i0 === i1));
  if (W) {
    const fine = W.e, inner = L.slice(W.s + 1, W.chiuso ? fine : fine + 1);
    return fin(W.s, fine, al ? [`{{${NM[al]}`, ...inner, ...(W.chiuso ? ['}}'] : [])] : inner);
  }
  const isH = t => /^#{2,3}\s/.test(t.trim()), isHr = t => /^---+$/.test(t.trim());
  const wrapLine = k => bl.some(y => y.t === 'w' && (y.s === k || (y.chiuso && y.e === k)));
  const out = [];
  for (let k = i0; k <= i1; k++) {
    const bk = inB(k), cur = strip(L[k]);
    if ((bk && k !== bk.s) || wrapLine(k) || !cur.trim() || isHr(cur)) { out.push(bk && k !== bk.s ? L[k] : cur); continue; }
    const prev = k > 0 ? strip(L[k - 1]) : '';
    const inizio = k === 0 || !prev.trim() || isH(prev) || isHr(prev) || isH(cur) || !!inB(k - 1) || wrapLine(k - 1);
    out.push(inizio && al ? `{${NM[al]}} ${cur.trimStart()}` : cur);
  }
  return fin(i0, i1, out);
};
// riga a più parti: inserisce (o aggiorna, se il cursore è già su una riga a più parti) {sx}A {centro}B {dx}C
Wiki.allineaRiga = (v, pos, s, c, d) => {
  const { L, off } = Wiki._righe(v), bl = Wiki._blocchi(L);
  const parti = [['sx', s], ['centro', c], ['dx', d]].filter(p => (p[1] || '').trim()).map(p => `{${p[0]}}${p[1].trim().replace(/\s*\n\s*/g, ' ')}`).join(' ');
  if (!parti) return null;
  let i = 0; while (i + 1 < L.length && off[i + 1] <= pos) i++;
  if (Wiki._parti(L[i])) return { ini: off[i], fine: off[i] + L[i].length, testo: parti };
  const b = bl.find(y => y.t === 'b' && i >= y.s && i <= y.e), e = !b ? i : (b.k === 'i' && b.s < b.e) ? Math.min(i, b.e - 1) : b.e, sep = (parti.match(/\{/g) || []).length < 2 && (L[e + 1] || '').trim() ? '\n' : '';
  return { ini: off[e] + L[e].length, fine: off[e] + L[e].length, testo: '\n' + parti + sep };
};

Wiki.barraAllinea = function () {
  const ta = document.getElementById('fTesto'); if (!ta || ta.dataset.al) return; ta.dataset.al = '1';
  const bar = document.createElement('div'); bar.className = 'tb-grp'; bar.id = 'alBar';
  bar.innerHTML = '<span>Allinea</span>' +
    '<button type="button" class="btn" data-al="s" title="Allinea a sinistra la riga/e selezionata/e">⬅ Sinistra</button>' +
    '<button type="button" class="btn" data-al="c" title="Centra">↔ Centro</button>' +
    '<button type="button" class="btn" data-al="d" title="Allinea a destra">Destra ➡</button>' +
    '<button type="button" class="btn" data-al="" title="Torna all\'allineamento normale">✖ Togli</button>' +
    '<span class="al-sep">Stessa riga</span>' +
    '<input type="text" id="alS" placeholder="Parte a sinistra" aria-label="Parte a sinistra">' +
    '<input type="text" id="alC" placeholder="Parte al centro" aria-label="Parte al centro">' +
    '<input type="text" id="alD" placeholder="Parte a destra" aria-label="Parte a destra">' +
    '<button type="button" class="btn" id="alRiga" title="Inserisce una riga con le parti negli spazi compilati">Inserisci riga</button>';
  const cont = ta.closest('.edcols') || ta.closest('.ed') || ta;
  cont.parentNode.insertBefore(bar, cont);
  const $ = id => document.getElementById(id), btn = $('alRiga');
  const applica = r => {   // sostituisce il tratto di testo mantenendo annulla (Ctrl+Z) e aggiornamento dei colori/anteprima
    if (!r) return;
    ta.focus(); ta.setSelectionRange(r.ini, r.fine);
    if (!document.execCommand || !document.execCommand('insertText', false, r.testo)) { ta.setRangeText(r.testo, r.ini, r.fine, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    ta.setSelectionRange(r.ini, r.ini + r.testo.length);
  };
  const sync = () => {   // cursore su una riga a più parti: riempie i tre campi e il pulsante diventa "Aggiorna riga"
    const { L, off } = Wiki._righe(ta.value); let i = 0; while (i + 1 < L.length && off[i + 1] <= ta.selectionStart) i++;
    const p = Wiki._parti(L[i]);
    if (p) { $('alS').value = p.s; $('alC').value = p.c; $('alD').value = p.d; }
    btn.textContent = p ? 'Aggiorna riga' : 'Inserisci riga';
  };
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'alRiga') applica(Wiki.allineaRiga(ta.value, ta.selectionStart, $('alS').value, $('alC').value, $('alD').value));
    else if (b.hasAttribute('data-al')) applica(Wiki.allineaTesto(ta.value, ta.selectionStart, ta.selectionEnd, b.dataset.al));
    sync();
  });
  ['keyup', 'click', 'focus'].forEach(ev => ta.addEventListener(ev, sync));
};
if (typeof document !== 'undefined') {
  const avviaBarra = () => Wiki.barraAllinea();
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', avviaBarra) : avviaBarra();
  window.addEventListener('load', avviaBarra);
}
