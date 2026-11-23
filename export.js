// =====================================================================
// Exportar: Excel com fórmulas vivas e PDF do parecer
// Convenção do Excel: azul = entrada (dado ou premissa), preto = fórmula, verde = vínculo com outra aba.
// =====================================================================
"use strict";
const XC = {inp: "FF1F4E9A", link: "FF1E7B3C", ink: "FF15201B", mut: "FF5B6A63", head: "FFEEF1EF", sec: "FFDCEBE5", acc: "FF0F5A4A"};
const XF = {mi: '#,##0;(#,##0);"–"', pct: '0.00%;(0.00%);"–"', x: '0.00"x";(0.00"x");"–"', n: '#,##0.00;(#,##0.00);"–"', n4: '0.0000'};
const colL = n => { let s = ""; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const sq = n => `'${String(n).replace(/'/g, "''")}'`;
const fname = ext => `credito_${String(S.A.emp.nome || "analise").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 40)}_${new Date().toISOString().slice(0, 10)}.${ext}`;
async function doExport(kind) {
  const dl = await getDL(), msg = (t, bad) => { S.msg.exp = {t, bad}; const el = document.querySelector('[data-act="export"]')?.parentElement?.querySelector("span.small"); render(); };
  const saver = dl || {save: async ({filename, data}) => { const u = URL.createObjectURL(data), a = document.createElement("a"); a.href = u; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }};
  msg("Gerando…");
  try {
    let data, filename;
    if (kind === "xlsx") { data = await buildXlsx(); filename = fname("xlsx").replace("credito_", "modelo_credito_"); }
    else if (kind === "pdf") { data = await buildPdf(); filename = fname("pdf"); }
    else { data = new Blob([JSON.stringify(S.A, null, 1)], {type: "application/json"}); filename = fname("json"); }
    await saver.save({filename, data}); msg("Pronto: " + filename);
  } catch (e) { console.error(e); msg(e?.code === "declined" ? "Download cancelado." : e?.code === "rate_limited" ? "Já existe um download aberto. Tente de novo." : "Não consegui gerar o arquivo (" + (e?.message || e?.code || "erro") + ").", true); }
}

async function buildXlsx() {
  await loadLib("xl"); const x = X(), A = x.A, OF = x.OF, wb = new window.ExcelJS.Workbook(); wb.creator = "Mesa de Crédito Privada";
  const put = (ws, a, v, o = {}) => { const c = ws.getCell(a);
    if (v && typeof v === "object" && "f" in v) { c.value = {formula: v.f, result: nn(v.r) ? v.r : undefined}; c.font = {color: {argb: o.link ? XC.link : XC.ink}, bold: o.bold}; }
    else { c.value = v ?? null; c.font = {color: {argb: o.inp ? XC.inp : (o.mut ? XC.mut : XC.ink)}, bold: o.bold, italic: o.it}; }
    if (o.fmt) c.numFmt = o.fmt; if (o.note) c.note = o.note; if (o.fill) c.fill = {type: "pattern", pattern: "solid", fgColor: {argb: o.fill}}; return c; };
  const title = (ws, t, sub) => { put(ws, "A1", t, {bold: true}); ws.getCell("A1").font = {bold: true, size: 14, color: {argb: XC.acc}}; if (sub) put(ws, "A2", sub, {mut: true}); };
  const head = (ws, r, cols) => cols.forEach((h, i) => put(ws, colL(i) + r, h, {bold: true, fill: XC.head}));
  const oTxt = o => o ? `${ORIG[o.t]?.nome || o.t}: ${o.f || ORIG[o.t]?.txt || ""}` : "";
  const T = NY, YC = t => colL(2 + t); // colunas C..G para os anos 1..5 (B = ano 0)

  // ===== Leia-me =====
  const R0 = wb.addWorksheet("Leia-me"); R0.getColumn(1).width = 30; R0.getColumn(2).width = 110;
  title(R0, "Mesa de Crédito Privada · " + (A.emp.nome || ""), "Gerado em " + new Date().toLocaleString("pt-BR") + ". Valores em R$ mil, nominais.");
  [["Azul", "Entrada: dado (auditado, cliente, oficial) ou premissa. Pode editar; o modelo recalcula."], ["Preto", "Fórmula."], ["Verde", "Vínculo com outra aba."], ["Notas nas células", "Cada entrada traz a origem e a fonte na nota da célula."],
    ["Dados", "Demonstrações padronizadas e os 12 meses."], ["Premissas", "Premissas por ano."], ["Juros", "Selic por reunião do Copom (realizado, Focus, premissa) e CDI médio de cada ano."], ["Operação", "Cronograma desta operação."], ["Garantias", "Valor recuperável, cobertura e perda se quebrar."],
    ["Cenários", "Árvores de impacto nó a nó, com fórmulas, chance e % do impacto por ano."], ["Ajustes", "Variação de cada linha em cada caso: soma de impacto × % do ano × peso."], ["Projeção …", "Uma aba por caso, com o fluxo de caixa para o credor e os covenants."],
    ["Precificação", "Perda esperada, custo do capital, spread mínimo e retorno ajustado ao risco."], ["Pares", "Debêntures de pares (ANBIMA) e taxas dos bancos (Banco Central)."], ["Fontes", "Fontes oficiais e datas."]].forEach(([a, b], i) => { put(R0, "A" + (4 + i), a, {bold: true}); put(R0, "B" + (4 + i), b); });
  R0.getCell("A4").font = {bold: true, color: {argb: XC.inp}}; R0.getCell("A6").font = {bold: true, color: {argb: XC.link}};

  // ===== Dados =====
  const D = wb.addWorksheet("Dados", {views: [{state: "frozen", xSplit: 2, ySplit: 3}]}); title(D, "Demonstrações padronizadas (R$ mil)", "Fluxos de 12 meses = ano fechado + parcial atual − parcial anterior; saldos = última data.");
  D.getColumn(1).width = 28; D.getColumn(2).width = 44; for (let i = 3; i <= 8; i++) D.getColumn(i).width = 13;
  const per = x.per; head(D, 3, ["Line", "Em português", ...per.map(p => p.lab), "12 meses"]);
  const rD = {}; let r = 4; const hasP = INPUT_LINES.some(l => val(A, l.id, "p1") !== null);
  LINES.forEach(l => { rD[l.id] = r++; });
  LINES.forEach(l => { const rr = rD[l.id]; put(D, "A" + rr, l.en, {bold: !!l.calc}); put(D, "B" + rr, l.pt, {mut: true});
    per.forEach((p, i) => { const a = colL(2 + i) + rr;
      if (l.calc) { const f = {ebitda: `${colL(2 + i)}${rD.ebit}+${colL(2 + i)}${rD.da}`, divbruta: `${colL(2 + i)}${rD.divcp}+${colL(2 + i)}${rD.divlp}`, divliq: `${colL(2 + i)}${rD.divcp}+${colL(2 + i)}${rD.divlp}-${colL(2 + i)}${rD.caixa}`, giro: `${colL(2 + i)}${rD.receber}+${colL(2 + i)}${rD.estoques}-${colL(2 + i)}${rD.fornec}`}[l.id]; put(D, a, {f, r: colValues(A, p.k)[l.id]}, {fmt: XF.mi}); }
      else { const c = A.dem[l.id]?.[p.k]; put(D, a, nn(c?.v) ? c.v : null, {inp: true, fmt: XF.mi, note: c ? oTxt(c.o) : undefined}); } });
    const H = "H" + rr;
    if (l.calc) { const f = {ebitda: `H${rD.ebit}+H${rD.da}`, divbruta: `H${rD.divcp}+H${rD.divlp}`, divliq: `H${rD.divcp}+H${rD.divlp}-H${rD.caixa}`, giro: `H${rD.receber}+H${rD.estoques}-H${rD.fornec}`}[l.id]; put(D, H, {f, r: x.L[l.id]}, {fmt: XF.mi, bold: true}); }
    else put(D, H, {f: !hasP ? `E${rr}` : l.kind === "stock" ? `G${rr}` : `E${rr}+G${rr}-F${rr}`, r: x.L[l.id]}, {fmt: XF.mi, bold: true}); });
  const DL = id => `Dados!$H$${rD[id]}`;

  // ===== Premissas =====
  const P = wb.addWorksheet("Premissas", {views: [{state: "frozen", xSplit: 1, ySplit: 3}]}); title(P, "Premissas por ano", "Entradas em azul; a origem de cada linha está na coluna H.");
  P.getColumn(1).width = 44; for (let i = 2; i <= 7; i++) P.getColumn(i).width = 12; P.getColumn(8).width = 90;
  head(P, 3, ["Premissa", ...x.J.map(j => String(j.ano)), "", "Origem"]);
  const PR = [["g", "Revenue Growth · crescimento da receita", XF.pct], ["mg", "EBITDA Margin · margem EBITDA", XF.pct], ["da", "D&A ÷ Revenue · depreciação ÷ receita", XF.pct], ["capex", "Capex ÷ Revenue · investimento ÷ receita", XF.pct], ["dias", "Working Capital Days · dias de giro", "0"],
    ["ir", "Effective Tax Rate · IR e CSLL", XF.pct], ["payout", "Payout · dividendos ÷ lucro", XF.pct], ["spExist", "Spread on Existing Debt · custo acima do CDI", XF.pct], ["amExist", "Existing Debt Amortization · principal da dívida atual (R$ mil)", XF.mi], ["refin", "Rollover Rate · parte rolada dos vencimentos", XF.pct], ["rendCx", "Cash Yield · rendimento do caixa (% do CDI)", XF.pct]];
  const rP = {}; PR.forEach(([k, n, f], i) => { const rr = 4 + i; rP[k] = rr; put(P, "A" + rr, n); A.prem[k].forEach((v, t) => put(P, colL(1 + t) + rr, v, {inp: true, fmt: f})); put(P, "H" + rr, oTxt(A.premO[k]), {mut: true}); });
  const rIPCA = 4 + PR.length; put(P, "A" + rIPCA, "Inflation (IPCA) · Focus anual ou premissa"); x.I.forEach((v, t) => put(P, colL(1 + t) + rIPCA, v.ipca, {inp: true, fmt: XF.pct, note: nn(v.over) ? "premissa do analista" : `Focus anual de ${OF.focus.data}`})); put(P, "H" + rIPCA, `Banco Central, Focus de ${OF.focus.data}, mediana anual do IPCA`, {mut: true});
  const PRc = (k, t) => `Premissas!$${colL(1 + t)}$${rP[k]}`;

  // ===== Juros =====
  const J = wb.addWorksheet("Juros", {views: [{state: "frozen", ySplit: 3}]}); title(J, "Selic por reunião do Copom e CDI médio de cada ano", "Selic usada = sua premissa, se houver; senão o realizado ou o Focus.");
  [14, 12, 8, 14, 12, 12, 90].forEach((w, i) => J.getColumn(i + 1).width = w);
  head(J, 3, ["Reunião", "Data", "Ano", "Realizado ou Focus", "Sua premissa", "Selic usada", "Origem"]);
  const rows = selicPath(A, OF), rowJ = []; rows.forEach((q, i) => { const rr = 4 + i; rowJ.push({...q, rr});
    put(J, "A" + rr, q.r); put(J, "B" + rr, q.data || ""); put(J, "C" + rr, q.ano); put(J, "D" + rr, nn(q.real) ? q.real / 100 : nn(q.focus) ? q.focus / 100 : null, {inp: true, fmt: XF.pct}); put(J, "E" + rr, nn(q.over) ? q.over / 100 : null, {inp: true, fmt: XF.pct});
    put(J, "F" + rr, {f: `IF(E${rr}="",D${rr},E${rr})`, r: (nn(q.real) ? q.real : q.use) / 100}, {fmt: XF.pct}); put(J, "G" + rr, oTxt(q.src), {mut: true}); });
  let jr = 6 + rows.length; put(J, "A" + jr, "Diferença Selic − CDI (p.p.)", {bold: true}); put(J, "D" + jr, A.juros.cdiGap / 100, {inp: true, fmt: XF.pct}); const gapC = `$D$${jr}`; jr += 2;
  head(J, jr, ["Ano", "Selic média", "CDI", "", "", "", "Fórmula: (Selic de 1º de janeiro + reuniões 1 a 7) ÷ 8 − diferença"]); const cdiC = [];
  x.J.forEach((j, t) => { const rr = jr + 1 + t, ys = rowJ.filter(q => q.ano === j.ano), yp = rowJ.filter(q => q.ano === j.ano - 1);
    const refs = [yp[7] || yp[yp.length - 1], ...ys.slice(0, 7)].filter(Boolean).map(q => "F" + q.rr);
    put(J, "A" + rr, j.ano); put(J, "B" + rr, {f: `AVERAGE(${refs.join(",")})`, r: j.selic / 100}, {fmt: XF.pct}); put(J, "C" + rr, {f: `B${rr}-${gapC}`, r: j.cdi}, {fmt: XF.pct, bold: true}); cdiC.push(`Juros!$C$${rr}`); });

  // ===== Operação =====
  const OP = wb.addWorksheet("Operação"); title(OP, "Esta operação", "Desembolso no início do 1º ano projetado. Juros = saldo médio do ano × taxa do ano."); OP.getColumn(1).width = 42; for (let i = 2; i <= 7; i++) OP.getColumn(i).width = 13;
  const op = A.op, inp = [["Valor (R$ mil)", op.valor, XF.mi], ["Prazo total (meses)", op.prazo, "0"], ["Carência de principal (meses)", op.carencia, "0"], ["Spread ao ano", op.spread, XF.pct], ["Taxa prefixada ao ano", op.taxaPre, XF.pct], ["Dívida quitada (R$ mil)", op.quitar, XF.mi], ["Amortização (constante ou bullet)", op.amort, null], ["Indexador (CDI, IPCA ou PRE)", op.index, null]];
  inp.forEach(([n, v, f], i) => { put(OP, "A" + (4 + i), n); put(OP, "B" + (4 + i), v, {inp: true, fmt: f}); });
  const oc = k => `Operação!$B$${4 + ["valor", "prazo", "car", "spread", "pre", "quitar", "amort", "index"].indexOf(k)}`, ol = k => `$B$${4 + ["valor", "prazo", "car", "spread", "pre", "quitar", "amort", "index"].indexOf(k)}`;
  head(OP, 13, ["", ...x.J.map(j => String(j.ano))]); const OR = {t: 14, m: 15, ini: 16, pr: 17, fim: 18, r: 19, j: 20};
  [["t", "Ano da operação"], ["m", "Meses amortizando no ano"], ["ini", "Opening Balance · saldo no início"], ["pr", "Principal"], ["fim", "Closing Balance · saldo no fim"], ["r", "Annual Rate · taxa do ano"], ["j", "Interest · juros"]].forEach(([k, n]) => put(OP, "A" + OR[k], n));
  x.sched.forEach((s, t) => { const c = colL(1 + t), pc = colL(t);
    put(OP, c + OR.t, t + 1); put(OP, c + OR.m, {f: `MAX(0,MIN(12*${c}${OR.t},${ol("prazo")})-MAX(12*(${c}${OR.t}-1),${ol("car")}))`}, {fmt: "0"});
    put(OP, c + OR.ini, t ? {f: `${pc}${OR.fim}`, r: s.ini} : {f: ol("valor"), r: s.ini}, {fmt: XF.mi});
    put(OP, c + OR.pr, {f: `IF(${ol("amort")}="bullet",IF(AND(${ol("prazo")}>12*(${c}${OR.t}-1),${ol("prazo")}<=12*${c}${OR.t}),${c}${OR.ini},0),MIN(${c}${OR.ini},${c}${OR.m}*${ol("valor")}/(${ol("prazo")}-${ol("car")})))`, r: s.pr}, {fmt: XF.mi});
    put(OP, c + OR.fim, {f: `${c}${OR.ini}-${c}${OR.pr}`, r: s.fim}, {fmt: XF.mi});
    put(OP, c + OR.r, {f: `IF(${ol("index")}="CDI",(1+${cdiC[t]})*(1+${ol("spread")})-1,IF(${ol("index")}="IPCA",(1+Premissas!$${colL(1 + t)}$${rIPCA})*(1+${ol("spread")})-1,${ol("pre")}))`, r: s.r}, {fmt: XF.pct});
    put(OP, c + OR.j, {f: `(${c}${OR.ini}+${c}${OR.fim})/2*${c}${OR.r}`, r: s.juros}, {fmt: XF.mi}); });
  const OPc = (k, t) => `Operação!$${colL(1 + t)}$${OR[k]}`;

  // ===== Precificação (parâmetros usados também nas garantias) =====
  const PZ = wb.addWorksheet("Precificação"); PZ.getColumn(1).width = 56; PZ.getColumn(2).width = 14; PZ.getColumn(3).width = 14; PZ.getColumn(4).width = 14; PZ.getColumn(5).width = 80;
  const ZP = {funding: 4, opex: 5, capital: 6, roe: 7, rf: 8};
  title(PZ, "Precificação do spread", "Spread mínimo = captação + perda esperada + custo do capital + custo operacional");
  [["funding", "Funding Cost · captação acima do CDI"], ["opex", "Operating Cost · custo operacional e tributos"], ["capital", "Capital Ratio · capital exigido"], ["roe", "Target Return on Equity · meta de retorno"]].forEach(([k, n]) => { put(PZ, "A" + ZP[k], n); put(PZ, "B" + ZP[k], A.preco[k], {inp: true, fmt: XF.pct}); put(PZ, "E" + ZP[k], oTxt(A.preco.o[k]), {mut: true}); });
  put(PZ, "A" + ZP.rf, "Risk-free Rate · CDI atual"); put(PZ, "B" + ZP.rf, x.pr.rf, {inp: true, fmt: XF.pct}); put(PZ, "E" + ZP.rf, `${OF.cdi.fonte}, ${OF.cdi.data}`, {mut: true});

  // ===== Garantias =====
  const G = wb.addWorksheet("Garantias"); title(G, "Garantias e perda se quebrar", "Recuperação líquida = valor × (1 − encolhe na quebra) × (1 − desconto) × (1 − custo) ÷ (1 + r)^(meses/12)");
  [34, 34, 13, 12, 12, 12, 10, 13, 13, 70].forEach((w, i) => G.getColumn(i + 1).width = w);
  put(G, "A3", "Taxa r para trazer a hoje (CDI do 1º ano + captação)"); put(G, "C3", {f: `${cdiC[0]}+Precificação!$B$${ZP.funding}`, r: x.col.r}, {fmt: XF.pct, link: true});
  head(G, 5, ["Tipo", "Descrição", "Valor avaliado", "Desconto na venda", "Encolhe na quebra", "Custo de execução", "Meses", "Recuperável", "Recuperação líquida", "Origem"]);
  (A.gar || []).forEach((g, i) => { const rr = 6 + i; put(G, "A" + rr, GTIPOS[g.tipo].nome); put(G, "B" + rr, g.desc); put(G, "C" + rr, +g.valor || 0, {inp: true, fmt: XF.mi, note: oTxt(g.o)}); put(G, "D" + rr, g.h, {inp: true, fmt: XF.pct, note: oTxt(g.ho)}); put(G, "E" + rr, g.q, {inp: true, fmt: XF.pct}); put(G, "F" + rr, g.c, {inp: true, fmt: XF.pct}); put(G, "G" + rr, g.m, {inp: true, fmt: "0"});
    put(G, "H" + rr, {f: `C${rr}*(1-D${rr})`, r: x.col.rows[i].rec}, {fmt: XF.mi}); put(G, "I" + rr, {f: `C${rr}*(1-E${rr})*(1-D${rr})*(1-F${rr})/(1+$C$3)^(G${rr}/12)`, r: x.col.rows[i].liq}, {fmt: XF.mi}); put(G, "J" + rr, oTxt(g.o), {mut: true}); });
  const gl = 6 + Math.max(0, (A.gar || []).length - 1), gt = gl + 1;
  put(G, "A" + gt, "Total", {bold: true}); put(G, "H" + gt, {f: (A.gar || []).length ? `SUM(H6:H${gl})` : "0", r: x.col.recT}, {fmt: XF.mi, bold: true}); put(G, "I" + gt, {f: (A.gar || []).length ? `SUM(I6:I${gl})` : "0", r: x.col.liqT}, {fmt: XF.mi, bold: true});
  put(G, "A" + (gt + 2), "Exposure · valor da operação"); put(G, "C" + (gt + 2), {f: oc("valor"), r: x.col.EAD}, {fmt: XF.mi, link: true});
  put(G, "A" + (gt + 3), "Collateral Coverage · cobertura"); put(G, "C" + (gt + 3), {f: `IF(C${gt + 2}>0,H${gt}/C${gt + 2},"")`, r: x.col.cover}, {fmt: XF.x, bold: true});
  put(G, "A" + (gt + 4), "Loss Given Default · perda se quebrar"); put(G, "C" + (gt + 4), {f: `IF(C${gt + 2}>0,MAX(0,MIN(1,1-I${gt}/C${gt + 2})),"")`, r: x.col.lgd}, {fmt: XF.pct, bold: true}); const lgdC = `Garantias!$C$${gt + 4}`;

  // ===== Cenários =====
  const C = wb.addWorksheet("Cenários"); title(C, "Cenários e árvores de impacto", "Impacto anual = topo da árvore no cenário − topo hoje. % do ano por linha. Chance em %.");
  [16, 40, 14, 10, 14, 14, 12, 80].forEach((w, i) => C.getColumn(i + 1).width = w); let cr = 4; const TR = [];
  (A.cens || []).forEach(sc => {
    put(C, "A" + cr, "Cenário", {bold: true, fill: XC.sec}); put(C, "B" + cr, sc.nome, {bold: true, fill: XC.sec}); put(C, "C" + cr, "Ativo (1/0)", {fill: XC.sec}); put(C, "D" + cr, sc.ativo === false ? 0 : 1, {inp: true}); put(C, "E" + cr, "Chance %", {fill: XC.sec}); put(C, "F" + cr, sc.prob, {inp: true, note: oTxt(sc.probO)}); put(C, "H" + cr, sc.probJust || "", {mut: true});
    const ativoC = `$D$${cr}`, chanceC = `$F$${cr}`; cr++;
    put(C, "A" + cr, "% do impacto por ano"); const r0 = ramp(sc); const rampR = cr; x.J.forEach((j, t) => { put(C, colL(2 + t) + (cr - 0), r0[t] ?? 0, {inp: true, fmt: "0%"}); }); put(C, "H" + cr, "colunas C a G = " + x.J.map(j => j.ano).join(", ") + " · formato: " + (FORMAS[sc.forma]?.nome || "ajustado ano a ano"), {mut: true}); cr += 2;
    (sc.trees || []).forEach(tr => {
      put(C, "A" + cr, "Árvore", {bold: true}); put(C, "B" + cr, `${tr.titulo} · linha: ${TLINES[tr.linha].nome}`, {bold: true}); put(C, "C" + cr, "Usar (1/0)"); put(C, "D" + cr, tr.ativo === false ? 0 : 1, {inp: true});
      if (tr.linha === "receita") { put(C, "E" + cr, "Custo variável"); put(C, "F" + cr, tr.vcr, {inp: true, fmt: XF.pct}); } const useC = `$D$${cr}`, vcrC = `$F$${cr}`; cr++;
      head(C, cr, ["Código", "Nó", "Pai", "Tipo", "Hoje", "Cenário", "Unidade", "Origem / fórmula"]); cr++;
      const rowOf = {}; tr.nos.forEach((n, k) => rowOf[n.id] = cr + k); const ev = evalTree(tr);
      const conv = (src, col) => tokenize(String(src || "0")).map(tk => rowOf[tk] ? col + rowOf[tk] : /^(max|min|abs)$/i.test(tk) ? tk.toUpperCase() : tk).join("");
      tr.nos.forEach(n => { const rr = rowOf[n.id]; put(C, "A" + rr, n.id, {mut: true}); put(C, "B" + rr, n.nome); put(C, "C" + rr, n.pai || "topo", {mut: true}); put(C, "D" + rr, n.tipo);
        if (n.tipo === "formula") { put(C, "E" + rr, {f: conv(n.formula, "E"), r: ev.vals[n.id].base}, {fmt: XF.n}); put(C, "F" + rr, {f: conv(n.formula, "F"), r: ev.vals[n.id].cen}, {fmt: XF.n}); put(C, "H" + rr, n.formula, {mut: true}); }
        else { put(C, "E" + rr, +n.base || 0, {inp: true, fmt: XF.n}); put(C, "F" + rr, +n.cen || 0, {inp: true, fmt: XF.n}); put(C, "H" + rr, oTxt(n.o), {mut: true}); } put(C, "G" + rr, n.unid || ""); });
      cr += tr.nos.length; const root = tr.nos.find(n => !n.pai) || tr.nos[0];
      put(C, "B" + cr, "Annual Impact · impacto anual (R$ mil)", {bold: true}); put(C, "F" + cr, {f: `F${rowOf[root.id]}-E${rowOf[root.id]}`, r: ev.delta}, {fmt: XF.mi, bold: true});
      TR.push({linha: tr.linha, imp: `Cenários!$F$${cr}`, use: `Cenários!${useC}`, ativo: `Cenários!${ativoC}`, chance: `Cenários!${chanceC}`, vcr: `Cenários!${vcrC}`, ramp: t => `Cenários!$${colL(2 + t)}$${rampR}`}); cr += 2; });
    cr++; });

  // ===== Ajustes =====
  const AJ = wb.addWorksheet("Ajustes"); title(AJ, "Ajustes dos cenários por caso (R$ mil)", "Δ linha no ano = Σ impacto × % do ano × peso × ativo. Peso: base 0; moderado = chance; estresse = 1; esperado = pesos dos casos.");
  AJ.getColumn(1).width = 46; put(AJ, "A3", "Peso do caso base (%)"); put(AJ, "B3", A.casos.base, {inp: true}); put(AJ, "A4", "Peso do caso moderado (%)"); put(AJ, "B4", A.casos.moderado, {inp: true}); put(AJ, "A5", "Peso do caso estresse (%)"); put(AJ, "B5", A.casos.estresse, {inp: true});
  const AJL = [["receita", "Δ Revenue · receita"], ["recMargin", "Δ EBITDA from revenue · margem de contribuição"], ["custos", "Δ Cash Costs · custos"], ["juros", "Δ Interest · juros"], ["capex", "Δ Capex"], ["giro", "Δ Working Capital · giro (saldo)"], ["dividendos", "Δ Dividends · dividendos"], ["saidas", "Other Cash Outflows · outras saídas"]];
  const wF = {base: () => "0", moderado: tr => `${tr.chance}/100`, estresse: () => "1", esperado: tr => `($B$4*${tr.chance}/100+$B$5)/($B$3+$B$4+$B$5)`};
  let ar = 7; const AJc = {};
  Object.keys(CASES).forEach(c => { put(AJ, "A" + ar, "Caso " + CASES[c], {bold: true, fill: XC.sec}); x.J.forEach((j, t) => put(AJ, colL(1 + t) + ar, j.ano, {bold: true, fill: XC.sec})); ar++; AJc[c] = {};
    const d = scenarioDeltas(A, caseWeightFn(A, c));
    AJL.forEach(([k, n]) => { put(AJ, "A" + ar, n); AJc[c][k] = ar;
      x.J.forEach((j, t) => { const terms = TR.filter(tr => k === "recMargin" ? tr.linha === "receita" : tr.linha === k).map(tr => `${tr.imp}*${tr.ramp(t)}*${wF[c](tr)}*${tr.use}*${tr.ativo}${k === "recMargin" ? `*(1-${tr.vcr})` : ""}`);
        put(AJ, colL(1 + t) + ar, {f: terms.length ? terms.join("+") : "0", r: d[k][t]}, {fmt: XF.mi}); }); ar++; }); ar++; });
  const AJr = (c, k, t) => `Ajustes!$${colL(1 + t)}$${AJc[c][k]}`;

  // ===== Projeção por caso =====
  const PROW = [["ano", "Year · ano"], ["baseRev", "Base Revenue · receita sem cenários"], ["dRec", "Δ Revenue · cenários"], ["rec", "Revenue · receita"], ["dMg", "Δ EBITDA from revenue · cenários"], ["dCust", "Δ Cash Costs · cenários"], ["ebitda", "EBITDA"], ["da", "D&A · depreciação"], ["cdi", "CDI"],
    ["exIni", "Existing Debt, opening · dívida atual no início"], ["amEx", "Existing Debt Amortization · principal da dívida atual"], ["roll", "Rolled · parte rolada"], ["exFim", "Existing Debt, closing · dívida atual no fim"], ["jEx", "Interest on Existing Debt · juros da dívida atual"], ["jOp", "Interest on this Loan · juros desta operação"], ["dJ", "Δ Interest · cenários"], ["juros", "Interest · juros totais"],
    ["recfin", "Financial Income · receita financeira"], ["lair", "Pre-tax Income · lucro antes dos impostos"], ["imp", "Income Taxes Paid · impostos pagos"], ["lucro", "Net Income · lucro líquido"], ["nwc", "Working Capital · capital de giro"], ["dWC", "Δ Working Capital · aumento do giro"], ["capex", "Capex · investimentos"], ["saidas", "Other Cash Outflows · outras saídas"],
    ["cads", "Cash Available for Debt Service · caixa disponível"], ["princ", "Principal · principal total"], ["ds", "Debt Service · juros + principal"], ["dscr", "Debt Service Coverage · cobertura"], ["dscrR", "Coverage after Refinancing · cobertura com rolagem"], ["divid", "Dividends · dividendos"], ["cash", "Cash · caixa no fim do ano"], ["divb", "Gross Debt · dívida bruta"], ["nd", "Net Debt · dívida líquida"], ["lev", "Net Debt ÷ EBITDA"], ["icr", "EBITDA ÷ Interest Expense"]];
  Object.keys(CASES).forEach(c => {
    const W = wb.addWorksheet("Projeção " + CASES[c], {views: [{state: "frozen", xSplit: 1, ySplit: 4}]}); title(W, `Projeção · caso ${CASES[c]}`, caseTxt(c)); W.getColumn(1).width = 52; for (let i = 2; i <= 7; i++) W.getColumn(i).width = 13;
    const R = {}; PROW.forEach(([k], i) => R[k] = 4 + i); const res = x.cases[c];
    PROW.forEach(([k, n]) => put(W, "A" + R[k], n, {bold: ["rec", "ebitda", "cads", "dscr", "cash"].includes(k)}));
    put(W, "B" + R.ano, "12 meses", {bold: true}); put(W, "B" + R.baseRev, {f: DL("receita"), r: x.L.receita}, {link: true, fmt: XF.mi}); put(W, "B" + R.rec, {f: "B" + R.baseRev}, {fmt: XF.mi});
    put(W, "B" + R.exFim, {f: `${DL("divbruta")}-MIN(${oc("quitar")},${DL("divbruta")})`}, {link: true, fmt: XF.mi}); put(W, "B" + R.nwc, {f: DL("giro"), r: x.L.giro}, {link: true, fmt: XF.mi}); put(W, "B" + R.cash, {f: `${DL("caixa")}+${oc("valor")}-MIN(${oc("quitar")},${DL("divbruta")})`}, {link: true, fmt: XF.mi});
    put(W, "B" + R.ebitda, {f: DL("ebitda"), r: x.L.ebitda}, {link: true, fmt: XF.mi});
    for (let t = 0; t < T; t++) { const cc = YC(t), p = colL(1 + t), q = rr => cc + R[rr], pq = rr => p + R[rr], o = res[t];
      const F = (k, f, r, fm = XF.mi, link) => put(W, cc + R[k], {f, r}, {fmt: fm, link});
      put(W, cc + R.ano, o.ano, {bold: true});
      F("baseRev", `${pq("baseRev")}*(1+${PRc("g", t)})`, o.baseRev); F("dRec", AJr(c, "receita", t), o.rec - o.baseRev, XF.mi, true); F("rec", `${q("baseRev")}+${q("dRec")}`, o.rec);
      F("dMg", AJr(c, "recMargin", t), null, XF.mi, true); F("dCust", AJr(c, "custos", t), null, XF.mi, true); F("ebitda", `${q("baseRev")}*${PRc("mg", t)}+${q("dMg")}-${q("dCust")}`, o.ebitda); F("da", `${q("rec")}*${PRc("da", t)}`, o.da);
      F("cdi", cdiC[t], o.cdi, XF.pct, true); F("exIni", pq("exFim"), null); F("amEx", `MIN(${q("exIni")},${PRc("amExist", t)})`, o.amEx); F("roll", `${q("amEx")}*${PRc("refin", t)}`, o.roll); F("exFim", `${q("exIni")}-${q("amEx")}+${q("roll")}`, o.exist);
      F("jEx", `(${q("exIni")}+${q("exFim")})/2*((1+${q("cdi")})*(1+${PRc("spExist", t)})-1)`, o.jurosEx); F("jOp", OPc("j", t), o.jurosOp, XF.mi, true); F("dJ", AJr(c, "juros", t), null, XF.mi, true); F("juros", `${q("jEx")}+${q("jOp")}+${q("dJ")}`, o.juros);
      F("recfin", `MAX(${pq("cash")},0)*${q("cdi")}*${PRc("rendCx", t)}`, o.recfin); F("lair", `${q("ebitda")}-${q("da")}-${q("juros")}+${q("recfin")}`, null); F("imp", `MAX(0,${q("lair")})*${PRc("ir", t)}`, o.imp); F("lucro", `${q("lair")}-${q("imp")}`, o.lucro);
      F("nwc", `${q("rec")}*${PRc("dias", t)}/365+${AJr(c, "giro", t)}`, o.nwc); F("dWC", `${q("nwc")}-${pq("nwc")}`, o.dWC); F("capex", `${q("rec")}*${PRc("capex", t)}+${AJr(c, "capex", t)}`, o.capex); F("saidas", AJr(c, "saidas", t), o.saidas, XF.mi, true);
      F("cads", `${q("ebitda")}-${q("imp")}-${q("dWC")}-${q("capex")}-${q("saidas")}`, o.cads); F("princ", `${q("amEx")}+${OPc("pr", t)}`, o.principal); F("ds", `${q("juros")}+${q("princ")}`, o.ds);
      F("dscr", `IF(${q("ds")}>0,${q("cads")}/${q("ds")},"")`, o.dscr, XF.x); F("dscrR", `IF(${q("ds")}-${q("roll")}>0,${q("cads")}/(${q("ds")}-${q("roll")}),"")`, o.dscrR, XF.x);
      F("divid", `MAX(0,${q("lucro")})*${PRc("payout", t)}+${AJr(c, "dividendos", t)}`, o.divid); F("cash", `${pq("cash")}+${q("cads")}-${q("ds")}+${q("roll")}+${q("recfin")}-${q("divid")}`, o.cash);
      F("divb", `${q("exFim")}+${OPc("fim", t)}`, o.divbruta); F("nd", `${q("divb")}-${q("cash")}`, o.nd); F("lev", `IF(${q("ebitda")}>0,${q("nd")}/${q("ebitda")},"")`, o.lev, XF.x); F("icr", `IF(${q("juros")}>0,${q("ebitda")}/${q("juros")},"")`, o.icr, XF.x); }
    let rr = R.icr + 2; put(W, "A" + rr, "Covenants", {bold: true, fill: XC.sec}); rr++;
    A.covs.forEach(cv => { const m = COVM[cv.m], k = {lev: "lev", icr: "icr", dscr: "dscr"}[cv.m]; put(W, "A" + rr, `${m.en} ${m.tipo === "max" ? "≤" : "≥"}`); put(W, "B" + rr, cv.lim, {inp: true, fmt: XF.x, note: oTxt(cv.o)});
      for (let t = 0; t < T; t++) put(W, YC(t) + rr, {f: `IF(${YC(t)}${R[k]}="","",IF(${YC(t)}${R[k]}${m.tipo === "max" ? "<=" : ">="}$B$${rr},"ok","QUEBRA"))`}); rr++; });
  });

  // ===== Precificação (resto) =====
  const pb = x.pr.pb; let zr = 11; head(PZ, zr, ["Chance de calote", "Chance do cenário", "Nota", "Chance de calote", "Origem"]); zr++;
  put(PZ, "A" + zr, "Caso base"); put(PZ, "C" + zr, pb.base.nota); put(PZ, "D" + zr, pb.base.pd, {inp: true, fmt: XF.pct}); put(PZ, "E" + zr, "nota interna calculada na ferramenta com a escala da aba Rating abaixo", {mut: true}); const pdB = `D${zr}`; zr++;
  const z0 = zr; pb.scs.forEach(s => { put(PZ, "A" + zr, s.sc.nome); const tr = TR.find(q => q); put(PZ, "B" + zr, s.p, {inp: true, fmt: "0%"}); put(PZ, "C" + zr, s.r.nota); put(PZ, "D" + zr, s.r.pd, {inp: true, fmt: XF.pct}); put(PZ, "E" + zr, "nota se o cenário acontecer inteiro", {mut: true}); zr++; });
  const z1 = zr - 1, sp = pb.scs.length ? `SUM(B${z0}:B${z1})` : "0";
  put(PZ, "A" + zr, "Probability of Default · base + Σ chance × (PD do cenário − PD base)", {bold: true}); put(PZ, "D" + zr, {f: pb.scs.length ? `MAX(0,MIN(1,${pdB}+SUMPRODUCT(B${z0}:B${z1},D${z0}:D${z1})-${sp}*${pdB}))` : pdB, r: pb.pd}, {fmt: XF.pct, bold: true}); const pdC = `$D$${zr}`; zr += 2;
  const ZR = [["lgd", "Loss Given Default · perda se quebrar", `${lgdC}`, x.pr.col.lgd, true], ["el", "Expected Loss · perda esperada", `${pdC}*B{lgd}`, x.pr.EL], ["cap", "Capital Charge · custo do capital", `$B$${ZP.capital}*($B$${ZP.roe}-$B$${ZP.rf})`, x.pr.cap],
    ["min", "Minimum Spread · spread mínimo", `$B$${ZP.funding}+B{el}+B{cap}+$B$${ZP.opex}`, x.pr.min], ["sp", "Proposed Spread · spread proposto", oc("spread"), A.op.spread, true], ["folga", "Folga sobre o mínimo", "B{sp}-B{min}", x.pr.folga],
    ["raroc", "Risk-adjusted Return · retorno ajustado ao risco", `(B{sp}-$B$${ZP.funding}-B{el}-$B$${ZP.opex})/$B$${ZP.capital}+$B$${ZP.rf}`, x.pr.raroc]];
  const zRow = {}; ZR.forEach(([k], i) => zRow[k] = zr + i);
  ZR.forEach(([k, n, f, r, link]) => { put(PZ, "A" + zRow[k], n, {bold: k === "min" || k === "raroc"}); put(PZ, "B" + zRow[k], {f: f.replace(/\{(\w+)\}/g, (_, a) => zRow[a]), r}, {fmt: XF.pct, link, bold: k === "min" || k === "raroc"}); });
  zr += ZR.length + 2; put(PZ, "A" + zr, "Rating interno (caso base)", {bold: true, fill: XC.sec}); zr++;
  head(PZ, zr, ["Critério", "Valor", "Pontos", "Peso %"]); zr++; pb.base.items.forEach(it => { put(PZ, "A" + zr, it.nome + " · " + it.pt); put(PZ, "B" + zr, nn(it.v) ? it.v : String(it.v), {fmt: XF.n}); put(PZ, "C" + zr, it.s, {fmt: "0"}); put(PZ, "D" + zr, it.w, {inp: true}); zr++; });
  put(PZ, "A" + zr, "Nota (média ponderada dos pontos)", {bold: true}); put(PZ, "C" + zr, {f: `SUMPRODUCT(C${zr - pb.base.items.length}:C${zr - 1},D${zr - pb.base.items.length}:D${zr - 1})/SUM(D${zr - pb.base.items.length}:D${zr - 1})`, r: pb.base.score}, {fmt: "0.0", bold: true}); zr += 2;
  head(PZ, zr, ["Escala: nota", "Pontos mínimos", "Chance de calote"]); zr++; A.rating.escala.forEach(g => { put(PZ, "A" + zr, g.nota); put(PZ, "B" + zr, g.min, {inp: true}); put(PZ, "C" + zr, g.pd, {inp: true, fmt: XF.pct}); zr++; }); put(PZ, "A" + zr, oTxt(A.rating.escalaO), {mut: true});

  // ===== Pares =====
  const PA = wb.addWorksheet("Pares"); title(PA, "Pares de mercado", `${OF.anbima.fonte} · ${OF.bancos.fonte}`); [12, 50, 12, 12, 12, 12, 12, 14, 50].forEach((w, i) => PA.getColumn(i + 1).width = w);
  head(PA, 4, ["Código", "Emissor", "Vencimento", "Taxa indicativa (DI +)", "Prazo médio (anos)", "Ajuste porte", "Ajuste garantia", "Ajuste prazo", "Comparável (DI +)", "Por que é par"]); let pr2 = 5;
  A.pares.map(c => OF.anbima.deb.find(d => d.c === c)).filter(Boolean).forEach(d => { const a = A.parAj[d.c] || {}; put(PA, "A" + pr2, d.c); put(PA, "B" + pr2, d.n); put(PA, "C" + pr2, d.v); put(PA, "D" + pr2, d.t / 100, {inp: true, fmt: XF.pct, note: OF.anbima.fonte}); put(PA, "E" + pr2, nn(d.d) ? d.d / 252 : null, {fmt: "0.0"});
    ["porte", "gar", "prazo"].forEach((k, i) => put(PA, colL(5 + i) + pr2, a[k] || 0, {inp: true, fmt: XF.pct})); put(PA, "I" + pr2, {f: `D${pr2}+F${pr2}+G${pr2}+H${pr2}`}, {fmt: XF.pct}); put(PA, "J" + pr2, a.porque || "", {mut: true}); pr2++; });
  pr2 += 2; head(PA, pr2, ["Banco", "Modalidade", "Taxa ao ano", "Spread implícito sobre o CDI"]); pr2++;
  bankStats(OF, "Capital de giro com prazo superior a 365 dias - Pós-fixado referenciado em juros flutuantes").rows.forEach(b => { put(PA, "A" + pr2, b.banco); put(PA, "B" + pr2, "Capital de giro > 1 ano, pós"); put(PA, "C" + pr2, b.taxa, {inp: true, fmt: XF.pct}); put(PA, "D" + pr2, {f: `(1+C${pr2})/(1+Precificação!$B$${ZP.rf})-1`, r: b.spread}, {fmt: XF.pct}); pr2++; });

  // ===== Fontes =====
  const FO = wb.addWorksheet("Fontes"); FO.getColumn(1).width = 80; FO.getColumn(2).width = 90; title(FO, "Fontes oficiais");
  [[OF.copom.fonte, OF.copom.link], [OF.focus.fonte, OF.focus.link], [OF.ipca.fonte, OF.ipca.link], [OF.cdi.fonte + ", " + OF.cdi.data, OF.cdi.link], [OF.bancos.fonte, OF.bancos.link], [OF.anbima.fonte, OF.anbima.link]].forEach(([a, b], i) => { put(FO, "A" + (3 + i), a); put(FO, "B" + (3 + i), b); });
  A.noticias.forEach((n, i) => { put(FO, "A" + (11 + i), `${n.veiculo} · ${n.data} · ${n.titulo}`); put(FO, "B" + (11 + i), `${n.link} · ${n.uso}`); });
  wb.calcProperties = {fullCalcOnLoad: true};
  return new Blob([await wb.xlsx.writeBuffer()], {type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
}

// ---------- PDF: páginas A4 montadas e fotografadas ----------
async function buildPdf() {
  await loadLib("h2c"); await loadLib("jspdf"); const x = X(), A = x.A, pr = x.pr;
  const pg = (t, body, n) => `<div class="pdfpg"><div class="pdfh"><b>${esc(A.emp.nome || "Análise de crédito")}</b><span>${esc(t)}</span></div><div class="pdfb">${body}</div><div class="pdff"><span>Mesa de Crédito Privada · ${new Date().toLocaleDateString("pt-BR")}</span><span>${n}</span></div></div>`;
  const R = x.cases.esperado, B = x.cases.base, E = x.cases.estresse, risk = risks(x);
  const tb = (rows, cols) => `<table class="tight"><thead><tr>${cols.map(c => `<th class="r">${c}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  const line = (n, f, rs, fx = mil) => `<tr><td>${n}</td>${rs.map(r => `<td class="r">${fx(f(r))}</td>`).join("")}</tr>`;
  const pages = [
    pg("Parecer", `<h2>${{aprovar: "Aprovar", condicoes: "Aprovar com condições", recusar: "Recusar"}[A.parecer.rec]}</h2><p class="small muted">${esc(A.op.instrumento)} de R$ ${fmt(A.op.valor)} mil · ${A.op.prazo} meses · ${A.op.index} + ${pct(A.op.spread, 2)} · garantias: ${(A.gar || []).map(g => GTIPOS[g.tipo].nome).join(", ") || "nenhuma"}</p>
      <div class="kpis">${kpi("Nota interna", pr.pb.base.nota)}${kpi("Cobertura, pior ano esperado", xx(worst(R, "dscr").dscr))}${kpi("Cobertura de garantias", xx(x.col.cover))}${kpi("Perda esperada", pct(pr.EL, 2))}${kpi("Spread mínimo", pct(pr.min, 2))}</div>
      <h3>Riscos principais</h3><ol class="small">${risk.slice(0, 5).map(r => `<li><b>${esc(r.s.nome)}</b> (chance ${fmt(r.s.prob)}%): cobertura do serviço vai a ${xx(r.v)} em ${r.ano}.${r.s.mitigante ? " Mitigante: " + esc(r.s.mitigante) + "." : ""}</li>`).join("")}</ol>
      <h3>Condições</h3><p class="small pre">${esc(A.parecer.condicoes || "Nenhuma registrada.")}</p><h3>Parecer</h3><div class="small pre">${esc(A.parecer.texto || "Texto do parecer não preenchido.")}</div>`, 1),
    pg("Capacidade de pagamento (caso esperado)", tb([line("Receita", r => r.rec, R), line("EBITDA", r => r.ebitda, R), line("Caixa disponível para a dívida", r => r.cads, R), line("Juros", r => r.juros, R), line("Principal", r => r.principal, R), line("Cobertura do serviço", r => r.dscr, R, xx), line("Dívida líquida ÷ EBITDA", r => r.lev, R, xx), line("Caixa no fim do ano", r => r.cash, R)], ["R$ mil", ...R.map(r => r.ano)]) +
      `<h3>Cobertura do serviço por caso</h3>` + tb(["base", "moderado", "estresse", "esperado"].map(c => line(CASES[c], r => r.dscr, x.cases[c], xx)), ["Caso", ...R.map(r => r.ano)]) + `<p class="small muted">${esc(caseTxt("esperado"))}</p>`, 2),
    pg("Garantias e covenants", tb(x.col.rows.map(g => `<tr><td>${esc(GTIPOS[g.tipo].nome)} ${esc(g.desc)}</td><td class="r">${mil(g.valor)}</td><td class="r">${pct(g.h, 0)}</td><td class="r">${mil(g.rec)}</td><td class="r">${mil(g.liq)}</td></tr>`), ["Garantia", "Valor", "Desconto", "Recuperável", "Recuperação líquida"]) +
      `<p class="small">Cobertura ${xx(x.col.cover)} · perda se quebrar ${pct(x.col.lgd, 0)}</p><h3>Covenants</h3>` + tb(A.covs.map(cv => { const m = COVM[cv.m]; return `<tr><td>${esc(m.en)}</td><td class="r">${m.tipo === "max" ? "≤" : "≥"} ${xx(cv.lim)}</td><td class="r">${xx(B[0][m.k])}</td><td class="r">${xx(worst(B, m.k, m.tipo === "min")[m.k])}</td><td class="r">${xx(worst(E, m.k, m.tipo === "min")[m.k])}</td></tr>`; }), ["Covenant", "Limite", "1º ano", "Pior, base", "Pior, estresse"]) +
      `<h3>Cláusulas</h3><ul class="small">${A.clausulas.map(c => `<li>${esc(c)}</li>`).join("")}</ul>`, 3),
    pg("Cenários", tb(risk.map(r => `<tr><td>${esc(r.s.nome)}<div class="tr">${esc(r.s.como)} Gatilho: ${esc(r.s.gatilho)}</div></td><td class="r">${fmt(r.s.prob)}%</td><td class="r">${esc(FORMAS[r.s.forma]?.nome || "ajustado")}</td><td class="r">${xx(r.v)} (${r.ano})</td></tr>`), ["Cenário", "Chance", "Quando chega", "Cobertura se acontecer"]), 4),
    pg("Precificação", `<div class="kpis">${kpi("Chance de calote", pct(pr.pb.pd, 2))}${kpi("Perda se quebrar", pct(pr.col.lgd, 0))}${kpi("Perda esperada", pct(pr.EL, 2))}${kpi("Custo do capital", pct(pr.cap, 2))}${kpi("Spread mínimo", pct(pr.min, 2))}${kpi("Retorno ajustado ao risco", pct(pr.raroc, 1))}</div>
      <p class="small">Spread mínimo = captação ${pct(A.preco.funding, 2)} + perda esperada ${pct(pr.EL, 2)} + custo do capital ${pct(pr.cap, 2)} + custo operacional ${pct(A.preco.opex, 2)}. Proposto: ${pct(A.op.spread, 2)}.</p><h3>Pares (ANBIMA, ${esc(x.OF.anbima.data.split("-").reverse().join("/"))})</h3>` +
      tb(A.pares.map(c => x.OF.anbima.deb.find(d => d.c === c)).filter(Boolean).map(d => `<tr><td>${esc(d.c)} ${esc(d.n)}</td><td class="r">DI + ${fmt(d.t, 2)}%</td><td class="r">${esc(A.parAj[d.c]?.porque || "")}</td></tr>`), ["Emissor", "Taxa indicativa", "Por que é par"]), 5),
  ];
  const host = document.createElement("div"); host.className = "pdfhost"; host.innerHTML = pages.join(""); document.body.appendChild(host);
  try { const doc = new window.jspdf.jsPDF({unit: "px", format: [794, 1123], hotfixes: ["px_scaling"]}); const els = [...host.querySelectorAll(".pdfpg")];
    for (let i = 0; i < els.length; i++) { const cv = await window.html2canvas(els[i], {scale: 2, backgroundColor: "#ffffff", logging: false}); if (i) doc.addPage([794, 1123]); doc.addImage(cv.toDataURL("image/jpeg", .9), "JPEG", 0, 0, 794, 1123); }
    return doc.output("blob"); } finally { host.remove(); }
}
