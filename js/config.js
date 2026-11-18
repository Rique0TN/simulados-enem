/* ===== CONFIGURAÇÃO ÚNICA DO SITE =====
 * Troque BASE_URL pelo endereço real depois de publicar no GitHub Pages
 * (e rode `python3 _configurar_url.py` para atualizar sitemap.xml, robots.txt e as tags do index.html).
 */
window.SITE_CONFIG = {
  BASE_URL: "https://rique0tn.github.io/simulados-enem/",
  SITE_NAME: "Simulados ENEM",
  ADS_ENABLED: false,          // false = nenhum anúncio carrega; true = mostra os espaços reservados (início e tela de correção)
  STORAGE_KEY: "simuladosEnem.v1",
  CHARS_PER_LINE: 80,          // estimativa de caracteres por linha da folha de redação
  DURACAO_DIA1_MIN: 330,       // 5h30 (informativo)
  DURACAO_DIA2_MIN: 300,       // 5h00 (informativo)
  POR_AREA: 45
};
