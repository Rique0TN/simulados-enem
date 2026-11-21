/* EletroMaster — login com Google (opcional) e projetos salvos na nuvem.
 * Firebase do projeto simulados-enem-b7456 (mesmo login do site de simulados).
 * Cada projeto vira um documento em usuarios/{uid}/eletromaster/{idProjeto} = { dados: JSON, atualizado }.
 * Sem login (ou sem internet) tudo continua salvo só no aparelho. */
(function () {
  'use strict';
  const CFG = { apiKey: 'AIzaSyBEyAvAfWjqMMORxxgBZlpxUY3dnVCJ19A', authDomain: 'simulados-enem-b7456.firebaseapp.com', projectId: 'simulados-enem-b7456', storageBucket: 'simulados-enem-b7456.firebasestorage.app', messagingSenderId: '537375938062', appId: '1:537375938062:web:c98d5456322a61cccece5f' };
  const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/', K_LOBBY = 'eletromaster.lobby';
  let auth = null, db = null, usuario = null, pronto = false, timer = null, enviados = {}, status = '';
  const el = id => document.getElementById(id);
  const carregarJS = src => new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error(src)); document.head.appendChild(s); });
  const col = () => db.collection('usuarios').doc(usuario.uid).collection('eletromaster');

  function renderConta() {
    const a = el('contaArea'); if (!a) return;
    if (!auth) { a.innerHTML = ''; return; }
    if (usuario) {
      const nome = (usuario.displayName || usuario.email || 'Conta').split(' ')[0];
      a.innerHTML = `<span class="conta-nome" title="${status}">☁️ ${nome.replace(/[<>&"]/g, '')}</span><button class="btn peq" id="btnSair">Sair</button>`;
      el('btnSair').onclick = () => confirmar('Sair da conta? Os projetos continuam neste aparelho.', () => auth.signOut(), 'Sair');
    } else { a.innerHTML = '<button class="btn primario peq" id="btnEntrar">Entrar</button>'; el('btnEntrar').onclick = entrar; }
    const n = el('avisoSalvo'); if (n) n.textContent = usuario ? 'Projetos salvos na sua conta Google e neste aparelho.' : 'Sem login: os projetos ficam salvos só neste aparelho.';
  }
  function entrar() {
    if (!auth) { aviso('Sem conexão com o login agora.'); return; }
    const p = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(p).catch(e => { if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) auth.signInWithRedirect(p); else if (e && e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') aviso('Não deu para entrar agora.'); });
  }

  // ---------- lobby ----------
  function lobbyEscolhido() { try { return localStorage.getItem(K_LOBBY) === 'convidado'; } catch { return false; } }
  function fecharLobby() { const l = el('lobby'); if (l) l.remove(); }
  function mostrarLobby() {
    if (el('lobby') || lobbyEscolhido()) return;
    const l = document.createElement('div'); l.id = 'lobby'; l.className = 'lobby';
    l.innerHTML = `<div class="lobby-caixa"><div class="lobby-raio">⚡</div><h2>EletroMaster</h2>
      <p class="lobby-sub">Planta baixa e projeto elétrico pela NBR 5410, com o porquê de cada valor.</p>
      <button class="btn primario lobby-btn" id="lbEntrar">Entrar com Google</button>
      <p class="lobby-nota">Seus projetos ficam salvos na conta e aparecem em qualquer aparelho.</p>
      <button class="btn lobby-btn" id="lbConv">Continuar sem login</button>
      <p class="lobby-aviso">⚠️ Sem login, os projetos ficam só neste aparelho. Dá pra perder se limpar os dados do navegador ou trocar de celular.</p></div>`;
    document.body.appendChild(l);
    el('lbEntrar').onclick = entrar;
    el('lbConv').onclick = () => { try { localStorage.setItem(K_LOBBY, 'convidado'); } catch { } fecharLobby(); };
  }

  // ---------- sincronização ----------
  function enviar() {
    if (!usuario || !pronto) return;
    const lote = db.batch(); let n = 0;
    banco.projetos.forEach(p => { if (enviados[p.id] !== p.atualizado) { lote.set(col().doc(p.id), { dados: JSON.stringify(p), atualizado: p.atualizado || Date.now() }); n++; } });
    (banco.apagados || []).forEach(id => { lote.delete(col().doc(id)); n++; });
    if (!n) return;
    const marca = banco.projetos.map(p => [p.id, p.atualizado]), apag = (banco.apagados || []).slice();
    lote.commit().then(() => {
      marca.forEach(([id, t]) => enviados[id] = t);
      banco.apagados = (banco.apagados || []).filter(id => !apag.includes(id)); salvarLocal();
      status = 'Sincronizado às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); renderConta();
    }).catch(e => { status = 'Sem conexão: salvo só no aparelho por enquanto.'; renderConta(); console.warn('sync', e && e.code); });
  }
  const salvarLocal = () => { try { localStorage.setItem(CHAVE, JSON.stringify(banco)); } catch { } };
  function sincronizarAoEntrar() {
    pronto = false; enviados = {};
    col().get().then(snap => {
      const apag = banco.apagados || []; let trouxe = 0;
      snap.forEach(d => {
        if (apag.includes(d.id)) return;
        let p; try { p = JSON.parse(d.data().dados); } catch { return; }
        const i = banco.projetos.findIndex(x => x.id === d.id);
        if (i < 0) { banco.projetos.push(p); trouxe++; }
        else if ((p.atualizado || 0) > (banco.projetos[i].atualizado || 0) && !(typeof proj !== 'undefined' && proj && proj.id === d.id)) { banco.projetos[i] = p; trouxe++; }
        if ((banco.projetos.find(x => x.id === d.id) || {}).atualizado === p.atualizado) enviados[d.id] = p.atualizado;
      });
      salvarLocal(); pronto = true;
      if (trouxe) { aviso(`${trouxe} projeto(s) da sua conta carregado(s).`); if (el('telaProjetos').classList.contains('ativa')) renderLista(); }
      enviar();
    }).catch(e => { status = 'Não foi possível sincronizar agora.'; renderConta(); console.warn('sync', e && e.code); });
  }

  window.EMNuvem = {
    agendar() { if (!usuario || !pronto) return; clearTimeout(timer); timer = setTimeout(enviar, 1500); },
    apagado(id) { banco.apagados = [...new Set([...(banco.apagados || []), id])]; salvarLocal(); this.agendar(); },
    logado: () => !!usuario
  };

  renderConta();
  carregarJS(SDK + 'firebase-app-compat.js').then(() => carregarJS(SDK + 'firebase-auth-compat.js')).then(() => carregarJS(SDK + 'firebase-firestore-compat.js')).then(() => {
    firebase.initializeApp(CFG); auth = firebase.auth(); db = firebase.firestore();
    auth.getRedirectResult().catch(() => { });
    auth.onAuthStateChanged(u => { usuario = u; status = ''; renderConta(); if (u) { fecharLobby(); sincronizarAoEntrar(); } else { pronto = false; mostrarLobby(); } });
  }).catch(() => { renderConta(); });
})();
