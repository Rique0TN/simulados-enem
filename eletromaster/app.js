/* EletroMaster — Módulo 1: editor de planta + projetos + área/perímetro
   Coordenadas internas em metros. Tudo salvo no localStorage do aparelho. */
'use strict';

const CHAVE = 'eletromaster.projetos.v1';
const TIPOS = [
  ['sala', 'Sala'], ['quarto', 'Quarto'], ['cozinha', 'Cozinha'], ['copa', 'Copa'],
  ['banheiro', 'Banheiro'], ['lavabo', 'Lavabo'], ['area_servico', 'Área de serviço'],
  ['varanda', 'Varanda'], ['corredor', 'Corredor'], ['garagem', 'Garagem'],
  ['escritorio', 'Escritório'], ['despensa', 'Despensa'], ['outro', 'Outro']
];
const nomeTipo = t => (TIPOS.find(x => x[0] === t) || [, 'Cômodo'])[1];
const CORES = { sala: '#3b9cff', quarto: '#a77bff', cozinha: '#ff9f43', copa: '#ffb86b', banheiro: '#2ed3c6', lavabo: '#2ed3c6', area_servico: '#5fd35f', varanda: '#9bd35f', corredor: '#8fa3bf', garagem: '#7f8c9f', escritorio: '#ff6fb5', despensa: '#c7a26b', outro: '#b0bccd' };

const GRADE = 0.05;      // ímã da grade: 5 cm
const TOL_PX = 16;       // tolerância de toque em pixels

// ---------- utilidades ----------
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const fmt = (v, c = 2) => v.toFixed(c).replace('.', ',');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function area(pts) { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; }
function perimetro(pts) { let s = 0; for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]); return s; }
function centroide(pts) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], f = a[0] * b[1] - b[0] * a[1]; A += f; cx += (a[0] + b[0]) * f; cy += (a[1] + b[1]) * f; }
  if (Math.abs(A) < 1e-9) { const n = pts.length; return [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n]; }
  return [cx / (3 * A), cy / (3 * A)];
}
function dentro(p, pts) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) r = !r;
  }
  return r;
}
function distSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
  let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
  return dist(p, [a[0] + t * dx, a[1] + t * dy]);
}
// "3,5" "3.5m" "350cm" "350 cm" -> metros. unidadePadrao: 'm' ou 'cm'
function lerMedida(txt, unidadePadrao) {
  if (txt == null) return NaN;
  let s = String(txt).trim().toLowerCase().replace(/\s+/g, '');
  let un = unidadePadrao;
  if (s.endsWith('cm')) { un = 'cm'; s = s.slice(0, -2); }
  else if (s.endsWith('mm')) { un = 'mm'; s = s.slice(0, -2); }
  else if (s.endsWith('m')) { un = 'm'; s = s.slice(0, -1); }
  s = s.replace(',', '.');
  const v = parseFloat(s);
  if (!isFinite(v) || v <= 0) return NaN;
  if (un === 'm' && !/[a-z]/.test(String(txt).toLowerCase()) && v > 50) un = 'cm'; // "350" digitado em metros = 350 cm
  return un === 'cm' ? v / 100 : un === 'mm' ? v / 1000 : v;
}

// ---------- armazenamento ----------
let banco = carregar();
function carregar() { try { return JSON.parse(localStorage.getItem(CHAVE)) || { projetos: [], unidade: 'm' }; } catch { return { projetos: [], unidade: 'm' }; } }
function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(banco)); } catch (e) { aviso('Não consegui salvar no aparelho: ' + e.message); } }

// ---------- tela de projetos ----------
function mostrarTela(id) { document.querySelectorAll('.tela').forEach(t => t.classList.toggle('ativa', t.id === id)); }

function renderLista() {
  const el = $('#listaProjetos');
  const lista = [...banco.projetos].sort((a, b) => b.atualizado - a.atualizado);
  if (!lista.length) { el.innerHTML = '<div class="vazio">Nenhum projeto ainda. Crie o primeiro e desenhe a planta.</div>'; return; }
  el.innerHTML = lista.map(p => {
    const at = p.comodos.reduce((s, c) => s + area(c.pts), 0);
    const data = new Date(p.atualizado).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `<div class="cartao" data-id="${p.id}">
      <h3 data-acao="abrir">${esc(p.nome)}</h3>
      <div class="info">${p.comodos.length} cômodo(s) · ${fmt(at)} m² · editado ${data}</div>
      <div class="acoes">
        <button class="btn primario" data-acao="abrir">Abrir</button>
        <button class="btn" data-acao="renomear">Renomear</button>
        <button class="btn" data-acao="duplicar">Duplicar</button>
        <button class="btn perigo" data-acao="excluir">Excluir</button>
      </div></div>`;
  }).join('');
}
$('#listaProjetos').addEventListener('click', e => {
  const b = e.target.closest('[data-acao]'); if (!b) return;
  const id = b.closest('.cartao').dataset.id, p = banco.projetos.find(x => x.id === id);
  const acao = b.dataset.acao;
  if (acao === 'abrir') abrirProjeto(id);
  else if (acao === 'renomear') pedirTexto('Renomear projeto', p.nome, n => { p.nome = n; p.atualizado = Date.now(); salvar(); renderLista(); });
  else if (acao === 'duplicar') { const c = clone(p); c.id = uid(); c.nome = p.nome + ' (cópia)'; c.criado = c.atualizado = Date.now(); banco.projetos.push(c); salvar(); renderLista(); }
  else if (acao === 'excluir') confirmar(`Excluir "${p.nome}"? Não dá pra desfazer.`, () => { banco.projetos = banco.projetos.filter(x => x.id !== id); salvar(); renderLista(); });
});
$('#btnNovoProjeto').onclick = () => {
  pedirTexto('Nome do projeto', 'Casa ' + (banco.projetos.length + 1), nome => {
    const p = { id: uid(), nome, criado: Date.now(), atualizado: Date.now(), comodos: [] };
    banco.projetos.push(p); salvar(); abrirProjeto(p.id);
  });
};

// ---------- modal ----------
function abrirModal(html) { $('#modalConteudo').innerHTML = html; $('#modal').classList.remove('escondido'); }
function fecharModal() { $('#modal').classList.add('escondido'); $('#modalConteudo').innerHTML = ''; }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !$('#modal').dataset.obrigatorio) fecharModal(); });
function pedirTexto(titulo, valor, ok) {
  abrirModal(`<h2>${esc(titulo)}</h2><div class="campo"><input id="mTxt" type="text" value="${esc(valor)}" maxlength="80"></div>
    <div class="botoes"><button class="btn" id="mCanc">Cancelar</button><button class="btn primario" id="mOk">Salvar</button></div>`);
  const i = $('#mTxt'); i.focus(); i.select();
  const fim = () => { const v = i.value.trim(); if (!v) return; fecharModal(); ok(v); };
  $('#mOk').onclick = fim; $('#mCanc').onclick = fecharModal; i.onkeydown = e => { if (e.key === 'Enter') fim(); };
}
// avisos e confirmações próprios (alguns apps abrem o site num navegador interno que ignora alert/confirm)
function aviso(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('vis'); clearTimeout(aviso.tm); aviso.tm = setTimeout(() => t.classList.remove('vis'), 3200);
}
function confirmar(msg, ok, rotulo = 'Excluir') {
  abrirModal(`<h2>${esc(msg)}</h2><div class="botoes"><button class="btn" id="mCanc">Cancelar</button><button class="btn primario perigoso" id="mOk">${esc(rotulo)}</button></div>`);
  $('#mCanc').onclick = fecharModal; $('#mOk').onclick = () => { fecharModal(); ok(); };
}
const opcoesTipo = sel => TIPOS.map(([k, n]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${n}</option>`).join('');

// ---------- estado do editor ----------
let proj = null;                 // projeto aberto
let vista = { esc: 60, ox: 0, oy: 0 }; // px por metro e deslocamento
let modo = 'selecionar';
let sel = { comodo: null, parede: null };
let rascunho = [];               // pontos do desenho em andamento
let cursor = null;               // posição prevista (mouse)
let pilhaDesfazer = [], pilhaRefazer = [];

function abrirProjeto(id) {
  proj = banco.projetos.find(p => p.id === id);
  pilhaDesfazer = []; pilhaRefazer = []; rascunho = []; sel = { comodo: null, parede: null };
  $('#nomeProjeto').textContent = proj.nome;
  mostrarTela('telaEditor');
  definirModo(proj.comodos.length ? 'selecionar' : 'desenhar');
  requestAnimationFrame(() => { enquadrar(); render(); });
}
$('#btnVoltar').onclick = () => { const sair = () => { rascunho = []; proj = null; mostrarTela('telaProjetos'); renderLista(); }; rascunho.length ? confirmar('Descartar o cômodo que está sendo desenhado?', sair, 'Descartar') : sair(); };
$('#nomeProjeto').onclick = () => pedirTexto('Renomear projeto', proj.nome, n => { proj.nome = n; gravar(); $('#nomeProjeto').textContent = n; });

function gravar() { proj.atualizado = Date.now(); salvar(); }
function checkpoint() { pilhaDesfazer.push(clone(proj.comodos)); if (pilhaDesfazer.length > 80) pilhaDesfazer.shift(); pilhaRefazer = []; atualizarBotoes(); }
function desfazer() {
  if (modo === 'desenhar' && rascunho.length) { rascunho.pop(); render(); return; }
  if (!pilhaDesfazer.length) return;
  pilhaRefazer.push(clone(proj.comodos)); proj.comodos = pilhaDesfazer.pop();
  sel = { comodo: null, parede: null }; gravar(); render();
}
function refazer() {
  if (!pilhaRefazer.length) return;
  pilhaDesfazer.push(clone(proj.comodos)); proj.comodos = pilhaRefazer.pop();
  sel = { comodo: null, parede: null }; gravar(); render();
}
function atualizarBotoes() { $('#btnDesfazer').disabled = !(pilhaDesfazer.length || rascunho.length); $('#btnRefazer').disabled = !pilhaRefazer.length; }
$('#btnDesfazer').onclick = desfazer; $('#btnRefazer').onclick = refazer;
document.addEventListener('keydown', e => {
  if (!proj || e.target.tagName === 'INPUT') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? refazer() : desfazer(); }
  if (e.key === 'Escape') { rascunho = []; sel = { comodo: null, parede: null }; render(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel.comodo && sel.parede == null) excluirComodo();
});

const comodo = id => proj.comodos.find(c => c.id === id);

// ---------- vista ----------
const svg = $('#svg');
const tela = w => [w[0] * vista.esc + vista.ox, w[1] * vista.esc + vista.oy];
const mundo = s => [(s[0] - vista.ox) / vista.esc, (s[1] - vista.oy) / vista.esc];
function enquadrar() {
  const r = svg.getBoundingClientRect();
  const pts = proj.comodos.flatMap(c => c.pts).concat(rascunho);
  if (!pts.length) { vista.esc = Math.min(r.width, r.height) / 8; vista.ox = r.width / 2; vista.oy = r.height / 2; return; }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const w = Math.max(maxx - minx, 1), h = Math.max(maxy - miny, 1);
  vista.esc = Math.min((r.width - 90) / w, (r.height - 110) / h, 300);
  vista.ox = r.width / 2 - (minx + w / 2) * vista.esc;
  vista.oy = r.height / 2 - (miny + h / 2) * vista.esc;
}
$('#btnCentralizar').onclick = () => { enquadrar(); render(); };
window.addEventListener('resize', () => proj && render());
function zoomEm(sx, sy, fator) {
  const novo = Math.max(8, Math.min(1500, vista.esc * fator)); fator = novo / vista.esc;
  vista.ox = sx - (sx - vista.ox) * fator; vista.oy = sy - (sy - vista.oy) * fator; vista.esc = novo;
}

// ---------- ímãs ----------
function todosVertices(excetoId) { const v = []; proj.comodos.forEach(c => { if (c.id !== excetoId) c.pts.forEach(p => v.push(p)); }); return v; }
function paredesTodas(excetoId) { const r = []; proj.comodos.forEach(c => { if (c.id !== excetoId) c.pts.forEach((a, i) => r.push([a, c.pts[(i + 1) % c.pts.length]])); }); return r; }
function imantar(w, ref, excetoId, mult = 1) {
  const tol = TOL_PX * mult / vista.esc;
  const cand = todosVertices(excetoId).concat(rascunho.length >= 3 ? [rascunho[0]] : []);
  let melhor = null, md = tol;
  cand.forEach(p => { const d = dist(p, w); if (d < md) { md = d; melhor = p; } });
  if (melhor) return [melhor[0], melhor[1]];
  let x = w[0], y = w[1];
  if (ref) { // ortogonal: trava no eixo quando quase reto
    const dx = x - ref[0], dy = y - ref[1], ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);
    if (ang < 9 || ang > 171) y = ref[1];
    else if (Math.abs(ang - 90) < 9) x = ref[0];
  }
  // encosta numa parede existente (pra começar ou terminar um cômodo colado no outro)
  const fixY = ref && y === ref[1], fixX = ref && x === ref[0];
  for (const [a, b] of paredesTodas(excetoId)) {
    if (distSeg([x, y], a, b) > tol) continue;
    const vert = Math.abs(a[0] - b[0]) < 1e-6, horiz = Math.abs(a[1] - b[1]) < 1e-6;
    if (fixY && vert) return [a[0], y];
    if (fixX && horiz) return [x, a[1]];
    if (!ref) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      let t = ((x - a[0]) * dx + (y - a[1]) * dy) / L2; t = Math.max(0, Math.min(1, t));
      const L = Math.sqrt(L2); t = Math.round(t * L / GRADE) * GRADE / L;
      return [+(a[0] + t * dx).toFixed(4), +(a[1] + t * dy).toFixed(4)];
    }
  }
  const g = v => Math.round(v / GRADE) * GRADE;
  if (ref && y === ref[1]) return [ref[0] + g(x - ref[0]), y];
  if (ref && x === ref[0]) return [x, ref[1] + g(y - ref[1])];
  return [g(x), g(y)];
}

// ---------- portas ----------
// porta = { id, parede, pos (m do canto inicial até o centro), largura, fora (abre pra fora), inverter (dobradiça do outro lado) }
function geoPorta(c, pt) {
  const n = c.pts.length, a = c.pts[pt.parede % n], b = c.pts[(pt.parede + 1) % n], L = dist(a, b);
  if (L < 1e-6) return null;
  const w = Math.min(pt.largura, L), pos = Math.max(w / 2, Math.min(L - w / 2, pt.pos));
  const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  let nrm = [-d[1], d[0]];
  const ct = centroide(c.pts), mid = [a[0] + d[0] * pos, a[1] + d[1] * pos];
  if ((ct[0] - mid[0]) * nrm[0] + (ct[1] - mid[1]) * nrm[1] < 0) nrm = [-nrm[0], -nrm[1]];
  if (pt.fora) nrm = [-nrm[0], -nrm[1]];
  const p0 = [a[0] + d[0] * (pos - w / 2), a[1] + d[1] * (pos - w / 2)], p1 = [a[0] + d[0] * (pos + w / 2), a[1] + d[1] * (pos + w / 2)];
  const h = pt.inverter ? p1 : p0, u = pt.inverter ? [-d[0], -d[1]] : d;
  return { p0, p1, h, u, nrm, w };
}
function svgPorta(c, pt, destaque) {
  const g = geoPorta(c, pt); if (!g) return '';
  const A = tela(g.p0), B = tela(g.p1), H = tela(g.h);
  const folha = tela([g.h[0] + g.nrm[0] * g.w, g.h[1] + g.nrm[1] * g.w]);
  let arco = [];
  for (let k = 0; k <= 16; k++) { const t = k / 16 * Math.PI / 2, q = [g.h[0] + g.w * (Math.cos(t) * g.nrm[0] + Math.sin(t) * g.u[0]), g.h[1] + g.w * (Math.cos(t) * g.nrm[1] + Math.sin(t) * g.u[1])]; arco.push(tela(q).map(v => v.toFixed(1)).join(',')); }
  const cor = destaque ? '#ffc531' : '#e8eef7';
  return `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#0d1626" stroke-width="7"/>
    <line x1="${H[0]}" y1="${H[1]}" x2="${folha[0]}" y2="${folha[1]}" stroke="${cor}" stroke-width="2.5"/>
    <polyline points="${arco.join(' ')}" fill="none" stroke="${cor}" stroke-width="1.3" stroke-dasharray="4 3"/>`;
}

// ---------- desenho ----------
function render() {
  if (!proj) return;
  const r = svg.getBoundingClientRect(), W = r.width, H = r.height;
  let h = '';
  // grade
  let passo = 0.5; while (passo * vista.esc < 14) passo *= 2; if (passo * vista.esc > 120) passo = 0.25;
  const [x0, y0] = mundo([0, 0]), [x1, y1] = mundo([W, H]);
  for (let x = Math.floor(x0 / passo) * passo; x <= x1; x += passo) {
    const sx = tela([x, 0])[0], forte = Math.abs(x - Math.round(x)) < 1e-6 && passo <= 1;
    h += `<line x1="${sx}" y1="0" x2="${sx}" y2="${H}" stroke="${forte ? '#1f3150' : '#16243b'}" stroke-width="1"/>`;
  }
  for (let y = Math.floor(y0 / passo) * passo; y <= y1; y += passo) {
    const sy = tela([0, y])[1], forte = Math.abs(y - Math.round(y)) < 1e-6 && passo <= 1;
    h += `<line x1="0" y1="${sy}" x2="${W}" y2="${sy}" stroke="${forte ? '#1f3150' : '#16243b'}" stroke-width="1"/>`;
  }
  // cômodos
  proj.comodos.forEach(c => {
    const cor = CORES[c.tipo] || '#b0bccd', s = c.id === sel.comodo;
    const d = c.pts.map(p => tela(p).map(v => v.toFixed(1)).join(',')).join(' ');
    h += `<polygon points="${d}" fill="${cor}" fill-opacity="${s ? .22 : .12}" stroke="#e8eef7" stroke-width="${s ? 4 : 3}" stroke-linejoin="round"/>`;
  });
  { const c = sel.comodo && comodo(sel.comodo); if (c && sel.parede != null) { const A = tela(c.pts[sel.parede]), B = tela(c.pts[(sel.parede + 1) % c.pts.length]); h += `<line x1="${A[0]}" y1="${A[1]}" x2="${B[0]}" y2="${B[1]}" stroke="#ffc531" stroke-width="6" stroke-linecap="round"/>`; } }
  proj.comodos.forEach(c => (c.portas || []).forEach(pt => h += svgPorta(c, pt, c.id === sel.comodo && sel.parede === pt.parede)));
  proj.comodos.forEach(c => {
    const s = c.id === sel.comodo;
    // cotas das paredes
    c.pts.forEach((a, i) => {
      const b = c.pts[(i + 1) % c.pts.length], L = dist(a, b);
      const A = tela(a), B = tela(b), mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      if (Math.hypot(B[0] - A[0], B[1] - A[1]) < 52) return;
      const ps = s && sel.parede === i;
      let ang = Math.atan2(B[1] - A[1], B[0] - A[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      h += `<g transform="translate(${mx},${my}) rotate(${ang})"><rect x="-30" y="-11" width="60" height="21" rx="6" fill="#0d1626" fill-opacity=".9"/>
        <text y="4.5" text-anchor="middle" font-size="14" font-weight="700" fill="${ps ? '#ffc531' : '#cfe0f5'}">${fmt(L)}</text></g>`;
    });
    // nome + área
    const ct = tela(centroide(c.pts));
    h += `<text x="${ct[0]}" y="${ct[1] - 4}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${esc(c.nome)}</text>
      <text x="${ct[0]}" y="${ct[1] + 13}" text-anchor="middle" font-size="12" fill="#ffc531">${fmt(area(c.pts))} m²</text>`;
    if (s && modo === 'selecionar') c.pts.forEach(p => { const P = tela(p); h += `<circle cx="${P[0]}" cy="${P[1]}" r="7" fill="#3b9cff" stroke="#fff" stroke-width="2"/>`; });
  });
  if (modo === 'desenhar') proj.comodos.forEach(c => c.pts.forEach(p => { const P = tela(p); h += `<circle cx="${P[0]}" cy="${P[1]}" r="7" fill="#3b9cff" stroke="#fff" stroke-width="2"/>`; }));
  // rascunho
  if (rascunho.length) {
    const pts = rascunho.map(tela);
    const prev = cursor && modo === 'desenhar' ? tela(cursor) : null;
    h += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#ffc531" stroke-width="3"/>`;
    if (prev) {
      const ult = pts[pts.length - 1];
      h += `<line x1="${ult[0]}" y1="${ult[1]}" x2="${prev[0]}" y2="${prev[1]}" stroke="#ffc531" stroke-width="2" stroke-dasharray="6 5"/>`;
      h += `<text x="${prev[0] + 10}" y="${prev[1] - 10}" font-size="14" font-weight="700" fill="#ffc531">${fmt(dist(rascunho[rascunho.length - 1], cursor))}</text>`;
    }
    rascunho.forEach((p, i) => {
      if (i) { const a = tela(rascunho[i - 1]), b = tela(p); h += `<text x="${(a[0] + b[0]) / 2}" y="${(a[1] + b[1]) / 2 - 8}" text-anchor="middle" font-size="14" font-weight="700" fill="#ffc531">${fmt(dist(rascunho[i - 1], p))}</text>`; }
    });
    pts.forEach((p, i) => h += `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 && rascunho.length >= 3 ? 10 : 6}" fill="${i === 0 ? '#3ddc97' : '#ffc531'}" stroke="#0d1626" stroke-width="2"/>`);
  }
  svg.innerHTML = h;
  atualizarBotoes();
  renderPainel();
  renderDica();
}

function renderDica() {
  let t = '';
  if (modo === 'desenhar') {
    if (!rascunho.length) t = proj.comodos.length ? 'Comece numa bolinha azul (ou numa parede) e arraste pra criar o próximo cômodo' : 'Arraste o dedo pra desenhar a primeira parede';
    else if (rascunho.length < 3) t = 'Arraste de novo pra próxima parede (ou digite a medida e use as setas)';
    else t = 'Continue, ou arraste até o ponto verde pra fechar';
  } else if (!proj.comodos.length) t = 'Toque em Desenhar ou Retângulo para começar';
  else if (!sel.comodo) t = 'Toque num cômodo ou numa parede';
  else if (sel.parede == null) t = 'Arraste cantos ou portas, ou toque numa parede pra medida e porta';
  $('#dica').textContent = t;
}

// ---------- painel inferior ----------
function renderPainel() {
  const p = $('#painel');
  if (modo === 'desenhar') {
    p.classList.add('aberto');
    if (p.dataset.tipo === 'desenho') { // não recria (mantém o teclado aberto)
      p.querySelector('#btnFechar').disabled = rascunho.length < 3; return;
    }
    p.dataset.tipo = 'desenho';
    p.innerHTML = `<div class="linha">
        <label>Medida</label><input id="inMedida" class="num" type="text" inputmode="decimal" placeholder="${banco.unidade === 'cm' ? '350' : '3,50'}">
        <select id="selUn"><option value="m" ${banco.unidade === 'm' ? 'selected' : ''}>m</option><option value="cm" ${banco.unidade === 'cm' ? 'selected' : ''}>cm</option></select>
        <div class="setas"><span></span><button data-d="0,-1">↑</button><span></span><button data-d="-1,0">←</button><button data-d="0,1">↓</button><button data-d="1,0">→</button></div>
      </div>
      <div class="linha"><button class="btn" id="btnCancDes">Cancelar</button><button class="btn primario" id="btnFechar">Fechar cômodo</button></div>`;
    p.querySelector('#selUn').onchange = e => { banco.unidade = e.target.value; salvar(); p.querySelector('#inMedida').placeholder = banco.unidade === 'cm' ? '350' : '3,50'; };
    p.querySelectorAll('.setas button').forEach(b => b.onclick = () => {
      const L = lerMedida(p.querySelector('#inMedida').value, banco.unidade);
      if (!rascunho.length) { aviso('Primeiro toque no desenho pra marcar o canto inicial.'); return; }
      if (!isFinite(L)) { aviso('Digite a medida da parede (ex.: 3,50 m ou 350 cm).'); return; }
      const [dx, dy] = b.dataset.d.split(',').map(Number), u = rascunho[rascunho.length - 1];
      const novo = [+(u[0] + dx * L).toFixed(4), +(u[1] + dy * L).toFixed(4)];
      if (rascunho.length >= 3 && dist(novo, rascunho[0]) < 0.005) { fecharRascunho(); return; }
      rascunho.push(novo); p.querySelector('#inMedida').value = ''; garantirVisivel(novo); render();
    });
    p.querySelector('#btnCancDes').onclick = () => { rascunho = []; definirModo('selecionar'); };
    p.querySelector('#btnFechar').onclick = fecharRascunho;
    p.querySelector('#btnFechar').disabled = rascunho.length < 3;
    return;
  }
  p.dataset.tipo = '';
  const c = sel.comodo && comodo(sel.comodo);
  if (!c) { p.classList.remove('aberto'); p.innerHTML = ''; return; }
  p.classList.add('aberto');
  if (sel.parede != null) {
    const i = sel.parede, a = c.pts[i], b = c.pts[(i + 1) % c.pts.length], L = dist(a, b);
    const val = banco.unidade === 'cm' ? fmt(L * 100, 1) : fmt(L);
    p.innerHTML = `<div class="linha medidas">${esc(c.nome)} · parede ${i + 1}: <b>${fmt(L)} m</b></div>
      <div class="linha"><label>Nova medida</label><input id="inParede" class="num" type="text" inputmode="decimal" value="${val}">
        <select id="selUn2"><option value="m" ${banco.unidade === 'm' ? 'selected' : ''}>m</option><option value="cm" ${banco.unidade === 'cm' ? 'selected' : ''}>cm</option></select>
        <button class="btn primario" id="btnAplicar">Aplicar</button><button class="btn" id="btnVoltarComodo">Cômodo</button></div>
      ${(c.portas || []).map((pt, k) => pt.parede === i ? `<div class="linha porta-linha" data-k="${k}">🚪 Porta ${fmt(pt.largura)} m · a <input class="num pPos" type="text" inputmode="decimal" value="${fmt(Math.max(0, pt.pos - pt.largura / 2))}"> m do canto
        <button class="btn pGirar">↻ Girar</button><button class="btn pFora">${pt.fora ? 'Pra fora' : 'Pra dentro'}</button><button class="btn pInv">⇆ Lado</button><button class="btn perigo pExc">✕</button></div>` : '').join('')}
      <div class="linha"><label>Porta</label><select id="selLargPorta">${[0.6, 0.7, 0.8, 0.9, 1.0, 1.2].map(v => `<option value="${v}" ${v === 0.8 ? 'selected' : ''}>${fmt(v)} m</option>`).join('')}</select>
        <button class="btn" id="btnAddPorta">+ Adicionar porta</button></div>`;
    p.querySelector('#btnAddPorta').onclick = () => {
      const w = parseFloat(p.querySelector('#selLargPorta').value);
      if (w > L + 1e-6) { aviso('A porta é maior que a parede.'); return; }
      checkpoint(); c.portas = c.portas || []; c.portas.push({ id: uid(), parede: i, pos: L / 2, largura: w, fora: false, inverter: false }); gravar(); render();
    };
    p.querySelectorAll('.porta-linha').forEach(row => {
      const pt = c.portas[+row.dataset.k];
      row.querySelector('.pGirar').onclick = () => { // 4 posições: dentro-esq, dentro-dir, fora-dir, fora-esq
        checkpoint(); const k = (pt.fora ? 2 : 0) + ((pt.fora ? !pt.inverter : pt.inverter) ? 1 : 0), n = (k + 1) % 4;
        pt.fora = n >= 2; pt.inverter = pt.fora ? n === 2 : n === 1; gravar(); render();
      };
      row.querySelector('.pFora').onclick = () => { checkpoint(); pt.fora = !pt.fora; gravar(); render(); };
      row.querySelector('.pInv').onclick = () => { checkpoint(); pt.inverter = !pt.inverter; gravar(); render(); };
      row.querySelector('.pExc').onclick = () => { checkpoint(); c.portas.splice(+row.dataset.k, 1); gravar(); render(); };
      row.querySelector('.pPos').onchange = e => {
        const v = parseFloat(String(e.target.value).replace(',', '.'));
        if (!isFinite(v) || v < 0) { render(); return; }
        checkpoint(); pt.pos = Math.min(L - pt.largura / 2, v + pt.largura / 2); gravar(); render();
      };
    });
    p.querySelector('#selUn2').onchange = e => { banco.unidade = e.target.value; salvar(); render(); };
    const aplicar = () => {
      const N = lerMedida(p.querySelector('#inParede').value, banco.unidade);
      if (!isFinite(N)) { aviso('Medida inválida. Ex.: 3,50 (m) ou 350 (cm).'); return; }
      checkpoint(); esticarParede(c, i, N); gravar(); render();
    };
    p.querySelector('#btnAplicar').onclick = aplicar;
    p.querySelector('#inParede').onkeydown = e => { if (e.key === 'Enter') aplicar(); };
    p.querySelector('#btnVoltarComodo').onclick = () => { sel.parede = null; render(); };
    return;
  }
  p.innerHTML = `<div class="linha"><input id="inNome" type="text" value="${esc(c.nome)}" maxlength="40"><select id="selTipo">${opcoesTipo(c.tipo)}</select></div>
    <div class="linha medidas">Área <b>${fmt(area(c.pts))} m²</b> · Perímetro <b>${fmt(perimetro(c.pts))} m</b> · ${c.pts.length} paredes</div>
    <div class="linha"><button class="btn" id="btnDup">Duplicar</button><button class="btn perigo" id="btnExc">Excluir</button></div>`;
  p.querySelector('#inNome').onchange = e => { const v = e.target.value.trim(); if (!v) return; checkpoint(); c.nome = v; gravar(); render(); };
  p.querySelector('#selTipo').onchange = e => {
    checkpoint(); const velho = nomeTipo(c.tipo); c.tipo = e.target.value;
    if (c.nome.startsWith(velho)) c.nome = nomeAuto(c.tipo, c.id);
    gravar(); render();
  };
  p.querySelector('#btnExc').onclick = excluirComodo;
  p.querySelector('#btnDup').onclick = () => {
    checkpoint(); const n = clone(c); n.id = uid(); n.nome = nomeAuto(n.tipo);
    const larg = Math.max(...c.pts.map(q => q[0])) - Math.min(...c.pts.map(q => q[0]));
    n.pts = n.pts.map(q => [q[0] + larg, q[1]]); proj.comodos.push(n); sel = { comodo: n.id, parede: null }; gravar(); render();
  };
}
function excluirComodo() {
  const c = comodo(sel.comodo); if (!c) return;
  confirmar(`Excluir ${c.nome}?`, () => { checkpoint(); proj.comodos = proj.comodos.filter(x => x.id !== c.id); sel = { comodo: null, parede: null }; gravar(); render(); });
}
function nomeAuto(tipo, exceto) {
  const base = nomeTipo(tipo), n = proj.comodos.filter(c => c.tipo === tipo && c.id !== exceto).length;
  return n ? `${base} ${n + 1}` : base;
}

// Muda o comprimento da parede i "esticando" o cômodo: tudo que está além do fim da parede anda junto.
function esticarParede(c, i, novoL) {
  const a = c.pts[i], b = c.pts[(i + 1) % c.pts.length], L = dist(a, b); if (L < 1e-9) return;
  const d = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], delta = novoL - L, lim = b[0] * d[0] + b[1] * d[1] - 1e-6;
  c.pts = c.pts.map(p => (p[0] * d[0] + p[1] * d[1] >= lim) ? [+(p[0] + d[0] * delta).toFixed(4), +(p[1] + d[1] * delta).toFixed(4)] : p);
}

// ---------- fechar cômodo: tipo obrigatório ----------
function fecharRascunho() {
  if (rascunho.length < 3) return;
  const pts = rascunho.slice();
  if (area(pts) < 0.05) { aviso('Esse cômodo ficou sem área. Confira os cantos.'); return; }
  pedirTipo(pts);
}
function pedirTipo(pts) {
  $('#modal').dataset.obrigatorio = '1';
  abrirModal(`<h2>Que cômodo é esse?</h2>
    <p class="aviso" style="margin:0 0 12px">O tipo define as regras da NBR 5410 (iluminação e tomadas) que o EletroMaster vai aplicar.</p>
    <div class="campo"><label>Tipo</label><select id="mTipo"><option value="">Escolha…</option>${opcoesTipo('')}</select></div>
    <div class="campo"><label>Nome (opcional)</label><input id="mNome" type="text" maxlength="40" placeholder="Ex.: Quarto do casal"></div>
    <div class="medidas" style="margin-bottom:12px">Área <b>${fmt(area(pts))} m²</b> · Perímetro <b>${fmt(perimetro(pts))} m</b></div>
    <div class="botoes"><button class="btn" id="mCanc">Voltar ao desenho</button><button class="btn primario" id="mOk">Salvar cômodo</button></div>`);
  $('#mCanc').onclick = () => { delete $('#modal').dataset.obrigatorio; fecharModal(); };
  $('#mOk').onclick = () => {
    const tipo = $('#mTipo').value;
    if (!tipo) { $('#mTipo').focus(); $('#mTipo').style.borderColor = '#ff5d5d'; return; }
    const nome = $('#mNome').value.trim() || nomeAuto(tipo);
    delete $('#modal').dataset.obrigatorio; fecharModal();
    checkpoint();
    const c = { id: uid(), nome, tipo, pts };
    proj.comodos.push(c); rascunho = []; gravar();
    sel = { comodo: c.id, parede: null }; definirModo('selecionar');
  };
}

// ---------- retângulo rápido ----------
$('#btnRetangulo').onclick = () => {
  const u = banco.unidade;
  abrirModal(`<h2>Cômodo retangular</h2>
    <div class="dupla"><div class="campo"><label>Largura (${u})</label><input id="mL" type="text" inputmode="decimal" placeholder="${u === 'cm' ? '300' : '3,00'}"></div>
    <div class="campo"><label>Comprimento (${u})</label><input id="mC" type="text" inputmode="decimal" placeholder="${u === 'cm' ? '400' : '4,00'}"></div></div>
    <div class="campo"><label>Tipo</label><select id="mTipo"><option value="">Escolha…</option>${opcoesTipo('')}</select></div>
    <div class="campo"><label>Nome (opcional)</label><input id="mNome" type="text" maxlength="40"></div>
    <div class="botoes"><button class="btn" id="mCanc">Cancelar</button><button class="btn primario" id="mOk">Criar</button></div>`);
  $('#mL').focus();
  $('#mCanc').onclick = fecharModal;
  $('#mOk').onclick = () => {
    const L = lerMedida($('#mL').value, u), C = lerMedida($('#mC').value, u), tipo = $('#mTipo').value;
    if (!isFinite(L) || !isFinite(C)) { aviso('Preencha largura e comprimento.'); return; }
    if (!tipo) { $('#mTipo').style.borderColor = '#ff5d5d'; $('#mTipo').focus(); return; }
    let x = 0, y = 0;
    const tod = todosVertices();
    if (tod.length) { x = Math.max(...tod.map(p => p[0])); y = Math.min(...tod.map(p => p[1])); }
    const c = { id: uid(), tipo, nome: $('#mNome').value.trim() || nomeAuto(tipo), pts: [[x, y], [x + L, y], [x + L, y + C], [x, y + C]].map(p => p.map(v => +v.toFixed(4))) };
    fecharModal(); checkpoint(); proj.comodos.push(c); gravar();
    sel = { comodo: c.id, parede: null }; definirModo('selecionar'); enquadrar(); render();
  };
};

// ---------- lista de cômodos ----------
$('#btnComodos').onclick = () => {
  if (!proj.comodos.length) { abrirModal('<h2>Cômodos</h2><div class="vazio">Nenhum cômodo desenhado ainda.</div><div class="botoes"><button class="btn" id="mCanc">Fechar</button></div>'); $('#mCanc').onclick = fecharModal; return; }
  let ta = 0, tp = 0;
  const linhas = proj.comodos.map(c => { const a = area(c.pts), p = perimetro(c.pts); ta += a; tp += p; return `<tr class="clicavel" data-id="${c.id}"><td>${esc(c.nome)}</td><td>${nomeTipo(c.tipo)}</td><td class="n">${fmt(a)}</td><td class="n">${fmt(p)}</td></tr>`; }).join('');
  abrirModal(`<h2>Cômodos de ${esc(proj.nome)}</h2>
    <table><tr><th>Nome</th><th>Tipo</th><th class="n">Área (m²)</th><th class="n">Perím. (m)</th></tr>${linhas}
    <tr class="total"><td>Total</td><td>${proj.comodos.length} cômodo(s)</td><td class="n">${fmt(ta)}</td><td class="n">—</td></tr></table>
    <div class="botoes"><button class="btn" id="mCanc">Fechar</button></div>`);
  $('#mCanc').onclick = fecharModal;
  $('#modalConteudo').querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => { fecharModal(); definirModo('selecionar'); sel = { comodo: tr.dataset.id, parede: null }; render(); });
};

// ---------- modos ----------
function definirModo(m) {
  modo = m; if (m === 'desenhar') sel = { comodo: null, parede: null };
  document.querySelectorAll('.barra .modo').forEach(b => b.classList.toggle('ativo', b.dataset.modo === m));
  $('#painel').dataset.tipo = '';
  render();
}
document.querySelectorAll('.barra .modo').forEach(b => b.onclick = () => {
  const ir = () => { if (b.dataset.modo !== 'desenhar') rascunho = []; definirModo(b.dataset.modo); };
  if (modo === 'desenhar' && b.dataset.modo !== 'desenhar' && rascunho.length) confirmar('Descartar o cômodo em desenho?', ir, 'Descartar'); else ir();
});
function garantirVisivel(w) {
  const r = svg.getBoundingClientRect(), s = tela(w);
  if (s[0] < 30 || s[1] < 30 || s[0] > r.width - 30 || s[1] > r.height - 30) { enquadrar(); }
}

// ---------- toque / mouse ----------
const ponteiros = new Map();
let gesto = null;
const pos = e => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

svg.addEventListener('pointerdown', e => {
  svg.setPointerCapture(e.pointerId);
  ponteiros.set(e.pointerId, pos(e));
  if (ponteiros.size === 2) {
    const [a, b] = [...ponteiros.values()];
    gesto = { tipo: 'pinca', d0: dist(a, b), esc0: vista.esc, m0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ox0: vista.ox, oy0: vista.oy };
    return;
  }
  if (ponteiros.size > 2) return;
  const s = pos(e), w = mundo(s);
  gesto = { tipo: 'pan', ini: s, ox0: vista.ox, oy0: vista.oy, moveu: false };
  if (modo === 'desenhar') {
    // arrastar o dedo desenha a parede: começa no último canto (ou onde tocou, se for a primeira)
    const inicio = rascunho.length ? rascunho[rascunho.length - 1] : imantar(w, null, undefined, 2);
    gesto = { tipo: 'traco', ini: s, inicio, novoInicio: !rascunho.length, moveu: false };
    return;
  }
  if (modo === 'selecionar') {
    const pe = portaEm(s);
    if (pe && !(sel.comodo && comodo(sel.comodo).pts.some(p => dist(tela(p), s) < TOL_PX + 4))) { gesto = { tipo: 'porta', ini: s, c: pe.c, pt: pe.pt, moveu: false }; return; }
  }
  if (modo === 'selecionar' && sel.comodo) {
    const c = comodo(sel.comodo);
    const vi = c.pts.findIndex(p => dist(tela(p), s) < TOL_PX + 4);
    if (vi >= 0) gesto = { tipo: 'vertice', ini: s, c, vi, orig: c.pts[vi].slice(), moveu: false };
    else if (dentro(w, c.pts) && !paredeEm(s)) gesto = { tipo: 'mover', ini: s, c, w0: w, orig: clone(c.pts), moveu: false };
  }
});

svg.addEventListener('pointermove', e => {
  const s = pos(e);
  if (ponteiros.has(e.pointerId)) ponteiros.set(e.pointerId, s);
  if (gesto && gesto.tipo === 'pinca' && ponteiros.size === 2) {
    const [a, b] = [...ponteiros.values()], d = dist(a, b), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    vista.esc = gesto.esc0; vista.ox = gesto.ox0 + (m[0] - gesto.m0[0]); vista.oy = gesto.oy0 + (m[1] - gesto.m0[1]);
    zoomEm(m[0], m[1], d / gesto.d0); render(); return;
  }
  if (!gesto) { // mouse passando: prévia no modo desenho
    if (modo === 'desenhar' && rascunho.length && e.pointerType === 'mouse') { cursor = imantar(mundo(s), rascunho[rascunho.length - 1]); render(); }
    return;
  }
  if (!gesto.moveu && dist(s, gesto.ini) < 7) return;
  if (!gesto.moveu) { gesto.moveu = true; if (gesto.tipo === 'vertice' || gesto.tipo === 'mover' || gesto.tipo === 'porta') checkpoint(); }
  if (gesto.tipo === 'traco') {
    if (gesto.novoInicio) { rascunho.push(gesto.inicio); gesto.novoInicio = false; }
    cursor = imantar(mundo(s), rascunho[rascunho.length - 1]); render(); return;
  }
  if (gesto.tipo === 'porta') {
    // arrasta a porta pra qualquer parede do cômodo, deslizando ao longo dela
    const c = gesto.c, pt = gesto.pt, w = mundo(s); let melhor = null, md = Infinity;
    c.pts.forEach((a, i) => {
      const b = c.pts[(i + 1) % c.pts.length], L = dist(a, b); if (L < pt.largura) return;
      const d = distSeg(w, a, b); if (d < md) { md = d; const t = ((w[0] - a[0]) * (b[0] - a[0]) + (w[1] - a[1]) * (b[1] - a[1])) / L; melhor = { i, pos: Math.max(pt.largura / 2, Math.min(L - pt.largura / 2, Math.round(t / GRADE) * GRADE)) }; }
    });
    if (melhor) { pt.parede = melhor.i; pt.pos = melhor.pos; sel = { comodo: c.id, parede: melhor.i }; }
    render(); return;
  }
  if (gesto.tipo === 'pan') { vista.ox = gesto.ox0 + s[0] - gesto.ini[0]; vista.oy = gesto.oy0 + s[1] - gesto.ini[1]; render(); }
  else if (gesto.tipo === 'vertice') {
    const c = gesto.c, n = c.pts.length, ant = c.pts[(gesto.vi - 1 + n) % n], prox = c.pts[(gesto.vi + 1) % n];
    let novo = imantar(mundo(s), null, c.id);
    const tolA = 12 / vista.esc;
    if (!todosVertices(c.id).some(v => v[0] === novo[0] && v[1] === novo[1])) { // não estava preso num canto
      const w = mundo(s);
      novo = [Math.abs(w[0] - ant[0]) < tolA ? ant[0] : Math.abs(w[0] - prox[0]) < tolA ? prox[0] : novo[0],
              Math.abs(w[1] - ant[1]) < tolA ? ant[1] : Math.abs(w[1] - prox[1]) < tolA ? prox[1] : novo[1]];
    }
    // leva junto cantos de outros cômodos que estavam colados neste
    proj.comodos.forEach(o => { if (o.id !== c.id) o.pts.forEach((p, k) => { if (dist(p, gesto.orig) < 0.002) o.pts[k] = novo.slice(); }); });
    c.pts[gesto.vi] = novo; gesto.orig = novo.slice(); render();
  } else if (gesto.tipo === 'mover') {
    const w = mundo(s); let dx = w[0] - gesto.w0[0], dy = w[1] - gesto.w0[1];
    dx = Math.round(dx / GRADE) * GRADE; dy = Math.round(dy / GRADE) * GRADE;
    // ímã: encosta um canto em canto de outro cômodo
    const tol = TOL_PX / vista.esc, outros = todosVertices(gesto.c.id); let melhor = null, md = tol;
    gesto.orig.forEach(p => { const q = [p[0] + dx, p[1] + dy]; outros.forEach(o => { const d = dist(o, q); if (d < md) { md = d; melhor = [o[0] - p[0], o[1] - p[1]]; } }); });
    if (melhor) [dx, dy] = melhor;
    gesto.c.pts = gesto.orig.map(p => [+(p[0] + dx).toFixed(4), +(p[1] + dy).toFixed(4)]); render();
  }
});

function fimPonteiro(e) {
  if (!ponteiros.has(e.pointerId)) return;
  const s = ponteiros.get(e.pointerId); ponteiros.delete(e.pointerId);
  if (gesto && gesto.tipo === 'pinca') { if (ponteiros.size === 0) gesto = null; else gesto = { tipo: 'nada', moveu: true }; return; }
  if (!gesto) return;
  const g = gesto; gesto = null;
  if ((g.tipo === 'vertice' || g.tipo === 'mover' || g.tipo === 'porta') && g.moveu) { gravar(); render(); return; }
  if (g.tipo === 'porta') { sel = { comodo: g.c.id, parede: g.pt.parede }; render(); return; }
  if (g.tipo === 'traco' && g.moveu) {
    const u = rascunho[rascunho.length - 1], fim = imantar(mundo(s), u); cursor = null;
    if (rascunho.length >= 3 && dist(tela(fim), tela(rascunho[0])) < TOL_PX + 6) { render(); fecharRascunho(); return; }
    if (dist(u, fim) >= 0.05) rascunho.push(fim);
    else if (rascunho.length === 1) rascunho = [];
    render(); return;
  }
  if (!g.moveu && e.type === 'pointerup') toque(s);
}
svg.addEventListener('pointerup', fimPonteiro);
svg.addEventListener('pointercancel', fimPonteiro);
svg.addEventListener('wheel', e => { e.preventDefault(); const s = pos(e); zoomEm(s[0], s[1], Math.exp(-e.deltaY * 0.0015)); render(); }, { passive: false });

function portaEm(s) {
  let melhor = null, md = Infinity;
  proj.comodos.forEach(c => (c.portas || []).forEach(pt => {
    const g = geoPorta(c, pt); if (!g) return;
    const m = tela([(g.p0[0] + g.p1[0]) / 2 + g.nrm[0] * g.w / 2, (g.p0[1] + g.p1[1]) / 2 + g.nrm[1] * g.w / 2]);
    const d = dist(m, s), raio = Math.max(g.w * vista.esc * 0.6, TOL_PX + 6);
    if (d < raio && d < md) { md = d; melhor = { c, pt }; }
  }));
  return melhor;
}
function paredeEm(s) {
  let melhor = null, md = TOL_PX;
  const ordem = sel.comodo ? [comodo(sel.comodo), ...proj.comodos.filter(c => c.id !== sel.comodo)] : proj.comodos;
  ordem.forEach(c => c.pts.forEach((a, i) => {
    const d = distSeg(s, tela(a), tela(c.pts[(i + 1) % c.pts.length]));
    if (d < md - (c.id === sel.comodo ? 0 : 0.5)) { md = d; melhor = { comodo: c.id, parede: i }; }
  }));
  return melhor;
}

function toque(s) {
  const w = mundo(s);
  if (modo === 'desenhar') {
    if (rascunho.length >= 3 && dist(tela(rascunho[0]), s) < TOL_PX + 6) { fecharRascunho(); return; }
    const p = imantar(w, rascunho[rascunho.length - 1], undefined, rascunho.length ? 1 : 2);
    const u = rascunho[rascunho.length - 1];
    if (u && dist(u, p) < 0.01) return;
    rascunho.push(p); cursor = null; render(); return;
  }
  const par = paredeEm(s);
  if (par) { sel = par; render(); return; }
  for (let i = proj.comodos.length - 1; i >= 0; i--) {
    if (dentro(w, proj.comodos[i].pts)) { sel = { comodo: proj.comodos[i].id, parede: null }; render(); return; }
  }
  sel = { comodo: null, parede: null }; render();
}

// ---------- início ----------
renderLista();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
