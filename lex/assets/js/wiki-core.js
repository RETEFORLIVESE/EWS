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
     | a | b | tabelle (la 2ª riga |---|---| separa l'intestazione) */
  render(src, pagine) {
    const e = Wiki.esc, trova = n => (pagine || []).find(p => Wiki.norm(p.titolo) === Wiki.norm(n) || p.id === Wiki.slug(n));
    let nImg = 0, inIb = false;   // nImg: numero progressivo delle immagini (serve alla redazione per aprire l'immagine cliccata)
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
      const rows = righe.map(x => {
        let m;
        if (/^(!\[[^\]]*\]\(https?:\/\/\)\s*)+$/.test(x)) return '';   // segnaposto del modello non ancora compilato
        if (imgRiga.test(x)) return `<tr><td colspan="2" class="ib-img"><div class="ib-imgs">${inl(x)}</div></td></tr>`;
        if ((m = /^#{2,3}\s+(.*)/.exec(x))) return `<tr><th colspan="2" class="ib-h">${inl(m[1])}</th></tr>`;
        if ((m = /^(.+?):(?:\s+(.*))?$/.exec(x))) return (m[2] || '').trim() ? `<tr><th class="ib-l" scope="row">${inl(m[1])}</th><td class="ib-v">${inl(m[2])}</td></tr>` : '';
        return `<tr><td colspan="2" class="ib-c">${inl(x)}</td></tr>`;
      }).join('');
      inIb = false;
      return `<table class="ib">${tit ? `<caption class="ib-t">${inl(tit)}</caption>` : ''}<colgroup><col style="width:38%"><col></colgroup><tbody>${rows}</tbody></table>`;
    };
    const L = String(src || '').replace(/\r/g, '').split('\n'), out = [];
    for (let i = 0; i < L.length; i++) {
      const r = L[i].trim(); let m;
      if (!r) continue;
      if (/^\{\{\s*infobox\b/i.test(r)) {
        const tit = r.replace(/^\{\{\s*infobox\b\s*/i, '').replace(/\}\}\s*$/, ''), righe = [];
        if (!/\}\}\s*$/.test(r)) { i++; while (i < L.length && L[i].trim() !== '}}') { if (L[i].trim()) righe.push(L[i].trim()); i++; } }
        out.push(infobox(tit, righe)); continue;
      }
      if ((m = /^(#{2,3})\s+(.*)/.exec(r))) out.push(`<h${m[1].length} id="s-${Wiki.slug(m[2])}">${inl(m[2])}</h${m[1].length}>`);
      else if (/^---+$/.test(r)) out.push('<hr>');
      else if (r[0] === '>') { const q = []; while (i < L.length && L[i].trim()[0] === '>') q.push(inl(L[i++].trim().replace(/^>\s?/, ''))); i--; out.push(`<blockquote>${q.join('<br>')}</blockquote>`); }
      else if (r[0] === '|') {
        const rows = []; while (i < L.length && L[i].trim()[0] === '|') rows.push(L[i++].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())); i--;
        const head = rows[1] && rows[1].every(c => /^:?-+:?$/.test(c)); const body = rows.slice(head ? 2 : 0);
        out.push(`<div class="tw"><table>${head ? `<thead><tr>${rows[0].map(c => `<th>${inl(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${body.map(x => `<tr>${x.map(c => `<td>${inl(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      } else if (/^([-*]|\d+\.)\s/.test(r)) {
        const ol = /^\d/.test(r), it = []; while (i < L.length && /^([-*]|\d+\.)\s/.test(L[i].trim())) it.push(`<li>${inl(L[i++].trim().replace(/^([-*]|\d+\.)\s+/, ''))}</li>`); i--;
        out.push(`<${ol ? 'ol' : 'ul'}>${it.join('')}</${ol ? 'ol' : 'ul'}>`);
      } else { const p = []; while (i < L.length && L[i].trim() && !/^(#{2,3}\s|>|\||---+$|\{\{|([-*]|\d+\.)\s)/.test(L[i].trim())) p.push(inl(L[i++].trim())); i--; out.push(`<p>${p.join('<br>')}</p>`); }
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
    if (res.status === 401 && corpo.azione !== 'login') this.clearCredentials();
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
  salvaPagina(pagina, idPrecedente) { return this._post({ azione: 'salva', pagina, idPrecedente }); },
  eliminaPagina(id) { return this._post({ azione: 'elimina', id }); }
};
Wiki.loadCredentials();
Wiki._avvia();