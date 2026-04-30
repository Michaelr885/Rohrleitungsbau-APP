/**
 * Konzentrische Rohr-Reduzierung: CD = π·D/n, Cd = π·d/n (Abwicklung / Segmente).
 * Skizzen im App-Diagramm-Stil (dunkler Hintergrund, Akzentfarben wie parallele Rohre).
 */

const STORAGE_KEY = "rohr-reduzierung-v1";

/** Diagramm-Stil (an parallelrohre.js angelehnt) */
const SK = {
  bg0: "#131c26",
  bg1: "#0f1419",
  panel: "#1a222d",
  text: "#e8edf2",
  muted: "#8b9bab",
  dim: "#a8b8c8",
  accent: "#5eb0f0",
  accent2: "#6ee7b7",
  warn: "#fbbf24",
  stroke: "#e8edf2",
  strokeSoft: "rgba(232,237,242,0.55)",
  center: "rgba(139,155,171,0.75)",
  hatch: "rgba(248,113,113,0.35)",
  hatchLine: "rgba(248,113,113,0.55)",
  fillSolid: "rgba(61,157,240,0.22)",
  fillAlt: "rgba(94,176,240,0.12)",
};

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

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function svgGradientBg(uid, W, H) {
  return `<defs>
    <linearGradient id="${uid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${SK.bg0}"/>
      <stop offset="100%" style="stop-color:${SK.bg1}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${uid})" rx="8"/>`;
}

/** Seitenansicht Reduzierung: L bemaßt, Mittellinie, Wand angedeutet */
function buildSideProfileSvg(D, d, L) {
  const W = 420;
  const H = 260;
  const uid = "gSide-" + Math.random().toString(36).slice(2, 10);
  const padL = 28;
  const padR = 36;
  const midY = H / 2;
  const x0 = padL;
  const x1 = W - padR;
  const taperW = Math.min(200, (x1 - x0) * 0.55);
  const xT = x0 + taperW;
  const halfLarge = 22;
  const halfSmall = Math.max(10, halfLarge * (d / D));
  const wall = Math.max(4, Math.min(10, halfSmall * 0.35));

  const tL = esc(fmtNum(L, 0, 2));

  const dimY = 44;
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Seitenansicht Reduzierung">`
  );
  parts.push(svgGradientBg(uid, W, H));

  parts.push(
    `<line x1="${x0 - 8}" y1="${midY}" x2="${x1 + 8}" y2="${midY}" stroke="${SK.center}" stroke-width="1" stroke-dasharray="7 4 2 4"/>`
  );

  const outerL = `M ${x0} ${midY - halfLarge} L ${xT} ${midY - halfSmall} L ${x1} ${midY - halfSmall} L ${x1} ${midY + halfSmall} L ${xT} ${midY + halfSmall} L ${x0} ${midY + halfLarge} Z`;
  parts.push(`<path d="${outerL}" fill="${SK.fillSolid}" stroke="${SK.accent}" stroke-width="2.2" stroke-linejoin="round"/>`);
  const innerL = `M ${x0 + wall} ${midY - halfLarge + wall} L ${xT - wall * 0.4} ${midY - halfSmall + wall} L ${x1 - wall} ${midY - halfSmall + wall} L ${x1 - wall} ${midY + halfSmall - wall} L ${xT - wall * 0.4} ${midY + halfSmall - wall} L ${x0 + wall} ${midY + halfLarge - wall} Z`;
  parts.push(`<path d="${innerL}" fill="${SK.bg1}" stroke="${SK.strokeSoft}" stroke-width="1.2" stroke-linejoin="round"/>`);

  const ax = (x0 + xT) / 2;
  parts.push(
    `<line x1="${ax}" y1="${dimY - 4}" x2="${ax}" y2="${midY - halfLarge - 4}" stroke="${SK.dim}" stroke-width="0.9"/>`
  );
  parts.push(
    `<line x1="${xT}" y1="${dimY - 4}" x2="${xT}" y2="${midY - halfSmall - 4}" stroke="${SK.dim}" stroke-width="0.9"/>`
  );
  parts.push(
    `<line x1="${ax}" y1="${dimY}" x2="${xT}" y2="${dimY}" stroke="${SK.warn}" stroke-width="1.4"/>`
  );
  parts.push(
    `<polygon points="${ax},${dimY} ${ax + 5},${dimY - 3} ${ax + 5},${dimY + 3}" fill="${SK.warn}"/>`
  );
  parts.push(
    `<polygon points="${xT},${dimY} ${xT - 5},${dimY - 3} ${xT - 5},${dimY + 3}" fill="${SK.warn}"/>`
  );
  parts.push(
    `<text x="${(ax + xT) / 2}" y="${dimY - 6}" text-anchor="middle" fill="${SK.text}" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">L = ${tL} mm</text>`
  );

  parts.push(
    `<text x="${W / 2}" y="28" text-anchor="middle" fill="${SK.text}" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">Seitenansicht (schematisch)</text>`
  );
  parts.push(
    `<text x="${W / 2}" y="44" text-anchor="middle" fill="${SK.muted}" font-size="10" font-family="DM Sans,system-ui,sans-serif">D = ${esc(
      fmtNum(D, 1, 2)
    )} mm → d = ${esc(fmtNum(d, 1, 2))} mm</text>`
  );

  parts.push(`</svg>`);
  return parts.join("");
}

/** Stirnansicht Schnittkante: Sägezahn, C_d an der Kuppe, C_D/2 vom Mittelstrich */
function buildEndCutSvg(D, d, n, CD, Cd) {
  const W = 420;
  const H = 280;
  const uid = "gEnd-" + Math.random().toString(36).slice(2, 10);
  const xBody = W - 48;
  const yMid = H / 2;
  const nShow = Math.min(Math.max(n, 3), 16);
  const totalH = nShow * CD;
  const scaleY = (H - 56) / totalH;
  const y0 = yMid - (nShow * CD * scaleY) / 2;

  const tipDepth = Math.max(32, Math.min(88, ((CD - Cd) / Math.max(CD, 1e-6)) * 70 + 26));
  const xTip = xBody - tipDepth;

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stirnansicht Schnittkante">`
  );
  parts.push(svgGradientBg(uid, W, H));

  parts.push(
    `<line x1="${xTip - 25}" y1="${yMid}" x2="${xBody + 40}" y2="${yMid}" stroke="${SK.center}" stroke-width="1" stroke-dasharray="7 4 2 4"/>`
  );

  let pathU = `M ${xBody} ${y0}`;
  let pathL = `M ${xBody} ${y0 + nShow * CD * scaleY}`;
  for (let k = 0; k < nShow; k++) {
    const ya = y0 + k * CD * scaleY;
    const yb = y0 + (k + 1) * CD * scaleY;
    const yt = (ya + yb) / 2;
    pathU += ` L ${xTip} ${yt} L ${xBody} ${yb}`;
    pathL += ` L ${xTip} ${yt} L ${xBody} ${yb}`;
  }
  parts.push(
    `<path d="${pathU}" fill="none" stroke="${SK.accent}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`
  );
  parts.push(
    `<path d="${pathL}" fill="none" stroke="${SK.accent}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`
  );
  parts.push(
    `<line x1="${xBody}" y1="${y0}" x2="${xBody}" y2="${y0 + nShow * CD * scaleY}" stroke="${SK.accent}" stroke-width="2.2"/>`
  );

  const kMid = Math.floor(nShow / 2);
  const yTipT = y0 + (kMid + 0.5) * CD * scaleY;
  const halfCdPx = (Cd / 2) * scaleY;
  const vx = xTip - 22;
  parts.push(`<line x1="${vx}" y1="${yTipT - halfCdPx}" x2="${vx}" y2="${yTipT + halfCdPx}" stroke="${SK.warn}" stroke-width="1.3"/>`);
  parts.push(
    `<line x1="${vx}" y1="${yTipT - halfCdPx}" x2="${xTip - 2}" y2="${yTipT - halfCdPx}" stroke="${SK.dim}" stroke-width="0.85"/>`
  );
  parts.push(
    `<line x1="${vx}" y1="${yTipT + halfCdPx}" x2="${xTip - 2}" y2="${yTipT + halfCdPx}" stroke="${SK.dim}" stroke-width="0.85"/>`
  );
  parts.push(
    `<text x="${vx - 6}" y="${yTipT}" text-anchor="end" dominant-baseline="middle" fill="${SK.text}" font-size="12" font-weight="600" font-family="DM Sans,system-ui,sans-serif">C<tspan baseline-shift="sub" font-size="0.7em">d</tspan> = ${esc(
      fmtNum(Cd, 1, 2)
    )}</text>`
  );

  const halfSegPx = (CD / 2) * scaleY;
  const yNotchUp = yMid - halfSegPx;
  const yNotchDn = yMid + halfSegPx;
  const vx2 = xBody + 28;
  parts.push(`<line x1="${vx2}" y1="${yMid}" x2="${vx2}" y2="${yNotchUp}" stroke="${SK.warn}" stroke-width="1.3"/>`);
  parts.push(`<line x1="${vx2}" y1="${yMid}" x2="${xBody + 4}" y2="${yMid}" stroke="${SK.dim}" stroke-width="0.85"/>`);
  parts.push(`<line x1="${vx2}" y1="${yNotchUp}" x2="${xBody + 4}" y2="${yNotchUp}" stroke="${SK.dim}" stroke-width="0.85"/>`);
  parts.push(
    `<text x="${vx2 + 8}" y="${(yMid + yNotchUp) / 2}" dominant-baseline="middle" fill="${SK.text}" font-size="11" font-weight="600" font-family="DM Sans,system-ui,sans-serif">C<tspan baseline-shift="sub" font-size="0.7em">D</tspan>/2 = ${esc(
      fmtNum(CD / 2, 1, 2)
    )}</text>`
  );
  const vx3 = xBody + 46;
  parts.push(`<line x1="${vx3}" y1="${yMid}" x2="${vx3}" y2="${yNotchDn}" stroke="${SK.warn}" stroke-width="1.3"/>`);
  parts.push(`<line x1="${vx3}" y1="${yMid}" x2="${xBody + 4}" y2="${yMid}" stroke="${SK.dim}" stroke-width="0.85"/>`);
  parts.push(`<line x1="${vx3}" y1="${yNotchDn}" x2="${xBody + 4}" y2="${yNotchDn}" stroke="${SK.dim}" stroke-width="0.85"/>`);
  parts.push(
    `<text x="${vx3 + 8}" y="${(yMid + yNotchDn) / 2}" dominant-baseline="middle" fill="${SK.text}" font-size="11" font-weight="600" font-family="DM Sans,system-ui,sans-serif">C<tspan baseline-shift="sub" font-size="0.7em">D</tspan>/2 = ${esc(
      fmtNum(CD / 2, 1, 2)
    )}</text>`
  );

  parts.push(
    `<text x="${W / 2}" y="26" text-anchor="middle" fill="${SK.text}" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">Stirnansicht Schnittkante</text>`
  );
  parts.push(
    `<text x="${W / 2}" y="42" text-anchor="middle" fill="${SK.muted}" font-size="10" font-family="DM Sans,system-ui,sans-serif">n = ${n}${
      nShow !== n ? ` · Darstellung ${nShow} Segmente` : ""
    } · Maße in mm</text>`
  );

  parts.push(`</svg>`);
  return parts.join("");
}

/** Kreissektor C_D am großen Umfang (wie Handbuch-Ansicht von oben) */
function buildRingSectorSvg(D, n, CD) {
  const W = 380;
  const H = 380;
  const uid = "gRing-" + Math.random().toString(36).slice(2, 10);
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.36;
  const Ri = R * 0.42;
  const a0 = (-Math.PI / 2) * 0.35;
  const a1 = a0 + (2 * Math.PI) / n;
  const largeArc = 0;

  const xr0 = cx + R * Math.cos(a0);
  const yr0 = cy + R * Math.sin(a0);
  const xr1 = cx + R * Math.cos(a1);
  const yr1 = cy + R * Math.sin(a1);
  const xi0 = cx + Ri * Math.cos(a0);
  const yi0 = cy + Ri * Math.sin(a0);
  const xi1 = cx + Ri * Math.cos(a1);
  const yi1 = cy + Ri * Math.sin(a1);

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kreissektor am großen Umfang">`);
  parts.push(svgGradientBg(uid, W, H));

  for (let k = 0; k < n; k++) {
    const ang = (k * 2 * Math.PI) / n - Math.PI / 2;
    const xe = cx + (R + 14) * Math.cos(ang);
    const ye = cy + (R + 14) * Math.sin(ang);
    parts.push(
      `<line x1="${cx}" y1="${cy}" x2="${xe}" y2="${ye}" stroke="${SK.strokeSoft}" stroke-width="1"/>`
    );
  }

  parts.push(
    `<line x1="${cx - R - 18}" y1="${cy}" x2="${cx + R + 18}" y2="${cy}" stroke="${SK.center}" stroke-width="0.9" stroke-dasharray="6 4 2 4"/>`
  );
  parts.push(
    `<line x1="${cx}" y1="${cy - R - 18}" x2="${cx}" y2="${cy + R + 18}" stroke="${SK.center}" stroke-width="0.9" stroke-dasharray="6 4 2 4"/>`
  );

  parts.push(
    `<path d="M ${xi0} ${yi0} L ${xr0} ${yr0} A ${R} ${R} 0 ${largeArc} 1 ${xr1} ${yr1} L ${xi1} ${yi1} A ${Ri} ${Ri} 0 ${largeArc} 0 ${xi0} ${yi0} Z" fill="${SK.fillSolid}" stroke="${SK.accent}" stroke-width="2"/>`
  );

  const rm = (R + Ri) / 2;
  const am = (a0 + a1) / 2;
  const arcR = rm + 28;
  const ax0 = cx + arcR * Math.cos(a0 + 0.04);
  const ay0 = cy + arcR * Math.sin(a0 + 0.04);
  const ax1 = cx + arcR * Math.cos(a1 - 0.04);
  const ay1 = cy + arcR * Math.sin(a1 - 0.04);
  parts.push(
    `<path d="M ${ax0} ${ay0} A ${arcR} ${arcR} 0 0 1 ${ax1} ${ay1}" fill="none" stroke="${SK.warn}" stroke-width="1.4"/>`
  );
  const tmx = cx + (arcR + 22) * Math.cos(am);
  const tmy = cy + (arcR + 22) * Math.sin(am);
  parts.push(
    `<text x="${tmx}" y="${tmy}" text-anchor="middle" fill="${SK.text}" font-size="12" font-weight="600" font-family="DM Sans,system-ui,sans-serif">C<tspan baseline-shift="sub" font-size="0.7em">D</tspan> = ${esc(
      fmtNum(CD, 1, 2)
    )}</text>`
  );

  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${SK.strokeSoft}" stroke-width="1.2"/>`
  );
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${Ri}" fill="none" stroke="${SK.strokeSoft}" stroke-width="1"/>`
  );

  parts.push(
    `<text x="${cx}" y="28" text-anchor="middle" fill="${SK.text}" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">Großer Umfang · ein Segment</text>`
  );
  parts.push(
    `<text x="${cx}" y="46" text-anchor="middle" fill="${SK.muted}" font-size="10" font-family="DM Sans,system-ui,sans-serif">D = ${esc(
      fmtNum(D, 1, 2)
    )} mm · n = ${n}</text>`
  );

  parts.push(`</svg>`);
  return parts.join("");
}

/** Kreisring mit n abwechselnd schraffierten Sektoren, Außenbogen C_d bemaßt */
function buildRingHatchSvg(d, n, Cd) {
  const W = 380;
  const H = 380;
  const uid = "gHat-" + Math.random().toString(36).slice(2, 10);
  const pid = "hatch-" + uid;
  const cx = W / 2;
  const cy = H / 2;
  const R = Math.min(W, H) * 0.36;
  const Ri = R * 0.45;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kreisring Segmentierung">`);
  parts.push(`<defs>
    <pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="6" stroke="${SK.hatchLine}" stroke-width="1"/>
    </pattern>
  </defs>`);
  parts.push(svgGradientBg(uid, W, H));

  parts.push(
    `<line x1="${cx - R - 18}" y1="${cy}" x2="${cx + R + 18}" y2="${cy}" stroke="${SK.center}" stroke-width="0.9" stroke-dasharray="6 4 2 4"/>`
  );
  parts.push(
    `<line x1="${cx}" y1="${cy - R - 18}" x2="${cx}" y2="${cy + R + 18}" stroke="${SK.center}" stroke-width="0.9" stroke-dasharray="6 4 2 4"/>`
  );

  for (let k = 0; k < n; k++) {
    const a0 = (k * 2 * Math.PI) / n - Math.PI / 2;
    const a1 = ((k + 1) * 2 * Math.PI) / n - Math.PI / 2;
    const xo0 = cx + R * Math.cos(a0);
    const yo0 = cy + R * Math.sin(a0);
    const xo1 = cx + R * Math.cos(a1);
    const yo1 = cy + R * Math.sin(a1);
    const xi0 = cx + Ri * Math.cos(a0);
    const yi0 = cy + Ri * Math.sin(a0);
    const xi1 = cx + Ri * Math.cos(a1);
    const yi1 = cy + Ri * Math.sin(a1);
    const large = 0;
    const dSeg = `M ${xi0} ${yi0} L ${xo0} ${yo0} A ${R} ${R} 0 ${large} 1 ${xo1} ${yo1} L ${xi1} ${yi1} A ${Ri} ${Ri} 0 ${large} 0 ${xi0} ${yi0} Z`;
    const fill = k % 2 === 0 ? `url(#${pid})` : SK.fillAlt;
    parts.push(`<path d="${dSeg}" fill="${fill}" stroke="${SK.accent2}" stroke-width="1.3"/>`);
  }

  const a0 = -Math.PI / 2;
  const a1 = a0 + (2 * Math.PI) / n;
  const arcR = R + 32;
  const bx0 = cx + arcR * Math.cos(a0 + 0.05);
  const by0 = cy + arcR * Math.sin(a0 + 0.05);
  const bx1 = cx + arcR * Math.cos(a1 - 0.05);
  const by1 = cy + arcR * Math.sin(a1 - 0.05);
  parts.push(
    `<path d="M ${bx0} ${by0} A ${arcR} ${arcR} 0 0 1 ${bx1} ${by1}" fill="none" stroke="${SK.warn}" stroke-width="1.4"/>`
  );
  const am = (a0 + a1) / 2;
  const lx = cx + (arcR + 26) * Math.cos(am);
  const ly = cy + (arcR + 26) * Math.sin(am);
  parts.push(
    `<text x="${lx}" y="${ly}" text-anchor="middle" fill="${SK.text}" font-size="12" font-weight="600" font-family="DM Sans,system-ui,sans-serif">C<tspan baseline-shift="sub" font-size="0.7em">d</tspan> = ${esc(
      fmtNum(Cd, 1, 2)
    )}</text>`
  );

  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${SK.strokeSoft}" stroke-width="1.1"/>`
  );
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${Ri}" fill="none" stroke="${SK.strokeSoft}" stroke-width="1"/>`
  );

  for (let k = 0; k < n; k++) {
    const ang = (k * 2 * Math.PI) / n - Math.PI / 2;
    const xe = cx + (R + 10) * Math.cos(ang);
    const ye = cy + (R + 10) * Math.sin(ang);
    parts.push(`<line x1="${cx}" y1="${cy}" x2="${xe}" y2="${ye}" stroke="${SK.strokeSoft}" stroke-width="0.85"/>`);
  }

  parts.push(
    `<text x="${cx}" y="28" text-anchor="middle" fill="${SK.text}" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">Kleiner Umfang · Segmente</text>`
  );
  parts.push(
    `<text x="${cx}" y="46" text-anchor="middle" fill="${SK.muted}" font-size="10" font-family="DM Sans,system-ui,sans-serif">d = ${esc(
      fmtNum(d, 1, 2)
    )} mm · n = ${n} · Schraffur = Ausschnitt</text>`
  );

  parts.push(`</svg>`);
  return parts.join("");
}

/** Abwicklung mit Maßketten (App-Stil) */
function buildDevelopmentSvg(D, d, L, n) {
  const U = Math.PI * D;
  const Us = Math.PI * d;
  const CD = U / n;
  const Cd = Us / n;
  const gap = CD - Cd;

  const strokeMain = 1.5;
  const strokeFine = 1;
  const arrow = Math.max(5, Math.min(10, U * 0.004));
  const fontMain = Math.max(11, Math.min(17, U * 0.021));
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

  const uid = "dev-" + Math.random().toString(36).slice(2, 10);
  const pid = "hatch-" + uid;

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

  const dimH = (x1, x2, yRef, gapOut, labelHtml) => {
    const sign = gapOut < 0 ? -1 : 1;
    const yDim = yRef - gapOut;
    const extLen = Math.abs(gapOut) * 0.35 + 10;
    const yTick = yRef - sign * Math.min(Math.abs(gapOut) * 0.22, 14);
    parts.push(
      `<line x1="${x1}" y1="${yRef}" x2="${x1}" y2="${yDim + sign * extLen}" stroke="${SK.dim}" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${x2}" y1="${yRef}" x2="${x2}" y2="${yDim + sign * extLen}" stroke="${SK.dim}" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${x1}" y1="${yDim}" x2="${x2}" y2="${yDim}" stroke="${SK.warn}" stroke-width="${strokeMain}"/>`
    );
    parts.push(`<path d="${arrowHeadPath(x1, yDim, "left")}" fill="${SK.warn}"/>`);
    parts.push(`<path d="${arrowHeadPath(x2, yDim, "right")}" fill="${SK.warn}"/>`);
    const ty = yDim - sign * (fontMain * 0.45);
    parts.push(
      `<text x="${(x1 + x2) / 2}" y="${ty}" text-anchor="middle" fill="${SK.text}" font-size="${fontMain}" font-family="DM Sans,system-ui,sans-serif">${labelHtml}</text>`
    );
    parts.push(
      `<line x1="${x1}" y1="${yTick}" x2="${x1}" y2="${yRef}" stroke="${SK.dim}" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${x2}" y1="${yTick}" x2="${x2}" y2="${yRef}" stroke="${SK.dim}" stroke-width="${strokeFine}"/>`
    );
  };

  const dimV = (y1, y2, xRef, gapLeft, labelHtml) => {
    const xDim = xRef - gapLeft;
    const ext = Math.min(gapLeft * 0.2, 14);
    parts.push(
      `<line x1="${xRef}" y1="${y1}" x2="${xDim - ext}" y2="${y1}" stroke="${SK.dim}" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${xRef}" y1="${y2}" x2="${xDim - ext}" y2="${y2}" stroke="${SK.dim}" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<line x1="${xDim}" y1="${y1}" x2="${xDim}" y2="${y2}" stroke="${SK.warn}" stroke-width="${strokeMain}"/>`
    );
    const h = arrow * 0.5;
    parts.push(
      `<path d="M ${xDim} ${y1} L ${xDim - h} ${y1 + arrow} L ${xDim + h} ${y1 + arrow} Z" fill="${SK.warn}"/>`
    );
    parts.push(
      `<path d="M ${xDim} ${y2} L ${xDim - h} ${y2 - arrow} L ${xDim + h} ${y2 - arrow} Z" fill="${SK.warn}"/>`
    );
    parts.push(
      `<text transform="translate(${xDim - fontMain * 0.9}, ${(y1 + y2) / 2}) rotate(-90)" text-anchor="middle" dominant-baseline="middle" fill="${SK.text}" font-size="${fontMain}" font-family="DM Sans,system-ui,sans-serif">${labelHtml}</text>`
    );
  };

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" class="reducer-sketch-svg" role="img" aria-label="Abwicklung Reduzierung mit Bemaßung">`
  );
  parts.push(`<defs>
    <linearGradient id="${uid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${SK.bg0}"/>
      <stop offset="100%" style="stop-color:${SK.bg1}"/>
    </linearGradient>
    <pattern id="${pid}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="7" stroke="${SK.hatchLine}" stroke-width="1"/>
    </pattern>
  </defs>`);
  parts.push(`<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="url(#${uid})" rx="8"/>`);

  parts.push(
    `<text x="${vbW / 2}" y="${marginT * 0.38}" text-anchor="middle" fill="${SK.muted}" font-size="${fontSmall}" font-family="DM Sans,system-ui,sans-serif">Abwicklung · D = ${tD} mm, d = ${td} mm, n = ${n}</text>`
  );

  for (let k = 0; k < n; k++) {
    const xL = x0 + k * CD;
    const xR = x0 + (k + 1) * CD;
    const cx = x0 + (k + 0.5) * CD;
    const wedgeLeft = `${xL},${yBot} ${cx - Cd / 2},${yTop} ${xL},${yTop}`;
    const wedgeRight = `${cx + Cd / 2},${yTop} ${xR},${yTop} ${xR},${yBot}`;
    parts.push(
      `<polygon points="${wedgeLeft}" fill="url(#${pid})" stroke="${SK.hatchLine}" stroke-width="${strokeFine}"/>`
    );
    parts.push(
      `<polygon points="${wedgeRight}" fill="url(#${pid})" stroke="${SK.hatchLine}" stroke-width="${strokeFine}"/>`
    );
  }

  for (let k = 0; k < n; k++) {
    const xL = x0 + k * CD;
    const xR = x0 + (k + 1) * CD;
    const cx = x0 + (k + 0.5) * CD;
    const pts = `${xL},${yBot} ${xR},${yBot} ${cx + Cd / 2},${yTop} ${cx - Cd / 2},${yTop}`;
    parts.push(
      `<polygon points="${pts}" fill="${SK.fillSolid}" stroke="${SK.accent}" stroke-width="${strokeMain}"/>`
    );
  }

  parts.push(
    `<line x1="${x0}" y1="${yBot}" x2="${x0 + U}" y2="${yBot}" stroke="${SK.stroke}" stroke-width="${strokeMain}"/>`
  );
  parts.push(
    `<line x1="${x0}" y1="${yTop}" x2="${x0 + U}" y2="${yTop}" stroke="${SK.stroke}" stroke-width="${strokeMain}"/>`
  );

  for (let k = 0; k < n; k++) {
    const cx = x0 + (k + 0.5) * CD;
    parts.push(
      `<line x1="${cx}" y1="${yTop}" x2="${cx}" y2="${yBot}" stroke="${SK.center}" stroke-width="${strokeFine * 0.75}" stroke-dasharray="6 5"/>`
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
    `<line x1="${xGap1}" y1="${yBot}" x2="${xGap1}" y2="${yGapDim + 14}" stroke="${SK.dim}" stroke-width="${strokeFine}"/>`
  );
  parts.push(
    `<line x1="${xGap2}" y1="${yBot}" x2="${xGap2}" y2="${yGapDim + 14}" stroke="${SK.dim}" stroke-width="${strokeFine}"/>`
  );
  parts.push(
    `<line x1="${xGap1}" y1="${yGapDim}" x2="${xGap2}" y2="${yGapDim}" stroke="${SK.warn}" stroke-width="${strokeMain}"/>`
  );
  parts.push(`<path d="${arrowHeadPath(xGap1, yGapDim, "left")}" fill="${SK.warn}"/>`);
  parts.push(`<path d="${arrowHeadPath(xGap2, yGapDim, "right")}" fill="${SK.warn}"/>`);
  parts.push(
    `<text x="${(xGap1 + xGap2) / 2}" y="${yGapDim + fontMain + 4}" text-anchor="middle" fill="${SK.muted}" font-size="${fontSmall}" font-family="DM Sans,system-ui,sans-serif">Keil: C<tspan baseline-shift="sub" font-size="0.72em">D</tspan> − C<tspan baseline-shift="sub" font-size="0.72em">d</tspan> = ${tGap} mm</text>`
  );

  parts.push(`</svg>`);
  return parts.join("");
}

function renderAllSketches(inp, CD, Cd) {
  document.getElementById("sketchSide").innerHTML = buildSideProfileSvg(inp.D, inp.d, inp.L);
  document.getElementById("sketchEndCut").innerHTML = buildEndCutSvg(inp.D, inp.d, inp.n, CD, Cd);
  document.getElementById("sketchRingCD").innerHTML = buildRingSectorSvg(inp.D, inp.n, CD);
  document.getElementById("sketchRingHatch").innerHTML = buildRingHatchSvg(inp.d, inp.n, Cd);
  document.getElementById("diagram").innerHTML = buildDevelopmentSvg(inp.D, inp.d, inp.L, inp.n);
}

function updateReducerUI(inp) {
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

  renderAllSketches(inp, CD, Cd);
  document.getElementById("resultBlock").hidden = false;
}

function tryLiveUpdate() {
  const inp = collectInputs();
  if (
    !Number.isFinite(inp.D) ||
    !Number.isFinite(inp.d) ||
    !Number.isFinite(inp.L) ||
    !Number.isFinite(inp.n) ||
    inp.D <= 0 ||
    inp.d <= 0 ||
    inp.L <= 0 ||
    inp.n < 3 ||
    inp.d >= inp.D
  ) {
    return;
  }
  const msg = document.getElementById("msg");
  msg.hidden = true;
  msg.textContent = "";
  msg.className = "msg";

  updateReducerUI(inp);
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

  updateReducerUI(inp);

  saveState({
    dLargeMm: inp.D,
    dSmallMm: inp.d,
    lengthMm: inp.L,
    n: inp.n,
  });
}

function init() {
  syncDomFromSaved();
  document.getElementById("calc").addEventListener("click", compute);

  ["dLargeMm", "dSmallMm", "lengthMm", "segmentCount"].forEach((id) => {
    const el = document.getElementById(id);
    const onField = () => {
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
        tryLiveUpdate();
      }
    };
    el.addEventListener("change", onField);
    if (el.tagName === "INPUT") {
      el.addEventListener("input", onField);
    }
  });

  tryLiveUpdate();
}

document.addEventListener("DOMContentLoaded", init);
