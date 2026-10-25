// assets/js/redazione-corte.js — redazione della Corte: pubblica modifiche, annullamenti, abrogazioni
(function () {
  const { esc, diffArticoli, commiDi, eTitolo } = CorteDiff;
  const root = () => document.getElementById("redazione-root");
  let elenco = [], pronunce = [];
  let atto = null, originale = [], articoli = [], tipo = "modifica";

  const copia = o => JSON.parse(JSON.stringify(o));
  const lettera = i => String.fromCharCode(97 + (i % 26));
  const ETICHETTE = { modifica: "Modifica", annullamento: "Annullamento", abrogazione: "Abrogazione" };
  const ETICHETTA_STATO = { vigente: "vigente", annullato: "annullato", abrogato: "abrogato", stesura: "in stesura" };

  function normalizza(lista) {
    return lista.map(a => eTitolo(a)
      ? { tipo: "titolo", testo: a.testo || "" }
      : { numero: String(a.numero == null ? "" : a.numero), rubrica: a.rubrica || "", commi: commiDi(a).map(c => ({ testo: c.testo, sottocommi: [...c.sottocommi] })) });
  }
  function messaggio(t, errore) {
    const el = document.getElementById("msg"); if (!el) return;
    el.textContent = t; el.style.display = t ? "block" : "none";
    el.style.background = errore ? "#fdeceb" : ""; el.style.color = errore ? "#a72e23" : "";
  }
  function prossimoNumero(anno) {
    const n = pronunce.filter(p => String(p.anno) === String(anno)).map(p => parseInt(p.numero, 10)).filter(Number.isFinite);
    return n.length ? Math.max(...n) + 1 : 1;
  }

  /* ---------- viste ---------- */
  function vistaMenu() {
    atto = null;
    root().innerHTML = `
      <p class="breadcrumb"><a href="corte.html">Pronunce</a> &rsaquo; Redazione</p>
      <h1 style="margin-bottom:4px;">Redazione della Corte</h1>
      <p style="color:var(--inchiostro-tenue);max-width:62ch;margin-top:0;">Ogni pronuncia pubblicata viene applicata subito all'atto nel database condiviso: sarà visibile su NormAktiv e su questo sito.</p>
      <div class="redazione-menu" style="grid-template-columns:repeat(2,1fr);">
        <button type="button" class="redazione-card" data-vai="scegli"><span class="redazione-card__numero">1</span>
          <span class="redazione-card__titolo">Nuova pronuncia</span>
          <span class="redazione-card__desc">Modifica un atto, oppure annullalo o abrogalo.</span></button>
        <button type="button" class="redazione-card" data-vai="pubblicate"><span class="redazione-card__numero">2</span>
          <span class="redazione-card__titolo">Pronunce pubblicate</span>
          <span class="redazione-card__desc">Consulta quelle già emesse (${pronunce.length}).</span></button>
      </div>`;
  }

  function vistaPubblicate() {
    root().innerHTML = `
      <p class="breadcrumb"><a href="#" data-vai="menu">Redazione</a> &rsaquo; Pronunce pubblicate</p><h1>Pronunce pubblicate</h1>
      ${pronunce.map(p => `<div class="redazione-riga"><div>
        <span class="badge-tipo ${esc(p.tipo)}">${ETICHETTE[p.tipo] || esc(p.tipo)}</span>
        <p class="redazione-riga__titolo">Sentenza n. ${esc(p.numero)}/${esc(p.anno)} — ${esc(p.oggetto)}</p>
        <p class="redazione-riga__meta">${esc(p.atto.titolo)} &middot; ${esc(p.data)}</p></div>
        <div class="redazione-riga__azioni"><a class="redazione-btn redazione-btn--piccolo redazione-btn--secondario" href="corte.html?id=${encodeURIComponent(p.id)}">Apri</a></div></div>`).join("") || "<p>Nessuna pronuncia pubblicata.</p>"}
      <p style="margin-top:20px;"><button type="button" class="redazione-btn redazione-btn--secondario" data-vai="menu">&larr; Torna al menu</button></p>`;
  }

  function vistaScegli() {
    root().innerHTML = `
      <p class="breadcrumb"><a href="#" data-vai="menu">Redazione</a> &rsaquo; Scegli l'atto</p>
      <div class="corte-passi"><span class="on">1. Atto</span><span>2. Pronuncia</span><span>3. Pubblicazione</span></div>
      <h1>Su quale atto interviene la Corte?</h1>
      <input type="text" id="filtro" placeholder="Filtra per titolo o categoria&hellip;" style="width:100%;max-width:420px;padding:10px 14px;border:1px solid var(--bordo);border-radius:var(--radius);font-family:var(--font-chrome);margin-bottom:16px;" />
      <div id="lista-atti">${[...elenco].sort((a, b) => (a.titolo || "").localeCompare(b.titolo || "")).map(a => `
        <div class="redazione-riga"><div>
          <span class="badge-categoria">${esc(a.categoria)}</span>
          <span class="badge-stato ${a.stato === "vigente" ? "" : "abrogato"}">${esc(ETICHETTA_STATO[a.stato] || a.stato || "vigente")}</span>
          <p class="redazione-riga__titolo">${esc(a.titolo)}</p>
          <p class="redazione-riga__meta">n. ${esc(a.numero)}/${esc(a.anno)} &middot; ${a.nArticoli} articoli</p></div>
          <div class="redazione-riga__azioni"><button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--primario" data-atto="${esc(a.id)}">Seleziona</button></div></div>`).join("")}</div>`;
  }

  function vistaPronuncia() {
    const anno = new Date().getFullYear();
    const bloccato = atto.stato === "annullato";
    const solo = atto.stato === "abrogato";
    if (bloccato) { root().innerHTML = `<p class="breadcrumb"><a href="#" data-vai="scegli">&larr; Scegli un altro atto</a></p><div class="avviso-redazione">L'atto «${esc(atto.titolo)}» è già stato annullato: non può essere ulteriormente modificato.</div>`; return; }
    if (solo && tipo !== "annullamento") tipo = "annullamento";
    const t = (v, titolo, desc) => `<label><input type="radio" name="tipo" value="${v}" ${tipo === v ? "checked" : ""} ${solo && v !== "annullamento" ? "disabled" : ""}><b>${titolo}</b><small>${desc}</small></label>`;
    root().innerHTML = `
      <p class="breadcrumb"><a href="#" data-vai="scegli">&larr; Scegli un altro atto</a></p>
      <div class="corte-passi"><span>1. Atto</span><span class="on">2. Pronuncia</span><span>3. Pubblicazione</span></div>
      <h1>${esc(atto.titolo)}</h1>
      <p style="color:var(--inchiostro-tenue);margin-top:0;">${esc(atto.categoria)} n. ${esc(atto.numero)}/${esc(atto.anno)} &middot; stato attuale: <strong>${esc(ETICHETTA_STATO[atto.stato] || atto.stato || "vigente")}</strong></p>
      ${solo ? `<div class="avviso-redazione">L'atto è già abrogato: la Corte può soltanto annullarlo.</div>` : ""}
      <p id="msg" class="redazione-messaggio" style="display:none;"></p>
      <form id="form" class="redazione-form" novalidate>
        <div class="tipo-scelta">
          ${t("modifica", "Modifica", "Cambia il testo degli articoli")}
          ${t("annullamento", "Annullamento", "L'atto è nullo (stato «annullato»)")}
          ${t("abrogazione", "Abrogazione", "L'atto cessa di avere effetto («abrogato»)")}
        </div>
        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-anno">Anno</label><input type="text" id="f-anno" value="${anno}"></div>
          <div class="redazione-campo"><label for="f-numero">Numero sentenza</label><input type="text" id="f-numero" value="${prossimoNumero(anno)}"></div>
          <div class="redazione-campo"><label for="f-data">Data</label><input type="text" id="f-data" placeholder="es. 25 ottobre ${anno}" value="${new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}"></div>
        </div>
        <div class="redazione-campo"><label for="f-oggetto">Oggetto della pronuncia</label><input type="text" id="f-oggetto" placeholder="es. Illegittimità dell'articolo 4"></div>
        <div class="redazione-campo"><label for="f-motivazione">Motivazione</label><textarea id="f-motivazione" rows="6"></textarea></div>
        <div class="redazione-campo"><label for="f-dispositivo">Dispositivo</label><textarea id="f-dispositivo" rows="3" placeholder="es. La Corte dichiara l'illegittimità costituzionale dell'art. 4 e lo sostituisce con il testo seguente."></textarea></div>
        <div class="redazione-riga-campi">
          <div class="redazione-campo"><label for="f-effetto">Effetti (facoltativo)</label><input type="text" id="f-effetto" placeholder="es. dal giorno della pubblicazione"></div>
          <div class="redazione-campo"><label for="f-collegio">Collegio (facoltativo)</label><input type="text" id="f-collegio" placeholder="es. Presidente e giudici"></div>
        </div>
        <div id="area-articoli"></div>
        <div class="redazione-azioni-form">
          <button type="submit" class="redazione-btn redazione-btn--primario">⚖ Pubblica la pronuncia</button>
          <button type="button" class="redazione-btn redazione-btn--secondario" data-vai="menu">Annulla</button>
        </div>
      </form>`;
    disegnaArticoli();
  }

  /* ---------- editor articoli (solo per le modifiche) ---------- */
  function htmlArticolo(a, i) {
    if (eTitolo(a)) return `<div class="redazione-titolo-gruppo redazione-blocco" data-i="${i}">
      <div class="redazione-articolo__intestazione"><span>Titolo di gruppo</span>
        <button type="button" class="redazione-btn redazione-btn--piccolo" data-su="${i}">↑</button><button type="button" class="redazione-btn redazione-btn--piccolo" data-giu="${i}">↓</button>
        <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi="${i}" style="margin-left:auto;">Rimuovi</button></div>
      <input type="text" class="redazione-titolo-testo" data-campo="titolo" data-i="${i}" value="${esc(a.testo)}"></div>`;
    return `<div class="redazione-articolo redazione-blocco" data-i="${i}">
      <div class="redazione-articolo__intestazione"><span>Articolo</span>
        <input type="text" data-campo="numero" data-i="${i}" value="${esc(a.numero)}" style="width:70px;">
        <button type="button" class="redazione-btn redazione-btn--piccolo" data-su="${i}">↑</button><button type="button" class="redazione-btn redazione-btn--piccolo" data-giu="${i}">↓</button>
        <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rimuovi="${i}" style="margin-left:auto;">Sopprimi articolo</button></div>
      <input type="text" data-campo="rubrica" data-i="${i}" placeholder="Rubrica" value="${esc(a.rubrica)}">
      <div class="redazione-commi">${a.commi.map((c, ic) => `
        <div class="redazione-comma">
          <div class="redazione-comma__intestazione"><span class="redazione-comma__numero">Comma ${ic + 1}</span>
            <button type="button" class="redazione-btn redazione-btn--piccolo" data-add-sotto="${i}.${ic}">+ sottocomma</button>
            <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rim-comma="${i}.${ic}" style="margin-left:auto;">Rimuovi comma</button></div>
          <textarea class="redazione-comma-testo" data-campo="comma" data-i="${i}" data-c="${ic}" rows="3">${esc(c.testo)}</textarea>
          <div class="redazione-sottocommi">${c.sottocommi.map((s, is) => `
            <div class="redazione-sottocomma"><span class="redazione-sottocomma__lettera">${lettera(is)})</span>
              <textarea class="redazione-sottocomma-testo" data-campo="sotto" data-i="${i}" data-c="${ic}" data-s="${is}" rows="1">${esc(s)}</textarea>
              <button type="button" class="redazione-btn redazione-btn--piccolo redazione-btn--pericolo" data-rim-sotto="${i}.${ic}.${is}">✕</button></div>`).join("")}</div>
        </div>`).join("")}</div>
      <button type="button" class="redazione-btn redazione-btn--secondario redazione-btn--piccolo" data-add-comma="${i}">+ Aggiungi comma</button></div>`;
  }

  function disegnaArticoli() {
    const box = document.getElementById("area-articoli");
    if (tipo !== "modifica") {
      box.innerHTML = `<div class="avviso-redazione">${tipo === "annullamento"
        ? "L'atto verrà dichiarato <strong>nullo</strong>: su NormAktiv resterà consultabile, con un avviso in evidenza."
        : "L'atto verrà <strong>abrogato</strong>: su NormAktiv resterà consultabile, con un avviso in evidenza."}</div>`;
      return;
    }
    box.innerHTML = `<h3>Testo dell'atto</h3>
      <p style="color:var(--inchiostro-tenue);font-size:.9rem;margin-top:0;">Modifica direttamente il testo: la Corte pubblicherà le differenze rispetto alla versione vigente.</p>
      <div id="blocchi">${articoli.map(htmlArticolo).join("")}</div>
      <div class="redazione-riga-campi">
        <button type="button" class="redazione-btn redazione-btn--secondario" id="add-art">+ Nuovo articolo</button>
        <button type="button" class="redazione-btn redazione-btn--secondario" id="add-tit">+ Titolo di gruppo</button></div>
      <div class="anteprima-modifiche" id="anteprima"></div>`;
    aggiornaAnteprima();
  }

  function aggiornaAnteprima() {
    const el = document.getElementById("anteprima"); if (!el) return;
    const d = diffArticoli(originale, articoli);
    el.innerHTML = d.length
      ? `<strong>${d.length} ${d.length === 1 ? "modifica rilevata" : "modifiche rilevate"}:</strong><ul>${d.map(m => `<li>${esc(m.riferimento)} — ${esc(m.azione.replace("-", " "))}</li>`).join("")}</ul>`
      : "Nessuna modifica rispetto al testo vigente.";
  }

  /* ---------- eventi ---------- */
  function sposta(i, dir) { const j = i + dir; if (j < 0 || j >= articoli.length) return; [articoli[i], articoli[j]] = [articoli[j], articoli[i]]; disegnaArticoli(); }

  async function apriAtto(id) {
    try {
      atto = await CorteAPI.atto(id);
      originale = normalizza(atto.articoli || []); articoli = copia(originale); tipo = "modifica";
      vistaPronuncia();
    } catch (e) { alert("Errore: " + e.message); }
  }

  function initEventi() {
    const r = root();
    r.addEventListener("click", async e => {
      const v = e.target.closest("[data-vai]");
      if (v) { e.preventDefault(); const x = v.dataset.vai; x === "menu" ? vistaMenu() : x === "scegli" ? vistaScegli() : vistaPubblicate(); window.scrollTo(0, 0); return; }
      const a = e.target.closest("[data-atto]"); if (a) return apriAtto(a.dataset.atto);
      const su = e.target.closest("[data-su]"); if (su) return sposta(+su.dataset.su, -1);
      const giu = e.target.closest("[data-giu]"); if (giu) return sposta(+giu.dataset.giu, 1);
      const rim = e.target.closest("[data-rimuovi]");
      if (rim) { const i = +rim.dataset.rimuovi; if (eTitolo(articoli[i]) || confirm(`Sopprimere l'articolo ${articoli[i].numero}?`)) { articoli.splice(i, 1); disegnaArticoli(); } return; }
      const ac = e.target.closest("[data-add-comma]"); if (ac) { articoli[+ac.dataset.addComma].commi.push({ testo: "", sottocommi: [] }); return disegnaArticoli(); }
      const rc = e.target.closest("[data-rim-comma]");
      if (rc) { const [i, c] = rc.dataset.rimComma.split(".").map(Number); if (articoli[i].commi.length <= 1) return alert("Deve rimanere almeno un comma."); articoli[i].commi.splice(c, 1); return disegnaArticoli(); }
      const as = e.target.closest("[data-add-sotto]"); if (as) { const [i, c] = as.dataset.addSotto.split(".").map(Number); articoli[i].commi[c].sottocommi.push(""); return disegnaArticoli(); }
      const rs = e.target.closest("[data-rim-sotto]"); if (rs) { const [i, c, s] = rs.dataset.rimSotto.split(".").map(Number); articoli[i].commi[c].sottocommi.splice(s, 1); return disegnaArticoli(); }
      if (e.target.id === "add-art") {
        const n = articoli.filter(x => !eTitolo(x)).map(x => parseInt(x.numero, 10)).filter(Number.isFinite);
        articoli.push({ numero: String(n.length ? Math.max(...n) + 1 : 1), rubrica: "", commi: [{ testo: "", sottocommi: [] }] }); return disegnaArticoli();
      }
      if (e.target.id === "add-tit") { articoli.push({ tipo: "titolo", testo: "" }); return disegnaArticoli(); }
    });

    r.addEventListener("input", e => {
      const t = e.target;
      if (t.dataset.campo) {
        const i = +t.dataset.i, a = articoli[i];
        if (t.dataset.campo === "titolo") a.testo = t.value;
        else if (t.dataset.campo === "numero") a.numero = t.value;
        else if (t.dataset.campo === "rubrica") a.rubrica = t.value;
        else if (t.dataset.campo === "comma") a.commi[+t.dataset.c].testo = t.value;
        else if (t.dataset.campo === "sotto") a.commi[+t.dataset.c].sottocommi[+t.dataset.s] = t.value;
        aggiornaAnteprima();
      }
      if (t.id === "filtro") {
        const q = t.value.trim().toLowerCase();
        document.querySelectorAll("#lista-atti .redazione-riga").forEach(x => { x.style.display = x.textContent.toLowerCase().includes(q) ? "" : "none"; });
      }
      if (t.id === "f-anno") { const n = document.getElementById("f-numero"); if (n) n.value = prossimoNumero(t.value); }
    });

    r.addEventListener("change", e => {
      if (e.target.name === "tipo") { tipo = e.target.value; disegnaArticoli(); }
    });

    r.addEventListener("submit", async e => {
      if (e.target.id !== "form") return;
      e.preventDefault();
      const val = id => document.getElementById(id).value.trim();
      const dati = { attoId: atto.id, tipo, numero: val("f-numero"), anno: val("f-anno"), data: val("f-data"), oggetto: val("f-oggetto"),
        motivazione: val("f-motivazione"), dispositivo: val("f-dispositivo"), effetto: val("f-effetto"), collegio: val("f-collegio") };
      if (!dati.oggetto || !dati.motivazione || !dati.dispositivo) return messaggio("Compila oggetto, motivazione e dispositivo.", true);
      if (tipo === "modifica") {
        if (!diffArticoli(originale, articoli).length) return messaggio("Non hai modificato il testo dell'atto.", true);
        dati.articoli = articoli;
      }
      const conferma = tipo === "modifica" ? "Pubblicare la pronuncia e applicare le modifiche all'atto?"
        : `Pubblicare la pronuncia e rendere l'atto «${tipo === "annullamento" ? "annullato" : "abrogato"}»?`;
      if (!confirm(conferma + "\nL'effetto è immediato su NormAktiv.")) return;
      const btn = e.target.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Pubblicazione…";
      try {
        const p = await CorteAPI.pubblica(dati);
        pronunce.unshift({ ...p, atto: { ...(p.atto || {}), titolo: atto.titolo, id: atto.id } });
        elenco = await CorteAPI.elencoAtti();
        root().innerHTML = `<p class="breadcrumb"><a href="corte.html">Pronunce</a> &rsaquo; Pubblicata</p>
          <div class="redazione-messaggio">✅ Sentenza n. ${esc(p.numero)}/${esc(p.anno)} pubblicata e applicata all'atto.</div>
          <p style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">
            <a class="redazione-btn redazione-btn--primario" href="corte.html?id=${encodeURIComponent(p.id)}">Vedi la pronuncia</a>
            <a class="redazione-btn redazione-btn--secondario" href="atto.html?id=${encodeURIComponent(atto.id)}">Vedi l'atto su NormAktiv</a>
            <button type="button" class="redazione-btn redazione-btn--secondario" data-vai="menu">Torna al menu</button></p>`;
      } catch (err) {
        if (!CorteAPI.isAuthenticated()) { location.reload(); return; }
        btn.disabled = false; btn.textContent = "⚖ Pubblica la pronuncia"; messaggio("Errore: " + err.message, true);
      }
    });
  }

  /* ---------- login / avvio ---------- */
  async function avvia() {
    document.getElementById("login-area").style.display = "none";
    document.getElementById("admin-content").style.display = "block";
    document.getElementById("nomeUtente").textContent = CorteAPI.nome() || "—";
    initEventi();
    try { [elenco, pronunce] = await Promise.all([CorteAPI.elencoAtti(), CorteAPI.pronunce()]); }
    catch (e) { if (!CorteAPI.isAuthenticated()) return location.reload(); alert("Errore nel caricamento: " + e.message); }
    vistaMenu();
  }

  function init() {
    renderTestataCorte("redazione"); renderFooterCorte();
    const btn = document.getElementById("loginBtn"), err = document.getElementById("loginError");
    const u = document.getElementById("u"), p = document.getElementById("p");
    btn.addEventListener("click", async () => {
      err.classList.remove("show"); btn.disabled = true; btn.textContent = "Accesso…";
      try { await CorteAPI.login(u.value.trim(), p.value); await avvia(); }
      catch (e) { err.textContent = "❌ " + (e.message || "Errore di accesso"); err.classList.add("show"); }
      finally { btn.disabled = false; btn.textContent = "Accedi"; }
    });
    [u, p].forEach(el => el.addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); btn.click(); } }));
    document.getElementById("logoutBtn").addEventListener("click", () => { CorteAPI.esci(); location.reload(); });
    // Accesso con Estji ID (QR)
    if (window.EstjiLogin) {
      document.getElementById("estji-blocco").style.display = "block";
      EstjiLogin.mount("#estji-login", {
        clientId: "corte",
        scopes: ["profile.basic", "corte.edit"],
        onLogin: async res => {
          err.classList.remove("show");
          try { await CorteAPI.loginEstji(res.id_token); await avvia(); }
          catch (e) { err.textContent = "❌ " + (e.message || "Accesso non riuscito"); err.classList.add("show"); }
        }
      });
    }
    if (CorteAPI.isAuthenticated()) avvia(); else document.getElementById("login-area").style.display = "block";
  }
  document.addEventListener("DOMContentLoaded", init);
})();
