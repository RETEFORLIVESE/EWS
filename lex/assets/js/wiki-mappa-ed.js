/* assets/js/wiki-mappa-ed.js — editor grafico delle mappe di linea ({{mappa … }}) per redazione-wiki.html
   Si attiva da solo: aggiunge il pulsante 🚆 Mappa alla barra del testo e il pannello sopra l'editor.
   Il testo è sempre la fonte: a ogni modifica il blocco viene riscritto con Wiki.mapSintassi (vedi wiki-core.js). */
(function () {
  const W = window.Wiki, $ = id => document.getElementById(id), ta = $('fTesto'), tools = $('tools');
  if (!W || !ta || !tools || $('mpPanel')) return;
  const E = W.esc, COL = ['#c62828', '#e57373', '#1e65c8', '#2e9e5b', '#ff9800', '#7e57c2', '#616161', '#000000'];
  let mp = null, sel = null, cur = { r: 0, c: 0 }, busy = false;

  /* ---- pulsante + pannello ---- */
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn'; btn.id = 'btnMappa'; btn.textContent = '🚆 Mappa';
  btn.title = 'Crea una mappa di linea (stazioni e binari), o modifica quella sotto il cursore';
  ($('btnTab') || tools.lastElementChild).insertAdjacentElement('afterend', btn);
  const P = (v, t, ti) => `<button type="button" class="btn" data-m="p" data-v="${E(v)}" title="${ti}">${t}</button>`;
  const pan = document.createElement('div');
  pan.className = 'panel'; pan.id = 'mpPanel'; pan.hidden = true; pan.style.margin = '6px 0 10px';
  pan.innerHTML =
    '<div class="bar" id="mpTit">Mappa di linea</div>' +
    '<div class="cols"><div><label for="mpTitolo">Titolo (facoltativo)</label><input id="mpTitolo" maxlength="150" autocomplete="off"></div>' +
    '<div><label>Colonne del disegno</label><div style="display:flex;gap:6px;align-items:center"><button type="button" class="btn" data-m="col-">−</button><b id="mpN">1</b><button type="button" class="btn" data-m="col+">+</button>' +
    '<span style="margin-left:10px">Colore linee</span><input type="color" id="mpDef" value="#c62828" style="width:34px;height:28px;padding:0"></div></div></div>' +
    '<label class="chk"><input type="checkbox" id="mpPiena"> Larghezza piena</label>' +
    '<div class="tb-bar mpe-pal">' +
    '<div class="tb-grp"><span>Casella: linee</span>' + P('v', '│', 'Verticale') + P('u', '╵', 'Metà alta') + P('d', '╷', 'Metà bassa') + P('h', '─', 'Orizzontale') + P('l', '╴', 'Metà sinistra') + P('r', '╶', 'Metà destra') +
    P('\\', '╲', 'Diagonale: dall\'alto di questa casella al basso di quella a destra') + P('/', '╱', 'Diagonale: dal basso di questa casella all\'alto di quella a destra') + '</div>' +
    '<div class="tb-grp"><span>Stazione</span>' + P('S', '●', 'Stazione') + P('H', '•', 'Fermata') + P('O', '○', 'Interscambio') + P('~', '┄ Galleria', 'Linea tratteggiata') + P('', '🧹', 'Svuota la casella') + '</div>' +
    '<div class="tb-grp"><span>Colore casella</span><input type="color" id="mpCol" value="#c62828">' + COL.map(c => `<button type="button" class="tb-sw" style="background:${c}" data-m="col" data-v="${c}" title="${c}"></button>`).join('') + '<button type="button" class="btn" data-m="col" data-v="">Predefinito</button></div>' +
    '<div class="tb-grp"><span>Righe</span><button type="button" class="btn" data-m="add">＋ Sotto</button><button type="button" class="btn" data-m="addh">＋ Intestazione</button><button type="button" class="btn" data-m="dup">⎘</button><button type="button" class="btn" data-m="up">↑</button><button type="button" class="btn" data-m="down">↓</button><button type="button" class="btn del" data-m="del">🗑</button></div>' +
    '</div>' +
    '<p class="note">Clicca una casella e scegli i pezzi: ogni pezzo si accende/spegne. Le righe senza stazione hanno il testo piccolo. Nel testo puoi usare <code>[[Pagina]]</code>.</p>' +
    '<div id="mpGrid"></div>' +
    '<div class="chips"><button type="button" class="btn pri" data-m="fine">Fatto</button><button type="button" class="btn del" data-m="rimuovi">Rimuovi mappa</button></div>';
  (ta.closest('.edcols') || ta).parentNode.insertBefore(pan, ta.closest('.edcols') || ta);

  /* ---- modello ---- */
  const ncol = () => Math.max(1, ...mp.righe.map(r => (r.ic || []).length));
  const pad = () => { const n = ncol(); mp.righe.forEach(r => { if (r.ic) while (r.ic.length < n) r.ic.push('.'); }); };
  const tokCur = () => { const r = mp && mp.righe[cur.r]; return r && r.ic ? W.mapTok(r.ic[cur.c]) : null; };
  function commit() {
    const code = W.mapSintassi(mp); busy = true;
    ta.value = ta.value.slice(0, sel.i) + code + ta.value.slice(sel.f); sel.f = sel.i + code.length;
    ta.dispatchEvent(new Event('input', { bubbles: true })); busy = false;
  }
  function draw() {
    pad(); cur.r = Math.min(cur.r, mp.righe.length - 1); cur.c = Math.min(cur.c, ncol() - 1);
    $('mpN').textContent = ncol(); $('mpTitolo').value = mp.titolo; $('mpPiena').checked = mp.piena; $('mpDef').value = /^#[0-9a-f]{6}$/i.test(mp.colore) ? mp.colore : '#c62828';
    $('mpGrid').innerHTML = `<div class="mpe" style="--c:${E(mp.colore)}">` + mp.righe.map((r, i) => r.h != null
      ? `<div class="mpe-row hd${i === cur.r ? ' act' : ''}" data-r="${i}"><button type="button" class="mpe-n" data-m="row">${i + 1}</button><input class="mpe-h" value="${E(r.h)}" placeholder="Titolo della sezione"></div>`
      : `<div class="mpe-row${i === cur.r ? ' act' : ''}" data-r="${i}"><button type="button" class="mpe-n" data-m="row">${i + 1}</button><div class="mpe-ic">` +
        r.ic.map((k, c) => `<button type="button" class="mpe-c${i === cur.r && c === cur.c ? ' sel' : ''}" data-m="cell" data-c="${c}" title="Casella ${c + 1}">${W.mapTile(k)}</button>`).join('') +
        `</div><input class="mpe-km" value="${E(r.km)}" placeholder="km"><input class="mpe-tx" value="${E(r.t)}" placeholder="Nome della stazione / nota"></div>`).join('') + '</div>';
    sync();
  }
  function sync() {
    const o = tokCur(); pan.querySelectorAll('[data-m="p"]').forEach(b => {
      const v = b.dataset.v; b.classList.toggle('on', !!o && (v === '~' ? o.t : v === 'v' ? /u/.test(o.p) && /d/.test(o.p) : v === 'h' ? /l/.test(o.p) && /r/.test(o.p) : !!v && o.p.includes(v)));
    });
    if (o && o.c) $('mpCol').value = o.c.length === 4 ? o.c.replace(/#(.)(.)(.)/, '#$1$1$2$2$3$3') : o.c;
  }
  function edit(fn) { const r = mp.righe[cur.r], o = r && r.ic && tokCur(); if (!o) return; fn(o); r.ic[cur.c] = W.mapTokStr(o); commit(); draw(); }
  function toggle(v) {
    edit(o => {
      if (v === '') { o.p = ''; o.t = false; o.c = ''; return; }
      if (v === '~') { o.t = !o.t; return; }
      const has = k => o.p.includes(k), del = k => { o.p = o.p.split(k).join(''); };
      if (v === 'v' || v === 'h') { const [a, b] = v === 'v' ? ['u', 'd'] : ['l', 'r']; if (has(a) && has(b)) { del(a); del(b); } else { del(a); del(b); o.p += a + b; } }
      else if ('SHO'.includes(v)) { const was = has(v); 'SHO'.split('').forEach(del); if (!was) o.p += v; }
      else if (has(v)) del(v); else o.p += v;
    });
  }
  function nuovo(ic) { return { ic: ic.map(k => { const o = W.mapTok(k); o.p = o.p.replace(/[SHO]/g, ''); return W.mapTokStr(o); }), km: '', t: '' }; }

  /* ---- apertura / chiusura ---- */
  function apri(b) {
    const v = ta.value;
    if (b) {
      const L = b.testo.split('\n'), lin = L.slice(1); if (lin.length && lin[lin.length - 1].trim() === '}}') lin.pop();
      mp = W.mapParse(L[0].trim().replace(/^\{\{\s*mappa\b\s*/i, '').replace(/\}\}\s*$/, ''), lin); sel = { i: b.i, f: b.f };
      if (/\}\}\s*$/.test(L[0].trim()) && L.length === 1) sel.f = b.f;
    } else {
      mp = { titolo: 'Stazioni e fermate', colore: '#c62828', piena: false, righe: [
        { ic: ['dS'], km: '0+000', t: 'Prima stazione' }, { ic: ['v'], km: '', t: 'Linea per …' }, { ic: ['vS'], km: '', t: 'Seconda stazione' }, { ic: ['uS'], km: '', t: 'Capolinea' }] };
      const p = ta.selectionStart == null ? v.length : ta.selectionStart, pre = p === 0 ? '' : '\n\n', code = W.mapSintassi(mp);
      busy = true; ta.value = v.slice(0, p) + pre + code + '\n\n' + v.slice(p); sel = { i: p + pre.length, f: p + pre.length + code.length };
      ta.dispatchEvent(new Event('input', { bubbles: true })); busy = false;
    }
    if (!mp.righe.length) mp.righe.push({ ic: ['v'], km: '', t: '' });
    cur = { r: 0, c: 0 }; pan.hidden = false; $('mpTit').textContent = b ? 'Modifica mappa' : 'Nuova mappa'; draw(); pan.scrollIntoView({ block: 'nearest' });
  }
  function chiudi() { mp = null; sel = null; pan.hidden = true; }

  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => { const p = ta.selectionStart; apri(W.mapBlocchi(ta.value).find(x => p >= x.i && p <= x.f) || null); });
  const prev = $('anteprima');
  if (prev) prev.addEventListener('click', e => {
    const m = e.target.closest('[data-mp]'); if (!m || e.target.closest('a')) return;
    const b = W.mapBlocchi(ta.value)[+m.dataset.mp]; if (b) apri(b);
  });
  ta.addEventListener('input', () => { if (!busy && mp) chiudi(); });   // testo modificato a mano: il pannello non è più allineato

  /* ---- azioni ---- */
  pan.addEventListener('click', e => {
    const b = e.target.closest('[data-m]'); if (!b || !mp) return; const a = b.dataset.m, r = cur.r;
    if (a === 'fine') return chiudi();
    if (a === 'rimuovi') { if (!confirm('Rimuovere questa mappa dal testo?')) return; busy = true; ta.value = ta.value.slice(0, sel.i) + ta.value.slice(sel.f + (ta.value[sel.f] === '\n' ? 1 : 0)); ta.dispatchEvent(new Event('input', { bubbles: true })); busy = false; return chiudi(); }
    if (a === 'cell') { cur = { r: +b.closest('.mpe-row').dataset.r, c: +b.dataset.c }; return draw(); }
    if (a === 'row') { cur.r = +b.closest('.mpe-row').dataset.r; return draw(); }
    if (a === 'p') return toggle(b.dataset.v);
    if (a === 'col') return edit(o => { o.c = b.dataset.v; });
    if (a === 'col+') { mp.righe.forEach(x => x.ic && x.ic.push('.')); }
    else if (a === 'col-') { if (ncol() < 2) return; mp.righe.forEach(x => x.ic && x.ic.length > 1 && x.ic.pop()); }
    else if (a === 'add') { const x = mp.righe[r]; mp.righe.splice(r + 1, 0, nuovo(x && x.ic ? x.ic : Array(ncol()).fill('.'))); cur.r = r + 1; }
    else if (a === 'addh') { mp.righe.splice(r + 1, 0, { h: 'Nuova sezione' }); cur.r = r + 1; }
    else if (a === 'dup') { mp.righe.splice(r + 1, 0, JSON.parse(JSON.stringify(mp.righe[r]))); cur.r = r + 1; }
    else if (a === 'up' && r > 0) { [mp.righe[r - 1], mp.righe[r]] = [mp.righe[r], mp.righe[r - 1]]; cur.r = r - 1; }
    else if (a === 'down' && r < mp.righe.length - 1) { [mp.righe[r + 1], mp.righe[r]] = [mp.righe[r], mp.righe[r + 1]]; cur.r = r + 1; }
    else if (a === 'del') { if (mp.righe.length < 2) return; mp.righe.splice(r, 1); cur.r = Math.max(0, r - 1); }
    else return;
    commit(); draw();
  });
  pan.addEventListener('input', e => {
    if (!mp) return; const t = e.target, row = t.closest('.mpe-row'), i = row ? +row.dataset.r : -1;
    if (t.id === 'mpTitolo') mp.titolo = t.value;
    else if (t.id === 'mpPiena') mp.piena = t.checked;
    else if (t.id === 'mpDef') { mp.colore = t.value; commit(); return draw(); }
    else if (t.id === 'mpCol') return edit(o => { o.c = t.value; });
    else if (i >= 0 && t.classList.contains('mpe-km')) mp.righe[i].km = t.value;
    else if (i >= 0 && t.classList.contains('mpe-tx')) mp.righe[i].t = t.value;
    else if (i >= 0 && t.classList.contains('mpe-h')) mp.righe[i].h = t.value;
    else return;
    commit();
  });
})();