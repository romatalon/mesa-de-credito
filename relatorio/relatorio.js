// =====================================================================
// O relatório: 3 páginas A4 montadas a partir da bancada (prévia ao vivo)
// e a exportação em PDF e PowerPoint.
// Marcas de origem no relatório: ¹ reportado ² cálculo ³ premissa ⁴ Claude
// =====================================================================
"use strict";
const SUP = {rep: "¹", calc: "²", prem: "³", claude: "⁴", ofi: "⁵"};
const sup = o => `<sup>${SUP[o?.t] || ""}</sup>`;
const FIG_ROWS = ["receita", "ebitda", "mg_ebitda", "lucro", "caixa", "div_bruta", "div_liq", "dl_ebitda", "ebitda_desp", "caixa_divcp", "divcp_total", "liq_corrente"];
const ORDEM = {p1: ["merc", "macro"], p2: ["fin", "jur", "fisc"], p3: ["gen"]};

function blocos(ctxs) {
  return S.A.cx.filter(c => c.marca !== "nao" && ctxs.includes(c.ctx)).sort((a, b) => ctxs.indexOf(a.ctx) - ctxs.indexOf(b.ctx)).map(c => {
    const t = txtCx(c), em = c.marca === "enfase";
    let txt = esc(t.texto);
    if (em) { const m = txt.match(/^(.+?[.!?])(\s|$)/); if (m) txt = `<span class="emph">${m[1]}</span>${txt.slice(m[1].length)}`; }
    return `<p class="blk"><b class="tt"${em ? ' style="color:#163F80"' : ""}>${esc(t.titulo)}:</b> ${txt}${sup(c.alt?.[c.marca] ? {t: "claude"} : c.o)}</p>`;
  }).join("");
}
function figura01(x) {
  const co = x.co, head = linha(x, RBY.receita);
  return `<div class="fig">Figura 01: Indicadores financeiros · ${esc(co.moeda || "R$")} milhões${co.semConf ? " · SEC EDGAR, sem conferência" : ""} · colunas com "p" = projeção, caso ${CASOS[S.caso].toLowerCase()}</div><table><thead><tr><th>${esc(co.comercial)}</th>${head.map(c => `<th${c.proj ? ' style="background:#DCE5F3"' : ""}>${esc(c.lab)}</th>`).join("")}</tr></thead><tbody>
    ${FIG_ROWS.map(id => { const r = RBY[id], L = co.periodos.length - 1, cells = linha(x, r), ltm = cells.find(c => c.col.tipo === "ltm")?.v, ant = r.r ? co.R[r.r]?.[L - 1] : null, cor = r.kind === "ratio" ? tom(r, ltm, ant) : "";
      return `<tr><td>${esc(r.pt.length > 34 ? r.en : r.pt)}${sup({t: r.r ? "calc" : r.tag})}</td>${cells.map(c => `<td${c.proj ? ' style="background:#F3F6FB;color:#3F4855"' : ""}>${c.v == null ? "–" : c.col.tipo === "ltm" && cor ? `<span style="color:${cor.includes("ok") ? "#1E5B2A" : "#A3271B"};font-weight:600">${val(r, c.v)}</span>` : val(r, c.v)}</td>`).join("")}</tr>`; }).join("")}</tbody></table>
    <div class="src">Ratios dos últimos 12 meses em verde melhoraram e em vermelho pioraram contra o último ano fechado.</div>
    ${(S.A.aj || []).some(a => a.ativo !== false) ? (() => { const m = metricasAj(co, S.A); return `<div class="src" style="color:#1B2430"><b>Alavancagem ajustada, 12 meses: ${xx(m.levA, 2)}</b> (dívida líquida ajustada ${mi(m.dlA)} ÷ EBITDA ajustado ${mi(m.ebA)})${sup({t: "prem"})}. Ajustes: ${S.A.aj.filter(a => a.ativo !== false).map(a => `${esc(a.nome)} ${mi(+a.valor)}${a.fonte ? " (" + esc(a.fonte) + ")" : ""}`).join("; ")}.</div>`; })() : ""}`;
}
function opsTab() {
  const O = S.A.ops, rs = (O?.rows || []).filter(r => r.ativo !== false); if (!rs.length) return "";
  return `<div class="fig">Indicadores operacionais${sup({t: "claude"})}</div><table><thead><tr><th>Indicador</th>${O.cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rs.map(r => `<tr><td>${esc(r.nome)}${r.unid ? ` <span style="color:#5B6573">(${esc(r.unid)})</span>` : ""}</td>${O.cols.map((c, j) => `<td>${r.vals[j] == null || r.vals[j] === "" ? "–" : esc(String(r.vals[j]))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}
function grafHist(x, w) {
  const co = x.co, anos = co.periodos.slice(0, -1).slice(-S.anos), L = co.periodos.length - 1, idx = anos.map(a => co.periodos.indexOf(a)).concat([L]), P = x.cases[S.caso];
  const cats = anos.concat(["12m"]).concat(P.map(y => y.ano + "p"));
  return bars(cats, [{nome: "Receita líquida", vals: idx.map(i => co.F.receita[i]).concat(P.map(y => y.rec)), cor: GC.hist, corProj: GC.proj}, {nome: "EBITDA", vals: idx.map(i => co.F.ebitda[i]).concat(P.map(y => y.ebitda)), cor: GC.ebitda, corProj: GC.ebitdaP}], {nHist: idx.length, w: w || 680, h: 200, aria: "Receita e EBITDA"});
}
function grafLev(x, w) {
  const co = x.co, anos = co.periodos.slice(0, -1).slice(-S.anos), L = co.periodos.length - 1, idx = anos.map(a => co.periodos.indexOf(a)).concat([L]);
  const cats = anos.concat(["12m"]).concat(x.cases.base.map(y => y.ano + "p"));
  return lines(cats, Object.keys(CASOS).map(c => ({nome: CASOS[c], cor: CASE_COLOR[c], tracejado: c !== "base", vals: idx.map(i => co.R.dl_ebitda[i]).concat(x.cases[c].map(y => y.lev === Infinity ? null : y.lev))})), {nHist: idx.length, unit: "x", w: w || 680, h: 190, aria: "Alavancagem por caso"});
}
function cenTab(x) {
  const cs = S.A.cens.filter(s => s.ativo); if (!cs.length) return `<p class="muted">Nenhum cenário marcado.</p>`;
  const base = x.cases.base;
  return `<div class="fig">Figura 02: Cenários e efeito na alavancagem do primeiro ano</div><table><thead><tr><th>Cenário</th><th>Tipo</th><th>Chance</th><th>Quando chega</th><th>Alavancagem se acontecer</th></tr></thead><tbody>
    ${cs.map(s => { const o = runOnly(x.co, S.A.P, S.A.cens, s); return `<tr><td>${esc(s.nome)}${sup(s.o)}</td><td>${s.tipo}</td><td>${s.chance}%</td><td>${esc(FORMAS[s.forma]?.nome || "ajustado")}</td><td>${xx(base[0].lev, 1)} → ${xx(o[0].lev, 1)}</td></tr>`; }).join("")}</tbody></table>`;
}
function projTab(x) {
  const c = S.caso, rows = x.cases[c];
  const ln = (n, f, fx) => `<tr><td>${n}</td>${rows.map(r => `<td>${fx(f(r))}</td>`).join("")}</tr>`;
  return `<div class="fig">Figura 03: Alavancagem histórica e projetada por caso (dívida líquida ÷ EBITDA)</div>${grafLev(x)}<div class="fig">Figura 04: Projeção, caso ${CASOS[c].toLowerCase()}${sup({t: "calc"})} · R$ milhões</div><table><thead><tr><th></th>${rows.map(r => `<th>${r.ano}</th>`).join("")}</tr></thead><tbody>
    ${ln("Receita líquida", r => r.rec, mi)}${ln("EBITDA", r => r.ebitda, mi)}${ln("Juros", r => r.juros, mi)}${ln("Caixa livre após juros e dividendos", r => r.fcl, mi)}${ln("Dívida líquida", r => r.nd, mi)}
    ${ln("Alavancagem", r => r.lev, v => xx(v, 1))}${ln("Cobertura de juros", r => r.icr, v => xx(v, 1))}</tbody></table>
    <table style="margin-top:6px"><thead><tr><th>Alavancagem por caso</th>${rows.map(r => `<th>${r.ano}</th>`).join("")}</tr></thead><tbody>${Object.keys(CASOS).map(k => `<tr><td>${CASOS[k]}</td>${x.cases[k].map(r => `<td>${xx(r.lev, 1)}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <div class="src">${esc(CASO_TXT.base)} ${esc(CASO_TXT.moderado)} ${esc(CASO_TXT.estresse)}</div>`;
}
function spreadTab(x) {
  if (!S.A.SP.on) return "";
  const pr = x.pr, debs = debsDe(S.OF, x.co), md = debs.length ? median(debs.map(d => d.t)) : null;
  return `<div class="fig">Figura 05: Spread justo${sup({t: "calc"})}</div><table><tbody>
    <tr><td>Chance de inadimplência ponderada pelos cenários (nota interna ${esc(pr.pb.base.nota)} no caso base)</td><td>${pct(pr.pb.pd, 2)}</td></tr>
    <tr><td>Perda se inadimplir${sup({t: "prem"})}</td><td>${pct(pr.lgd, 0)}</td></tr>
    <tr><td>Perda esperada = chance × perda se inadimplir</td><td>${pct(pr.EL, 2)}</td></tr>
    <tr><td>Custo do capital + custo operacional${sup({t: "prem"})}</td><td>${pct(pr.cap + pr.opex, 2)}</td></tr>
    <tr><td><b>Spread justo sobre o CDI</b></td><td><b>${pct(pr.justo, 2)}</b></td></tr>
    ${md != null ? `<tr><td>Mediana das debêntures da companhia na ANBIMA${sup({t: "ofi"})}</td><td>${fmt(md, 2)}%</td></tr>` : ""}</tbody></table>`;
}
function fontes(x) {
  const co = x.co, docs = [...new Set(x.cols.map(c => c.tipo === "ano" ? co.src?.[c.k]?.doc : co.src?.[co.periodos[co.periodos.length - 1]]?.doc).filter(Boolean))];
  const anex = S.A.anexos.filter(a => a.lido).map(a => `${a.nome}${a.data ? " (" + a.data + ")" : ""}`);
  return `<div class="src"><b>Fontes e notas.</b> ¹ Reportado: demonstrações consolidadas entregues à CVM (${esc(docs.join(", "))}). ² Cálculo sobre esses números; últimos 12 meses = último ano + acumulado do ano − acumulado do ano anterior. ³ Premissa do analista. ⁴ Sugestão do Claude revisada pelo analista. ${S.OF?.anbima ? "⁵ " + esc(S.OF.anbima.fonte) + "." : ""} ${anex.length ? "Anexos: " + esc(anex.join("; ")) + "." : ""} Valores nominais, sem desconto a valor presente. Sem simulação de Monte Carlo.</div>`;
}
function comsRel() { const cs = S.A.coms.filter(c => c.rel); return cs.length ? `<div class="src"><b>Notas do analista.</b> ${cs.map(c => esc(c.txt)).join(" · ")}</div>` : ""; }

function glossario() {
  const linhas = ROWS.filter(r => r.fx).map(r => [r.pt, r.en, r.fx.join(" "), r.fxen]);
  const extra = [
    ["Últimos 12 meses", "Last twelve months", "Último ano fechado + acumulado do ano atual − acumulado do mesmo período do ano anterior", "FY + YTD − prior YTD"],
    ["Chance de inadimplência ponderada", "Scenario-weighted probability of default", "Chance na base + Σ chance do cenário × (chance de inadimplência no cenário − chance na base)", "PD base + Σ p × (PD scenario − PD base)"],
    ["Perda esperada", "Expected loss", "Chance de inadimplência ponderada × perda se inadimplir", "PD × LGD"],
    ["Spread justo", "Fair credit spread", "Perda esperada + capital alocado × prêmio exigido + custo operacional", "EL + capital × premium + opex"],
    ["Taxa justa em IPCA", "Fair inflation-linked yield", "Taxa da NTN-B no prazo + spread justo", "NTN-B yield + fair spread"],
    ["Taxa justa prefixada", "Fair fixed yield", "Taxa da curva prefixada (LTN e NTN-F) no prazo + spread justo", "Fixed-rate government yield + fair spread"],
    ["Caso moderado", "Probability-weighted case", "Base + Σ impacto de cada cenário × chance × rampa do ano", "Base + Σ impact × p × ramp"],
    ["Caso estresse", "Stress case", "Base + Σ impacto inteiro dos riscos × rampa do ano", "Base + Σ risk impact × ramp"],
    ["Caso otimista", "Upside case", "Base + Σ impacto inteiro das oportunidades × rampa do ano", "Base + Σ upside impact × ramp"],
    ["Análise vertical", "Common size", "Fluxo ÷ receita líquida; saldo ÷ ativo total, na mesma coluna", "Line item ÷ revenue or total assets"],
    ["Análise horizontal", "Trend analysis", "Valor ÷ valor da coluna comparável anterior − 1", "Period-over-period change"],
  ];
  return `<table><thead><tr><th>Termo</th><th style="text-align:left">Fórmula</th></tr></thead><tbody>${linhas.concat(extra).map(l => `<tr><td style="width:34%">${esc(l[0])}<div style="font-size:9.5px;color:#5B6573">${esc(l[1])}</div></td><td style="text-align:left">${esc(l[2])}<div style="font-size:9.5px;color:#5B6573">${esc(l[3])}</div></td></tr>`).join("")}</tbody></table>`;
}
function pages() {
  const x = X(), co = x.co, A = S.A, hoje = new Date().toLocaleDateString("pt-BR", {day: "numeric", month: "long", year: "numeric"});
  const q = co.q?.q || "", head = n => `<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:1px solid #1B2430;padding-bottom:6px"><div><h2 style="font-size:18px">${esc(co.comercial)}</h2><div class="small" style="color:#3F4855">Atualização de resultados | ${esc(q)}</div></div><div class="small" style="color:#5B6573">${hoje}</div></div>`;
  const foot = n => `<div class="foot"><span>Relatório de Crédito · dados CVM · origem de cada número nas notas</span><span>${n}</span></div>`;
  const logo = A.logo ? `<button class="link" data-act="logo" title="Trocar logo" style="padding:0;border:0"><img class="logo" src="${A.logo}" alt="Logo de ${esc(co.comercial)}"></button>` : `<button data-act="logo" class="logoph" style="background:none;cursor:pointer">logo da companhia</button>`;
  const p1 = `<div style="display:flex;gap:16px;align-items:center">${logo}<div style="flex:1"><h1>${esc(co.comercial)}</h1><div style="color:#3F4855">Atualização de resultados · ${esc(q)} · ${esc(co.setor)}</div></div><div class="small" style="text-align:right;color:#5B6573">${hoje}<br>Credit research</div></div>
    <div class="tese ${A.tese.txt ? "" : "vazia"}">${A.tese.txt ? esc(A.tese.txt) + sup(A.tese.o) : "A tese aparece aqui. Escreva na aba Análise ou peça ao Claude."}</div>
    ${blocos(ORDEM.p1) || `<p class="muted" style="color:#5B6573">Blocos de Mercadológico e Macroeconomia marcados para incluir aparecem aqui.</p>`}${opsTab()}${foot(1)}`;
  const p2 = `${head(2)}${figura01(x)}<div class="fig">Figura 01b: Receita e EBITDA, histórico e projeção · R$ milhões</div>${grafHist(x)}${blocos(ORDEM.p2) || `<p style="color:#5B6573">Blocos de Financeiro, Jurídico e Fiscal aparecem aqui.</p>`}${foot(2)}`;
  const p3 = `${head(3)}${cenTab(x)}${projTab(x)}${spreadTab(x)}${blocos(ORDEM.p3)}${comsRel()}${fontes(x)}${foot(3)}`;
  const p4 = `${head(4)}<h2>Glossário de fórmulas</h2>${glossario()}${foot(4)}`;
  return [p1, p2, p3, p4];
}

function renderPreview() {
  const el = $("#prev"); if (!el) return;
  if (!S.co || !S.A) { el.innerHTML = `<div class="small muted" style="padding:12px">A prévia das 3 páginas do relatório aparece aqui.</div>`; return; }
  let pg; try { pg = pages(); } catch (e) { el.innerHTML = `<div class="small bad" style="padding:12px">A prévia não abriu por um erro: ${esc(e.message)}. ${esc((e.stack || "").split("\n")[1] || "")}</div>`; console.error(e); return; }
  const W = Math.max(280, (el.clientWidth || 500) - 24), sc = Math.min(1, W / 794);
  el.innerHTML = `<div class="pghead"><b>Prévia do relatório</b><span>Caso ${esc(CASOS[S.caso].toLowerCase())} · ${S.anos} anos</span></div>
    <input type="file" id="logoIn" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden>
    ${pg.map((p, i) => `<div class="sheetwrap" style="height:${Math.ceil(1123 * sc)}px" data-pg="${i}"><div class="sheet" style="transform:scale(${sc})">${p}</div></div><div class="overmsg" data-over="${i}" hidden>A página ${i + 1} passou do tamanho A4: desmarque ou amenize caixas (no PDF ela é reduzida para caber).</div>`).join("")}
    <div class="xs muted">${S.A.logo ? `<button class="link" data-act="logodel">Remover logo</button> · ` : ""}<button class="link" data-act="logo">${S.A.logo ? "Trocar" : "Escolher"} o logo</button>: a página não pode baixar imagens de outros sites, então salve o logo do site de relações com investidores e escolha o arquivo aqui.</div>`;
  el.querySelectorAll(".sheet").forEach((s, i) => { const over = s.scrollHeight > 1125; s.classList.toggle("over", over); el.querySelector(`[data-over="${i}"]`).hidden = !over; if (over) s.parentElement.style.height = Math.ceil(s.scrollHeight * sc) + "px"; });
}

// ---------- exportação ----------
const fname = ext => `credito_${String(S.co.comercial || "companhia").toLowerCase().normalize("NFD").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "").slice(0, 40)}_${new Date().toISOString().slice(0, 10)}.${ext}`;
async function doExport(kind) {
  const dl = await getDL(), msg = (t, bad) => { S.msg.exp = {t, bad}; $("#top").innerHTML = renderTop(); };
  if (!dl) return msg("Download indisponível fora do claude.ai.", true);
  msg("Gerando…");
  try { const data = kind === "pdf" ? await buildPdf() : await buildPptx(); const filename = fname(kind); await dl.save({filename, data}); msg("Pronto: " + filename); }
  catch (e) { console.error(e); msg(e?.code === "declined" ? "Download cancelado." : e?.code === "rate_limited" ? "Já existe um download aberto." : "Não consegui gerar o arquivo (" + (e?.message || e?.code || "erro") + ").", true); }
}
async function buildPdf() {
  await loadLib("h2c"); await loadLib("jspdf");
  const host = document.createElement("div"); host.className = "pdfhost"; host.innerHTML = pages().map(p => `<div class="sheet">${p}</div>`).join(""); document.body.appendChild(host);
  host.querySelectorAll("button").forEach(b => { if (b.classList.contains("logoph")) b.style.visibility = "hidden"; });
  try {
    const doc = new window.jspdf.jsPDF({unit: "px", format: [794, 1123], hotfixes: ["px_scaling"]});
    const els = [...host.querySelectorAll(".sheet")];
    for (let i = 0; i < els.length; i++) { const h = Math.max(1123, els[i].scrollHeight); const cv = await window.html2canvas(els[i], {scale: 2, backgroundColor: "#ffffff", logging: false, height: h, windowHeight: h});
      if (i) doc.addPage([794, 1123]); const r = Math.min(1, 1123 / h); doc.addImage(cv.toDataURL("image/jpeg", .92), "JPEG", (794 - 794 * r) / 2, 0, 794 * r, h * r); }
    return doc.output("blob");
  } finally { host.remove(); }
}
async function buildPptx() {
  await loadLib("ppt"); const x = X(), co = x.co, A = S.A, p = new window.PptxGenJS(); p.layout = "LAYOUT_WIDE";
  const INK = "1B2430", MUT = "5B6573", ACC = "1F5FBF", F = "Calibri";
  const title = (s, t, sub) => { s.addText(t, {x: .5, y: .3, w: 12.3, h: .6, fontFace: F, fontSize: 26, bold: true, color: INK}); if (sub) s.addText(sub, {x: .5, y: .85, w: 12.3, h: .35, fontFace: F, fontSize: 13, color: MUT}); };
  const foot = (s, n) => s.addText(`Relatório de Crédito · ${co.comercial} · fonte: CVM e análise própria · ${n}/4`, {x: .5, y: 7.05, w: 12.3, h: .3, fontFace: F, fontSize: 9, color: MUT});
  const paras = ctxs => A.cx.filter(c => c.marca !== "nao" && ctxs.includes(c.ctx)).map(c => { const t = txtCx(c); return [{text: t.titulo + ": ", options: {bold: true, color: c.marca === "enfase" ? ACC : INK}}, {text: t.texto + "\n\n", options: {color: INK}}]; }).flat();
  // 1. tese e mercado
  let s = p.addSlide(); title(s, co.comercial, `Atualização de resultados · ${co.q?.q || ""} · ${co.setor}`);
  if (A.logo) try { s.addImage({data: A.logo, x: 11.6, y: .25, w: 1.2, h: 1.2, sizing: {type: "contain", w: 1.2, h: 1.2}}); } catch (_) {}
  s.addText(A.tese.txt || "Tese não escrita.", {x: .5, y: 1.4, w: 12.3, h: 1.7, fontFace: F, fontSize: 14, color: INK, fill: {color: "F1F3F6"}, margin: 12, valign: "top"});
  const p1 = paras(ORDEM.p1); if (p1.length) s.addText(p1, {x: .5, y: 3.3, w: 12.3, h: 3.6, fontFace: F, fontSize: 12, valign: "top", fit: "shrink"});
  foot(s, 1);
  // 2. números
  s = p.addSlide(); title(s, "Indicadores financeiros", "R$ milhões · consolidado · CVM");
  const hdr = [co.comercial, ...x.cols.map(c => c.lab)].map((t, i) => ({text: t, options: {bold: true, fill: {color: "E9ECF1"}, align: i ? "right" : "left"}}));
  const rows = FIG_ROWS.map(id => { const r = RBY[id]; return [{text: r.pt.length > 34 ? r.en : r.pt}, ...x.cols.map(c => { const k = cell(co, r, c); return {text: k.v == null ? "–" : val(r, k.v), options: {align: "right"}}; })]; });
  s.addTable([hdr, ...rows], {x: .5, y: 1.35, w: 7.6, fontFace: F, fontSize: 10, color: INK, border: {type: "solid", pt: .5, color: "EEF0F3"}, colW: [2.4, ...x.cols.map(() => 5.2 / x.cols.length)]});
  const p2 = paras(ORDEM.p2); if (p2.length) s.addText(p2, {x: 8.4, y: 1.35, w: 4.4, h: 2.9, fontFace: F, fontSize: 10, valign: "top", fit: "shrink"});
  { const an = co.periodos.slice(0, -1).slice(-S.anos), Lp = co.periodos.length - 1, ix = an.map(a => co.periodos.indexOf(a)).concat([Lp]), Pp = x.cases[S.caso], labels = an.concat(["12m"]).concat(Pp.map(y => y.ano + "p"));
    s.addChart(p.charts.BAR, [{name: "Receita líquida", labels, values: ix.map(i => co.F.receita[i]).concat(Pp.map(y => y.rec))}, {name: "EBITDA", labels, values: ix.map(i => co.F.ebitda[i]).concat(Pp.map(y => y.ebitda))}],
      {x: 8.4, y: 4.35, w: 4.4, h: 2.6, barDir: "col", chartColors: ["1F5FBF", "C2620E"], showLegend: true, legendPos: "b", legendFontSize: 9, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, valAxisLabelFormatCode: "#,##0", showTitle: true, title: "Receita e EBITDA (R$ mi)", titleFontSize: 10}); }
  foot(s, 2);
  // 3. cenários, projeção e spread
  s = p.addSlide(); title(s, "Cenários, projeção e spread", `Caso mostrado: ${CASOS[S.caso].toLowerCase()} · sem Monte Carlo`);
  const cs = A.cens.filter(c => c.ativo), b0 = x.cases.base[0];
  const ct = [["Cenário", "Chance", "Alavancagem se acontecer"].map(t => ({text: t, options: {bold: true, fill: {color: "E9ECF1"}}})), ...cs.slice(0, 10).map(c => { const o = runOnly(co, A.P, A.cens, c); return [{text: c.nome}, {text: c.chance + "%"}, {text: `${xx(b0.lev, 1)} → ${xx(o[0].lev, 1)}`}]; })];
  if (cs.length) s.addTable(ct, {x: .5, y: 1.35, w: 6.3, fontFace: F, fontSize: 10, color: INK, colW: [3.5, 1, 1.8], border: {type: "solid", pt: .5, color: "EEF0F3"}});
  const pr = [["Alavancagem", ...x.cases.base.map(r => String(r.ano))].map(t => ({text: t, options: {bold: true, fill: {color: "E9ECF1"}}})), ...Object.keys(CASOS).map(k => [{text: CASOS[k]}, ...x.cases[k].map(r => ({text: xx(r.lev, 1), options: {align: "right"}}))])];
  { const an = co.periodos.slice(0, -1).slice(-S.anos), Lp = co.periodos.length - 1, ix = an.map(a => co.periodos.indexOf(a)).concat([Lp]), labels = an.concat(["12m"]).concat(x.cases.base.map(y => y.ano + "p"));
    s.addChart(p.charts.LINE, Object.keys(CASOS).map(c => ({name: CASOS[c], labels, values: ix.map(i => co.R.dl_ebitda[i]).concat(x.cases[c].map(y => y.lev === Infinity ? null : +y.lev.toFixed(2)))})),
      {x: 7.1, y: 1.35, w: 5.7, h: 2.3, chartColors: ["2F7D45", "1F5FBF", "7A55C2", "A3271B"], lineSize: 2, showLegend: true, legendPos: "b", legendFontSize: 9, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, showTitle: true, title: "Alavancagem por caso (x)", titleFontSize: 10}); }
  if (A.SP.on) { const q = x.pr; s.addText([{text: "Spread justo sobre o CDI: " + pct(q.justo, 2) + "\n", options: {bold: true, fontSize: 14, color: ACC}}, {text: `Chance de inadimplência ponderada ${pct(q.pb.pd, 2)} × perda se inadimplir ${pct(q.lgd, 0)} = perda esperada ${pct(q.EL, 2)}; + capital ${pct(q.cap, 2)} + custo operacional ${pct(q.opex, 2)}.`, options: {fontSize: 11, color: INK}}], {x: 7.1, y: 3.8, w: 5.7, h: 1.3, fontFace: F, valign: "top"}); }
  const p3 = paras(ORDEM.p3); if (p3.length) s.addText(p3, {x: 7.1, y: 5.15, w: 5.7, h: 1.8, fontFace: F, fontSize: 10, valign: "top", fit: "shrink"});
  foot(s, 3);
  s = p.addSlide(); title(s, "Glossário de fórmulas", "Termos em português, com o termo em inglês");
  const gl = ROWS.filter(r => r.fx).slice(0, 14).map(r => [{text: r.pt + "\n", options: {bold: true}}, {text: r.en, options: {fontSize: 8, color: MUT}}]).map((t, i) => [{text: t}, {text: ROWS.filter(r => r.fx)[i].fx.join(" ") + "\n" + ROWS.filter(r => r.fx)[i].fxen}]);
  s.addTable(gl.map(r => [{text: r[0].text}, {text: r[1].text}]), {x: .5, y: 1.35, w: 12.3, fontFace: F, fontSize: 9, color: INK, colW: [4.3, 8], border: {type: "solid", pt: .5, color: "EEF0F3"}});
  foot(s, 4);
  return await p.write({outputType: "blob"});
}
