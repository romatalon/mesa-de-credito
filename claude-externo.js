// =====================================================================
// Claude fora do claude.ai: modo copiar e colar
// O app monta o pedido; você cola no Claude (celular, outro aparelho) e cola a resposta de volta.
// Não usa chave de API: o gasto fica na sua própria conta do Claude.
// =====================================================================
"use strict";
(function () {
  if (window.claude && typeof window.claude.use === "function") return; // no claude.ai, nada muda
  let pend = null; // {resolve, reject, prompt, json}
  const JSON_TAIL = "\n\nResponda SOMENTE com o JSON pedido, sem texto antes ou depois e sem bloco de código.";
  const extractJSON = t => {
    const s = String(t || "").replace(/```(?:json)?/gi, "").trim();
    try { return JSON.parse(s); } catch (_) {}
    const a = Math.min(...["{", "["].map(c => s.indexOf(c)).filter(i => i >= 0));
    const b = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error("a resposta colada não tem JSON");
  };
  const modal = () => `<div class="modal" role="dialog" aria-modal="true" aria-label="Claude por copiar e colar"><div class="mbox">
    <h3>Pedir ao Claude por copiar e colar</h3>
    <p class="small"><b>1.</b> Copie o pedido abaixo e cole numa conversa nova do Claude (celular ou outro aparelho).</p>
    <textarea id="cpPrompt" rows="6" readonly>${esc(pend.prompt)}</textarea>
    <div class="row"><button class="b pri" data-act="cpcopiar">Copiar o pedido</button><span class="small muted" id="cpMsg"></span></div>
    <p class="small"><b>2.</b> Copie a resposta inteira do Claude e cole aqui.</p>
    <textarea id="cpResp" rows="6" placeholder="Cole aqui a resposta do Claude">${esc(S.cpResp || "")}</textarea>
    ${S.cpErr ? `<div class="chk bad">${esc(S.cpErr)}</div>` : ""}
    <div class="row"><button class="b pri" data-act="cpusar">Usar a resposta</button><button class="link" data-act="cpcancelar">cancelar</button></div></div></div>`;
  const ask = (prompt, opts, json) => new Promise((resolve, reject) => {
    pend = {resolve, reject, prompt: prompt + (json ? JSON_TAIL : ""), json};
    S.cpResp = ""; S.cpErr = ""; S.modal = modal; render();
    opts?.signal?.addEventListener("abort", () => { if (pend) { pend = null; S.modal = null; reject({code: "cancelled"}); } });
  });
  const sm = (prompt, opts) => ask(prompt, opts, false).then(text => ({text}));
  sm.json = (prompt, opts) => ask(prompt, opts, true);
  SMP = Promise.resolve(sm);
  document.addEventListener("input", ev => { if (ev.target.id === "cpResp") S.cpResp = ev.target.value; });
  Object.assign(ACTS, {
    cpcopiar: async () => { const m = $("#cpMsg"); try { await navigator.clipboard.writeText(pend.prompt); m.textContent = "Copiado."; } catch (_) { const t = $("#cpPrompt"); t.select(); document.execCommand("copy"); m.textContent = "Copiado (se não colar, selecione e copie à mão)."; } },
    cpusar: () => { if (!pend) return; const t = (S.cpResp || $("#cpResp").value || "").trim(); if (!t) { S.cpErr = "Cole a resposta do Claude primeiro."; render(); return; }
      let out; if (pend.json) { try { out = extractJSON(t); } catch (e) { S.cpErr = "Não consegui ler a resposta: " + e.message + ". Copie a resposta inteira do Claude."; render(); return; } } else out = t;
      const p = pend; pend = null; S.modal = null; S.cpResp = ""; p.resolve(out); },
    cpcancelar: () => { if (!pend) { S.modal = null; render(); return; } const p = pend; pend = null; S.modal = null; p.reject({code: "cancelled"}); },
  });
})();
