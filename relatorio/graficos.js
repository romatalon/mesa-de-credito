// =====================================================================
// Gráficos em SVG próprio (sem biblioteca): funcionam na tela, no PDF e
// com tema claro. Cores fixas e texto escuro, legíveis impressos.
// =====================================================================
"use strict";
const GC = {ink: "#1B2430", mut: "#5B6573", grid: "#E3E7ED", hist: "#1F5FBF", proj: "#8FB0E3", ebitda: "#C2620E", ebitdaP: "#E8B58A", risk: "#C2620E", opp: "#2F7D45", base: "#1F5FBF", mod: "#7A55C2", est: "#A3271B", oti: "#2F7D45", gray: "#8C96A3"};
const CASE_COLOR = {otimista: GC.oti, base: GC.base, moderado: GC.mod, estresse: GC.est};
const fnum = (v, d = 0) => !nn(v) ? "–" : v.toLocaleString("pt-BR", {minimumFractionDigits: d, maximumFractionDigits: d});
const escS = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));

function niceMax(v) { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

// Miniatura de evolução: pontos históricos cheios, projetados tracejados
function spark(vals, nHist, opts = {}) {
  const w = opts.w || 86, h = opts.h || 22, pts = vals.map((v, i) => ({v, i})).filter(p => nn(p.v));
  if (pts.length < 2) return "";
  const mn = Math.min(...pts.map(p => p.v)), mx = Math.max(...pts.map(p => p.v)), span = mx - mn || Math.abs(mx) || 1;
  const X = i => 3 + i * (w - 6) / Math.max(1, vals.length - 1), Y = v => h - 3 - (v - mn) / span * (h - 6);
  const hist = pts.filter(p => p.i < nHist), proj = pts.filter(p => p.i >= nHist - 1);
  const path = a => a.map((p, k) => (k ? "L" : "M") + X(p.i).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" ");
  const last = hist[hist.length - 1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Evolução" style="vertical-align:middle;flex:none">
    ${hist.length > 1 ? `<path d="${path(hist)}" fill="none" stroke="${opts.color || GC.hist}" stroke-width="1.6"/>` : ""}
    ${proj.length > 1 ? `<path d="${path(proj)}" fill="none" stroke="${opts.color || GC.hist}" stroke-width="1.4" stroke-dasharray="3 2" opacity=".7"/>` : ""}
    ${last ? `<circle cx="${X(last.i)}" cy="${Y(last.v)}" r="2.4" fill="${opts.color || GC.hist}"/>` : ""}</svg>`;
}

// Barras agrupadas: cats = rótulos; series = [{nome, vals, cor, corProj}]; projetados a partir de nHist
function bars(cats, series, opts = {}) {
  const W = opts.w || 680, H = opts.h || 220, L = 46, R = 10, T = 26, B = 28, iw = W - L - R, ih = H - T - B;
  const all = series.flatMap(s => s.vals).filter(nn), mx = niceMax(Math.max(0, ...all)), mn = Math.min(0, ...all), lo = mn < 0 ? -niceMax(-mn) : 0, span = mx - lo || 1;
  const Y = v => T + (mx - v) / span * ih, gw = iw / cats.length, bw = Math.min(26, (gw - 8) / series.length);
  const ticks = [0, .25, .5, .75, 1].map(f => lo + f * span);
  let g = ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GC.grid}"/><text x="${L - 6}" y="${Y(t) + 3.5}" font-size="10" text-anchor="end" fill="${GC.mut}">${fnum(t)}</text>`).join("");
  cats.forEach((c, i) => {
    const x0 = L + i * gw + (gw - bw * series.length) / 2, proj = opts.nHist != null && i >= opts.nHist;
    series.forEach((s, k) => { const v = s.vals[i]; if (!nn(v)) return; const y = Y(Math.max(v, 0)), hh = Math.abs(Y(v) - Y(0));
      g += `<rect x="${(x0 + k * bw).toFixed(1)}" y="${y.toFixed(1)}" width="${(bw - 2).toFixed(1)}" height="${Math.max(1, hh).toFixed(1)}" fill="${proj ? s.corProj || s.cor : s.cor}" rx="1.5"/>`;
      if (opts.labels) g += `<text x="${(x0 + k * bw + bw / 2 - 1).toFixed(1)}" y="${(y - 4).toFixed(1)}" font-size="9" text-anchor="middle" fill="${GC.ink}">${fnum(v)}</text>`; });
    g += `<text x="${(L + i * gw + gw / 2).toFixed(1)}" y="${H - 10}" font-size="10" text-anchor="middle" fill="${proj ? GC.mut : GC.ink}">${escS(c)}</text>`;
  });
  if (opts.nHist != null && opts.nHist < cats.length) { const xs = L + opts.nHist * gw; g += `<line x1="${xs}" x2="${xs}" y1="${T - 6}" y2="${T + ih}" stroke="${GC.mut}" stroke-dasharray="3 3"/><text x="${xs + 4}" y="${T - 10}" font-size="9.5" fill="${GC.mut}">projeção</text>`; }
  const leg = series.map((s, k) => `<rect x="${L + k * 150}" y="4" width="10" height="10" fill="${s.cor}" rx="2"/><text x="${L + k * 150 + 14}" y="13" font-size="10.5" fill="${GC.ink}">${escS(s.nome)}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escS(opts.aria || "Gráfico de barras")}" style="max-width:${W}px;display:block">${leg}${g}</svg>`;
}

// Linhas: cats; series = [{nome, vals, cor, tracejado}]; refLine = {v, nome}
function lines(cats, series, opts = {}) {
  const W = opts.w || 680, H = opts.h || 200, L = 40, R = 70, T = 24, B = 26, iw = W - L - R, ih = H - T - B;
  const all = series.flatMap(s => s.vals).filter(nn).concat(opts.ref ? [opts.ref.v] : []);
  const mx = niceMax(Math.max(...all, 0) * 1.05), lo = Math.min(0, ...all), span = mx - lo || 1;
  const X = i => L + (cats.length < 2 ? iw / 2 : i * iw / (cats.length - 1)), Y = v => T + (mx - v) / span * ih;
  let g = [0, .25, .5, .75, 1].map(f => lo + f * span).map(t => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GC.grid}"/><text x="${L - 6}" y="${Y(t) + 3.5}" font-size="10" text-anchor="end" fill="${GC.mut}">${fnum(t, 1)}${opts.unit || ""}</text>`).join("");
  cats.forEach((c, i) => g += `<text x="${X(i)}" y="${H - 8}" font-size="10" text-anchor="middle" fill="${GC.ink}">${escS(c)}</text>`);
  if (opts.ref) g += `<line x1="${L}" x2="${W - R}" y1="${Y(opts.ref.v)}" y2="${Y(opts.ref.v)}" stroke="${GC.est}" stroke-dasharray="5 3"/><text x="${W - R + 4}" y="${Y(opts.ref.v) + 3.5}" font-size="9.5" fill="${GC.est}">${escS(opts.ref.nome)}</text>`;
  if (opts.nHist != null) { const xs = X(opts.nHist - 1); g += `<line x1="${xs}" x2="${xs}" y1="${T}" y2="${T + ih}" stroke="${GC.mut}" stroke-dasharray="2 3"/>`; }
  series.forEach(s => { const pts = s.vals.map((v, i) => nn(v) ? [X(i), Y(Math.min(v, mx))] : null).filter(Boolean); if (!pts.length) return;
    g += `<path d="${pts.map((p, k) => (k ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ")}" fill="none" stroke="${s.cor}" stroke-width="2" ${s.tracejado ? 'stroke-dasharray="5 3"' : ""}/>` + pts.map(p => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.6" fill="${s.cor}"/>`).join("");
    const lp = pts[pts.length - 1]; g += `<text x="${lp[0] + 6}" y="${lp[1] + 3.5}" font-size="10" fill="${s.cor}" font-weight="600">${escS(s.nome)}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escS(opts.aria || "Gráfico de linhas")}" style="max-width:${W}px;display:block">${g}</svg>`;
}

// Cascata horizontal: itens [{nome, v}] somam no total; compara com referências [{nome, v}]
function cascata(itens, total, refs, opts = {}) {
  const W = opts.w || 620, rowH = 26, L = 230, R = 70, rows = itens.length + 1 + refs.length, H = rows * rowH + 20;
  const mx = niceMax(Math.max(total, ...refs.map(r => r.v)) * 1.1), X = v => L + v / mx * (W - L - R);
  let acc = 0, g = "", y = 8;
  itens.forEach(it => { g += `<text x="${L - 8}" y="${y + 16}" font-size="11" text-anchor="end" fill="${GC.ink}">${escS(it.nome)}</text><rect x="${X(acc)}" y="${y + 5}" width="${Math.max(1, X(acc + it.v) - X(acc))}" height="15" fill="${it.cor || GC.proj}" rx="2"/><text x="${X(acc + it.v) + 5}" y="${y + 16}" font-size="10.5" fill="${GC.ink}">${fnum(it.v * 100, 2)}%</text>`; acc += it.v; y += rowH; });
  g += `<text x="${L - 8}" y="${y + 16}" font-size="11.5" font-weight="700" text-anchor="end" fill="${GC.ink}">Spread justo</text><rect x="${L}" y="${y + 4}" width="${X(total) - L}" height="17" fill="${GC.hist}" rx="2"/><text x="${X(total) + 5}" y="${y + 17}" font-size="11" font-weight="700" fill="${GC.hist}">${fnum(total * 100, 2)}%</text>`; y += rowH;
  refs.forEach(r => { g += `<text x="${L - 8}" y="${y + 16}" font-size="11" text-anchor="end" fill="${GC.ink}">${escS(r.nome)}</text><rect x="${L}" y="${y + 6}" width="${Math.max(1, X(r.v) - L)}" height="13" fill="${r.cor || GC.gray}" rx="2"/><text x="${X(r.v) + 5}" y="${y + 16}" font-size="10.5" fill="${GC.ink}">${fnum(r.v * 100, 2)}%</text>`; y += rowH; });
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Montagem do spread" style="max-width:${W}px;display:block">${g}</svg>`;
}

// Dispersão: pontos [{x, y, nome, destaque}]; linha horizontal yRef
function dispersao(pts, opts = {}) {
  const W = opts.w || 620, H = opts.h || 240, L = 44, R = 16, T = 16, B = 34, iw = W - L - R, ih = H - T - B;
  const xs = pts.map(p => p.x).filter(nn), ys = pts.map(p => p.y).filter(nn).concat(opts.yRef != null ? [opts.yRef] : []);
  if (!xs.length) return "";
  const xm = niceMax(Math.max(...xs)), ylo = Math.min(0, ...ys), ym = niceMax(Math.max(...ys) * 1.1), X = v => L + v / xm * iw, Y = v => T + (ym - v) / (ym - ylo) * ih;
  let g = [0, .25, .5, .75, 1].map(f => ylo + f * (ym - ylo)).map(t => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" stroke="${GC.grid}"/><text x="${L - 6}" y="${Y(t) + 3.5}" font-size="10" text-anchor="end" fill="${GC.mut}">${fnum(t, 1)}%</text>`).join("");
  [0, .25, .5, .75, 1].forEach(f => g += `<text x="${X(f * xm)}" y="${H - 18}" font-size="10" text-anchor="middle" fill="${GC.mut}">${fnum(f * xm, 1)}</text>`);
  g += `<text x="${L + iw / 2}" y="${H - 4}" font-size="10" text-anchor="middle" fill="${GC.mut}">${escS(opts.xlab || "prazo médio (anos)")}</text>`;
  if (opts.yRef != null) g += `<line x1="${L}" x2="${W - R}" y1="${Y(opts.yRef)}" y2="${Y(opts.yRef)}" stroke="${GC.hist}" stroke-dasharray="5 3" stroke-width="1.5"/><text x="${W - R - 4}" y="${Y(opts.yRef) - 5}" font-size="10" text-anchor="end" fill="${GC.hist}" font-weight="600">${escS(opts.refNome || "spread justo")}</text>`;
  pts.filter(p => !p.destaque).forEach(p => g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3" fill="${GC.gray}" opacity=".55"><title>${escS(p.nome)}: ${fnum(p.y, 2)}%</title></circle>`);
  pts.filter(p => p.destaque).forEach(p => g += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4.5" fill="${GC.ebitda}" stroke="#fff" stroke-width="1"><title>${escS(p.nome)}: ${fnum(p.y, 2)}%</title></circle>`);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escS(opts.aria || "Dispersão")}" style="max-width:${W}px;display:block">${g}</svg>`;
}

// Barras horizontais simples: [{nome, v, cor}], formato fx
function hbars(items, fx, opts = {}) {
  const W = opts.w || 520, rowH = 24, L = 120, R = 70, H = items.length * rowH + 8, mx = niceMax(Math.max(...items.map(i => i.v).filter(nn), 0) * 1.05), X = v => L + Math.max(0, v) / mx * (W - L - R);
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${escS(opts.aria || "Barras")}" style="max-width:${W}px;display:block">${items.map((it, k) => { const y = 4 + k * rowH;
    return `<text x="${L - 8}" y="${y + 15}" font-size="11" text-anchor="end" fill="${GC.ink}">${escS(it.nome)}</text><rect x="${L}" y="${y + 4}" width="${Math.max(1, X(it.v) - L)}" height="14" fill="${it.cor || GC.hist}" rx="2"/><text x="${X(it.v) + 5}" y="${y + 15}" font-size="10.5" fill="${GC.ink}">${fx(it.v)}</text>`; }).join("")}</svg>`;
}
