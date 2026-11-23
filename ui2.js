// =====================================================================
// Abas 5 a 8, eventos, Claude, salvar e abrir
// =====================================================================
"use strict";
// ---------- 5 · Juros e inflação ----------
function tJuros() {
  const x = X(), A = x.A, OF = x.OF, rows = selicPath(A, OF);
  const past = rows.filter(r => nn(r.real)).slice(-6), fut = rows.filter(r => !nn(r.real));
  const tbl = `<div class="scroll"><table class="tight"><thead><tr><th>Reunião</th><th>Data</th><th class="r">Selic decidida</th><th class="r">Focus: Selic esperada</th><th class="r">Sua premissa</th><th class="r">Selic usada</th><th>Origem</th></tr></thead><tbody>
    ${past.map(r => `<tr class="hist"><td>${esc(r.r)}</td><td>${esc(r.data.split("-").reverse().join("/"))}</td><td class="r">${pct(r.real / 100, 2)}</td><td></td><td></td><td class="r">${pct(r.real / 100, 2)}</td><td>${chip(r.src)}</td></tr>`).join("")}
    ${fut.map(r => `<tr><td>${esc(r.r)}</td><td>${tIn(`juros.datas.${r.r.replace("/", "_")}`, A.juros.datas[r.r.replace("/", "_")] || "", "tx d", "dd/mm/aaaa")}</td><td></td><td class="r">${nn(r.focus) ? pct(r.focus / 100, 2) : "–"}</td>
      <td class="r"><input class="n s ${nn(r.over) ? "chg" : ""}" data-jov="${r.r}" value="${nn(r.over) ? fmt(r.over, 2) : ""}" placeholder="= Focus"></td><td class="r b">${pct(r.use / 100, 2)}</td><td>${chip(r.src)}</td></tr>`).join("")}</tbody></table></div>
    <p class="small muted">As 6 últimas reuniões vêm dos comunicados do Copom. As futuras vêm da mediana do Focus de ${esc(OF.focus.data.split("-").reverse().join("/"))} por reunião (R1 a R8 de cada ano). Onde não há mediana por reunião, uso a Selic de fim de ano do Focus anual. Escreva uma taxa em "Sua premissa" para substituir. O Banco Central publica o calendário das reuniões em <a href="https://www.bcb.gov.br/publicacoes/copom" target="_blank" rel="noopener">página do Copom</a>; preencha a data se quiser.</p>`;
  const anos = `<div class="scroll"><table class="tight"><thead><tr><th></th>${x.J.map(j => `<th class="r">${j.ano}</th>`).join("")}</tr></thead><tbody>
    <tr><td>${en("Average Selic", "média do ano pelas reuniões")}</td>${x.J.map(j => `<td class="r">${pct(j.selic / 100, 2)}</td>`).join("")}</tr>
    <tr><td>${en("CDI", "Selic média − diferença CDI/Selic")}</td>${x.J.map(j => `<td class="r b">${pct(j.cdi, 2)}</td>`).join("")}</tr>
    <tr><td>${en("Inflation (IPCA)", "Focus anual ou sua premissa")}</td>${x.I.map(i => `<td class="r"><input class="n s ${nn(i.over) ? "chg" : ""}" data-iov="${i.ano}" value="${nn(i.over) ? fmt(i.over, 2) : ""}" placeholder="${fmt(i.focus, 2)}"></td>`).join("")}</tr></tbody></table></div>
    <label class="fld"><span>Diferença entre Selic e CDI (p.p.) ${chip(O("ofi", `CDI de ${OF.cdi.data} ${fmt(OF.cdi.valor, 2)}% (${OF.cdi.fonte}) contra Selic de ${fmt(OF.copom.past.at(-1).selic, 2)}% decidida em ${OF.copom.past.at(-1).data.split("-").reverse().join("/")}`))}</span>${nIn("juros.cdiGap", A.juros.cdiGap, "dec", "s")}</label>
    ${eq([`${v_("Average Selic")}<sub>y</sub> = [${v_("Selic")}<sub>R8, y−1</sub> + Σ<sub>k=1..7</sub> ${v_("Selic")}<sub>Rk, y</sub>] ÷ 8`, `${v_("CDI")}<sub>y</sub> = ${v_("Average Selic")}<sub>y</sub> − ${v_("Selic-CDI Gap")}`],
      "Selic média do ano = taxa em vigor em 1º de janeiro (decidida na última reunião do ano anterior) e as decididas nas reuniões 1 a 7, cada uma valendo cerca de 1/8 do ano · CDI = Selic média − diferença observada entre as duas.")}`;
  const ip = OF.ipca.a12.slice(-6);
  const ipca = `<table class="tight"><thead><tr><th>Mês</th><th class="r">IPCA do mês</th><th class="r">IPCA 12 meses</th></tr></thead><tbody>${ip.map((r, i) => `<tr><td>${r[0]}</td><td class="r">${pct(OF.ipca.m.find(m => m[0] === r[0])?.[1] / 100, 2)}</td><td class="r">${pct(r[1] / 100, 2)}</td></tr>`).join("")}</tbody></table>
    <p class="small muted">${chip(O("ofi", OF.ipca.fonte))} <a href="${OF.ipca.link}" target="_blank" rel="noopener">IBGE</a>. Focus anual: ${OF.focus.ipca_anual.map(f => `${f.ano} ${fmt(f.med, 2)}%`).join(" · ")}.</p>`;
  return `<div class="row between"><h2>CDI e IPCA reunião a reunião</h2><span class="small muted">Dados de ${esc(OF.focus.data.split("-").reverse().join("/"))} (Focus) e ${esc(OF.copom.past.at(-1).data.split("-").reverse().join("/"))} (último Copom). <a href="${OF.focus.link}" target="_blank" rel="noopener">Focus</a> · <a href="${OF.copom.link}" target="_blank" rel="noopener">Copom</a></span></div>
    <div class="cols2b"><div class="stack">${box("Reuniões do Copom", tbl)}</div><div class="stack">${box("Média de cada ano usada na projeção", anos)}${box("IPCA realizado", ipca)}</div></div>`;
}

// ---------- 6 · Precificação e pares ----------
function tPreco() {
  const x = X(), A = x.A, pr = x.pr, P = A.preco, OF = x.OF, mxs = Math.max(pr.spread, pr.min) * 1.05;
  const bar = (lab, v, off, color, o, path) => `<div class="sbar"><span>${lab}</span><span class="st"><i style="margin-left:${off / mxs * 100}%;width:${Math.max(0, v) / mxs * 100}%;background:${color}"></i></span><span class="r">${pct(v, 2)}</span>${o ? chip(o, path) : `<span class="chip o-calc">Cálculo</span>`}</div>`;
  const build = `${bar("Custo de captação", P.funding, 0, "var(--dado)", P.o.funding, "preco.o.funding")}${bar("Perda esperada", pr.EL, P.funding, "var(--bad)")}${bar("Custo do capital", pr.cap, P.funding + pr.EL, "var(--prem)")}${bar("Custo operacional e tributos", P.opex, P.funding + pr.EL + pr.cap, "var(--tail)", P.o.opex, "preco.o.opex")}
    <div class="sbar tot">${`<span>= Spread mínimo</span><span class="st"><i style="width:${pr.min / mxs * 100}%;background:var(--line)"></i></span><span class="r">${pct(pr.min, 2)}</span><span class="chip o-calc">Cálculo</span>`}</div>
    <div class="sbar tot"><span>Spread proposto</span><span class="st"><i style="width:${pr.spread / mxs * 100}%;background:var(--accent)"></i></span><span class="r">${pct(pr.spread, 2)}</span><span class="small muted">aba Operação</span></div>
    <div class="grid4">${[["funding", "Captação acima do CDI"], ["opex", "Custo operacional"], ["capital", "Capital exigido"], ["roe", "Meta de retorno"]].map(([k, n]) => `<label class="fld"><span>${n} ${chip(P.o[k], `preco.o.${k}`)}</span>${nIn(`preco.${k}`, P[k], "pct", "s")}</label>`).join("")}</div>
    ${eq([`${v_("Expected Loss")} = ${v_("Probability of Default")} × ${v_("Loss Given Default")} = ${pct(pr.pb.pd, 2)} × ${pct(pr.col.lgd, 1)} = ${pct(pr.EL, 2)}`,
      `${v_("Capital Charge")} = ${v_("Capital Ratio")} × (${v_("Target Return on Equity")} − ${v_("Risk-free Rate")}) = ${pct(P.capital, 1)} × (${pct(P.roe, 1)} − ${pct(pr.rf, 2)}) = ${pct(pr.cap, 2)}`,
      `${v_("Minimum Spread")} = ${v_("Funding Cost")} + ${v_("Expected Loss")} + ${v_("Capital Charge")} + ${v_("Operating Cost")} = ${pct(pr.min, 2)}`,
      `${v_("Risk-adjusted Return")} = (${v_("Spread")} − ${v_("Funding Cost")} − ${v_("Expected Loss")} − ${v_("Operating Cost")}) ÷ ${v_("Capital Ratio")} + ${v_("Risk-free Rate")} = ${pct(pr.raroc, 1)}`],
      `perda esperada = chance de calote × perda se quebrar · custo do capital = capital exigido × (meta de retorno − CDI), porque o capital separado já rende CDI · spread mínimo = a soma das partes, o ponto em que o retorno fica na meta · retorno ajustado ao risco = o que sobra do spread ÷ capital + CDI. CDI de ${OF.cdi.data}: ${fmt(OF.cdi.valor, 2)}% (Banco Central). Chance de calote da aba de rating abaixo; perda se quebrar da aba Operação e garantias.`)}
    <div class="kpis3">${kpi("Folga sobre o mínimo", pp(pr.folga), "spread proposto − mínimo", pr.folga >= 0 ? "ok" : "bad")}${kpi("Retorno ajustado ao risco", pct(pr.raroc, 1), `meta ${pct(P.roe, 0)}`, pr.raroc >= P.roe ? "ok" : "bad")}${kpi("Chance de calote usada", pct(pr.pb.pd, 2), "caso base + acréscimo de cada cenário pela chance")}</div>`;
  // alternativas de estrutura
  const alt = (nome, gar) => { const B = {...A, gar}, c = collateral(B, OF), el = pr.pb.pd * c.lgd, mn = P.funding + el + pr.cap + P.opex; return `<tr><td>${esc(nome)}</td><td class="r">${pct(c.lgd, 0)}</td><td class="r">${pct(mn, 2)}</td><td class="r">${pct((A.op.spread - P.funding - el - P.opex) / P.capital + pr.rf, 1)}</td></tr>`; };
  const G = A.gar || [];
  const alts = `<table class="tight"><thead><tr><th>Estrutura</th><th class="r">Perda se quebrar</th><th class="r">Spread mínimo</th><th class="r">Retorno com o spread proposto</th></tr></thead><tbody>
    ${alt("Só garantias pessoais", G.filter(g => g.tipo === "pessoal"))}${alt("Proposta atual", G)}${G.some(g => g.tipo === "recebiveis") ? alt("Proposta sem a cessão de recebíveis", G.filter(g => g.tipo !== "recebiveis")) : ""}
    ${G.some(g => g.tipo === "recebiveis") ? alt("Proposta com a trava de recebíveis 1/3 maior", G.map(g => g.tipo === "recebiveis" ? {...g, valor: g.valor * 4 / 3} : g)) : ""}</tbody></table>`;
  // rating
  const pb = pr.pb, b = pb.base;
  const rat = `<div class="row"><span class="nota">${b.nota}</span><span class="small muted">nota ${fmt(b.score, 0)} de 100 no caso base · chance de calote em 1 ano ${pct(b.pd, 2)} ${chip(A.rating.escalaO, "rating.escalaO")}</span></div>
    <table class="tight"><thead><tr><th>Critério</th><th class="r">Valor</th><th class="r">Pontos</th><th class="r">Peso %</th></tr></thead><tbody>
    ${b.items.map(it => `<tr><td>${en(it.nome, it.pt)}</td><td class="r">${it.k === "info" ? esc({dois: "2 anos auditados", um: "1 ano auditado", nenhum: "sem auditoria"}[it.v]) : it.k === "hist" ? esc({limpo: "sem atrasos", pontual: "atrasos pontuais", reneg: "renegociou"}[it.v]) : it.k === "conc" ? pct(it.v, 0) : it.k === "escala" ? "R$ " + fmt(it.v, 0) + " mi" : xx(it.v)}</td><td class="r">${fmt(it.s, 0)}</td><td class="r">${nIn(`rating.pesos.${it.k}`, it.w, "int", "s")}</td></tr>`).join("")}</tbody></table>
    <details><summary class="small">Escala: nota mínima e chance de calote de cada nota</summary><table class="tight"><tbody>${A.rating.escala.map((g, i) => `<tr><td>${esc(g.nota)}</td><td class="r">a partir de ${nIn(`rating.escala.${i}.min`, g.min, "int", "s")} pontos</td><td class="r">${nIn(`rating.escala.${i}.pd`, g.pd, "pct", "s")}</td></tr>`).join("")}</tbody></table>
      <p class="small muted">Tabela de exemplo da ferramenta. Troque pela escala mestra da sua casa. A provisão por perda esperada da Resolução CMN 4.966 obriga bancos a manter essa relação entre nota e chance de calote.</p></details>
    <div class="lbl">Chance de calote ponderada pelos cenários</div>
    <table class="tight"><thead><tr><th>Cenário</th><th class="r">Chance</th><th class="r">Nota se acontecer</th><th class="r">Chance de calote se acontecer</th><th class="r">Acréscimo</th></tr></thead><tbody>
      <tr><td>Caso base</td><td></td><td class="r">${b.nota}</td><td class="r">${pct(b.pd, 2)}</td><td class="r">${pct(b.pd, 2)}</td></tr>
      ${pb.scs.map(s => `<tr><td>${esc(s.sc.nome)}</td><td class="r">${pct(s.p, 0)}</td><td class="r">${s.r.nota}</td><td class="r">${pct(s.r.pd, 2)}</td><td class="r">${pct(s.add, 2)}</td></tr>`).join("")}
      <tr class="tot"><td>Chance de calote usada no preço</td><td></td><td></td><td></td><td class="r">${pct(pb.pd, 2)}</td></tr></tbody></table>
    ${eq([`${v_("Probability of Default")} = ${v_("PD")}<sub>base</sub> + Σ ${v_("p")}<sub>i</sub> × (${v_("PD")}<sub>i</sub> − ${v_("PD")}<sub>base</sub>)`], "chance de calote = a do caso base + para cada cenário, a sua chance × quanto ele aumenta a chance de calote se acontecer. Um cenário que não piora a nota não acrescenta nada.")}`;
  return `<div class="cols2b"><div class="stack">${box("Spread mínimo: de onde vem cada pedaço", build)}${box("Spread conforme a estrutura de garantias", alts)}${paresBox(x)}</div><div class="stack">${box("Rating interno", rat)}${bancosBox(x)}${covParesBox(x)}${noticiasBox(x)}</div></div>`;
}
function paresBox(x) {
  const A = x.A, OF = x.OF, D = OF.anbima.deb, sel = A.pares.map(c => D.find(d => d.c === c)).filter(Boolean);
  const q = (S.parq || "").toLowerCase(), hits = q.length >= 2 ? D.filter(d => d.n.toLowerCase().includes(q) || d.c.toLowerCase().includes(q)).slice(0, 12) : [];
  const adj = d => { const a = A.parAj[d.c] || {}; return d.t / 100 + (a.porte || 0) + (a.gar || 0) + (a.prazo || 0); };
  const vals = sel.map(adj), lo = Math.min(...vals), hi = Math.max(...vals), sp = A.op.spread, mn = x.pr.min, top = Math.max(hi || 0, sp, mn) * 1.15 || .06;
  return box("Debêntures de pares no mercado secundário", `<div class="row"><input class="tx" id="parq" value="${esc(S.parq)}" placeholder="Buscar emissor ou código (ANBIMA)" style="flex:1"><button class="b ai" data-act="sugpar" ${S.busy ? "disabled" : ""}>Claude: sugerir pares do setor</button>${busyLine("par")}${msgLine("par")}</div>
    ${hits.length ? `<div class="hits">${hits.map(d => `<button class="hit" data-act="addpar" data-c="${d.c}"><b>${esc(d.c)}</b> ${esc(d.n)} <span class="muted">DI + ${fmt(d.t, 2)}% · vence ${esc(d.v)}</span></button>`).join("")}</div>` : ""}
    ${S.sug.par ? `<div class="ans small">${esc(S.sug.par.porque)} <span class="chip o-claude">Claude</span></div>` : ""}
    ${sel.length ? `<div class="scroll"><table class="tight"><thead><tr><th>Emissor</th><th class="r">Taxa indicativa</th><th class="r">Prazo médio</th><th class="r">Ajuste porte</th><th class="r">Ajuste garantia</th><th class="r">Ajuste prazo</th><th class="r">Comparável</th><th></th></tr></thead><tbody>
      ${sel.map(d => `<tr><td><b>${esc(d.c)}</b> ${esc(d.n)}<span class="tr">vence ${esc(d.v)}${d.a ? " · marcada com (*) no arquivo da ANBIMA" : ""}</span>${tIn(`parAj.${d.c}.porque`, A.parAj[d.c]?.porque || "", "tx", "por que é par")}</td><td class="r">DI + ${fmt(d.t, 2)}%</td><td class="r">${nn(d.d) ? fmt(d.d / 252, 1) + " anos" : "–"}</td>
        ${["porte", "gar", "prazo"].map(k => `<td class="r">${nIn(`parAj.${d.c}.${k}`, A.parAj[d.c]?.[k] || 0, "pct", "s")}</td>`).join("")}<td class="r b">DI + ${pct(adj(d), 2)}</td><td><button class="link bad" data-act="delpar" data-c="${d.c}" aria-label="Remover">×</button></td></tr>`).join("")}</tbody></table></div>
      <div class="pos"><div class="pt"><i class="rng" style="left:${lo / top * 100}%;width:${(hi - lo) / top * 100}%"></i><i class="mk" style="left:${mn / top * 100}%;background:var(--bad)" title="mínimo"></i><i class="mk" style="left:${sp / top * 100}%;background:var(--accent)" title="proposto"></i></div>
        <div class="small muted"><span class="sw" style="background:var(--accent-soft)"></span>pares ajustados DI + ${pct(lo, 2)} a ${pct(hi, 2)} · <span class="sw" style="background:var(--bad)"></span>mínimo ${pct(mn, 2)} · <span class="sw" style="background:var(--accent)"></span>proposto ${pct(sp, 2)}</div></div>` : `<p class="small muted">Escolha emissores parecidos (mesmo setor, porte ou risco). Quem emite debênture costuma ser maior e mais transparente que uma empresa fechada: use os ajustes, em p.p., e escreva o motivo.</p>`}
    <p class="small muted">${chip(O("ofi", OF.anbima.fonte))} <a href="${OF.anbima.link}" target="_blank" rel="noopener">arquivo da ANBIMA</a> · ${fmt(D.length)} debêntures em DI + spread. Taxa indicativa = spread sobre o DI no mercado secundário. Prazo médio = duration em dias úteis ÷ 252.</p>`);
}
function bancosBox(x) {
  const OF = x.OF, mods = [["Capital de giro com prazo superior a 365 dias - Pós-fixado referenciado em juros flutuantes", "Capital de giro acima de 1 ano, pós-fixado"], ["Capital de giro com prazo superior a 365 dias - Prefixado", "Capital de giro acima de 1 ano, prefixado"], ["Desconto de duplicatas - Prefixado", "Desconto de duplicatas"]];
  const st = mods.map(([m, n]) => [n, bankStats(OF, m), m]);
  const p = OF.bancos.periodo.map(d => d.split("-").reverse().join("/"));
  const pos = st[0][1];
  return box("Taxas cobradas pelos bancos", `<table class="tight"><thead><tr><th>Modalidade, pessoa jurídica</th><th class="r">Bancos</th><th class="r">Taxa mediana</th><th class="r">Faixa do meio</th><th class="r">Spread mediano sobre o CDI</th></tr></thead><tbody>
    ${st.map(([n, s, m]) => `<tr><td>${esc(n)}</td><td class="r">${s.rows.length}</td><td class="r">${pct(s.med, 1)}</td><td class="r">${pct(s.q1, 1)} a ${pct(s.q3, 1)}</td><td class="r">${nn(s.smed) ? pct(s.smed, 2) : "–"}</td></tr>`).join("")}</tbody></table>
    <details><summary class="small">Taxa de cada banco: capital de giro pós-fixado acima de 1 ano</summary><table class="tight"><tbody>${pos.rows.map(r => `<tr><td>${esc(r.banco)}</td><td class="r">${pct(r.taxa, 2)}</td><td class="r">CDI + ${pct(r.spread, 2)}</td></tr>`).join("")}</tbody></table></details>
    ${eq([`${v_("Implied Spread")} = (1 + ${v_("Bank Rate")}) ÷ (1 + ${v_("CDI")}) − 1`], `spread implícito = taxa total do banco descontado o CDI de ${fmt(OF.cdi.valor, 2)}% (${OF.cdi.data}). É média de todos os clientes de cada banco, sem separar risco nem garantia: serve de régua, não de par.`)}
    <p class="small muted">${chip(O("ofi", OF.bancos.fonte))} período de ${p[0]} a ${p[1]}. <a href="${OF.bancos.link}" target="_blank" rel="noopener">Taxas de juros por instituição, Banco Central</a>.</p>`);
}
function covParesBox(x) {
  const A = x.A;
  return box("Covenants nas escrituras de pares", `<table class="tight"><thead><tr><th>Emissor</th><th>Covenant</th><th class="r">Limite</th><th>Documento (link)</th><th></th></tr></thead><tbody>
    ${A.covPares.map((c, i) => `<tr><td>${tIn(`covPares.${i}.emissor`, c.emissor)}</td><td>${tIn(`covPares.${i}.cov`, c.cov, "tx", "ex.: dívida líquida ÷ EBITDA")}</td><td>${tIn(`covPares.${i}.lim`, c.lim, "tx s", "≤ 3,0x")}</td><td>${tIn(`covPares.${i}.link`, c.link, "tx", "link da escritura")}</td><td><button class="link bad" data-act="delcp" data-i="${i}">×</button></td></tr>`).join("")}</tbody></table>
    <div class="row"><button class="b" data-act="addcp">+ covenant de par</button><a class="small" href="https://www.rad.cvm.gov.br/ENET/frmConsultaExternaCVM.aspx" target="_blank" rel="noopener">buscar escrituras no sistema da CVM</a></div>
    <p class="small muted">A escritura da debênture traz os covenants financeiros. Copie o limite e o link: assim cada número tem documento.</p>`);
}
function noticiasBox(x) {
  const A = x.A;
  return box("Notícias usadas", `${A.noticias.map((n, i) => `<div class="news"><div class="grid3">${tIn(`noticias.${i}.veiculo`, n.veiculo, "tx", "veículo")}${tIn(`noticias.${i}.data`, n.data, "tx", "data")}${tIn(`noticias.${i}.link`, n.link, "tx", "link")}</div>${tIn(`noticias.${i}.titulo`, n.titulo, "tx", "título")}${tIn(`noticias.${i}.uso`, n.uso, "tx", "como usei (ex.: chance do cenário X)")}<button class="link bad" data-act="delnot" data-i="${i}">remover</button></div>`).join("")}
    <button class="b" data-act="addnot">+ notícia</button><p class="small muted">A ferramenta não busca notícias. O Claude também não lê notícias ao vivo. Registre aqui veículo, data e link de cada notícia que mudou um número.</p>`);
}

// ---------- 7 · Parecer e exportar ----------
function risks(x) {
  const A = x.A, OF = x.OF, b = worst(x.cases.base, "dscr").dscr;
  return (A.cens || []).filter(s => s.ativo !== false).map(s => { const w = worst(runOnly(A, OF, s), "dscr"); return {s, d: b - w.dscr, ano: w.ano, v: w.dscr, imp: s.prob / 100 * (b - w.dscr)}; }).sort((a, z) => z.imp - a.imp);
}
function pendencias(x) {
  const A = x.A, out = [];
  let cl = 0, ex = 0; const walk = o => { if (!o || typeof o !== "object") return; if (o.t === "claude" && "f" in o) cl++; if (o.t === "ex" && "f" in o) ex++; Object.values(o).forEach(walk); }; walk(A);
  if (ex) out.push(`${ex} números ainda são da empresa fictícia de exemplo.`);
  if (cl) out.push(`${cl} números sugeridos pelo Claude ainda não foram trocados para outra origem.`);
  if (!A.pares.length) out.push("Nenhum par de mercado escolhido.");
  if (!(A.gar || []).length) out.push("Nenhuma garantia cadastrada.");
  if (!A.files.length) out.push("Nenhum arquivo de demonstração enviado.");
  if (A.emp.auditoria === "nenhum") out.push("Demonstrações sem auditoria: confirme com extratos e Registrato.");
  return out;
}
function origemCount(A) { const c = {}; const walk = o => { if (!o || typeof o !== "object") return; if (ORIG[o.t] && "f" in o) c[o.t] = (c[o.t] || 0) + 1; Object.values(o).forEach(walk); }; walk(A); return c; }
function tParecer() {
  const x = X(), A = x.A, pr = x.pr, e = x.cases.esperado, b = x.cases.base, R = risks(x);
  const REC = {aprovar: "Aprovar", condicoes: "Aprovar com condições", recusar: "Recusar"}, oc = origemCount(A);
  const head = `<div class="phead"><div><div class="eyebrow">Parecer de crédito</div><h2>${esc(A.emp.nome || "Empresa")}</h2><div class="muted">${esc(A.op.instrumento)} de R$ ${fmt(A.op.valor / 1000, 1)} mi · ${fmt(A.op.prazo)} meses · ${A.op.index === "PRE" ? "prefixado " + pct(A.op.taxaPre, 2) : A.op.index + " + " + pct(A.op.spread, 2)}</div></div>
    <div class="rbadge"><b class="${A.parecer.rec === "recusar" ? "bad" : A.parecer.rec === "condicoes" ? "warn-t" : "ok"}">${REC[A.parecer.rec]}</b><span>nota interna ${pr.pb.base.nota} · cobertura de garantias ${xx(x.col.cover)}</span></div></div>
    <div class="kpis">${kpi("Dívida líquida ÷ EBITDA, 1º ano", xx(b[0].lev))}${kpi("Cobertura do serviço, pior ano esperado", xx(worst(e, "dscr").dscr), String(worst(e, "dscr").ano))}${kpi("Perda esperada", pct(pr.EL, 2) + " a.a.")}${kpi("Spread proposto × mínimo", `${pct(pr.spread, 2)} × ${pct(pr.min, 2)}`, "", pr.folga >= 0 ? "ok" : "bad")}${kpi("Retorno ajustado ao risco", pct(pr.raroc, 1), `meta ${pct(A.preco.roe, 0)}`)}</div>`;
  const body = `<div class="cols2"><div><h3>Riscos principais</h3><ol class="small">${R.slice(0, 5).map(r => `<li><b>${esc(r.s.nome)}</b> (chance ${fmt(r.s.prob)}%): cobertura do serviço vai a ${xx(r.v)} em ${r.ano}.${r.s.mitigante ? " Mitigante: " + esc(r.s.mitigante) + "." : ""}</li>`).join("") || "<li>Sem cenários cadastrados.</li>"}</ol>
      <h3>Gatilhos para monitorar</h3><ul class="small">${R.slice(0, 5).filter(r => r.s.gatilho).map(r => `<li>${esc(r.s.gatilho)}</li>`).join("")}</ul></div>
    <div><h3>Recomendação</h3>${sel("parecer.rec", A.parecer.rec, REC)}<div class="lbl">Condições</div><textarea rows="4" data-b="parecer.condicoes" data-t="text" placeholder="ex.: trava de recebíveis em 40%; covenant de cobertura ≥ 1,20x">${esc(A.parecer.condicoes)}</textarea>
      <div class="lbl">Texto do parecer</div><textarea rows="9" data-b="parecer.texto" data-t="text" placeholder="Escreva ou peça um rascunho ao Claude">${esc(A.parecer.texto)}</textarea>
      <div class="row"><button class="b ai" data-act="parecer" ${S.busy ? "disabled" : ""}>Claude: escrever o rascunho</button>${busyLine("par2")}${msgLine("par2")}</div></div></div>
    <p class="small muted">Origem dos números: ${Object.entries(oc).map(([k, n]) => `${n} ${ORIG[k].nome.toLowerCase()}`).join(" · ")}. Valores nominais, sem desconto a valor presente (exceto a recuperação das garantias na perda se quebrar).</p>`;
  const pend = pendencias(x);
  const exp = `<div class="row"><button class="b pri" data-act="export" data-k="xlsx">Baixar Excel com fórmulas</button><button class="b" data-act="export" data-k="pdf">Baixar PDF</button><button class="b" data-act="export" data-k="json">Baixar a análise (.json)</button>${msgLine("exp")}</div>
    <p class="small muted">Excel: demonstrações com a origem de cada célula, premissas, juros, operação, garantias, árvores de cenários e projeção de cada caso com fórmulas vivas (azul = entrada, preto = fórmula, verde = vínculo com outra aba). PDF: este parecer, capacidade de pagamento, garantias, cenários e precificação.</p>`;
  return `<div class="cols2b"><div class="stack"><section class="box parecer">${head}${body}</section></div><div class="stack">${box("Exportar", exp)}${box("Pendências antes do comitê", pend.length ? pend.map(p => `<div class="chk warn">${esc(p)}</div>`).join("") : `<div class="chk ok">Nada pendente nas checagens automáticas.</div>`)}</div></div>`;
}

// ---------- Metodologia e fontes ----------
function tMetodo() {
  const OF = S.OF;
  const src = [[OF.copom.fonte, OF.copom.link, "decisões do Copom: última em " + OF.copom.past.at(-1).data.split("-").reverse().join("/")], [OF.focus.fonte, OF.focus.link, "Selic por reunião e IPCA anual"], [OF.ipca.fonte, OF.ipca.link, "IPCA mensal e de 12 meses"], [OF.cdi.fonte, OF.cdi.link, "CDI de " + OF.cdi.data],
    [OF.bancos.fonte, OF.bancos.link, "taxas de capital de giro e desconto de duplicatas por banco"], [OF.anbima.fonte, OF.anbima.link, fmt(OF.anbima.deb.length) + " debêntures em DI + spread"]];
  return `<div class="cols2"><div class="stack">${box("Como a ferramenta calcula", `<ol class="small">
    <li><b>Demonstrações.</b> Três anos fechados e dois balancetes parciais comparáveis. Os 12 meses somam o ano fechado + o parcial atual − o parcial do ano anterior. Saldos vêm da última data.</li>
    <li><b>Projeção.</b> ${NY} anos a partir dos 12 meses, ano a ano, em reais nominais. A operação desembolsa no início do 1º ano projetado e quita a dívida indicada.</li>
    <li><b>Juros.</b> CDI de cada ano a partir da Selic por reunião do Copom (realizado, Focus ou a sua premissa). Juros do ano = saldo médio × taxa.</li>
    <li><b>Capacidade de pagamento.</b> Caixa disponível = EBITDA − impostos − aumento do giro − capex − outras saídas. Cobertura = caixa disponível ÷ (juros + principal contratual). Uma segunda cobertura desconta o que é rolado.</li>
    <li><b>Cenários.</b> Cada cenário tem árvores (fator → linha), chance, formato no tempo e gatilho. Casos: base, moderado (× chance), estresse (inteiro) e esperado (pesos).</li>
    <li><b>Garantias.</b> Valor recuperável e perda se quebrar pela fórmula da aba 2, com desconto, encolhimento, custo e prazo de cada garantia.</li>
    <li><b>Rating.</b> Pontos por critério, pesos e escala editáveis. A chance de calote combina o caso base e cada cenário pela chance.</li>
    <li><b>Preço.</b> Spread mínimo = captação + perda esperada + custo do capital + custo operacional. Comparação com pares da ANBIMA e taxas dos bancos no Banco Central.</li></ol>`)}
    ${box("Valor presente ou nominal?", `<p class="small">Tudo é nominal: cada ano em reais daquele ano, sem desconto. Os impactos das árvores estão em reais do ano-base e não são corrigidos pela inflação; para manter o valor real, use "ajustar ano a ano" e suba o percentual. A única conta trazida a valor presente é a recuperação das garantias, porque receber em 18 meses vale menos que receber hoje.</p>`)}</div>
    <div class="stack">${box("Fontes oficiais desta versão", `<table class="tight"><tbody>${src.map(([f, l, d]) => `<tr><td><a href="${l}" target="_blank" rel="noopener">${esc(f)}</a><span class="tr">${esc(d)}</span></td></tr>`).join("")}</tbody></table>
      <p class="small muted">Os dados foram baixados quando a ferramenta foi publicada e ficam guardados com a data. Para atualizar, peça ao Claude uma nova versão com dados do dia.</p>`)}
    ${box("Sugestões do Claude", `<p class="small">Os botões "Claude" usam a sua conta do claude.ai, sem chave de API. Cada sugestão entra marcada "Claude" até você trocar a origem. O Claude não acessa a internet nem notícias ao vivo por estes botões: ele responde com o conhecimento dele até a data de corte.</p>`)}</div></div>`;
}
