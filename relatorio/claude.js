// =====================================================================
// Pedidos ao Claude, pela conta de quem usa a página (sem chave de API).
// Cada pedido só sai num clique. O Claude recebe apenas o que está aqui.
// =====================================================================
"use strict";
const capUse = n => (window.claude && typeof window.claude.use === "function") ? window.claude.use(n).catch(() => null) : Promise.resolve(null);
let SMP, DBP, DLP;
const getSM = () => SMP ||= capUse("sample"), getDB = () => DBP ||= capUse("db"), getDL = () => DLP ||= capUse("downloads");
let CTRL = null;

const ERR = {not_granted: "Você não autorizou o uso do Claude nesta página.", rate_limited: "Muitos pedidos seguidos. Espere um pouco e tente de novo.", cancelled: "Pedido interrompido.", unavailable: "O Claude não está disponível nesta visualização."};
const errTxt = e => ERR[e?.code] || ("O pedido não deu certo" + (e?.message ? ": " + e.message : "."));

async function ask(key, prompt, label) {
  const sm = await getSM();
  if (!sm) { S.msg[key] = {t: "Pedidos ao Claude só funcionam com a página aberta no claude.ai.", bad: true}; render(); return null; }
  CTRL = new AbortController(); S.busy = key; S.busyTxt = label || "Pensando…"; render();
  const t0 = Date.now(), tick = setInterval(() => { const el = document.querySelector("[data-busy]"); if (el) el.textContent = `${S.busyTxt} ${Math.round((Date.now() - t0) / 1000)} s`; }, 1000);
  try {
    return await sm.json(prompt, {signal: CTRL.signal, modelTier: S.tier === "cuidadoso" ? "default" : "quick", cache: false,
      onText: ({text}) => { S.busyTxt = `${label ? label.replace("…", "") : "Escrevendo"}: ${Math.round(text.length / 5)} palavras recebidas`; }});
  }
  catch (e) { S.msg[key] = {t: errTxt(e), bad: e?.code !== "cancelled"}; return null; }
  finally { clearInterval(tick); S.busy = null; CTRL = null; render(); }
}

// Resumo numérico da companhia para os pedidos
function ctxDados() {
  const x = X(), co = S.co, L = co.periodos.length - 1, F = co.F, R = co.R;
  const linha = (n, arr, f) => `${n}: ` + co.periodos.map((p, i) => `${p} ${f(arr?.[i])}`).join("; ");
  const m = v => nn(v) ? v.toFixed(0) : "n/d", r = v => nn(v) ? v.toFixed(2) : "n/d";
  const casos = Object.keys(CASOS).map(c => `${CASOS[c]}: ` + x.cases[c].map(y => `${y.ano} alavancagem ${r(y.lev)}x, cobertura ${r(y.icr)}x`).join("; ")).join("\n");
  const cens = (S.A.cens || []).filter(s => s.ativo).map(s => descCen(s)).join("\n") || "nenhum";
  const anex = (S.A.anexos || []).filter(a => a.resumo).map(a => `- ${a.nome} (${a.data || "sem data"}): ${a.resumo}`).join("\n") || "nenhum";
  const coms = (S.A.coms || []).map(c => `- ${c.txt}`).join("\n") || "nenhum";
  return `Companhia: ${co.nome} (${co.comercial}), setor ${co.setor}. Valores em R$ milhões, demonstrações consolidadas entregues à CVM; última coluna = últimos 12 meses até ${co.q?.ref || "3T26"}.
${linha("Receita líquida", F.receita, m)}
${linha("Lucro antes de juros, impostos, depreciação e amortização", F.ebitda, m)}
${linha("Lucro líquido", F.lucro, m)}
${linha("Despesa financeira", F.desp_fin, m)}
${linha("Caixa", F.caixa_total, m)}
${linha("Dívida bruta", F.div_bruta, m)}
${linha("Dívida de curto prazo", F.div_cp, m)}
${linha("Dívida líquida", F.div_liq, m)}
${linha("Caixa das operações", F.fco, m)}
${linha("Alavancagem (dívida líquida / EBITDA)", R.dl_ebitda, r)}
${linha("Cobertura de juros (EBITDA / despesa financeira)", R.ebitda_desp, r)}
${linha("Caixa / dívida de curto prazo", R.caixa_divcp, r)}
Projeção de ${NP} anos (premissas do analista):
${casos}
Cenários marcados:
${cens}
Anexos lidos:
${anex}
Comentários do analista:
${coms}`;
}
// Texto do Claude sem formatação de markdown (asteriscos, cerquilhas, crases)
const limpa = t => String(t ?? "").replace(/\*\*|__|`/g, "").replace(/^\s*#+\s*/gm, "").replace(/^\s*[-*]\s+/gm, "").trim();
// Descrição completa de um cenário: impactos, rampa e efeito projetado (o que a árvore mostra)
function descCen(s) {
  const x = X(), b = x.cases.base, o = runOnly(S.co, S.A.P, S.A.cens, s), r = ramp(s);
  const imps = impLinhas(s).filter(k => +s.imp?.[k]).map(k => `${IMP[k].pt} ${impFmt(k, +s.imp[k])} (${IMP[k].unid})${s.notas?.[k] ? " porque " + s.notas[k] : ""}`).join("; ") || "sem impacto numérico";
  const ef = o.map((y, t) => `${y.ano}: EBITDA ${b[t].ebitda.toFixed(0)} → ${y.ebitda.toFixed(0)}, caixa ${b[t].cash.toFixed(0)} → ${y.cash.toFixed(0)}, dívida líquida ${b[t].nd.toFixed(0)} → ${y.nd.toFixed(0)}, alavancagem ${nn(b[t].lev) ? b[t].lev.toFixed(2) : "n/d"}x → ${nn(y.lev) ? y.lev.toFixed(2) : "n/d"}x`).join("; ");
  return `- ${s.nome} (${CTX[s.cat]?.nome || s.cat}, ${s.tipo}, chance ${s.chance}%${s.ativo ? "" : ", desmarcado"}). O que muda: ${s.driver || "-"}. Por que essa chance: ${s.porque || "-"}. Impactos anuais se acontecer: ${imps}. Rampa (parte do impacto por ano): ${r.map(v => Math.round(v * 100) + "%").join(", ")}. Efeito projetado se acontecer inteiro, contra o caso base (R$ milhões): ${ef}.`;
}
// Linhas de impacto que o Claude pode usar, com unidade e sinal
const impPrompt = () => Object.entries(IMP).map(([k, m]) => `${k} (${m.pt}; ${m.unid}; exemplo ${m.ex})`).join("; ");
const IMP_FMT = '"impactos":[{"linha":"","valor":0,"porque":""}]';
function lerImps(arr) {
  const imp = {}, linhas = [], notas = {};
  (Array.isArray(arr) ? arr : []).forEach(i => { const k = i?.linha; if (!IMP[k] || !nn(+i.valor) || !+i.valor) return; imp[k] = +i.valor; if (!linhas.includes(k)) linhas.push(k); if (i.porque) notas[k] = limpa(i.porque); });
  return {imp, linhas, notas};
}
const novaSug = (c, o, extra = {}) => ({id: uid(), cat: CTX[c.categoria] ? c.categoria : "gen", nome: limpa(c.nome), tipo: c.tipo === "oportunidade" ? "oportunidade" : "risco", driver: limpa(c.driver), chance: clamp(+c.chance || 0, 0, 100), porque: limpa(c.porque), forma: FORMAS[c.forma] ? c.forma : "imediato", ...lerImps(c.impactos), o, ativo: true, ...extra});
const REGRAS = `Regras: escreva texto puro, sem markdown: nada de asteriscos, negrito, cerquilhas ou listas. Escreva em português do Brasil, em tom de research de crédito, frases curtas e diretas. Use só os números fornecidos; não invente números, datas, notícias, ratings ou fatos que não estejam no texto. Se precisar de algo que não está aqui, diga o que falta. Não use siglas em português; escreva nomes completos (pode usar EBITDA). Responda só com JSON válido, sem texto fora do JSON.`;

async function claudeCenarios() {
  const out = await ask("cen", `Você ajuda um analista de crédito a levantar riscos e oportunidades para a companhia abaixo, com impacto nos resultados e nos ratios de crédito.
${ctxDados()}

Sugira de 6 a 10 cenários, com pelo menos 2 oportunidades (coisas que melhorariam o crédito), cobrindo mercado e setor, regulação, impostos, câmbio, estrutura da dívida, inflação e juros e fatores genéricos. Não repita cenários já marcados.
Para cada um, dê: categoria (uma de: macro, merc, jur, fisc, div, gen), nome curto, tipo ("risco" ou "oportunidade"), driver (o que muda, ex.: "Volume exportado para a China −25%"), chance em % de acontecer nos próximos 12 a 24 meses (inteiro de 0 a 100), porque (1 ou 2 frases explicando a chance e o mecanismo, sem inventar fatos), forma (uma de: imediato, gradual, umano, recupera, tardio) e impactos anuais quando acontecer, só nas linhas que o cenário afeta, cada uma com valor e porquê. Linhas possíveis: ${impPrompt()}.
${REGRAS}
Formato: {"cenarios":[{"categoria":"","nome":"","tipo":"","driver":"","chance":0,"porque":"","forma":"",${IMP_FMT}}]}`, "Levantando riscos e oportunidades…");
  if (!out?.cenarios) return;
  S.A.sug.cens = out.cenarios.map(c => novaSug(c, {t: "claude", f: "Sugerido pelo Claude a partir dos números da companhia, dos anexos e dos comentários."}));
  S.msg.cen = {t: `${S.A.sug.cens.length} sugestões. Aceite as que fizerem sentido; a chance e os impactos ficam editáveis.`}; changed();
}

async function claudeCaixas(ctxs) {
  const lista = ctxs.map(k => `${k} = ${CTX[k].nome} (${CTX[k].txt})`).join("; ");
  const out = await ask("cx", `Você escreve a análise de um relatório de crédito no estilo "atualização de resultados" de research de renda fixa: blocos curtos com subtítulo em negrito, cada um abrindo com o número, explicando a variação e fechando com a leitura de crédito.
${ctxDados()}

Escreva caixas para estes contextos: ${lista}. De 1 a 3 caixas por contexto, cada uma com 2 a 5 frases. Inclua o impacto dos cenários marcados onde couber, citando a alavancagem projetada dos casos.
${REGRAS}
Formato: {"caixas":[{"contexto":"","titulo":"","texto":""}]}`, "Escrevendo a análise…");
  if (!out?.caixas) return;
  out.caixas.forEach(c => { if (!CTX[c.contexto]) return; S.A.cx.push({id: uid(), ctx: c.contexto, titulo: limpa(c.titulo), texto: limpa(c.texto), marca: "sim", o: {t: "claude", f: "Texto escrito pelo Claude sobre os números da análise."}, alt: {}}); });
  S.msg.cx = {t: `${out.caixas.length} caixas novas. Marque cada uma: não incluir, incluir assim, amenizar ou dar ênfase.`}; changed();
}

async function claudeReescrever(cx, modo) {
  const pedido = modo === "ameniza" ? "Reescreva com tom mais neutro e cauteloso, sem mudar os fatos nem os números, e sem esconder o risco." : "Reescreva dando ênfase ao ponto principal: frase de abertura forte e direta, sem exagerar nem mudar os fatos e números.";
  const out = await ask("rw_" + cx.id, `Texto de um relatório de crédito sobre ${S.co.nome}:
Título: ${cx.titulo}
Texto: ${cx.texto}

${pedido} Mantenha o tamanho parecido.
${REGRAS}
Formato: {"titulo":"","texto":""}`, "Reescrevendo…");
  if (!out?.texto) return;
  cx.alt[modo] = {titulo: limpa(out.titulo || cx.titulo), texto: limpa(out.texto)}; changed();
}

async function claudeTese() {
  const incl = (S.A.cx || []).filter(c => c.marca !== "nao").map(c => `[${CTX[c.ctx].nome}${c.marca === "enfase" ? ", DAR ÊNFASE" : c.marca === "ameniza" ? ", tom ameno" : ""}] ${txtCx(c).titulo}: ${txtCx(c).texto}`).join("\n");
  const out = await ask("tese", `Escreva a tese de abertura (caixa cinza no topo) de um relatório de crédito de ${S.co.nome}: um parágrafo de 4 a 6 frases que comece com o veredito do trimestre (por exemplo resultado neutro, misto ou pressionado), cite resultado, geração de caixa e alavancagem, e feche com a leitura de crédito. Dê mais peso aos pontos marcados como DAR ÊNFASE e trate com cautela os de tom ameno.
${ctxDados()}

Caixas incluídas no relatório:
${incl || "nenhuma ainda"}
${REGRAS}
Formato: {"tese":""}`, "Escrevendo a tese…");
  if (!out?.tese) return;
  S.A.tese = {txt: limpa(out.tese), o: {t: "claude", f: "Tese escrita pelo Claude a partir das caixas incluídas."}}; changed();
}

// Texto de um link: a página do relatório não pode abrir outros sites (regra de segurança do claude.ai),
// e o Claude chamado pela página não navega. Quem abre o site é o navegador do app Claude no Mac.
async function buscarLink(a) {
  const mcp = await capUse("mcp");
  if (!mcp) { S.msg.anx = {t: "Para buscar o texto sozinho, abra este relatório no app Claude do Mac. No navegador comum, cole o texto da notícia no campo do anexo.", bad: true}; render(); return false; }
  S.busy = "anx_" + a.id; S.busyTxt = "Abrindo a página no navegador do app…"; render();
  try {
    const r1 = await mcp.callTool("host:claude_browser", "preview_start", {url: a.link});
    const t1 = JSON.stringify(r1?.payload ?? r1?.content ?? r1), tab = (t1.match(/tabId[\\"\s:]+([\w-]+)/) || [])[1];
    S.busyTxt = "Lendo o texto da página…"; render();
    const r2 = await mcp.callTool("host:claude_browser", "get_page_text", tab ? {tabId: tab, max_chars: 60000} : {max_chars: 60000});
    const txt = typeof r2?.payload === "string" ? r2.payload : (r2?.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
    if (!txt || txt.replace(/\s/g, "").length < 200) throw {message: "a página veio quase sem texto (pode pedir login ou bloquear leitura)"};
    a.texto = txt; a.buscado = new Date().toISOString(); return true;
  } catch (e) {
    S.msg.anx = {t: e?.code === "server_not_connected" || e?.code === "unavailable" ? "O navegador do app Claude não respondeu. Abra o relatório no app Claude do Mac, ou cole o texto da notícia no campo do anexo." : e?.code === "not_granted" || e?.code === "declined" ? "Leitura do site não autorizada. Cole o texto da notícia no campo do anexo." : "Não consegui ler a página: " + (e?.message || e?.code || "erro") + ". Cole o texto no campo do anexo.", bad: true};
    return false;
  } finally { S.busy = null; render(); }
}

async function claudeAnexo(a) {
  if (a.tipo === "link" && (a.texto || "").replace(/\s/g, "").length < 300) { const ok = await lerMateria(a); if (!ok && !(a.resumo0 || "").length) return; if (!ok) a.texto = (a.texto || "") + "\n" + a.resumo0; }
  const txt = (FTEXT[a.id] || a.texto || a.resumo0 || "").slice(0, 60000);
  if (txt.replace(/\s/g, "").length < 40) { S.msg.anx = {t: `${a.nome}: não há texto para ler. Para links, cole o texto da página no campo do anexo.`, bad: true}; render(); return; }
  const out = await ask("anx_" + a.id, `Um analista de crédito anexou este material sobre ${S.co.nome} (${a.tipo}). Leia e devolva o que serve para a análise de crédito.
Material "${a.nome}":
<<<
${txt}
>>>

Devolva: resumo (2 a 3 frases), data do material se aparecer, números relevantes que aparecem no texto (nome, valor, unidade, página ou trecho onde aparece), sugestões de cenário (categoria uma de macro, merc, jur, fisc, div, gen; forma uma de imediato, gradual, umano, recupera, tardio; impactos só nas linhas afetadas, cada um com valor e porquê; linhas possíveis: ${impPrompt()}) e sugestões de caixa de texto (contexto uma de macro, merc, jur, fisc, fin, gen). Só o que estiver no material.
${REGRAS}
Formato: {"resumo":"","data":"","numeros":[{"nome":"","valor":"","unidade":"","onde":""}],"cenarios":[{"categoria":"","nome":"","tipo":"","driver":"","chance":0,"porque":"","forma":"",${IMP_FMT}}],"caixas":[{"contexto":"","titulo":"","texto":""}]}`, "Lendo o anexo…");
  if (!out) return;
  a.resumo = limpa(out.resumo); a.data = out.data || a.data || ""; a.numeros = out.numeros || []; a.lido = new Date().toISOString();
  const fonte = `Sugerido pelo Claude a partir do anexo "${a.nome}".`;
  (out.cenarios || []).forEach(c => S.A.sug.cens.push(novaSug(c, {t: "claude", f: fonte}, {anexo: a.id})));
  (out.caixas || []).forEach(c => { if (CTX[c.contexto]) S.A.sug.cx.push({id: uid(), anexo: a.id, ctx: c.contexto, titulo: limpa(c.titulo), texto: limpa(c.texto), marca: "sim", o: {t: "claude", f: fonte}, alt: {}}); });
  a.gerou = {cens: (out.cenarios || []).length, cx: (out.caixas || []).length, nums: (out.numeros || []).length};
  S.msg.anx = {t: `${a.nome}: ${a.gerou.cens} cenários e ${a.gerou.cx} caixas sugeridos. Eles aparecem nas abas Cenários e Análise para aceitar ou descartar.`}; changed();
}

async function claudeComentario(c) {
  const [tp, tid] = String(c.alvo || "").split(":");
  let alvo = "";
  if (tp === "cen") { const sc = S.A.cens.find(x => x.id === tid); if (sc) alvo = "Cenário a que o comentário está preso, com todos os números:\n" + descCen(sc); }
  if (tp === "cx") { const cx = S.A.cx.find(x => x.id === tid); if (cx) alvo = `Caixa de texto a que o comentário está preso (${CTX[cx.ctx].nome}): ${txtCx(cx).titulo}: ${txtCx(cx).texto}`; }
  if (tp === "num") { const r = RBY[tid], x = X(); if (r) alvo = `Número a que o comentário está preso: ${r.pt}. Valores: ` + linha(x, r).map(k => `${k.lab} ${k.v == null ? "n/d" : (+k.v).toFixed(2)}`).join("; ") + "."; }
  const hist = (c.resps || []).map(r => `Resposta anterior do Claude: ${r.txt}`).join("\n");
  const out = await ask("com_" + c.id, `Um analista de crédito deixou este comentário na análise de ${S.co.nome}: "${c.txt}" (preso a: ${alvoNome(c.alvo)}).
${alvo}
${hist}
${ctxDados()}

Responda ao comentário em 2 a 4 frases, com base só nos números acima. Se não der para responder com esses dados, diga o que falta.
${REGRAS}
Formato: {"resposta":""}`, "Pensando no comentário…");
  if (!out?.resposta) return;
  c.resps = c.resps || []; c.resps.push({quem: "Claude", txt: limpa(out.resposta), em: new Date().toISOString(), o: {t: "claude"}}); changed();
}


// ---------- Notícias: busca no Bing Notícias pelo navegador do app Claude do Mac ----------
// A página não pode abrir sites (regra do claude.ai) e o Claude chamado por ela não navega.
// Quem busca é o navegador do app; o Claude depois lê só as notícias que você escolher.
const decod = s => String(s || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/<[^>]+>/g, "").trim();
async function navTexto(url) {
  const mcp = await capUse("mcp");
  if (!mcp) throw {code: "sem_app"};
  const r1 = await mcp.callTool("host:claude_browser", "preview_start", {url});
  const t1 = JSON.stringify(r1?.payload ?? r1?.content ?? r1), tab = (t1.match(/tabId[\\"\s:]+([\w-]+)/) || [])[1];
  const r2 = await mcp.callTool("host:claude_browser", "get_page_text", tab ? {tabId: tab, max_chars: 80000} : {max_chars: 80000});
  return typeof r2?.payload === "string" ? r2.payload : (r2?.content || []).filter(c => c.type === "text").map(c => c.text).join("\n");
}
const navErro = e => e?.code === "sem_app" ? "A busca usa o navegador do app Claude do Mac: abra este relatório pelo app Claude no Mac (não pelo navegador comum)." :
  e?.code === "server_not_connected" || e?.code === "unavailable" ? "O navegador do app Claude não respondeu (código " + e.code + "). Confira se o relatório está aberto no app Claude do Mac." :
  e?.code === "not_granted" || e?.code === "declined" || e?.code === "denied" ? "Acesso ao navegador do app não autorizado nesta página." : "A busca falhou: " + (e?.message || e?.code || "erro") + ".";
async function buscarNoticias(q) {
  S.busy = "news"; S.busyTxt = "Buscando notícias…"; S.news = null; render();
  try {
    const url = "https://www.bing.com/news/search?format=rss&setlang=pt-BR&cc=BR&q=" + encodeURIComponent(q);
    const txt = await navTexto(url);
    const items = [...txt.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => { const b = m[1], tag = t => decod((b.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1]);
      let link = tag("link"); const u = (link.match(/[?&]url=([^&]+)/) || [])[1]; if (u) try { link = decodeURIComponent(u); } catch (_) {}
      const d = new Date(tag("pubDate")); return {id: uid(), titulo: tag("title"), link, resumo: tag("description"), fonte: tag("News:Source"), data: isNaN(d) ? "" : d.toLocaleDateString("pt-BR"), sel: false}; }).filter(i => i.titulo);
    S.news = {q, items, em: new Date().toISOString()};
    S.msg.news = items.length ? {t: `${items.length} notícias encontradas no Bing Notícias. Marque as que servem e clique em Usar.`} : {t: "Nenhuma notícia encontrada; tente outro termo.", bad: true};
  } catch (e) { S.msg.news = {t: navErro(e), bad: true}; }
  finally { S.busy = null; render(); }
}
async function lerMateria(a) {
  S.busy = "anx_" + a.id; S.busyTxt = "Abrindo a matéria…"; render();
  try { const t = await navTexto(a.link); if (!t || t.replace(/\s/g, "").length < 300) throw {message: "a página veio quase sem texto (pode exigir assinatura)"}; a.texto = t.slice(0, 60000); a.buscado = new Date().toISOString(); return true; }
  catch (e) { S.msg.anx = {t: navErro(e) + " Você pode colar o texto da matéria no campo do anexo.", bad: true}; return false; }
  finally { S.busy = null; render(); }
}


// ---------- Montar ou melhorar um cenário junto com o Claude ----------
async function claudeMontar(desc, base) {
  const atual = base ? `Cenário atual a melhorar:\n${descCen(base)}\n` : "";
  const out = await ask("mont", `Você ajuda um analista de crédito a montar um cenário para ${S.co.nome}. ${base ? "Melhore o cenário atual" : "Transforme o pedido do analista em um cenário"}: nome claro, texto do que muda (driver), chance de acontecer em 12 a 24 meses com o porquê, rampa e impactos anuais quando acontecer, só nas linhas que o cenário realmente afeta, com o raciocínio de cada número a partir dos dados da companhia (por exemplo: receita de exportação de X% vezes queda de Y% de preço = Z% da receita).
Pedido do analista: ${desc || "(sem pedido extra; revise coerência, sinais e tamanho dos impactos)"}
${atual}
${ctxDados()}

Linhas possíveis (use o código da linha, a unidade e o sinal indicados): ${impPrompt()}.
Categoria uma de macro, merc, jur, fisc, div, gen. Forma uma de imediato, gradual, umano, recupera, tardio.
${REGRAS}
Formato: {"categoria":"","nome":"","tipo":"risco ou oportunidade","driver":"","chance":0,"porque":"","forma":"",${IMP_FMT},"comentario":"uma frase sobre o que você mudou ou supôs"}`, base ? "Melhorando o cenário…" : "Montando o cenário…");
  if (!out?.nome) return;
  const sg = novaSug(out, {t: "claude", f: base ? "Cenário revisado pelo Claude a pedido do analista." : `Montado pelo Claude a partir do pedido: "${desc}".`}, base ? {substitui: base.id} : {});
  S.A.sug.cens.unshift(sg);
  S.msg.mont = {t: (limpa(out.comentario) || "Proposta pronta.") + " Confira abaixo e clique em " + (base ? "Trocar" : "Aceitar") + "."}; changed();
}


// ---------- Ajustes à dívida e ao EBITDA lidos dos anexos ----------
async function claudeAjustes() {
  const tx = (S.A.anexos || []).map(a => ({a, t: FTEXT[a.id] || a.texto || ""})).filter(x => x.t.replace(/\s/g, "").length > 200);
  if (!tx.length) { S.msg.aj = {t: "Anexe o release de resultados ou as notas do ITR (aba Anexos) para o Claude achar os ajustes.", bad: true}; render(); return; }
  const m = metricasAj(S.co, S.A), mat = tx.map(x => `Material "${x.a.nome}":\n<<<\n${x.t.slice(0, 40000)}\n>>>`).join("\n\n").slice(0, 90000);
  const out = await ask("aj", `Um analista de crédito quer chegar à dívida líquida ajustada e ao EBITDA ajustado de ${S.co.nome}, como fazem os relatórios de research e as cláusulas de covenant. Hoje o app usa só empréstimos, financiamentos e debêntures do balanço: dívida bruta ${mi(m.db)}, caixa ${mi(m.cx)}, dívida líquida ${mi(m.dl)} e EBITDA dos últimos 12 meses ${mi(m.eb)}, em milhões de ${S.co.moeda || "R$"}.
${mat}

Liste os ajustes que aparecem no material, cada um com o valor em milhões de ${S.co.moeda || "R$"} na mesma data do balanço: itens que somam à dívida (arrendamentos, cartas de crédito de fornecedores, risco sacado, derivativos passivos, dívida de controlada, crédito comercial com parte relacionada), itens que somam ou tiram caixa, e itens não recorrentes do EBITDA dos últimos 12 meses (negativo tira ganho, positivo soma despesa). Se o material informar a dívida líquida ajustada ou a alavancagem da própria companhia, diga em "referencia". Converta dólares para reais pela taxa citada no material quando for o caso e diga isso na fonte.
${REGRAS}
Formato: {"ajustes":[{"tipo":"divida ou caixa ou ebitda","nome":"","valor":0,"fonte":"documento e página ou trecho"}],"referencia":""}`, "Procurando ajustes nos anexos…");
  if (!out?.ajustes) return;
  S.A.sugAj = out.ajustes.filter(a => AJ_TIPOS[a.tipo] && nn(+a.valor) && +a.valor).map(a => ({id: uid(), tipo: a.tipo, nome: limpa(a.nome), valor: +a.valor, fonte: limpa(a.fonte), ativo: true, o: {t: "claude", f: "Lido pelo Claude no anexo: " + limpa(a.fonte)}}));
  S.msg.aj = {t: `${S.A.sugAj.length} ajustes sugeridos.${out.referencia ? " Referência no material: " + limpa(out.referencia) : ""}`}; changed();
}

// ---------- Indicadores operacionais lidos dos anexos ----------
async function claudeOps() {
  const tx = (S.A.anexos || []).map(a => ({a, t: FTEXT[a.id] || a.texto || ""})).filter(x => x.t.replace(/\s/g, "").length > 200);
  if (!tx.length) { S.msg.ops = {t: "Anexe o release de resultados (aba Anexos) para o Claude montar a tabela.", bad: true}; render(); return; }
  const mat = tx.map(x => `Material "${x.a.nome}":\n<<<\n${x.t.slice(0, 40000)}\n>>>`).join("\n\n").slice(0, 90000);
  const out = await ask("ops", `Monte a tabela de indicadores operacionais de ${S.co.nome} para um relatório de crédito, como a "Figura de indicadores operacionais" dos relatórios de research: de 5 a 10 indicadores que mais explicam o resultado do setor (volumes vendidos, preços médios, taxa de utilização, spreads, frota, abates etc.), nas colunas do trimestre atual, do mesmo trimestre do ano anterior e, se houver, do trimestre anterior e do acumulado do ano. Copie os valores exatamente como estão no material, com a unidade, e diga a página ou o trecho.
${mat}
${REGRAS}
Formato: {"colunas":["3T25","3T26"],"linhas":[{"nome":"","unidade":"","valores":["",""],"fonte":""}]}`, "Montando os indicadores operacionais…");
  if (!out?.linhas?.length) return;
  const cols = (out.colunas || []).map(limpa);
  S.A.ops = {cols, rows: out.linhas.map(l => ({nome: limpa(l.nome), unid: limpa(l.unidade), vals: cols.map((_, j) => l.valores?.[j] ?? null), fonte: limpa(l.fonte), ativo: true})), em: new Date().toISOString()};
  S.msg.ops = {t: `${S.A.ops.rows.length} indicadores. Confira cada número no documento antes de exportar.`}; changed();
}
