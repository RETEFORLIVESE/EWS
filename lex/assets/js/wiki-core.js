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
     alto / medio / basso / base = allineamento verticale rispetto alle parole (in riga) · y-10 / y15 = sposta su/giù di N px
     cap = mostra la didascalia sotto · nobordo = senza bordo · adatta / riempi = come riempire il riquadro se larghezza e altezza sono fisse */
  imgOpz(alt) {
    const [d, ...r] = String(alt || '').split('|').map(s => s.trim());
    const o = { didas: d || '', w: '', h: '', pos: '', va: '', y: 0, cap: false, nob: false, fit: '' };
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
    return '![' + p.join('|') + '](' + url + ')';
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
      return `<table class="ib">${tit ? `<caption class="ib-t">${inl(tit)}</caption>` : ''}<tbody>${rows}</tbody></table>`;
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
