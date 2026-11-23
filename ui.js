// =====================================================================
// Interface: estado, formatação, ligação de campos e abas 1 a 4
// =====================================================================
"use strict";
const S = {A: null, OF: null, tab: "dados", caso: "base", sel: null, modal: null, busy: null, busyTxt: "", msg: {}, map: null, sug: {}, saveMsg: "", lista: null, parq: ""};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const fmt = (v, d = 0) => !nn(v) ? "–" : v.toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d});
const mil = v => !nn(v) ? "–" : Math.abs(v) < 0.5 ? "0" : v < 0 ? "(" + fmt(-v) + ")" : fmt(v);
const pct = (v, d = 1) => nn(v) ? fmt(v * 100, d) + "%" : "–";
const pp = (v, d = 2) => nn(v) ? (v >= 0 ? "+" : "−") + fmt(Math.abs(v) * 100, d) + " p.p." : "–";
const xx = (v, d = 2) => !nn(v) ? (v === Infinity ? "sem dívida" : "–") : Math.abs(v) > 50 ? "n.s." : fmt(v, d) + "x";
const parseN = s => { s = String(s ?? "").trim().replace(/\s|R\$|%|x$/gi, ""); if (!s || s === "–") return null; const neg = /^\(.*\)$/.test(s); s = s.replace(/[()]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ""); const v = parseFloat(s); return nn(v) ? (neg ? -v : v) : null; };
const getP = (o, p) => p.split(".").reduce((a, k) => a == null ? a : a[k], o);
const setP = (o, p, v) => { const ks = p.split("."); let a = o; ks.slice(0, -1).forEach((k, i) => { if (a[k] == null) a[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
const capUse = n => (window.claude && typeof window.claude.use === "function") ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
let DBP, SMP, DLP; const getDB = () => DBP ||= capUse("db"), getSM = () => SMP ||= capUse("sample"), getDL = () => DLP ||= capUse("downloads");

// ---------- peças de interface ----------
const chip = (o, path) => { const k = ORIG[o?.t] ? o.t : "prem"; const tt = `${ORIG[k].nome}: ${o?.f || ORIG[k].txt}`;
  return path ? `<button type="button" class="chip ${ORIG[k].cls}" data-act="orig" data-p="${path}" title="${esc(tt)}">${ORIG[k].nome}</button>` : `<span class="chip ${ORIG[k].cls}" title="${esc(tt)}">${ORIG[k].nome}</span>`; };
const nIn = (path, v, t = "num", cls = "", extra = "") => `<input class="n ${cls}" data-b="${path}" data-t="${t}" value="${esc(t === "pct" ? (nn(v) ? fmt(v * 100, 2) : "") : t === "x" ? (nn(v) ? fmt(v, 2) : "") : t === "ano" ? (nn(v) ? String(v) : "") : (nn(v) ? fmt(v, t === "dec" ? 2 : 0) : ""))}" inputmode="decimal" ${extra}>`;
const tIn = (path, v, cls = "tx", ph = "") => `<input class="${cls}" data-b="${path}" data-t="text" value="${esc(v)}" placeholder="${esc(ph)}">`;
const sel = (path, v, opts) => `<select data-b="${path}" data-t="text">${Object.entries(opts).map(([k, n]) => `<option value="${k}" ${k === v ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>`;
const en = (e, p) => `${esc(e)}<span class="tr">${esc(p)}</span>`;
// fórmula em notação financeira, com tradução embaixo
const eq = (lines, tradu, tit) => `<div class="eq">${tit ? `<div class="eqt">${esc(tit)}</div>` : ""}${lines.map(l => `<div class="eql">${l}</div>`).join("")}${tradu ? `<div class="eqp">${tradu}</div>` : ""}</div>`;
const v_ = s => `<i>${s}</i>`;
const thermo = (p, wide) => `<div class="thermo ${wide ? "wide" : ""}" title="chance ${fmt(p)}%"><div class="tr2"><i style="left:calc(${clamp(p, 0, 100)}% - 1px)"></i></div>${wide ? `<div class="scale"><span>remoto</span><span>improvável</span><span>possível</span><span>provável</span><span>quase certo</span></div>` : `<div class="lb">${fmt(p)}% · ${probWord(p)}</div>`}</div>`;
const probWord = p => p < 5 ? "remoto" : p < 25 ? "improvável" : p < 50 ? "possível" : p < 80 ? "provável" : "quase certo";
const box = (tit, body, right = "", cls = "") => `<section class="box ${cls}"><h3>${tit}${right ? `<span class="r">${right}</span>` : ""}</h3>${body}</section>`;
const kpi = (lab, v, sub, st = "") => `<div class="kpi ${st}"><div class="kl">${lab}</div><div class="kv">${v}</div>${sub ? `<div class="ks">${sub}</div>` : ""}</div>`;
const busyLine = k => S.busy === k ? `<span class="muted small">${esc(S.busyTxt || "Pensando…")}</span> <button class="link" data-act="stop">parar</button>` : "";
const msgLine = k => S.msg[k] ? `<span class="small ${S.msg[k].bad ? "bad" : "muted"}">${esc(S.msg[k].t)}</span>` : "";

// ---------- cálculos memorizados por renderização ----------
let CACHE = null;
function X() {
  if (CACHE) return CACHE; const A = S.A, OF = S.OF; ensurePrem(A);
  const cases = {}; Object.keys(CASES).forEach(c => cases[c] = runCase(A, OF, c));
  return CACHE = {A, OF, L: ltm(A), per: periods(A), cases, J: cdiByYear(A, OF), I: ipcaByYear(A, OF), col: collateral(A, OF), pr: pricing(A, OF), sched: opSchedule(A, cdiByYear(A, OF), ipcaByYear(A, OF))};
}

// ---------- abas ----------
const TABS = [["dados", "1 · Dados"], ["operacao", "2 · Operação e garantias"], ["capacidade", "3 · Capacidade de pagamento"], ["cenarios", "4 · Cenários"], ["juros", "5 · Juros e inflação"], ["preco", "6 · Precificação e pares"], ["parecer", "7 · Parecer e exportar"], ["metodo", "Metodologia e fontes"]];
function render() {
  CACHE = null; const A = S.A;
  $("#tabs").innerHTML = TABS.map(([k, n]) => `<button role="tab" aria-selected="${S.tab === k}" data-act="tab" data-k="${k}">${n}</button>`).join("");
  $("#coname").textContent = A.emp.nome || "Nova análise";
  $("#savemsg").textContent = S.saveMsg;
  const f = {dados: tDados, operacao: tOperacao, capacidade: tCapacidade, cenarios: tCenarios, juros: tJuros, preco: tPreco, parecer: tParecer, metodo: tMetodo}[S.tab];
  const ae = document.activeElement, ap = ae?.dataset?.b, as = ae?.selectionStart;
  let html; try { html = f(); } catch (e) { console.error(e); html = `<section class="box warnbox"><h3>Erro ao montar a tela</h3><p class="small">${esc(e.message)}</p></section>`; }
  const semClaude = !(window.claude && typeof window.claude.use === "function") ? `<div class="banner">Versão publicada fora do claude.ai: os botões "Claude" funcionam por copiar e colar. O app monta o pedido, você cola no Claude da sua conta (celular ou outro aparelho) e cola a resposta de volta. A análise fica guardada só neste navegador; para levar a outro computador, use "Baixar a análise (.json)" na aba do parecer.</div>` : "";
  $("#app").innerHTML = semClaude + ((A.emp.nome || "").includes("fictícia") ? `<div class="banner">Você está vendo a empresa fictícia de exemplo. Os números marcados "Exemplo" não são reais. <button class="link" data-act="nova">Começar uma análise nova</button></div>` + html : html);
  if (S.modal) $("#app").insertAdjacentHTML("beforeend", S.modal());
  if (ap) { const el = document.querySelector(`[data-b="${CSS.escape(ap)}"]`); if (el) { el.focus(); try { el.setSelectionRange(as, as); } catch (_) {} } }
}

// ---------- 1 · Dados ----------
function tDados() {
  const x = X(), A = x.A, P = x.per;
  const cad = `<div class="grid2">
    <label class="fld wide"><span>Razão social</span>${tIn("emp.nome", A.emp.nome, "tx", "Nome da empresa")}</label>
    <label class="fld"><span>CNPJ</span>${tIn("emp.cnpj", A.emp.cnpj)}</label>
    <label class="fld"><span>Setor</span>${tIn("emp.setor", A.emp.setor, "tx", "ex.: embalagens plásticas")}</label>
    <label class="fld"><span>Grupo econômico</span>${tIn("emp.grupo", A.emp.grupo)}</label>
    <label class="fld"><span>Último ano fechado</span>${nIn("emp.anoBase", A.emp.anoBase, "ano", "", 'data-reprem="1"')}</label>
    <label class="fld"><span>Meses do balancete parcial</span>${nIn("emp.mesesParcial", A.emp.mesesParcial, "int")}</label>
    <label class="fld"><span>Auditoria</span>${sel("emp.auditoria", A.emp.auditoria, {dois: "2 últimos anos auditados", um: "só o último ano auditado", nenhum: "sem auditoria"})}</label>
    <label class="fld"><span>Histórico com credores</span>${sel("emp.hist", A.emp.hist, {limpo: "sem atrasos", pontual: "atrasos pontuais", reneg: "já renegociou dívida"})}</label>
    <label class="fld"><span>Maior cliente, % da receita ${chip(A.emp.concO, "emp.concO")}</span>${nIn("emp.conc", A.emp.conc, "pct")}</label></div>`;
  const files = `<div class="drop" id="drop"><b>Arraste balancete, DRE e balanço</b><span class="small muted">PDF com texto, Excel ou CSV · vários arquivos de uma vez</span>
    <label class="b pri">Escolher arquivos<input type="file" id="fileIn" multiple accept=".pdf,.xlsx,.xls,.csv,.txt" hidden></label></div>
    ${(A.files || []).map((f, i) => `<div class="frow"><span class="fn">${esc(f.nome)}</span><span class="small muted">${fmt(f.chars)} caracteres lidos</span>
      ${sel(`files.${i}.t`, f.t, {aud: "Auditado", cli: "Cliente"})}<button class="b" data-act="mapear" data-i="${i}" ${S.busy ? "disabled" : ""}>Claude: ler e propor o de-para</button></div>`).join("")}
    <div class="row">${busyLine("map")}${msgLine("map")}</div>
    <p class="small muted">O Claude lê o texto dos arquivos com a sua conta, sem chave de API, e propõe a linha e o período de cada conta. Nada entra nas demonstrações antes de você aceitar. PDF escaneado (imagem) precisa ser digitado.</p>`;
  const mapBox = S.map ? mapTable() : "";
  const grid = `<div class="scroll"><table class="dem"><thead><tr><th>Linha</th>${P.map(p => `<th class="r">${p.lab}</th>`).join("")}<th class="r">12 meses</th></tr></thead><tbody>
    ${["Demonstração do resultado", "Balanço", "Fluxo de caixa"].map(g => `<tr class="sec"><td colspan="${P.length + 2}">${g}</td></tr>` + LINES.filter(l => l.g === g).map(l => {
      if (l.calc) return `<tr class="calc"><td>${en(l.en, l.pt)}<span class="tr">= ${esc(l.fx)}</span></td>${P.map(p => `<td class="r">${mil(colValues(A, p.k)[l.id])}</td>`).join("")}<td class="r b">${mil(x.L[l.id])}</td></tr>`;
      return `<tr><td>${en(l.en, l.pt)}</td>${P.map(p => { const c = A.dem[l.id]?.[p.k]; return `<td class="r cell">${nIn(`dem.${l.id}.${p.k}.v`, c?.v, "num", "w")}${c ? chip(c.o, `dem.${l.id}.${p.k}.o`) : ""}</td>`; }).join("")}<td class="r b">${mil(x.L[l.id])}</td></tr>`;
    }).join("")).join("")}</tbody></table></div>
    <p class="small muted">R$ mil. 12 meses = ${esc(x.L._src)}: fluxos somam o ano fechado + o parcial atual − o parcial anterior; saldos vêm da última data. Clique na etiqueta para trocar a origem e escrever a fonte.</p>`;
  return `<div class="cols2a"><div class="stack">${box("Cadastro da empresa", cad)}${box("Enviar demonstrações", files)}${box("Etiquetas de origem", Object.values(ORIG).map(o => `<div class="small"><span class="chip ${o.cls}">${o.nome}</span> ${o.txt}</div>`).join(""))}</div>
    <div class="stack">${mapBox}${box("Demonstrações padronizadas", grid, `<button class="b" data-act="reprem">Recalcular premissas pelo histórico</button>`)}${checks(x)}</div></div>`;
}
function checks(x) {
  const A = x.A, out = [];
  x.per.forEach(p => { const v = colValues(A, p.k); if (v.ativo && v.passivo + v.pl && Math.abs(v.ativo - v.passivo - v.pl) > Math.max(1, v.ativo * .005)) out.push(["warn", `${p.lab}: ativo (${mil(v.ativo)}) ≠ passivo + patrimônio (${mil(v.passivo + v.pl)}). Diferença ${mil(v.ativo - v.passivo - v.pl)}.`]);
    const res = v.ebit - v.juros + v.recfin - v.ir; if (v.lucro && Math.abs(res - v.lucro) > Math.max(50, Math.abs(v.lucro) * .1)) out.push(["warn", `${p.lab}: lucro operacional − juros + receita financeira − impostos = ${mil(res)}, mas o lucro informado é ${mil(v.lucro)}. Pode haver outras despesas financeiras ou não recorrentes.`]); });
  const a = colValues(A, "y0"), b = x.L; if (a.divbruta > 0 && b.divbruta / a.divbruta - 1 > .05) out.push(["warn", `Dívida bruta subiu ${pct(b.divbruta / a.divbruta - 1)} desde ${A.emp.anoBase}. Peça a explicação das novas captações.`]);
  const miss = INPUT_LINES.filter(l => ["receita", "ebit", "da", "juros", "caixa", "divcp", "divlp"].includes(l.id) && x.per.slice(0, 3).some(p => val(A, l.id, p.k) === null)).map(l => l.pt);
  if (miss.length) out.push(["bad", "Faltam dados essenciais em algum ano: " + miss.join(", ") + "."]);
  const cl = []; Object.entries(A.dem).forEach(([l, ps]) => Object.values(ps).forEach(c => c?.o?.t === "claude" && cl.push(l))); if (cl.length) out.push(["warn", `${cl.length} números vieram do Claude e ainda estão marcados "a conferir".`]);
  if (!out.length) out.push(["ok", "Sem inconsistências nas checagens automáticas."]);
  return box("Checagens", out.map(([k, t]) => `<div class="chk ${k}">${esc(t)}</div>`).join(""));
}
function mapTable() {
  const m = S.map, P = periods(S.A), lab = Object.fromEntries(P.map(p => [p.k, p.lab]));
  return box(`De-para proposto pelo Claude · ${esc(m.arquivo)}`, `<p class="small muted">${esc(m.resumo || "")}</p>
    <div class="scroll"><table class="tight"><thead><tr><th></th><th>Conta no arquivo</th><th>Linha padronizada</th><th>Período</th><th class="r">Valor (R$ mil)</th><th>Confiança</th></tr></thead><tbody>
    ${m.linhas.map((r, i) => `<tr class="${r.conf < .7 ? "hl" : ""}"><td><input type="checkbox" data-mk="${i}" ${r.ok ? "checked" : ""} aria-label="Usar"></td><td>${esc(r.conta)}</td><td>${esc(LBY[r.linha]?.en || r.linha)}<span class="tr">${esc(LBY[r.linha]?.pt || "")}</span></td><td>${esc(lab[r.col] || r.col)}</td><td class="r">${mil(r.valor)}</td><td>${pct(r.conf, 0)}</td></tr>`).join("")}
    </tbody></table></div>${(m.avisos || []).map(a => `<div class="chk warn">${esc(a)}</div>`).join("")}
    <div class="row"><button class="b pri" data-act="mapok">Usar as linhas marcadas</button><button class="link" data-act="mapno">descartar</button><span class="small muted">Linhas com confiança abaixo de 70% vêm desmarcadas.</span></div>`, "", "sugbox");
}

// ---------- 2 · Operação e garantias ----------
function tOperacao() {
  const x = X(), A = x.A, op = A.op, col = x.col;
  const est = `<div class="grid2">
    <label class="fld wide"><span>Instrumento</span>${sel("op.instrumento", op.instrumento, {"Cédula de crédito bancário": "Cédula de crédito bancário", "Debênture": "Debênture", "Nota comercial": "Nota comercial", "Cessão de recebíveis ao FIDC": "Cessão de recebíveis ao FIDC", "Capital de giro": "Capital de giro"})}</label>
    <label class="fld"><span>Valor (R$ mil)</span>${nIn("op.valor", op.valor)}</label>
    <label class="fld"><span>Prazo total (meses)</span>${nIn("op.prazo", op.prazo, "int")}</label>
    <label class="fld"><span>Carência de principal (meses)</span>${nIn("op.carencia", op.carencia, "int")}</label>
    <label class="fld"><span>Amortização</span>${sel("op.amort", op.amort, {constante: "Constante mensal após a carência", bullet: "Tudo no vencimento"})}</label>
    <label class="fld"><span>Indexador</span>${sel("op.index", op.index, {CDI: "CDI + spread", IPCA: "IPCA + spread", PRE: "Prefixado"})}</label>
    ${op.index === "PRE" ? `<label class="fld"><span>Taxa prefixada (% a.a.)</span>${nIn("op.taxaPre", op.taxaPre, "pct")}</label>` : `<label class="fld"><span>Spread proposto (% a.a.)</span>${nIn("op.spread", op.spread, "pct")}</label>`}
    <label class="fld"><span>Dívida que será quitada (R$ mil)</span>${nIn("op.quitar", op.quitar, "num", "", 'data-reprem="1"')}</label>
    <label class="fld"><span>Destino dos recursos</span>${tIn("op.destino", op.destino)}</label>
    <label class="fld wide"><span>Garantias pessoais</span>${tIn("op.pessoais", op.pessoais, "tx", "ex.: aval dos sócios, fiança da holding")}</label></div>
    ${eq([`${v_("Annual Rate")}<sub>t</sub> = (1 + ${v_("CDI")}<sub>t</sub>) × (1 + ${v_("Spread")}) − 1`, `${v_("Interest")}<sub>t</sub> = (${v_("Opening Balance")}<sub>t</sub> + ${v_("Closing Balance")}<sub>t</sub>) ÷ 2 × ${v_("Annual Rate")}<sub>t</sub>`],
      "taxa do ano = CDI e spread compostos · juros do ano = saldo médio do ano × taxa do ano. O CDI de cada ano vem da aba Juros e inflação (Focus por reunião do Copom). Desembolso no início do 1º ano projetado.")}
    <div class="scroll"><table class="tight"><thead><tr><th>Cronograma</th>${x.J.map(j => `<th class="r">${j.ano}</th>`).join("")}</tr></thead><tbody>
      <tr><td>Taxa do ano</td>${x.sched.map(s => `<td class="r">${pct(s.r, 2)}</td>`).join("")}</tr>
      <tr><td>Principal pago</td>${x.sched.map(s => `<td class="r">${mil(s.pr)}</td>`).join("")}</tr>
      <tr><td>Juros pagos</td>${x.sched.map(s => `<td class="r">${mil(s.juros)}</td>`).join("")}</tr>
      <tr><td>Saldo no fim do ano</td>${x.sched.map(s => `<td class="r">${mil(s.fim)}</td>`).join("")}</tr></tbody></table></div>`;
  const tot = sum(A.credores.map(c => +c.saldo || 0)) + (+op.valor || 0), mx = Math.max(1, ...A.credores.map(c => +c.saldo || 0), +op.valor || 0);
  const fila = `${[{nome: "Esta operação", saldo: +op.valor || 0, real: (A.gar || []).some(g => g.tipo !== "pessoal"), me: true}, ...A.credores].map((c, i) => `<div class="qrow ${c.me ? "me" : ""}">
      ${c.me ? `<b>Esta operação</b>` : tIn(`credores.${i - 1}.nome`, c.nome)}<span class="qbar"><i style="width:${(c.saldo || 0) / mx * 100}%;background:${c.me ? "var(--accent)" : c.real ? "var(--dado)" : "var(--line)"}"></i></span>
      ${c.me ? `<span class="r">${mil(c.saldo)}</span>` : nIn(`credores.${i - 1}.saldo`, c.saldo)}${c.me ? "" : `<label class="small"><input type="checkbox" data-b="credores.${i - 1}.real" data-t="bool" ${c.real ? "checked" : ""}> garantia real</label>${chip(c.o, `credores.${i - 1}.o`)}<button class="link bad" data-act="delcred" data-i="${i - 1}" aria-label="Remover">×</button>`}</div>`).join("")}
    <div class="row"><button class="b" data-act="addcred">+ credor</button><span class="small muted">R$ mil · total pro forma ${mil(tot)} · azul = com garantia real. Fonte típica: relação de dívidas da empresa e Registrato (Banco Central).</span></div>`;
  const gar = `<div class="scroll"><table class="tight gar"><thead><tr><th>Garantia</th><th class="r">Valor avaliado</th><th class="r">Desconto na venda</th><th class="r">Encolhe na quebra</th><th class="r">Custo de execução</th><th class="r">Meses p/ receber</th><th class="r">Recuperável</th><th class="r">Recuperação líquida hoje</th><th></th></tr></thead><tbody>
    ${col.rows.map((g, i) => `<tr><td>${sel(`gar.${i}.tipo`, g.tipo, Object.fromEntries(Object.entries(GTIPOS).map(([k, t]) => [k, t.nome])))}${tIn(`gar.${i}.desc`, g.desc, "tx", "descrição, matrícula, laudo")}</td>
      <td class="r">${nIn(`gar.${i}.valor`, g.valor)}${chip(g.o, `gar.${i}.o`)}</td><td class="r">${nIn(`gar.${i}.h`, g.h, "pct", "s")}${chip(g.ho, `gar.${i}.ho`)}</td><td class="r">${nIn(`gar.${i}.q`, g.q, "pct", "s")}</td><td class="r">${nIn(`gar.${i}.c`, g.c, "pct", "s")}</td><td class="r">${nIn(`gar.${i}.m`, g.m, "int", "s")}</td>
      <td class="r">${mil(g.rec)}</td><td class="r">${mil(g.liq)}</td><td><button class="link bad" data-act="delgar" data-i="${i}" aria-label="Remover">×</button></td></tr>`).join("")}
    <tr class="tot"><td>Total</td><td class="r">${mil(sum(col.rows.map(g => +g.valor || 0)))}</td><td></td><td></td><td></td><td></td><td class="r">${mil(col.recT)}</td><td class="r">${mil(col.liqT)}</td><td></td></tr></tbody></table></div>
    <div class="row"><button class="b" data-act="addgar">+ garantia</button><span class="small muted">Ao escolher o tipo, desconto, custo, prazo e encolhimento vêm com a explicação de cada um (passe o mouse). Ajuste pela política da casa.</span></div>
    <div class="kpis3">${kpi("Cobertura de garantias", xx(col.cover), "recuperável ÷ valor da operação", col.cover >= 1 ? "ok" : "warn")}${kpi("Perda se a empresa quebrar", pct(col.lgd, 0), "usada na perda esperada", col.lgd < .4 ? "ok" : "warn")}${kpi("Taxa para trazer a hoje", pct(col.r, 2), "CDI do 1º ano + captação do credor")}</div>
    ${eq([`${v_("Recovery Value")}<sub>i</sub> = ${v_("Appraised Value")}<sub>i</sub> × (1 − ${v_("Haircut")}<sub>i</sub>)`, `${v_("Collateral Coverage")} = Σ ${v_("Recovery Value")}<sub>i</sub> ÷ ${v_("Exposure")}`,
      `${v_("Loss Given Default")} = 1 − Σ [${v_("Appraised Value")}<sub>i</sub> × (1 − ${v_("Shrinkage")}<sub>i</sub>) × (1 − ${v_("Haircut")}<sub>i</sub>) × (1 − ${v_("Execution Cost")}<sub>i</sub>) ÷ (1 + ${v_("r")})<sup>months<sub>i</sub>/12</sup>] ÷ ${v_("Exposure")}`],
      "valor recuperável = avaliação × (1 − desconto na venda) · cobertura = soma recuperável ÷ valor da operação · perda se quebrar = 1 − recuperação líquida (depois de encolher na quebra, do desconto e do custo de execução, trazida a hoje pelo tempo até receber) ÷ valor da operação")}`;
  const covs = covTable(x);
  return `<div class="cols2"><div class="stack">${box("Estrutura da operação", est)}${box("Onde ficamos na fila de credores", fila)}</div>
    <div class="stack">${box("Garantias e colaterais", gar)}${leisBox(A)}${covs}</div></div>`;
}
const LEIS = {
  imovel: {txt: "O imóvel passa a ser do credor até a dívida ser paga. Na inadimplência, o cartório de imóveis intima o devedor, a propriedade se consolida no credor e o imóvel vai a leilão, sem processo judicial. Na recuperação judicial o credor fica fora do plano, mas não pode retirar bem essencial à operação durante a suspensão de 180 dias.",
    conf: "matrícula atualizada, laudo, ônus anteriores, se é a sede operacional", links: [["Lei 9.514/1997, arts. 22 a 33", "https://www.planalto.gov.br/ccivil_03/leis/l9514.htm"], ["Lei 14.711/2023 (Marco das Garantias)", "https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14711.htm"], ["Lei 11.101/2005, art. 49, §3º", "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm"]]},
  recebiveis: {txt: "Os recebíveis ficam com o credor como garantia. Com a trava, os clientes pagam numa conta controlada e o credor retém o que vence antes de liberar o resto. A jurisprudência do Superior Tribunal de Justiça mantém a cessão fiduciária fora do plano de recuperação. O risco real é a carteira encolher quando a empresa piora.",
    conf: "concentração de sacados, prazo médio, inadimplência da carteira, registro do contrato", links: [["Lei 4.728/1965, art. 66-B", "https://www.planalto.gov.br/ccivil_03/leis/l4728.htm"], ["Lei 11.101/2005, art. 49, §3º", "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm"]]},
  maquinas: {txt: "As máquinas ficam com a empresa e servem de garantia. Precisa de registro no cartório de imóveis do local da fábrica. A execução é judicial e, na recuperação judicial, o credor entra na classe de garantia real e recebe conforme o plano.",
    conf: "notas fiscais, número de série, seguro, idade e mercado de revenda", links: [["Código Civil, arts. 1.447 a 1.450", "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm"], ["Lei 11.101/2005, art. 41", "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2005/lei/l11101.htm"]]},
  estoque: {txt: "Penhor mercantil de estoques: o estoque segue com a empresa, que pode ser obrigada a repor o que vende. Difícil de fiscalizar; na recuperação judicial entra no plano como garantia real.",
    conf: "giro do estoque, local de armazenagem, seguro, laudo periódico", links: [["Código Civil, arts. 1.447 a 1.450", "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm"]]},
  aplicacao: {txt: "Aplicação financeira cedida fiduciariamente ao credor: a melhor garantia, sem desconto e de execução imediata.", conf: "bloqueio da aplicação e prazo de resgate", links: [["Lei 4.728/1965, art. 66-B", "https://www.planalto.gov.br/ccivil_03/leis/l4728.htm"]]},
  pessoal: {txt: "Garantia pessoal: o sócio ou a holding respondem com o próprio patrimônio. O aval vai no título (a cédula); na fiança, peça a renúncia ao benefício de ordem. Aval de pessoa casada precisa da autorização do cônjuge.",
    conf: "patrimônio livre do garantidor, autorização do cônjuge, outras garantias já dadas", links: [["Código Civil, arts. 897 a 900 (aval), 818 a 839 (fiança) e 1.647 (cônjuge)", "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm"]]},
};
function leisBox(A) {
  const tipos = [...new Set((A.gar || []).map(g => g.tipo))];
  const inst = A.op.instrumento === "Debênture" ? [["Lei 6.404/1976, arts. 52 a 74", "https://www.planalto.gov.br/ccivil_03/leis/l6404compilada.htm"], ["Resolução CVM 160 (ofertas)", "https://conteudo.cvm.gov.br/legislacao/resolucoes/resol160.html"]]
    : /FIDC/.test(A.op.instrumento) ? [["Resolução CVM 175, Anexo Normativo II (FIDC)", "https://conteudo.cvm.gov.br/legislacao/resolucoes/resol175.html"]]
    : /Nota comercial/.test(A.op.instrumento) ? [["Lei 14.195/2021, arts. 45 a 51 (nota comercial)", "https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2021/lei/l14195.htm"], ["Resolução CVM 160 (ofertas)", "https://conteudo.cvm.gov.br/legislacao/resolucoes/resol160.html"]]
    : [["Lei 10.931/2004, arts. 26 a 45 (cédula de crédito bancário)", "https://www.planalto.gov.br/ccivil_03/_ato2004-2006/2004/lei/l10.931.htm"]];
  return box("Como funciona cada garantia", `<details ${tipos.length ? "open" : ""}><summary class="small">Resumo para orientar a análise; não substitui o parecer jurídico</summary>
    <div class="lei"><b>Instrumento: ${esc(A.op.instrumento)}</b><div class="small">${inst.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join(" · ")}</div></div>
    ${tipos.map(t => `<div class="lei"><b>${esc(GTIPOS[t].nome)}</b> <span class="chip ${GTIPOS[t].rj === "fora" ? "o-ok" : "o-cli"}">${GTIPOS[t].rj === "fora" ? "fora da recuperação judicial" : GTIPOS[t].rj === "pessoa" ? "patrimônio do garantidor" : "entra na recuperação judicial"}</span>
      <p class="small">${esc(LEIS[t].txt)}</p><p class="small muted"><b>Conferir:</b> ${esc(LEIS[t].conf)}.</p><div class="small">${LEIS[t].links.map(([n, u]) => `<a href="${u}" target="_blank" rel="noopener">${esc(n)}</a>`).join(" · ")}</div></div>`).join("")}</details>`);
}
function covTable(x) {
  const A = x.A, base = x.cases.base, es = x.cases.estresse, ep = x.cases.esperado, y0 = base[0];
  const rows = A.covs.map((cv, i) => { const m = COVM[cv.m], now = y0[m.k], c = covCheck(cv, now), wb = worst(base, m.k, m.tipo === "min"), we = worst(es, m.k, m.tipo === "min"), wp = worst(ep, m.k, m.tipo === "min");
    const head = m.tipo === "max" ? `EBITDA pode cair ${pct(Math.max(0, c.folga), 0)} até quebrar` : cv.m === "icr" ? `juros podem subir ${pct(Math.max(0, now / cv.lim - 1), 0)} até quebrar` : `caixa pode cair ${pct(Math.max(0, c.folga), 0)} até quebrar`;
    const cell = (w) => { const ck = covCheck(cv, w[m.k]); return `<td class="r ${ck.ok ? "" : "bad b"}">${xx(w[m.k])} <span class="small muted">${w.ano}</span></td>`; };
    return `<tr><td>${en(m.en, m.pt)}</td><td class="r">${m.tipo === "max" ? "≤" : "≥"} ${nIn(`covs.${i}.lim`, cv.lim, "x", "s")}${chip(cv.o, `covs.${i}.o`)}</td><td class="r">${xx(now)}</td>
      <td><div class="gbar"><i class="zone" style="width:${clamp((m.tipo === "max" ? now / cv.lim : cv.lim / now) * 100, 0, 100)}%"></i></div><div class="small muted">${head}</div></td>${cell(wb)}${cell(wp)}${cell(we)}<td><button class="link bad" data-act="delcov" data-i="${i}" aria-label="Remover">×</button></td></tr>`; }).join("");
  return box("Covenants propostos", `<div class="scroll"><table class="tight"><thead><tr><th>Covenant</th><th class="r">Limite</th><th class="r">1º ano</th><th style="min-width:170px">Folga no 1º ano</th><th class="r">Pior ano, base</th><th class="r">Pior ano, esperado</th><th class="r">Pior ano, estresse</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="row"><select id="newcov">${Object.entries(COVM).map(([k, m]) => `<option value="${k}">${esc(m.en)}</option>`).join("")}</select><button class="b" data-act="addcov">+ covenant</button>
      <button class="b ai" data-act="sugcov" ${S.busy ? "disabled" : ""}>Claude: sugerir covenants para este setor</button>${busyLine("cov")}${msgLine("cov")}</div>
    ${S.sug.cov ? `<div class="ans">${S.sug.cov.map(s => `<div class="small"><b>${esc(s.covenant)}</b> ${esc(s.limite)} · ${esc(s.porque)} <span class="chip o-claude">Claude</span></div>`).join("")}<p class="small muted">Do conhecimento do Claude, sem consulta a escrituras. Compare com os pares na aba Precificação e pares.</p></div>` : ""}
    <div class="lbl">Cláusulas não financeiras</div><div class="clauses">${A.clausulas.map((c, i) => `<span class="cl">${esc(c)} <button class="link bad" data-act="delcl" data-i="${i}" aria-label="Remover">×</button></span>`).join("")}<input class="tx" id="newcl" placeholder="+ cláusula e Enter"></div>
    <p class="small muted">1º ano = primeiro ano projetado do caso base, já com a operação. Pior ano: menor valor nos ${NY} anos de cada caso (aba Capacidade de pagamento).</p>`);
}

// ---------- 3 · Capacidade de pagamento ----------
function caseBar() { return `<div class="seg">${Object.entries(CASES).map(([k, n]) => `<button class="${S.caso === k ? "on" : ""}" data-act="caso" data-k="${k}">${n}</button>`).join("")}</div>`; }
function tCapacidade() {
  const x = X(), A = x.A, R = x.cases[S.caso], P = A.prem, PO = A.premO, cv = A.covs.find(c => c.m === "dscr");
  const w = worst(R, "dscr"), minCash = Math.min(...R.map(r => r.cash)), op0 = x.sched;
  const hist = ["y1", "y0"].map(k => ({lab: x.per.find(p => p.k === k).lab, v: colValues(A, k)}));
  const rows = [
    ["EBITDA", "lucro operacional antes de depreciação e amortização", r => r.ebitda, v => v.ebitda],
    ["− Income Taxes Paid", "impostos sobre o lucro pagos", r => -r.imp, v => -v.ir],
    ["− Δ Working Capital", "aumento do capital de giro", r => -r.dWC, null],
    ["− Capex", "investimentos", r => -r.capex, v => -v.capex],
    ["− Other Cash Outflows", "outras saídas dos cenários", r => -r.saidas, null],
    ["= Cash Available for Debt Service", "caixa disponível para o serviço da dívida", r => r.cads, null, "key"],
    ["Interest", "juros de toda a dívida", r => r.juros, v => v.juros],
    ["Principal", "principal de toda a dívida, pelo contrato", r => r.principal, null],
    ["   dos quais esta operação", "", r => r.prOp, null, "sub"],
    ["Debt Service Coverage", "cobertura do serviço da dívida", r => r.dscr, null, "key x"],
    ["Coverage after Refinancing", "cobertura descontando o que é rolado", r => r.dscrR, null, "x"],
    ["Net Debt ÷ EBITDA", "alavancagem no fim do ano", r => r.lev, v => v.ebitda > 0 ? v.divliq / v.ebitda : NaN, "x"],
    ["Cash", "caixa no fim do ano", r => r.cash, v => v.caixa],
  ];
  const tbl = `<div class="scroll"><table class="proj"><thead><tr><th>R$ mil, nominal</th>${hist.map(h => `<th class="r hist">${h.lab}</th>`).join("")}<th class="r hist">12 meses</th>${R.map(r => `<th class="r">${r.ano}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(([e, p, f, hf, cls = ""]) => `<tr class="${cls}"><td>${esc(e)}${p ? `<span class="tr">${esc(p)}</span>` : ""}</td>${hist.map(h => `<td class="r hist">${hf ? (cls.includes("x") ? xx(hf(h.v)) : mil(hf(h.v))) : ""}</td>`).join("")}<td class="r hist">${hf ? (cls.includes("x") ? xx(hf(x.L)) : mil(hf(x.L))) : ""}</td>
      ${R.map(r => { const v = f(r); const bad = cls.includes("x") && e.startsWith("Debt") && cv && v < cv.lim; return `<td class="r ${bad ? "bad b" : ""}">${cls.includes("x") ? xx(v) : mil(v)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
  const W = 520, H = 170, mx = Math.max(1, ...R.map(r => Math.max(r.cads, r.ds))), bw = W / R.length;
  const chart = `<svg viewBox="0 0 ${W} ${H + 24}" class="chart" role="img" aria-label="Caixa disponível e serviço da dívida por ano"><line x1="0" y1="${H}" x2="${W}" y2="${H}" class="gl"/>
    ${R.map((r, i) => { const h1 = Math.max(0, r.cads) / mx * (H - 10), h2 = r.ds / mx * (H - 10), x0 = i * bw + bw * .18; return `<rect x="${x0}" y="${H - h1}" width="${bw * .3}" height="${h1}" fill="var(--accent)"/><rect x="${x0 + bw * .32}" y="${H - h2}" width="${bw * .3}" height="${h2}" fill="var(--prem)"/><text x="${x0 + bw * .3}" y="${H + 15}" class="ax" text-anchor="middle">${r.ano}</text>`; }).join("")}</svg>
    <div class="small muted"><span class="sw" style="background:var(--accent)"></span>caixa disponível <span class="sw" style="background:var(--prem)"></span>juros + principal</div>`;
  const prem = [["g", "Revenue Growth", "crescimento da receita sem cenários", "pct"], ["mg", "EBITDA Margin", "margem EBITDA sem cenários", "pct"], ["da", "D&A ÷ Revenue", "depreciação ÷ receita", "pct"], ["capex", "Capex ÷ Revenue", "investimento ÷ receita", "pct"], ["dias", "Working Capital Days", "dias de receita presos no giro", "int"],
    ["ir", "Effective Tax Rate", "alíquota de IR e CSLL", "pct"], ["payout", "Payout", "dividendos ÷ lucro", "pct"], ["spExist", "Spread on Existing Debt", "custo da dívida atual acima do CDI", "pct"], ["amExist", "Existing Debt Amortization", "principal da dívida atual, R$ mil", "num"], ["refin", "Rollover Rate", "parte dos vencimentos atuais que é rolada", "pct"], ["rendCx", "Cash Yield (% of CDI)", "rendimento do caixa", "pct"]];
  const ptab = `<div class="scroll"><table class="tight"><thead><tr><th>Premissa</th>${x.J.map(j => `<th class="r">${j.ano}</th>`).join("")}<th>Origem</th></tr></thead><tbody>
    ${prem.map(([k, e, p, t]) => `<tr><td>${en(e, p)}</td>${P[k].map((v, i) => `<td class="r">${nIn(`prem.${k}.${i}`, v, t, "s")}</td>`).join("")}<td>${chip(PO[k], `premO.${k}`)}</td></tr>`).join("")}
    <tr><td>${en("CDI", "média do ano, da aba Juros e inflação")}</td>${x.J.map(j => `<td class="r">${pct(j.cdi, 2)}</td>`).join("")}<td><span class="chip o-ofi" title="Focus por reunião do Copom (Banco Central), com as suas alterações">Oficial</span></td></tr></tbody></table></div>`;
  return `<div class="row between"><h2>A empresa gera caixa para pagar tudo o que deve?</h2>${caseBar()}</div>
    <p class="small muted">${caseTxt(S.caso)}</p>
    <div class="kpis">${kpi("Menor cobertura do serviço da dívida", xx(w.dscr), `${w.ano}${cv ? ` · covenant ≥ ${xx(cv.lim)}` : ""}`, cv && w.dscr < cv.lim ? "bad" : "ok")}${kpi("Menor caixa no fim do ano", mil(minCash), minCash < 0 ? "negativo: precisa de dívida nova" : "R$ mil", minCash < 0 ? "bad" : "ok")}
      ${kpi("Anos para pagar a dívida com o caixa livre", nn(R[0].payback) ? fmt(R[0].payback, 1) : "–", `prazo desta operação: ${fmt(A.op.prazo / 12, 1)} anos`)}${kpi("Dívida que vence em 12 meses", mil(x.L.divcp), "R$ mil, da última data")}${kpi("Cobertura de garantias", xx(x.col.cover), "da aba Operação e garantias", x.col.cover >= 1 ? "ok" : "warn")}</div>
    <div class="cols2b"><div class="stack">${box("Fluxo de caixa para o credor", tbl + eq([`${v_("Cash Available for Debt Service")} = ${v_("EBITDA")} − ${v_("Income Taxes Paid")} − Δ${v_("Working Capital")} − ${v_("Capex")} − ${v_("Other Cash Outflows")}`, `${v_("Debt Service Coverage")} = ${v_("Cash Available for Debt Service")} ÷ (${v_("Interest")} + ${v_("Principal")})`, `${v_("Revenue")}<sub>t</sub> = ${v_("Base Revenue")}<sub>t−1</sub> × (1 + ${v_("Revenue Growth")}<sub>t</sub>) + Δ${v_("Revenue")}<sub>scenarios, t</sub>`],
      "caixa disponível = EBITDA − impostos pagos − aumento do giro − investimentos − outras saídas · cobertura = caixa disponível ÷ (juros + principal). Abaixo de 1,00x a empresa precisa de dívida nova ou de caixa para pagar a parcela. A receita base cresce pela premissa; os cenários somam o impacto de cada ano por cima."))}</div>
      <div class="stack">${box("Caixa gerado × serviço da dívida", chart)}</div></div>${box("Premissas por ano", ptab, `<button class="b" data-act="reprem">Recalcular pelo histórico</button>`)}`;
}
const caseTxt = c => ({base: "Base: só as premissas, nenhum cenário.", moderado: "Moderado: cada cenário entra multiplicado pela sua chance.", estresse: "Estresse: todos os cenários ativos entram inteiros, sem olhar a chance. A operação precisa aguentar este caso.",
  esperado: `Esperado: média dos casos base, moderado e estresse com os pesos ${fmt(S.A.casos.base)}%, ${fmt(S.A.casos.moderado)}% e ${fmt(S.A.casos.estresse)}% (aba Cenários).`})[c];

// ---------- 4 · Cenários ----------
function tCenarios() {
  const x = X(), A = x.A, cs = A.cens; if (!S.sel || !cs.find(s => s.id === S.sel)) S.sel = cs[0]?.id;
  const sc = cs.find(s => s.id === S.sel);
  const lib = `<div class="row"><button class="b pri" data-act="newsc">+ cenário em branco</button><button class="b ai" data-act="sugsc" ${S.busy ? "disabled" : ""}>Claude sugere 3 para esta empresa</button></div><div class="row">${busyLine("sc")}${msgLine("sc")}</div>
    ${cs.map(s => `<button class="scn ${s.id === S.sel ? "sel" : ""} ${s.ativo === false ? "off" : ""}" data-act="selsc" data-id="${s.id}"><span class="nm">${esc(s.nome)}</span>${thermo(s.prob)}<span class="meta"><span class="chip o-calc">${esc(s.cat)}</span> ${s.origem === "claude" ? `<span class="chip o-claude">Claude</span>` : `<span class="small muted">${esc(s.origem)}</span>`}</span></button>`).join("") || `<p class="small muted">Nenhum cenário ainda.</p>`}
    <details class="cat" open><summary><b>Catálogo de cenários genéricos</b></summary>
      ${["Macro", "Micro"].map(c => `<div class="lbl">${c}</div><div class="clauses">${Object.entries(TEMPLATES).filter(([, t]) => t.cat === c).map(([k, t]) => `<button class="cl add" data-act="addtpl" data-k="${k}">+ ${esc(t.nome)}</button>`).join("")}</div>`).join("")}
      <p class="small muted">Cada um vem com árvore e formato prontos, montados com os números das demonstrações. Você só ajusta.</p></details>`;
  const casos = box("Pesos dos casos no Esperado", `<div class="grid3">${["base", "moderado", "estresse"].map(k => `<label class="fld"><span>${CASES[k]}</span>${nIn(`casos.${k}`, A.casos[k], "int", "s")}</label>`).join("")}</div><p class="small muted">Em %, somam ${fmt(A.casos.base + A.casos.moderado + A.casos.estresse)}. Premissa do analista, como a ponderação de cenários da provisão por perda esperada.</p>`);
  const chance = box("Como a chance é usada", `<ol class="small tight"><li><b>Estresse</b> ignora a chance: todo cenário ativo entra inteiro. A operação precisa aguentar.</li><li><b>Moderado</b> usa impacto × chance.</li><li><b>Esperado</b> pondera os casos pelos pesos acima.</li><li><b>Preço:</b> cada cenário gera a sua nota e a sua chance de calote. A média ponderada pela chance vai para a perda esperada e o spread (aba Precificação).</li><li><b>Parecer:</b> os riscos aparecem ordenados por chance × impacto.</li></ol>
    ${eq([`${v_("Probability of Default")} = ${v_("PD")}<sub>base</sub> + Σ ${v_("p")}<sub>i</sub> × (${v_("PD")}<sub>i</sub> − ${v_("PD")}<sub>base</sub>)`], "chance de calote = a do caso base + para cada cenário, a sua chance × quanto ele aumenta a chance de calote se acontecer. A chance é de o cenário acontecer em algum momento do horizonte de " + NY + " anos.")}`);
  return `<div class="cols3"><div class="stack">${box("Cenários", lib, "", "lib")}</div><div class="stack">${sc ? scEditor(x, sc) : box("Cenário", `<p class="muted">Crie um cenário ou escolha um no catálogo.</p>`)}</div><div class="stack">${sc ? scImpact(x, sc) : ""}${chance}${casos}</div></div>`;
}
function scEditor(x, sc) {
  const i = x.A.cens.indexOf(sc), p = `cens.${i}`, r = ramp(sc), Y = x.J.map(j => j.ano);
  const pa = S.sug.prob?.[sc.id];
  return `<section class="box ed"><div class="row between"><input class="tx ttl" data-b="${p}.nome" data-t="text" value="${esc(sc.nome)}" aria-label="Nome do cenário">
      <span class="row">${sel(`${p}.cat`, sc.cat, {Macro: "Macro", Micro: "Micro"})}<label class="small"><input type="checkbox" data-b="${p}.ativo" data-t="bool" ${sc.ativo !== false ? "checked" : ""}> ativo</label><button class="link" data-act="dupsc">duplicar</button><button class="link bad" data-act="delsc">apagar</button></span></div>
    <div class="small muted">origem: ${sc.origem === "claude" ? "sugerido pelo Claude com o conhecimento dele, sem notícias ao vivo; confira as premissas" : esc(sc.origem)}</div>
    <div class="g2"><div><div class="lbl">Chance de acontecer em ${NY} anos ${chip(sc.probO, `${p}.probO`)}</div>
      <div class="pslider"><input type="range" min="0" max="100" step="1" value="${sc.prob}" data-b="${p}.prob" data-t="int" aria-label="Chance"><span class="big">${fmt(sc.prob)}%</span></div>${thermo(sc.prob, true)}
      <textarea rows="2" data-b="${p}.probJust" data-t="text" placeholder="Por que essa chance? Fatos, histórico, notícias com veículo e data.">${esc(sc.probJust)}</textarea>
      <div class="row"><button class="b ai" data-act="prob" ${S.busy ? "disabled" : ""}>Claude: estimar a chance</button>${busyLine("prob")}</div>
      ${pa ? `<div class="ans small"><b>Claude sugere ${fmt(pa.prob)}%</b> (faixa ${fmt(pa.faixa?.[0])}–${fmt(pa.faixa?.[1])}%). ${esc(pa.just)}${pa.pro?.length ? `<div><b>A favor:</b> ${pa.pro.map(esc).join("; ")}</div>` : ""}${pa.contra?.length ? `<div><b>Contra:</b> ${pa.contra.map(esc).join("; ")}</div>` : ""}${pa.conferir?.length ? `<div><b>Conferir hoje:</b> ${pa.conferir.map(esc).join("; ")}</div>` : ""}<button class="b" data-act="useprob">Usar ${fmt(pa.prob)}%</button></div>` : ""}</div>
     <div><div class="lbl">Quando o impacto chega</div><div class="clauses">${Object.entries(FORMAS).map(([k, f]) => `<button class="cl ${sc.forma === k ? "on" : ""}" data-act="forma" data-k="${k}" title="${esc(f.txt)}">${esc(f.nome)}</button>`).join("")}<button class="cl ${sc.forma === "custom" ? "on" : ""}" data-act="forma" data-k="custom">ajustar ano a ano</button></div>
      <div class="rampin">${Y.map((y, t) => `<div class="rcol"><span class="rbar" style="height:${clamp((r[t] ?? 0) / 1.5 * 100, 2, 100)}%"></span>${sc.forma === "custom" ? nIn(`${p}.ramp.${t}`, r[t], "pct", "s") : `<span class="small">${pct(r[t], 0)}</span>`}<span class="small muted">${y}</span></div>`).join("")}</div>
      <p class="small muted">${sc.forma === "custom" ? "100% = o impacto anual inteiro da árvore naquele ano (aceita até 150%)." : esc(FORMAS[sc.forma]?.txt || "")}. Importa porque o credor quebra quando o impacto coincide com a amortização: compare com o cronograma da operação.</p>
      <div class="lbl">Como chega no credor</div><textarea rows="2" data-b="${p}.como" data-t="text">${esc(sc.como)}</textarea>
      <div class="lbl">Gatilho observável para monitorar</div>${tIn(`${p}.gatilho`, sc.gatilho)}
      <div class="lbl">Mitigante na estrutura</div>${tIn(`${p}.mitigante`, sc.mitigante, "tx", "ex.: vencimento antecipado se a concentração cair; reforço de garantia")}</div></div>
    <div class="row between" style="margin-top:10px"><h3 style="margin:0">Árvores de impacto <span class="small muted">efeito anual em R$ mil, antes do % do ano</span></h3>
      <span class="row">${`<select id="newline">${Object.entries(TLINES).map(([k, l]) => `<option value="${k}">${esc(l.nome)}</option>`).join("")}</select>`}<button class="b" data-act="newtree">+ árvore</button></span></div>
    ${(sc.trees || []).map((t, j) => treeCard(sc, i, t, j)).join("") || `<p class="small muted">Sem árvores: o cenário não mexe em nada.</p>`}
    <div class="row"><input class="tx" id="treeTxt" placeholder="Descreva em texto, ex.: preço cai 5% e volume sobe 3%" style="flex:1"><button class="b ai" data-act="aitree" ${S.busy ? "disabled" : ""}>Claude monta a árvore</button>${busyLine("tree")}${msgLine("tree")}</div>
    ${eq([`${v_("Annual Impact")} = ${v_("Tree Root")}<sup>scenario</sup> − ${v_("Tree Root")}<sup>today</sup>`, `Δ${v_("Line")}<sub>t</sub> = ${v_("Annual Impact")} × ${v_("Ramp")}<sub>t</sub> × ${v_("Case Weight")}`, `Δ${v_("EBITDA")}<sub>t</sub> = Δ${v_("Revenue")}<sub>t</sub> × (1 − ${v_("Variable Cost Ratio")}) − Δ${v_("Cash Costs")}<sub>t</sub>`],
      "impacto anual = topo da árvore no cenário − topo hoje · variação da linha no ano = impacto × % daquele ano × peso do caso (0 no base, a chance no moderado, 1 no estresse) · nas árvores de receita, só a margem de contribuição chega ao EBITDA. Em reais do ano-base, sem correção pela inflação.")}</section>`;
}
function treeCard(sc, i, tr, j) {
  const e = evalTree(tr), p = `cens.${i}.trees.${j}`, byP = {};
  tr.nos.forEach(n => (byP[n.pai || ""] ||= []).push(n));
  const ordered = []; const walk = (pai, d) => (byP[pai] || []).forEach(n => { ordered.push([n, d]); walk(n.id, d + 1); }); walk("", 0);
  tr.nos.forEach(n => { if (!ordered.find(o => o[0] === n)) ordered.push([n, 0]); });
  return `<div class="tcard ${tr.ativo === false ? "off" : ""}"><div class="row between"><span class="row nowrap" style="flex:1"><input type="checkbox" data-b="${p}.ativo" data-t="bool" ${tr.ativo !== false ? "checked" : ""} aria-label="Usar árvore"><input class="tx ttl2" data-b="${p}.titulo" data-t="text" value="${esc(tr.titulo)}" aria-label="Título"></span>
      <span class="row">${sel(`${p}.linha`, tr.linha, Object.fromEntries(Object.entries(TLINES).map(([k, l]) => [k, "linha: " + l.nome])))}${tr.linha === "receita" ? `<label class="small">custo variável ${nIn(`${p}.vcr`, tr.vcr, "pct", "s")}</label>${chip(tr.vcrO, `${p}.vcrO`)}` : ""}<button class="link bad" data-act="deltree" data-j="${j}">apagar</button></span></div>
    <div class="scroll"><table class="tree"><thead><tr><th>Nó</th><th>Código</th><th>Tipo</th><th class="r">Hoje</th><th class="r">Cenário</th><th>Unid.</th><th>Fórmula</th><th>Origem</th><th></th></tr></thead><tbody>
    ${ordered.map(([n, d]) => { const k = tr.nos.indexOf(n), q = `${p}.nos.${k}`, v = e.vals[n.id], f = n.tipo === "formula";
      return `<tr class="${!n.pai ? "root" : ""}"><td style="padding-left:${6 + d * 16}px">${tIn(`${q}.nome`, n.nome, "tx nm")}</td><td>${tIn(`${q}.id`, n.id, "tx id")}</td><td>${sel(`${q}.tipo`, n.tipo, {entrada: "entrada", formula: "fórmula"})}</td>
        <td class="r">${f ? fmtNode(v.base) : nIn(`${q}.base`, n.base, "dec", "s")}</td><td class="r">${f ? fmtNode(v.cen) : nIn(`${q}.cen`, n.cen, "dec", "s chg")}</td><td>${tIn(`${q}.unid`, n.unid, "tx u")}</td>
        <td>${f ? `${tIn(`${q}.formula`, n.formula, "tx f")}${e.errs[n.id] ? `<div class="small bad">${esc(e.errs[n.id])}</div>` : ""}` : `<span class="small muted">pai: ${esc(n.pai || "topo")}</span>`}</td><td>${f ? `<span class="chip o-calc">Cálculo</span>` : chip(n.o, `${q}.o`)}</td><td><button class="link bad" data-act="delnode" data-j="${j}" data-k="${k}" aria-label="Remover">×</button></td></tr>`; }).join("")}</tbody></table></div>
    <div class="row between"><span class="row"><button class="link" data-act="addnode" data-j="${j}">+ nó de entrada</button><button class="link" data-act="addnode" data-j="${j}" data-f="1">+ nó de fórmula</button></span><span>Impacto anual: <b class="${e.delta < 0 === (tr.linha === "receita") ? "bad" : ""}">${mil(e.delta)}</b> <span class="small muted">R$ mil</span></span></div></div>`;
}
const fmtNode = v => !nn(v) ? "–" : Math.abs(v) >= 100 ? fmt(v) : fmt(v, Math.abs(v) >= 1 ? 2 : 4);
function scImpact(x, sc) {
  const A = x.A, OF = x.OF, b = x.cases.base, o = runOnly(A, OF, sc), cv = A.covs;
  const m = [["Menor cobertura do serviço", "dscr", true, xx], ["Maior dívida líquida ÷ EBITDA", "lev", false, xx], ["Menor caixa", "cash", true, mil]];
  const rows = m.map(([n, k, mn, f]) => { const wb = worst(b, k, mn), wo = worst(o, k, mn); return `<tr><td>${n}</td><td class="r">${f(wb[k])} <span class="small muted">${wb.ano}</span></td><td class="r b ${wo[k] !== wb[k] && (mn ? wo[k] < wb[k] : wo[k] > wb[k]) ? "bad" : ""}">${f(wo[k])} <span class="small muted">${wo.ano}</span></td></tr>`; }).join("");
  const broken = cv.filter(c => o.some(r => !covCheck(c, r[COVM[c.m].k]).ok) && !b.some(r => !covCheck(c, r[COVM[c.m].k]).ok)).map(c => COVM[c.m].en);
  const bs = scoreOf(A, b), os = scoreOf(A, o);
  return box("O que muda para o credor", `<table class="tight"><thead><tr><th>Se acontecer inteiro</th><th class="r">Sem</th><th class="r">Com</th></tr></thead><tbody>${rows}<tr><td>Nota interna</td><td class="r">${bs.nota}</td><td class="r b">${os.nota}</td></tr><tr><td>Chance de calote em 1 ano</td><td class="r">${pct(bs.pd)}</td><td class="r b">${pct(os.pd)}</td></tr></tbody></table>
    <p class="small ${broken.length ? "bad" : "muted"}">${broken.length ? "Quebra: " + broken.join(", ") + "." : "Não quebra nenhum covenant que o caso base já não quebre."}</p>`);
}
