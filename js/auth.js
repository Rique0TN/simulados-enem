/* Login (opcional) e sincronização do progresso.
 * Sem configuração do Firebase, mostra "Login em breve" desabilitado e não carrega nada.
 * Com configuração em js/firebase-config.js, oferece login com Google. Ao entrar, o progresso deste
 * aparelho é mesclado com o da nuvem (Firestore, documento usuarios/{uid}) e passa a ser salvo nos dois.
 * Qualquer falha cai de volta no modo sem login — o site nunca depende disso. */
(function () {
  "use strict";
  var cfg = window.FIREBASE_CONFIG || {};
  var configurado = !!(cfg.apiKey && cfg.authDomain && cfg.projectId);
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var usuario = null, auth = null, db = null, pronto = false, timer = null, statusTxt = "";

  function areas() { return Array.prototype.slice.call(document.querySelectorAll("[data-auth]")); }
  function render() {
    areas().forEach(function (el) {
      el.innerHTML = "";
      var b = document.createElement("button");
      b.type = "button"; b.className = "btn btn-sec btn-peq btn-login";
      if (!configurado) {
        b.textContent = "Login em breve"; b.disabled = true;
        b.title = "O login ainda não está disponível. Seu progresso fica salvo neste navegador.";
      } else if (usuario) {
        b.textContent = "Sair (" + (usuario.displayName || usuario.email || "conta") + ")";
        b.title = statusTxt || "Progresso sincronizado com sua conta Google.";
        b.addEventListener("click", function () { auth.signOut(); });
      } else {
        b.textContent = "Entrar";
        b.title = "Entre com Google para ter seu progresso no celular e no computador.";
        b.addEventListener("click", entrar);
      }
      el.appendChild(b);
    });
  }
  function aviso(msg) {
    var t = document.getElementById("toast");
    if (t) { t.textContent = msg; t.hidden = false; t.classList.add("on"); setTimeout(function () { t.classList.remove("on"); t.hidden = true; }, 3500); }
  }
  function carregar(src) {
    return new Promise(function (ok, erro) {
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = ok; s.onerror = function () { erro(new Error("Falha ao carregar " + src)); };
      document.head.appendChild(s);
    });
  }

  /* ---------- mesclagem: nada que a pessoa fez em um aparelho se perde ---------- */
  function uniaoLista(a, b) {
    var vistos = {}, r = [];
    (a || []).concat(b || []).forEach(function (x) { var k = JSON.stringify(x); if (!vistos[k]) { vistos[k] = 1; r.push(x); } });
    return r;
  }
  function uniaoObj(a, b) { var r = {}, k; for (k in (b || {})) r[k] = b[k]; for (k in (a || {})) r[k] = a[k]; return r; }
  function mesclar(local, nuvem) {
    if (!nuvem) return local;
    if (!local) return nuvem;
    return {
      v: 2,
      sims: { d1: local.sims && local.sims.d1 || nuvem.sims && nuvem.sims.d1 || null, d2: local.sims && local.sims.d2 || nuvem.sims && nuvem.sims.d2 || null },
      seen: uniaoObj(local.seen, nuvem.seen),
      temasVistos: uniaoLista(local.temasVistos, nuvem.temasVistos),
      hist: uniaoLista(nuvem.hist, local.hist),
      tentativas: uniaoLista(nuvem.tentativas, local.tentativas),
      caderno: uniaoObj(local.caderno, nuvem.caderno),
      treino: local.treino || nuvem.treino || null,
      soRed: local.soRed || nuvem.soRed || null
    };
  }
  function doc() { return db.collection("usuarios").doc(usuario.uid); }
  function enviar() {
    if (!usuario || !db || !pronto || !window.__app) return;
    var estado = window.__app.estado();
    doc().set({ estado: JSON.stringify(estado), atualizadoEm: new Date().toISOString() })
      .then(function () { statusTxt = "Sincronizado às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); render(); })
      .catch(function (e) { statusTxt = "Sem conexão: salvo só neste aparelho por enquanto."; render(); console.warn("Falha ao sincronizar", e && e.code); });
  }
  function sincronizarAoEntrar() {
    pronto = false;
    doc().get().then(function (snap) {
      var nuvem = null;
      if (snap.exists) { try { nuvem = JSON.parse(snap.data().estado); } catch (e) { nuvem = null; } }
      var local = window.__app ? window.__app.estado() : null;
      var junto = mesclar(local, nuvem);
      pronto = true;
      if (window.__app && nuvem) window.__app.substituir(junto); else enviar();
      if (nuvem) aviso("Progresso da sua conta carregado.");
    }).catch(function (e) { console.warn("Falha ao ler progresso da nuvem", e && e.code); statusTxt = "Não foi possível sincronizar agora."; render(); });
  }

  window.SiteSync = {
    agendar: function () { if (!pronto) return; clearTimeout(timer); timer = setTimeout(enviar, 2000); },
    appPronto: function () { if (usuario && db) sincronizarAoEntrar(); }
  };

  function iniciar() {
    return carregar(SDK + "firebase-app-compat.js")
      .then(function () { return carregar(SDK + "firebase-auth-compat.js"); })
      .then(function () { return carregar(SDK + "firebase-firestore-compat.js"); })
      .then(function () {
        window.firebase.initializeApp(cfg);
        auth = window.firebase.auth();
        db = window.firebase.firestore();
        auth.onAuthStateChanged(function (u) {
          usuario = u; statusTxt = ""; pronto = false; render();
          if (u) { fecharLobby(); sincronizarAoEntrar(); } else mostrarLobby();
        });
      });
  }
  /* ---------- tela de boas-vindas (lobby) ---------- */
  var CHAVE_LOBBY = "simuladosEnem.lobby";
  function lobbyJaEscolhido() { try { return localStorage.getItem(CHAVE_LOBBY) === "convidado"; } catch (e) { return false; } }
  function fecharLobby() { var l = document.getElementById("lobby"); if (l) l.remove(); document.body.classList.remove("com-lobby"); }
  function mostrarLobby() {
    if (document.getElementById("lobby") || lobbyJaEscolhido()) return;
    var l = document.createElement("div");
    l.id = "lobby"; l.className = "lobby"; l.setAttribute("role", "dialog"); l.setAttribute("aria-modal", "true"); l.setAttribute("aria-labelledby", "lobby-t");
    l.innerHTML = "<div class='lobby-caixa'>" +
      "<h2 id='lobby-t'>Simulados ENEM<span class='lobby-selo'>com correção automática</span></h2>" +
      "<p class='lobby-sub'>Simulados, treino por área, caderno de erros e redação corrigida na hora. Grátis.</p>" +
      "<button type='button' class='btn btn-pri lobby-btn' id='lobby-entrar'>Entrar com Google</button>" +
      "<p class='nota-peq'>Seu progresso fica salvo na sua conta e aparece no celular e no computador.</p>" +
      "<button type='button' class='btn btn-sec lobby-btn' id='lobby-convidado'>Testar sem login</button>" +
      "<p class='lobby-aviso'>⚠️ Sem login, o progresso fica só neste navegador. Você pode perdê-lo se limpar os dados, usar aba anônima ou trocar de aparelho.</p>" +
      "</div>";
    document.body.appendChild(l); document.body.classList.add("com-lobby");
    document.getElementById("lobby-entrar").addEventListener("click", function () { entrar(); });
    document.getElementById("lobby-convidado").addEventListener("click", function () {
      try { localStorage.setItem(CHAVE_LOBBY, "convidado"); } catch (e) {}
      fecharLobby();
    });
    document.getElementById("lobby-entrar").focus();
  }

  function entrar() {
    if (!auth) return;
    auth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider()).catch(function (e) { console.warn("Login não concluído", e && e.code); });
  }
  window.SiteAuth = { configurado: configurado, usuario: function () { return usuario; }, render: render };
  render();
  if (configurado) iniciar().catch(function (e) { console.warn("Login indisponível; seguindo sem login.", e && e.message); configurado = false; render(); });
})();
