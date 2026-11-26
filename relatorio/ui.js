// =====================================================================
// Interface: estado, barra da companhia, as 6 abas e os eventos
// =====================================================================
"use strict";
const S = {tier: (() => { try { return localStorage.getItem("rc_tier") || "rapido"; } catch (_) { return "rapido"; } })(), idx: null, co: null, A: null, OF: null, RM: null, anos: 3, tab: "num", q: "", sugOpen: false, selSc: null, ctxF: "todos", caso: "moderado", busy: null, busyTxt: "", msg: {}, saveMsg: "", loading: false, origs: []};
const FTEXT = {}; // texto extraído dos arquivos anexados nesta sessão (por id)
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const fmt = (v, d = 0) => !nn(v) ? "–" : v.toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d});
const mi = v => !nn(v) ? "–" : Math.abs(v) < .5 ? "0" : v < 0 ? "(" + fmt(-v) + ")" : fmt(v);
const pct = (v, d = 1) => nn(v) ? fmt(v * 100, d) + "%" : "–";
const xx = (v, d = 1) => v === Infinity ? "sem dívida" : !nn(v) ? "–" : Math.abs(v) > 50 ? "n.s." : fmt(v, d) + "x";
const val = (row, v) => row.unid === "%" ? pct(v) : row.unid === "x" ? xx(v, 2) : mi(v);
const parseN = s => { s = String(s ?? "").trim().replace(/\s|R\$|%|x$/gi, ""); if (!s || s === "–") return null; const neg = /^\(.*\)$/.test(s); s = s.replace(/[()]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); const v = parseFloat(s); return nn(v) ? (neg ? -v : v) : null; };
const probWord = p => p < 5 ? "remoto" : p < 25 ? "improvável" : p < 50 ? "possível" : p < 80 ? "provável" : "quase certo";
const lab = (pt, en) => `${esc(pt)}<span class="en">${esc(en)}</span>`;
const chip = o => { const k = ORIG[o?.t] ? o.t : "prem"; return `<span class="chip ${ORIG[k].cls}" title="${esc(o?.f || ORIG[k].txt)}">${ORIG[k].nome}</span>`; };
const busyLine = k => S.busy === k ? `<span class="small muted" data-busy>${esc(S.busyTxt)}</span> <button class="link" data-act="stop">parar</button>` : "";
const msgLine = k => S.msg[k] ? `<span class="small ${S.msg[k].bad ? "bad" : "muted"}">${esc(S.msg[k].t)}</span>` : "";
const toast = t => { const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 2600); };

// Botão de valor com (i): registra a origem para o popover
function vbtn(v, txt, titulo, o, extra = "") {
  const id = S.origs.push({v, txt, titulo, o}) - 1, k = ORIG[o?.t] ? o.t : "prem";
  return `<button type="button" class="v" data-act="orig" data-o="${id}" title="Ver origem" ${extra}><span class="d ${ORIG[k].cls}"></span>${txt}</button>`;
}
function ibtn(titulo, o, txt = "") { const id = S.origs.push({txt, titulo, o}) - 1; return `<button type="button" class="i" data-act="orig" data-o="${id}" aria-label="Ver origem de ${esc(titulo)}">i</button>`; }

// ---------- análise em branco ----------
function blank(co) {
  return {v: 1, cd: co.cd, nome: co.nome, anos: 3, P: premDefaults(co), premEdit: {}, cens: [], cx: [], tese: {txt: "", o: null}, anexos: [], coms: [], SP: deep(SPREAD0), logo: "", sug: {cens: [], cx: []}, aj: [], sugAj: [], criado: new Date().toISOString()};
}
const migrate = (A, co) => { const B = blank(co); Object.keys(B).forEach(k => { if (A[k] === undefined) A[k] = B[k]; }); A.SP = {...B.SP, ...A.SP, lgd: {...B.SP.lgd, ...(A.SP?.lgd || {})}}; A.P = {...B.P, ...A.P}; A.sug ||= {cens: [], cx: []}; A.aj ||= []; A.sugAj ||= []; (A.cens || []).concat(A.sug.cens || []).forEach(c => { if (c.imp && c.imp.saida != null) { const v = +c.imp.saida || 0; c.imp.caixa = v > 0 ? -v : v; delete c.imp.saida; } if (c.imp && !c.linhas) c.linhas = Object.keys(c.imp).filter(k => IMP[k] && +c.imp[k]); }); return A; };

// ---------- cálculos por renderização ----------
let CACHE = null;
function X() {
  if (CACHE) return CACHE;
  const co = S.co, A = S.A, cases = {}, sa = somaAj(A);
  A.P.aj = {div: sa.div, cx: sa.cx};
  Object.keys(CASOS).forEach(c => cases[c] = runCase(co, A.P, A.cens, c));
  return CACHE = {co, A, cases, pr: pricing(co, A.P, A.cens, A.SP), cols: columns(co, S.anos)};
}
function changed(noSave) { CACHE = null; render(); if (!noSave) scheduleSave(); }
const txtCx = c => (c.marca === "ameniza" || c.marca === "enfase") && c.alt?.[c.marca] ? c.alt[c.marca] : {titulo: c.titulo, texto: c.texto};
function alvoNome(a) {
  if (!a || a === "geral") return "análise em geral";
  const [t, id] = a.split(":");
  if (t === "num") return "número: " + (RBY[id]?.pt || id);
  if (t === "cen") return "cenário: " + (S.A.cens.find(s => s.id === id)?.nome || "removido");
  if (t === "cx") return "caixa: " + (S.A.cx.find(s => s.id === id)?.titulo || "removida");
  return a;
}

// ---------- barra superior ----------
function renderTop() {
  const hits = S.sugOpen && S.idx ? searchIdx(S.q) : [];
  return `<div class="brand">Relatório de Crédito</div>
  <div class="search"><input id="q" type="search" placeholder="Companhia listada: nome, ticker ou CNPJ" value="${esc(S.q)}" autocomplete="off" aria-label="Buscar companhia">
    ${hits.length ? `<div class="sug" role="listbox">${hits.map(h => `<button data-act="pick" data-cd="${h[0]}" role="option"><span><b>${esc(h[2] || h[1])}</b> <span class="muted small">${esc(h[1])}</span></span><span class="muted xs">${esc(h[3])}</span></button>`).join("")}
      <div class="xs muted" style="padding:8px 10px;border-top:1px solid var(--line2)">Ibovespa e demais listadas na CVM. Nasdaq e NYSE: fonte ainda a definir (proposta: SEC EDGAR).</div></div>` : ""}</div>
  ${S.co ? `<div class="seg" role="group" aria-label="Anos de histórico"><button data-act="anos" data-n="2" aria-pressed="${S.anos === 2}">2 anos</button><button data-act="anos" data-n="3" aria-pressed="${S.anos === 3}">3 anos</button></div>
  <div class="seg" role="group" aria-label="Velocidade do Claude" title="Rápido responde em poucos segundos. Cuidadoso pensa antes de escrever e leva de 30 segundos a 2 minutos."><button data-act="tier" data-k="rapido" aria-pressed="${S.tier !== "cuidadoso"}">Claude rápido</button><button data-act="tier" data-k="cuidadoso" aria-pressed="${S.tier === "cuidadoso"}">Cuidadoso</button></div>
  <span class="xs muted" id="savemsg">${esc(S.saveMsg)}</span>
  <span style="flex:1"></span>
  <button class="b" data-act="recomecar" title="Apaga cenários, caixas, tese, anexos, comentários e premissas editadas desta companhia">Recomeçar análise</button>
  <button class="b" data-act="metodo">Metodologia</button>
  <button class="b" data-act="export" data-k="pptx">PowerPoint</button>
  <button class="b pri" data-act="export" data-k="pdf">Exportar PDF</button>${msgLine("exp")}` : ""}`;
}
function searchIdx(q) {
  q = normN(q); if (!q) return S.idx.slice(0, 0);
  const qd = q.replace(/\D/g, "");
  return S.idx.filter(r => normN(r[1] + " " + r[2]).includes(q) || (qd.length > 4 && String(r[6]).replace(/\D/g, "").includes(qd))).slice(0, 12);
}

// ---------- abas ----------
const TABS = [["num", "Números"], ["cen", "Cenários"], ["ana", "Análise"], ["spr", "Spread"], ["anx", "Anexos"], ["com", "Comentários"]];
function renderWork() {
  if (!S.co) return renderHome();
  const cnt = {cen: S.A.cens.length, ana: S.A.cx.filter(c => c.marca !== "nao").length, anx: S.A.anexos.length, com: S.A.coms.length};
  return `<div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" data-act="tab" data-k="${k}" aria-selected="${S.tab === k}">${n}${cnt[k] ? `<span class="cnt">${cnt[k]}</span>` : ""}</button>`).join("")}</div>
  <div class="pane">${({num: tabNum, cen: tabCen, ana: tabAna, spr: tabSpr, anx: tabAnx, com: tabCom})[S.tab]()}</div>`;
}
function renderHome() {
  return `<div class="hero"><h1>Escolha uma companhia</h1>
  <p class="muted" style="max-width:640px;margin:0">Busque pelo nome na barra acima. O app traz os resultados dos últimos 2 ou 3 anos, o acumulado do ano e os últimos 12 meses entregues à CVM, calcula os ratios de crédito e monta o relatório ao lado, página por página.</p>
  ${S.loading ? `<p class="small muted">Carregando a lista de companhias…</p>` : `<div class="row">${[20931, 19739, 4820].map(cd => { const r = S.idx?.find(x => x[0] === cd); return r ? `<button class="b" data-act="pick" data-cd="${cd}">${esc(r[2])}</button>` : ""; }).join("")}</div>`}
  <div class="note">Cada número tem um ponto colorido e um (i) com a origem: <span class="chip o-rep">Reportado</span> <span class="chip o-calc">Cálculo</span> <span class="chip o-prem">Premissa</span> <span class="chip o-claude">Sugestão do Claude</span>. Os pedidos ao Claude usam a sua conta e só saem quando você clica.</div></div>`;
}

// ---------- 1. Números ----------
// Linha completa: colunas históricas + anos projetados do caso escolhido, com valor e origem de cada célula
function linha(x, r) {
  const co = x.co, out = x.cols.map(c => ({...cell(co, r, c), lab: c.lab, col: c}));
  const pk = PROJ_MAP[r.id];
  x.cases[S.caso].forEach((y, t) => out.push(pk ? {v: nn(y[pk]) && Math.abs(y[pk]) !== Infinity ? y[pk] : (y[pk] === Infinity ? Infinity : null), lab: y.ano + "p", proj: true, col: {tipo: "proj", t},
    o: {t: "calc", f: `Projeção do caso ${CASOS[S.caso].toLowerCase()}, ${y.ano}: ${PROJ_FX[r.id]}. ${CASO_TXT[S.caso]}`, nota: "Usa as premissas da tabela abaixo e os cenários marcados."}} : {v: null, lab: y.ano + "p", proj: true, col: {tipo: "proj", t}, o: null}));
  return out;
}
// Visões: valores, vertical (fluxos ÷ receita, saldos ÷ ativo total) e horizontal (variação contra a coluna anterior comparável)
function transforma(x, r, cells, vista) {
  if (vista === "valor" || r.kind === "ratio" && vista === "vertical") return cells.map(c => ({...c, txt: c.v == null ? "–" : val(r, c.v)}));
  const co = x.co, L = co.periodos.length - 1, rec = linha(x, RBY.receita);
  const ativo = c => c.col.tipo === "ano" ? co.F.ativo[c.col.idx] : c.col.tipo === "ltm" || (c.col.tipo === "parc" && !c.col.ant) ? co.F.ativo[L] : null;
  if (vista === "vertical") return cells.map((c, i) => { const base = r.kind === "flow" ? rec[i].v : ativo(c); const v = nn(c.v) && nn(base) && base ? c.v / base : null;
    return {...c, v, txt: v == null ? "–" : pct(v), o: c.o && v != null ? {...c.o, f: `${r.kind === "flow" ? "Valor ÷ receita líquida" : "Saldo ÷ ativo total"} da mesma coluna (análise vertical). ${c.o.f || ""}`} : c.o}; });
  // horizontal
  const prevOf = (c, i) => {
    if (c.col.tipo === "ano") { const j = c.col.idx - 1; if (j < 0) return null; return r.r ? co.R[r.r]?.[j] : co.F[r.src]?.[j]; }
    if (c.col.tipo === "parc") { if (c.col.ant) return null; return cells.find(z => z.col.tipo === "parc" && z.col.ant && !!z.col.tri === !!c.col.tri)?.v; }
    if (c.col.tipo === "ltm") return r.r ? co.R[r.r]?.[L - 1] : co.F[r.src]?.[L - 1];
    if (c.col.tipo === "proj") return c.col.t === 0 ? cells.find(z => z.col.tipo === "ltm")?.v : cells[i - 1]?.v;
  };
  return cells.map((c, i) => { const p = prevOf(c, i); if (!nn(c.v) || !nn(p)) return {...c, v: null, txt: "–"};
    if (r.kind === "ratio") { const d = c.v - p; return {...c, v: d, txt: (d >= 0 ? "+" : "−") + (r.unid === "%" ? fmt(Math.abs(d) * 100, 1) + " p.p." : fmt(Math.abs(d), 2) + "x"), o: {...c.o, f: `Diferença contra a coluna comparável anterior (análise horizontal). ${c.o?.f || ""}`}}; }
    const v = p ? c.v / Math.abs(p) - 1 * Math.sign(p) : null; const vv = p ? (c.v - p) / Math.abs(p) : null;
    return {...c, v: vv, txt: vv == null ? "–" : (vv >= 0 ? "+" : "−") + fmt(Math.abs(vv) * 100, 1) + "%", o: {...c.o, f: `Variação contra a coluna comparável anterior (análise horizontal): ano contra ano anterior, acumulado contra o mesmo período do ano anterior, 12 meses contra o último ano fechado. ${c.o?.f || ""}`}}; });
}
// Melhor ou pior: cor para ratios (contra o ano anterior e contra o setor)
const tom = (r, novo, velho) => !r.bom || !nn(novo) || !nn(velho) || novo === velho ? "" : ((novo > velho) === (r.bom === "up") ? "var(--ok)" : "var(--bad)");
const seta = (r, novo, velho) => { const c = tom(r, novo, velho); return c ? `<span style="color:${c};font-weight:700" aria-label="${c === "var(--ok)" ? "melhorou" : "piorou"}">${novo > velho ? "▲" : "▼"}</span>` : ""; };

function destaques(x) {
  const co = x.co, L = co.periodos.length - 1, ks = [["dl_ebitda", "Alavancagem"], ["ebitda_desp", "Cobertura de juros"], ["caixa_divcp", "Caixa ÷ dívida de curto prazo"], ["mg_ebitda", "Margem EBITDA"], ["receita", "Receita, 12 meses"]];
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">${ks.map(([id, n]) => { const r = RBY[id], arr = r.r ? co.R[r.r] : co.F[r.src], v = arr[L], p = arr[L - 1], proj = x.cases[S.caso].map(y => y[PROJ_MAP[id]]);
    const c = r.bom ? tom(r, v, p) : "";
    return `<div class="box" style="padding:10px 12px;gap:4px"><div class="xs muted">${esc(n)}<span class="en">${esc(r.en)}</span></div>
      <div class="row" style="justify-content:space-between;gap:6px"><span style="font:700 20px var(--f-head);color:${c || "var(--ink)"}">${val(r, v)}</span>${spark([...arr.slice(-4, L), v, ...proj], 4, {color: c && c.includes("bad") ? GC.est : GC.hist})}</div>
      <div class="xs">${seta(r, v, p)} ${nn(p) ? "antes " + val(r, p) + " (" + esc(co.periodos[L - 1]) + ")" : ""}</div></div>`; }).join("")}</div>`;
}
function boxAjustes(x) {
  const A = S.A, co = x.co, m = metricasAj(co, A), u = co.moeda || "R$", ltm = "12 meses";
  const o = (t, f, fx, fxen) => ({t, f, fx, fxen});
  const lst = (A.aj || []).map(a => `<tr><td><label class="row small" style="gap:6px"><input type="checkbox" data-ajon="${a.id}" ${a.ativo !== false ? "checked" : ""} aria-label="Usar o ajuste">${esc(a.nome)}</label><span class="en">${esc(AJ_TIPOS[a.tipo].pt)}</span></td>
    <td>${vbtn(+a.valor, mi(+a.valor), a.nome, a.o || {t: "prem", f: a.fonte || "Ajuste do analista."})}</td><td style="text-align:left" class="xs">${esc(a.fonte || "")}</td><td>${chip(a.o || {t: "prem"})}</td><td><button class="link" data-act="delaj" data-id="${a.id}">tirar</button></td></tr>`).join("");
  const sug = (A.sugAj || []).length ? `<div class="sugbox"><b class="small">Ajustes sugeridos pelo Claude a partir dos anexos</b>${A.sugAj.map(a => `<div class="row small" style="justify-content:space-between;border-top:1px solid #E5DCF3;padding-top:6px"><span style="flex:1;min-width:220px"><b>${esc(a.nome)}</b> · ${esc(AJ_TIPOS[a.tipo].pt)} · ${mi(+a.valor)}<span class="en">${esc(a.fonte || "")}</span></span><span class="row"><button class="b" data-act="sugaj" data-id="${a.id}" data-ok="1">Aceitar</button><button class="b" data-act="sugaj" data-id="${a.id}">Descartar</button></span></div>`).join("")}</div>` : "";
  const met = (n, en, v, vA, f, fx) => `<tr><td>${lab(n, en)}</td><td>${vbtn(v, n.startsWith("Alavancagem") ? xx(v, 2) : mi(v), n + " · sem ajuste", {t: "calc", f: "Valor da tabela acima, últimos 12 meses."})}</td><td><b>${vbtn(vA, n.startsWith("Alavancagem") ? xx(vA, 2) : mi(vA), n + " · ajustado", {t: "calc", f, fx})}</b></td></tr>`;
  return `<div class="box"><h3><span>Ajustes à dívida e ao EBITDA <span class="en">Debt and EBITDA adjustments</span></span><span class="r">${esc(u)} milhões · coluna 12 meses · entram na projeção e na nota</span></h3>
    <div class="xs muted">Para comparar com research e covenants, que somam itens fora dos empréstimos (${esc(AJ_TIPOS.divida.ex)}) e tiram itens não recorrentes do EBITDA. Valor positivo soma; negativo tira.</div>
    ${lst ? `<div class="tw"><table class="t"><thead><tr><th>Ajuste</th><th>Valor</th><th style="text-align:left">Fonte</th><th>Origem</th><th></th></tr></thead><tbody>${lst}</tbody></table></div>` : ""}
    <div class="row" style="align-items:flex-end"><label class="f">Tipo<select class="s" id="ajTipo">${Object.entries(AJ_TIPOS).map(([k, t]) => `<option value="${k}">${esc(t.pt)}</option>`).join("")}</select></label>
      <label class="f" style="flex:1;min-width:180px">O que é<input class="tx" id="ajNome" placeholder="ex.: Arrendamentos (IFRS 16)"></label>
      <label class="f">Valor<input class="n" id="ajValor" placeholder="0"></label>
      <label class="f" style="flex:1;min-width:180px">Fonte<input class="tx" id="ajFonte" placeholder="ex.: Release 3T26, p. 12"></label>
      <button class="b" data-act="addaj">Adicionar</button></div>
    <div class="row"><button class="b cl" data-act="claudeaj" ${S.busy ? "disabled" : ""}>Pedir ao Claude os ajustes que estão nos anexos</button>${busyLine("aj")}${msgLine("aj")}</div>
    ${sug}
    <div class="tw"><table class="t"><thead><tr><th>Métrica, ${esc(ltm)}</th><th>Sem ajuste</th><th>Ajustada</th></tr></thead><tbody>
      ${met("Lucro antes de juros, impostos, depreciação e amortização", "EBITDA", m.eb, m.ebA, `${mi(m.eb)} ${m.s.eb >= 0 ? "+" : "−"} ${mi(Math.abs(m.s.eb))} de ajustes = ${mi(m.ebA)}.`, ["EBITDA da tabela", "+ Σ ajustes ao EBITDA"])}
      ${met("Dívida líquida", "Net debt", m.dl, m.dlA, `(${mi(m.db)} + ${mi(m.s.div)}) − (${mi(m.cx)} + ${mi(m.s.cx)}) = ${mi(m.dlA)}.`, ["(Dívida bruta + Σ ajustes à dívida)", "− (Caixa + Σ ajustes ao caixa)"])}
      ${met("Alavancagem", "Net debt to EBITDA", m.lev, m.levA, `${mi(m.dlA)} ÷ ${mi(m.ebA)} = ${xx(m.levA, 2)}.`, ["Dívida líquida ajustada", "÷ EBITDA ajustado"])}
    </tbody></table></div></div>`;
}
function boxOps(x) {
  const O = S.A.ops;
  const tab = O?.rows?.length ? `<div class="tw"><table class="t"><thead><tr><th>Indicador</th>${O.cols.map(c => `<th>${esc(c)}</th>`).join("")}<th style="text-align:left">Fonte</th><th></th></tr></thead><tbody>
    ${O.rows.map((r, i) => `<tr><td><label class="row small" style="gap:6px"><input type="checkbox" data-opon="${i}" ${r.ativo !== false ? "checked" : ""} aria-label="Levar ao relatório">${esc(r.nome)}</label><span class="en">${esc(r.unid || "")}</span></td>${O.cols.map((c, j) => `<td>${r.vals[j] == null || r.vals[j] === "" ? "–" : vbtn(null, esc(String(r.vals[j])), `${r.nome} · ${c}`, {t: "claude", f: `Lido pelo Claude no anexo: ${r.fonte || "sem página informada"}. Confira no documento.`})}</td>`).join("")}<td class="xs" style="text-align:left">${esc(r.fonte || "")}</td><td><button class="link" data-act="delop" data-i="${i}">tirar</button></td></tr>`).join("")}</tbody></table></div>
    <div class="xs muted">Marcados entram no relatório como "Indicadores operacionais". Cada valor tem a etiqueta Sugestão do Claude até você conferir no documento.</div>` : `<div class="note">Nenhum indicador ainda. Anexe o release de resultados na aba Anexos e peça ao Claude.</div>`;
  return `<div class="box"><h3><span>Indicadores operacionais <span class="en">Operating metrics</span></span><span class="r">volumes, preços, utilização, spreads do setor</span></h3>
    ${tab}<div class="row"><button class="b cl" data-act="claudeops" ${S.busy ? "disabled" : ""}>${O?.rows?.length ? "Montar de novo" : "Montar"} com o Claude a partir dos anexos</button>${busyLine("ops")}${msgLine("ops")}</div></div>`;
}
function tabNum() {
  const x = X(), co = x.co, setor = S.RM?.setores?.[co.setor], anoS = co.periodos[co.periodos.length - 2], med = setor?.[anoS], vista = S.vista || "valor";
  const head = linha(x, RBY.receita);
  let g = "", body = "";
  ROWS.forEach(r => {
    if (r.g !== g) { g = r.g; body += `<tr class="g"><td colspan="${head.length + 3}">${esc(g)}</td></tr>`; }
    const cells = linha(x, r), shown = transforma(x, r, cells, vista), nHist = x.cols.length;
    const ltm = cells.find(c => c.col.tipo === "ltm")?.v, ant = r.r ? co.R[r.r]?.[co.periodos.length - 2] : null;
    const hv = cells.filter(c => c.col.tipo === "ano" || c.col.tipo === "ltm" || c.col.tipo === "proj").map(c => c.v === Infinity ? null : c.v);
    body += `<tr><td>${lab(r.pt, r.en)}</td>${shown.map(c => { const color = vista === "valor" && r.kind === "ratio" && c.col.tipo === "ltm" ? tom(r, ltm, med?.[r.r]) : "";
      return `<td${c.proj ? ' style="background:#F3F6FB"' : ""}>${c.v == null && !c.o?.vazio ? "–" : vbtn(c.v, color ? `<span style="color:${color};font-weight:600">${c.txt}</span>` : c.txt, r.pt + " · " + c.lab, c.o)}${vista === "valor" && r.kind === "ratio" && c.col.tipo === "ltm" ? " " + seta(r, ltm, ant) : ""}</td>`; }).join("")}
      <td>${spark(hv, hv.length - x.cases[S.caso].length)}</td>
      <td>${r.r && med && nn(med[r.r]) ? vbtn(med[r.r], val(r, med[r.r]), `${r.pt} · mediana do setor em ${anoS}`, {t: "calc", f: `Mediana de ${med.n} companhias do setor "${co.setor}" na base da CVM, ${anoS}.`, fx: r.fx, fxen: r.fxen}) : `<span class="muted">–</span>`}</td></tr>`;
  });
  const P = S.A.P;
  const prem = Object.entries(PREM).map(([k, m]) => `<tr><td>${lab(m.pt, m.en)} ${ibtn(m.pt, P[k].o)}</td>${P[k].v.map((v, t) => `<td><input class="n" data-prem="${k}" data-t="${t}" value="${fmt(v * 100, 1)}" aria-label="${esc(m.pt)} ${x.cases.base[t].ano}">%</td>`).join("")}<td>${chip(P[k].o)}</td></tr>`).join("");
  const ltmK = co.periodos[co.periodos.length - 1], chk = co.chk?.[ltmK] || [], ok = chk.filter(c => c[5] === "ok").length;
  const anosH = co.periodos.slice(0, -1).slice(-S.anos), L = co.periodos.length - 1, F = co.F;
  const idxH = anosH.map(a => co.periodos.indexOf(a)).concat([L]), cats = anosH.concat(["12m"]).concat(x.cases[S.caso].map(y => y.ano + "p"));
  const recS = idxH.map(i => F.receita[i]).concat(x.cases[S.caso].map(y => y.rec)), ebS = idxH.map(i => F.ebitda[i]).concat(x.cases[S.caso].map(y => y.ebitda));
  const levCases = Object.keys(CASOS).map(c => ({nome: CASOS[c], cor: CASE_COLOR[c], tracejado: c !== "base" && c !== S.caso, vals: idxH.map(i => co.R.dl_ebitda[i]).concat(x.cases[c].map(y => y.lev === Infinity ? null : y.lev))}));
  return `${co.semConf ? `<div class="note" style="background:#FBEFD9;color:#7A4508"><b>Companhia dos EUA, dados da SEC (EDGAR, XBRL) ainda sem conferência.</b> Valores em US$ milhões, anos fiscais pelos 10-K; a última coluna é o último 10-K, não os 12 meses. Dívida = dívida de longo prazo + parcela circulante + empréstimos de curto prazo, sem arrendamentos. Ratings, spreads e títulos públicos do Spread continuam brasileiros.${co.obs?.length ? `<ul style="margin:6px 0 0;padding-left:18px">${co.obs.map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}</div>` : ""}${destaques(x)}
  <div class="box"><h3><span>Resultados e ratios de crédito <span class="en">Financials and credit ratios</span></span><span class="r">${esc(co.moeda || "R$")} milhões · consolidado · colunas azuladas = projeção do caso ${esc(CASOS[S.caso].toLowerCase())}</span></h3>
    <div class="row"><div class="seg" role="group" aria-label="Visão da tabela"><button data-act="vista" data-k="valor" aria-pressed="${vista === "valor"}">Valores</button><button data-act="vista" data-k="vertical" aria-pressed="${vista === "vertical"}">Vertical</button><button data-act="vista" data-k="horizontal" aria-pressed="${vista === "horizontal"}">Horizontal</button></div>
      <span class="xs muted">${vista === "vertical" ? "Fluxos em % da receita e saldos em % do ativo total da mesma coluna." : vista === "horizontal" ? "Variação contra a coluna comparável anterior; ratios em diferença." : "Ratios em verde melhoraram e em vermelho pioraram contra o ano anterior (seta) e contra o setor (cor)."}</span>
      <span style="flex:1"></span><div class="seg" role="group" aria-label="Caso projetado">${Object.entries(CASOS).map(([k, n]) => `<button data-act="caso" data-k="${k}" aria-pressed="${S.caso === k}">${n}</button>`).join("")}</div></div>
    <div class="tw"><table class="t"><thead><tr><th>${esc(co.comercial)}</th>${head.map(c => `<th${c.proj ? ' style="background:#E3EAF5"' : ""}>${esc(c.lab)}${c.col.sub ? `<span class="en">${esc(c.col.sub)}</span>` : c.proj ? `<span class="en">projeção</span>` : ""}</th>`).join("")}<th>Evolução</th><th>Setor<span class="en">mediana ${esc(anoS)}</span></th></tr></thead><tbody>${body}</tbody></table></div>
    <div class="xs muted">Dívida aqui = empréstimos, financiamentos e debêntures do balanço. Ajustes que algumas casas fazem (risco sacado, arrendamentos, derivativos) entram como premissa sua, com a explicação no texto.</div></div>
  ${boxAjustes(x)}
  ${boxOps(x)}
  <div class="grid2"><div class="box"><h3>Receita e EBITDA <span class="r">R$ milhões</span></h3>${bars(cats, [{nome: "Receita líquida", vals: recS, cor: GC.hist, corProj: GC.proj}, {nome: "EBITDA", vals: ebS, cor: GC.ebitda, corProj: GC.ebitdaP}], {nHist: idxH.length, h: 230, aria: "Receita e EBITDA"})}</div>
    <div class="box"><h3>Alavancagem por caso <span class="r">dívida líquida ÷ EBITDA</span></h3>${lines(cats, levCases, {nHist: idxH.length, unit: "x", h: 230, aria: "Alavancagem por caso"})}</div></div>
  <div class="box"><h3><span>Premissas da projeção <span class="en">Projection assumptions</span></span><span class="r">editáveis por ano; o que você muda vira Premissa</span></h3>
    <div class="tw"><table class="t"><thead><tr><th>Premissa</th>${x.cases.base.map(r => `<th>${r.ano}</th>`).join("")}<th>Origem</th></tr></thead><tbody>${prem}</tbody></table></div>
    <div class="row"><button class="b" data-act="premreset">Recalcular pelo histórico</button><span class="xs muted">Dívida bruta mantida: vencimentos refinanciados. O caixa livre de cada ano muda a dívida líquida.</span></div></div>
  <div class="grid2"><div class="box"><h3>Conferências contábeis <span class="r">${esc(ltmK)}</span></h3>
    <div class="small">${ok} de ${chk.length} identidades conferidas sem diferença.</div>
    <ul class="xs" style="margin:0;padding-left:18px">${chk.map(c => `<li class="${c[5] === "ok" ? "" : "bad"}">${esc(c[1])}: ${c[5] === "ok" ? "ok" : "diferença de " + fmt(c[4] / 1000, 1) + " mi"}</li>`).join("")}</ul></div>
    <div class="box"><h3>Documentos usados</h3><ul class="xs" style="margin:0;padding-left:18px">${co.periodos.map(p => co.src?.[p]).filter(Boolean).map((s, i) => `<li>${esc(co.periodos[i])}: ${esc(s.doc)}, entregue em ${esc((s.entregue || "").split("-").reverse().join("/"))} · <a href="${esc(s.link)}" target="_blank" rel="noopener">abrir na CVM</a></li>`).join("")}</ul></div></div>`;
}

// ---------- 2. Cenários ----------
const CATALOGO = [
  {cat: "macro", nome: "Selic 1 ponto acima do esperado", driver: "Selic média +1 ponto percentual sobre o Focus", tipo: "risco", imp: {juros: .7}, forma: "imediato"},
  {cat: "macro", nome: "Real 10% mais fraco", driver: "Dólar 10% acima da premissa", tipo: "risco", imp: {juros: .4}, forma: "imediato"},
  {cat: "macro", nome: "Inflação 2 pontos acima da meta", driver: "Inflação ao consumidor 2 pontos acima", tipo: "risco", imp: {margem: -.5, juros: .5}, forma: "gradual"},
  {cat: "macro", nome: "Desaceleração da atividade", driver: "Produto interno bruto 2 pontos abaixo", tipo: "risco", imp: {receita: -5}, forma: "gradual"},
  {cat: "merc", nome: "Queda de preço do principal produto", driver: "Preço médio −10%", tipo: "risco", imp: {receita: -6, margem: -2}, forma: "imediato"},
  {cat: "merc", nome: "Alta do custo da principal matéria-prima", driver: "Custo da matéria-prima +10%", tipo: "risco", imp: {margem: -1.5}, forma: "imediato"},
  {cat: "merc", nome: "Entrada de concorrente relevante", driver: "Perda de participação de mercado", tipo: "risco", imp: {receita: -4, margem: -1}, forma: "gradual"},
  {cat: "jur", nome: "Contingência judicial relevante", driver: "Pagamento de processo", tipo: "risco", imp: {caixa: 0}, forma: "umano"},
  {cat: "jur", nome: "Mudança regulatória no setor", driver: "Nova regra eleva custo de operação", tipo: "risco", imp: {margem: -1}, forma: "tardio"},
  {cat: "fisc", nome: "Transição da reforma tributária", driver: "Novo imposto sobre bens e serviços altera crédito de insumos", tipo: "risco", imp: {margem: -.8}, forma: "tardio"},
  {cat: "fisc", nome: "Monetização de créditos tributários", driver: "Créditos de impostos viram caixa", tipo: "oportunidade", imp: {caixa: 0}, forma: "umano"},
  {cat: "div", nome: "Refinanciamento mais caro", driver: "Rolagem dos vencimentos com spread maior", tipo: "risco", imp: {juros: .8}, forma: "gradual"},
  {cat: "div", nome: "Corte de linhas de fornecedores (risco sacado)", driver: "Prazo de fornecedores menor", tipo: "risco", imp: {caixa: 0}, forma: "umano"},
  {cat: "gen", nome: "Evento climático na operação", driver: "Seca ou enchente afeta produção", tipo: "risco", imp: {receita: -3, margem: -1}, forma: "recupera"},
  {cat: "gen", nome: "Troca de controle ou de gestão", driver: "Mudança na estratégia financeira", tipo: "risco", imp: {}, forma: "gradual"},
  {cat: "gen", nome: "Concentração no maior cliente", driver: "Perda do principal cliente", tipo: "risco", imp: {receita: -8}, forma: "imediato"},
];
const newSc = t => ({id: uid(), cat: t.cat, nome: t.nome, tipo: t.tipo || "risco", driver: t.driver || "", chance: t.chance ?? 25, porque: t.porque || "", forma: t.forma || "imediato", ramp: [1, 1, 1], imp: {...(t.imp || {})}, linhas: t.linhas || Object.keys(t.imp || {}), notas: t.notas || {}, ativo: true, o: t.o || {t: "prem", f: "Cenário do catálogo; chance e impactos são premissas suas."}});
function tabCen() {
  const A = S.A, x = X(), sc = A.cens.find(s => s.id === S.selSc) || A.cens[0];
  const list = Object.keys(CTX).filter(k => k !== "fin").map(k => { const its = A.cens.filter(s => s.cat === k); return `<div class="cat">${esc(CTX[k].nome)}</div>${its.length ? its.map(s => `<div class="sc ${sc && s.id === sc.id ? "on" : ""}" data-act="selsc" data-id="${s.id}" role="button" tabindex="0" aria-label="Abrir ${esc(s.nome)}"><input type="checkbox" data-scon="${s.id}" ${s.ativo ? "checked" : ""} aria-label="Usar o cenário ${esc(s.nome)}"><span style="flex:1;font-size:12.5px">${esc(s.nome)}</span><span class="bar"><i style="width:${s.chance}%;background:${s.tipo === "oportunidade" ? "var(--opp)" : "var(--risk)"}"></i></span></div>`).join("") : `<div class="xs muted" style="padding:2px 8px">nenhum</div>`}`; }).join("");
  const sug = A.sug.cens.length ? `<div class="sugbox"><b class="small">Sugestões do Claude para aceitar ou descartar</b>${A.sug.cens.map(s => `<div class="row small" style="justify-content:space-between;border-top:1px solid #E5DCF3;padding-top:6px"><span style="flex:1;min-width:200px"><b>${esc(s.nome)}</b>${s.substitui ? ' <span class="chip o-claude">versão melhorada do cenário aberto</span>' : ""} · ${esc(CTX[s.cat].nome)} · ${s.tipo} · chance ${s.chance}% · ${esc(FORMAS[s.forma]?.nome || "")}<span class="en">${esc(s.driver)}. ${esc(s.porque)}</span>${impLinhas(s).length ? `<span class="xs" style="display:block;margin-top:3px">${impLinhas(s).map(k => `${esc(IMP[k].pt)} <b>${impFmt(k, +s.imp[k] || 0)}</b>${s.notas?.[k] ? ` (${esc(s.notas[k])})` : ""}`).join(" · ")}</span>` : ""}</span><span class="row"><button class="b" data-act="sugcen" data-id="${s.id}" data-ok="1">${s.substitui ? "Trocar" : "Aceitar"}</button><button class="b" data-act="sugcen" data-id="${s.id}">Descartar</button></span></div>`).join("")}</div>` : "";
  const montar = `<div class="box" style="background:#FBF9FE;border-color:#D9CCF0"><h3><span>Montar um cenário com o Claude <span class="en">Build a scenario together</span></span></h3>
    <textarea class="tx" id="montarTxt" rows="2" placeholder="Descreva do seu jeito, por exemplo: e se o preço do petróleo cair para 60 dólares e a empresa tiver que pagar uma multa ambiental?">${esc(S.montarTxt || "")}</textarea>
    <div class="row"><button class="b cl" data-act="montar" ${S.busy ? "disabled" : ""}>Montar com o Claude</button>${busyLine("mont")}${msgLine("mont")}<span class="xs muted">Ele devolve nome, texto, chance, rampa e os impactos linha por linha, com o porquê de cada número. Nada entra antes de você aceitar.</span></div></div>`;
  return `${montar}<div class="row"><button class="b cl" data-act="claudecen" ${S.busy ? "disabled" : ""}>Pedir riscos e oportunidades ao Claude</button><button class="b" data-act="catalogo">Adicionar do catálogo</button><button class="b" data-act="novosc">Novo cenário</button>${busyLine("cen")}${msgLine("cen")}</div>
  ${sug}
  <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">
    <div style="flex:1 1 220px;min-width:0;max-width:300px;display:flex;flex-direction:column;gap:2px">${list}<div class="row xs muted" style="margin-top:8px"><span><span style="display:inline-block;width:10px;height:6px;background:var(--risk)"></span> risco</span><span><span style="display:inline-block;width:10px;height:6px;background:var(--opp)"></span> oportunidade</span></div></div>
    <div style="flex:999 1 420px;min-width:0;display:flex;flex-direction:column;gap:14px">${sc ? scEditor(sc, x) : `<div class="empty">Nenhum cenário ainda. Peça sugestões ao Claude, use o catálogo ou crie um.</div>`}${casosBox(x)}</div>
  </div>`;
}
function scEditor(sc, x) {
  const co = S.co, A = S.A, only = runOnly(co, A.P, A.cens, sc), base = x.cases.base, opp = sc.tipo === "oportunidade";
  const dE = only[0].ebitda - base[0].ebitda, dL = only[0].lev - base[0].lev, r = ramp(sc);
  const lin = impLinhas(sc), nodes = lin.filter(k => +sc.imp[k]).map(k => `<div class="node">${esc(IMP[k].pt)} <b>${impFmt(k, +sc.imp[k])}</b><span class="en">${esc(IMP[k].en)}</span></div>`).join("");
  const livres = Object.keys(IMP).filter(k => !lin.includes(k)), grupos = [...new Set(Object.values(IMP).map(m => m.g))];
  return `<div class="box"><div class="row" style="justify-content:flex-end">${chip(sc.o)}</div>
    <textarea class="tx" data-sc="nome" rows="2" aria-label="Nome do cenário" style="font:600 16px var(--f-head);border:1px solid transparent;padding:4px 6px;min-height:0;resize:none">${esc(sc.nome)}</textarea>
    <div class="row"><label class="f">Categoria<select class="s" data-sc="cat">${Object.entries(CTX).filter(([k]) => k !== "fin").map(([k, c]) => `<option value="${k}" ${k === sc.cat ? "selected" : ""}>${esc(c.nome)}</option>`).join("")}</select></label>
      <label class="f">Tipo<select class="s" data-sc="tipo"><option value="risco" ${!opp ? "selected" : ""}>Risco</option><option value="oportunidade" ${opp ? "selected" : ""}>Oportunidade</option></select></label>
      <label class="f" style="flex:1;min-width:220px">O que muda (raiz da árvore)<input class="tx" data-sc="driver" value="${esc(sc.driver)}"></label></div>
    <div class="thermo ${opp ? "opp" : ""}"><span class="small" style="width:60px">Chance</span><input type="range" min="0" max="100" step="5" value="${sc.chance}" data-sc="chance" aria-label="Chance do cenário"><b style="width:150px">${sc.chance}% · ${probWord(sc.chance)}</b></div>
    <label class="f">Por que essa chance<textarea class="tx" data-sc="porque" rows="2">${esc(sc.porque)}</textarea></label>
    <div class="row"><input class="tx" id="melhorTxt" placeholder="Opcional: o que mudar (ex.: incluir a multa, separar o efeito no câmbio)" style="flex:1;min-width:220px"><button class="b cl" data-act="melhorar" ${S.busy ? "disabled" : ""}>Melhorar este cenário com o Claude</button>${busyLine("mont")}</div>
    <div class="small" style="font-weight:600">Impactos por ano, quando o cenário acontece</div>
    ${lin.length ? `<div style="display:flex;flex-direction:column;gap:8px">${lin.map(k => { const m = IMP[k]; return `<div class="row" style="align-items:flex-start;border:1px solid var(--line2);border-radius:8px;padding:8px 10px;gap:12px">
      <div style="flex:1;min-width:200px"><b class="small">${esc(m.pt)}</b><span class="en">${esc(m.en)} · ${esc(m.unid)}</span><div class="xs muted" style="margin-top:3px">${esc(m.txt)} Exemplo: ${esc(m.ex)}.</div></div>
      <label class="f" style="align-items:flex-end">Valor<input class="n" data-imp="${k}" value="${fmt(+sc.imp[k] || 0, m.u === " mi" ? 0 : 1)}" aria-label="${esc(m.pt)}"></label>
      <button class="link" data-act="delimp" data-k="${k}" aria-label="Tirar ${esc(m.pt)}" style="margin-top:22px">tirar</button></div>`; }).join("")}</div>` : `<div class="note">Nenhuma linha ainda. Escolha abaixo em qual linha das demonstrações o cenário mexe, ou peça ao Claude para montar com você.</div>`}
    ${livres.length ? `<div class="row"><label class="f" style="min-width:260px">Adicionar impacto em<select class="s" id="addImp"><option value="">escolha a linha…</option>${grupos.map(g => `<optgroup label="${esc(g)}">${livres.filter(k => IMP[k].g === g).map(k => `<option value="${k}">${esc(IMP[k].pt)} (${esc(IMP[k].unid)})</option>`).join("")}</optgroup>`).join("")}</select></label></div>` : ""}
    <div class="small" style="font-weight:600">Árvore de impacto · primeiro ano, se o cenário acontecer inteiro (comparado com o caso base)</div>
    <div class="tree"><div class="node root">${esc(sc.driver || sc.nome)}</div><div class="arr"></div><div style="display:flex;flex-direction:column;gap:6px">${nodes || `<div class="node muted">sem impacto definido</div>`}</div><div class="arr"></div>
      <div class="node">Efeito no lucro antes de juros, impostos, depreciação e amortização de ${only[0].ano}: <b>${dE >= 0 ? "+" : "−"}${mi(Math.abs(dE))} mi</b><span class="en">EBITDA effect · de ${mi(base[0].ebitda)} sem o cenário para ${mi(only[0].ebitda)} com ele</span></div><div class="arr"></div>
      <div class="node">Alavancagem de ${only[0].ano} <b>${xx(base[0].lev, 2)} → ${xx(only[0].lev, 2)}</b><span class="en">Net debt to EBITDA${nn(dL) ? ", " + (dL >= 0 ? "+" : "") + fmt(dL, 2) + "x" : ""}</span></div></div>
    <div class="small" style="font-weight:600">Rampa · quanto do impacto chega em cada ano</div>
    <div class="pills">${Object.entries(FORMAS).map(([k, f]) => `<button data-act="forma" data-k="${k}" aria-pressed="${sc.forma === k}" title="${esc(f.txt)}">${esc(f.nome)}</button>`).join("")}<button data-act="forma" data-k="custom" aria-pressed="${sc.forma === "custom"}">Editar ano a ano</button></div>
    <div class="rampa">${r.map((v, t) => `<div>${sc.forma === "custom" ? `<input class="n" style="width:56px" data-ramp="${t}" value="${fmt(v * 100)}">` : ""}<i style="height:${Math.max(2, v * 60)}px;background:${opp ? "var(--opp)" : "var(--risk)"};opacity:${.45 + .55 * v}"></i>${base[t].ano} · ${fmt(v * 100)}%</div>`).join("")}</div>
    <div class="row"><label class="row small"><input type="checkbox" data-scon="${sc.id}" ${sc.ativo ? "checked" : ""}> Usar nos casos e no relatório</label><span style="flex:1"></span><button class="link" data-act="delsc" data-id="${sc.id}">Excluir cenário</button></div></div>`;
}
function casosBox(x) {
  const rows = [["lev", "Alavancagem", "Net debt to EBITDA"], ["icr", "Cobertura de juros", "EBITDA to interest"], ["liq", "Caixa sobre dívida de curto prazo", "Cash to short-term debt"]];
  return `<div class="box"><h3><span>Efeito nos ratios por caso <span class="en">Credit ratios by case</span></span><span class="r"><span class="seg" role="group" aria-label="Caso mostrado no relatório">${Object.entries(CASOS).map(([k, n]) => `<button data-act="caso" data-k="${k}" aria-pressed="${S.caso === k}">${n}</button>`).join("")}</span></span></h3>
    <div class="tw"><table class="t"><thead><tr><th>Ratio</th>${Object.keys(CASOS).map(c => x.cases[c].map(r => `<th>${CASOS[c]}<span class="en">${r.ano}</span></th>`).join("")).join("")}</tr></thead><tbody>
    ${rows.map(([k, pt, en]) => `<tr><td>${lab(pt, en)}</td>${Object.keys(CASOS).map(c => x.cases[c].map(r => `<td>${vbtn(r[k], xx(r[k], 2), `${pt} · ${CASOS[c]} · ${r.ano}`, {t: "calc", f: CASO_TXT[c], fx: k === "lev" ? ["Dívida líquida projetada", "÷ Lucro antes de juros, impostos, depreciação e amortização projetado"] : k === "icr" ? ["Lucro antes de juros, impostos, depreciação e amortização projetado", "÷ Despesa de juros projetada"] : ["Caixa projetado", "÷ Dívida de curto prazo atual"], proj: r})}</td>`).join("")).join("")}</tr>`).join("")}
    </tbody></table></div>
    ${casosExplica(x)}</div>`;
}
function casosExplica(x) {
  const A = S.A, cs = A.cens.filter(s => s.ativo), ex = cs.find(s => impLinhas(s).some(k => +s.imp[k])) || cs[0];
  let exTxt = "";
  if (ex) { const k = impLinhas(ex).find(k => +ex.imp[k]) || "receita", m = IMP[k], v = +ex.imp[k] || 0, f = n => impFmt(k, n), opp = ex.tipo === "oportunidade";
    exTxt = `<div class="small" style="background:var(--bg);border-radius:8px;padding:10px 12px"><b>Exemplo com "${esc(ex.nome)}"</b> (${ex.tipo}, chance ${ex.chance}%, ${esc(m.pt.toLowerCase())} ${f(v)} quando acontece, rampa "${esc(FORMAS[ex.forma]?.nome || "ajustada")}"):
      no primeiro ano entra ${f(0)} no base, ${f(v * ex.chance / 100 * ramp(ex)[0])} no moderado (${f(v)} × ${ex.chance}% × ${fmt(ramp(ex)[0] * 100)}% da rampa), ${f(opp ? 0 : v * ramp(ex)[0])} no estresse e ${f(opp ? v * ramp(ex)[0] : 0)} no otimista.</div>`; }
  const nr = cs.filter(s => s.tipo !== "oportunidade").length, no = cs.length - nr;
  return `<div class="small" style="display:flex;flex-direction:column;gap:4px">${Object.keys(CASOS).map(c => `<div>${esc(CASO_TXT[c])}</div>`).join("")}</div>
    ${exTxt}
    <div class="xs muted">Hoje há ${nr} risco${nr === 1 ? "" : "s"} e ${no} oportunidade${no === 1 ? "" : "s"} marcados${no ? "" : ": sem oportunidades, o otimista fica igual ao base. Peça oportunidades ao Claude ou crie uma"}. Sem simulação de Monte Carlo: são quatro contas diretas. O caso escolhido no seletor acima é o que entra no relatório.</div>`;
}

// ---------- 3. Análise ----------
function tabAna() {
  const A = S.A, f = S.ctxF, cxs = A.cx.filter(c => f === "todos" || c.ctx === f);
  const sug = A.sug.cx.length ? `<div class="sugbox"><b class="small">Caixas sugeridas a partir dos anexos</b>${A.sug.cx.map(c => `<div class="small" style="border-top:1px solid #E5DCF3;padding-top:6px"><b>${esc(CTX[c.ctx].nome)} · ${esc(c.titulo)}</b><div>${esc(c.texto)}</div><div class="row" style="margin-top:4px"><button class="b" data-act="sugcx" data-id="${c.id}" data-ok="1">Aceitar</button><button class="b" data-act="sugcx" data-id="${c.id}">Descartar</button></div></div>`).join("")}</div>` : "";
  return `<div class="box"><h3><span>Tese <span class="en">Credit thesis</span></span><span class="r">${A.tese.o ? chip(A.tese.o) : ""}</span></h3>
    <textarea class="tx" data-tese rows="4" placeholder="A caixa cinza do topo do relatório. Escreva ou peça ao Claude depois de marcar as caixas.">${esc(A.tese.txt)}</textarea>
    <div class="row"><button class="b cl" data-act="claudetese" ${S.busy ? "disabled" : ""}>Escrever a tese com o Claude</button>${busyLine("tese")}${msgLine("tese")}</div></div>
  <div class="row"><div class="pills" role="group" aria-label="Filtrar por contexto"><button data-act="ctxf" data-k="todos" aria-pressed="${f === "todos"}">Todos</button>${CTX_ANALISE.map(k => `<button data-act="ctxf" data-k="${k}" aria-pressed="${f === k}">${esc(CTX[k].nome)}</button>`).join("")}</div></div>
  <div class="xs muted">${CTX_ANALISE.map(k => `<b>${esc(CTX[k].nome)}</b>: ${esc(CTX[k].txt)}`).join(" · ")}</div>
  <div class="row"><button class="b cl" data-act="claudecx" ${S.busy ? "disabled" : ""}>Escrever ${f === "todos" ? "as caixas" : "caixas de " + esc(CTX[f].nome)} com o Claude</button><button class="b" data-act="novacx">Nova caixa</button>${busyLine("cx")}${msgLine("cx")}</div>
  ${sug}
  ${cxs.length ? cxs.map(cxBox).join("") : `<div class="empty">Nenhuma caixa ${f === "todos" ? "" : "neste contexto "}ainda.</div>`}`;
}
function cxBox(c) {
  const ncom = S.A.coms.filter(m => m.alvo === "cx:" + c.id).length, alt = c.alt?.[c.marca];
  return `<div class="cx m-${c.marca}"><div class="row" style="justify-content:space-between"><span class="xs" style="font-weight:700;color:var(--mut);letter-spacing:.05em">${esc(CTX[c.ctx].nome.toUpperCase())}</span><span class="row">${chip(c.o)}${ncom ? `<span class="xs muted">${ncom} comentário${ncom > 1 ? "s" : ""}</span>` : ""}</span></div>
    <input class="tx" data-cx="titulo" data-id="${c.id}" value="${esc(c.titulo)}" aria-label="Título da caixa" style="font-weight:600">
    <textarea class="tx" data-cx="texto" data-id="${c.id}" rows="3" aria-label="Texto da caixa">${esc(c.texto)}</textarea>
    <div class="marks" role="group" aria-label="Como usar esta caixa">${Object.entries(MARCAS).map(([k, n]) => `<button data-act="marca" data-id="${c.id}" data-k="${k}" aria-pressed="${c.marca === k}">${n}</button>`).join("")}</div>
    ${c.marca === "ameniza" || c.marca === "enfase" ? `<div class="small" style="display:flex;flex-direction:column;gap:6px;background:var(--bg);border-radius:8px;padding:10px">
      <b>${c.marca === "ameniza" ? "Versão amenizada" : "Versão com ênfase"}</b>${alt ? `<textarea class="tx" data-alt="${c.marca}" data-id="${c.id}" rows="3">${esc(alt.texto)}</textarea>` : `<span class="muted">Sem versão ainda: o relatório usa o texto acima${c.marca === "enfase" ? " em destaque e a tese dá mais peso a ele" : ""}.</span>`}
      <div class="row"><button class="b cl" data-act="rw" data-id="${c.id}" ${S.busy ? "disabled" : ""}>${alt ? "Gerar de novo" : "Gerar"} com o Claude</button>${busyLine("rw_" + c.id)}${msgLine("rw_" + c.id)}</div></div>` : ""}
    <div class="row"><button class="link" data-act="comentar" data-alvo="cx:${c.id}">Comentar</button><span style="flex:1"></span><button class="link" data-act="delcx" data-id="${c.id}">Excluir</button></div></div>`;
}

// ---------- 4. Spread ----------
const IDXN = {di: "CDI +", ipca: "IPCA +", pre: "Prefixado"};
// Debêntures do setor: casa o nome do emissor na ANBIMA com o cadastro da CVM
function debsSetor(co) {
  if (!S.TIT || !S.idx) return [];
  if (!S.mapEm) { S.mapEm = {}; S.idx.forEach(r => { const k = normN(r[2] || r[1]).split(" ").slice(0, 2).join(" "); if (k) S.mapEm[k] = r; }); }
  return S.TIT.deb.filter(d => { const k = normN(d.n).split(" ").slice(0, 2).join(" "); const r = S.mapEm[k]; return r && r[3] === co.setor; });
}
const spreadDe = d => d.idx === "di" ? d.t : d.sg;
function tabSpr() {
  const x = X(), A = S.A, SP = A.SP, pr = x.pr, pb = pr.pb, co = x.co, TIT = S.TIT, cdi = S.OF?.cdi?.valor, ix = S.idxSp || "di";
  const inp = (k, v) => `<input class="n" data-sp="${k}" value="${fmt(v * 100, 2)}" aria-label="${esc(k)}">%`;
  const own = TIT ? debsDe({anbima: {deb: TIT.deb}}, co) : debsDe(S.OF, co), setor = debsSetor(co);
  const ownIx = own.filter(d => d.idx === ix && nn(spreadDe(d))), setIx = setor.filter(d => d.idx === ix && nn(spreadDe(d)) && nn(d.dur));
  const medOwn = ownIx.length ? median(ownIx.map(spreadDe)) / 100 : null, medSet = setIx.length ? median(setIx.map(spreadDe)) / 100 : null;
  const pc = pdPorCaso(co, A.P, A.cens), J = justoPorIndexador(TIT, pr.justo, SP.prazo, nn(cdi) ? cdi / 100 : null);
  const it = pb.base.items;
  return `<div class="row"><label class="row small" style="font-weight:600"><input type="checkbox" data-sp="on" ${SP.on ? "checked" : ""}> Incluir a calculadora de spread no relatório</label></div>
  <div class="grid2">
    <div class="box"><h3>Montagem do spread justo <span class="r">ao ano, prêmio de crédito</span></h3>
      ${cascata([{nome: "Perda esperada", v: pr.EL, cor: GC.ebitda}, {nome: "Custo do capital", v: pr.cap, cor: GC.mod}, {nome: "Custo operacional", v: pr.opex, cor: GC.gray}], pr.justo,
        [medOwn != null ? {nome: `Mercado: papéis da ${co.comercial.slice(0, 18)} (${IDXN[ix]})`, v: medOwn, cor: GC.ebitdaP} : null, medSet != null ? {nome: `Mercado: mediana do setor (${IDXN[ix]})`, v: medSet, cor: GC.gray} : null].filter(Boolean))}
      <div class="xs muted">${ix === "di" ? "Spread sobre o CDI." : `Spread sobre o título público do mesmo prazo (${ix === "ipca" ? "NTN-B" : "LTN e NTN-F"}).`} Mercado: taxas indicativas da ANBIMA de ${esc((TIT?.data || "").split("-").reverse().join("/"))}.</div></div>
    <div class="box"><h3>Chance de inadimplência por caso <span class="r">nota interna</span></h3>
      ${hbars(Object.keys(CASOS).map(c => ({nome: `${CASOS[c]} · ${pc[c].nota}`, v: pc[c].pd, cor: CASE_COLOR[c]})).concat([{nome: "Ponderada", v: pb.pd, cor: GC.ink}]), v => pct(v, 2), {aria: "Chance de inadimplência por caso"})}
      <div class="xs muted">A ponderada é a que entra no spread: base + cada cenário com a sua chance.</div></div>
  </div>
  <div class="box"><h3><span>Mercado: debêntures ${esc(co.setor)} <span class="en">Secondary market spreads, same sector</span></span><span class="r"><span class="seg" role="group" aria-label="Indexador">${Object.entries(IDXN).map(([k, n]) => `<button data-act="idxsp" data-k="${k}" aria-pressed="${ix === k}">${n}</button>`).join("")}</span></span></h3>
    ${setIx.length || ownIx.length ? dispersao(setIx.concat(ownIx.filter(d => nn(d.dur) && !setIx.includes(d))).map(d => ({x: d.dur, y: spreadDe(d), nome: `${d.c} ${d.n}`, destaque: own.includes(d)})), {yRef: (ix === "di" ? pr.justo : pr.justo) * 100, refNome: `spread justo ${fmt(pr.justo * 100, 2)}%`, aria: "Spreads do setor por prazo"}) : `<div class="small muted">Sem debêntures ${IDXN[ix]} deste setor na lista da ANBIMA.</div>`}
    <div class="xs muted">Cada ponto é uma debênture do setor (laranja = da própria companhia). Eixo vertical: ${ix === "di" ? "spread sobre o CDI" : "taxa indicativa menos a taxa do título público do mesmo prazo"}. Linha azul: spread justo calculado aqui.</div></div>
  <div class="box"><h3><span>Taxa justa por indexador <span class="en">Fair yield by index</span></span><span class="r">títulos públicos de ${esc((TIT?.data || "").split("-").reverse().join("/"))}</span></h3>
    <div class="row"><label class="f">Prazo do papel<span class="en">Duration, years</span><input class="n" data-sp="prazo" value="${fmt(SP.prazo, 1)}"></label><span class="xs muted" style="flex:1;min-width:220px">O mesmo prêmio de crédito vale para os três indexadores; muda só a taxa livre de risco do prazo.</span></div>
    <div class="tw"><table class="t"><thead><tr><th>Indexador</th><th>Título público do prazo</th><th>Spread justo</th><th>Taxa justa</th><th>Mercado: papéis da companhia</th></tr></thead><tbody>
      ${Object.entries(J).map(([k, j]) => { const ow = own.filter(d => d.idx === k && nn(spreadDe(d))), m = ow.length ? median(ow.map(spreadDe)) : null;
        return `<tr><td>${esc(j.nome)}</td><td>${k === "di" ? (nn(cdi) ? vbtn(cdi / 100, "CDI " + fmt(cdi, 2) + "%", "CDI", {t: "ofi", f: S.OF.cdi.fonte + ", " + S.OF.cdi.data}) : "–") : nn(j.taxaGov) ? vbtn(j.taxaGov / 100, fmt(j.taxaGov, 2) + "%", (k === "ipca" ? "NTN-B" : "Curva prefixada") + " no prazo", {t: "ofi", f: `${TIT.fonte}. Interpolação linear da curva ${k === "ipca" ? "de NTN-B (juro real)" : "de LTN e NTN-F"} em ${fmt(SP.prazo, 1)} anos.`, link: TIT.link_tit}) : "–"}</td>
          <td>${pct(pr.justo, 2)}</td><td><b>${k === "di" ? "CDI + " + pct(pr.justo, 2) : nn(j.justo) ? (k === "ipca" ? "IPCA + " : "") + pct(j.justo, 2) : "–"}</b></td>
          <td>${m != null ? vbtn(m / 100, (k === "di" ? "CDI + " : "+ ") + fmt(m, 2) + "%" + (k === "di" ? "" : " sobre o título"), "Mediana dos papéis da companhia", {t: "ofi", f: `${TIT.fonte}. ${ow.map(d => `${d.c} vence ${d.v}: ${d.e}, taxa indicativa ${fmt(d.t, 2)}%`).join("; ")}.`, link: TIT.link_deb}) : '<span class="muted">sem papel</span>'}</td></tr>`; }).join("")}
    </tbody></table></div></div>
  <div class="box"><h3><span>Peças do spread <span class="en">Fair credit spread</span></span><span class="r">clique no valor para ver a conta</span></h3>
    <div class="row"><label class="f">Garantia<select class="s" data-sp="garantia"><option value="quiro" ${SP.garantia === "quiro" ? "selected" : ""}>Sem garantia real</option><option value="real" ${SP.garantia === "real" ? "selected" : ""}>Com garantia real</option></select></label>
      <label class="f">Perda se inadimplir<span class="en">Loss given default</span><span>${inp("lgd", SP.lgd[SP.garantia])}</span></label>
      <label class="f">Capital alocado<span class="en">Allocated capital</span><span>${inp("capital", SP.capital)}</span></label>
      <label class="f">Prêmio exigido do capital<span class="en">Capital premium</span><span>${inp("premio", SP.premio)}</span></label>
      <label class="f">Custo operacional<span class="en">Operating cost</span><span>${inp("opex", SP.opex)}</span></label></div>
    <div class="tw"><table class="t"><thead><tr><th>Peça</th><th>Valor</th><th>Como calculamos</th></tr></thead><tbody>
      <tr><td>${lab("Chance de inadimplência, caso base", "Probability of default, base case")}</td><td>${vbtn(pb.base.pd, pct(pb.base.pd, 2), "Chance de inadimplência, caso base", {t: "calc", f: `Nota interna ${pb.base.nota} (${fmt(pb.base.score, 0)} pontos). ${ESCALA_FONTE}`})}</td><td class="xs" style="text-align:left">Nota pelos ratios do pior ano do caso base e a chance de inadimplência da nota.</td></tr>
      <tr><td>${lab("Chance ponderada pelos cenários", "Scenario-weighted probability of default")}</td><td>${vbtn(pb.pd, pct(pb.pd, 2), "Chance ponderada", {t: "calc", fx: ["Chance na base", "+ Σ chance do cenário × (chance de inadimplência no cenário − chance na base)"], fxen: "PD base + Σ p(scenario) × (PD scenario − PD base)", f: pb.scs.map(s => `${s.sc.nome}: ${s.sc.chance}% × (${pct(s.r.pd, 2)} − ${pct(pb.base.pd, 2)}) = ${pct(s.add, 3)}`).join(" · ") || "Nenhum cenário marcado com chance."})}</td><td class="xs" style="text-align:left">Cada cenário soma a sua chance vezes o quanto muda a chance de inadimplência.</td></tr>
      <tr><td>${lab("Perda se inadimplir", "Loss given default")}</td><td>${vbtn(pr.lgd, pct(pr.lgd, 0), "Perda se inadimplir", {t: "prem", f: "1 − taxa de recuperação. Ponto de partida: 60% sem garantia real e 35% com garantia real, próximos dos estudos de recuperação de dívida corporativa. Editável."})}</td><td class="xs" style="text-align:left">Parte da dívida que não volta ao credor.</td></tr>
      <tr><td>${lab("Perda esperada", "Expected loss")}</td><td>${vbtn(pr.EL, pct(pr.EL, 2), "Perda esperada", {t: "calc", fx: ["Chance de inadimplência ponderada", "× Perda se inadimplir"], fxen: "Probability of default × Loss given default", f: `${pct(pb.pd, 2)} × ${pct(pr.lgd, 0)} = ${pct(pr.EL, 2)} ao ano.`})}</td><td class="xs" style="text-align:left">Quanto se espera perder por ano, em média.</td></tr>
      <tr><td>${lab("Custo do capital", "Cost of capital")}</td><td>${vbtn(pr.cap, pct(pr.cap, 2), "Custo do capital", {t: "calc", fx: ["Capital alocado", "× Prêmio exigido do capital"], fxen: "Allocated capital × Capital premium", f: `${pct(SP.capital, 1)} × ${pct(SP.premio, 1)} = ${pct(pr.cap, 2)}.`})}</td><td class="xs" style="text-align:left">Retorno a mais que o capital que protege o papel exige.</td></tr>
      <tr><td>${lab("Custo operacional", "Operating cost")}</td><td>${vbtn(pr.opex, pct(pr.opex, 2), "Custo operacional", {t: "prem", f: "Custo de acompanhar o papel. Premissa editável."})}</td><td></td></tr>
      <tr><td><b>${lab("Spread justo", "Fair spread")}</b></td><td><b>${vbtn(pr.justo, pct(pr.justo, 2), "Spread justo", {t: "calc", fx: ["Perda esperada", "+ Custo do capital", "+ Custo operacional"], fxen: "Expected loss + Cost of capital + Operating cost", f: `${pct(pr.EL, 2)} + ${pct(pr.cap, 2)} + ${pct(pr.opex, 2)} = ${pct(pr.justo, 2)}.`})}</b></td><td></td></tr>
    </tbody></table></div></div>
  <div class="box"><h3>Nota interna, caso base <span class="r">${esc(pb.base.nota)} · ${fmt(pb.base.score, 0)} pontos</span></h3>
    <div class="tw"><table class="t"><thead><tr><th>Item</th><th>Valor</th><th>Pontos</th><th>Peso</th></tr></thead><tbody>${it.map(i => `<tr><td>${esc(i.pt)}</td><td>${i.k === "esc" ? mi(i.v) : xx(i.v, 2)}</td><td>${fmt(i.s, 0)}</td><td>${pct(i.w, 0)}</td></tr>`).join("")}</tbody></table></div>
    <div class="xs muted">Escala: ${ESCALA.map(e => `${e.nota} a partir de ${e.min} pontos, ${pct(e.pd, 2)}`).join(" · ")}. ${esc(ESCALA_FONTE)}</div></div>`;
}

// ---------- 5. Anexos ----------
function tabAnx() {
  const A = S.A;
  const N = S.news, q0 = S.newsQ ?? (S.co.comercial || "").replace(/\b(S\/A|S\.A\.|SA)\b/g, "").trim();
  const newsBox = `<div class="box"><h3><span>Buscar notícias <span class="en">News search</span></span><span class="r">Bing Notícias, pelo navegador do app Claude do Mac</span></h3>
    <div class="row" style="align-items:flex-end"><label class="f" style="flex:1;min-width:220px">Termo<input class="tx" id="newsQ" value="${esc(q0)}"></label><button class="b pri" data-act="news" ${S.busy ? "disabled" : ""}>Buscar</button>${busyLine("news")}</div>
    ${msgLine("news")}
    ${N?.items?.length ? `<div style="display:flex;flex-direction:column;gap:4px;max-height:360px;overflow:auto">${N.items.map(i => `<label class="row small" style="align-items:flex-start;border-top:1px solid var(--line2);padding:6px 0;gap:8px;flex-wrap:nowrap"><input type="checkbox" data-news="${i.id}" ${i.sel ? "checked" : ""} style="margin-top:3px"><span style="min-width:0"><b>${esc(i.titulo)}</b><span class="en">${esc(i.fonte)}${i.data ? " · " + esc(i.data) : ""}</span><span class="xs muted">${esc(i.resumo)}</span></span></label>`).join("")}</div>
      <div class="row"><button class="b pri" data-act="newsuse">Usar as marcadas</button><span class="xs muted">Viram anexos. O Claude lê a matéria inteira quando você clicar em Ler ou em Analisar todas.</span></div>` : ""}
    <div class="xs muted">Por que só no app do Mac: a página do relatório não pode abrir outros sites (regra de segurança do claude.ai) e o Claude que ela chama não navega na internet. Quem busca é o navegador do app Claude; o Claude só analisa o que você escolher.</div></div>`;
  const pend = A.anexos.filter(a => !a.lido).length;
  return `${newsBox}
  <div class="box"><h3>Anexar <span class="r">notícias, relatórios, reports, planilhas</span></h3>
    <div class="row" style="align-items:flex-end"><label class="f" style="flex:1;min-width:220px">Link<input class="tx" id="lnk" placeholder="https://…"></label><label class="f" style="flex:1;min-width:160px">Título<input class="tx" id="lnkt" placeholder="ex.: Notícia sobre cota de exportação"></label><button class="b" data-act="addlink">Adicionar link</button></div>
    <div class="xs muted">Ao clicar em Ler, o navegador do app Claude do Mac abre o link e o Claude lê o texto. No navegador comum, cole o texto da matéria no campo do anexo.</div>
    <label class="b" style="align-self:flex-start">Escolher arquivos (PDF, Excel, CSV, texto)<input type="file" id="fileIn" multiple accept=".pdf,.xlsx,.xls,.csv,.txt,.md" hidden></label>${msgLine("anx")}</div>
  ${pend > 1 ? `<div class="row"><button class="b cl" data-act="lertodos" ${S.busy ? "disabled" : ""}>Analisar todas as ${pend} ainda não lidas com o Claude</button>${msgLine("anx")}</div>` : ""}
  ${A.anexos.length ? A.anexos.map(a => `<div class="box"><h3><span>${esc(a.nome)} <span class="en">${esc(a.tipo)}${a.data ? " · " + esc(a.data) : ""}</span></span><span class="r">${a.lido ? "lido" : "ainda não lido"}</span></h3>
    ${a.link ? `<div class="small"><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.link)}</a></div>` : ""}
    ${a.tipo === "link" ? `<textarea class="tx" data-anxtxt="${a.id}" rows="3" placeholder="Opcional: o texto é buscado sozinho no app Claude do Mac; no navegador comum, cole aqui">${esc(a.texto || "")}</textarea>` : `<div class="xs muted">${FTEXT[a.id] ? fmt(FTEXT[a.id].length) + " caracteres de texto extraídos" : "Texto do arquivo não está nesta sessão; escolha o arquivo de novo para ler."}</div>`}
    ${a.resumo ? `<div class="small"><b>Resumo:</b> ${esc(a.resumo)} ${chip({t: "claude", f: "Resumo do Claude"})}</div>` : ""}
    ${a.numeros?.length ? `<div class="tw"><table class="t"><thead><tr><th>Número no anexo</th><th>Valor</th><th>Onde</th></tr></thead><tbody>${a.numeros.map(n => `<tr><td>${esc(n.nome)}</td><td>${esc(n.valor)} ${esc(n.unidade || "")}</td><td style="text-align:left">${esc(n.onde || "")}</td></tr>`).join("")}</tbody></table></div>` : ""}
    ${a.gerou ? `<div class="xs">Gerou ${a.gerou.cens} cenários e ${a.gerou.cx} caixas.</div>` : ""}
    <div class="row"><button class="b cl" data-act="ler" data-id="${a.id}" ${S.busy ? "disabled" : ""}>${a.lido ? "Ler de novo" : "Ler"} com o Claude</button>${busyLine("anx_" + a.id)}<span style="flex:1"></span><button class="link" data-act="delanx" data-id="${a.id}">Remover</button></div></div>`).join("") : `<div class="empty">Nenhum anexo. Links e arquivos que você trouxer viram cenários e caixas sugeridos, sempre com a origem apontando para o anexo.</div>`}`;
}

// ---------- 6. Comentários ----------
function tabCom() {
  const A = S.A, alvos = [["geral", "Análise em geral"], ...ROWS.map(r => ["num:" + r.id, "Número: " + r.pt]), ...A.cens.map(s => ["cen:" + s.id, "Cenário: " + s.nome]), ...A.cx.map(c => ["cx:" + c.id, "Caixa: " + c.titulo])];
  return `<div class="box"><h3>Novo comentário</h3>
    <label class="f">Prender a<select class="s" id="comAlvo">${alvos.map(([k, n]) => `<option value="${esc(k)}" ${S.comAlvo === k ? "selected" : ""}>${esc(n.slice(0, 90))}</option>`).join("")}</select></label>
    <textarea class="tx" id="comTxt" rows="3" placeholder="Uma nota sua sobre um número, uma caixa ou um cenário"></textarea>
    <div class="row"><button class="b pri" data-act="addcom">Comentar</button></div></div>
  ${A.coms.length ? A.coms.slice().reverse().map(c => `<div class="box"><div class="xs muted">${esc(c.quem || "Você")} · ${new Date(c.em).toLocaleString("pt-BR", {day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"})} · ${esc(alvoNome(c.alvo))}${c.resolvido ? " · resolvido" : ""}</div>
    <div class="small">${esc(c.txt)}</div>
    ${(c.resps || []).map(r => `<div class="small" style="background:#FBF9FE;border-radius:8px;padding:8px 10px">${chip({t: "claude"})} ${esc(r.txt)}</div>`).join("")}
    <div class="row"><label class="row small"><input type="checkbox" data-comrel="${c.id}" ${c.rel ? "checked" : ""}> Levar para o relatório</label><button class="b cl" data-act="claudecom" data-id="${c.id}" ${S.busy ? "disabled" : ""}>Pedir ao Claude</button>${busyLine("com_" + c.id)}${msgLine("com_" + c.id)}<span style="flex:1"></span><button class="link" data-act="resolver" data-id="${c.id}">${c.resolvido ? "Reabrir" : "Resolver"}</button><button class="link" data-act="delcom" data-id="${c.id}">Excluir</button></div></div>`).join("") : `<div class="empty">Nenhum comentário. Por padrão eles ficam só no app; marcados, entram no relatório como nota no fim.</div>`}`;
}

// ---------- popover de origem ----------
function showPop(id, el) {
  const it = S.origs[+id]; if (!it) return; const o = it.o || {}, k = ORIG[o.t] ? o.t : "prem";
  const p = $("#pop");
  p.innerHTML = `<div class="pop" role="dialog" aria-label="Origem"><h4><span>${esc(it.titulo)}</span><span class="chip ${ORIG[k].cls}">${ORIG[k].nome}</span></h4>
    ${it.txt && it.txt !== "–" ? `<div style="font:600 18px var(--f-head)">${it.txt}</div>` : ""}
    ${o.fx ? `<div class="eq"><div class="l1">=</div>${o.fx.map(l => `<div>${esc(l)}</div>`).join("")}${o.fxen ? `<span class="en">${esc(o.fxen)}</span>` : ""}</div>` : ""}
    ${o.f ? `<div>${esc(o.f)}</div>` : ""}${o.nota ? `<div class="muted">${esc(o.nota)}</div>` : ""}
    ${o.doc ? `<div class="muted">Documento: ${esc(o.doc)}${o.ref ? ", data-base " + esc(o.ref.split("-").reverse().join("/")) : ""}${o.entregue ? ", entregue em " + esc(o.entregue.split("-").reverse().join("/")) : ""}</div>` : ""}
    ${o.link ? `<a href="${esc(o.link)}" target="_blank" rel="noopener">Abrir o documento</a>` : ""}
    <div class="xs muted">${esc(ORIG[k].txt)}</div><div><button class="link" data-act="popclose">fechar</button></div></div>`;
  p.hidden = false; const box = p.firstElementChild, r = el.getBoundingClientRect();
  let top = r.bottom + 6, left = Math.min(r.left, innerWidth - box.offsetWidth - 16); if (top + box.offsetHeight > innerHeight - 10) top = Math.max(10, r.top - box.offsetHeight - 6);
  box.style.top = top + "px"; box.style.left = Math.max(16, left) + "px";
}

// ---------- modal ----------
function modal(html) { const m = $("#modal"); if (!html) { m.hidden = true; m.innerHTML = ""; return; } m.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div>${html}<div><button class="b" data-act="fechar">Fechar</button></div></div></div>`; m.hidden = false; }
function metodo() {
  modal(`<h2>Metodologia</h2>
  <div class="small"><b>Dados.</b> Demonstrações consolidadas entregues à CVM (DFP de cada ano e ITR do trimestre mais recente), com as reapresentações aplicadas e as identidades contábeis conferidas. Últimos 12 meses = último ano fechado + acumulado do ano atual − acumulado do mesmo período do ano anterior. Valores nominais em R$ milhões, sem desconto a valor presente.</div>
  <div class="small"><b>Etiquetas.</b> ${Object.values(ORIG).map(o => `<span class="chip ${o.cls}">${o.nome}</span> ${esc(o.txt)}`).join(" · ")}.</div>
  <div class="small"><b>Projeção.</b> ${NP} anos a partir dos últimos 12 meses. Receita cresce pela premissa; margem, depreciação, investimentos e dividendos são proporções; juros = dívida bruta × custo da dívida; imposto de 34% sobre o lucro positivo. A dívida bruta é rolada e o caixa livre de cada ano muda a dívida líquida.</div>
  <div class="small"><b>Cenários.</b> Cada cenário tem chance, impactos anuais e uma rampa. Base: sem cenários. Moderado: impacto × chance. Estresse: impacto inteiro, sem considerar a chance. Sem Monte Carlo.</div>
  <div class="small"><b>Nota e chance de inadimplência.</b> Pontos de 0 a 100 por item, pela tabela de faixas, com pesos ${Object.values(SCORE).map(s => `${esc(s.pt)} ${pct(s.w, 0)}`).join(", ")}. ${esc(ESCALA_FONTE)}</div>
  <div class="small"><b>Perda esperada.</b> Chance de inadimplência ponderada pelos cenários × perda se inadimplir. Spread justo = perda esperada + capital alocado × prêmio + custo operacional.</div>`);
}

// ---------- render ----------
// A prévia das 3 páginas é a parte mais pesada: ela espera você parar de digitar ou de arrastar.
let pvT; const schedulePreview = (ms = 300) => { clearTimeout(pvT); pvT = setTimeout(renderPreview, ms); };
function render() {
  S.origs = [];
  const ae = document.activeElement, keep = ae && ae.id ? {id: ae.id, s: ae.selectionStart, e: ae.selectionEnd} : null;
  $("#top").innerHTML = renderTop();
  $("#work").innerHTML = renderWork();
  schedulePreview(30);
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch (_) {} } }
}

// ---------- carregar ----------
const J = p => fetch(p).then(r => { if (!r.ok) throw new Error(p); return r.json(); });
async function pick(cd) {
  const r = S.idx.find(x => x[0] === +cd); if (!r) return;
  S.q = r[2]; S.sugOpen = false; S.loading = true; render();
  try {
    const shard = await J(`s${String(r[5]).padStart(2, "0")}.json`); const co = shard[String(cd)]; if (!co) throw new Error("companhia não encontrada no arquivo");
    S.co = co; S.A = null;
    const db = await getDB();
    if (db) { try { const d = await db.doc("relatorios/" + cd).get(); if (d.exists) S.A = migrate(JSON.parse(d.data().json), co); } catch (_) {} }
    if (!S.A) { try { const l = JSON.parse(localStorage.getItem("rc_" + cd) || "null"); if (l) S.A = migrate(l, co); } catch (_) {} }
    S.A ||= blank(co); S.anos = S.A.anos || 3; S.selSc = null; S.tab = "num";
    try { localStorage.setItem("rc_ultima", String(cd)); } catch (_) {}
  } catch (e) { toast("Não consegui carregar: " + e.message); }
  S.loading = false; CACHE = null; render();
}
let saveT;
function scheduleSave() { if (!S.A) return; S.A.anos = S.anos; clearTimeout(saveT); saveT = setTimeout(saveNow, 1200); try { localStorage.setItem("rc_" + S.A.cd, JSON.stringify(S.A)); } catch (_) {} }
async function saveNow() {
  const db = await getDB(), el = () => $("#savemsg");
  if (!db) { S.saveMsg = "Salvo neste navegador"; if (el()) el().textContent = S.saveMsg; return; }
  try { await db.doc("relatorios/" + S.A.cd).set({nome: S.A.nome, atualizado: new Date().toISOString(), json: JSON.stringify(S.A)}); S.saveMsg = "Salvo " + new Date().toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}); }
  catch (e) { S.saveMsg = "Salvo só neste navegador (" + (e.code || e.message) + ")"; }
  if (el()) el().textContent = S.saveMsg;
}

// ---------- arquivos anexados ----------
const LIBS = {xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", h2c: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js", ppt: "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"};
const loaded = {};
const loadLib = k => loaded[k] ||= new Promise((ok, no) => { const s = document.createElement("script"); s.src = LIBS[k]; s.onload = ok; s.onerror = () => { loaded[k] = null; no(new Error("não carregou a biblioteca " + k)); }; document.head.appendChild(s); });
async function readFiles(list) {
  S.msg.anx = {t: "Lendo arquivos…"}; render();
  for (const file of list) {
    try {
      let txt = "";
      if (/\.pdf$/i.test(file.name)) {
        await loadLib("pdf"); const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const doc = await lib.getDocument({data: await file.arrayBuffer()}).promise;
        for (let p = 1; p <= Math.min(doc.numPages, 60); p++) { const c = await (await doc.getPage(p)).getTextContent(); let lastY = null, line = "";
          c.items.forEach(it => { const y = Math.round(it.transform[5]); if (lastY !== null && Math.abs(y - lastY) > 2) { txt += line.trim() + "\n"; line = ""; } line += it.str + " "; lastY = y; }); txt += line + "\n--- página " + p + " ---\n"; }
      } else if (/\.(xlsx|xls)$/i.test(file.name)) {
        await loadLib("xlsx"); const wb = window.XLSX.read(await file.arrayBuffer()); wb.SheetNames.forEach(n => { txt += `### planilha ${n}\n` + window.XLSX.utils.sheet_to_csv(wb.Sheets[n], {FS: ";"}) + "\n"; });
      } else txt = await file.text();
      let a = S.A.anexos.find(x => x.nome === file.name && x.tipo !== "link");
      if (!a) { a = {id: uid(), nome: file.name, tipo: /\.pdf$/i.test(file.name) ? "PDF" : /\.xls/i.test(file.name) ? "planilha" : "texto", em: new Date().toISOString()}; S.A.anexos.push(a); }
      FTEXT[a.id] = txt;
      S.msg.anx = txt.replace(/\s/g, "").length < 200 ? {t: `${file.name}: quase sem texto (PDF escaneado?).`, bad: true} : {t: "Arquivo pronto. Clique em Ler com o Claude quando quiser."};
    } catch (e) { S.msg.anx = {t: `${file.name}: ${e.message}`, bad: true}; }
  }
  changed();
}

// ---------- eventos ----------
document.addEventListener("click", async ev => {
  const t = ev.target.closest("[data-act]");
  if (!t) { if (!ev.target.closest(".pop")) $("#pop").hidden = true; if (!ev.target.closest(".search") && S.sugOpen) { S.sugOpen = false; $("#top").innerHTML = renderTop(); } return; }
  const act = t.dataset.act, id = t.dataset.id, A = S.A;
  const sc = () => A.cens.find(s => s.id === (S.selSc || A.cens[0]?.id));
  switch (act) {
    case "orig": ev.preventDefault(); showPop(t.dataset.o, t); return;
    case "popclose": $("#pop").hidden = true; return;
    case "pick": return pick(t.dataset.cd);
    case "anos": S.anos = +t.dataset.n; return changed();
    case "tab": S.tab = t.dataset.k; $("#pop").hidden = true; return render();
    case "stop": CTRL?.abort(); return;
    case "metodo": return metodo();
    case "recomecar": return modal(`<h2>Recomeçar a análise de ${esc(S.co.comercial)}?</h2>
      <p class="small">Apaga ${A.cens.length} cenário(s), ${A.cx.length} caixa(s) de texto, a tese, ${A.anexos.length} anexo(s), ${A.coms.length} comentário(s), as sugestões pendentes, o logo e as premissas e o spread que você editou. Os números da CVM continuam. Não dá para desfazer.</p>
      <div class="row"><button class="b pri" data-act="recomecarOk">Apagar e recomeçar</button></div>`);
    case "recomecarOk": S.A = blank(S.co); S.selSc = null; S.news = null; S.msg = {}; S.tab = "num"; modal(null); toast("Análise recomeçada do zero."); return changed();
    case "tier": S.tier = t.dataset.k; try { localStorage.setItem("rc_tier", S.tier); } catch (_) {} $("#top").innerHTML = renderTop(); return;
    case "fechar": return modal(null);
    case "export": return doExport(t.dataset.k);
    case "premreset": A.P = premDefaults(S.co); A.premEdit = {}; return changed();
    // cenários
    case "claudecen": return claudeCenarios();
    case "catalogo": return modal(`<h2>Catálogo de cenários</h2><p class="small muted">Valem para qualquer companhia. Chance e impactos entram como premissas suas; ajuste depois.</p>${Object.keys(CTX).filter(k => k !== "fin").map(k => `<div class="cat">${esc(CTX[k].nome)}</div>${CATALOGO.map((c, i) => c.cat === k ? `<div class="row small" style="justify-content:space-between;border-top:1px solid var(--line2);padding:6px 0"><span><b>${esc(c.nome)}</b><span class="en">${esc(c.driver)}</span></span><button class="b" data-act="addcat" data-i="${i}">Adicionar</button></div>` : "").join("")}`).join("")}`);
    case "addcat": { const s = newSc(CATALOGO[+t.dataset.i]); A.cens.push(s); S.selSc = s.id; S.tab = "cen"; modal(null); return changed(); }
    case "novosc": { const s = newSc({cat: "merc", nome: "Novo cenário"}); A.cens.push(s); S.selSc = s.id; return changed(); }
    case "selsc": if (ev.target.matches("input")) return; S.selSc = id; return render();
    case "addaj": { const v = parseN($("#ajValor").value), n = $("#ajNome").value.trim(); if (v == null || !n) { S.msg.aj = {t: "Preencha o que é e o valor.", bad: true}; return render(); }
      A.aj = A.aj || []; A.aj.push({id: uid(), tipo: $("#ajTipo").value, nome: n, valor: v, fonte: $("#ajFonte").value.trim(), ativo: true, o: {t: "prem", f: "Ajuste do analista. " + ($("#ajFonte").value.trim() || "")}}); S.msg.aj = null; return changed(); }
    case "delaj": A.aj = (A.aj || []).filter(a => a.id !== id); return changed();
    case "claudeaj": return claudeAjustes();
    case "claudeops": return claudeOps();
    case "delop": A.ops.rows.splice(+t.dataset.i, 1); return changed();
    case "sugaj": { const a = (A.sugAj || []).find(x => x.id === id); A.sugAj = A.sugAj.filter(x => x.id !== id); if (a && t.dataset.ok) { A.aj = A.aj || []; A.aj.push(a); } return changed(); }
    case "delimp": { const s = sc(); s.linhas = impLinhas(s).filter(k => k !== t.dataset.k); delete s.imp[t.dataset.k]; return changed(); }
    case "montar": { const d = ($("#montarTxt")?.value || "").trim(); if (!d) { S.msg.mont = {t: "Descreva o cenário em poucas palavras.", bad: true}; return render(); } S.montarTxt = d; return claudeMontar(d, null); }
    case "melhorar": { const s = sc(); if (s) return claudeMontar(($("#melhorTxt")?.value || "").trim(), s); return; }
    case "delsc": A.cens = A.cens.filter(s => s.id !== id); S.selSc = null; return changed();
    case "forma": { const s = sc(); if (!s) return; if (t.dataset.k === "custom") s.ramp = ramp(s).slice(); s.forma = t.dataset.k; return changed(); }
    case "caso": S.caso = t.dataset.k; CACHE = null; return render();
    case "vista": S.vista = t.dataset.k; return render();
    case "idxsp": S.idxSp = t.dataset.k; return render();
    case "sugcen": { const s = A.sug.cens.find(x => x.id === id); A.sug.cens = A.sug.cens.filter(x => x.id !== id);
      if (s && t.dataset.ok) { const n = newSc(s); n.o = s.o; const i = s.substitui ? A.cens.findIndex(c => c.id === s.substitui) : -1; if (i >= 0) { n.id = s.substitui; n.ativo = A.cens[i].ativo; A.cens[i] = n; } else A.cens.push(n); S.selSc = n.id; } return changed(); }
    // análise
    case "ctxf": S.ctxF = t.dataset.k; return render();
    case "claudecx": return claudeCaixas(S.ctxF === "todos" ? CTX_ANALISE : [S.ctxF]);
    case "novacx": A.cx.push({id: uid(), ctx: S.ctxF === "todos" ? "fin" : S.ctxF, titulo: "Novo bloco", texto: "", marca: "sim", o: {t: "prem", f: "Texto escrito pelo analista."}, alt: {}}); return changed();
    case "marca": { const c = A.cx.find(x => x.id === id); c.marca = t.dataset.k; return changed(); }
    case "rw": { const c = A.cx.find(x => x.id === id); return claudeReescrever(c, c.marca); }
    case "delcx": A.cx = A.cx.filter(x => x.id !== id); return changed();
    case "sugcx": { const c = A.sug.cx.find(x => x.id === id); A.sug.cx = A.sug.cx.filter(x => x.id !== id); if (c && t.dataset.ok) A.cx.push(c); return changed(); }
    case "claudetese": return claudeTese();
    case "comentar": S.comAlvo = t.dataset.alvo; S.tab = "com"; return render();
    // anexos
    case "addlink": { const l = $("#lnk").value.trim(); if (!/^https?:\/\//i.test(l)) { S.msg.anx = {t: "Cole um link que comece com https://", bad: true}; return render(); }
      A.anexos.push({id: uid(), nome: $("#lnkt").value.trim() || l.replace(/^https?:\/\//, "").slice(0, 60), tipo: "link", link: l, texto: "", em: new Date().toISOString()}); S.msg.anx = null; return changed(); }
    case "ler": return claudeAnexo(A.anexos.find(a => a.id === id));
    case "news": S.newsQ = $("#newsQ").value.trim(); return buscarNoticias(S.newsQ || S.co.comercial);
    case "newsuse": { const sel = (S.news?.items || []).filter(i => i.sel); sel.forEach(i => { if (!A.anexos.find(a => a.link === i.link)) A.anexos.push({id: uid(), nome: i.titulo, tipo: "link", link: i.link, fonte: i.fonte, data: i.data, resumo0: `${i.titulo}. ${i.resumo} (${i.fonte}, ${i.data})`, texto: "", em: new Date().toISOString()}); });
      S.news.items = S.news.items.filter(i => !i.sel); S.msg.news = {t: `${sel.length} notícias viraram anexos.`}; return changed(); }
    case "lertodos": { for (const a of A.anexos.filter(a => !a.lido)) { await claudeAnexo(a); if (S.msg.anx?.bad && !a.lido) break; } return; }
    case "delanx": A.anexos = A.anexos.filter(a => a.id !== id); return changed();
    // comentários
    case "addcom": { const txt = $("#comTxt").value.trim(); if (!txt) return; A.coms.push({id: uid(), alvo: $("#comAlvo").value, txt, em: new Date().toISOString(), quem: "Você", rel: false}); S.comAlvo = null; return changed(); }
    case "claudecom": return claudeComentario(A.coms.find(c => c.id === id));
    case "resolver": { const c = A.coms.find(x => x.id === id); c.resolvido = !c.resolvido; return changed(); }
    case "delcom": A.coms = A.coms.filter(c => c.id !== id); return changed();
    case "logo": return $("#logoIn")?.click();
    case "logodel": A.logo = ""; return changed();
    
  }
});
document.addEventListener("input", ev => {
  const e = ev.target, A = S.A; if (e.id === "q") { S.q = e.value; S.sugOpen = true; $("#top").innerHTML = renderTop(); const q = $("#q"); q.focus(); q.setSelectionRange(q.value.length, q.value.length); return; }
  if (!A) return;
  const s = A.cens.find(x => x.id === (S.selSc || A.cens[0]?.id));
  if (e.dataset.sc === "chance") { s.chance = +e.value; if (s.o?.t === "claude") s.o = {t: "prem", f: "Chance ajustada pelo analista (sugestão original do Claude)."}; e.nextElementSibling.textContent = `${s.chance}% · ${probWord(s.chance)}`; CACHE = null; schedulePreview(); scheduleSave(); return; }
  if (e.dataset.sc) { s[e.dataset.sc] = e.value; CACHE = null; schedulePreview(); scheduleSave(); return; }
  if (e.dataset.cx) { const c = A.cx.find(x => x.id === e.dataset.id); c[e.dataset.cx] = e.value; if (c.o?.t === "claude") c.o = {t: "prem", f: "Texto do Claude editado pelo analista."}; schedulePreview(); scheduleSave(); return; }
  if (e.dataset.alt) { const c = A.cx.find(x => x.id === e.dataset.id); c.alt[e.dataset.alt].texto = e.value; schedulePreview(); scheduleSave(); return; }
  if (e.hasAttribute("data-tese")) { A.tese.txt = e.value; if (A.tese.o?.t === "claude") A.tese.o = {t: "prem", f: "Tese do Claude editada pelo analista."}; if (!A.tese.o) A.tese.o = {t: "prem", f: "Tese escrita pelo analista."}; schedulePreview(); scheduleSave(); return; }
  if (e.dataset.anxtxt) { const a = A.anexos.find(x => x.id === e.dataset.anxtxt); a.texto = e.value; scheduleSave(); return; }
});
document.addEventListener("change", async ev => {
  const e = ev.target, A = S.A; if (!A) return;
  const s = A.cens.find(x => x.id === (S.selSc || A.cens[0]?.id));
  if (e.dataset.prem) { const v = parseN(e.value); if (v == null) return render(); const k = e.dataset.prem; A.P[k].v[+e.dataset.t] = v / 100; A.P[k].o = {t: "prem", f: "Premissa editada pelo analista."}; return changed(); }
  if (e.dataset.imp) { const v = parseN(e.value) ?? 0; s.imp[e.dataset.imp] = v; if (s.o?.t === "claude") s.o = {t: "prem", f: "Impactos ajustados pelo analista (sugestão original do Claude)."}; return changed(); }
  if (e.dataset.ramp) { const v = parseN(e.value) ?? 0; s.ramp[+e.dataset.ramp] = clamp(v / 100, 0, 1.5); return changed(); }
  if (e.dataset.sc === "cat" || e.dataset.sc === "tipo" || e.dataset.sc === "chance") return changed();
  if (e.id === "addImp" && e.value) { s.linhas = impLinhas(s).concat([e.value]); s.imp[e.value] = s.imp[e.value] || 0; return changed(); }
  if (e.dataset.opon) { A.ops.rows[+e.dataset.opon].ativo = e.checked; return changed(); }
  if (e.dataset.ajon) { const a = A.aj.find(x => x.id === e.dataset.ajon); a.ativo = e.checked; return changed(); }
  if (e.dataset.scon) { const x = A.cens.find(y => y.id === e.dataset.scon); x.ativo = e.checked; return changed(); }
  if (e.dataset.sp) { const k = e.dataset.sp, SP = A.SP;
    if (k === "on") SP.on = e.checked; else if (k === "garantia") SP.garantia = e.value; else { const v = parseN(e.value); if (v == null) return render(); if (k === "lgd") SP.lgd[SP.garantia] = v / 100; else if (k === "prazo") SP.prazo = clamp(v, .25, 30); else SP[k] = v / 100; }
    return changed(); }
  if (e.dataset.news) { const i = S.news.items.find(x => x.id === e.dataset.news); i.sel = e.checked; return; }
  if (e.dataset.comrel) { const c = A.coms.find(x => x.id === e.dataset.comrel); c.rel = e.checked; return changed(); }
  if (e.id === "fileIn") return readFiles(e.files);
  if (e.id === "logoIn") { const f = e.files[0]; if (!f) return; if (f.size > 300000) { toast("Use uma imagem de até 300 KB."); return; } const r = new FileReader(); r.onload = () => { A.logo = r.result; changed(); }; r.readAsDataURL(f); }
  if (e.dataset.cx || e.dataset.sc || e.dataset.alt) changed();
});
document.addEventListener("keydown", ev => { if (ev.key === "Escape") { $("#pop").hidden = true; modal(null); } if (ev.key === "Enter" && ev.target.id === "q") { const h = searchIdx(S.q)[0]; if (h) pick(h[0]); } });
window.addEventListener("resize", () => schedulePreview(150));

// ---------- início ----------
(async function boot() {
  S.loading = true; render();
  try { S.idx = await J("index.json"); } catch (e) { toast("Não consegui carregar a lista de companhias."); S.idx = []; }
  J("ratios_meta.json").then(r => { S.RM = r; if (S.co) render(); }).catch(() => {});
  J("oficial.json").then(r => { S.OF = r; if (S.co) { CACHE = null; render(); } }).catch(() => {});
  J("titulos.json").then(r => { S.TIT = r; if (S.co) render(); }).catch(() => {});
  S.loading = false;
  let last = null; try { last = localStorage.getItem("rc_ultima"); } catch (_) {}
  if (last && S.idx.find(x => x[0] === +last)) pick(last); else render();
})();
