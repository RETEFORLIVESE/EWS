/* estji-login.js — widget "Accedi con Estji ID".
   - Da computer: mostra un QR, il telefono conferma, il sito riceve un token firmato.
   - Da telefono (o con il link sotto il QR): pulsante "Apri Estji ID su questo dispositivo",
     si conferma nella pagina di Estji ID e si torna al sito, che riceve il token.
   Uso:  EstjiLogin.mount('#estji-login', { clientId:'unitext', scopes:['profile.basic','unitext.edit'], onLogin: res => {...} })
   onLogin riceve { claims, id_token }. */
(function () {
  var BASE = new URL(document.currentScript.src).origin;
  var QRLIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  var CHIAVE = 'ej_richiesta';   // richiesta in corso, per riprenderla se la scheda viene ricaricata
  var touch = !!(window.matchMedia && window.matchMedia('(pointer:coarse)').matches);
  var hex = function (b) { return Array.from(new Uint8Array(b)).map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); };
  var post = function (b) {
    return fetch(BASE + '/api/estji', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Errore ' + r.status); return d; }); });
  };
  var libreria = function () {
    if (window.qrcode) return Promise.resolve();
    return new Promise(function (ok, ko) { var s = document.createElement('script'); s.src = QRLIB; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
  };
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var STILE_BTN = 'display:block;box-sizing:border-box;width:100%;padding:.8rem;border-radius:4px;text-align:center;' +
    'text-decoration:none;font-weight:700;background:var(--blu-700,#12508c);color:#fff;';

  window.EstjiLogin = {
    mount: function (sel, o) {
      var box = document.querySelector(sel), timer = null, vivo = true, req = null, inVolo = false;

      var salva = function () { try { sessionStorage.setItem(CHIAVE, JSON.stringify(req)); } catch (e) {} };
      var pulisci = function () { clearInterval(timer); try { sessionStorage.removeItem(CHIAVE); } catch (e) {} };

      var msg = function (t, rinnova) {
        box.innerHTML = '<p style="margin:8px 0">' + esc(t) + '</p>' +
          (rinnova ? '<button type="button" id="ej-nuovo">' + (touch ? 'Riprova' : 'Nuovo codice QR') + '</button>' : '');
        var b = box.querySelector('#ej-nuovo'); if (b) b.onclick = avvia;
      };

      function controlla() {
        if (!req || inVolo) return;
        if (!vivo || !document.body.contains(box)) { req = null; return pulisci(); }
        if (Date.now() > req.fine) { req = null; pulisci(); return msg('La richiesta è scaduta.', true); }
        var corrente = req;
        inVolo = true;
        post({ azione: 'stato', id: corrente.id, verifier: corrente.verifier }).then(function (s) {
          if (req !== corrente) return;
          if (s.stato === 'approvata') { req = null; pulisci(); box.textContent = 'Accesso confermato…'; o.onLogin({ claims: s.claims, id_token: s.id_token }); }
          else if (s.stato === 'rifiutata') { req = null; pulisci(); msg('Accesso rifiutato.', true); }
          else if (s.stato === 'scaduta') { req = null; pulisci(); msg('La richiesta è scaduta.', true); }
        }).catch(function () {}).then(function () { inVolo = false; });
      }

      function parti() { clearInterval(timer); timer = setInterval(controlla, 2000); controlla(); }

      // Mostra QR (computer) o pulsante (telefono) per la richiesta q = {id, verifier, fine, link, numero, cid}
      function mostra(q) {
        req = q; salva();
        var link = /^https:\/\//.test(q.link) ? q.link : '#';
        var num = q.numero
          ? '<p style="margin:8px 0">Numero di controllo: <b style="font-size:1.3em">' + esc(q.numero) + '</b></p>'
          : '';
        var apri = '<a href="' + esc(link) + '" target="_blank" rel="noopener" id="ej-apri" style="' + STILE_BTN + '">Apri Estji ID su questo dispositivo</a>';
        return (touch ? Promise.resolve() : libreria()).then(function () {
          if (touch) {
            box.innerHTML = apri + num +
              '<p style="margin:8px 0;font-size:.9em">' + (q.numero ? 'Nella pagina che si apre scegli questo numero e conferma. ' : 'Conferma l\'accesso nella pagina che si apre. ') +
              'Poi torna a questa scheda.</p>';
          } else {
            var qr = window.qrcode(0, 'M'); qr.addData(q.link); qr.make();
            box.innerHTML = '<div style="width:180px;background:#fff;padding:8px;border-radius:6px">' + qr.createSvgTag(4) + '</div>' +
              '<p style="margin:8px 0;font-size:.9em">Inquadralo con il telefono e conferma l\'accesso.</p>' + num +
              '<p style="margin:8px 0;font-size:.85em">oppure <a href="' + esc(link) + '" target="_blank" rel="noopener">apri Estji ID su questo dispositivo</a></p>';
          }
          parti();
        });
      }

      function avvia() {
        pulisci(); req = null; box.textContent = 'Preparo la richiesta…';
        var verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (h) {
          return post({ azione: 'richiedi', client_id: o.clientId, scopes: o.scopes, vh: hex(h) });
        }).then(function (q) {
          return mostra({ id: q.id, verifier: verifier, fine: Date.now() + q.expires_in * 1000, link: q.qr_payload, numero: q.numero, cid: o.clientId });
        }).catch(function (e) { msg(e.message || 'Estji ID non disponibile.', true); });
      }

      // Tornando sulla scheda (es. dopo aver confermato su Estji ID) controlla subito, senza aspettare il timer
      document.addEventListener('visibilitychange', function () { if (!document.hidden && req) controlla(); });

      // Se la scheda è stata ricaricata durante una richiesta ancora valida, la riprende
      var salvata = null;
      try { salvata = JSON.parse(sessionStorage.getItem(CHIAVE)); } catch (e) {}
      if (salvata && salvata.id && salvata.verifier && salvata.cid === o.clientId && salvata.fine > Date.now()) {
        mostra(salvata).catch(function (e) { msg(e.message || 'Estji ID non disponibile.', true); });
      } else {
        avvia();
      }
    }
  };
})();