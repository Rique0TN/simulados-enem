/* Login (opcional). Sem configuração do Firebase, mostra "Login em breve" desabilitado e não carrega nada.
 * Com configuração preenchida em js/firebase-config.js, carrega o SDK do Firebase sob demanda e oferece
 * login com Google. Qualquer falha cai de volta no modo sem login — o site nunca depende disso. */
(function () {
  "use strict";
  var cfg = window.FIREBASE_CONFIG || {};
  var configurado = !!(cfg.apiKey && cfg.authDomain && cfg.projectId);
  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var usuario = null, auth = null;

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
        b.addEventListener("click", function () { auth.signOut(); });
      } else {
        b.textContent = "Entrar";
        b.addEventListener("click", entrar);
      }
      el.appendChild(b);
    });
  }
  function carregar(src) {
    return new Promise(function (ok, erro) {
      var s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = ok; s.onerror = function () { erro(new Error("Falha ao carregar " + src)); };
      document.head.appendChild(s);
    });
  }
  function iniciar() {
    return carregar(SDK + "firebase-app-compat.js").then(function () { return carregar(SDK + "firebase-auth-compat.js"); }).then(function () {
      window.firebase.initializeApp(cfg);
      auth = window.firebase.auth();
      auth.onAuthStateChanged(function (u) { usuario = u; render(); });
    });
  }
  function entrar() {
    if (!auth) return;
    auth.signInWithPopup(new window.firebase.auth.GoogleAuthProvider()).catch(function (e) { console.warn("Login não concluído", e && e.code); });
  }
  window.SiteAuth = { configurado: configurado, usuario: function () { return usuario; }, render: render };
  render();
  if (configurado) iniciar().catch(function (e) { console.warn("Login indisponível; seguindo sem login.", e && e.message); configurado = false; render(); });
})();
