/* estji-login.js — widget "Accedi con Estji ID": mostra un QR, il telefono conferma, il sito riceve un token firmato.
   Uso:  EstjiLogin.mount('#estji-login', { clientId:'unitext', scopes:['profile.basic','unitext.edit'], onLogin: res => {...} })
   onLogin riceve { claims, id_token }. */
(function () {
  var BASE = new URL(document.currentScript.src).origin;
  var QRLIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
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

  window.EstjiLogin = {
    mount: function (sel, o) {
      var box = document.querySelector(sel), timer = null, vivo = true;
      var msg = function (t, rinnova) {
        box.innerHTML = '<p style="margin:8px 0">' + esc(t) + '</p>' + (rinnova ? '<button type="button" id="ej-nuovo">Nuovo codice QR</button>' : '');
        var b = box.querySelector('#ej-nuovo'); if (b) b.onclick = avvia;
      };
      function avvia() {
        clearInterval(timer); box.textContent = 'Preparo il codice QR…';
        var verifier = hex(crypto.getRandomValues(new Uint8Array(32)));
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (h) {
          return Promise.all([post({ azione: 'richiedi', client_id: o.clientId, scopes: o.scopes, vh: hex(h) }), libreria()]);
        }).then(function (r) {
          var q = r[0], qr = window.qrcode(0, 'M'); qr.addData(q.qr_payload); qr.make();
          box.innerHTML = '<div style="width:180px;background:#fff;padding:8px;border-radius:6px">' + qr.createSvgTag(4) + '</div>' +
            '<p style="margin:8px 0;font-size:.9em">Inquadralo con il telefono e conferma l\'accesso.</p>' +
            (q.numero ? '<p style="margin:8px 0">Numero di controllo: <b style="font-size:1.3em">' + q.numero + '</b></p>' : '');
          var fine = Date.now() + q.expires_in * 1000;
          timer = setInterval(function () {
            if (!vivo || !document.body.contains(box)) return clearInterval(timer);
            if (Date.now() > fine) { clearInterval(timer); return msg('Il codice è scaduto.', true); }
            post({ azione: 'stato', id: q.id, verifier: verifier }).then(function (s) {
              if (s.stato === 'approvata') { clearInterval(timer); box.textContent = 'Accesso confermato…'; o.onLogin({ claims: s.claims, id_token: s.id_token }); }
              else if (s.stato === 'rifiutata') { clearInterval(timer); msg('Accesso rifiutato dal telefono.', true); }
              else if (s.stato === 'scaduta') { clearInterval(timer); msg('Il codice è scaduto.', true); }
            }).catch(function () {});
          }, 2000);
        }).catch(function (e) { msg(e.message || 'QR non disponibile.', true); });
      }
      avvia();
    }
  };
})();
