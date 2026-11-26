// =====================================================================
// RELATÓRIO DE CRÉDITO · motor de cálculo
// Dados: CVM já tratados (DFP 2020–2025, ITR 3T26, últimos 12 meses),
// em R$ milhões. Valores nominais, sem desconto a valor presente.
// Toda célula carrega a origem: {t: tipo, f: texto, doc, link, fx}.
// =====================================================================
"use strict";
const nn = v => typeof v === "number" && isFinite(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sum = a => a.reduce((s, x) => s + (nn(x) ? x : 0), 0);
const median = a => { const b = a.filter(nn).sort((x, y) => x - y); if (!b.length) return NaN; const m = b.length / 2; return b.length % 2 ? b[Math.floor(m)] : (b[m - 1] + b[m]) / 2; };
const uid = () => Math.random().toString(36).slice(2, 9);
const deep = o => JSON.parse(JSON.stringify(o));
const NP = 3; // anos projetados

// ---------- Tipos de origem (as 4 etiquetas pedidas) ----------
const ORIG = {
  rep: {nome: "Reportado", cls: "o-rep", txt: "valor das demonstrações entregues à CVM"},
  calc: {nome: "Cálculo", cls: "o-calc", txt: "fórmula sobre outros números da análise"},
  prem: {nome: "Premissa", cls: "o-prem", txt: "escolha do analista, editável"},
  claude: {nome: "Sugestão do Claude", cls: "o-claude", txt: "sugerido pelo Claude, a conferir"},
  ofi: {nome: "Oficial", cls: "o-ofi", txt: "dado público de fonte oficial (Banco Central, ANBIMA, IBGE)"},
};

// ---------- Contextos da análise e categorias de cenário ----------
const CTX = {
  macro: {nome: "Macroeconomia", en: "Macroeconomics", txt: "juros, inflação, câmbio, atividade"},
  merc: {nome: "Mercadológico", en: "Market and industry", txt: "a microeconomia do setor: preços, custos, demanda, concorrência"},
  jur: {nome: "Jurídico e regulatório", en: "Legal and regulatory", txt: "contratos, covenants, processos, regulação do setor"},
  fisc: {nome: "Fiscal", en: "Tax", txt: "impostos, créditos tributários, reforma tributária"},
  fin: {nome: "Financeiro", en: "Financial", txt: "resultado, caixa, dívida, liquidez"},
  div: {nome: "Estrutura da dívida", en: "Debt structure", txt: "vencimentos, refinanciamento, indexadores, garantias"},
  gen: {nome: "Fatores genéricos", en: "General factors", txt: "governança, concentração, clima, eventos que valem para qualquer companhia"},
};
const CTX_ANALISE = ["macro", "merc", "jur", "fisc", "fin", "gen"]; // caixas de texto
const MARCAS = {nao: "Não incluir", sim: "Incluir assim", ameniza: "Amenizar", enfase: "Dar ênfase"};

// ---------- Linhas da tabela de números ----------
// src: chave em co.F (fluxos e saldos em R$ mi) | r: chave em co.R (ratios) | q: conta da DRE trimestral (R$ mil)
// kind: flow (soma no período) | stock (saldo na data) | ratio
const ROWS = [
  {g: "Resultado", id: "receita", pt: "Receita líquida", en: "Net revenue", src: "receita", q: "3.01", kind: "flow", tag: "rep", conta: "DRE 3.01 Receita de venda de bens e/ou serviços"},
  {g: "Resultado", id: "ebitda", pt: "Lucro antes de juros, impostos, depreciação e amortização", en: "EBITDA", src: "ebitda", kind: "flow", tag: "calc", fx: ["Lucro operacional", "+ Depreciação e amortização"], fxen: "Operating income + Depreciation and amortization"},
  {g: "Resultado", id: "mg_ebitda", pt: "Margem do lucro antes de juros, impostos, depreciação e amortização", en: "EBITDA margin", r: "mg_ebitda", kind: "ratio", unid: "%", fx: ["Lucro antes de juros, impostos, depreciação e amortização", "÷ Receita líquida"], fxen: "EBITDA ÷ Net revenue"},
  {g: "Resultado", id: "ebit", pt: "Lucro operacional", en: "Operating income (EBIT)", src: "ebit", q: "3.05", kind: "flow", tag: "rep", conta: "DRE 3.05 Resultado antes do resultado financeiro e dos tributos"},
  {g: "Resultado", id: "desp_fin", pt: "Despesa financeira", en: "Financial expense", src: "desp_fin", kind: "flow", tag: "rep", conta: "DRE 3.06.02 Despesas financeiras (sinal invertido)"},
  {g: "Resultado", id: "lucro", pt: "Lucro líquido", en: "Net income", src: "lucro", q: "3.11", kind: "flow", tag: "rep", conta: "DRE 3.11 Lucro ou prejuízo consolidado do período"},
  {g: "Dívida e caixa", id: "caixa", pt: "Caixa e aplicações", en: "Cash and equivalents", src: "caixa_total", kind: "stock", tag: "rep", conta: "BPA 1.01.01 Caixa e equivalentes + 1.01.02 Aplicações financeiras"},
  {g: "Dívida e caixa", id: "div_bruta", pt: "Dívida bruta", en: "Gross debt", src: "div_bruta", kind: "stock", tag: "calc", fx: ["Empréstimos e financiamentos de curto prazo", "+ Empréstimos e financiamentos de longo prazo"], fxen: "Short-term debt + Long-term debt", conta: "BPP 2.01.04 + 2.02.01 (inclui debêntures)"},
  {g: "Dívida e caixa", id: "div_cp", pt: "Dívida de curto prazo", en: "Short-term debt", src: "div_cp", kind: "stock", tag: "rep", conta: "BPP 2.01.04 Empréstimos e financiamentos (circulante)"},
  {g: "Dívida e caixa", id: "div_liq", pt: "Dívida líquida", en: "Net debt", src: "div_liq", kind: "stock", tag: "calc", fx: ["Dívida bruta", "− Caixa e aplicações"], fxen: "Gross debt − Cash and equivalents"},
  {g: "Dívida e caixa", id: "pl", pt: "Patrimônio líquido", en: "Shareholders' equity", src: "pl", kind: "stock", tag: "rep", conta: "BPP 2.03 Patrimônio líquido consolidado"},
  {g: "Fluxo de caixa", id: "fco", pt: "Caixa das operações", en: "Operating cash flow", src: "fco", kind: "flow", tag: "rep", conta: "DFC 6.01 Caixa líquido das atividades operacionais"},
  {g: "Fluxo de caixa", id: "capex", pt: "Investimentos em imobilizado e intangível", en: "Capital expenditures", src: "capex", kind: "flow", tag: "rep", conta: "DFC, aquisições de imobilizado e intangível (sinal invertido)"},
  {g: "Fluxo de caixa", id: "fcf", pt: "Fluxo de caixa livre", en: "Free cash flow", src: "fcf", kind: "flow", tag: "calc", fx: ["Caixa das operações", "− Investimentos em imobilizado e intangível"], fxen: "Operating cash flow − Capital expenditures"},
  {g: "Ratios de crédito", id: "dl_ebitda", pt: "Alavancagem", en: "Net debt to EBITDA", r: "dl_ebitda", kind: "ratio", unid: "x", fx: ["Dívida líquida", "÷ Lucro antes de juros, impostos, depreciação e amortização"], fxen: "Net debt ÷ EBITDA", bom: "down"},
  {g: "Ratios de crédito", id: "db_ebitda", pt: "Alavancagem bruta", en: "Gross debt to EBITDA", r: "db_ebitda", kind: "ratio", unid: "x", fx: ["Dívida bruta", "÷ Lucro antes de juros, impostos, depreciação e amortização"], fxen: "Gross debt ÷ EBITDA", bom: "down"},
  {g: "Ratios de crédito", id: "ebitda_desp", pt: "Cobertura de juros", en: "Interest coverage (EBITDA to financial expense)", r: "ebitda_desp", kind: "ratio", unid: "x", fx: ["Lucro antes de juros, impostos, depreciação e amortização", "÷ Despesa financeira sem variação cambial"], fxen: "EBITDA ÷ Financial expense", bom: "up"},
  {g: "Ratios de crédito", id: "caixa_divcp", pt: "Caixa sobre dívida de curto prazo", en: "Cash to short-term debt", r: "caixa_divcp", kind: "ratio", unid: "x", fx: ["Caixa e aplicações", "÷ Dívida de curto prazo"], fxen: "Cash ÷ Short-term debt", bom: "up"},
  {g: "Ratios de crédito", id: "divcp_total", pt: "Parcela da dívida que vence em 12 meses", en: "Short-term debt share", r: "divcp_total", kind: "ratio", unid: "%", fx: ["Dívida de curto prazo", "÷ Dívida bruta"], fxen: "Short-term debt ÷ Gross debt", bom: "down"},
  {g: "Ratios de crédito", id: "liq_corrente", pt: "Liquidez corrente", en: "Current ratio", r: "liq_corrente", kind: "ratio", unid: "x", fx: ["Ativo circulante", "÷ Passivo circulante"], fxen: "Current assets ÷ Current liabilities", bom: "up"},
  {g: "Ratios de crédito", id: "fco_div", pt: "Caixa das operações sobre dívida bruta", en: "Operating cash flow to debt", r: "fco_div", kind: "ratio", unid: "%", fx: ["Caixa das operações", "÷ Dívida bruta"], fxen: "Operating cash flow ÷ Gross debt", bom: "up"},
  {g: "Ratios de crédito", id: "gearing", pt: "Peso da dívida no capital", en: "Debt to capital", r: "gearing", kind: "ratio", unid: "%", fx: ["Dívida bruta", "÷ (Dívida bruta + Patrimônio líquido)"], fxen: "Gross debt ÷ (Gross debt + Equity)", bom: "down"},
];
const RBY = Object.fromEntries(ROWS.map(r => [r.id, r]));

// ---------- Colunas: N anos fechados + 9M anterior + 9M atual + 12 meses ----------
function columns(co, nAnos) {
  const per = co.periodos, ltmK = per[per.length - 1], anos = per.slice(0, -1).slice(-nAnos);
  const q = co.q || {}, qq = q.q || "3T26", yy = +(q.ref || "2026").slice(0, 4);
  const nq = +(qq[0]) || 3, lab = `${nq * 3}M`;
  const cols = anos.map(a => ({k: a, lab: a, tipo: "ano", idx: per.indexOf(a)}));
  if (q.acum) {
    cols.push({k: "q_ant", lab: `${lab}${String(yy - 1).slice(2)}`, tipo: "parc", ant: true});
    cols.push({k: "q_at", lab: `${lab}${String(yy).slice(2)}`, tipo: "parc"});
    if (q.tri) { cols.push({k: "t_ant", lab: `${qq.slice(0, 2)}${String(yy - 1).slice(2)}`, tipo: "parc", ant: true, tri: true}); cols.push({k: "t_at", lab: `${qq.slice(0, 2)}${String(yy).slice(2)}`, tipo: "parc", tri: true}); }
  }
  cols.push({k: ltmK, lab: "12 meses", sub: ltmK.replace("LTM ", "até "), tipo: "ltm", idx: per.length - 1});
  return cols;
}

// Companhias dos EUA (SEC EDGAR, XBRL): a origem mostra o conceito XBRL usado
const XB = {receita: ["receita"], ebit: ["ebit"], ebitda: ["ebit", "da"], desp_fin: ["juros"], lucro: ["lucro"], caixa_total: ["caixa", "aplic"], div_bruta: ["dcp", "cp2", "dlp"], div_cp: ["dcp", "cp2"], div_liq: ["dcp", "cp2", "dlp", "caixa", "aplic"], pl: ["pl"], fco: ["fco"], capex: ["capex"], fcf: ["fco", "capex"]};
function cell(co, row, col) {
  const r = cell0(co, row, col);
  if (co.semConf && r.o) { const tg = (XB[row.src] || []).map(k => co.tags?.[k]).filter(Boolean); r.o = {...r.o, t: r.o.t === "rep" ? "rep" : "calc", f: `${tg.length ? "Conceitos XBRL da SEC: " + tg.join(" + ") + ". " : ""}${row.fx ? "" : ""}Ainda sem conferência contra o 10-K.${co.obs?.length ? " Observações: " + co.obs.join("; ") + "." : ""}`, conta: null}; }
  return r;
}
function cell0(co, row, col) {
  const src = co.src || {};
  const docOf = k => src[k] ? {doc: src[k].doc, link: src[k].link, entregue: src[k].entregue, ref: src[k].ref} : {};
  if (col.tipo === "parc") {
    const q = co.q, acc = col.tri ? (col.ant ? q.tri_ant : q.tri) : (col.ant ? q.acum_ant : q.acum);
    if (row.kind === "flow" && row.q && acc && nn(acc[row.q])) {
      return {v: acc[row.q] / 1000, o: {t: col.tri ? "calc" : "rep", f: col.tri ? `${row.conta}, só o trimestre ${col.lab} (acumulado até o trimestre menos o acumulado até o trimestre anterior)` : `${row.conta}, acumulado de ${col.lab}`, ...docOf(co.periodos[co.periodos.length - 1]), nota: col.ant ? "Comparativo do ano anterior que vem no mesmo ITR." : ""}};
    }
    if (row.kind === "stock" && !col.ant) { const k = co.periodos[co.periodos.length - 1], v = co.F[row.src]?.[co.periodos.length - 1];
      return nn(v) ? {v, o: {t: row.tag, f: (row.conta || "") + ", saldo na data do ITR", fx: row.fx, fxen: row.fxen, ...docOf(k)}} : {v: null, o: null}; }
    if (row.kind === "ratio" && !col.ant) return cell(co, row, {...col, tipo: "ltm", idx: co.periodos.length - 1});
    return {v: null, o: {t: "calc", f: row.kind === "stock" ? "O saldo do balanço de um ano antes não está no arquivo trimestral tratado." : "O arquivo trimestral tratado traz só a demonstração do resultado; esta linha precisa de outras contas.", vazio: true}};
  }
  const i = col.idx, k = co.periodos[i];
  if (row.r) {
    const v = co.R[row.r]?.[i];
    return {v: nn(v) ? v : null, o: {t: "calc", fx: row.fx, fxen: row.fxen, f: `Calculado sobre as demonstrações de ${k}.`, ...docOf(k)}};
  }
  const v = co.F[row.src]?.[i];
  const isLtm = col.tipo === "ltm";
  const f = isLtm && row.kind === "flow" ? `Últimos 12 meses = ano de ${co.periodos[i - 1]} + acumulado do ano atual − acumulado do mesmo período do ano anterior.` : (row.conta || "");
  return {v: nn(v) ? v : null, o: {t: isLtm && row.kind === "flow" ? "calc" : row.tag, f, conta: row.conta, fx: row.fx, fxen: row.fxen, ...docOf(k)}};
}

// ---------- Premissas da projeção (por ano) ----------
const PREM = {
  g: {pt: "Crescimento da receita", en: "Revenue growth", unid: "%"},
  mg: {pt: "Margem do lucro antes de juros, impostos, depreciação e amortização", en: "EBITDA margin", unid: "%"},
  da: {pt: "Depreciação e amortização sobre receita", en: "D&A to revenue", unid: "%"},
  kd: {pt: "Custo da dívida", en: "Cost of debt", unid: "%"},
  capex: {pt: "Investimentos sobre receita", en: "Capex to revenue", unid: "%"},
  outros: {pt: "Outras saídas operacionais sobre receita (capital de giro, frota)", en: "Other operating cash outflows to revenue", unid: "%"},
  ir: {pt: "Imposto de renda e contribuição social", en: "Income tax rate", unid: "%"},
  payout: {pt: "Dividendos sobre lucro", en: "Payout ratio", unid: "%"},
};
function premDefaults(co) {
  const F = co.F, L = co.periodos.length - 1, at = (k, i = L) => F[k]?.[i];
  const anos = co.periodos.slice(0, -1).map((_, i) => i);
  const gr = anos.slice(1).map(i => at("receita", i) / at("receita", i - 1) - 1).filter(nn).slice(-3);
  const g = clamp(nn(median(gr)) ? median(gr) : 0.05, -0.1, 0.12);
  const mg = at("ebitda") / at("receita"), da = at("da") / at("receita"), capex = at("capex") / at("receita");
  const kd = at("desp_fin") / ((at("div_bruta") + (at("div_bruta", L - 1) || at("div_bruta"))) / 2);
  const pays = (co.R.payout || []).slice(0, L).filter(nn).slice(-3);
  const payout = at("lucro") > 0 ? clamp(at("dividendos") / at("lucro"), 0, 1) : clamp(nn(median(pays)) ? median(pays) : 0.25, 0, 1);
  // Outras saídas operacionais: o que separa o EBITDA do caixa das operações, fora juros pagos e imposto (capital de giro, compra de frota etc.)
  const dre = (co.st?.DRE || []).find(r => r[0] === "3.08");
  const ou = anos.slice(-3).map(i => { const ir = dre ? -(dre[2][i] || 0) / 1000 : 0; return (at("ebitda", i) - at("fco", i) - (at("juros_pagos", i) || 0) - Math.max(0, ir)) / at("receita", i); }).filter(nn);
  const outros = clamp(nn(median(ou)) ? median(ou) : 0, -0.05, 0.3);
  const mk = (v, f) => ({v: Array(NP).fill(nn(v) ? v : 0), o: {t: "calc", f}});
  return {
    g: mk(g, `Mediana do crescimento anual da receita nos últimos ${gr.length} anos (${gr.map(x => (x * 100).toFixed(1).replace(".", ",") + "%").join("; ")}), limitada entre −10% e 12%, porque aquisições inflam o histórico.`),
    outros: mk(outros, `Mediana dos últimos 3 anos de (lucro antes de juros, impostos, depreciação e amortização − caixa das operações − juros pagos dentro das operações − imposto) ÷ receita: ${ou.map(x => (x * 100).toFixed(1).replace(".", ",") + "%").join("; ")}. Captura capital de giro e, em locadoras, a compra de carros que fica no caixa das operações.`),
    mg: mk(mg, "Margem dos últimos 12 meses, mantida."),
    da: mk(da, "Depreciação e amortização dos últimos 12 meses ÷ receita dos últimos 12 meses."),
    kd: mk(clamp(kd, 0.04, 0.4), "Despesa financeira dos últimos 12 meses ÷ dívida bruta média (início e fim dos últimos 12 meses). Inclui variação cambial e derivativos que a companhia lança nessa linha."),
    capex: mk(capex, "Investimentos dos últimos 12 meses ÷ receita dos últimos 12 meses."),
    ir: {v: Array(NP).fill(0.34), o: {t: "prem", f: "Alíquota nominal de 34% (25% de imposto de renda + 9% de contribuição social) sobre o lucro positivo."}},
    payout: mk(nn(payout) ? payout : 0.25, at("lucro") > 0 ? "Dividendos pagos nos últimos 12 meses ÷ lucro líquido, entre 0% e 100%." : "Lucro dos últimos 12 meses negativo: mediana do payout dos últimos 3 anos (ou 25% se não houver)."),
  };
}

// ---------- Formatos de rampa (quanto do impacto chega em cada ano) ----------
const FORMAS = {
  imediato: {nome: "Imediato e permanente", r: [1, 1, 1], txt: "impacto inteiro já no primeiro ano e nos seguintes"},
  gradual: {nome: "Gradual em 2 anos", r: [.5, 1, 1], txt: "metade no primeiro ano, inteiro a partir do segundo"},
  umano: {nome: "Só 1 ano", r: [1, 0, 0], txt: "um choque que acontece uma vez e passa"},
  recupera: {nome: "Rápido e some", r: [.7, .3, 0], txt: "pesa no começo e se dissipa"},
  tardio: {nome: "Chega no 2º ano", r: [0, 1, 1], txt: "nada no primeiro ano, inteiro a partir do segundo"},
};
const ramp = sc => sc.forma === "custom" ? (sc.ramp || [1, 1, 1]) : (FORMAS[sc.forma] || FORMAS.imediato).r;

// Impactos que um cenário pode ter (ramos da árvore)
// Linhas em que um cenário pode causar impacto. Cada uma diz a unidade, o sinal e um exemplo.
// grupo: onde ela entra (resultado, caixa, dívida)
const IMP = {
  receita: {g: "Resultado", pt: "Receita", en: "Net revenue", unid: "% da receita", u: "%", ex: "−5 = vende 5% a menos", txt: "Muda a receita em %. A margem atual incide sobre a receita a mais ou a menos, então o EBITDA cai ou sobe junto."},
  receitaMi: {g: "Resultado", pt: "Receita em reais", en: "Net revenue (R$)", unid: "R$ milhões por ano", u: " mi", ex: "−800 = perde um contrato de R$ 800 milhões por ano", txt: "Receita a mais ou a menos em valor. A margem atual incide sobre ela."},
  margem: {g: "Resultado", pt: "Margem do EBITDA", en: "EBITDA margin", unid: "pontos percentuais", u: " p.p.", ex: "−2 = margem de 10% vai a 8%", txt: "Muda a margem sobre toda a receita: preço que não repassa custo, custo de matéria-prima, frete."},
  custos: {g: "Resultado", pt: "Custos e despesas em reais", en: "Cash costs (R$)", unid: "R$ milhões por ano, positivo = custa mais", u: " mi", ex: "300 = R$ 300 milhões a mais de custo por ano", txt: "Custo ou despesa a mais (positivo) ou a menos (negativo), que reduz ou aumenta o EBITDA em reais."},
  juros: {g: "Dívida", pt: "Custo da dívida", en: "Cost of debt", unid: "pontos percentuais, positivo = mais caro", u: " p.p.", ex: "1 = paga 1 ponto a mais de juros sobre toda a dívida", txt: "Muda a taxa média paga sobre a dívida bruta: Selic mais alta na parte pós-fixada, refinanciamento mais caro."},
  divida: {g: "Dívida", pt: "Dívida bruta", en: "Gross debt", unid: "R$ milhões, positivo = dívida nova", u: " mi", ex: "2.000 = emite R$ 2 bilhões; −1.000 = paga R$ 1 bilhão", txt: "Dívida nova (entra caixa e passa a pagar juros) ou paga (sai caixa). Muda a dívida bruta, mas não a líquida no dia; a líquida muda pelos juros."},
  ir: {g: "Resultado", pt: "Alíquota de imposto", en: "Income tax rate", unid: "pontos percentuais, positivo = paga mais", u: " p.p.", ex: "5 = alíquota de 34% vai a 39%", txt: "Muda a alíquota de imposto de renda e contribuição social sobre o lucro positivo."},
  capex: {g: "Caixa", pt: "Investimentos sobre receita", en: "Capex to revenue", unid: "pontos da receita, positivo = investe mais", u: " p.p.", ex: "1 = investe 1% da receita a mais", txt: "Investimento a mais ou a menos, proporcional à receita."},
  capexMi: {g: "Caixa", pt: "Investimentos em reais", en: "Capex (R$)", unid: "R$ milhões por ano, positivo = investe mais", u: " mi", ex: "1.500 = projeto de R$ 1,5 bilhão por ano", txt: "Investimento a mais ou a menos em valor: um projeto, uma aquisição paga em caixa."},
  giro: {g: "Caixa", pt: "Capital de giro", en: "Working capital", unid: "pontos da receita, positivo = prende mais caixa", u: " p.p.", ex: "2 = fornecedores encurtam prazo e prendem 2% da receita", txt: "Caixa preso a mais (positivo) ou liberado (negativo) em estoques, clientes ou fornecedores, como corte de risco sacado."},
  dividendos: {g: "Caixa", pt: "Dividendos e recompras", en: "Dividends and buybacks", unid: "R$ milhões por ano, positivo = distribui mais", u: " mi", ex: "500 = recompra de R$ 500 milhões por ano", txt: "Dinheiro a mais (positivo) ou a menos (negativo) distribuído aos acionistas."},
  caixa: {g: "Caixa", pt: "Outros efeitos no caixa", en: "Other cash flow effect", unid: "R$ milhões por ano, negativo = sai caixa", u: " mi", ex: "−1.500 = multa ou contingência de R$ 1,5 bilhão", txt: "Dinheiro que sai (negativo) ou entra (positivo) fora do resultado: multa, processo, venda de ativo."},
};
const impFmt = (k, v) => (v > 0 ? "+" : v < 0 ? "−" : "") + fnum(Math.abs(v), IMP[k]?.u === " mi" ? 0 : 1) + (IMP[k]?.u || "");
const impLinhas = sc => sc.linhas || Object.keys(IMP).filter(k => +sc.imp?.[k]);

// ---------- Projeção ----------
function project(co, P, cens, wfn) {
  const F = co.F, L = co.periodos.length - 1;
  const ano0 = +(co.q?.ref || "2026").slice(0, 4);
  let rev = F.receita[L], nd = F.div_liq[L], cash = F.caixa_total[L] + ((P.aj || {}).cx || 0), divAnt = 0;
  const aj = P.aj || {div: 0, cx: 0}, gross = F.div_bruta[L] + aj.div, dcp = F.div_cp[L];
  const out = [];
  for (let t = 0; t < NP; t++) {
    const d = Object.fromEntries(Object.keys(IMP).map(k => [k, 0]));
    (cens || []).forEach(sc => { if (!sc.ativo) return; const w = wfn(sc); if (!w) return; const r = ramp(sc)[t] ?? 0;
      Object.keys(d).forEach(k => { const x = +sc.imp?.[k] || 0; d[k] += x * r * w; }); });
    rev = rev * (1 + P.g.v[t]);
    const recC = rev * (1 + d.receita / 100) + d.receitaMi, mg = P.mg.v[t] + d.margem / 100;
    const ebitda = recC * mg - d.custos, da = recC * P.da.v[t];
    const grossT = gross + d.divida, novaDiv = d.divida - divAnt; divAnt = d.divida; // dívida nova entra no caixa no ano em que é tomada
    const kd = P.kd.v[t] + d.juros / 100, juros = grossT * kd;
    const lair = ebitda - da - juros, imp = Math.max(0, lair) * (P.ir.v[t] + d.ir / 100), lucro = lair - imp;
    const capex = recC * (P.capex.v[t] + d.capex / 100) + d.capexMi, divid = Math.max(0, lucro) * P.payout.v[t] + d.dividendos;
    const outros = recC * ((P.outros?.v[t] || 0) + d.giro / 100);
    const fcl = ebitda - imp - capex - outros - juros + d.caixa - divid; // vencimentos rolados: o caixa livre muda a dívida líquida
    cash = cash + fcl + novaDiv; nd = grossT - cash;
    out.push({ano: ano0 + 1 + t, rec: recC, ebitda, mg: recC ? ebitda / recC : NaN, da, juros, kd, lucro, capex, divid, caixaCen: d.caixa, fcl, cash, nd, gross: grossT,
      lev: ebitda > 0 ? nd / ebitda : Infinity, icr: juros > 0 ? ebitda / juros : Infinity, liq: dcp > 0 ? Math.max(cash, 0) / dcp : Infinity});
  }
  return out;
}
const CASOS = {otimista: "Otimista", base: "Base", moderado: "Moderado", estresse: "Estresse"};
const CASO_TXT = {
  base: "Base: só as premissas da aba Números, sem nenhum cenário.",
  moderado: "Moderado (o mais provável): base + todos os cenários marcados, riscos e oportunidades, cada um com o impacto multiplicado pela sua chance.",
  estresse: "Estresse: base + o impacto inteiro de todos os riscos marcados, como se todos acontecessem; oportunidades ficam de fora.",
  otimista: "Otimista: base + o impacto inteiro de todas as oportunidades marcadas; riscos ficam de fora.",
};
const wOf = c => c === "base" ? () => 0 : c === "moderado" ? sc => (sc.chance || 0) / 100 : c === "estresse" ? sc => sc.tipo === "oportunidade" ? 0 : 1 : sc => sc.tipo === "oportunidade" ? 1 : 0;
const runCase = (co, P, cens, c) => project(co, P, cens, wOf(c));
const runOnly = (co, P, cens, sc) => project(co, P, cens, s => s === sc ? 1 : 0);
const worst = (rows, k, min) => rows.reduce((b, r) => b == null || (min ? r[k] < b[k] : r[k] > b[k]) ? r : b, null);

// ---------- Nota interna e chance de inadimplência ----------
const SCORE = {
  lev: {pt: "Alavancagem, pior ano", pts: [[0, 100], [1, 90], [2, 75], [3, 55], [4, 35], [5, 20], [7, 5]], down: true, w: .4},
  icr: {pt: "Cobertura de juros, pior ano", pts: [[.5, 0], [1, 10], [1.5, 25], [2, 45], [3, 65], [4, 80], [6, 95]], w: .3},
  liq: {pt: "Caixa sobre dívida de curto prazo, pior ano", pts: [[.3, 10], [.7, 35], [1, 55], [1.5, 75], [2.5, 90]], w: .15},
  esc: {pt: "Escala (receita, R$ milhões)", pts: [[500, 20], [2000, 45], [10000, 70], [30000, 85], [60000, 95]], w: .15},
};
const ESCALA = [
  {min: 85, nota: "AA", pd: .0002}, {min: 75, nota: "A", pd: .0006}, {min: 62, nota: "BBB", pd: .002},
  {min: 48, nota: "BB", pd: .008}, {min: 32, nota: "B", pd: .035}, {min: 0, nota: "CCC ou abaixo", pd: .27},
];
const ESCALA_FONTE = "Premissa: chance de inadimplência em 1 ano por nota, próxima das médias de longo prazo dos estudos anuais de default das agências globais de rating. Editável na Metodologia.";
function interp(pts, v, down) {
  if (v === Infinity) return down ? pts[pts.length - 1][1] : pts[pts.length - 1][1];
  if (!nn(v)) return null; if (down && v < 0) return pts[0][1];
  if (v <= pts[0][0]) return pts[0][1]; if (v >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (v - x0) / (x1 - x0); }
}
function scoreOf(rows, rec) {
  const wl = worst(rows, "lev", false);
  const v = {lev: wl.lev === Infinity ? 99 : wl.lev, icr: worst(rows, "icr", true).icr, liq: worst(rows, "liq", true).liq, esc: rec};
  let tw = 0, ts = 0; const items = Object.entries(SCORE).map(([k, it]) => { const s = interp(it.pts, v[k], it.down); if (nn(s)) { tw += it.w; ts += it.w * s; } return {k, ...it, v: v[k], s}; });
  const score = tw ? ts / tw : NaN, g = ESCALA.find(x => score >= x.min) || ESCALA[ESCALA.length - 1];
  return {items, score, nota: g.nota, pd: g.pd};
}
function pdBlend(co, P, cens) {
  const rec = co.F.receita[co.periodos.length - 1];
  const base = scoreOf(runCase(co, P, cens, "base"), rec);
  const scs = (cens || []).filter(s => s.ativo && s.chance > 0).map(sc => { const r = scoreOf(runOnly(co, P, cens, sc), rec); return {sc, p: sc.chance / 100, r, add: sc.chance / 100 * (r.pd - base.pd)}; });
  return {base, scs, pd: clamp(base.pd + sum(scs.map(x => x.add)), 0, 1)};
}

// ---------- Spread justo ----------
const SPREAD0 = {on: true, garantia: "quiro", lgd: {quiro: .6, real: .35}, capital: .1, premio: .08, opex: .002, prazo: 5};
function pricing(co, P, cens, SP) {
  const pb = pdBlend(co, P, cens), lgd = SP.lgd[SP.garantia];
  const EL = pb.pd * lgd, cap = SP.capital * SP.premio, justo = EL + cap + SP.opex;
  return {pb, lgd, EL, cap, opex: SP.opex, justo};
}

// ANBIMA: papéis do emissor e do setor
const normN = s => String(s || "").toUpperCase().normalize("NFD").replace(/[^\w ]/g, "").replace(/\b(SA|S A|CIA|COMPANHIA|DE|DO|DA)\b/g, " ").replace(/\s+/g, " ").trim();
function debsDe(OF, co) {
  const deb = OF?.anbima?.deb || []; const w = normN(co.comercial || co.nome).split(" ").filter(x => x.length > 2).slice(0, 2);
  if (!w.length) return [];
  return deb.filter(d => { const n = normN(d.n); return w.every(x => n.includes(x)); });
}

// ---------- Anos projetados dentro da tabela do histórico ----------
const PROJ_MAP = {receita: "rec", ebitda: "ebitda", mg_ebitda: "mg", desp_fin: "juros", lucro: "lucro", caixa: "cash", div_bruta: "gross", div_liq: "nd", capex: "capex", dl_ebitda: "lev", ebitda_desp: "icr", caixa_divcp: "liq"};
const PROJ_FX = {
  receita: "Receita do ano anterior × (1 + crescimento) × (1 + efeito dos cenários na receita)",
  ebitda: "Receita projetada × margem (premissa + efeito dos cenários)",
  mg_ebitda: "Margem premissa + efeito dos cenários na margem",
  desp_fin: "Dívida bruta × (custo da dívida + efeito dos cenários nos juros)",
  lucro: "EBITDA − depreciação − juros − imposto de 34% sobre o lucro positivo",
  caixa: "Caixa do ano anterior + caixa livre do ano (EBITDA − imposto − investimentos − outras saídas operacionais − juros − dividendos + efeito dos cenários no caixa)",
  div_bruta: "Mantida: os vencimentos são refinanciados",
  div_liq: "Dívida bruta − caixa projetado",
  capex: "Receita projetada × (investimentos sobre receita + efeito dos cenários)",
  dl_ebitda: "Dívida líquida projetada ÷ EBITDA projetado",
  ebitda_desp: "EBITDA projetado ÷ juros projetados",
  caixa_divcp: "Caixa projetado ÷ dívida de curto prazo atual",
};

// ---------- Visões da tabela: vertical e horizontal ----------
// vertical: fluxos ÷ receita da mesma coluna; saldos ÷ ativo total. horizontal: variação contra a coluna comparável anterior.

// ---------- Curvas de títulos públicos e spread por indexador ----------
function curva(c, anos) {
  if (!c?.length || !nn(anos)) return null;
  if (anos <= c[0].anos) return c[0].taxa; if (anos >= c[c.length - 1].anos) return c[c.length - 1].taxa;
  for (let i = 1; i < c.length; i++) if (anos <= c[i].anos) { const a = c[i - 1], b = c[i]; return a.taxa + (b.taxa - a.taxa) * (anos - a.anos) / (b.anos - a.anos); }
}
// Spread justo em cada indexador: o mesmo prêmio de crédito somado à taxa livre de risco do indexador, no prazo do papel.
function justoPorIndexador(TIT, justo, prazo, cdi) {
  const pre = curva(TIT?.gov?.pre, prazo), ipca = curva(TIT?.gov?.ipca, prazo);
  return {
    di: {nome: "CDI +", taxaGov: cdi, justo, txt: "Spread sobre o CDI."},
    ipca: {nome: "IPCA +", taxaGov: ipca, justo: nn(ipca) ? ipca / 100 + justo : null, txt: `NTN-B do prazo (${nn(ipca) ? fnum(ipca, 2) + "%" : "–"}) + spread justo.`},
    pre: {nome: "Prefixado", taxaGov: pre, justo: nn(pre) ? pre / 100 + justo : null, txt: `Curva prefixada (LTN e NTN-F) no prazo (${nn(pre) ? fnum(pre, 2) + "%" : "–"}) + spread justo.`},
  };
}
function pdPorCaso(co, P, cens) { const rec = co.F.receita[co.periodos.length - 1]; const o = {}; Object.keys(CASOS).forEach(c => o[c] = scoreOf(runCase(co, P, cens, c), rec)); return o; }

// ---------- Ajustes à dívida, ao caixa e ao EBITDA (para comparar com research e covenants) ----------
// Cada ajuste: {tipo: "divida" | "caixa" | "ebitda", nome, valor (R$ milhões, positivo soma), fonte, o}
const AJ_TIPOS = {
  divida: {pt: "Soma à dívida", en: "Debt-like item", ex: "arrendamentos, cartas de crédito de fornecedores, risco sacado, derivativos passivos, dívida de controlada fora do balanço"},
  caixa: {pt: "Soma ao caixa", en: "Cash-like item", ex: "aplicações de longo prazo, caixa restrito que pode ser usado (negativo tira caixa que não está livre)"},
  ebitda: {pt: "Ajuste ao EBITDA dos 12 meses", en: "EBITDA adjustment", ex: "tirar ganho não recorrente (negativo) ou somar despesa não recorrente (positivo), como impairment ou venda de ativo"},
};
function somaAj(A) { const o = {div: 0, cx: 0, eb: 0}; (A.aj || []).filter(a => a.ativo !== false).forEach(a => { const v = +a.valor || 0; if (a.tipo === "divida") o.div += v; else if (a.tipo === "caixa") o.cx += v; else o.eb += v; }); return o; }
function metricasAj(co, A) {
  const L = co.periodos.length - 1, F = co.F, s = somaAj(A);
  const eb = F.ebitda[L], dl = F.div_liq[L], db = F.div_bruta[L], cx = F.caixa_total[L];
  const ebA = nn(eb) ? eb + s.eb : null, dbA = nn(db) ? db + s.div : null, cxA = nn(cx) ? cx + s.cx : null, dlA = nn(dbA) && nn(cxA) ? dbA - cxA : null;
  return {s, eb, ebA, db, dbA, cx, cxA, dl, dlA, lev: nn(dl) && eb > 0 ? dl / eb : null, levA: nn(dlA) && ebA > 0 ? dlA / ebA : null};
}
