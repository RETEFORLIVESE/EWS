// assets/js/wiki-core.js — libreria condivisa da wiki.html e redazione-wiki.html
// (stessa logica di sessione di api.js: token firmato in sessionStorage, header Authorization: Bearer)
const Wiki = {
  esc: t => (t == null ? '' : String(t)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
  norm: t => (t || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
  slug: t => Wiki.norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60),
  data: it => { const d = new Date(it); return isNaN(d) ? '' : d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }); },

  /* ---------- immagini ----------
     Sintassi:  ![didascalia](https://indirizzo){w=300 h=200 pos=dx fit=cover did=no bordo=no tondo=si ombra=si}
       w     larghezza: 300 (px) oppure 50%          h     altezza in px (ritaglia con fit)
       pos   blocco (default) | centro | sx | dx | intera   → sx/dx = immagine a lato, il testo scorre attorno
       fit   cover (default, ritaglia) | contain          did=no  nasconde la didascalia
       bordo=no  toglie il bordo     tondo=si  angoli arrotondati     ombra=si  aggiunge l'ombra
     Su una riga da sola diventa una figura; dentro un paragrafo resta in linea (pos e did non si applicano). */
  IMG_POS: ['blocco', 'centro', 'sx', 'dx', 'intera'],
  imgRe: () => /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)(?:\{([^}]*)\})?/g,
  imgSolo: /^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)(?:\{([^}]*)\})?$/,
  imgOpt(s) {
    const o = {};
    String(s || '').split(/\s+/).forEach(kv => {
      const i = kv.indexOf('='); if (i < 1) return;
      const k = kv.slice(0, i), v = kv.slice(i + 1);
      if (k === 'w' && /^\d{1,4}(px|%)?$/.test(v)) o.w = /%$/.test(v) ? v : parseInt(v, 10) + 'px';
      else if (k === 'h' && /^\d{1,4}(px)?$/.test(v)) o.h = parseInt(v, 10) + 'px';
      else if (k === 'pos' && Wiki.IMG_POS.includes(v)) o.pos = v;
      else if (k === 'fit' && (v === 'cover' || v === 'contain')) o.fit = v;
      else if (['did', 'bordo', 'tondo', 'ombra'].includes(k) && (v === 'si' || v === 'no')) o[k] = v;
    });
    return o;
  },
  imgBuild(alt, url, o) {
    const k = [];
    if (o.w) k.push('w=' + o.w.replace(/px$/, ''));
    if (o.h) { k.push('h=' + o.h.replace(/px$/, '')); if (o.fit === 'contain') k.push('fit=contain'); }
    if (o.pos && o.pos !== 'blocco') k.push('pos=' + o.pos);
    if (o.did === 'no') k.push('did=no');
    if (o.bordo === 'no') k.push('bordo=no');
    if (o.tondo === 'si') k.push('tondo=si');
    if (o.ombra === 'si') k.push('ombra=si');
    return `![${alt}](${url})` + (k.length ? `{${k.join(' ')}}` : '');
  },
  // alt e url arrivano già "escapati"; le opzioni sono validate da imgOpt, quindi lo stile generato è sicuro
  imgHtml(alt, url, opz, blocco, n) {
    const o = Wiki.imgOpt(opz), cls = [], st = [];
    if (o.h) { st.push('height:' + o.h, 'object-fit:' + (o.fit || 'cover')); }
    if (o.bordo === 'no') cls.push('nb'); if (o.tondo === 'si') cls.push('rd'); if (o.ombra === 'si') cls.push('sh');
    if (!blocco) {
      if (o.w) st.push('width:' + o.w);
      return `<img src="${url}" alt="${alt}" loading="lazy" data-img="${n}"${cls.length ? ` class="${cls.join(' ')}"` : ''}${st.length ? ` style="${st.join(';')}"` : ''}>`;
    }
    const pos = o.pos || 'blocco', fig = ['im', 'im-' + pos], fs = [];
    if (o.w && pos !== 'intera') { fs.push('width:' + o.w); fig.push('fw'); }
    const did = alt && o.did !== 'no' ? `<figcaption>${alt}</figcaption>` : '';
    return `<figure class="${fig.join(' ')}"${fs.length ? ` style="${fs.join(';')}"` : ''}><img src="${url}" alt="${alt}" loading="lazy" data-img="${n}"${cls.length ? ` class="${cls.join(' ')}"` : ''}${st.length ? ` style="${st.join(';')}"` : ''}>${did}</figure>`;
  },

  /* ---------- titoli e indice ---------- */
  // testo "pulito" di un titolo (senza immagini, link, grassetti)
  plain: t => String(t || '').replace(/!\[[^\]]*\]\([^)]*\)(\{[^}]*\})?/g, '').replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim(),
  // elenco dei titoli ## e ### con identificativi univoci (usato sia da render sia da indice)
  titoli(src) {
    const usati = {}, out = [];
    String(src || '').replace(/\r/g, '').split('\n').forEach(l => {
      const m = /^(#{2,3})\s+(.*)/.exec(l.trim()); if (!m) return;
      const testo = Wiki.plain(m[2]) || 'Sezione'; let id = Wiki.slug(testo) || 'sezione';
      usati[id] = (usati[id] || 0) + 1; if (usati[id] > 1) id += '-' + usati[id];
      out.push({ liv: m[1].length, raw: m[2], testo, id: 's-' + id });
    });
    return out;
  },
  // indice in HTML: ## = voci principali, ### = sotto-voci (vuoto se la pagina ha meno di 2 titoli)
  indice(src) {
    const t = Wiki.titoli(src); if (t.length < 2) return '';
    let h = '', aperto = false, sub = false;
    const voce = x => `<li><a href="#${x.id}" data-s="${x.id}">${Wiki.esc(x.testo)}</a>`;
    t.forEach(x => {
      if (x.liv === 3 && aperto) { if (!sub) { h += '<ol>'; sub = true; } h += voce(x) + '</li>'; }
      else { if (sub) { h += '</ol>'; sub = false; } if (aperto) h += '</li>'; h += voce(x); aperto = true; }
    });
    if (sub) h += '</ol>'; if (aperto) h += '</li>';
    return `<details class="toc" open><summary>Indice <span>${t.length} sezioni</span></summary><ol>${h}</ol></details>`;
  },

  /* ---------- rendering sicuro del testo (mini-markdown) ----------
     ## Titolo · ### Sottotitolo · **grassetto** · *corsivo* · `codice` · - elenco · 1. elenco numerato
     > citazione · --- linea · [testo](https://...) · ![didascalia](https://immagine){opzioni} · [[Altra pagina]] · [[Altra pagina|testo]]
     | a | b | tabelle (la 2ª riga |---|---| separa l'intestazione) */
  render(src, pagine) {
    const e = Wiki.esc, trova = n => (pagine || []).find(p => Wiki.norm(p.titolo) === Wiki.norm(n) || p.id === Wiki.slug(n));
    let n = 0; // numero progressivo delle immagini (la redazione lo usa per collegare anteprima e testo)
    const titoli = Wiki.titoli(src); let ti = 0;
    const inl = t => e(t)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)(?:\{([^}]*)\})?/g, (m, a, u, o) => Wiki.imgHtml(a, u, o, false, n++))
      .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, a, b) => { a = a.replace(/&amp;/g, '&'); const p = trova(a); return p ? `<a href="wiki.html#${p.id}">${b || e(a)}</a>` : `<a class="red" href="redazione-wiki.html?nuova=${encodeURIComponent(a.replace(/&quot;|&#39;|&lt;|&gt;/g, ''))}" title="Pagina non ancora scritta">${b || e(a)}</a>`; })
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const L = String(src || '').replace(/\r/g, '').split('\n'), out = [];
    const STOP = /^(#{2,3}\s|>|\||---+$|([-*]|\d+\.)\s|!\[[^\]]*\]\(https?:\/\/[^)\s]+\)(\{[^}]*\})?$)/;
    for (let i = 0; i < L.length; i++) {
      const r = L[i].trim(); let m;
      if (!r) continue;
      if ((m = /^(#{2,3})\s+(.*)/.exec(r))) { const t = titoli[ti++]; out.push(`<h${m[1].length} id="${t ? t.id : 's-' + Wiki.slug(m[2])}">${inl(m[2])}</h${m[1].length}>`); }
      else if (/^---+$/.test(r)) out.push('<hr>');
      else if ((m = Wiki.imgSolo.exec(r))) out.push(Wiki.imgHtml(e(m[1]), e(m[2]), m[3], true, n++));
      else if (r[0] === '>') { const q = []; while (i < L.length && L[i].trim()[0] === '>') q.push(inl(L[i++].trim().replace(/^>\s?/, ''))); i--; out.push(`<blockquote>${q.join('<br>')}</blockquote>`); }
      else if (r[0] === '|') {
        const rows = []; while (i < L.length && L[i].trim()[0] === '|') rows.push(L[i++].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())); i--;
        const head = rows[1] && rows[1].every(c => /^:?-+:?$/.test(c)); const body = rows.slice(head ? 2 : 0);
        out.push(`<div class="tw"><table>${head ? `<thead><tr>${rows[0].map(c => `<th>${inl(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${body.map(x => `<tr>${x.map(c => `<td>${inl(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      } else if (/^([-*]|\d+\.)\s/.test(r)) {
        const ol = /^\d/.test(r), it = []; while (i < L.length && /^([-*]|\d+\.)\s/.test(L[i].trim())) it.push(`<li>${inl(L[i++].trim().replace(/^([-*]|\d+\.)\s+/, ''))}</li>`); i--;
        out.push(`<${ol ? 'ol' : 'ul'}>${it.join('')}</${ol ? 'ol' : 'ul'}>`);
      } else { const p = []; while (i < L.length && L[i].trim() && !STOP.test(L[i].trim())) p.push(inl(L[i++].trim())); i--; out.push(`<p>${p.join('<br>')}</p>`); }
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
