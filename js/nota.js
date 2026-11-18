/* Estimativa APROXIMADA de nota por área (não é TRI).
 * Método:
 *  1) Mapa linear por partes de nº de acertos (0–45) → nota típica, calibrado a partir de faixas
 *     observadas publicamente em edições recentes do ENEM (valores arredondados e aproximados).
 *  2) Ajuste de coerência pedagógica (imitando a ideia da TRI): compara o aproveitamento nas questões
 *     fáceis, médias e difíceis (etiquetas de dificuldade do banco). Errar fáceis e acertar difíceis
 *     sugere "chute" e reduz a estimativa; padrão coerente dá um pequeno bônus.
 *  3) Resultado apresentado como FAIXA (±30 pontos em torno do valor ajustado), limitada ao mínimo e
 *     ao máximo plausíveis da área.
 * A nota oficial usa a Teoria de Resposta ao Item (TRI), com parâmetros de cada questão que só o INEP conhece.
 */
(function () {
  "use strict";
  // pontos de calibração [acertos, nota típica]
  var TAB = {
    LC: [[0, 300], [5, 340], [10, 400], [15, 460], [20, 520], [25, 565], [30, 610], [35, 655], [40, 705], [45, 790]],
    CH: [[0, 310], [5, 360], [10, 425], [15, 490], [20, 550], [25, 605], [30, 655], [35, 705], [40, 765], [45, 830]],
    CN: [[0, 320], [5, 370], [10, 430], [15, 490], [20, 550], [25, 605], [30, 655], [35, 715], [40, 790], [45, 870]],
    MT: [[0, 330], [5, 380], [10, 445], [15, 525], [20, 595], [25, 650], [30, 705], [35, 765], [40, 845], [45, 960]]
  };
  function interp(area, ac, total) {
    var t = TAB[area]; var x = total ? ac * 45 / total : 0;
    for (var i = 1; i < t.length; i++) {
      if (x <= t[i][0]) {
        var a = t[i - 1], b = t[i];
        return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]);
      }
    }
    return t[t.length - 1][1];
  }
  /* itens: [{dif:1|2|3, certo:bool}] */
  function estimar(area, itens) {
    var total = itens.length, ac = itens.filter(function (i) { return i.certo; }).length;
    var base = interp(area, ac, total);
    var g = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
    itens.forEach(function (i) { var d = g[i.dif || 2]; d[1]++; if (i.certo) d[0]++; });
    function taxa(d) { return d[1] ? d[0] / d[1] : null; }
    var f = taxa(g[1]), m = taxa(g[2]), h = taxa(g[3]);
    var ajuste = 0, nota = "";
    if (ac > 0 && ac < total) {
      var ref = f !== null ? f : m;
      if (h !== null && ref !== null && h > ref) {
        ajuste = -Math.round(Math.min(60, (h - ref) * 120));
        nota = "Você acertou proporcionalmente mais questões difíceis do que fáceis — padrão que a TRI interpreta como possível chute; a estimativa foi reduzida.";
      } else if (f !== null && h !== null && f >= (m === null ? f : m) && (m === null ? f : m) >= h && f - h >= 0.15) {
        ajuste = 10;
        nota = "Padrão de respostas coerente (mais acertos nas fáceis do que nas difíceis): pequeno bônus de coerência.";
      }
    }
    var t = TAB[area], min = t[0][1], max = t[t.length - 1][1];
    var centro = Math.max(min, Math.min(max, base + ajuste));
    return {
      acertos: ac, total: total, base: Math.round(base), ajuste: ajuste, nota: nota,
      min: Math.round(Math.max(min, centro - 30)), max: Math.round(Math.min(max, centro + 30)), centro: Math.round(centro)
    };
  }
  window.EstimativaNota = { estimar: estimar, TABELA: TAB };
})();
