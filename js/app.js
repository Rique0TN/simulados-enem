/* Simulados ENEM — aplicação (HTML/CSS/JS puro, sem servidor). */
(function () {
  "use strict";
  var CFG = window.SITE_CONFIG, D = window.ENEM_DATA || {};
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var NOMES = { LC: "Linguagens", CH: "Ciências Humanas", CN: "Ciências da Natureza", MT: "Matemática", RED: "Redação" };

  /* ---------- índice de questões ---------- */
  var Q = {}; // id -> {q, area, sub}
  function idx(lista, area, sub) { (lista || []).forEach(function (q) { Q[q.id] = { q: q, area: area, sub: sub || area }; }); }
  if (D.LC) { idx(D.LC.LC, "LC"); idx(D.LC.ingles, "LC", "LE-ingles"); idx(D.LC.espanhol, "LC", "LE-espanhol"); }
  idx(D.CH, "CH"); idx(D.CN, "CN"); idx(D.MT, "MT");
  var TEMAS = D.REDACAO || [];
  function temaPorId(id) { for (var i = 0; i < TEMAS.length; i++) if (TEMAS[i].id === id) return TEMAS[i]; return TEMAS[0]; }

  /* ---------- armazenamento ---------- */
  var lsOk = (function () { try { var k = "__t"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return true; } catch (e) { return false; } })();
  function estadoVazio() { return { v: 2, sims: { d1: null, d2: null }, seen: {}, temasVistos: [], hist: [], tentativas: [], caderno: {}, treino: null, soRed: null }; }
  var S = estadoVazio();
  function carregar() {
    if (!lsOk) return;
    try {
      var raw = localStorage.getItem(CFG.STORAGE_KEY);
      if (raw) { var o = JSON.parse(raw); if (valido(o)) S = normalizar(o); }
    } catch (e) { console.warn("Falha ao ler progresso", e); }
  }
  function valido(o) { return o && typeof o === "object" && o.sims && typeof o.sims === "object"; }
  function normalizar(o) {
    var b = estadoVazio();
    b.sims.d1 = o.sims.d1 || null; b.sims.d2 = o.sims.d2 || null;
    b.seen = o.seen || {}; b.temasVistos = o.temasVistos || []; b.hist = o.hist || [];
    b.tentativas = Array.isArray(o.tentativas) ? o.tentativas : []; b.caderno = (o.caderno && typeof o.caderno === "object") ? o.caderno : {};
    b.treino = o.treino || null; b.soRed = o.soRed || null;
    return b;
  }
  var ultimoSalvo = null;
  function salvar(manual) {
    if (!lsOk) { if (manual) toast("Não foi possível salvar neste navegador. Use “Exportar progresso”."); return false; }
    try {
      localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify(S));
      ultimoSalvo = new Date();
      if (window.SiteSync) window.SiteSync.agendar();
      var el = $("#salvo"); if (el) el.textContent = "Salvo às " + ultimoSalvo.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      if (manual) toast("Progresso salvo neste aparelho.");
      return true;
    } catch (e) {
      mostrarAvisoArmazenamento("Não foi possível salvar (armazenamento cheio ou bloqueado). Exporte o progresso para não perdê-lo.");
      return false;
    }
  }
  function mostrarAvisoArmazenamento(msg) { var a = $("#aviso-armazenamento"); a.textContent = msg; a.hidden = false; }

  function exportar() {
    var dados = { app: "simulados-enem", versao: 2, exportadoEm: new Date().toISOString(), estado: S };
    var blob = new Blob([JSON.stringify(dados, null, 1)], { type: "application/json" });
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    var d = new Date(), nome = "simulados-enem-progresso-" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + ".json";
    a.href = url; a.download = nome; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    toast("Arquivo “" + nome + "” gerado.");
  }
  function importar(arquivo) {
    var fr = new FileReader();
    fr.onload = function () {
      var o;
      try { o = JSON.parse(fr.result); } catch (e) { toast("Arquivo inválido: não é um JSON."); return; }
      var est = o && o.app === "simulados-enem" ? o.estado : o;
      if (!valido(est)) { toast("Arquivo inválido: não contém um progresso de Simulados ENEM."); return; }
      confirmar("Importar progresso?", "<p>O progresso atual deste aparelho será substituído pelo do arquivo.</p>", [
        { t: "Importar", c: "btn-pri", f: function () { pararTimer(); S = normalizar(est); salvar(); toast("Progresso importado."); ir("inicio"); } },
        { t: "Cancelar", c: "btn-sec" }
      ]);
    };
    fr.onerror = function () { toast("Não foi possível ler o arquivo."); };
    fr.readAsText(arquivo);
  }

  /* ---------- utilidades ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function embaralhar(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmtTempo(s) { s = Math.max(0, Math.floor(s)); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h + ":" + ("0" + m).slice(-2) + ":" + ("0" + x).slice(-2); }
  function pct(a, b) { return b ? Math.round(a * 1000 / b) / 10 : 0; }
  function fmtPct(v) { return String(v).replace(".", ",") + "%"; }
  var toastT;
  function toast(m) { var t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3200); }
  function renderTexto(txt) {
    if (!txt) return "";
    var linhas = String(txt).split("\n"), html = "", tab = [];
    function fechaTab() {
      if (!tab.length) return;
      html += "<div class='tabela-wrap'><table>";
      tab.forEach(function (l, i) {
        var cels = l.replace(/^\|/, "").replace(/\|\s*$/, "").split("|");
        html += "<tr>" + cels.map(function (c) { return i === 0 ? "<th scope='col'>" + esc(c.trim()) + "</th>" : "<td>" + esc(c.trim()) + "</td>"; }).join("") + "</tr>";
      });
      html += "</table></div>"; tab = [];
    }
    linhas.forEach(function (l) {
      var t = l.trim();
      if (/^\|.*\|$/.test(t)) { tab.push(t); return; }
      fechaTab();
      if (!t) return;
      if (/^\[.*\]$/.test(t)) html += "<p class='descricao'><span class='sr-only'>Descrição de imagem: </span>" + esc(t.slice(1, -1)) + "</p>";
      else if (/^TEXTO [IVX]+$/.test(t)) html += "<p class='rotulo'>" + esc(t) + "</p>";
      else html += "<p>" + esc(l) + "</p>";
    });
    fechaTab();
    return html;
  }

  /* ---------- sorteio ---------- */
  function sortear(pool, n) {
    var ordenado = embaralhar(pool).sort(function (a, b) { return (S.seen[a.id] || 0) - (S.seen[b.id] || 0); });
    return embaralhar(ordenado.slice(0, n)).map(function (q) { return q.id; });
  }
  function sortearTema(evitar) {
    var cand = TEMAS.filter(function (t) { return t.id !== evitar; });
    if (!cand.length) cand = TEMAS.slice();
    var nunca = cand.filter(function (t) { return S.temasVistos.indexOf(t.id) < 0; });
    var base = nunca.length ? nunca : cand;
    return base[Math.floor(Math.random() * base.length)].id;
  }
  function novoSim(dia, lingua, correcao, opts) {
    opts = opts || {};
    var qids;
    if (opts.qids) qids = opts.qids.slice();
    else if (dia === 1) {
      var le = D.LC[lingua] || [];
      qids = sortear(le, 5).concat(sortear(D.LC.LC, 40), sortear(D.CH, 45));
    } else qids = sortear(D.CN, 45).concat(sortear(D.MT, 45));
    qids.forEach(function (id) { S.seen[id] = (S.seen[id] || 0) + 1; });
    var sim = { dia: dia, lingua: dia === 1 ? lingua : null, qids: qids, answers: {}, locked: {}, correcao: !!correcao, elapsed: 0, idx: 0,
      status: "running", criadoEm: new Date().toISOString(), finalizadoEm: null, resultado: null };
    if (dia === 1) {
      sim.tema = opts.tema || sortearTema(opts.evitarTema);
      if (S.temasVistos.indexOf(sim.tema) < 0) S.temasVistos.push(sim.tema);
      sim.redacao = { texto: "", res: null };
    }
    S.sims["d" + dia] = sim;
    salvar();
    return sim;
  }
  function numeroDe(sim, i) { return (sim.dia === 1 ? 1 : 91) + i; }
  function areaDe(sim, i) { return sim.dia === 1 ? (i < 45 ? "LC" : "CH") : (i < 45 ? "CN" : "MT"); }

  /* ---------- roteamento ---------- */
  var atual = { tela: "inicio", dia: null, aba: null };
  function ir(tela, dia, sem) {
    atual.tela = tela; atual.dia = dia || null;
    var h = "#" + tela + (dia ? "-" + dia : "");
    if (!sem && location.hash !== h) { history.pushState(null, "", h); }
    render();
  }
  window.addEventListener("popstate", function () { rotaDoHash(); render(); });
  function rotaDoHash() {
    var m = /^#(inicio|config|prova|resultado|geral|treino|caderno|evolucao|redacao|agora)(?:-(\d))?$/.exec(location.hash || "");
    if (!m) { atual.tela = "inicio"; atual.dia = null; return; }
    atual.tela = m[1]; atual.dia = m[2] ? +m[2] : null;
    if ((atual.tela === "prova" || atual.tela === "resultado") && !(atual.dia && S.sims["d" + atual.dia])) { atual.tela = "inicio"; atual.dia = null; }
    if (atual.tela === "resultado" && S.sims["d" + atual.dia].status !== "finished") atual.tela = "prova";
    if (atual.tela === "config" && !atual.dia) atual.tela = "inicio";
  }
  function mostrarTela(id) {
    $$(".tela").forEach(function (t) { t.hidden = t.id !== id; });
    window.scrollTo(0, 0);
  }
  function render() {
    fecharModais();
    if (atual.tela !== "prova") pararTimer();
    if (atual.tela === "inicio") renderInicio();
    else if (atual.tela === "config") renderConfig();
    else if (atual.tela === "prova") renderProva();
    else if (atual.tela === "resultado" || atual.tela === "geral") renderResultado();
    else if (atual.tela === "treino") renderTreino();
    else if (atual.tela === "caderno") renderCaderno();
    else if (atual.tela === "evolucao") renderEvolucao();
    else if (atual.tela === "redacao") renderSoRedacao();
    else if (atual.tela === "agora") renderAgora();
    $$(".menu-topo a").forEach(function (a) { if (a.getAttribute("data-ir") === atual.tela) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  }

  /* ---------- início ---------- */
  function renderInicio() {
    mostrarTela("tela-inicio");
    document.title = "Simulados ENEM online grátis – 1º e 2º dia com correção e redação | Simulados ENEM";
    [1, 2].forEach(function (dia) {
      var sim = S.sims["d" + dia], st = $("#status-d" + dia), ac = $("#acoes-d" + dia);
      ac.innerHTML = "";
      function b(txt, cls, f) { var x = document.createElement("button"); x.className = "btn " + cls; x.textContent = txt; x.addEventListener("click", f); ac.appendChild(x); }
      if (!sim) { st.textContent = "Ainda não iniciado."; b("Começar", "btn-pri", function () { ir("config", dia); }); }
      else if (sim.status === "running") {
        var resp = Object.keys(sim.answers).length;
        st.textContent = "Em andamento: " + resp + "/90 respondidas · " + fmtTempo(sim.elapsed) + (dia === 1 && sim.redacao && sim.redacao.texto ? " · redação iniciada" : "");
        b("Continuar", "btn-pri", function () { ir("prova", dia); });
        b("Recomeçar", "btn-sec", function () { refazer(dia); });
      } else {
        var r = sim.resultado;
        st.textContent = "Finalizado: " + r.acertos + "/90 acertos (" + fmtPct(pct(r.acertos, 90)) + ")" + (dia === 1 ? " · redação " + r.redacao + "" : "");
        b("Ver resultado", "btn-pri", function () { ir("resultado", dia); });
        b("Refazer", "btn-sec", function () { refazer(dia); });
      }
    });
    var ambos = S.sims.d1 && S.sims.d1.status === "finished" && S.sims.d2 && S.sims.d2.status === "finished";
    $("#geral-wrap").hidden = !ambos;
    var nc = Object.keys(S.caderno).length; $("#n-caderno").textContent = nc ? "(" + nc + ")" : "";
    $("#n-banco").textContent = Object.keys(Q).length + " questões no total";
  }

  /* ---------- configuração ---------- */
  var cfgPend = null; // {dia, modo:'novo'|'refazer-novo', evitarTema}
  function renderConfig() {
    mostrarTela("tela-config");
    var dia = atual.dia;
    if (!cfgPend || cfgPend.dia !== dia) cfgPend = { dia: dia };
    $("#titulo-config").textContent = dia === 1 ? "Preparar Simulado 1 (ENEM 1º dia)" : "Preparar Simulado 2 (ENEM 2º dia)";
    $("#fs-lingua").hidden = dia !== 1;
    $("#cfg-correcao").checked = false;
    $("#cfg-resumo").textContent = dia === 1
      ? "Questões 1–5: língua estrangeira · 6–45: Linguagens · 46–90: Ciências Humanas · Redação. Tempo de referência: 5h30 (o cronômetro é apenas informativo)."
      : "Questões 91–135: Ciências da Natureza · 136–180: Matemática. Tempo de referência: 5h (o cronômetro é apenas informativo).";
  }
  $("#form-config").addEventListener("submit", function (e) {
    e.preventDefault();
    var dia = atual.dia, lingua = (($("input[name=lingua]:checked") || {}).value) || "ingles";
    arquivarResultado(dia);
    novoSim(dia, lingua, $("#cfg-correcao").checked, { evitarTema: cfgPend && cfgPend.evitarTema });
    cfgPend = null;
    ir("prova", dia);
  });

  /* ---------- prova ---------- */
  var timer = null, timerTick = 0;
  function simAtual() { return S.sims["d" + atual.dia]; }
  function iniciarTimer() {
    pararTimer();
    var sim = simAtual(); if (!sim || sim.status !== "running") return;
    timer = setInterval(function () {
      if (document.hidden) return;
      sim.elapsed++; timerTick++;
      atualizarCronometro();
      if (timerTick % 15 === 0) salvar();
    }, 1000);
  }
  function pararTimer() { if (timer) { clearInterval(timer); timer = null; } }
  function atualizarCronometro() {
    var sim = simAtual(); if (!sim) return;
    var lim = (sim.dia === 1 ? CFG.DURACAO_DIA1_MIN : CFG.DURACAO_DIA2_MIN) * 60;
    var el = $("#cronometro"); el.textContent = fmtTempo(sim.elapsed) + " / " + fmtTempo(lim);
    el.style.color = sim.elapsed > lim ? "var(--vermelho)" : "";
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden && atual.tela === "prova") salvar(); });
  window.addEventListener("pagehide", function () { if (atual.tela === "prova") salvar(); });

  function renderProva() {
    var sim = simAtual();
    mostrarTela("tela-prova");
    $("#sr-area").innerHTML = "";
    $("#titulo-prova").textContent = sim.dia === 1 ? "Simulado 1 · 1º dia" : "Simulado 2 · 2º dia";
    document.title = (sim.dia === 1 ? "Simulado 1" : "Simulado 2") + " em andamento | Simulados ENEM";
    $("#tg-correcao").checked = !!sim.correcao;
    $("#tg-correcao").disabled = sim.status === "finished";
    $("#btn-redacao-ir").hidden = sim.dia !== 1;
    $("#menu-finalizar").hidden = sim.status === "finished";
    $("#menu-resultado").hidden = sim.status !== "finished";
    atualizarCronometro();
    if (ultimoSalvo) $("#salvo").textContent = "Salvo às " + ultimoSalvo.toLocaleTimeString("pt-BR");
    renderQuestao();
    iniciarTimer();
  }
  function revelado(sim, id) { return sim.status === "finished" || !!sim.locked[id]; }
  function renderQuestao(focar) {
    var sim = simAtual(), box = $("#area-questao");
    var nResp = Object.keys(sim.answers).length;
    $("#progresso").textContent = nResp + "/90";
    if (sim.idx === "R") { renderRedacao(sim, box); atualizarNav(sim); if (focar) box.focus(); return; }
    var i = sim.idx, id = sim.qids[i], info = Q[id], num = numeroDe(sim, i), area = areaDe(sim, i);
    if (!info) {
      box.innerHTML = "<p class='q-num'>Questão " + num + "</p><p>Esta questão não está mais disponível no banco atual (o arquivo de progresso pode ser de outra versão do site). Ela será contada como em branco.</p>";
      atualizarNav(sim); return;
    }
    var q = info.q, resp = sim.answers[id], rev = revelado(sim, id);
    var sub = info.sub === "LE-ingles" ? "Língua estrangeira – Inglês" : info.sub === "LE-espanhol" ? "Língua estrangeira – Espanhol" : NOMES[area] + (q.disc && q.disc !== NOMES[area] ? " · " + q.disc : "");
    var h = "<div class='q-cab'><span class='q-num'>Questão " + num + "</span><span class='q-area'>" + esc(sub) + (q.tema ? " · " + esc(q.tema) : "") + "</span></div>";
    h += "<div class='texto-base'>" + renderTexto(q.texto) + "</div>";
    if (q.fonte) h += "<p class='fonte'>" + esc(q.fonte) + "</p>";
    h += "<p class='enunciado' id='enun'>" + esc(q.enunciado) + "</p>";
    h += "<fieldset class='alternativas' aria-labelledby='enun'><legend class='sr-only'>Alternativas da questão " + num + "</legend>";
    q.alternativas.forEach(function (a, k) {
      var L = "ABCDE"[k], cls = "alt";
      if (resp === L) cls += " sel";
      if (rev) { cls += " bloq"; if (L === q.gabarito) cls += " certa"; else if (resp === L) cls += " errada"; }
      h += "<label class='" + cls + "'><input type='radio' name='alt' value='" + L + "'" + (resp === L ? " checked" : "") + (rev ? " disabled" : "") + "><span class='letra' aria-hidden='true'>" + L + "</span><span><span class='sr-only'>Alternativa " + L + ": </span>" + esc(a) + "</span></label>";
    });
    h += "</fieldset>";
    if (!rev && resp) h += "<button class='btn btn-sec btn-peq limpar' id='btn-limpar'>Limpar resposta</button>";
    if (rev) {
      var ok = resp === q.gabarito;
      h += "<div class='feedback " + (resp ? (ok ? "ok" : "erro") : "neutro") + "' role='status'><strong>" +
        (resp ? (ok ? "✔ Resposta correta!" : "✘ Resposta incorreta. Você marcou " + resp + "; o gabarito é " + q.gabarito + ".") : "Em branco. Gabarito: " + q.gabarito + ".") +
        "</strong>" + esc(q.comentario) + "</div>";
    }
    box.innerHTML = h;
    $$("input[name=alt]", box).forEach(function (inp) {
      inp.addEventListener("change", function () { responder(inp.value); });
    });
    var bl = $("#btn-limpar"); if (bl) bl.addEventListener("click", function () { delete sim.answers[id]; salvar(); renderQuestao(); });
    atualizarNav(sim);
    if (focar) box.focus();
  }
  function responder(L) {
    var sim = simAtual(), id = sim.qids[sim.idx];
    if (sim.status !== "running" || sim.locked[id]) return;
    sim.answers[id] = L;
    if (sim.correcao) sim.locked[id] = true;
    salvar();
    renderQuestao();
    if (sim.correcao) { var f = $(".feedback"); if (f) f.scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  }
  function atualizarNav(sim) {
    var ant = $("#btn-ant"), prox = $("#btn-prox");
    if (sim.idx === "R") { ant.disabled = false; prox.textContent = sim.status === "finished" ? "Ver resultado" : "Finalizar"; return; }
    ant.disabled = sim.idx === 0;
    var ultimo = sim.idx === 89;
    prox.textContent = ultimo ? (sim.dia === 1 ? "Ir para a redação ›" : (sim.status === "finished" ? "Ver resultado" : "Finalizar")) : "Próxima ›";
  }
  function irPara(i) { var sim = simAtual(); sim.idx = i; salvar(); renderQuestao(true); window.scrollTo(0, 0); }
  $("#btn-ant").addEventListener("click", function () {
    var sim = simAtual();
    if (sim.idx === "R") irPara(89); else if (sim.idx > 0) irPara(sim.idx - 1);
  });
  $("#btn-prox").addEventListener("click", function () {
    var sim = simAtual();
    if (sim.idx === "R" || (sim.idx === 89 && sim.dia === 2)) { sim.status === "finished" ? ir("resultado", sim.dia) : pedirFinalizar(); return; }
    if (sim.idx === 89) irPara("R"); else irPara(sim.idx + 1);
  });
  $("#btn-redacao-ir").addEventListener("click", function () { irPara("R"); });
  $("#tg-correcao").addEventListener("change", function () {
    var sim = simAtual(); sim.correcao = this.checked;
    if (sim.correcao) { Object.keys(sim.answers).forEach(function (id) { sim.locked[id] = true; }); toast("Correção na hora ligada: questões respondidas foram corrigidas e travadas."); }
    else toast("Correção na hora desligada: as próximas respostas podem ser alteradas até finalizar.");
    salvar(); renderQuestao();
  });
  $("#btn-grade").addEventListener("click", function () { abrirGrade(); });
  $("#btn-menu").addEventListener("click", function () { abrirModal("modal-menu"); });

  function abrirGrade() {
    var sim = simAtual(), g = $("#grade"), h = "";
    var secs = sim.dia === 1 ? [[0, "Linguagens (1–45)"], [45, "Ciências Humanas (46–90)"]] : [[0, "Ciências da Natureza (91–135)"], [45, "Matemática (136–180)"]];
    for (var i = 0; i < 90; i++) {
      secs.forEach(function (s) { if (s[0] === i) h += "<div class='sec'>" + s[1] + "</div>"; });
      var id = sim.qids[i], r = sim.answers[id], cls = "cel", est = "em branco";
      if (revelado(sim, id) && Q[id]) { if (r === Q[id].q.gabarito) { cls += " c"; est = "certa"; } else if (r || sim.status === "finished") { cls += r ? " e" : ""; est = r ? "errada" : "em branco"; } }
      else if (r) { cls += " r"; est = "respondida (" + r + ")"; }
      if (sim.idx === i) cls += " atual";
      h += "<button class='" + cls + "' data-i='" + i + "' aria-label='Questão " + numeroDe(sim, i) + ", " + est + "'>" + numeroDe(sim, i) + "</button>";
    }
    if (sim.dia === 1) h += "<div class='sec'>Redação</div><button class='cel red" + (sim.redacao && sim.redacao.texto ? " r" : "") + (sim.idx === "R" ? " atual" : "") + "' data-i='R'>Redação</button>";
    g.innerHTML = h;
    $$("button[data-i]", g).forEach(function (b) {
      b.addEventListener("click", function () { var v = b.getAttribute("data-i"); fecharModais(); irPara(v === "R" ? "R" : +v); });
    });
    abrirModal("modal-grade");
  }

  /* ---------- redação ---------- */
  function renderRedacao(sim, box) {
    var t = temaPorId(sim.tema), red = sim.redacao, fin = sim.status === "finished";
    var h = "<div class='redacao'><div class='q-cab'><span class='q-num'>Redação</span><span class='q-area'>Texto dissertativo-argumentativo</span></div>";
    h += "<p class='enunciado'>Tema: " + esc(t.tema) + "</p>";
    h += "<details class='motivadores'" + (red.texto ? "" : " open") + "><summary>Proposta e textos motivadores</summary><p>" + esc(t.instrucoes) + "</p>";
    t.textos.forEach(function (x) { h += "<div class='txt'><p class='rotulo'>" + esc(x.rotulo) + "</p><div class='texto-base'>" + renderTexto(x.texto) + "</div><p class='fonte'>" + esc(x.fonte) + "</p></div>"; });
    h += "</details>";
    h += "<label for='txt-redacao' class='enunciado'>Seu texto (mínimo 8 e máximo 30 linhas; deixe uma linha em branco ou quebre a linha entre parágrafos)</label>";
    h += "<div class='folha'><div class='folha-cab'><span>Folha de redação</span><span>Título opcional</span></div>";
    h += "<textarea id='txt-redacao' spellcheck='false' autocapitalize='sentences' " + (fin ? "readonly" : "") + " placeholder='Escreva aqui sua redação…'>" + esc(red.texto) + "</textarea></div>";
    h += "<div class='medidor' aria-hidden='true'><div class='medidor-barra'><span id='medidor-fill'></span><i style='left:" + (8 / 30 * 100) + "%'></i></div><div class='medidor-leg'><span>0</span><span style='left:" + (8 / 30 * 100) + "%'>8 (mín.)</span><span>30 linhas</span></div></div>";
    h += "<div class='contadores' id='contadores' aria-live='polite'></div>";
    h += "<div class='acoes'><button class='btn btn-pri' id='btn-corrigir'>Corrigir redação</button></div>";
    h += "<p class='aviso-auto'>A nota é uma <strong>estimativa automática</strong> feita por regras (ortografia comum, estrutura, repertório, conectivos e elementos da proposta). Ela não substitui a correção oficial, feita por corretores humanos.</p>";
    h += "<div id='res-redacao' class='res-redacao'></div>";
    h += "</div>";
    box.innerHTML = h;
    var ta = $("#txt-redacao"), saveT;
    function contar() {
      var l = window.CorretorRedacao.contarLinhas(ta.value), w = window.CorretorRedacao.contarPalavras(ta.value), ps = ta.value.split(/\n+/).filter(function (p) { return p.trim(); }).length;
      var cl = l < 8 ? "alerta" : (l > 30 ? "alerta" : "ok");
      var msg = l < 8 ? " (mínimo 8 — abaixo disso a nota é zero)" : (l > 30 ? " (acima de 30 linhas o excedente é desconsiderado)" : "");
      var fill = $("#medidor-fill"); if (fill) { fill.style.width = Math.min(100, l / 30 * 100) + "%"; fill.className = cl; }
      $("#contadores").innerHTML = "<span class='" + cl + "'>≈ " + l + " linha" + (l === 1 ? "" : "s") + msg + "</span><span>" + w + " palavras</span><span>" + ps + " parágrafo" + (ps === 1 ? "" : "s") + "</span>";
    }
    contar();
    ta.addEventListener("input", function () {
      red.texto = ta.value; contar();
      clearTimeout(saveT); saveT = setTimeout(function () { salvar(); }, 400);
    });
    ta.addEventListener("blur", function () { salvar(); });
    $("#btn-corrigir").addEventListener("click", function () {
      red.texto = ta.value;
      red.res = window.CorretorRedacao.corrigir(red.texto, t);
      red.res.temaId = t.id;
      if (sim.soRedacao) registrarTentativa({ tipo: "redacao", nota: red.res.total, tema: t.id });
      salvar();
      mostrarResRedacao(red.res);
      var r = $("#res-redacao"); r.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    if (red.res) mostrarResRedacao(red.res);
  }
  function destacar(trecho, grifo) {
    var e = esc(trecho);
    if (grifo) { var g = esc(grifo); var i = e.toLowerCase().indexOf(g.toLowerCase()); if (i >= 0) e = e.slice(0, i) + "<mark>" + e.slice(i, i + g.length) + "</mark>" + e.slice(i + g.length); }
    return e;
  }
  var NOMES_COMP = ["Domínio da norma-padrão", "Compreensão do tema e repertório", "Seleção e organização dos argumentos", "Coesão (mecanismos linguísticos)", "Proposta de intervenção"];
  function faixaNota(n) { return n >= 800 ? "otima" : n >= 600 ? "boa" : n >= 400 ? "media" : "baixa"; }
  function htmlResRedacao(res) {
    var fx = faixaNota(res.total);
    var rot = { otima: "Ótima", boa: "Boa", media: "Regular", baixa: "Precisa melhorar" }[fx];
    var h = "<div class='nota-card nota-" + fx + "'><div><span class='nota-rot'>Nota estimada</span><p class='nota-total'>" + res.total + "<small>/1000</small></p><span class='nota-faixa'>" + (res.zerada ? "Nota zero" : rot) + "</span></div>";
    h += "<ul class='nota-meta'><li><b>" + res.linhas + "</b> linhas</li><li><b>" + res.palavras + "</b> palavras</li><li><b>" + res.paragrafos + "</b> parágrafos</li></ul></div>";
    if (res.zerada) h += "<p class='zerada'>Redação com nota zero: " + esc(res.zerada) + ".</p>";
    res.avisos.forEach(function (a) { h += "<p class='aviso-auto'>" + esc(a) + "</p>"; });
    h += "<h3 class='h3 comp-tit'>As 5 competências do ENEM</h3><div class='comp-barras'>";
    [0, 1, 2, 3, 4].forEach(function (k) {
      var c = res.comps[k] || { n: k + 1, nota: 0 }, pc = c.nota / 200 * 100;
      h += "<div class='cb'><span class='cb-n'>C" + (k + 1) + "</span><span class='cb-nome'>" + esc(c.nome || NOMES_COMP[k]) + "</span><span class='cb-v'>" + c.nota + "</span><div class='cb-barra'><span class='nota-" + faixaNota(c.nota * 5) + "' style='width:" + pc + "%'></span></div></div>";
    });
    h += "</div>";
    if (!res.zerada) res.comps.forEach(function (c, k) {
      h += "<details class='comp'" + (c.nota < 160 ? " open" : "") + "><summary><span>C" + c.n + " · " + esc(c.nome || NOMES_COMP[k]) + "</span><span class='comp-v'>" + c.nota + "/200</span></summary>";
      if (c.achados.length) { h += "<ul>"; c.achados.forEach(function (a) { h += "<li>" + esc(a.msg) + (a.trecho ? "<br><q>" + destacar(a.trecho, a.grifo) + "</q>" : "") + "</li>"; }); h += "</ul>"; }
      else h += "<p class='nota-peq'>Nada a apontar nesta competência.</p>";
      if (c.dicas.length) h += "<p class='comp-dica'><strong>O que melhorar:</strong> " + c.dicas.map(esc).join(" ") + "</p>";
      h += "</details>";
    });
    return h;
  }
  function mostrarResRedacao(res) { $("#res-redacao").innerHTML = htmlResRedacao(res); }

  /* ---------- finalizar e resultado ---------- */
  function pedirFinalizar() {
    var sim = simAtual(), br = 0;
    sim.qids.forEach(function (id) { if (!sim.answers[id]) br++; });
    var h = "<p>Depois de finalizar, as respostas não podem mais ser alteradas.</p>";
    if (br) h += "<p><strong>" + br + " questão(ões) em branco.</strong></p>";
    if (sim.dia === 1 && !(sim.redacao.texto || "").trim()) h += "<p><strong>A redação está em branco</strong> e receberá nota zero.</p>";
    confirmar("Finalizar o simulado?", h, [
      { t: "Finalizar e ver resultado", c: "btn-pri", f: finalizar },
      { t: "Continuar respondendo", c: "btn-sec" }
    ]);
  }
  function calcular(sim) {
    var areas = sim.dia === 1 ? ["LC", "CH"] : ["CN", "MT"], por = {}, ac = 0, er = 0, br = 0, lista = [];
    areas.forEach(function (a) { por[a] = { ac: 0, er: 0, br: 0, itens: [] }; });
    sim.qids.forEach(function (id, i) {
      var a = areaDe(sim, i), info = Q[id], r = sim.answers[id], certo = !!(info && r === info.q.gabarito);
      var p = por[a];
      if (certo) { p.ac++; ac++; } else if (r) { p.er++; er++; } else { p.br++; br++; }
      p.itens.push({ dif: info ? info.q.dif : 2, certo: certo });
      if (!certo) lista.push(i);
    });
    var est = {};
    areas.forEach(function (a) { est[a] = window.EstimativaNota.estimar(a, por[a].itens); delete por[a].itens; });
    var res = { acertos: ac, erros: er, brancos: br, por: por, est: est, errosIdx: lista, tempo: sim.elapsed };
    if (sim.dia === 1) {
      var red = sim.redacao;
      if ((red.texto || "").trim() && (!red.res || red.res.temaId !== sim.tema)) { red.res = window.CorretorRedacao.corrigir(red.texto, temaPorId(sim.tema)); red.res.temaId = sim.tema; }
      res.redacao = (red.texto || "").trim() ? red.res.total : 0;
      res.mediaDia = { min: Math.round((est.LC.min + est.CH.min + res.redacao) / 3), max: Math.round((est.LC.max + est.CH.max + res.redacao) / 3) };
    } else {
      res.mediaDia = { min: Math.round((est.CN.min + est.MT.min) / 2), max: Math.round((est.CN.max + est.MT.max) / 2) };
    }
    return res;
  }
  function finalizar() {
    var sim = simAtual();
    pararTimer();
    sim.status = "finished"; sim.finalizadoEm = new Date().toISOString();
    sim.resultado = calcular(sim);
    registrarSimulado(sim);
    salvar();
    ir("resultado", sim.dia);
  }
  function arquivarResultado(dia) {
    var sim = S.sims["d" + dia];
    if (sim && sim.status === "finished" && sim.resultado) {
      S.hist.push({ dia: dia, em: sim.finalizadoEm, acertos: sim.resultado.acertos, redacao: sim.resultado.redacao, media: sim.resultado.mediaDia });
      if (S.hist.length > 30) S.hist = S.hist.slice(-30);
    }
  }

  function renderResultado() {
    mostrarTela("tela-resultado");
    document.title = "Resultado do simulado | Simulados ENEM";
    var f1 = S.sims.d1 && S.sims.d1.status === "finished", f2 = S.sims.d2 && S.sims.d2.status === "finished";
    var abas = $("#abas-res"); abas.innerHTML = "";
    var vista = atual.tela === "geral" ? "geral" : "d" + atual.dia;
    function aba(rotulo, v, f) {
      var b = document.createElement("button"); b.className = "btn btn-sec aba"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", v === vista ? "true" : "false"); b.textContent = rotulo; b.addEventListener("click", f); abas.appendChild(b);
    }
    if (f1) aba("Simulado 1", "d1", function () { ir("resultado", 1); });
    if (f2) aba("Simulado 2", "d2", function () { ir("resultado", 2); });
    if (f1 && f2) aba("Geral", "geral", function () { ir("geral"); });
    if (vista === "geral" && !(f1 && f2)) { ir("inicio"); return; }
    $("#res-conteudo").innerHTML = vista === "geral" ? htmlGeral() : htmlResultado(S.sims[vista]);
    $("#res-erros").innerHTML = vista === "geral" ? "" : htmlErros(S.sims[vista]);
    $$("[data-res]").forEach(function (b) {
      b.addEventListener("click", function () {
        var a = b.getAttribute("data-res"), dia = +b.getAttribute("data-dia");
        if (a === "refazer") refazer(dia);
        else if (a === "revisar") { atual.dia = dia; S.sims["d" + dia].idx = 0; ir("prova", dia); }
        else if (a === "redacao") { S.sims["d" + dia].idx = "R"; ir("prova", dia); }
        else if (a === "inicio") ir("inicio");
      });
    });
  }
  function linhaArea(nome, p, e, total) {
    var t = total || 45, erros = t - p.ac;
    return "<div class='area-card'><div class='ac-topo'><h3 class='h3'>" + nome + "</h3><span class='faixa' title='Nota estimada'>" + e.min + "–" + e.max + "</span></div>" +
      "<div class='barra' aria-hidden='true'><i style='width:" + pct(p.ac, t) + "%'></i></div>" +
      "<p class='ac-nums'><span><b>" + p.ac + "/" + t + "</b> acertos</span><span class='verde'>" + fmtPct(pct(p.ac, t)) + " de acertos</span><span class='verm'>" + fmtPct(pct(erros, t)) + " de erros" +
      (p.br ? " (" + p.br + " em branco)" : "") + "</span><span>nota estimada: <b>" + e.min + " a " + e.max + "</b></span></p></div>";
  }
  function linhaRedacao(nota, rot) {
    return "<div class='area-card'><div class='ac-topo'><h3 class='h3'>Redação</h3><span class='faixa'>" + nota + "</span></div><p class='ac-nums'><span>" + rot + "</span></p></div>";
  }
  function avisoEstimativa() {
    return "<p class='aviso-auto'><strong>Estimativa aproximada; a nota oficial usa TRI.</strong> A faixa é calculada a partir do número de acertos (tabela calibrada com faixas típicas do ENEM) com ajuste de coerência: errar questões fáceis e acertar difíceis reduz a estimativa. A redação é corrigida por um corretor automático baseado em regras.</p>";
  }
  function htmlResultado(sim) {
    var r = sim.resultado, areas = sim.dia === 1 ? ["LC", "CH"] : ["CN", "MT"];
    var h = "<p>" + (sim.dia === 1 ? "Simulado 1 · ENEM 1º dia" + (sim.lingua ? " (" + (sim.lingua === "ingles" ? "Inglês" : "Espanhol") + ")" : "") : "Simulado 2 · ENEM 2º dia") + " · tempo: " + fmtTempo(r.tempo) + "</p>";
    h += "<div class='resumo'><div class='kpi verde'><b>" + fmtPct(pct(r.acertos, 90)) + "</b>acertos (" + r.acertos + "/90)</div><div class='kpi verm'><b>" + fmtPct(pct(90 - r.acertos, 90)) + "</b>erros (" + r.erros + " erradas + " + r.brancos + " em branco)</div>";
    if (sim.dia === 1) h += "<div class='kpi'><b>" + r.redacao + "</b>redação (estimativa)</div>";
    h += "<div class='kpi'><b>" + r.mediaDia.min + "–" + r.mediaDia.max + "</b>média estimada do dia" + (sim.dia === 1 ? " (LC + CH + redação)" : "") + "</div></div>";
    h += "<div class='areas'>";
    areas.forEach(function (a) { h += linhaArea(NOMES[a], r.por[a], r.est[a]); });
    if (sim.dia === 1) h += linhaRedacao(r.redacao, sim.redacao.texto.trim() ? "Estimativa do corretor automático (0 a 1000)" : "Em branco (nota zero)");
    h += "</div>";
    areas.forEach(function (a) { if (r.est[a].nota) h += "<p class='nota-peq'><strong>" + NOMES[a] + ":</strong> " + esc(r.est[a].nota) + "</p>"; });
    h += avisoEstimativa();
    h += "<div class='acoes'><button class='btn btn-pri' data-res='refazer' data-dia='" + sim.dia + "'>Refazer</button><button class='btn btn-sec' data-res='revisar' data-dia='" + sim.dia + "'>Rever prova completa</button>" +
      (sim.dia === 1 ? "<button class='btn btn-sec' data-res='redacao' data-dia='1'>Ver correção da redação</button>" : "") + "<button class='btn btn-sec' data-res='inicio'>Início</button></div>";
    return h;
  }
  function htmlErros(sim) {
    var r = sim.resultado;
    if (!r.errosIdx.length) return "<h2 class='h3'>Questões erradas</h2><p>Parabéns: nenhuma questão errada ou em branco!</p>";
    var h = "<h2 class='h3'>Questões erradas ou em branco (" + r.errosIdx.length + ")</h2><p class='nota-peq'>Toque para revisar o enunciado, sua resposta, o gabarito e o comentário.</p>";
    r.errosIdx.forEach(function (i) {
      var id = sim.qids[i], info = Q[id], resp = sim.answers[id], num = numeroDe(sim, i);
      if (!info) { h += "<details class='rev'><summary>Questão " + num + " (indisponível)</summary></details>"; return; }
      var q = info.q;
      h += "<details class='rev'><summary>Questão " + num + " · " + NOMES[areaDe(sim, i)] + (resp ? "<span class='selo e'>marcou " + resp + " · gabarito " + q.gabarito + "</span>" : "<span class='selo b'>em branco · gabarito " + q.gabarito + "</span>") +
        "<br><small>" + esc(q.enunciado.slice(0, 120)) + (q.enunciado.length > 120 ? "…" : "") + "</small></summary><div class='corpo'><div class='texto-base'>" + renderTexto(q.texto) + "</div>" +
        (q.fonte ? "<p class='fonte'>" + esc(q.fonte) + "</p>" : "") + "<p class='enunciado'>" + esc(q.enunciado) + "</p>";
      q.alternativas.forEach(function (a, k) {
        var L = "ABCDE"[k], cls = "alt bloq" + (L === q.gabarito ? " certa" : (L === resp ? " errada" : ""));
        h += "<div class='" + cls + "'><span class='letra'>" + L + "</span><span>" + esc(a) + "</span></div>";
      });
      h += "<div class='feedback " + (resp ? "erro" : "neutro") + "'><strong>Comentário</strong>" + esc(q.comentario) + "</div></div></details>";
    });
    return h;
  }
  function htmlGeral() {
    var a = S.sims.d1.resultado, b = S.sims.d2.resultado;
    var ac = a.acertos + b.acertos;
    var est = { LC: a.est.LC, CH: a.est.CH, CN: b.est.CN, MT: b.est.MT };
    var min = Math.round((est.LC.min + est.CH.min + est.CN.min + est.MT.min + a.redacao) / 5), max = Math.round((est.LC.max + est.CH.max + est.CN.max + est.MT.max + a.redacao) / 5);
    var h = "<p>Resultado combinado dos dois dias (180 questões + redação).</p>";
    h += "<div class='resumo'><div class='kpi verde'><b>" + fmtPct(pct(ac, 180)) + "</b>acertos (" + ac + "/180)</div><div class='kpi verm'><b>" + fmtPct(pct(180 - ac, 180)) + "</b>erros (" + (a.erros + b.erros) + " erradas + " + (a.brancos + b.brancos) + " em branco)</div><div class='kpi'><b>" + min + "–" + max + "</b>média geral estimada (5 notas)</div></div>";
    h += "<div class='areas'>" + linhaArea(NOMES.LC, a.por.LC, est.LC) + linhaArea(NOMES.CH, a.por.CH, est.CH) + linhaArea(NOMES.CN, b.por.CN, est.CN) + linhaArea(NOMES.MT, b.por.MT, est.MT);
    h += linhaRedacao(a.redacao, "Estimativa do corretor automático (0 a 1000)") + "</div>";
    h += avisoEstimativa();
    h += "<div class='acoes'><button class='btn btn-sec' data-res='inicio'>Início</button></div>";
    return h;
  }

  /* ---------- refazer ---------- */
  function refazer(dia) {
    var sim = S.sims["d" + dia];
    var emAndamento = sim && sim.status === "running";
    confirmar(emAndamento ? "Recomeçar o simulado?" : "Refazer o simulado",
      "<p>" + (emAndamento ? "As respostas atuais deste simulado serão apagadas." : "Escolha como quer refazer:") + "</p><ul><li><strong>Mesmo simulado:</strong> as mesmas questões" + (dia === 1 ? " e o mesmo tema de redação" : "") + ", com as respostas apagadas.</li><li><strong>Novo sorteio:</strong> outras questões (priorizando as que você ainda não viu)" + (dia === 1 ? " e outro tema de redação" : "") + ".</li></ul>" + (dia === 1 ? "<p class='nota-peq'>O texto da redação também será apagado (exporte o progresso antes se quiser guardá-lo).</p>" : ""), [
      { t: "Refazer o mesmo simulado", c: "btn-pri", f: function () {
        arquivarResultado(dia);
        var novo = novoSim(dia, sim.lingua, sim.correcao, { qids: sim.qids, tema: sim.tema });
        ir("prova", dia);
      } },
      { t: "Novo sorteio (outras questões" + (dia === 1 ? " e outro tema" : "") + ")", c: "btn-sec", f: function () {
        cfgPend = { dia: dia, evitarTema: sim.tema };
        ir("config", dia);
      } },
      { t: "Cancelar", c: "btn-sec" }
    ]);
  }

  /* =====================================================================
   * v2: tentativas/evolução, caderno de erros, treino livre, só redação, ENEM agora
   * ===================================================================== */
  var NOMES_TIPO = { d1: "Simulado 1", d2: "Simulado 2", treino: "Treino livre", redacao: "Redação" };
  var CORES_TIPO = { d1: "#1d4ed8", d2: "#15803d", treino: "#a16207", redacao: "#7c3aed" };
  var DIF_NOME = { 1: "fácil", 2: "média", 3: "difícil" };
  function areaDoId(id) { return Q[id] ? Q[id].area : null; }
  function chaveAssunto(q, area) { return area + "|" + (q.disc || NOMES[area]) + "|" + (q.assunto || q.tema || "Geral"); }
  function fmtData(iso) { try { var d = new Date(iso); return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }

  /* itens: [{id, resp, contaBranco}] -> resumo por área e por assunto */
  function resumir(itens) {
    var areas = {}, ass = {}, ac = 0, tot = 0;
    itens.forEach(function (it) {
      var info = Q[it.id]; if (!info) return;
      if (!it.resp && !it.contaBranco) return;
      var certo = it.resp === info.q.gabarito, a = info.area, k = chaveAssunto(info.q, a);
      tot++; if (certo) ac++;
      areas[a] = areas[a] || [0, 0]; areas[a][1]++; if (certo) areas[a][0]++;
      ass[k] = ass[k] || [0, 0]; ass[k][1]++; if (certo) ass[k][0]++;
    });
    return { ac: ac, tot: tot, areas: areas, ass: ass };
  }
  function registrarTentativa(t) {
    t.em = t.em || new Date().toISOString();
    if (t.tot) t.pct = pct(t.ac, t.tot);
    S.tentativas.push(t);
    if (S.tentativas.length > 200) S.tentativas = S.tentativas.slice(-200);
  }
  function anotarCaderno(id, resp, origem) {
    if (!Q[id]) return;
    var c = S.caderno[id] || { erros: 0 };
    c.erros++; c.resp = resp || null; c.ultima = new Date().toISOString(); c.origem = origem;
    S.caderno[id] = c;
  }
  function registrarSimulado(sim) {
    var itens = sim.qids.map(function (id) { return { id: id, resp: sim.answers[id], contaBranco: true }; });
    var r = resumir(itens), res = sim.resultado;
    registrarTentativa({ tipo: "d" + sim.dia, ac: r.ac, tot: r.tot, areas: r.areas, ass: r.ass,
      nota: Math.round((res.mediaDia.min + res.mediaDia.max) / 2), redacao: sim.dia === 1 ? res.redacao : undefined });
    sim.qids.forEach(function (id) { var resp = sim.answers[id]; if (resp && Q[id] && resp !== Q[id].q.gabarito) anotarCaderno(id, resp, NOMES_TIPO["d" + sim.dia]); });
  }

  /* ---------- treino livre ---------- */
  function poolFiltrado(f) {
    return Object.keys(Q).filter(function (id) {
      var i = Q[id];
      if (f.area && i.area !== f.area) return false;
      if (f.disc && (i.q.disc || "") !== f.disc) return false;
      if (f.dif && String(i.q.dif) !== String(f.dif)) return false;
      if (f.origem === "oficiais" && !i.q.oficial) return false;
      if (f.origem === "ineditas" && i.q.oficial) return false;
      if (f.assunto && chaveAssunto(i.q, i.area) !== f.assunto) return false;
      return true;
    }).map(function (id) { return Q[id].q; });
  }
  function filtrosDoForm() { return { area: $("#f-area").value, disc: $("#f-disc").value, dif: $("#f-dif").value, origem: $("#f-origem") ? $("#f-origem").value : "" }; }
  function preencherDisc() {
    var area = $("#f-area").value, sel = $("#f-disc"), atualV = sel.value, ds = {};
    Object.keys(Q).forEach(function (id) { var i = Q[id]; if ((!area || i.area === area) && i.q.disc) ds[i.q.disc] = 1; });
    var lista = Object.keys(ds).sort(function (a, b) { return a.localeCompare(b, "pt-BR"); });
    sel.innerHTML = "<option value=''>Todas</option>" + lista.map(function (d) { return "<option" + (d === atualV ? " selected" : "") + ">" + esc(d) + "</option>"; }).join("");
  }
  function atualizarDisp() {
    var n = poolFiltrado(filtrosDoForm()).length;
    $("#f-disp").textContent = n + (n === 1 ? " questão disponível" : " questões disponíveis") + " com esses filtros.";
    $("#btn-treinar").disabled = n === 0;
  }
  (function montarFiltros() {
    $("#f-area").innerHTML = "<option value=''>Todas</option>" + ["LC", "CH", "CN", "MT"].map(function (a) { return "<option value='" + a + "'>" + NOMES[a] + "</option>"; }).join("");
    preencherDisc();
    $("#f-area").addEventListener("change", function () { $("#f-disc").value = ""; preencherDisc(); atualizarDisp(); });
    ["#f-disc", "#f-dif", "#f-qtd", "#f-origem"].forEach(function (s) { $(s).addEventListener("change", atualizarDisp); });
  })();
  $("#form-treino").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = filtrosDoForm(), pool = poolFiltrado(f), n = +$("#f-qtd").value;
    var qids = $("#f-novas").checked ? sortear(pool, n) : embaralhar(pool).slice(0, n).map(function (q) { return q.id; });
    var rot = [f.area ? NOMES[f.area] : "Todas as áreas", f.disc, f.dif ? "dificuldade " + DIF_NOME[f.dif] : "", f.origem === "oficiais" ? "provas oficiais" : f.origem === "ineditas" ? "inéditas" : ""].filter(Boolean).join(" · ");
    iniciarTreino(qids, rot, "livre");
  });
  function iniciarTreino(qids, titulo, modo) {
    if (!qids.length) { toast("Nenhuma questão para treinar."); return; }
    qids.forEach(function (id) { S.seen[id] = (S.seen[id] || 0) + 1; });
    S.treino = { qids: qids, answers: {}, idx: 0, titulo: titulo, modo: modo, status: "running", em: new Date().toISOString(), saiu: 0 };
    salvar();
    if (atual.tela === "treino") renderTreino(); else ir("treino");
  }
  function renderTreino() {
    mostrarTela("tela-treino");
    document.title = "Treino livre | Simulados ENEM";
    var t = S.treino, ativo = t && t.status === "running";
    $("#form-treino").hidden = !!t; $("#treino-sessao").hidden = !ativo; $("#treino-fim").hidden = !(t && t.status === "done");
    $("#titulo-treino").textContent = t && t.modo === "caderno" ? "Refazer caderno de erros" : "Treino livre";
    if (!t) { preencherDisc(); atualizarDisp(); return; }
    if (ativo) renderTreinoQuestao(); else renderTreinoFim();
  }
  function htmlAlternativas(q, resp, rev, nome) {
    var h = "<fieldset class='alternativas' aria-labelledby='enun-" + nome + "'><legend class='sr-only'>Alternativas</legend>";
    q.alternativas.forEach(function (a, k) {
      var L = "ABCDE"[k], cls = "alt";
      if (resp === L) cls += " sel";
      if (rev) { cls += " bloq"; if (L === q.gabarito) cls += " certa"; else if (resp === L) cls += " errada"; }
      h += "<label class='" + cls + "'><input type='radio' name='" + nome + "' value='" + L + "'" + (resp === L ? " checked" : "") + (rev ? " disabled" : "") + "><span class='letra' aria-hidden='true'>" + L + "</span><span><span class='sr-only'>Alternativa " + L + ": </span>" + esc(a) + "</span></label>";
    });
    return h + "</fieldset>";
  }
  function renderTreinoQuestao(focar) {
    var t = S.treino, box = $("#treino-questao"), id = t.qids[t.idx], info = Q[id];
    var nResp = Object.keys(t.answers).length, nAc = t.qids.filter(function (x) { return Q[x] && t.answers[x] === Q[x].q.gabarito; }).length;
    $("#treino-prog").textContent = (t.titulo ? t.titulo + " — " : "") + "questão " + (t.idx + 1) + " de " + t.qids.length + " · " + nAc + "/" + nResp + " acertos";
    if (!info) { box.innerHTML = "<p>Questão indisponível nesta versão do banco.</p>"; } else {
      var q = info.q, resp = t.answers[id], rev = !!resp;
      var h = "<div class='q-cab'><span class='q-num'>Questão " + (t.idx + 1) + "</span><span class='q-area'>" + esc(NOMES[info.area]) + (q.disc ? " · " + esc(q.disc) : "") + (q.assunto ? " · " + esc(q.assunto) : "") + " · " + DIF_NOME[q.dif || 2] + "</span></div>";
      h += "<div class='texto-base'>" + renderTexto(q.texto) + "</div>" + (q.fonte ? "<p class='fonte'>" + esc(q.fonte) + "</p>" : "");
      h += "<p class='enunciado' id='enun-tr'>" + esc(q.enunciado) + "</p>" + htmlAlternativas(q, resp, rev, "tr");
      if (rev) {
        var ok = resp === q.gabarito;
        h += "<div class='feedback " + (ok ? "ok" : "erro") + "' role='status'><strong>" + (ok ? "✔ Resposta correta!" : "✘ Resposta incorreta. Você marcou " + resp + "; o gabarito é " + q.gabarito + ".") + "</strong>" + esc(q.comentario) +
          (t.modo === "caderno" && ok ? "<p class='nota-peq'>Esta questão saiu do caderno de erros.</p>" : "") + (!ok ? "<p class='nota-peq'>Anotada no caderno de erros.</p>" : "") + "</div>";
      }
      box.innerHTML = h;
      $$("input[name=tr]", box).forEach(function (inp) { inp.addEventListener("change", function () { responderTreino(inp.value); }); });
    }
    $("#treino-ant").disabled = t.idx === 0;
    $("#treino-prox").textContent = t.idx === t.qids.length - 1 ? "Ver resultado do treino" : "Próxima ›";
    if (focar) box.focus();
  }
  function responderTreino(L) {
    var t = S.treino, id = t.qids[t.idx], info = Q[id];
    if (!info || t.answers[id]) return;
    t.answers[id] = L;
    if (L === info.q.gabarito) { if (S.caderno[id]) { delete S.caderno[id]; t.saiu++; } }
    else anotarCaderno(id, L, t.modo === "caderno" ? "Caderno de erros" : "Treino livre");
    salvar(); renderTreinoQuestao();
    var f = $("#treino-questao .feedback"); if (f && f.scrollIntoView) f.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function encerrarTreino() {
    var t = S.treino; if (!t || t.status !== "running") return;
    t.status = "done";
    var r = resumir(t.qids.map(function (id) { return { id: id, resp: t.answers[id] }; }));
    if (r.tot) registrarTentativa({ tipo: "treino", ac: r.ac, tot: r.tot, areas: r.areas, ass: r.ass, titulo: t.titulo, modo: t.modo });
    t.res = { ac: r.ac, tot: r.tot };
    salvar(); renderTreino(); window.scrollTo(0, 0);
  }
  function renderTreinoFim() {
    var t = S.treino, r = t.res || { ac: 0, tot: 0 };
    var h = "<div class='cartao'><h2 class='h3'>Resultado do treino</h2>" + (t.titulo ? "<p class='nota-peq'>" + esc(t.titulo) + "</p>" : "");
    h += r.tot ? "<div class='resumo'><div class='kpi verde'><b>" + fmtPct(pct(r.ac, r.tot)) + "</b>acertos (" + r.ac + "/" + r.tot + ")</div><div class='kpi verm'><b>" + (r.tot - r.ac) + "</b>erros (foram para o caderno)</div>" + (t.saiu ? "<div class='kpi'><b>" + t.saiu + "</b>saíram do caderno</div>" : "") + "</div>"
      : "<p>Nenhuma questão respondida neste treino.</p>";
    if (r.tot) {
      var o = { ac: 0, tot: 0 }, n = { ac: 0, tot: 0 };
      t.qids.forEach(function (id) {
        var L = t.answers[id], info = Q[id]; if (!L || !info) return;
        var g = info.q.oficial ? o : n; g.tot++; if (L === info.q.gabarito) g.ac++;
      });
      var lin = function (nome, g) { return "<li><b>" + nome + ":</b> " + g.ac + " de " + g.tot + " (" + fmtPct(pct(g.ac, g.tot)) + ")</li>"; };
      if (o.tot || n.tot) h += "<ul class='por-origem' style='margin:8px 0 0;padding-left:18px'>" + (o.tot ? lin("Provas oficiais do ENEM", o) : "") + (n.tot ? lin("Inéditas", n) : "") + "</ul>";
    }
    h += "<div class='acoes'><button class='btn btn-pri' id='tr-novo'>Novo treino</button><button class='btn btn-sec' data-ir='caderno'>Caderno de erros</button><button class='btn btn-sec' data-ir='evolucao'>Minha evolução</button></div></div>";
    $("#treino-fim").innerHTML = h;
    $("#tr-novo").addEventListener("click", function () { S.treino = null; salvar(); renderTreino(); });
  }
  $("#treino-ant").addEventListener("click", function () { var t = S.treino; if (t.idx > 0) { t.idx--; salvar(); renderTreinoQuestao(true); window.scrollTo(0, 0); } });
  $("#treino-prox").addEventListener("click", function () {
    var t = S.treino;
    if (t.idx >= t.qids.length - 1) { encerrarTreino(); return; }
    t.idx++; salvar(); renderTreinoQuestao(true); window.scrollTo(0, 0);
  });
  $("#treino-sair").addEventListener("click", function () {
    var t = S.treino, faltam = t.qids.length - Object.keys(t.answers).length;
    if (!faltam) { encerrarTreino(); return; }
    confirmar("Encerrar o treino?", "<p>Faltam " + faltam + " questão(ões). Só as respondidas contam no histórico.</p>", [
      { t: "Encerrar e ver resultado", c: "btn-pri", f: encerrarTreino },
      { t: "Descartar treino", c: "btn-sec", f: function () { S.treino = null; salvar(); renderTreino(); } },
      { t: "Continuar", c: "btn-sec" }]);
  });

  /* ---------- caderno de erros ---------- */
  function renderCaderno() {
    mostrarTela("tela-caderno");
    document.title = "Caderno de erros | Simulados ENEM";
    var ids = Object.keys(S.caderno).filter(function (id) { return Q[id]; });
    var box = $("#caderno-conteudo");
    if (!ids.length) { box.innerHTML = "<div class='cartao'><p>Seu caderno está vazio. Faça um simulado ou um treino: as questões que você errar aparecem aqui.</p><div class='acoes'><button class='btn btn-pri' data-ir='treino'>Fazer um treino</button></div></div>"; return; }
    ids.sort(function (a, b) { return (S.caderno[b].ultima || "").localeCompare(S.caderno[a].ultima || ""); });
    var porArea = {}; ids.forEach(function (id) { var a = Q[id].area; porArea[a] = (porArea[a] || 0) + 1; });
    var h = "<div class='cartao'><p class='status'>" + ids.length + " questão(ões) para refazer · " + ["LC", "CH", "CN", "MT"].filter(function (a) { return porArea[a]; }).map(function (a) { return NOMES[a] + ": " + porArea[a]; }).join(" · ") + "</p>";
    h += "<div class='acoes'><button class='btn btn-pri' id='cad-refazer'>Refazer todas (" + ids.length + ")</button>";
    ["LC", "CH", "CN", "MT"].forEach(function (a) { if (porArea[a] && porArea[a] < ids.length) h += "<button class='btn btn-sec btn-peq' data-cad-area='" + a + "'>Só " + NOMES[a] + "</button>"; });
    h += "</div></div>";
    ids.forEach(function (id) {
      var info = Q[id], q = info.q, c = S.caderno[id];
      h += "<details class='rev'><summary>" + esc(NOMES[info.area]) + (q.disc ? " · " + esc(q.disc) : "") + (q.assunto ? " · " + esc(q.assunto) : "") +
        "<span class='selo e'>errou " + c.erros + "×" + (c.resp ? " · marcou " + c.resp : "") + "</span><br><small>" + esc(q.enunciado.slice(0, 120)) + (q.enunciado.length > 120 ? "…" : "") + "</small></summary>" +
        "<div class='corpo'><div class='texto-base'>" + renderTexto(q.texto) + "</div>" + (q.fonte ? "<p class='fonte'>" + esc(q.fonte) + "</p>" : "") + "<p class='enunciado'>" + esc(q.enunciado) + "</p>" +
        q.alternativas.map(function (a, k) { return "<div class='alt bloq'><span class='letra'>" + "ABCDE"[k] + "</span><span>" + esc(a) + "</span></div>"; }).join("") +
        "<p class='nota-peq'>Origem: " + esc(c.origem || "simulado") + " · último erro em " + fmtData(c.ultima) + ". Refaça para ver o gabarito e o comentário.</p>" +
        "<div class='acoes'><button class='btn btn-pri btn-peq' data-cad-uma='" + id + "'>Refazer esta</button><button class='btn btn-sec btn-peq' data-cad-rem='" + id + "'>Remover do caderno</button></div></div></details>";
    });
    box.innerHTML = h;
    $("#cad-refazer").addEventListener("click", function () { iniciarTreino(embaralhar(ids), "Caderno de erros", "caderno"); });
    $$("[data-cad-area]", box).forEach(function (b) { b.addEventListener("click", function () { var a = b.getAttribute("data-cad-area"); iniciarTreino(embaralhar(ids.filter(function (id) { return Q[id].area === a; })), "Caderno de erros · " + NOMES[a], "caderno"); }); });
    $$("[data-cad-uma]", box).forEach(function (b) { b.addEventListener("click", function () { iniciarTreino([b.getAttribute("data-cad-uma")], "Caderno de erros", "caderno"); }); });
    $$("[data-cad-rem]", box).forEach(function (b) { b.addEventListener("click", function () { delete S.caderno[b.getAttribute("data-cad-rem")]; salvar(); renderCaderno(); toast("Questão removida do caderno."); }); });
  }

  /* ---------- evolução ---------- */
  function valorTentativa(t) { return t.tipo === "redacao" ? t.nota / 10 : t.pct; }
  function fmtMelhora(t, ant) {
    if (!ant) return "<span class='nota-peq'>primeira tentativa</span>";
    var a = t.tipo === "redacao" ? t.nota : t.pct, b = t.tipo === "redacao" ? ant.nota : ant.pct;
    var dif = Math.round((a - b) * 10) / 10, rel = b ? Math.round((a - b) / b * 1000) / 10 : null;
    var cls = dif > 0 ? "verde" : (dif < 0 ? "verm" : "");
    var un = t.tipo === "redacao" ? " pontos" : " p.p.";
    return "<span class='" + cls + "'>" + (dif > 0 ? "+" : "") + String(dif).replace(".", ",") + un + (rel !== null ? " (" + (rel > 0 ? "+" : "") + fmtPct(rel) + ")" : "") + "</span>";
  }
  function graficoSVG(lista) {
    var W = 480, H = 240, pl = 44, pr = 12, pt = 14, pb = 30, n = lista.length;
    var x = function (i) { return pl + (n === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (n - 1)); };
    var y = function (v) { return pt + (100 - Math.max(0, Math.min(100, v))) * (H - pt - pb) / 100; };
    var s = "<svg class='grafico' viewBox='0 0 " + W + " " + H + "' role='img' aria-label='Gráfico do aproveitamento por tentativa'>";
    [0, 25, 50, 75, 100].forEach(function (g) { s += "<line x1='" + pl + "' x2='" + (W - pr) + "' y1='" + y(g) + "' y2='" + y(g) + "' class='grade-linha'/><text x='" + (pl - 6) + "' y='" + (y(g) + 4) + "' text-anchor='end' class='eixo'>" + g + "%</text>"; });
    Object.keys(NOMES_TIPO).forEach(function (tipo) {
      var pts = []; lista.forEach(function (t, i) { if (t.tipo === tipo) pts.push([x(i), y(valorTentativa(t)), t]); });
      if (!pts.length) return;
      if (pts.length > 1) s += "<polyline fill='none' stroke='" + CORES_TIPO[tipo] + "' stroke-width='2.5' points='" + pts.map(function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); }).join(" ") + "'/>";
      pts.forEach(function (p) { s += "<circle cx='" + p[0].toFixed(1) + "' cy='" + p[1].toFixed(1) + "' r='4.5' fill='" + CORES_TIPO[tipo] + "'><title>" + NOMES_TIPO[tipo] + ": " + (tipo === "redacao" ? p[2].nota + " pontos" : fmtPct(p[2].pct)) + " · " + fmtData(p[2].em) + "</title></circle>"; });
    });
    s += "<text x='" + pl + "' y='" + (H - 8) + "' class='eixo'>mais antiga</text><text x='" + (W - pr) + "' y='" + (H - 8) + "' text-anchor='end' class='eixo'>mais recente</text></svg>";
    return s;
  }
  function oQueEstudar() {
    var ag = {};
    S.tentativas.slice(-30).forEach(function (t) { Object.keys(t.ass || {}).forEach(function (k) { var v = t.ass[k]; ag[k] = ag[k] || [0, 0]; ag[k][0] += v[0]; ag[k][1] += v[1]; }); });
    return Object.keys(ag).map(function (k) { var v = ag[k]; return { k: k, erros: v[1] - v[0], tot: v[1], taxa: (v[1] - v[0]) / v[1] }; })
      .filter(function (o) { return o.erros > 0; })
      .sort(function (a, b) { return b.erros - a.erros || b.taxa - a.taxa; }).slice(0, 8);
  }
  function renderEvolucao() {
    mostrarTela("tela-evolucao");
    document.title = "Minha evolução | Simulados ENEM";
    var box = $("#evolucao-conteudo"), L = S.tentativas.slice(-40);
    if (!L.length) { box.innerHTML = "<div class='cartao'><p>Ainda não há tentativas registradas. Finalize um simulado, um treino ou corrija uma redação no modo “Só redação” para começar seu histórico.</p></div>"; return; }
    var h = "<div class='resumo'>";
    Object.keys(NOMES_TIPO).forEach(function (tipo) {
      var dt = S.tentativas.filter(function (t) { return t.tipo === tipo; }); if (!dt.length) return;
      var u = dt[dt.length - 1], a = dt[dt.length - 2];
      h += "<div class='kpi'><b>" + (tipo === "redacao" ? u.nota : fmtPct(u.pct)) + "</b>" + NOMES_TIPO[tipo] + " (última, " + dt.length + " tentativa" + (dt.length > 1 ? "s" : "") + ")<br>" + fmtMelhora(u, a) + "</div>";
    });
    h += "</div>";
    h += "<div class='cartao'><h2 class='h3'>Aproveitamento por tentativa</h2>" + graficoSVG(L) + "<p class='legenda-graf'>" +
      Object.keys(NOMES_TIPO).filter(function (tp) { return L.some(function (t) { return t.tipo === tp; }); }).map(function (tp) { return "<span><i style='background:" + CORES_TIPO[tp] + "'></i>" + NOMES_TIPO[tp] + (tp === "redacao" ? " (nota ÷ 10)" : " (% de acertos)") + "</span>"; }).join("") + "</p></div>";
    var est = oQueEstudar();
    h += "<div class='cartao'><h2 class='h3'>O que estudar</h2>";
    if (!est.length) h += "<p>Nenhum erro registrado nas últimas tentativas. Continue assim!</p>";
    else {
      h += "<p class='nota-peq'>Assuntos com mais erros nas suas últimas tentativas (erros/questões feitas).</p><ol class='estudar'>";
      est.forEach(function (o) { var p = o.k.split("|"); h += "<li><span><strong>" + esc(p[2]) + "</strong> <small>" + (p[1] !== NOMES[p[0]] ? esc(p[1]) + " · " : "") + esc(NOMES[p[0]] || p[0]) + "</small></span><span class='verm'>" + o.erros + "/" + o.tot + "</span><button class='btn btn-sec btn-peq' data-estudar='" + esc(o.k) + "'>Treinar</button></li>"; });
      h += "</ol>";
    }
    h += "</div>";
    h += "<div class='cartao'><h2 class='h3'>Histórico</h2><div class='tabela-wrap'><table><tr><th>Data</th><th>Tipo</th><th>Resultado</th><th>Variação</th></tr>";
    var ultimoPorTipo = {}, linhas = [];
    S.tentativas.forEach(function (t) { linhas.push("<tr><td>" + fmtData(t.em) + "</td><td>" + NOMES_TIPO[t.tipo] + (t.titulo ? "<br><small>" + esc(t.titulo) + "</small>" : "") + "</td><td>" + (t.tipo === "redacao" ? t.nota + " pontos" : t.ac + "/" + t.tot + " (" + fmtPct(t.pct) + ")" + (t.nota ? "<br><small>média estimada ≈ " + t.nota + "</small>" : "")) + "</td><td>" + fmtMelhora(t, ultimoPorTipo[t.tipo]) + "</td></tr>"); ultimoPorTipo[t.tipo] = t; });
    h += linhas.reverse().slice(0, 30).join("") + "</table></div><p class='nota-peq'>Variação = diferença para a tentativa anterior do mesmo tipo, em pontos percentuais (p.p.) e em % de melhora.</p></div>";
    box.innerHTML = h;
    $$("[data-estudar]", box).forEach(function (b) { b.addEventListener("click", function () {
      var k = b.getAttribute("data-estudar"), pool = poolFiltrado({ assunto: k });
      iniciarTreino(sortear(pool, Math.min(10, pool.length)), k.split("|")[2], "livre");
    }); });
  }

  /* ---------- só redação ---------- */
  function renderSoRedacao() {
    mostrarTela("tela-redacao");
    document.title = "Treino de redação | Simulados ENEM";
    $("#area-questao").innerHTML = "";
    if (!S.soRed || !temaPorId(S.soRed.tema) || temaPorId(S.soRed.tema).id !== S.soRed.tema) { S.soRed = { tema: sortearTema(), redacao: { texto: "", res: null } }; salvar(); }
    var sel = $("#sr-tema");
    sel.innerHTML = TEMAS.map(function (t) { return "<option value='" + esc(t.id) + "'" + (t.id === S.soRed.tema ? " selected" : "") + ">" + esc(t.tema) + "</option>"; }).join("");
    renderRedacao({ tema: S.soRed.tema, redacao: S.soRed.redacao, status: "running", soRedacao: true }, $("#sr-area"));
  }
  function trocarTema(id) { S.soRed.tema = id; S.soRed.redacao.res = null; if (S.temasVistos.indexOf(id) < 0) S.temasVistos.push(id); salvar(); renderSoRedacao(); }
  $("#sr-tema").addEventListener("change", function () { trocarTema(this.value); });
  $("#sr-sortear").addEventListener("click", function () { trocarTema(sortearTema(S.soRed.tema)); toast("Novo tema sorteado. Seu texto foi mantido."); });
  $("#sr-limpar").addEventListener("click", function () {
    confirmar("Começar nova redação?", "<p>O texto atual será apagado (as notas já corrigidas continuam no seu histórico).</p>", [
      { t: "Apagar e começar", c: "btn-pri", f: function () { S.soRed.redacao = { texto: "", res: null }; salvar(); renderSoRedacao(); } },
      { t: "Cancelar", c: "btn-sec" }]);
  });

  /* ---------- ENEM agora ---------- */
  function renderAgora() {
    mostrarTela("tela-agora");
    document.title = "ENEM agora: horários, documentos e datas | Simulados ENEM";
    var A = window.ENEM_AGORA, box = $("#agora-conteudo");
    if (!A) { box.innerHTML = "<p>Informações indisponíveis.</p>"; return; }
    var h = "<p class='aviso-auto'>Informações conferidas em " + esc(A.conferidoEm) + ". Fonte: <a href='" + esc(A.fonte.url) + "' target='_blank' rel='noopener'>" + esc(A.fonte.nome) + "</a>. Confira sempre o site oficial antes da prova.</p>";
    A.secoes.forEach(function (s) {
      h += "<div class='cartao agora'><h2 class='h3'>" + esc(s.titulo) + "</h2><ul>" + s.itens.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>" + (s.dica ? "<p class='nota-peq'>" + esc(s.dica) + "</p>" : "") + "</div>";
    });
    box.innerHTML = h;
  }

  /* ---------- modais ---------- */
  var focoAntes = null;
  function abrirModal(id) {
    focoAntes = document.activeElement;
    var m = $("#" + id); m.hidden = false;
    var f = m.querySelector("button, [href], input"); if (f) f.focus();
  }
  function fecharModais() { var abriu = false; $$(".modal").forEach(function (m) { if (!m.hidden) abriu = true; m.hidden = true; }); if (abriu && focoAntes && focoAntes.focus) try { focoAntes.focus(); } catch (e) {} }
  function confirmar(titulo, html, botoes) {
    $("#t-confirma").textContent = titulo; $("#confirma-texto").innerHTML = html;
    var c = $("#confirma-botoes"); c.innerHTML = "";
    botoes.forEach(function (b) {
      var x = document.createElement("button"); x.className = "btn " + b.c; x.textContent = b.t;
      x.addEventListener("click", function () { fecharModais(); if (b.f) b.f(); });
      c.appendChild(x);
    });
    fecharModais(); abrirModal("modal-confirma");
  }
  $$(".modal").forEach(function (m) {
    m.addEventListener("click", function (e) { if (e.target === m) fecharModais(); });
    $$("[data-fechar]", m).forEach(function (b) { b.addEventListener("click", fecharModais); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") fecharModais();
    if (atual.tela === "prova" && !/textarea|input/i.test((e.target.tagName || "")) && $$(".modal:not([hidden])").length === 0) {
      if (e.key === "ArrowRight") $("#btn-prox").click();
      if (e.key === "ArrowLeft" && !$("#btn-ant").disabled) $("#btn-ant").click();
    }
  });

  /* ---------- ações globais ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-acao],[data-ir]") : null;
    if (!b) return;
    var acao = b.getAttribute("data-acao"), destino = b.getAttribute("data-ir");
    if (destino) { e.preventDefault(); fecharModais(); ir(destino); return; }
    if (acao === "salvar") { salvar(true); fecharModais(); }
    else if (acao === "exportar") { exportar(); }
    else if (acao === "importar") { $("#arquivo-importar").value = ""; $("#arquivo-importar").click(); }
    else if (acao === "finalizar") { fecharModais(); pedirFinalizar(); }
    else if (acao === "ver-resultado") { fecharModais(); ir("resultado", atual.dia); }
  });
  $("#arquivo-importar").addEventListener("change", function () { if (this.files && this.files[0]) importar(this.files[0]); });
  $("#btn-geral").addEventListener("click", function () { ir("geral"); });

  /* ---------- anúncios (apenas espaços reservados) ---------- */
  // ADS_ENABLED = false: nenhum script de anúncio é carregado; o espaço da tela de correção fica reservado (oculto) e os demais são removidos.
  $$(".ad-slot").forEach(function (el) { if (CFG.ADS_ENABLED) { el.hidden = false; el.removeAttribute("aria-hidden"); } else if (el.getAttribute("data-ad") !== "resultado") el.remove(); });

  /* ---------- canonical / og:url a partir da configuração ---------- */
  (function () {
    var c = document.querySelector("link[rel=canonical]"); if (c) c.href = CFG.BASE_URL;
    var o = document.querySelector("meta[property='og:url']"); if (o) o.content = CFG.BASE_URL;
  })();

  /* ---------- início ---------- */
  if (!lsOk) mostrarAvisoArmazenamento("Seu navegador está bloqueando o armazenamento local (ex.: modo privado). O progresso não será salvo automaticamente — use “Exportar progresso” para guardar uma cópia.");
  carregar();
  rotaDoHash();
  history.replaceState(null, "", "#" + atual.tela + (atual.dia ? "-" + atual.dia : ""));
  render();
  window.__app = {
    estado: function () { return S; }, Q: Q, versao: 2,
    substituir: function (o) { if (!valido(o)) return; S = normalizar(o); salvar(); render(); }
  };
  if (window.SiteSync) window.SiteSync.appPronto();
})();
