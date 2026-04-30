/**
 * Konzentrische Rohr-Reduzierung: CD = π·D/n, Cd = π·d/n (Abwicklung / Segmente).
 */

const STORAGE_KEY = "rohr-reduzierung-v1";

function parseNum(str) {
  const v = parseFloat(String(str || "").replace(",", ".").trim());
  return Number.isFinite(v) ? v : NaN;
}

function parseIntStrict(str) {
  const v = parseInt(String(str || "").trim(), 10);
  return Number.isFinite(v) ? v : NaN;
}

function fmtNum(n, minD, maxD) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: minD,
    maximumFractionDigits: maxD,
  }).format(n);
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s === "object" ? s : null;
  } catch (_) {
    return null;
  }
}

function saveState(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

function syncDomFromSaved() {
  const s = loadSaved();
  if (!s) return;
  if (s.dLargeMm != null) document.getElementById("dLargeMm").value = String(s.dLargeMm).replace(".", ",");
  if (s.dSmallMm != null) document.getElementById("dSmallMm").value = String(s.dSmallMm).replace(".", ",");
  if (s.lengthMm != null) document.getElementById("lengthMm").value = String(s.lengthMm).replace(".", ",");
  const nEl = document.getElementById("segmentCount");
  if (s.n != null && [...nEl.options].some((o) => o.value === String(s.n))) {
    nEl.value = String(s.n);
  }
}

function collectInputs() {
  return {
    D: parseNum(document.getElementById("dLargeMm").value),
    d: parseNum(document.getElementById("dSmallMm").value),
    L: parseNum(document.getElementById("lengthMm").value),
    n: parseIntStrict(document.getElementById("segmentCount").value),
  };
}

/** Handbuch-ähnliche Abwicklung: helles „Papier“, schwarze Konturen, Schraffur, Bemaßung in mm. */
function buildDevelopmentSvg(D, d, L, n) {
  const U = Math.PI * D;
  const Us = Math.PI * d;
  const CD = U / n;
  const Cd = Us / n;
  const gap = CD - Cd;

  const strokeMain = 1.35;
  const strokeFine = 0.9;
  const arrow = Math.max(5, Math.min(10, U * 0.004));
  const fontMain = Math.max(11, Math.min(18, U * 0.022));
  const fontSmall = Math.max(9, fontMain * 0.82);

  const marginL = Math.max(52, L * 0.14);
  const marginR = Math.max(28, U * 0.03);
  const marginT = Math.max(72, L * 0.2);
  const marginB = Math.max(78, L * 0.22);

  const x0 = marginL;
  const yTop = marginT;
  const yBot = marginT + L;
  const vbW = marginL + U + marginR;
  const vbH = marginT + L + marginB;

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const tCD = esc(fmtNum(CD, 1, 2));
  const tCd = esc(fmtNum(Cd, 1, 2));
  const tU = esc(fmtNum(U, 1, 2));
  const tUs = esc(fmtNum(Us, 1, 2));
  const tL = esc(fmtNum(L, 0, 1));
  const tGap = esc(fmtNum(gap, 1, 2));
  const tD = esc(fmtNum(D, 1, 2));
  const td = esc(fmtNum(d, 1, 2));

  const parts = [];

  const arrowHeadPath = (xTip, yTip, dir) => {
    const h = arrow * 0.55;
    if (dir === "left") {
      return `M ${xTip} ${yTip} L ${xTip + arrow} ${yTip - h} L ${xTip + arrow} ${yTip + h} Z`;
    }
    return `M ${xTip} ${yTip} L ${xTip - arrow} ${yTip - h} L ${xTip - arrow} ${yTip + h} Z`;
  };

  /** Horizontale Maßkette: yRef = Bezugskante; gapOut positiv = Maßlinie nach oben. */
  const dimH = (x1, x2, yRef, gapOut, labelHtml) => {
    const sign = gapOut < 0 ? -1 : 1;
    const yDim = yRef - gapOut;
    const extLen = Math.abs(gapOut) * 0.35 + 10;
    const yTick = yRef - sign * Math.min(Math.abs(gapOut) * 0.22, 14);
    parts.push(
      `<line x1="${x1}" y1="${yRef}" x2="${x1}" y2="${yDim + sign * extLen}" stroke="#111" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${x2}" y1="${yRef}" x2="${x2}" y2="${yDim + sign * extLen}" stroke="#111" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${x1}" y1="${yDim}" x2="${x2}" y2="${yDim}" stroke="#111" stroke-width="${strokeMain}"/>`
    );
    parts.push(`<path d="${arrowHeadPath(x1, yDim, "left")}" fill="#111"/>`);
    parts.push(`<path d="${arrowHeadPath(x2, yDim, "right")}" fill="#111"/>`);
    const ty = yDim - sign * (fontMain * 0.45);
    parts.push(
      `<text x="${(x1 + x2) / 2}" y="${ty}" text-anchor="middle" fill="#111" font-size="${fontMain}" font-family="DM Sans, system-ui, sans-serif">${labelHtml}</text>`
    );
    parts.push(
      `<line x1="${x1}" y1="${yTick}" x2="${x1}" y2="${yRef}" stroke="#111" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${x2}" y1="${yTick}" x2="${x2}" y2="${yRef}" stroke="#111" stroke-width="${strokeFine}"/>`
    );
  };

  /** Vertikale Maßkette links vom Rohr (Maßzahl von links lesbar). */
  const dimV = (y1, y2, xRef, gapLeft, labelHtml) => {
    const xDim = xRef - gapLeft;
    const ext = Math.min(gapLeft * 0.2, 14);
    parts.push(
      `<line x1="${xRef}" y1="${y1}" x2="${xDim - ext}" y2="${y1}" stroke="#111" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${xRef}" y1="${y2}" x2="${xDim - ext}" y2="${y2}" stroke="#111" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${xDim}" y1="${y1}" x2="${xDim}" y2="${y2}" stroke="#111" stroke-width="${strokeMain}"/>`
    );
    const h = arrow * 0.5;
    parts.push(
      `<path d="M ${xDim} ${y1} L ${xDim - h} ${y1 + arrow} L ${xDim + h} ${y1 + arrow} Z" fill="#111"/>`
    );
    parts.push(
      `<path d="M ${xDim} ${y2} L ${xDim - h} ${y2 - arrow} L ${xDim + h} ${y2 - arrow} Z" fill="#111"/>`
    );
    parts.push(
      `<text transform="translate(${xDim - fontMain * 0.9}, ${(y1 + y2) / 2}) rotate(-90)" text-anchor="middle" dominant-baseline="middle" fill="#111" font-size="${fontMain}" font-family="DM Sans, system-ui, sans-serif">${labelHtml}</text>`
    );
  };

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" class="reducer-sketch-svg" role="img" aria-label="Abwicklung Reduzierung mit Bemaßung">`
  );

  parts.push(`<defs>
    <pattern id="reducer-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="#6b6b6b" stroke-width="1.1"/>
    </pattern>
  </defs>`);

  parts.push(`<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#f7f4ed" stroke="#c8c2b4" stroke-width="1"/>`);

  parts.push(
    `<text x="${vbW / 2}" y="${marginT * 0.38}" text-anchor="middle" fill="#222" font-size="${fontSmall}" font-family="DM Sans, system-ui, sans-serif">Abwicklung konzentrisch · D = ${tD} mm, d = ${td} mm, n = ${n}</text>`
  );

  for (let k = 0; k < n; k++) {
    const xL = x0 + k * CD;
    const xR = x0 + (k + 1) * CD;
    const cx = x0 + (k + 0.5) * CD;
    const wedgeLeft = `${xL},${yBot} ${cx - Cd / 2},${yTop} ${xL},${yTop}`;
    const wedgeRight = `${cx + Cd / 2},${yTop} ${xR},${yTop} ${xR},${yBot}`;
    parts.push(
      `<polygon points="${wedgeLeft}" fill="url(#reducer-hatch)" stroke="#111" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<polygon points="${wedgeRight}" fill="url(#reducer-hatch)" stroke="#111" stroke-width="${strokeFine}"/>`
    );
  }

  for (let k = 0; k < n; k++) {
    const xL = x0 + k * CD;
    const xR = x0 + (k + 1) * CD;
    const cx = x0 + (k + 0.5) * CD;
    const pts = `${xL},${yBot} ${xR},${yBot} ${cx + Cd / 2},${yTop} ${cx - Cd / 2},${yTop}`;
    parts.push(
      `<polygon points="${pts}" fill="#fff" fill-opacity="0.92" stroke="#111" stroke-width="${strokeMain}"/>`
    );
  }

  parts.push(
    `<line x1="${x0}" y1="${yBot}" x2="${x0 + U}" y2="${yBot}" stroke="#111" stroke-width="${strokeMain}"/>`
  );
  parts.push(
    `<line x1="${x0}" y1="${yTop}" x2="${x0 + U}" y2="${yTop}" stroke="#111" stroke-width="${strokeMain}"/>`
  );

  for (let k = 0; k < n; k++) {
    const cx = x0 + (k + 0.5) * CD;
    parts.push(
      `<line x1="${cx}" y1="${yTop}" x2="${cx}" y2="${yBot}" stroke="#555" stroke-width="${strokeFine * 0.75}" stroke-dasharray="6 5"/>`
    );
  }

  const gapTopOuter = marginT * 0.88;
  const gapTopInner = marginT * 0.52;
  dimH(x0, x0 + U, yTop, gapTopOuter, `π·D = ${tU} mm`);
  dimH(x0, x0 + CD, yTop, gapTopInner, `C<tspan baseline-shift="sub" font-size="0.72em">D</tspan> = ${tCD} mm`);

  const xSmall0 = x0 + (U - Us) / 2;
  const xSmall1 = xSmall0 + Us;
  const cx0 = x0 + CD / 2;
  const gapBotOuter = marginB * 0.9;
  const gapBotInner = marginB * 0.55;
  dimH(xSmall0, xSmall1, yBot, -gapBotOuter, `π·d = ${tUs} mm`);
  dimH(cx0 - Cd / 2, cx0 + Cd / 2, yBot, -gapBotInner, `C<tspan baseline-shift="sub" font-size="0.72em">d</tspan> = ${tCd} mm`);

  dimV(yTop, yBot, x0, marginL * 0.72, `L = ${tL} mm`);

  const xGap1 = x0 + CD * 0.5 - Cd / 2;
  const xGap2 = x0 + CD * 0.5 + Cd / 2;
  const yGapDim = yBot + marginB * 0.32;
  parts.push(
    `<line x1="${xGap1}" y1="${yBot}" x2="${xGap1}" y2="${yGapDim + 14}" stroke="#111" stroke-width="${strokeFine}"/>`
  );
  parts.push(
    `<line x1="${xGap2}" y1="${yBot}" x2="${xGap2}" y2="${yGapDim + 14}" stroke="#111" stroke-width="${strokeFine}"/>`
  );
  parts.push(
    `<line x1="${xGap1}" y1="${yGapDim}" x2="${xGap2}" y2="${yGapDim}" stroke="#111" stroke-width="${strokeMain}"/>`
  );
  parts.push(`<path d="${arrowHeadPath(xGap1, yGapDim, "left")}" fill="#111"/>`);
  parts.push(`<path d="${arrowHeadPath(xGap2, yGapDim, "right")}" fill="#111"/>`);
  parts.push(
    `<text x="${(xGap1 + xGap2) / 2}" y="${yGapDim + fontMain + 4}" text-anchor="middle" fill="#111" font-size="${fontSmall}" font-family="DM Sans, system-ui, sans-serif">Keil je Segment: C<tspan baseline-shift="sub" font-size="0.72em">D</tspan> − C<tspan baseline-shift="sub" font-size="0.72em">d</tspan> = ${tGap} mm</text>`
  );

  parts.push(`</svg>`);
  return parts.join("");
}

function compute() {
  const msg = document.getElementById("msg");
  const block = document.getElementById("resultBlock");
  msg.hidden = true;
  msg.textContent = "";
  msg.className = "msg";
  block.hidden = true;

  const inp = collectInputs();

  if (!Number.isFinite(inp.D) || inp.D <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte einen gültigen großen Außen-Ø D in mm angeben.";
    return;
  }
  if (!Number.isFinite(inp.d) || inp.d <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte einen gültigen kleinen Außen-Ø d in mm angeben.";
    return;
  }
  if (inp.d >= inp.D) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Der kleine Ø muss kleiner als der große Ø sein.";
    return;
  }
  if (!Number.isFinite(inp.L) || inp.L <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte eine gültige Länge L in mm angeben.";
    return;
  }
  if (!Number.isFinite(inp.n) || inp.n < 3) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte mindestens n = 3 Segmente wählen.";
    return;
  }

  const circLarge = Math.PI * inp.D;
  const circSmall = Math.PI * inp.d;
  const CD = circLarge / inp.n;
  const Cd = circSmall / inp.n;
  const gap = CD - Cd;

  document.getElementById("circLarge").textContent = fmtNum(circLarge, 2, 3);
  document.getElementById("circSmall").textContent = fmtNum(circSmall, 2, 3);
  document.getElementById("cLarge").textContent = fmtNum(CD, 2, 3);
  document.getElementById("cSmall").textContent = fmtNum(Cd, 2, 3);
  document.getElementById("wedgeGap").textContent = fmtNum(gap, 2, 3);

  document.getElementById("diagram").innerHTML = buildDevelopmentSvg(inp.D, inp.d, inp.L, inp.n);

  saveState({
    dLargeMm: inp.D,
    dSmallMm: inp.d,
    lengthMm: inp.L,
    n: inp.n,
  });

  block.hidden = false;
}

function init() {
  syncDomFromSaved();
  document.getElementById("calc").addEventListener("click", compute);

  ["dLargeMm", "dSmallMm", "lengthMm", "segmentCount"].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("change", () => {
      const inp = collectInputs();
      if (
        Number.isFinite(inp.D) &&
        Number.isFinite(inp.d) &&
        Number.isFinite(inp.L) &&
        Number.isFinite(inp.n) &&
        inp.D > 0 &&
        inp.d > 0 &&
        inp.L > 0 &&
        inp.n >= 3 &&
        inp.d < inp.D
      ) {
        saveState({
          dLargeMm: inp.D,
          dSmallMm: inp.d,
          lengthMm: inp.L,
          n: inp.n,
        });
      }
    });
    if (el.tagName === "INPUT") {
      el.addEventListener("input", () => {
        const inp = collectInputs();
        if (
          Number.isFinite(inp.D) &&
          Number.isFinite(inp.d) &&
          Number.isFinite(inp.L) &&
          Number.isFinite(inp.n) &&
          inp.D > 0 &&
          inp.d > 0 &&
          inp.L > 0 &&
          inp.n >= 3 &&
          inp.d < inp.D
        ) {
          saveState({
            dLargeMm: inp.D,
            dSmallMm: inp.d,
            lengthMm: inp.L,
            n: inp.n,
          });
        }
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", init);
