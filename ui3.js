// =====================================================================
// Eventos, origem, Claude, arquivos, salvar/abrir e inicialização
// =====================================================================
"use strict";
let ctl = null, saveT = null;
const FTEXT = {}; // texto lido dos arquivos (só na memória)
function changed(reprem) { if (reprem) { const d = defaultPrem(S.A); S.A.prem = d.P; S.A.premO = d.PO; S.A.premEdit = false; } scheduleSave(); render(); }

// ---------- campos ----------
document.addEventListener("change", ev => {
  const el = ev.target;
  if (el.dataset.mk != null) { S.map.linhas[+el.dataset.mk].ok = el.checked; return; }
  if (el.dataset.jov) { const v = parseN(el.value); if (nn(v)) { S.A.juros.over[el.dataset.jov] = v; S.A.juros.overF[el.dataset.jov] = "premissa do analista"; } else delete S.A.juros.over[el.dataset.jov]; return changed(); }
  if (el.dataset.iov) { const v = parseN(el.value); if (nn(v)) S.A.juros.ipcaOver[el.dataset.iov] = v; else delete S.A.juros.ipcaOver[el.dataset.iov]; return changed(); }
  if (el.id === "fileIn") return readFiles(el.files);
  const p = el.dataset.b; if (!p) return;
  const t = el.dataset.t; let v;
  if (t === "bool") v = el.checked;
  else if (t === "text") v = el.value;
  else { v = parseN(el.value); if (v !== null && t === "pct") v = v / 100; if (v !== null && (t === "int" || t === "ano")) v = Math.round(v); }
  // nó renomeado: troca as referências
  const mId = p.match(/^(cens\.\d+\.trees\.\d+)\.nos\.(\d+)\.id$/);
  if (mId) { const tr = getP(S.A, mId[1]), old = tr.nos[+mId[2]].id, nw = String(v).replace(/[^\w]/g, "_") || old; tr.nos.forEach(n => { if (n.pai === old) n.pai = nw; if (n.formula) n.formula = n.formula.replace(new RegExp(`\\b${old}\\b`, "g"), nw); }); v = nw; }
  const mT = p.match(/^gar\.(\d+)\.tipo$/); if (mT) Object.assign(S.A.gar[+mT[1]], pickG(v));
  const mD = p.match(/^dem\.(\w+)\.(\w+)\.v$/); if (mD && !getP(S.A, `dem.${mD[1]}.${mD[2]}.o`)) setP(S.A, `dem.${mD[1]}.${mD[2]}.o`, O("cli", "digitado na ferramenta; troque se for auditado"));
  const mF = p.match(/^cens\.(\d+)\.forma$/);
  setP(S.A, p, v);
  if (/^cens\.\d+\.prob$/.test(p)) { const sc = S.A.cens[+p.split(".")[1]]; if (sc.probO?.t === "claude" || !sc.probO) sc.probO = O("prem", "chance definida pelo analista"); }
  if (/^prem(O)?\./.test(p)) S.A.premEdit = true;
  changed(!S.A.premEdit && /^(dem\.|op\.quitar|emp\.anoBase)/.test(p));
});
document.addEventListener("input", ev => { const el = ev.target; if (el.type === "range" && el.dataset.b) { const b = el.parentElement.querySelector(".big"); if (b) b.textContent = el.value + "%"; } if (el.id === "parq") { S.parq = el.value; clearTimeout(el._t); el._t = setTimeout(() => { render(); }, 250); } });
document.addEventListener("keydown", ev => { if (ev.key === "Enter" && ev.target.id === "newcl" && ev.target.value.trim()) { S.A.clausulas.push(ev.target.value.trim()); changed(); } if (ev.key === "Escape" && S.modal) { S.modal = null; render(); } });
const confirmReprem = () => true;

// ---------- ações ----------
const ACTS = {
  tab: el => { S.tab = el.dataset.k; location.hash = S.tab; render(); window.scrollTo(0, 0); },
  caso: el => { S.caso = el.dataset.k; render(); },
  reprem: () => changed(true),
  nova: el => { if (S.arm !== "nova") { S.arm = "nova"; el.textContent = "Clique de novo para começar"; setTimeout(() => { S.arm = null; el.textContent = "Nova análise"; }, 4000); return; } S.arm = null; saveNow(); S.A = blankAnalysis(); S.tab = "dados"; changed(); },
  exemplo: () => { S.A = exampleAnalysis(); S.tab = "dados"; changed(); },
  abrir: () => openList(),
  carregar: el => loadOne(el.dataset.id),
  fechar: () => { S.modal = null; render(); },
  orig: el => openOrig(el.dataset.p),
  origok: () => { const p = S.modalP, t = $("#ot").value, f = $("#of").value.trim(); setP(S.A, p, O(t, f)); S.modal = null; changed(); },
  addcred: () => { S.A.credores.push({id: uid(), nome: "", saldo: 0, real: false, o: O("cli", "relação de dívidas da empresa")}); changed(); },
  delcred: el => { S.A.credores.splice(+el.dataset.i, 1); changed(); },
  addgar: () => { S.A.gar.push({id: uid(), tipo: "imovel", desc: "", valor: 0, o: O("cli", "valor informado; anexe o laudo"), ...pickG("imovel")}); changed(); },
  delgar: el => { S.A.gar.splice(+el.dataset.i, 1); changed(); },
  addcov: () => { S.A.covs.push({m: $("#newcov").value, lim: $("#newcov").value === "lev" ? 3 : 1.5, o: O("prem", "limite proposto pelo analista")}); changed(); },
  delcov: el => { S.A.covs.splice(+el.dataset.i, 1); changed(); },
  delcl: el => { S.A.clausulas.splice(+el.dataset.i, 1); changed(); },
  selsc: el => { S.sel = el.dataset.id; render(); },
  newsc: () => { const s = {id: uid(), ativo: true, nome: "Novo cenário", cat: "Micro", prob: 20, probO: O("prem", "chance definida pelo analista"), probJust: "", forma: "imediato", ramp: [1, 1, 1, 1, 1], trees: [], como: "", gatilho: "", mitigante: "", origem: "analista"}; S.A.cens.push(s); S.sel = s.id; changed(); },
  addtpl: el => { const s = mkTemplate(S.A, el.dataset.k); S.A.cens.push(s); S.sel = s.id; changed(); },
  dupsc: () => { const s = deep(curSc()); s.id = uid(); s.nome += " (cópia)"; S.A.cens.push(s); S.sel = s.id; changed(); },
  delsc: el => { if (S.arm !== "delsc") { S.arm = "delsc"; el.textContent = "clique de novo para apagar"; setTimeout(() => { S.arm = null; }, 4000); return; } S.arm = null; S.A.cens = S.A.cens.filter(s => s.id !== S.sel); S.sel = null; changed(); },
  forma: el => { const s = curSc(), k = el.dataset.k; if (k === "custom") s.ramp = [...ramp(s)]; s.forma = k; changed(); },
  newtree: () => { const l = $("#newline").value; curSc().trees.push({id: uid(), ativo: true, titulo: "Nova árvore: " + TLINES[l].nome, linha: l, vcr: .6, vcrO: O("prem", "parte da receita que é custo variável"), nos: [N("topo", TLINES[l].nome, null, "formula", 0, 0, {formula: "a", unid: "R$ mil"}), N("a", "Valor", "topo", "entrada", 0, 0, {unid: "R$ mil", o: O("prem", "")})]}); changed(); },
  deltree: el => { curSc().trees.splice(+el.dataset.j, 1); changed(); },
  addnode: el => { const tr = curSc().trees[+el.dataset.j], root = tr.nos.find(n => !n.pai); let k = 1; while (tr.nos.some(n => n.id === "n" + k)) k++;
    tr.nos.push(N("n" + k, el.dataset.f ? "Fórmula" : "Entrada", root?.id || null, el.dataset.f ? "formula" : "entrada", 0, 0, el.dataset.f ? {formula: "0"} : {o: O("prem", "")})); changed(); },
  delnode: el => { const tr = curSc().trees[+el.dataset.j]; tr.nos.splice(+el.dataset.k, 1); changed(); },
  useprob: () => { const s = curSc(), a = S.sug.prob[s.id]; s.prob = Math.round(a.prob); s.probO = O("claude", "chance sugerida pelo Claude: " + a.just); s.probJust = s.probJust || a.just; changed(); },
  addpar: el => { if (!S.A.pares.includes(el.dataset.c)) S.A.pares.push(el.dataset.c); S.parq = ""; changed(); },
  delpar: el => { S.A.pares = S.A.pares.filter(c => c !== el.dataset.c); changed(); },
  addcp: () => { S.A.covPares.push({emissor: "", cov: "", lim: "", link: ""}); changed(); },
  delcp: el => { S.A.covPares.splice(+el.dataset.i, 1); changed(); },
  addnot: () => { S.A.noticias.push({veiculo: "", data: "", link: "", titulo: "", uso: ""}); changed(); },
  delnot: el => { S.A.noticias.splice(+el.dataset.i, 1); changed(); },
  mapear: el => aiMap(+el.dataset.i), mapok: () => applyMap(), mapno: () => { S.map = null; render(); },
  sugsc: () => aiScen(), aitree: () => aiTree(), prob: () => aiProb(), sugcov: () => aiCov(), sugpar: () => aiPares(), parecer: () => aiParecer(),
  stop: () => { ctl?.abort(); },
  export: el => doExport(el.dataset.k),
  importar: () => $("#jsonIn").click(),
};
const curSc = () => S.A.cens.find(s => s.id === S.sel);
document.addEventListener("click", ev => { const el = ev.target.closest("[data-act]"); if (!el) return; const f = ACTS[el.dataset.act]; if (f) { ev.preventDefault(); f(el); } });

// ---------- janela de origem ----------
function openOrig(p) {
  const o = getP(S.A, p) || O("prem", ""); S.modalP = p;
  S.modal = () => `<div class="modal" role="dialog" aria-modal="true" aria-label="Origem do número"><div class="mbox"><h3>De onde vem este número?</h3>
    <label class="fld"><span>Tipo</span><select id="ot">${Object.entries(ORIG).map(([k, x]) => `<option value="${k}" ${k === o.t ? "selected" : ""}>${x.nome}: ${x.txt}</option>`).join("")}</select></label>
    <label class="fld"><span>Fonte (documento, página, nota explicativa, link, data)</span><textarea id="of" rows="3">${esc(o.f)}</textarea></label>
    <div class="row"><button class="b pri" data-act="origok">Salvar</button><button class="link" data-act="fechar">cancelar</button></div></div></div>`;
  render();
}

// ---------- Claude (conta do usuário, sem chave) ----------
async function ask(key, prompt, opts = {}) {
  const sm = await getSM(); if (!sm) { S.msg[key] = {t: "Este botão usa o Claude e só funciona com a ferramenta aberta no claude.ai. Aqui, preencha à mão.", bad: true}; render(); return null; }
  ctl?.abort(); ctl = new AbortController(); S.busy = key; S.busyTxt = "Pensando…"; S.msg[key] = null; render();
  try {
    const f = opts.text ? sm : sm.json;
    const out = await f(prompt, {signal: ctl.signal, modelTier: opts.tier || "default", cache: false, onText: ({text}) => { S.busyTxt = `Escrevendo… ${text.length} caracteres`; document.querySelectorAll(".busytxt").forEach(e => e.textContent = S.busyTxt); }});
    return opts.text ? out.text : out;
  } catch (e) { S.msg[key] = {t: e?.code === "cancelled" ? "Parado." : e?.code === "rate_limited" ? "Muitos pedidos seguidos. Espere um pouco." : e?.code === "not_granted" ? "Permissão para usar o Claude não foi dada." : "O Claude não respondeu: " + (e?.message || e?.code || "erro"), bad: true}; return null; }
  finally { S.busy = null; render(); }
}
const companyBrief = () => { const x = X(), L = x.L, A = x.A; return `Empresa: ${A.emp.nome || "(sem nome)"}; setor: ${A.emp.setor || "não informado"}; grupo: ${A.emp.grupo || "-"}.
Últimos 12 meses (R$ mil): receita ${fmt(L.receita)}, EBITDA ${fmt(L.ebitda)} (margem ${pct(L.ebitda / L.receita)}), juros ${fmt(L.juros)}, dívida bruta ${fmt(L.divbruta)}, dívida de curto prazo ${fmt(L.divcp)}, caixa ${fmt(L.caixa)}, contas a receber ${fmt(L.receber)}, estoques ${fmt(L.estoques)}, capex ${fmt(L.capex)}.
Maior cliente: ${pct(A.emp.conc, 0)} da receita. Auditoria: ${A.emp.auditoria}. Operação proposta: ${A.op.instrumento} de R$ ${fmt(A.op.valor)} mil, ${A.op.prazo} meses, carência ${A.op.carencia}, ${A.op.index} + ${pct(A.op.spread, 2)}. Garantias: ${(A.gar || []).map(g => GTIPOS[g.tipo].nome + " R$ " + fmt(g.valor) + " mil").join("; ") || "nenhuma"}.
CDI atual ${fmt(S.OF.cdi.valor, 2)}% (${S.OF.cdi.data}); Selic esperada pelo Focus para o fim do próximo ano: ${fmt(S.OF.focus.selic_anual[1]?.med, 2)}%.`; };
const RULES = `Regras de árvore: cada árvore tem exatamente 1 nó raiz (pai null) do tipo "formula", cujo valor é o efeito ANUAL na linha em R$ mil. O efeito é raiz(cen) − raiz(base). Nós "entrada" têm base (hoje) e cen (no cenário). Nós "formula" usam os ids de outros nós com + - * / ^ ( ) e max(), min(), abs(). Ids: letras minúsculas, números e _. Use números das demonstrações dadas para a base (conferindo que a soma das partes não passa da linha). Máximo de 8 nós por árvore. Cada entrada traz "fonte": de onde veio o número (ex.: "demonstrações: receita 12 meses", "premissa: choque de estresse", "conhecimento do Claude sobre o setor, a conferir").
Linhas possíveis: ${Object.entries(TLINES).map(([k, l]) => `${k} (${l.txt})`).join("; ")}. Em árvores de "receita" informe "vcr": fração da receita perdida que deixa de ser custo (0 a 1).
"forma" é uma de: ${Object.entries(FORMAS).map(([k, f]) => `${k} (${f.txt})`).join("; ")}.`;
function validTree(t) {
  if (!t || !TLINES[t.linha] || !Array.isArray(t.nos) || !t.nos.length || t.nos.length > 12) return null;
  const nos = t.nos.map(n => ({id: String(n.id || "").replace(/[^\w]/g, "_"), nome: String(n.nome || n.id || ""), pai: n.pai || null, tipo: n.tipo === "formula" ? "formula" : "entrada", base: +n.base || 0, cen: +n.cen || 0, unid: String(n.unid || ""), formula: String(n.formula || ""), o: O("claude", String(n.fonte || "sugerido pelo Claude"))}));
  if (nos.filter(n => !n.pai).length !== 1) return null;
  const tr = {id: uid(), ativo: true, titulo: String(t.titulo || "Árvore"), linha: t.linha, vcr: clamp(+t.vcr || .6, 0, 1), vcrO: O("claude", "custo variável sugerido pelo Claude"), nos};
  const e = evalTree(tr); return Object.keys(e.errs).length || !nn(e.delta) ? null : tr;
}
async function aiScen() {
  const out = await ask("sc", `Você é analista de crédito corporativo no Brasil e avalia um empréstimo a uma empresa de capital fechado.
${companyBrief()}
Cenários que já existem: ${S.A.cens.map(s => s.nome).join("; ") || "nenhum"}.
Sugira 3 cenários NOVOS, específicos deste setor e porte, que mais ameacem o pagamento desta operação, misturando micro e macro. Para cada um, árvore(s) com números plausíveis e explicados.
${RULES}
Responda só JSON: {"cenarios":[{"nome":"...","cat":"Macro|Micro","prob":0-100,"probJust":"por que essa chance, 1-2 frases","forma":"...","como":"como chega no credor","gatilho":"sinal observável","mitigante":"cláusula ou garantia que protege","trees":[{"titulo":"...","linha":"...","vcr":0.6,"nos":[{"id":"...","nome":"...","pai":null,"tipo":"formula|entrada","base":0,"cen":0,"unid":"...","formula":"...","fonte":"..."}]}]}]}. Português do Brasil.`, {tier: "complex"});
  if (!out) return;
  let ok = 0; (out.cenarios || []).forEach(c => { const trees = (c.trees || []).map(validTree).filter(Boolean); if (!trees.length) return; ok++;
    S.A.cens.push({id: uid(), ativo: true, nome: String(c.nome), cat: c.cat === "Macro" ? "Macro" : "Micro", prob: clamp(+c.prob || 20, 0, 100), probO: O("claude", "chance sugerida pelo Claude: " + (c.probJust || "")), probJust: String(c.probJust || ""), forma: FORMAS[c.forma] ? c.forma : "imediato", ramp: [...(FORMAS[c.forma] || FORMAS.imediato).r], trees, como: String(c.como || ""), gatilho: String(c.gatilho || ""), mitigante: String(c.mitigante || ""), origem: "claude"}); });
  S.msg.sc = {t: ok ? `${ok} cenários adicionados, marcados "Claude". Confira cada número.` : "As sugestões vieram com árvores inválidas. Tente de novo.", bad: !ok}; changed();
}
async function aiTree() {
  const sc = curSc(), txt = $("#treeTxt")?.value.trim(); if (!txt) { S.msg.tree = {t: "Escreva o que acontece no cenário.", bad: true}; return render(); }
  const out = await ask("tree", `Você é analista de crédito no Brasil. ${companyBrief()}
Cenário "${sc.nome}". O analista descreve: "${txt}". Monte 1 a 2 árvores que implementem exatamente isso (números do analista entram com fonte "analista"). Se mexe em mais de uma linha, uma árvore por linha.
${RULES}
Responda só JSON: {"trees":[...]}`, {tier: "default"});
  if (!out) return; const trees = (out.trees || []).map(validTree).filter(Boolean);
  sc.trees.push(...trees); S.msg.tree = {t: trees.length ? `${trees.length} árvore(s) adicionadas.` : "Não consegui uma árvore válida. Reescreva o pedido.", bad: !trees.length}; changed();
}
async function aiProb() {
  const sc = curSc(), out = await ask("prob", `Você é analista de crédito no Brasil. ${companyBrief()}
Estime a chance de o cenário "${sc.nome}" acontecer em algum momento dos próximos ${NY} anos. Descrição: ${sc.como}. Árvores: ${sc.trees.map(t => t.titulo).join("; ")}. Justificativa atual do analista: ${sc.probJust || "nenhuma"}.
Use frequência histórica do tipo de evento no Brasil e no setor. Seu conhecimento tem data de corte; diga o que conferir hoje.
Responda só JSON: {"prob":0-100,"faixa":[min,max],"just":"1-2 frases","pro":["fatores que aumentam"],"contra":["fatores que reduzem"],"conferir":["o que checar hoje"]}`, {tier: "default"});
  if (!out || !nn(+out.prob)) return; (S.sug.prob ||= {})[sc.id] = {...out, prob: clamp(+out.prob, 0, 100)}; render();
}
async function aiCov() {
  const out = await ask("cov", `Você é analista de crédito no Brasil. ${companyBrief()}
Sugira até 5 covenants financeiros e não financeiros típicos para esta operação e este setor, com limites usuais no mercado brasileiro e o porquê. Seu conhecimento tem data de corte e não consulta escrituras.
Responda só JSON: {"cov":[{"covenant":"...","limite":"...","porque":"..."}]}`, {tier: "default"});
  if (out?.cov) { S.sug.cov = out.cov.slice(0, 5); render(); }
}
async function aiPares() {
  const D = S.OF.anbima.deb, list = D.map(d => `${d.c}|${d.n}`).join("\n");
  const out = await ask("par", `Você é analista de crédito no Brasil. ${companyBrief()}
Abaixo estão emissores de debêntures em DI + spread no mercado secundário da ANBIMA (código|nome). Escolha até 6 que melhor sirvam de par para esta empresa (mesmo setor ou setor vizinho, porte e risco parecidos) e diga por quê. Use só códigos da lista.
${list}
Responda só JSON: {"codigos":["..."],"porque":"1-3 frases"}`, {tier: "default"});
  if (!out) return; const ok = (out.codigos || []).filter(c => D.some(d => d.c === c)).slice(0, 6);
  ok.forEach(c => { if (!S.A.pares.includes(c)) S.A.pares.push(c); (S.A.parAj[c] ||= {}).porque ||= "sugerido pelo Claude"; });
  S.sug.par = {porque: String(out.porque || "")}; S.msg.par = {t: `${ok.length} pares adicionados.`}; changed();
}
async function aiParecer() {
  const x = X(), pr = x.pr, R = risks(x);
  const t = await ask("par2", `Você é analista de crédito corporativo no Brasil. Escreva o rascunho do parecer de crédito em português, em parágrafos curtos e frases completas, sem travessões e sem siglas desnecessárias. Use só os números abaixo e diga a origem quando relevante.
${companyBrief()}
Caso base, pior cobertura do serviço da dívida: ${xx(worst(x.cases.base, "dscr").dscr)}; esperado: ${xx(worst(x.cases.esperado, "dscr").dscr)}; estresse: ${xx(worst(x.cases.estresse, "dscr").dscr)}.
Dívida líquida ÷ EBITDA no 1º ano: ${xx(x.cases.base[0].lev)}. Cobertura de garantias ${xx(x.col.cover)}, perda se quebrar ${pct(x.col.lgd, 0)}. Nota interna ${pr.pb.base.nota}, chance de calote ponderada ${pct(pr.pb.pd, 2)}, perda esperada ${pct(pr.EL, 2)}, spread mínimo ${pct(pr.min, 2)} contra proposto ${pct(pr.spread, 2)}, retorno ajustado ao risco ${pct(pr.raroc, 1)}.
Riscos: ${R.slice(0, 5).map(r => `${r.s.nome} (chance ${r.s.prob}%, cobertura vai a ${xx(r.v)} em ${r.ano}; gatilho: ${r.s.gatilho}; mitigante: ${r.s.mitigante || "nenhum"})`).join("; ")}.
Covenants: ${S.A.covs.map(c => COVM[c.m].en + " " + c.lim).join("; ")}. Recomendação do analista: ${S.A.parecer.rec}. Condições: ${S.A.parecer.condicoes || "nenhuma"}.
Estrutura: 1) resumo e recomendação; 2) capacidade de pagamento; 3) garantias e estrutura; 4) riscos e mitigantes; 5) preço; 6) condições e monitoramento.`, {text: true, tier: "complex"});
  if (t) { S.A.parecer.texto = t; S.msg.par2 = {t: "Rascunho do Claude: revise antes de usar."}; changed(); }
}
async function aiMap(i) {
  const f = S.A.files[i], txt = FTEXT[f.nome]; if (!txt) { S.msg.map = {t: "O texto deste arquivo não está mais na memória. Envie de novo.", bad: true}; return render(); }
  const P = periods(S.A);
  const out = await ask("map", `Você lê demonstrações financeiras brasileiras (balancete, DRE, balanço, fluxo de caixa) e padroniza as contas.
Linhas padronizadas (id: significado): ${INPUT_LINES.map(l => `${l.id}: ${l.pt}`).join("; ")}.
Períodos possíveis (col: rótulo): ${P.map(p => `${p.k}: ${p.lab}${p.ano ? " (ano fechado)" : " (acumulado do ano até o mês)"}`).join("; ")}.
Regras: valores em R$ mil (converta se o arquivo estiver em reais ou milhões e diga isso em "resumo"); despesas e saídas como números positivos (juros, ir, capex, divid); dívida bruta separada em curto (divcp) e longo prazo (divlp), incluindo debêntures, arrendamentos financeiros e mútuos com partes relacionadas com juros (avise se incluir mútuos); ebit = lucro antes do resultado financeiro e dos impostos. Some contas quando preciso e diga quais em "conta". "conf" de 0 a 1 = sua confiança. Não invente: se uma linha não aparece, não inclua.
Arquivo "${f.nome}":
"""
${txt.slice(0, 60000)}
"""
Responda só JSON: {"resumo":"unidade encontrada, períodos encontrados","linhas":[{"linha":"id","col":"y2|y1|y0|p0|p1","valor":0,"conta":"conta(s) no arquivo","conf":0.9}],"avisos":["inconsistências ou contas duvidosas"]}`, {tier: "complex"});
  if (!out?.linhas) return;
  S.map = {arquivo: f.nome, t: f.t, resumo: out.resumo, avisos: out.avisos || [], linhas: out.linhas.filter(r => LBY[r.linha] && !LBY[r.linha].calc && P.some(p => p.k === r.col) && nn(+r.valor)).map(r => ({...r, valor: +r.valor, conf: clamp(+r.conf || 0, 0, 1), ok: (+r.conf || 0) >= .7}))};
  render();
}
function applyMap() {
  const m = S.map, P = Object.fromEntries(periods(S.A).map(p => [p.k, p.lab])); let n = 0;
  m.linhas.filter(r => r.ok).forEach(r => { setD(S.A, r.linha, r.col, r.valor, O(m.t, `${m.arquivo}, ${P[r.col]}: ${r.conta} (lido pelo Claude, confiança ${pct(r.conf, 0)})`)); n++; });
  S.map = null; S.msg.map = {t: `${n} valores aplicados com a origem "${ORIG[m.t].nome}" e a conta de cada um.${S.A.premEdit ? " Suas premissas editadas foram mantidas; use \"Recalcular premissas pelo histórico\" se quiser refazê-las." : ""}`}; changed(!S.A.premEdit);
}

// ---------- arquivos ----------
const LIBS = {xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", pdf: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", h2c: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js", jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js", xl: "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"};
const loaded = {};
const loadLib = k => loaded[k] ||= new Promise((ok, no) => { const s = document.createElement("script"); s.src = LIBS[k]; s.onload = ok; s.onerror = () => { loaded[k] = null; no(new Error("não carregou a biblioteca " + k)); }; document.head.appendChild(s); });
async function readFiles(list) {
  S.msg.map = {t: "Lendo arquivos…"}; render();
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
      FTEXT[file.name] = txt;
      const ex = S.A.files.find(f => f.nome === file.name); if (ex) ex.chars = txt.length; else S.A.files.push({nome: file.name, chars: txt.length, t: /audit/i.test(file.name) ? "aud" : "cli"});
      if (txt.replace(/\s/g, "").length < 200) S.msg.map = {t: `${file.name}: quase sem texto. Se for PDF escaneado, digite os números.`, bad: true}; else S.msg.map = {t: "Arquivos lidos. Marque se cada um é auditado e peça o de-para."};
    } catch (e) { S.msg.map = {t: `${file.name}: ${e.message}`, bad: true}; }
  }
  changed();
}
document.addEventListener("dragover", e => { if (e.target.closest?.("#drop")) { e.preventDefault(); e.target.closest("#drop").classList.add("over"); } });
document.addEventListener("drop", e => { const d = e.target.closest?.("#drop"); if (d) { e.preventDefault(); readFiles(e.dataTransfer.files); } });

// ---------- salvar e abrir (na sua conta, pelo banco da página; cópia no navegador) ----------
function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(saveNow, 1200); try { localStorage.setItem("mcp_ultima", JSON.stringify(S.A)); } catch (_) {} }
async function saveNow() {
  const db = await getDB(); if (!db) { S.saveMsg = "Salvo só neste navegador"; $("#savemsg").textContent = S.saveMsg; return; }
  try { await db.doc("analises/" + S.A.id).set({nome: S.A.emp.nome || "Sem nome", atualizado: new Date().toISOString(), json: JSON.stringify(S.A)}); S.saveMsg = "Salvo " + new Date().toLocaleTimeString("pt-BR", {hour: "2-digit", minute: "2-digit"}); }
  catch (e) { S.saveMsg = "Não salvou na conta (" + (e.code || e.message) + "); cópia no navegador"; }
  $("#savemsg").textContent = S.saveMsg;
}
async function openList() {
  const db = await getDB(); let rows = [];
  if (db) { try { const q = await db.collection("analises").orderBy("atualizado", "desc").limit(50).get(); rows = q.docs.map(d => ({id: d.id, ...d.data()})); } catch (e) { rows = []; } }
  S.modal = () => `<div class="modal" role="dialog" aria-modal="true" aria-label="Abrir análise"><div class="mbox"><h3>Análises salvas</h3>
    ${rows.length ? rows.map(r => `<button class="hit" data-act="carregar" data-id="${esc(r.id)}"><b>${esc(r.nome)}</b> <span class="muted">${new Date(r.atualizado).toLocaleString("pt-BR")}</span></button>`).join("") : `<p class="small muted">${db ? "Nenhuma análise salva ainda." : "Salvar na conta não está disponível nesta visualização."}</p>`}
    <div class="row"><button class="b" data-act="exemplo">Abrir a empresa de exemplo</button><button class="b" data-act="importar">Abrir arquivo .json</button><button class="link" data-act="fechar">fechar</button></div></div></div>`;
  render();
}
async function loadOne(id) { const db = await getDB(); const s = await db.doc("analises/" + id).get(); if (s.exists) { S.A = migrate(JSON.parse(s.data().json)); S.modal = null; S.tab = "dados"; render(); } }
const migrate = A => { const B = blankAnalysis(); Object.keys(B).forEach(k => { if (A[k] === undefined) A[k] = B[k]; }); ["emp", "op", "juros", "preco", "rating", "parecer"].forEach(k => A[k] = {...B[k], ...A[k]}); return A; };
document.addEventListener("change", async ev => { if (ev.target.id !== "jsonIn") return; const f = ev.target.files[0]; if (!f) return; try { S.A = migrate(JSON.parse(await f.text())); S.A.id ||= uid(); S.modal = null; changed(); } catch (e) { S.saveMsg = "Arquivo inválido: " + e.message; render(); } });

// ---------- início ----------
async function init() {
  try { S.OF = await fetch("oficial.json").then(r => { if (!r.ok) throw new Error("oficial.json"); return r.json(); }); }
  catch (e) { $("#app").innerHTML = `<section class="box warnbox"><h3>Não carreguei os dados oficiais</h3><p class="small">${esc(e.message)}</p></section>`; return; }
  let A = null; try { const s = localStorage.getItem("mcp_ultima"); if (s) A = migrate(JSON.parse(s)); } catch (_) {}
  S.A = A || exampleAnalysis();
  const h = location.hash.slice(1); if (TABS.some(t => t[0] === h)) S.tab = h;
  render();
}
init();
