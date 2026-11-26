// =====================================================================
// Fora do claude.ai (GitHub Pages): Claude por copiar e colar e
// download pelo navegador. Sem chave de API: o gasto fica na sua conta.
// No claude.ai este arquivo não muda nada.
// =====================================================================
"use strict";
(function () {
  if (window.claude && typeof window.claude.use === "function") return;
  let pend = null; // {resolve, reject, prompt}
  const JSON_TAIL = "\n\nResponda SOMENTE com o JSON pedido, sem texto antes ou depois e sem bloco de código.";
  const extractJSON = t => {
    const s = String(t || "").replace(/```(?:json)?/gi, "").trim();
    try { return JSON.parse(s); } catch (_) {}
    const ii = ["{", "["].map(c => s.indexOf(c)).filter(i => i >= 0), a = ii.length ? Math.min(...ii) : -1;
    const b = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error("a resposta colada não tem JSON");
  };
  const show = (erro, resp) => modal(`<h2>Pedir ao Claude por copiar e colar</h2>
    <p class="small"><b>1.</b> Copie o pedido abaixo e cole numa conversa nova do Claude (celular ou outro aparelho).</p>
    <textarea class="tx" id="cpPrompt" rows="7" readonly>${esc(pend.prompt)}</textarea>
    <div class="row"><button class="b pri" data-cp="copiar">Copiar o pedido</button><span class="small muted" id="cpMsg"></span></div>
    <p class="small"><b>2.</b> Copie a resposta inteira do Claude e cole aqui.</p>
    <textarea class="tx" id="cpResp" rows="7" placeholder="Cole aqui a resposta do Claude">${esc(resp || "")}</textarea>
    ${erro ? `<div class="small bad">${esc(erro)}</div>` : ""}
    <div class="row"><button class="b pri" data-cp="usar">Usar a resposta</button><button class="link" data-cp="cancelar">cancelar</button></div>`);
  const cancel = () => { if (!pend) return; const p = pend; pend = null; p.reject({code: "cancelled"}); };
  const sm = {json: (prompt, opts) => new Promise((resolve, reject) => {
    pend = {resolve, reject, prompt: prompt + JSON_TAIL}; show();
    opts?.signal?.addEventListener("abort", () => { if (pend) { modal(null); cancel(); } });
  })};
  SMP = Promise.resolve(sm);
  DLP = Promise.resolve({save: async ({filename, data}) => {
    const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data]));
    const a = Object.assign(document.createElement("a"), {href: url, download: filename}); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }});
  document.addEventListener("click", async ev => {
    const t = ev.target.closest("[data-cp]");
    if (!t) { if (pend && ev.target.closest('[data-act="fechar"]')) cancel(); return; }
    ev.stopPropagation();
    const k = t.dataset.cp;
    if (k === "copiar") { const m = document.getElementById("cpMsg"); try { await navigator.clipboard.writeText(pend.prompt); m.textContent = "Copiado."; } catch (_) { const x = document.getElementById("cpPrompt"); x.select(); document.execCommand("copy"); m.textContent = "Copiado (se não colar, selecione e copie à mão)."; } }
    if (k === "cancelar") { modal(null); cancel(); }
    if (k === "usar" && pend) {
      const txt = (document.getElementById("cpResp").value || "").trim();
      if (!txt) return show("Cole a resposta do Claude primeiro.");
      let out; try { out = extractJSON(txt); } catch (e) { return show("Não consegui ler a resposta: " + e.message + ". Copie a resposta inteira do Claude.", txt); }
      const p = pend; pend = null; modal(null); p.resolve(out);
    }
  }, true);
  document.addEventListener("keydown", ev => { if (ev.key === "Escape") cancel(); }, true);
})();
