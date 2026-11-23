// =====================================================================
// MESA DE CRÉDITO PRIVADA · motor de cálculo
// Valores em R$ mil, nominais (sem desconto a valor presente, exceto na
// perda se quebrar, que traz a recuperação das garantias à data do calote).
// Toda entrada carrega uma origem: {t: tipo, f: fonte}.
// =====================================================================
"use strict";
const NY = 5; // anos projetados
const nn = v => typeof v === "number" && isFinite(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sum = a => a.reduce((s, x) => s + (nn(x) ? x : 0), 0);
const mean = a => { const b = a.filter(nn); return b.length ? sum(b) / b.length : NaN; };
const median = a => { const b = a.filter(nn).sort((x, y) => x - y); if (!b.length) return NaN; const m = b.length / 2; return b.length % 2 ? b[Math.floor(m)] : (b[m - 1] + b[m]) / 2; };
const quant = (a, q) => { const b = a.filter(nn).sort((x, y) => x - y); if (!b.length) return NaN; const p = (b.length - 1) * q, i = Math.floor(p); return b[i] + (b[Math.min(i + 1, b.length - 1)] - b[i]) * (p - i); };
const uid = () => Math.random().toString(36).slice(2, 9);
const deep = o => JSON.parse(JSON.stringify(o));

// ---------- Tipos de origem ----------
const ORIG = {
  aud: {nome: "Auditado", cls: "o-aud", txt: "demonstração com parecer de auditor independente"},
  cli: {nome: "Cliente", cls: "o-cli", txt: "informado pela empresa, sem auditoria"},
  ofi: {nome: "Oficial", cls: "o-ofi", txt: "dado público de fonte oficial (Banco Central, ANBIMA, IBGE, CVM)"},
  calc: {nome: "Cálculo", cls: "o-calc", txt: "fórmula sobre outros números da análise"},
  prem: {nome: "Premissa", cls: "o-prem", txt: "escolha do analista"},
  claude: {nome: "Claude", cls: "o-claude", txt: "sugerido pelo Claude, a conferir"},
  ex: {nome: "Exemplo", cls: "o-ex", txt: "valor da empresa fictícia de exemplo"},
};
const O = (t, f) => ({t, f: f || ""});

// ---------- Linhas das demonstrações ----------
// kind: flow (soma no período) | stock (saldo na data)
const LINES = [
  {id: "receita", g: "Demonstração do resultado", en: "Net Revenue", pt: "receita líquida", kind: "flow"},
  {id: "ebit", g: "Demonstração do resultado", en: "Operating Income", pt: "lucro operacional, antes do resultado financeiro", kind: "flow"},
  {id: "da", g: "Demonstração do resultado", en: "D&A", pt: "depreciação e amortização", kind: "flow"},
  {id: "ebitda", g: "Demonstração do resultado", en: "EBITDA", pt: "lucro operacional antes de depreciação e amortização", kind: "flow", calc: v => v.ebit + v.da, fx: "Operating Income + D&A"},
  {id: "juros", g: "Demonstração do resultado", en: "Interest Expense", pt: "despesa de juros (positiva)", kind: "flow"},
  {id: "recfin", g: "Demonstração do resultado", en: "Financial Income", pt: "receita financeira", kind: "flow"},
  {id: "ir", g: "Demonstração do resultado", en: "Income Taxes", pt: "IR e CSLL (despesa positiva)", kind: "flow"},
  {id: "lucro", g: "Demonstração do resultado", en: "Net Income", pt: "lucro líquido", kind: "flow"},
  {id: "caixa", g: "Balanço", en: "Cash", pt: "caixa e aplicações", kind: "stock"},
  {id: "receber", g: "Balanço", en: "Accounts Receivable", pt: "contas a receber de clientes", kind: "stock"},
  {id: "estoques", g: "Balanço", en: "Inventory", pt: "estoques", kind: "stock"},
  {id: "fornec", g: "Balanço", en: "Accounts Payable", pt: "fornecedores", kind: "stock"},
  {id: "divcp", g: "Balanço", en: "Short-term Debt", pt: "empréstimos que vencem em até 12 meses", kind: "stock"},
  {id: "divlp", g: "Balanço", en: "Long-term Debt", pt: "empréstimos que vencem depois de 12 meses", kind: "stock"},
  {id: "divbruta", g: "Balanço", en: "Gross Debt", pt: "dívida bruta", kind: "stock", calc: v => v.divcp + v.divlp, fx: "Short-term Debt + Long-term Debt"},
  {id: "divliq", g: "Balanço", en: "Net Debt", pt: "dívida líquida", kind: "stock", calc: v => v.divcp + v.divlp - v.caixa, fx: "Gross Debt − Cash"},
  {id: "giro", g: "Balanço", en: "Working Capital", pt: "capital de giro operacional", kind: "stock", calc: v => v.receber + v.estoques - v.fornec, fx: "Accounts Receivable + Inventory − Accounts Payable"},
  {id: "ativo", g: "Balanço", en: "Total Assets", pt: "ativo total", kind: "stock"},
  {id: "passivo", g: "Balanço", en: "Total Liabilities", pt: "passivo total (sem o patrimônio)", kind: "stock"},
  {id: "pl", g: "Balanço", en: "Equity", pt: "patrimônio líquido", kind: "stock"},
  {id: "fco", g: "Fluxo de caixa", en: "Operating Cash Flow", pt: "caixa gerado pelas operações", kind: "flow"},
  {id: "capex", g: "Fluxo de caixa", en: "Capex", pt: "investimentos em imobilizado (saída positiva)", kind: "flow"},
  {id: "divid", g: "Fluxo de caixa", en: "Dividends Paid", pt: "dividendos e juros sobre capital pagos", kind: "flow"},
];
const LBY = Object.fromEntries(LINES.map(l => [l.id, l]));
const INPUT_LINES = LINES.filter(l => !l.calc);

// Colunas: 3 anos fechados + parcial do ano anterior + parcial do ano corrente; LTM calculado
function periods(A) {
  const y = +A.emp.anoBase, m = +A.emp.mesesParcial;
  return [
    {k: "y2", lab: String(y - 2), ano: true}, {k: "y1", lab: String(y - 1), ano: true}, {k: "y0", lab: String(y), ano: true},
    {k: "p0", lab: `${m}M ${y}`, ano: false}, {k: "p1", lab: `${m}M ${y + 1}`, ano: false}];
}
const val = (A, line, pk) => { const c = A.dem[line]?.[pk]; return c && nn(c.v) ? c.v : null; };
function colValues(A, pk) {
  const v = {}; INPUT_LINES.forEach(l => v[l.id] = val(A, l.id, pk) ?? 0);
  LINES.filter(l => l.calc).forEach(l => v[l.id] = l.calc(v));
  return v;
}
// Últimos 12 meses: fluxos = ano fechado + parcial atual − parcial anterior; saldos = parcial atual
function ltm(A) {
  const y0 = colValues(A, "y0"), p0 = colValues(A, "p0"), p1 = colValues(A, "p1");
  const hasP = INPUT_LINES.some(l => val(A, l.id, "p1") !== null);
  if (!hasP) return {...y0, _src: "ano fechado " + A.emp.anoBase};
  const v = {};
  INPUT_LINES.forEach(l => v[l.id] = l.kind === "stock" ? p1[l.id] : y0[l.id] + p1[l.id] - p0[l.id]);
  LINES.filter(l => l.calc).forEach(l => v[l.id] = l.calc(v));
  v._src = "últimos 12 meses";
  return v;
}

// ---------- Avaliador de fórmulas das árvores (sem eval) ----------
function tokenize(s) {
  const t = [], re = /\s*(\d+(?:[.,]\d+)?|[A-Za-z_][\w]*|[-+*/()^])/y; let m; re.lastIndex = 0;
  while (re.lastIndex < s.length) { const p = re.lastIndex; m = re.exec(s); if (!m) { if (/^\s*$/.test(s.slice(p))) break; throw new Error("caractere inválido perto de '" + s.slice(p, p + 6) + "'"); } t.push(m[1].replace(",", ".")); }
  return t;
}
function evalFormula(src, get) {
  const t = tokenize(String(src || "")); let i = 0;
  const peek = () => t[i], next = () => t[i++];
  const prim = () => {
    const x = next(); if (x === undefined) throw new Error("fórmula incompleta");
    if (x === "(") { const v = expr(); if (next() !== ")") throw new Error("falta fechar parênteses"); return v; }
    if (x === "-") return -prim();
    if (/^\d/.test(x)) return parseFloat(x);
    if (/^(max|min|abs)$/i.test(x) && peek() === "(") { next(); const a = [expr()]; while (peek() === ",") { next(); a.push(expr()); } if (next() !== ")") throw new Error("falta ) em " + x); return Math[x.toLowerCase()](...a); }
    const v = get(x); if (!nn(v)) throw new Error("nó desconhecido: " + x); return v;
  };
  const pow = () => { let v = prim(); while (peek() === "^") { next(); v = Math.pow(v, prim()); } return v; };
  const term = () => { let v = pow(); while (peek() === "*" || peek() === "/") { const o = next(), r = pow(); v = o === "*" ? v * r : v / r; } return v; };
  const expr = () => { let v = term(); while (peek() === "+" || peek() === "-") { const o = next(), r = term(); v = o === "+" ? v + r : v - r; } return v; };
  const v = expr(); if (i < t.length) throw new Error("sobrou '" + t[i] + "' na fórmula"); return v;
}
// Avalia uma árvore nos estados "hoje" e "cenário"
function evalTree(tr) {
  const byId = Object.fromEntries(tr.nos.map(n => [n.id, n])), vals = {}, errs = {};
  const calc = (id, st, stack = []) => {
    const n = byId[id]; if (!n) return NaN;
    if (n.tipo !== "formula") return +(st === "base" ? n.base : n.cen);
    const key = id + "|" + st; if (key in vals) return vals[key];
    if (stack.includes(id)) { errs[id] = "fórmula circular"; return NaN; }
    let v; try { v = evalFormula(n.formula, x => calc(x, st, [...stack, id])); } catch (e) { errs[id] = e.message; v = NaN; }
    return vals[key] = v;
  };
  const out = {};
  tr.nos.forEach(n => out[n.id] = {base: calc(n.id, "base"), cen: calc(n.id, "cen")});
  const root = tr.nos.find(n => !n.pai) || tr.nos[0];
  return {vals: out, errs, root: root?.id, delta: root ? out[root.id].cen - out[root.id].base : 0};
}

// ---------- Formatos do impacto ao longo dos anos ----------
const FORMAS = {
  imediato: {nome: "Imediato e permanente", r: [1, 1, 1, 1, 1], txt: "o impacto inteiro já no primeiro ano e em todos os seguintes"},
  gradual: {nome: "Gradual em 2 anos", r: [.5, 1, 1, 1, 1], txt: "metade no primeiro ano, inteiro a partir do segundo"},
  umano: {nome: "Só 1 ano", r: [1, 0, 0, 0, 0], txt: "um choque que acontece uma vez e passa"},
  recupera: {nome: "Com recuperação", r: [.7, 1, .6, .3, 0], txt: "pesa no começo e a empresa se recompõe aos poucos"},
  tardio: {nome: "Chega no 2º ano", r: [0, 1, 1, 1, 1], txt: "nada no primeiro ano, inteiro a partir do segundo (ex.: contrato que vence depois)"},
};
const ramp = sc => sc.forma === "custom" ? sc.ramp : (FORMAS[sc.forma] || FORMAS.imediato).r;

// Linhas em que uma árvore pode entrar
const TLINES = {
  receita: {nome: "Receita", en: "Net Revenue", txt: "muda a receita; parte vira custo variável"},
  custos: {nome: "Custos caixa", en: "Cash Costs", txt: "custo a mais reduz o EBITDA (valor positivo = custo maior)"},
  juros: {nome: "Juros", en: "Interest Expense", txt: "despesa de juros a mais"},
  capex: {nome: "Capex", en: "Capex", txt: "investimento a mais"},
  giro: {nome: "Capital de giro (saldo)", en: "Working Capital", txt: "caixa preso a mais no giro; entra como saldo"},
  dividendos: {nome: "Dividendos", en: "Dividends", txt: "distribuição a mais aos sócios"},
  saidas: {nome: "Outras saídas de caixa", en: "Other Cash Outflows", txt: "ex.: banco que não rola, contingência paga"},
};

// Δ por linha e ano de um conjunto de cenários com peso w(sc)
function scenarioDeltas(A, wfn) {
  const d = {}; Object.keys(TLINES).forEach(k => d[k] = Array(NY).fill(0)); d.recMargin = Array(NY).fill(0);
  (A.cens || []).forEach(sc => {
    if (sc.ativo === false) return; const w = wfn(sc); if (!w) return; const r = ramp(sc);
    (sc.trees || []).forEach(tr => {
      if (tr.ativo === false) return; const e = evalTree(tr); if (!nn(e.delta)) return;
      for (let t = 0; t < NY; t++) {
        const x = e.delta * (r[t] ?? 0) * w;
        d[tr.linha][t] += x;
        if (tr.linha === "receita") d.recMargin[t] += x * (1 - (nn(tr.vcr) ? tr.vcr : .6));
      }
    });
  });
  return d;
}

// ---------- Juros: Selic por reunião do Copom ----------
// Cada ano tem 8 reuniões; a taxa decidida numa reunião vale até a seguinte.
// Média do ano ≈ (taxa vigente em 1º de janeiro + taxas das reuniões 1 a 7) ÷ 8.
function selicPath(A, OF) {
  const y0 = +A.emp.anoBase + 1; // ano da data-base (ex.: 2026)
  const rows = [];
  (OF?.copom?.past || []).forEach(p => rows.push({r: "Reunião " + p.n, data: p.data, ano: +p.data.slice(0, 4), real: p.selic, focus: null, src: O("ofi", OF.copom.fonte + ": " + p.titulo)}));
  const focus = Object.fromEntries((OF?.focus?.selic || []).map(f => [f.r, f]));
  const anual = Object.fromEntries((OF?.focus?.selic_anual || []).map(f => [f.ano, f.med]));
  const lastPast = rows.length ? rows[rows.length - 1] : null;
  // reuniões futuras: a partir da próxima reunião do ano corrente até o fim da projeção
  const nPast = rows.filter(r => r.ano === y0).length;
  let last = lastPast ? lastPast.real : 13;
  for (let ano = y0; ano <= y0 + NY; ano++) {
    for (let k = (ano === y0 ? nPast + 1 : 1); k <= 8; k++) {
      const code = `R${k}/${ano}`, f = focus[code];
      let fv = f ? f.med : (anual[ano] ?? null), fsrc;
      if (f) fsrc = O("ofi", `${OF.focus.fonte}: mediana ${f.med.toFixed(2).replace(".", ",")}% para ${code}, ${f.n} respondentes`);
      else if (anual[ano] != null) fsrc = O("ofi", `Focus anual de ${OF.focus.data}: Selic de fim de ${ano} ${String(anual[ano]).replace(".", ",")}% (não há mediana por reunião para ${code})`);
      else { fv = last; fsrc = O("prem", "sem projeção do Focus para este horizonte: repete a última taxa"); }
      const ov = A.juros.over[code];
      const use = nn(ov) ? ov : fv; last = use;
      rows.push({r: code, data: A.juros.datas[code.replace("/", "_")] || "", ano, real: null, focus: fv, over: nn(ov) ? ov : null, use, src: nn(ov) ? O("prem", A.juros.overF[code] || "premissa do analista") : fsrc});
    }
  }
  return rows;
}
function cdiByYear(A, OF) {
  const rows = selicPath(A, OF), y1 = +A.emp.anoBase + 2, out = [];
  const at = (ano, k) => { const rs = rows.filter(r => r.ano === ano); return rs[k - 1] ? (rs[k - 1].real ?? rs[k - 1].use) : null; };
  for (let t = 0; t < NY; t++) {
    const ano = y1 + t, prevEnd = at(ano - 1, 8) ?? at(ano - 1, rows.filter(r => r.ano === ano - 1).length);
    const vs = [prevEnd]; for (let k = 1; k <= 7; k++) vs.push(at(ano, k));
    const selic = mean(vs.filter(nn)), cdi = selic - A.juros.cdiGap;
    out.push({ano, selic, cdi: cdi / 100});
  }
  return out;
}
function ipcaByYear(A, OF) {
  const y1 = +A.emp.anoBase + 2, f = Object.fromEntries((OF?.focus?.ipca_anual || []).map(x => [x.ano, x.med]));
  return Array.from({length: NY}, (_, t) => { const ano = y1 + t, ov = A.juros.ipcaOver[ano]; const fv = f[ano] ?? f[Math.max(...Object.keys(f).map(Number))] ?? 4;
    return {ano, ipca: (nn(ov) ? ov : fv) / 100, focus: fv, over: nn(ov) ? ov : null}; });
}

// ---------- Projeção de um caso ----------
function rateOf(A, t, J, I) {
  const op = A.op;
  if (op.index === "CDI") return (1 + J[t].cdi) * (1 + op.spread) - 1;
  if (op.index === "IPCA") return (1 + I[t].ipca) * (1 + op.spread) - 1;
  return op.taxaPre;
}
function opSchedule(A, J, I) {
  const op = A.op, V = +op.valor || 0, P = Math.max(1, +op.prazo || 1), C = clamp(+op.carencia || 0, 0, P - 1);
  const rows = []; let s = V;
  for (let t = 0; t < NY; t++) {
    let pr;
    if (op.amort === "bullet") pr = (P > 12 * t && P <= 12 * (t + 1)) ? s : 0;
    else { const am = Math.max(0, Math.min(12 * (t + 1), P) - Math.max(12 * t, C)); pr = Math.min(s, am * V / (P - C)); }
    const ini = s, fim = s - pr, r = rateOf(A, t, J, I), juros = (ini + fim) / 2 * r;
    rows.push({ini, pr, fim, r, juros}); s = fim;
  }
  return rows;
}
function project(A, OF, d) {
  const L = ltm(A), P = A.prem, J = cdiByYear(A, OF), I = ipcaByYear(A, OF), op = A.op, S = opSchedule(A, J, I);
  const V = +op.valor || 0, Q = Math.min(+op.quitar || 0, L.divbruta);
  let rev0 = L.receita, nwc0 = L.giro, cash = L.caixa + V - Q, exist = L.divbruta - Q;
  const out = [];
  for (let t = 0; t < NY; t++) {
    const baseRev = rev0 * (1 + P.g[t]); rev0 = baseRev;
    const rec = baseRev + d.receita[t];
    const ebitda = baseRev * P.mg[t] + d.recMargin[t] - d.custos[t];
    const da = rec * P.da[t];
    const cdi = J[t].cdi, rExist = (1 + cdi) * (1 + P.spExist[t]) - 1;
    const amEx = Math.min(exist, P.amExist[t] || 0), roll = amEx * P.refin[t];
    const existFim = exist - amEx + roll;
    const jurosEx = (exist + existFim) / 2 * rExist;
    const juros = jurosEx + S[t].juros + d.juros[t];
    const recfin = Math.max(cash, 0) * cdi * P.rendCx[t];
    const lair = ebitda - da - juros + recfin, imp = Math.max(0, lair) * P.ir[t], lucro = lair - imp;
    const nwc = rec * P.dias[t] / 365 + d.giro[t], dWC = nwc - nwc0; nwc0 = nwc;
    const capex = rec * P.capex[t] + d.capex[t];
    const cads = ebitda - imp - dWC - capex - d.saidas[t];
    const principal = amEx + S[t].pr, ds = juros + principal;
    const divid = Math.max(0, lucro) * P.payout[t] + d.dividendos[t];
    cash = cash + cads - ds + roll + recfin - divid;
    exist = existFim;
    const divbruta = exist + S[t].fim, nd = divbruta - cash;
    out.push({ano: J[t].ano, cdi, rec, baseRev, ebitda, mg: ebitda / rec, da, juros, jurosEx, jurosOp: S[t].juros, recfin, imp, lucro, nwc, dWC, capex, saidas: d.saidas[t], cads,
      amEx, prOp: S[t].pr, principal, ds, roll, divid, cash, exist, opSaldo: S[t].fim, divbruta, nd,
      dscr: ds > 0 ? cads / ds : Infinity, dscrR: (ds - roll) > 0 ? cads / (ds - roll) : Infinity, lev: ebitda > 0 ? nd / ebitda : Infinity, icr: juros > 0 ? ebitda / juros : Infinity, payback: (cads - juros) > 0 ? nd / (cads - juros) : Infinity});
  }
  return out;
}
const CASES = {base: "Base", moderado: "Moderado", estresse: "Estresse", esperado: "Esperado"};
function caseWeightFn(A, c) {
  if (c === "base") return () => 0;
  if (c === "moderado") return sc => sc.prob / 100;
  if (c === "estresse") return () => 1;
  const w = A.casos; return sc => (w.moderado * sc.prob / 100 + w.estresse) / (w.base + w.moderado + w.estresse);
}
function runCase(A, OF, c) { return project(A, OF, scenarioDeltas(A, caseWeightFn(A, c))); }
function runOnly(A, OF, sc) { return project(A, OF, scenarioDeltas(A, s => s === sc ? 1 : 0)); }
const worst = (rows, k, min = true) => rows.reduce((b, r) => (b == null || (min ? r[k] < b[k] : r[k] > b[k])) ? r : b, null);

// ---------- Covenants ----------
const COVM = {
  lev: {en: "Net Debt ÷ EBITDA", pt: "dívida líquida ÷ EBITDA", tipo: "max", k: "lev"},
  icr: {en: "EBITDA ÷ Interest Expense", pt: "EBITDA ÷ despesa de juros", tipo: "min", k: "icr"},
  dscr: {en: "Debt Service Coverage", pt: "caixa disponível ÷ (juros + principal)", tipo: "min", k: "dscr"},
};
function covCheck(cv, v) {
  const m = COVM[cv.m]; if (!nn(v)) return {ok: m.tipo === "min", folga: m.tipo === "min" ? 1 : -1};
  const ok = m.tipo === "max" ? v <= cv.lim : v >= cv.lim;
  const folga = m.tipo === "max" ? 1 - v / cv.lim : 1 - cv.lim / v; // quanto o EBITDA / caixa pode cair
  return {ok, folga};
}

// ---------- Garantias ----------
const GTIPOS = {
  imovel: {nome: "Alienação fiduciária de imóvel", h: .35, c: .10, m: 18, q: 0, rj: "fora",
    why: {h: "Imóvel industrial vende com desconto e o 2º leilão aceita lance pelo valor da dívida. 35% é ponto de partida conservador; troque pela política da casa.", c: "Cartório, ITBI, IPTU atrasado, leiloeiro e advogado.", m: "Intimação, consolidação da propriedade e dois leilões costumam levar mais de um ano.", q: "O imóvel não encolhe quando a empresa quebra."}},
  recebiveis: {nome: "Cessão fiduciária de recebíveis", h: .25, c: .05, m: 3, q: .5, rj: "fora",
    why: {h: "Parte da carteira não é paga ou é contestada pelos clientes.", c: "Cobrança e conta vinculada.", m: "Recebíveis vencem em poucos meses.", q: "Empresa em crise fatura menos: a carteira cedida cai. 50% é premissa; ajuste pelo histórico."}},
  maquinas: {nome: "Penhor industrial de máquinas", h: .5, c: .15, m: 12, q: 0, rj: "dentro",
    why: {h: "Máquina usada e específica tem poucos compradores.", c: "Remoção, guarda, laudo e leilão.", m: "Execução judicial; na recuperação judicial depende do plano.", q: "A máquina continua existindo."}},
  estoque: {nome: "Penhor de estoques", h: .5, c: .15, m: 9, q: .3, rj: "dentro",
    why: {h: "Estoque vendido às pressas perde valor.", c: "Armazenagem e venda.", m: "Execução judicial.", q: "Estoque é consumido antes da quebra."}},
  aplicacao: {nome: "Cessão de aplicação financeira", h: 0, c: 0, m: 0, q: 0, rj: "fora",
    why: {h: "Dinheiro aplicado no próprio credor: sem desconto.", c: "Sem custo.", m: "Resgate imediato.", q: "Fica bloqueada."}},
  pessoal: {nome: "Aval ou fiança", h: .7, c: .2, m: 36, q: 0, rj: "pessoa",
    why: {h: "Patrimônio pessoal costuma ser difícil de alcançar (bem de família, outras dívidas).", c: "Processo de execução.", m: "Execução contra pessoa física é longa.", q: "Depende do patrimônio livre do garantidor."}},
};
function collateral(A, OF) {
  const J = cdiByYear(A, OF), r = J[0].cdi + A.preco.funding, EAD = +A.op.valor || 0;
  const rows = (A.gar || []).map(g => {
    const rec = (+g.valor || 0) * (1 - g.h);
    const liq = (+g.valor || 0) * (1 - g.q) * (1 - g.h) * (1 - g.c) / Math.pow(1 + r, (g.m || 0) / 12);
    return {...g, rec, liq};
  });
  const recT = sum(rows.map(x => x.rec)), liqT = sum(rows.map(x => x.liq));
  return {rows, recT, liqT, EAD, r, cover: EAD > 0 ? recT / EAD : NaN, lgd: EAD > 0 ? clamp(1 - liqT / EAD, 0, 1) : NaN};
}

// ---------- Rating interno (pesos e tabela editáveis) ----------
const SCORE = {
  lev: {nome: "Net Debt ÷ EBITDA", pt: "pior ano", pts: [[0, 100], [1, 90], [2, 75], [3, 55], [4, 35], [5, 20], [7, 5]], down: true},
  dscr: {nome: "Debt Service Coverage", pt: "pior ano", pts: [[.6, 0], [.9, 15], [1, 30], [1.2, 50], [1.5, 70], [2, 88], [3, 100]]},
  icr: {nome: "EBITDA ÷ Interest Expense", pt: "pior ano", pts: [[1, 5], [1.5, 25], [2, 45], [3, 65], [4, 80], [6, 95]]},
  conc: {nome: "Concentração no maior cliente", pt: "% da receita", pts: [[.05, 95], [.1, 80], [.2, 55], [.3, 35], [.5, 10]], down: true},
  info: {nome: "Qualidade da informação", pt: "auditoria", pts: null},
  escala: {nome: "Escala", pt: "receita, R$ mi", pts: [[20, 15], [50, 30], [150, 50], [400, 70], [1000, 85], [3000, 100]]},
  hist: {nome: "Histórico de pagamento", pt: "com credores", pts: null},
};
const INFO_PTS = {dois: 80, um: 55, nenhum: 25}, HIST_PTS = {limpo: 85, pontual: 50, reneg: 15};
function interp(pts, v, down) {
  if (!nn(v)) return null; if (down && v < 0) return pts[0][1];
  if (v <= pts[0][0]) return pts[0][1]; if (v >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) if (v <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; return y0 + (y1 - y0) * (v - x0) / (x1 - x0); }
}
function scoreOf(A, rows) {
  const L = ltm(A);
  const v = {lev: Math.min(worst(rows, "lev", false).lev, 20), dscr: worst(rows, "dscr").dscr, icr: worst(rows, "icr").icr, conc: A.emp.conc, escala: L.receita / 1000, info: A.emp.auditoria, hist: A.emp.hist};
  let tw = 0, ts = 0; const items = Object.entries(SCORE).map(([k, it]) => {
    const s = k === "info" ? INFO_PTS[v.info] : k === "hist" ? HIST_PTS[v.hist] : interp(it.pts, v[k], it.down), w = A.rating.pesos[k] ?? 0;
    if (nn(s)) { tw += w; ts += w * s; } return {k, ...it, v: v[k], s, w};
  });
  const score = tw ? ts / tw : NaN, g = A.rating.escala.find(x => score >= x.min) || A.rating.escala[A.rating.escala.length - 1];
  return {items, score, nota: g.nota, pd: g.pd};
}
// Chance de calote ponderada pelos cenários
function pdBlend(A, OF) {
  const base = scoreOf(A, runCase(A, OF, "base"));
  const scs = (A.cens || []).filter(s => s.ativo !== false && s.prob > 0).map(sc => ({sc, p: sc.prob / 100, r: scoreOf(A, runOnly(A, OF, sc))}));
  // Cada cenário soma à chance de calote do caso base a sua chance × o acréscimo que ele causa.
  // Com cenários que não se sobrepõem é o mesmo que (1 − Σp)·PD base + Σ p·PD do cenário, e não exige que as chances somem até 100%.
  scs.forEach(x => x.add = x.p * (x.r.pd - base.pd));
  const pd = clamp(base.pd + sum(scs.map(x => x.add)), 0, 1);
  return {base, scs, pd};
}

// ---------- Precificação ----------
function pricing(A, OF) {
  const pb = pdBlend(A, OF), col = collateral(A, OF), pr = A.preco, rf = (OF?.cdi?.valor ?? 13.65) / 100;
  const EL = pb.pd * col.lgd, cap = pr.capital * (pr.roe - rf), min = pr.funding + EL + cap + pr.opex;
  const raroc = s => (s - pr.funding - EL - pr.opex) / pr.capital + rf;
  return {pb, col, rf, EL, cap, min, spread: A.op.spread, folga: A.op.spread - min, raroc: raroc(A.op.spread), rarocAt: raroc};
}

// ---------- Pares: bancos (Banco Central) ----------
function bankStats(OF, mod) {
  const cdi = (OF?.cdi?.valor ?? 13.65) / 100;
  const rows = (OF?.bancos?.linhas || []).filter(r => r[0] === mod).map(r => ({pos: r[1], banco: r[2], taxa: r[3] / 100, spread: /flutuantes/.test(mod) ? (1 + r[3] / 100) / (1 + cdi) - 1 : null}));
  return {rows, med: median(rows.map(r => r.taxa)), q1: quant(rows.map(r => r.taxa), .25), q3: quant(rows.map(r => r.taxa), .75),
    smed: median(rows.map(r => r.spread)), sq1: quant(rows.map(r => r.spread), .25), sq3: quant(rows.map(r => r.spread), .75)};
}
