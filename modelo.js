// =====================================================================
// Análise nova, empresa de exemplo e catálogo de cenários genéricos
// =====================================================================
"use strict";
const arr = (v, o) => ({v: Array(NY).fill(v), o});
function blankAnalysis() {
  return {
    v: 1, id: uid(), criado: new Date().toISOString(),
    emp: {nome: "", cnpj: "", setor: "", grupo: "", anoBase: 2025, mesesParcial: 9, auditoria: "nenhum", hist: "limpo", conc: .2, concO: O("prem", "informe a participação do maior cliente na receita")},
    dem: {}, // dem[linha][periodo] = {v, o}
    files: [],
    op: {instrumento: "Cédula de crédito bancário", valor: 0, prazo: 48, carencia: 12, amort: "constante", index: "CDI", spread: .038, taxaPre: .18, quitar: 0, destino: "", pessoais: ""},
    gar: [], credores: [],
    covs: [
      {m: "lev", lim: 3, o: O("prem", "limite proposto pelo analista")},
      {m: "icr", lim: 2, o: O("prem", "limite proposto pelo analista")},
      {m: "dscr", lim: 1.2, o: O("prem", "limite proposto pelo analista")}],
    clausulas: ["Vencimento antecipado cruzado com outras dívidas", "Troca de controle sem anuência do credor", "Dividendos limitados a 25% do lucro enquanto houver saldo", "Não dar as mesmas garantias a outro credor"],
    prem: null, premO: {},
    juros: {over: {}, overF: {}, datas: {}, ipcaOver: {}, cdiGap: .10},
    cens: [],
    casos: {base: 55, moderado: 30, estresse: 15},
    rating: {pesos: {lev: 25, dscr: 25, icr: 10, conc: 10, info: 10, escala: 10, hist: 10},
      escala: [{nota: "AA", min: 80, pd: .003}, {nota: "A", min: 70, pd: .007}, {nota: "BBB", min: 60, pd: .015}, {nota: "BB", min: 48, pd: .03}, {nota: "B", min: 35, pd: .06}, {nota: "CCC", min: 20, pd: .12}, {nota: "CC", min: 0, pd: .25}],
      escalaO: O("prem", "tabela de exemplo da ferramenta: troque pela escala mestra da sua casa (nota interna → chance de calote em 1 ano)")},
    preco: {funding: .006, opex: .0035, capital: .105, roe: .25,
      o: {funding: O("prem", "custo de captação acima do CDI. Ex.: CDB a 104% do CDI com CDI de 13,65% ≈ 0,55 p.p."), opex: O("prem", "custo de análise, acompanhamento e tributos sobre a receita do credor, em % do saldo ao ano"),
        capital: O("prem", "capital mínimo de 8% + adicional de conservação de 2,5% (Resolução CMN 4.958/2021), com fator de risco de 100% para empresa"), roe: O("prem", "meta de retorno sobre o capital da casa")}},
    pares: [], parAj: {}, covPares: [], noticias: [],
    parecer: {rec: "condicoes", texto: "", condicoes: ""},
    conf: {}, // ids de sugestões do Claude já conferidas
  };
}
const setD = (A, line, pk, v, o) => { (A.dem[line] ||= {})[pk] = {v, o}; };

// Premissas da projeção derivadas do histórico (cada uma diz de onde veio)
function defaultPrem(A) {
  const per = ["y2", "y1", "y0"].map(k => colValues(A, k)), L = ltm(A);
  const r = per.map(p => p.receita).filter(x => x > 0);
  const g = r.length >= 2 ? Math.pow(r[r.length - 1] / r[0], 1 / (r.length - 1)) - 1 : .05;
  const mg = L.receita ? L.ebitda / L.receita : .12;
  const da = L.receita ? L.da / L.receita : .03;
  const cx = mean(per.map(p => p.receita ? p.capex / p.receita : NaN)); const dias = L.receita ? L.giro / L.receita * 365 : 60;
  const avgDebt = (colValues(A, "y0").divbruta + L.divbruta) / 2, cdiL = .14;
  const spEx = avgDebt > 0 ? clamp(L.juros / avgDebt - cdiL, -.02, .1) : .03;
  const Q = Math.min(+A.op.quitar || 0, L.divbruta), exist = Math.max(0, L.divbruta - Q), y1 = Math.min(exist, Math.max(0, L.divcp - Q));
  const rest = Math.max(0, exist - y1) / 5; // dívida de longo prazo vencendo em 5 anos, em partes iguais
  const yb = A.emp.anoBase, txt = `${yb - 2}–${yb}`;
  const P = {g: Array(NY).fill(+g.toFixed(4)), mg: Array(NY).fill(+mg.toFixed(4)), da: Array(NY).fill(+da.toFixed(4)), capex: Array(NY).fill(nn(cx) ? +cx.toFixed(4) : .03), dias: Array(NY).fill(Math.round(dias)),
    ir: Array(NY).fill(.34), payout: Array(NY).fill(.25), spExist: Array(NY).fill(+spEx.toFixed(4)), amExist: [y1, ...Array(NY - 1).fill(rest)].map(Math.round), refin: Array(NY).fill(.5), rendCx: Array(NY).fill(.9)};
  const PO = {g: O("calc", `crescimento médio anual da receita em ${txt}`), mg: O("calc", `margem EBITDA dos ${L._src}`), da: O("calc", `depreciação ÷ receita dos ${L._src}`), capex: O("calc", `capex ÷ receita, média de ${txt}`), dias: O("calc", `capital de giro ÷ receita × 365 nos ${L._src}`),
    ir: O("prem", "alíquota nominal de IR + CSLL no lucro real (25% + 9%)"), payout: O("prem", "25%: mínimo legal das S.A. (Lei 6.404, art. 202); Ltda. não tem mínimo"), spExist: O("calc", `juros ÷ dívida média menos CDI de cerca de 14% nos ${L._src}`),
    amExist: O("calc", "1º ano = dívida de curto prazo menos o que a operação quita; o longo prazo vence em 5 partes iguais. Troque pelo cronograma real de vencimentos"), refin: O("prem", "metade dos vencimentos da dívida existente é rolada com o mesmo banco"), rendCx: O("prem", "caixa aplicado a 90% do CDI")};
  return {P, PO};
}
function ensurePrem(A) { if (!A.prem) { const d = defaultPrem(A); A.prem = d.P; A.premO = d.PO; } }

// ---------- Empresa fictícia de exemplo ----------
function exampleAnalysis() {
  const A = blankAnalysis(), E = O("ex", "empresa fictícia de exemplo");
  Object.assign(A.emp, {nome: "Indústria Exemplo Ltda. (fictícia)", cnpj: "00.000.000/0001-00", setor: "Embalagens plásticas", grupo: "Holding Exemplo S.A.", auditoria: "dois", hist: "limpo", conc: .22, concO: O("ex", "maior cliente = 22% da receita (exemplo)")});
  const D = { // y2, y1, y0, p0, p1
    receita: [147500, 158200, 171900, 126500, 134700], ebit: [14300, 16000, 18100, 13300, 13300], da: [5500, 6100, 6500, 4700, 5000],
    juros: [4300, 5000, 5600, 4200, 4500], recfin: [1300, 1100, 900, 700, 500], ir: [2400, 2600, 2900, 2200, 2000], lucro: [8300, 8800, 9500, 6900, 6800],
    caixa: [9400, 9800, 8900, 8300, 7600], receber: [24000, 26300, 28900, 29800, 31600], estoques: [16800, 18200, 19700, 20500, 21900], fornec: [14100, 15300, 16100, 16400, 17000],
    divcp: [9800, 10600, 11200, 11000, 12400], divlp: [22100, 24400, 27800, 26900, 29500], ativo: [118000, 126500, 137800, 136900, 144100], passivo: [55000, 59400, 64200, 62800, 68400], pl: [63000, 67100, 73600, 74100, 75700],
    fco: [13600, 14900, 13200, 10700, 8900], capex: [4600, 5100, 5600, 3900, 4200], divid: [1800, 2000, 2200, 1500, 4300]};
  const ks = ["y2", "y1", "y0", "p0", "p1"];
  Object.entries(D).forEach(([l, a]) => a.forEach((v, i) => setD(A, l, ks[i], v, E)));
  A.op = {...A.op, valor: 15000, quitar: 8000, prazo: 60, destino: "Alongar dívida de curto prazo", pessoais: "Aval dos 2 sócios · fiança da holding", spread: .038};
  A.gar = [
    {id: uid(), tipo: "imovel", desc: "Galpão industrial (exemplo)", valor: 16000, o: E, ...pickG("imovel")},
    {id: uid(), tipo: "recebiveis", desc: "Trava de 30% do faturamento (exemplo)", valor: 7500, o: E, ...pickG("recebiveis")},
    {id: uid(), tipo: "maquinas", desc: "2 extrusoras (exemplo)", valor: 5000, o: E, ...pickG("maquinas")}];
  A.credores = [
    {id: uid(), nome: "Banco de fomento (exemplo)", saldo: 16000, real: true, o: E}, {id: uid(), nome: "Banco A (exemplo)", saldo: 6000, real: true, o: E},
    {id: uid(), nome: "Banco B, sem garantia (exemplo)", saldo: 6900, real: false, o: E}, {id: uid(), nome: "Mútuo de sócios (exemplo)", saldo: 5000, real: false, o: E}];
  ensurePrem(A);
  A.cens = [mkTemplate(A, "perda_cliente"), mkTemplate(A, "alta_insumo"), mkTemplate(A, "cdi_alto"), mkTemplate(A, "nao_rola")];
  A.cens[0].prob = 35; A.cens[0].forma = "tardio"; A.cens[0].probJust = "Exemplo: contrato do maior cliente vence no próximo ano e ele já cotou outro fornecedor.";
  return A;
}
const pickG = t => ({h: GTIPOS[t].h, c: GTIPOS[t].c, m: GTIPOS[t].m, q: GTIPOS[t].q, ho: O("prem", GTIPOS[t].why.h)});

// ---------- Catálogo de cenários genéricos ----------
// Cada modelo monta uma árvore a partir das demonstrações (nós "calc" apontam para a linha de origem).
function N(id, nome, pai, tipo, base, cen, extra = {}) { return {id, nome, pai, tipo, base, cen, unid: "", formula: "", o: O("prem", ""), ...extra}; }
const TEMPLATES = {
  cdi_alto: {cat: "Macro", nome: "CDI 2 p.p. acima do previsto", prob: 25, forma: "imediato", como: "Toda dívida pós-fixada fica mais cara, incluindo esta operação.", gatilho: "Focus subir a Selic esperada para o ano seguinte em mais de 1 p.p.",
    build: (A, L) => [{titulo: "Juros a mais na dívida pós-fixada", linha: "juros", nos: [
      N("juros_extra", "Juros a mais", null, "formula", 0, 0, {formula: "divida_pos * cdi_extra / 100", unid: "R$ mil"}),
      N("divida_pos", "Dívida pós-fixada", "juros_extra", "formula", 0, 0, {formula: "divida_total * parcela_pos", unid: "R$ mil"}),
      N("divida_total", "Dívida bruta pro forma", "divida_pos", "entrada", L.divbruta - (+A.op.quitar || 0) + (+A.op.valor || 0), L.divbruta - (+A.op.quitar || 0) + (+A.op.valor || 0), {unid: "R$ mil", o: O("calc", "dívida bruta dos últimos 12 meses − valor quitado + esta operação")}),
      N("parcela_pos", "Parcela pós-fixada", "divida_pos", "entrada", .8, .8, {unid: "fração", o: O("prem", "80%: típico de empresa média que capta em CDI; confira o mapa de dívidas")}),
      N("cdi_extra", "CDI acima do previsto", "juros_extra", "entrada", 0, 2, {unid: "p.p.", o: O("prem", "choque de estresse")})]}]},
  ipca_alto: {cat: "Macro", nome: "Inflação de custos 3 p.p. acima, com metade repassada", prob: 30, forma: "gradual", como: "Custos sobem antes do reajuste de preço: a margem aperta.", gatilho: "IPCA de 12 meses acima do teto da meta por 3 meses seguidos.",
    build: (A, L) => [{titulo: "Custo a mais sem repasse", linha: "custos", nos: [
      N("custo_extra", "Custo a mais", null, "formula", 0, 0, {formula: "custos * inflacao_extra / 100 * (1 - repasse)", unid: "R$ mil"}),
      N("custos", "Custos caixa", "custo_extra", "entrada", L.receita - L.ebitda, L.receita - L.ebitda, {unid: "R$ mil", o: O("calc", "receita − EBITDA dos últimos 12 meses")}),
      N("inflacao_extra", "Inflação de custos acima do previsto", "custo_extra", "entrada", 0, 3, {unid: "p.p.", o: O("prem", "choque de estresse")}),
      N("repasse", "Parcela repassada ao preço", "custo_extra", "entrada", .5, .5, {unid: "fração", o: O("prem", "metade repassada; ajuste pelo poder de preço da empresa")})]}]},
  cambio: {cat: "Macro", nome: "Dólar 20% mais caro", prob: 25, forma: "gradual", como: "Insumos em dólar encarecem.", gatilho: "Dólar 15% acima do nível da análise.",
    build: (A, L) => [{titulo: "Custo dolarizado", linha: "custos", nos: [
      N("custo_extra", "Custo a mais", null, "formula", 0, 0, {formula: "custos * parcela_usd * alta / 100 * (1 - repasse)", unid: "R$ mil"}),
      N("custos", "Custos caixa", "custo_extra", "entrada", L.receita - L.ebitda, L.receita - L.ebitda, {unid: "R$ mil", o: O("calc", "receita − EBITDA dos últimos 12 meses")}),
      N("parcela_usd", "Custos atrelados ao dólar", "custo_extra", "entrada", .2, .2, {unid: "fração", o: O("prem", "informe a parcela real com a empresa")}),
      N("alta", "Alta do dólar", "custo_extra", "entrada", 0, 20, {unid: "%", o: O("prem", "choque de estresse")}),
      N("repasse", "Parcela repassada", "custo_extra", "entrada", .3, .3, {unid: "fração", o: O("prem", "repasse parcial")})]}]},
  pib_fraco: {cat: "Macro", nome: "Atividade fraca: PIB 2 p.p. abaixo", prob: 25, forma: "recupera", como: "Clientes compram menos; custo fixo pesa mais.", gatilho: "Produção industrial em queda por 2 trimestres.",
    build: (A, L) => [{titulo: "Receita perdida com a atividade", linha: "receita", vcr: .6, nos: [
      N("receita", "Receita", null, "formula", 0, 0, {formula: "receita_hoje * (1 + elasticidade * pib / 100)", unid: "R$ mil"}),
      N("receita_hoje", "Receita de hoje", "receita", "entrada", L.receita, L.receita, {unid: "R$ mil", o: O("calc", "receita dos últimos 12 meses")}),
      N("elasticidade", "Sensibilidade do volume ao PIB", "receita", "entrada", 1.5, 1.5, {unid: "x", o: O("prem", "1,5x: setor industrial cíclico; ajuste ao setor")}),
      N("pib", "Desvio do PIB", "receita", "entrada", 0, -2, {unid: "p.p.", o: O("prem", "choque de estresse")})]}]},
  credito_escasso: {cat: "Macro", nome: "Crédito bancário escasso", prob: 20, forma: "umano", como: "Bancos rolam só parte do que vence.", gatilho: "Concessões de capital de giro em queda no Banco Central.",
    build: (A, L) => [{titulo: "Vencimentos não rolados", linha: "saidas", nos: [
      N("saida", "Caixa usado para pagar", null, "formula", 0, 0, {formula: "vence * nao_rolado", unid: "R$ mil"}),
      N("vence", "Dívida que vence em 12 meses", "saida", "entrada", L.divcp, L.divcp, {unid: "R$ mil", o: O("calc", "dívida de curto prazo da última data")}),
      N("nao_rolado", "Parcela não rolada", "saida", "entrada", 0, .4, {unid: "fração", o: O("prem", "choque de estresse")})]}]},
  reforma: {cat: "Macro", nome: "Reforma tributária sem repasse", prob: 30, forma: "gradual", como: "CBS e IBS mudam a carga; parte não é repassada.", gatilho: "Alíquotas de referência publicadas acima do esperado.",
    build: (A, L) => [{titulo: "Carga extra sobre a receita", linha: "custos", nos: [
      N("custo_extra", "Tributo a mais", null, "formula", 0, 0, {formula: "receita * carga / 100", unid: "R$ mil"}),
      N("receita", "Receita", "custo_extra", "entrada", L.receita, L.receita, {unid: "R$ mil", o: O("calc", "receita dos últimos 12 meses")}),
      N("carga", "Carga extra não repassada", "custo_extra", "entrada", 0, 1, {unid: "p.p. da receita", o: O("prem", "choque de estresse")})]}]},
  perda_cliente: {cat: "Micro", nome: "Perda do maior cliente", prob: 25, forma: "gradual", como: "A receita cai e parte do custo é fixa.", gatilho: "Pedidos do maior cliente abaixo de 70% da média por 2 meses.",
    build: (A, L) => [{titulo: "Receita do maior cliente", linha: "receita", vcr: .65, nos: [
      N("receita", "Receita", null, "formula", 0, 0, {formula: "outros + cliente", unid: "R$ mil"}),
      N("cliente", "Receita do maior cliente", "receita", "formula", 0, 0, {formula: "receita_hoje * participacao * fica", unid: "R$ mil"}),
      N("receita_hoje", "Receita de hoje", "cliente", "entrada", L.receita, L.receita, {unid: "R$ mil", o: O("calc", "receita dos últimos 12 meses")}),
      N("participacao", "Participação do maior cliente", "cliente", "entrada", A.emp.conc, A.emp.conc, {unid: "fração", o: A.emp.concO}),
      N("fica", "Volume que fica", "cliente", "entrada", 1, .2, {unid: "fração", o: O("prem", "cliente sai e deixa 20%")}),
      N("outros", "Demais clientes", "receita", "formula", 0, 0, {formula: "receita_hoje * (1 - participacao) * (1 + recoloca * participacao * (1 - fica) / (1 - participacao))", unid: "R$ mil"}),
      N("recoloca", "Volume perdido que é recolocado", "outros", "entrada", 0, .3, {unid: "fração", o: O("prem", "30% recolocado em outros clientes")})]}]},
  calote: {cat: "Micro", nome: "Calote de clientes", prob: 25, forma: "umano", como: "Clientes atrasam ou não pagam.", gatilho: "Atraso acima de 60 dias na carteira cedida.",
    build: (A, L) => [{titulo: "Perda com clientes", linha: "custos", nos: [
      N("perda", "Perda com clientes", null, "formula", 0, 0, {formula: "receber * perda_extra", unid: "R$ mil"}),
      N("receber", "Contas a receber", "perda", "entrada", L.receber, L.receber, {unid: "R$ mil", o: O("calc", "contas a receber da última data")}),
      N("perda_extra", "Perda adicional", "perda", "entrada", 0, .05, {unid: "fração", o: O("prem", "choque de estresse")})]}]},
  alta_insumo: {cat: "Micro", nome: "Principal insumo 20% mais caro, 30% repassado", prob: 40, forma: "recupera", como: "A margem aperta até o reajuste de preço.", gatilho: "Preço do insumo 15% acima do nível da análise.",
    build: (A, L) => [{titulo: "Custo do insumo", linha: "custos", nos: [
      N("custo_extra", "Custo a mais", null, "formula", 0, 0, {formula: "custos * peso * alta / 100 * (1 - repasse)", unid: "R$ mil"}),
      N("custos", "Custos caixa", "custo_extra", "entrada", L.receita - L.ebitda, L.receita - L.ebitda, {unid: "R$ mil", o: O("calc", "receita − EBITDA dos últimos 12 meses")}),
      N("peso", "Peso do insumo nos custos", "custo_extra", "entrada", .4, .4, {unid: "fração", o: O("prem", "informe com a empresa")}),
      N("alta", "Alta do insumo", "custo_extra", "entrada", 0, 20, {unid: "%", o: O("prem", "choque de estresse")}),
      N("repasse", "Parcela repassada", "custo_extra", "entrada", .3, .3, {unid: "fração", o: O("prem", "repasse parcial")})]}]},
  fornecedor: {cat: "Micro", nome: "Quebra de fornecedor crítico", prob: 10, forma: "umano", como: "Produção para por falta de insumo.", gatilho: "Fornecedor único em recuperação judicial.",
    build: (A, L) => [{titulo: "Receita perdida na parada", linha: "receita", vcr: .5, nos: [
      N("receita", "Receita", null, "formula", 0, 0, {formula: "receita_hoje * (1 - meses / 12 * afetada)", unid: "R$ mil"}),
      N("receita_hoje", "Receita de hoje", "receita", "entrada", L.receita, L.receita, {unid: "R$ mil", o: O("calc", "receita dos últimos 12 meses")}),
      N("meses", "Meses de parada", "receita", "entrada", 0, 1, {unid: "meses", o: O("prem", "choque de estresse")}),
      N("afetada", "Parte da produção afetada", "receita", "entrada", .5, .5, {unid: "fração", o: O("prem", "metade das linhas")})]}]},
  sinistro: {cat: "Micro", nome: "Sinistro na fábrica", prob: 5, forma: "umano", como: "Incêndio ou quebra para a produção; seguro cobre só parte.", gatilho: "Apólice vencida ou sem cobertura de lucros cessantes.",
    build: (A, L) => [{titulo: "Receita perdida", linha: "receita", vcr: .5, nos: [
      N("receita", "Receita", null, "formula", 0, 0, {formula: "receita_hoje * (1 - meses / 12 * (1 - seguro))", unid: "R$ mil"}),
      N("receita_hoje", "Receita de hoje", "receita", "entrada", L.receita, L.receita, {unid: "R$ mil", o: O("calc", "receita dos últimos 12 meses")}),
      N("meses", "Meses parados", "receita", "entrada", 0, 2, {unid: "meses", o: O("prem", "choque de estresse")}),
      N("seguro", "Parte coberta por lucros cessantes", "receita", "entrada", 0, 0, {unid: "fração", o: O("prem", "confira a apólice")})]},
      {titulo: "Reconstrução", linha: "capex", nos: [N("rec", "Capex de reconstrução", null, "entrada", 0, Math.round(L.capex * .5), {unid: "R$ mil", o: O("prem", "metade do capex anual")})]}]},
  socio: {cat: "Micro", nome: "Saída de sócio-chave", prob: 10, forma: "recupera", como: "Relacionamento comercial depende do sócio.", gatilho: "Disputa societária ou problema de saúde do sócio.",
    build: (A, L) => [{titulo: "Receita ligada ao sócio", linha: "receita", vcr: .6, nos: [
      N("receita", "Receita", null, "formula", 0, 0, {formula: "receita_hoje * (1 - perda)", unid: "R$ mil"}),
      N("receita_hoje", "Receita de hoje", "receita", "entrada", L.receita, L.receita, {unid: "R$ mil", o: O("calc", "receita dos últimos 12 meses")}),
      N("perda", "Receita perdida", "receita", "entrada", 0, .05, {unid: "fração", o: O("prem", "choque de estresse")})]}]},
  contingencia: {cat: "Micro", nome: "Contingência trabalhista ou fiscal", prob: 15, forma: "umano", como: "Processo perdido vira saída de caixa.", gatilho: "Decisão desfavorável em segunda instância.",
    build: (A, L) => [{titulo: "Pagamento da contingência", linha: "saidas", nos: [N("pag", "Valor pago", null, "entrada", 0, Math.round(L.receita * .02), {unid: "R$ mil", o: O("prem", "2% da receita; troque pelo valor das notas explicativas (contingências possíveis)")})]}]},
  nao_rola: {cat: "Micro", nome: "Um banco não rola a linha", prob: 20, forma: "umano", como: "A empresa precisa pagar com caixa.", gatilho: "Banco reduz limite ou pede reforço de garantia.",
    build: (A, L) => [{titulo: "Linha não renovada", linha: "saidas", nos: [N("pag", "Valor a pagar", null, "entrada", 0, Math.round(L.divcp * .35), {unid: "R$ mil", o: O("prem", "35% da dívida de curto prazo; troque pelo valor da linha")})]}]},
  dividendos: {cat: "Micro", nome: "Sócios retiram dividendos extras", prob: 15, forma: "umano", como: "Conflito clássico entre sócio e credor.", gatilho: "Distribuição acima do limite da cláusula.",
    build: (A, L) => [{titulo: "Retirada extra", linha: "dividendos", nos: [N("div", "Dividendos extras", null, "entrada", 0, Math.round(L.ebitda * .2), {unid: "R$ mil", o: O("prem", "20% do EBITDA")})]}]},
};
function mkTemplate(A, key) {
  const T = TEMPLATES[key], L = ltm(A);
  const trees = T.build(A, L).map(t => ({id: uid(), ativo: true, vcr: .6, ...t, vcrO: O("prem", "parte da receita perdida que deixa de ser custo (custo variável ÷ receita)")}));
  return {id: uid(), tpl: key, ativo: true, nome: T.nome, cat: T.cat, prob: T.prob, probO: O("prem", "chance inicial do catálogo: ajuste com a sua leitura"), probJust: "", forma: T.forma, ramp: [...FORMAS[T.forma].r], trees, como: T.como, gatilho: T.gatilho, mitigante: "", origem: "catálogo"};
}
