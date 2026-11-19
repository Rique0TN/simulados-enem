/* Corretor automático de redação (estimativa transparente, baseada em regras).
 * NÃO substitui a correção oficial do ENEM, feita por corretores humanos.
 * Expõe window.CorretorRedacao.corrigir(texto, tema) e .contarLinhas(texto).
 */
(function () {
  "use strict";
  var CPL = (window.SITE_CONFIG && window.SITE_CONFIG.CHARS_PER_LINE) || 80;

  function semAcento(s) { return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function paragrafos(t) { return t.split(/\n+/).map(function (p) { return p.trim(); }).filter(Boolean); }
  function contarLinhas(t) {
    var ps = paragrafos(t || ""), n = 0;
    ps.forEach(function (p) { n += Math.max(1, Math.ceil(p.length / CPL)); });
    return n;
  }
  function palavras(t) { return (t.match(/[A-Za-zÀ-ÿ0-9]+(?:[-'][A-Za-zÀ-ÿ0-9]+)*/g) || []); }
  function frases(p) { return (p.match(/[^.!?…]+(?:[.!?…]+|$)/g) || []).map(function (s) { return s.trim(); }).filter(Boolean); }
  /* Converte \b e \w para versões que entendem letras acentuadas (sem lookbehind, compatível com Safari antigo). */
  var LET = "[\\p{L}\\p{N}_]";
  function U(re) {
    var src = re.source, out = "", i = 0, cls = false;
    while (i < src.length) {
      if (cls) {
        if (src[i] === "\\" && src[i + 1] === "w") { out += "\\p{L}\\p{N}_"; i += 2; continue; }
        if (src[i] === "\\") { out += src[i] + src[i + 1]; i += 2; continue; }
        if (src[i] === "]") cls = false;
        out += src[i]; i++; continue;
      }
      if (src[i] === "[") { cls = true; out += src[i]; i++; continue; }
      if (src[i] === "\\" && src[i + 1] === "b") {
        var prev = out.length ? out[out.length - 1] : "";
        if (out.length === 0 || prev === "(" || prev === "|" ) out += "(?:^|(?=[^\\p{L}\\p{N}_])[^])";
        else out += "(?!" + LET + ")";
        i += 2; continue;
      }
      if (src[i] === "\\" && src[i + 1] === "w") { out += LET; i += 2; continue; }
      if (src[i] === "\\") { out += src[i] + src[i + 1]; i += 2; continue; }
      out += src[i]; i++;
    }
    var flags = re.flags.indexOf("u") >= 0 ? re.flags : re.flags + "u";
    return new RegExp(out, flags);
  }
  function trecho(texto, idx, len) {
    var ini = Math.max(0, idx - 35), fim = Math.min(texto.length, idx + len + 35);
    return (ini > 0 ? "…" : "") + texto.slice(ini, fim).replace(/\s+/g, " ") + (fim < texto.length ? "…" : "");
  }

  var STOP = ("a o as os um uma uns umas de do da dos das em no na nos nas por pelo pela pelos pelas para com sem sob sobre entre " +
    "e ou mas que se como mais menos muito muita muitos muitas pouco ja nao sim ao aos à às é são ser estar foi era há tem têm " +
    "seu sua seus suas esse essa esses essas este esta estes estas isso isto aquele aquela aquilo ele ela eles elas lhe lhes " +
    "nos vos me te mesmo mesma tambem também so só quando onde qual quais quem cujo cuja porque pois assim entao então ainda " +
    "brasil brasileira brasileiro brasileiros brasileiras sociedade forma maneira modo fato fatos outro outra outros outras todo toda todos todas cada").split(" ");
  var STOPSET = {}; STOP.forEach(function (w) { STOPSET[semAcento(w)] = 1; });

  /* ---------- Competência 1: norma-padrão ---------- */
  // [regex, mensagem, peso]
  var ERROS = [
    [/\bconcerteza\b/gi, "\"concerteza\" → escreva \"com certeza\".", 1],
    [/\bderrepente\b/gi, "\"derrepente\" → escreva \"de repente\".", 1],
    [/\bapartir\b/gi, "\"apartir\" → escreva \"a partir\".", 1],
    [/\bporisso\b/gi, "\"porisso\" → escreva \"por isso\".", 1],
    [/\batravez\b/gi, "\"atravez\" → escreva \"através\".", 1],
    [/\bmenas\b/gi, "\"menas\" não existe → use \"menos\".", 1],
    [/\bsej[e]\b/gi, "\"seje\" → \"seja\".", 1],
    [/\besteje\b/gi, "\"esteje\" → \"esteja\".", 1],
    [/\bprevil[eé]gio/gi, "\"previlégio\" → \"privilégio\".", 1],
    [/\bexcess[aã]o\b/gi, "\"excessão\" → \"exceção\".", 1],
    [/\bimpec[ií]lio/gi, "\"impecílio\" → \"empecilho\".", 1],
    [/\bprevinir\b/gi, "\"previnir\" → \"prevenir\".", 1],
    [/\benchergar\b/gi, "\"enchergar\" → \"enxergar\".", 1],
    [/\bmendingo/gi, "\"mendingo\" → \"mendigo\".", 1],
    [/\bbeneficiente\b/gi, "\"beneficiente\" → \"beneficente\".", 1],
    [/\bcidad[oõ]es\b/gi, "plural de cidadão é \"cidadãos\".", 1],
    [/\bnescess[aá]ri/gi, "grafia correta: \"necessário\".", 1],
    [/\bagente\s+(vai|vamos|foi|tem|pode|precisa|sabe|faz|deve|quer|est[aá]|era|n[aã]o|ve|v[eê]|consegue|tinha|ia|fica)\b/gi, "\"agente\" (substantivo) ≠ \"a gente\" (pronome). Aqui o sentido é \"a gente\" — e, no texto formal, prefira \"nós\".", 1],
    [/\bmim\s+(fazer|ser|ter|ir|estudar|entender|poder|conseguir|ler|escrever|falar)\b/gi, "\"para mim + verbo\" → use \"para eu + verbo\" (o sujeito do infinitivo é \"eu\").", 1],
    [/\bhouveram\b(?!\s+\w+(ado|ido)s?\b)/gi, "\"haver\" no sentido de existir/ocorrer é impessoal: \"houve\".", 1],
    [/\bhaver[aã]o\b(?!\s+\w+(ado|ido)s?\b)/gi, "\"haver\" no sentido de existir é impessoal: \"haverá\".", 1],
    [/\bfazem\s+(\d+|dois|tr[eê]s|quatro|cinco|dez|muitos|v[aá]rios|alguns)\s+(anos|meses|dias|s[eé]culos|d[eé]cadas)\b/gi, "\"fazer\" indicando tempo decorrido é impessoal: \"faz X anos\".", 1],
    [/\bmas\s+ou\s+menos\b/gi, "\"mas ou menos\" → \"mais ou menos\".", 1],
    [/\bcada\s+vez\s+mas\b/gi, "\"cada vez mas\" → \"cada vez mais\".", 1],
    [/\bmas\s+(de|do|da|que)\s+(\d|metade|um|uma)/gi, "possível troca: \"mas\" (oposição) por \"mais\" (quantidade).", 1],
    [/,\s*mais\s+(o|a|os|as|n[aã]o|[eé]|isso|esse|essa|ele|ela|tamb[eé]m|sim|ainda)\b/gi, "possível troca: depois de vírgula, com sentido de oposição, use \"mas\" (e não \"mais\").", 1],
    [/\ba\s+n[ií]vel\s+de\b/gi, "\"a nível de\" é inadequado → \"em nível de\" ou \"no âmbito de\".", 0.5],
    [/\bà\s+partir\b/gi, "não há crase em \"a partir\".", 1],
    [/\bà\s+(todos|todas|ele|eles|este|esse|isso|cada|um|n[oó]s|voc[eê]s?|quem|partir|ser|ter|fazer|haver|pagar|estudar|trabalhar|serem|terem)\b/gi, "não se usa crase antes de palavra masculina, pronome ou verbo.", 1],
    [/\b(em\s+rela[cç][aã]o|devido|referente|gra[cç]as|frente|junto|quanto|aten[cç][aã]o|acesso|direito)\s+a\s+(sociedade|popula[cç][aã]o|escola|fam[ií]lia|educa[cç][aã]o|sa[uú]de|cultura|internet|viol[eê]ncia|desigualdade|leitura|alimenta[cç][aã]o|informa[cç][aã]o|cidadania|mulher|crian[cç]a|juventude|mobilidade)\b/gi, "falta crase: \"a + a\" → \"à\" (ex.: \"em relação à sociedade\").", 1],
    [/\b(n[a]o|sao|tambem|alem|porem|atraves|voce|entao|ninguem|tambem|ate|ja|so|tres|pais(?=\s+(desenvolvido|subdesenvolvido|inteiro)))\b/g, "palavra sem acento gráfico obrigatório.", 0.5],
    [/\b\w+(cao|coes)\b/g, "falta acento/cedilha em palavra terminada em \"-ção/-ções\".", 0.5],
    [/\b(vc|vcs|tb|tbm|pq|q|hj|mt|mto|td|fds|blz)\b/gi, "abreviação típica de internet: inadequada no texto formal.", 1],
    [/\b(pra|pro|t[aá]|tipo assim|n[eé]\?|a[ií] (?=\w)|da[ií] (?=\w)|beleza|galera|top|legal demais)\b/gi, "marca de oralidade/informalidade: prefira registro formal (ex.: \"para\", \"está\").", 0.5],
    [/\ba gente\b/gi, "\"a gente\" é informal no texto dissertativo: prefira \"nós\" ou construções impessoais.", 0.5],
    [/\s+[,.;:!?]/g, "espaço antes de sinal de pontuação.", 0.25],
    [/[,;:](?=[A-Za-zÀ-ÿ])/g, "falta espaço depois da pontuação.", 0.25]
  ];

  function analisarC1(texto, ps) {
    var achados = [], peso = 0;
    ERROS.forEach(function (e) {
      var re = U(e[0].flags.indexOf("g") >= 0 ? e[0] : new RegExp(e[0].source, e[0].flags + "g")), m, cont = 0;
      while ((m = re.exec(texto)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        // "pra" pode ser parte de "pra-": já coberto por \b; "ja"/"so" ignorados quando em maiúsculas iniciais de nomes
        cont++;
        if (cont <= 3) achados.push({ msg: e[1], trecho: trecho(texto, m.index, m[0].length), grifo: m[0].replace(/^[^\p{L}\p{N}]+/u, "").trim() });
        peso += e[2];
        if (cont > 6) break;
      }
    });
    // maiúscula no início de frase e de parágrafo; pontuação final
    ps.forEach(function (p) {
      if (/^[a-zà-ÿ]/.test(p)) { achados.push({ msg: "Parágrafo iniciado com letra minúscula.", trecho: trecho(p, 0, 20), grifo: p.split(/\s/)[0] }); peso += 1; }
      if (!/[.!?…"”)]$/.test(p)) { achados.push({ msg: "Parágrafo sem pontuação final.", trecho: trecho(p, p.length - 1, 1), grifo: "" }); peso += 0.5; }
      var re = /[.!?]\s+([a-zà-ÿ])/g, m, c = 0;
      while ((m = re.exec(p)) !== null && c < 3) {
        c++; peso += 1;
        achados.push({ msg: "Início de frase com letra minúscula após ponto.", trecho: trecho(p, m.index, 3), grifo: m[1] });
      }
    });
    // frases muito longas
    ps.forEach(function (p) {
      frases(p).forEach(function (f) {
        var n = palavras(f).length;
        if (n > 60) { peso += 1; achados.push({ msg: "Período muito longo (" + n + " palavras). Divida em frases menores para evitar problemas de pontuação e de estrutura sintática.", trecho: f.slice(0, 110) + "…", grifo: "" }); }
      });
    });
    // repetição de palavras
    var freq = {}, ws = palavras(texto);
    ws.forEach(function (w) { var k = semAcento(w); if (k.length >= 5 && !STOPSET[k]) freq[k] = (freq[k] || 0) + 1; });
    var limite = Math.max(4, Math.round(ws.length * 0.022));
    var reps = Object.keys(freq).filter(function (k) { return freq[k] > limite; }).sort(function (a, b) { return freq[b] - freq[a]; });
    reps.slice(0, 4).forEach(function (k) {
      peso += 0.5;
      achados.push({ msg: "A palavra \"" + k + "\" aparece " + freq[k] + " vezes. Use sinônimos, pronomes ou expressões equivalentes para evitar repetição.", trecho: "", grifo: k });
    });
    var nota;
    if (peso <= 1) nota = 200; else if (peso <= 3) nota = 160; else if (peso <= 6) nota = 120;
    else if (peso <= 10) nota = 80; else if (peso <= 18) nota = 40; else nota = 0;
    if (ws.length < 200 && nota > 160) nota = 160; // texto curto demais para comprovar domínio excelente
    return { nota: nota, achados: achados, peso: peso };
  }

  /* ---------- Competência 2: tema, tipo textual e repertório ---------- */
  var AUTORES = ["bauman", "durkheim", "weber", "marx", "kant", "aristoteles", "platao", "socrates", "rousseau", "hobbes", "locke", "foucault",
    "paulo freire", "antonio candido", "milton santos", "sergio buarque", "gilberto freyre", "djamila ribeiro", "silvio almeida", "byung-chul han",
    "sartre", "simone de beauvoir", "hannah arendt", "adorno", "horkheimer", "habermas", "josue de castro", "carolina maria de jesus",
    "machado de assis", "darcy ribeiro", "florestan fernandes", "lefebvre", "montesquieu", "maquiavel", "nietzsche", "descartes", "bourdieu",
    "zuboff", "haidt", "chimamanda", "conceicao evaristo", "lima barreto", "graciliano", "drummond", "guimaraes rosa", "clarice", "ailton krenak",
    "oms", "onu", "unesco", "unicef", "ibge", "ipea", "inep", "datafolha", "fiocruz", "cetic", "anpd", "constituicao", "estatuto", "eca", "lgpd",
    "marco civil", "declaracao universal", "agenda 2030", "sus", "cras", "caps"];
  function repertorios(texto) {
    var t = semAcento(texto), achados = [];
    AUTORES.forEach(function (a) {
      var re = new RegExp("\\b" + a.replace(/[-]/g, "[- ]") + "\\b", "i");
      var m = re.exec(t); if (m) achados.push({ tipo: "autor/instituição/documento", item: texto.substr(m.index, a.length) , idx: m.index });
    });
    var re2 = U(/\b(lei\s+(n[º°.o]*\s*)?[\d.]+(\/\d+)?|lei\s+maria\s+da\s+penha|artigo\s+\d+|art\.\s*\d+|emenda\s+constitucional)/gi), m;
    while ((m = re2.exec(texto)) !== null) achados.push({ tipo: "legislação", item: m[0], idx: m.index });
    var re3 = U(/\b(1[5-9]\d\d|20[0-4]\d)\b/g);
    while ((m = re3.exec(texto)) !== null) achados.push({ tipo: "dado histórico (data)", item: m[0], idx: m.index });
    var re4 = U(/\b\d+(,\d+)?\s?(%|por cento|milh(ões|ão)|mil\b)/gi);
    while ((m = re4.exec(texto)) !== null) achados.push({ tipo: "dado estatístico", item: m[0], idx: m.index });
    var re5 = U(/\b(segundo|de acordo com|conforme|consoante|na obra|no livro|no filme|na série|no documentário)\s+[“"«]?[A-ZÀ-Ý][\wÀ-ÿ]+/g);
    while ((m = re5.exec(texto)) !== null) achados.push({ tipo: "citação/alusão", item: m[0], idx: m.index });
    // remove duplicatas por item
    var vistos = {}, out = [];
    achados.forEach(function (a) { var k = semAcento(a.item); if (!vistos[k]) { vistos[k] = 1; out.push(a); } });
    return out;
  }
  function normTokens(t) {
    return palavras(semAcento(t)).filter(function (w) { return w.length > 3 && !STOPSET[w]; });
  }
  function radical(w) { return w.length > 6 ? w.slice(0, w.length - 2) : w; }
  function relacaoTema(texto, tema) {
    var t = semAcento(texto);
    var kws = tema.palavras || [];
    var vistos = {}, achadas = kws.filter(function (ko) {
      var k = semAcento(ko), g = k.slice(0, 6); if (vistos[g]) return false;
      if (new RegExp("\\b" + radical(k)).test(t)) { vistos[g] = 1; return true; } return false;
    });
    var titulo = normTokens(tema.tema).filter(function (w) { return !/^(desafios|caminhos|para|combater|valorizacao|democratizar|ampliar)$/.test(w); });
    var tits = titulo.filter(function (w) { return new RegExp("\\b" + radical(w)).test(t); });
    var orig = palavras(tema.tema), mapa = {}; orig.forEach(function (w) { mapa[semAcento(w)] = w.toLowerCase(); });
    tits = tits.map(function (w) { return mapa[w] || w; });
    return { kws: achadas, kwsTotal: kws.length, titulo: titulo, tituloAchado: tits, cobertura: titulo.length ? tits.length / titulo.length : 1 };
  }
  function nucleoTema(texto, tema) {
    if (!tema.nucleo || !tema.nucleo.length) return null;
    var t = " " + semAcento(texto).replace(/[^a-z0-9 -]+/g, " ") + " ";
    var hits = tema.nucleo.map(function (grupo) {
      var n = 0;
      grupo.forEach(function (k) { var kk = " " + semAcento(k).trim(); var i = t.indexOf(kk); while (i >= 0) { n++; i = t.indexOf(kk, i + kk.length); } });
      return n;
    });
    return { hits: hits };
  }
  function copiaMotivadores(texto, tema) {
    var base = normTokens((tema.textos || []).map(function (x) { return x.texto; }).join(" "));
    var sh = {}; for (var i = 0; i + 6 <= base.length; i++) sh[base.slice(i, i + 6).join(" ")] = 1;
    var tk = normTokens(texto), tot = 0, cop = 0;
    for (var j = 0; j + 6 <= tk.length; j++) { tot++; if (sh[tk.slice(j, j + 6).join(" ")]) cop++; }
    return tot ? cop / tot : 0;
  }

  /* ---------- Competência 4: conectivos ---------- */
  var CONECTIVOS = ["além disso", "ademais", "outrossim", "não obstante", "no entanto", "entretanto", "contudo", "todavia", "porém",
    "portanto", "logo", "assim", "dessa forma", "desse modo", "dessa maneira", "nesse sentido", "nesse contexto", "nessa perspectiva",
    "diante disso", "diante do exposto", "em suma", "por fim", "por conseguinte", "consequentemente", "uma vez que", "visto que",
    "já que", "posto que", "haja vista", "porque", "pois", "embora", "ainda que", "mesmo que", "apesar de", "à medida que",
    "na medida em que", "em primeiro lugar", "em segundo lugar", "primeiramente", "inicialmente", "sob esse viés", "sob essa ótica",
    "nessa lógica", "por outro lado", "em contrapartida", "do mesmo modo", "analogamente", "isto é", "ou seja", "por exemplo",
    "com efeito", "de fato", "sobretudo", "principalmente", "outro fator", "outro aspecto", "paralelamente", "em síntese",
    "a fim de", "para que", "conforme", "segundo", "bem como", "tanto quanto", "à luz de", "nesse cenário", "por isso", "então", "também"];
  function conectivosDe(p) {
    var t = semAcento(p), achados = [];
    CONECTIVOS.forEach(function (c) {
      var re = new RegExp("(^|[^a-z])" + semAcento(c).replace(/ /g, "\\s+") + "(?=[^a-z]|$)", "g"), m;
      while ((m = re.exec(t)) !== null) achados.push({ c: c, idx: m.index });
    });
    return achados;
  }
  function iniciaComConectivo(p) {
    var t = semAcento(p).slice(0, 60);
    for (var i = 0; i < CONECTIVOS.length; i++) {
      var c = semAcento(CONECTIVOS[i]);
      if (t.indexOf(c) === 0 || t.indexOf(c) === 0) return CONECTIVOS[i];
      // aceita conectivo nas primeiras 5 palavras (ex.: "Sob esse viés," / "Em suma,")
      var pos = t.indexOf(c);
      if (pos > 0 && pos < 25 && /[ ,]/.test(t.charAt(pos - 1))) return CONECTIVOS[i];
    }
    return null;
  }

  /* ---------- Competência 5: proposta de intervenção ---------- */
  var C5 = {
    agente: /\b(governo|estado|minist[eé]rio|poder (p[uú]blico|legislativo|executivo|judici[aá]rio)|congresso|senado|c[aâ]mara|prefeituras?|secretarias?|escolas?|fam[ií]lias?|m[ií]dia|imprensa|ongs?|organiza[cç][oõ]es|sociedade civil|empresas?|plataformas?|institui[cç][oõ]es|universidades?|cidad[aã]os|popula[cç][aã]o|anpd|autoridade|conselhos? tutelares?|sus|cras|igrejas?|sindicatos?|munic[ií]pios?|uni[aã]o|professores|estudantes)\b/i,
    acao: /\b(deve|devem|dever[aá]|precisa|precisam|cabe (ao|à|aos|às)|compete (ao|à)|é (necess[aá]rio|preciso|fundamental|imprescind[ií]vel|urgente|essencial) que|faz-se necess[aá]rio)\b|\b(criar|promover|implementar|ampliar|investir|fiscalizar|garantir|desenvolver|realizar|incentivar|oferecer|instituir|elaborar|financiar|capacitar|criem|promovam|ampliem|invistam|fiscalizem|garantam|desenvolvam|realizem|incentivem|ofere[cç]am)\b/i,
    meio: /\b(por meio de|por meio da|por meio do|através de|através da|através do|mediante|por intermédio|com o auxílio|com o apoio|com a cria[cç][aã]o|com a implementa[cç][aã]o|via|utilizando|a partir de (campanhas|parcerias|verbas|recursos|programas|projetos)|com (campanhas|palestras|oficinas|verbas|recursos))\b/i,
    finalidade: /\b(a fim de|para que|com o (objetivo|intuito|prop[oó]sito) de|com a finalidade de|visando|objetivando|de modo a|de forma a|de maneira a)\b|\bpara\s+(\w+(ar|er|ir))\b/i,
    detalhamento: /\b(por exemplo|tais como|como, por exemplo|ou seja|isto é|em parceria com|semanalmente|mensalmente|anualmente|periodicamente|semanais|mensais|anuais|peri[oó]dic[ao]s?|especializad[oa]s?|gratuit[oa]s?|obrigat[oó]ri[oa]s?|nas escolas|nos bairros|em todo o pa[ií]s|em hor[aá]rio|que (seja|sejam|possa|possam|garanta|garantam|contemple|contemplem)|compost[oa]s? por|com foco em|priorizando)\b/i,
    dh: /\b(pena de morte|matar|mat[aá]-los|tortura|torturar|castra[cç][aã]o|linchamento|linchar|exterminar|exterm[ií]nio|esterilizar|espancar|pris[aã]o perp[eé]tua para crian)/i
  };

  Object.keys(C5).forEach(function (k) { C5[k] = U(C5[k]); });
  function corrigir(texto, tema) {
    texto = (texto || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
    var ps = paragrafos(texto), linhas = contarLinhas(texto), ws = palavras(texto);
    var res = { linhas: linhas, palavras: ws.length, paragrafos: ps.length, comps: [], total: 0, zerada: null, avisos: [] };
    function zerar(motivo, detalhe) {
      res.zerada = motivo; res.total = 0;
      res.comps = [1, 2, 3, 4, 5].map(function (i) { return { n: i, nota: 0, achados: [], dicas: [] }; });
      res.avisos.unshift(detalhe);
      return res;
    }
    if (!texto) return zerar("Em branco", "A redação está em branco.");
    if (linhas < 8) return zerar("Texto insuficiente", "O texto tem cerca de " + linhas + " linha(s). No ENEM, redações com até 7 linhas recebem nota zero (texto insuficiente).");
    if (linhas > 30) res.avisos.push("O texto tem cerca de " + linhas + " linhas (estimativa de " + CPL + " caracteres por linha). Na folha oficial, o que passar de 30 linhas é desconsiderado — enxugue o texto.");

    var copia = copiaMotivadores(texto, tema);
    if (copia > 0.35) {
      var efetivas = Math.round(linhas * (1 - copia));
      res.avisos.push("Cerca de " + Math.round(copia * 100) + "% do texto reproduz trechos dos textos motivadores. Linhas copiadas são desconsideradas na correção.");
      if (efetivas < 8) return zerar("Cópia dos textos motivadores", "Descontadas as linhas copiadas dos textos motivadores, restam cerca de " + efetivas + " linhas autorais — insuficiente (nota zero).");
    }
    var rel = relacaoTema(texto, tema);
    var fuga = rel.kws.length <= 1 && rel.cobertura < 0.34;
    var nuc = nucleoTema(texto, tema);
    if (fuga) return zerar("Fuga ao tema", "ATENÇÃO: o texto quase não usa palavras ligadas ao tema \"" + tema.tema + "\". Isso indica FUGA AO TEMA, que zera a redação no ENEM. Releia a proposta e trate exatamente do recorte pedido.");
    var tangencia = rel.kws.length <= 2 && rel.cobertura < 0.5;
    if (nuc) {
      if (nuc.hits[0] <= 1) return zerar("Fuga ao tema", "ATENÇÃO: o texto não trata do núcleo do tema \"" + tema.tema + "\". Isso indica FUGA AO TEMA, que zera a redação no ENEM. Releia a proposta e trate exatamente do recorte pedido.");
      if (nuc.hits[0] <= 2 || nuc.hits.slice(1).some(function (h) { return h === 0; })) tangencia = true;
    }
    if (tangencia) res.avisos.push("Possível TANGENCIAMENTO: o texto aborda o assunto de forma ampla, sem desenvolver o recorte do tema (\"" + tema.tema + "\"). Palavras-chave do tema encontradas: " + (rel.kws.join(", ") || "nenhuma") + ".");

    if (C5.dh.test(texto)) res.avisos.push("A proposta parece desrespeitar os direitos humanos (ex.: violência, tortura, pena de morte). Isso zera a Competência 5.");

    // C1
    var c1 = analisarC1(texto, ps);
    var c1dicas = c1.achados.length ? ["Revise os trechos indicados. Na correção oficial, desvios gramaticais, de convenções da escrita e de escolha de registro reduzem a nota desta competência."] : ["Nenhum desvio frequente foi detectado pelas regras automáticas (o corretor não detecta todos os erros)."];
    res.comps.push({ n: 1, nome: "Domínio da norma-padrão", nota: c1.nota, achados: c1.achados.slice(0, 14), dicas: c1dicas });

    // C2
    var reps = repertorios(texto);
    var dev = ps.slice(1, ps.length - 1).join("\n");
    var repsDev = reps.filter(function (r) { return dev && semAcento(dev).indexOf(semAcento(r.item)) >= 0; });
    var c2 = 200, a2 = [], d2 = [];
    if (repsDev.length === 0 && reps.length === 0) { c2 = 120; d2.push("Não identifiquei repertório sociocultural (autor, obra, lei, dado, fato histórico). Use ao menos um repertório legitimado e pertinente em cada parágrafo de desenvolvimento."); }
    else if (repsDev.length < 2) { c2 = 160; d2.push("Há pouco repertório nos parágrafos de desenvolvimento. Para 200 pontos, o repertório deve ser legitimado, pertinente e produtivo (relacionado ao argumento)."); }
    reps.slice(0, 8).forEach(function (r) { a2.push({ msg: "Repertório identificado (" + r.tipo + ")", trecho: trecho(texto, r.idx, r.item.length), grifo: r.item }); });
    if (ps.length === 1) { c2 = Math.min(c2, 80); d2.push("O texto está em um único bloco. Organize-o em introdução, desenvolvimento (2 parágrafos) e conclusão."); }
    else if (ps.length === 2) { c2 = Math.min(c2, 120); d2.push("Apenas 2 parágrafos: falta a estrutura completa do texto dissertativo-argumentativo (introdução, desenvolvimento e conclusão)."); }
    else if (ps.length === 3) { c2 = Math.min(c2, 160); d2.push("Com 3 parágrafos há apenas um de desenvolvimento. O modelo mais seguro tem 4 parágrafos (introdução, 2 de desenvolvimento, conclusão)."); }
    if (tangencia) { c2 = Math.min(c2, 40); d2.unshift("Tangenciamento do tema limita esta competência a 40 pontos."); }
    a2.unshift({ msg: "Relação com o tema: palavras-chave encontradas — " + (rel.kws.join(", ") || "nenhuma") + "; termos do título presentes: " + (rel.tituloAchado.join(", ") || "nenhum") + ".", trecho: "", grifo: "" });
    res.comps.push({ n: 2, nome: "Compreensão do tema e repertório", nota: c2, achados: a2, dicas: d2 });

    // C3
    var p1 = ps[0] || "", pf = ps[ps.length - 1] || "";
    var opin = U(/\b(é (fundamental|necess[aá]rio|preciso|inegável|evidente|indispens[aá]vel|urgente|inadmiss[ií]vel|preocupante)|deve|devem|precisa|problema|desafio|entrave|obst[aá]culo|causa|fator|consequ[eê]ncia|n[aã]o se pode|evidencia|revela|configura|persist|ainda|infelizmente|lament[aá]vel|grave)\w*/i);
    var tese = opin.test(p1) && relacaoTema(p1, tema).kws.length >= 1;
    var anuncia = U(/\b(além de|bem como|aliad[oa] a|somad[oa] a|seja pel|tanto .{1,40} quanto|não só .{1,60} mas também|e (da|do|de|pela|pelo)\b)/i).test(p1) || frases(p1).length >= 3;
    var explica = U(/\b(isso ocorre|isso se deve|porque|pois|visto que|uma vez que|já que|dessa forma|desse modo|consequentemente|por conseguinte|por exemplo|prova disso|exemplo disso|haja vista|em virtude de|à medida que|resulta|acarreta|gera|provoca|leva a|contribui|assim|por isso|o que|revela|indica|evidencia|demonstra|segundo|de acordo com|sob essa ótica|nesse contexto)\b/i);
    var devs = ps.slice(1, ps.length - 1), dOk = 0, a3 = [], d3 = [];
    devs.forEach(function (p, i) {
      var n = palavras(p).length, ok = n >= 45 && explica.test(p);
      if (ok) dOk++;
      else a3.push({ msg: "Desenvolvimento " + (i + 1) + ": " + (n < 45 ? "parágrafo curto (" + n + " palavras) — argumento pouco desenvolvido." : "faltam explicações/relações de causa e consequência ou exemplos."), trecho: p.slice(0, 100) + "…", grifo: "" });
    });
    var tP1 = normTokens(p1).map(radical), tPf = normTokens(pf).map(radical), comum = {};
    tP1.forEach(function (w) { if (tPf.indexOf(w) >= 0) comum[w] = 1; });
    var retoma = Object.keys(comum).length >= 3;
    var c3 = 40 + (tese ? 40 : 0) + 40 * Math.min(dOk, 2) + ((retoma && anuncia) ? 40 : 0);
    if (!tese) { a3.unshift({ msg: "Não identifiquei uma tese clara no 1º parágrafo (posicionamento sobre o tema).", trecho: p1.slice(0, 120) + (p1.length > 120 ? "…" : ""), grifo: "" }); d3.push("Termine a introdução com uma tese explícita: o que você defende e quais os dois argumentos que vai desenvolver."); }
    if (!anuncia) d3.push("Antecipe na introdução os argumentos que serão desenvolvidos (ex.: \"... seja pela X, seja pela Y\").");
    if (!retoma) d3.push("Na conclusão, retome a tese e os argumentos antes da proposta: isso mostra um projeto de texto coerente.");
    if (ps.length < 3) c3 = Math.min(c3, 80);
    if (repsDev.length === 0 && c3 > 160) { c3 = 160; d3.push("Para 200 pontos, os argumentos precisam de indícios de autoria: aprofunde-os com repertório, dados ou exemplos próprios."); }
    if (tangencia) c3 = Math.min(c3, 80);
    c3 = Math.min(200, c3);
    if (!d3.length) d3.push("Bom projeto de texto: tese, desenvolvimento e retomada identificados. Continue aprofundando cada argumento com explicações e exemplos.");
    res.comps.push({ n: 3, nome: "Seleção e organização dos argumentos", nota: c3, achados: a3, dicas: d3 });

    // C4
    var porPar = ps.map(conectivosDe), todos = [].concat.apply([], porPar);
    var distintos = {}; todos.forEach(function (x) { distintos[x.c] = (distintos[x.c] || 0) + 1; });
    var nd = Object.keys(distintos).length;
    var inicios = ps.slice(1).map(iniciaComConectivo), interOk = inicios.filter(Boolean).length;
    var parSem = porPar.map(function (l, i) { return l.length === 0 ? i + 1 : 0; }).filter(Boolean);
    var abuso = Object.keys(distintos).filter(function (k) { return distintos[k] >= 4 && k !== "também"; });
    var c4, a4 = [], d4 = [];
    if (nd >= 8 && interOk >= ps.length - 1 && ps.length >= 4 && !abuso.length && !parSem.length) c4 = 200;
    else if (nd >= 6 && interOk >= Math.max(1, ps.length - 2)) c4 = 160;
    else if (nd >= 4) c4 = 120;
    else if (nd >= 2) c4 = 80;
    else c4 = 40;
    if (abuso.length && c4 > 160) c4 = 160;
    a4.push({ msg: "Conectivos encontrados (" + todos.length + " ocorrências, " + nd + " diferentes): " + Object.keys(distintos).slice(0, 18).join(", ") + ".", trecho: "", grifo: "" });
    ps.slice(1).forEach(function (p, i) {
      if (!inicios[i]) a4.push({ msg: "O parágrafo " + (i + 2) + " não começa com um conectivo que o ligue ao anterior.", trecho: p.slice(0, 70) + "…", grifo: "" });
    });
    parSem.forEach(function (n) { a4.push({ msg: "O parágrafo " + n + " não tem nenhum conectivo identificado.", trecho: "", grifo: "" }); });
    abuso.forEach(function (k) { a4.push({ msg: "O conectivo \"" + k + "\" foi usado " + distintos[k] + " vezes — varie (ex.: além disso / ademais / outrossim).", trecho: "", grifo: k }); });
    d4.push("Use conectivos variados entre parágrafos (\"Em primeiro lugar\", \"Além disso\", \"Portanto\") e dentro deles (\"porque\", \"visto que\", \"dessa forma\"), além de pronomes para retomar ideias.");
    res.comps.push({ n: 4, nome: "Coesão (mecanismos linguísticos)", nota: c4, achados: a4, dicas: d4 });

    // C5
    var alvo = pf;
    var elem = {}, a5 = [], d5 = [];
    ["agente", "acao", "meio", "finalidade", "detalhamento"].forEach(function (k) {
      var m = C5[k].exec(alvo);
      elem[k] = !!m;
      if (m) a5.push({ msg: { agente: "Agente", acao: "Ação", meio: "Meio/modo", finalidade: "Finalidade", detalhamento: "Detalhamento" }[k] + " identificado(a)", trecho: trecho(alvo, m.index, m[0].length), grifo: m[0] });
    });
    var nomes = { agente: "AGENTE (quem vai executar: governo, ministério, escola, mídia...)", acao: "AÇÃO (o que deve ser feito)", meio: "MEIO/MODO (como: \"por meio de\", \"mediante\")", finalidade: "FINALIDADE (para quê: \"a fim de\", \"para que\")", detalhamento: "DETALHAMENTO (um elemento explicado: exemplo, aposto, especificação)" };
    Object.keys(elem).forEach(function (k) { if (!elem[k]) d5.push("Falta " + nomes[k] + " no último parágrafo."); });
    var nEl = Object.keys(elem).filter(function (k) { return elem[k]; }).length;
    var c5 = 40 * nEl;
    if (!elem.acao) c5 = Math.min(c5, 40);
    if (tangencia) c5 = Math.min(c5, 80);
    if (C5.dh.test(texto)) { c5 = 0; d5.unshift("Proposta com desrespeito aos direitos humanos: Competência 5 zerada."); }
    if (!d5.length) d5.push("Proposta completa: agente, ação, meio, finalidade e detalhamento identificados.");
    res.comps.push({ n: 5, nome: "Proposta de intervenção", nota: c5, achados: a5, dicas: d5 });

    // Texto curto: redações nota 1000 costumam ter 25–30 linhas e argumentos bem desenvolvidos.
    var nw = palavras(texto).length, nl = contarLinhas(texto);
    function teto(i, max, msg) { var c = res.comps[i]; if (c && c.nota > max) { c.nota = max; c.dicas.unshift(msg); } }
    if (nl < 15 || nw < 180) {
      teto(1, 120, "Texto curto: desenvolva mais o tema e o repertório (o ideal é escrever entre 25 e 30 linhas).");
      teto(2, 120, "Texto curto: os argumentos ficam pouco desenvolvidos. Explique causas, consequências e exemplos.");
    } else if (nl < 22 || nw < 280) {
      teto(1, 160, "Para chegar a 200, aprofunde o repertório e ligue-o ao tema; textos nota 1000 costumam ter 25 a 30 linhas.");
      teto(2, 160, "Para chegar a 200, desenvolva mais cada argumento (explique, exemplifique e conclua cada parágrafo).");
    }
    res.total = res.comps.reduce(function (s, c) { return s + c.nota; }, 0);
    return res;
  }

  window.CorretorRedacao = { corrigir: corrigir, contarLinhas: contarLinhas, contarPalavras: function (t) { return palavras(t || "").length; } };
})();
