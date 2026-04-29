/**
 * Klassischer Etagenrechner: zwei Bögen, ein Passstück auf der Raumdiagonalen.
 * Passstück ≈ D − R1·tan(α/2) − R2·tan(α/2) − 2·Schweißspalt (R = Krümmungsradius Rohrmitte, grob aus DN·Faktor).
 */

const STORAGE_KEY = "etagenrechner-v2";

/** Leittexte je Sprung-Typ */
const GUIDE_LEAD = {
  space:
    "<strong>H</strong> = senkrechte Strecke, <strong>V</strong> = seitlicher Versatz, <strong>L</strong> = Länge entlang der Rohrtrasse in der Grundfläche. Das gerade Stück liegt auf der <strong>Raumdiagonale</strong> durch dieses Quader-Maß.",
  planar:
    "<strong>H</strong> = senkrechte Strecke, <strong>V</strong> = waagerechter Versatz (Ansicht von vorn). Das gerade Passstück liegt in der <strong>Schrägen</strong> zwischen beiden Achsen — <strong>D = √(H² + V²)</strong>, ohne zusätzliche Länge L.",
};

/** @type {any} */
let DATA = null;

function parseNum(str) {
  const v = parseFloat(String(str ?? "").replace(",", ".").trim());
  return Number.isFinite(v) ? v : NaN;
}

function fmtMm(n) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(n);
}

function fmtDeg(n) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
  }).format(n);
}

function fmtKg(n) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(n);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getElbowDef(id) {
  const list = DATA?.elbowTypes ?? [];
  return list.find((e) => e.id === id) ?? list[0];
}

/** Krümmungsradius Rohrmitte (mm), grob */
function radiusCenterMm(dn, elbowId) {
  const def = getElbowDef(elbowId);
  const f = Number(def?.centerFactor) || 1.5;
  return f * dn;
}

function metalMassKg(odMm, wallMm, lengthMm, densityKgM3) {
  const ro = odMm / 2;
  const ri = Math.max(0, ro - wallMm);
  const areaMm2 = Math.PI * (ro * ro - ri * ri);
  const volM3 = (areaMm2 * lengthMm) / 1e9;
  return volM3 * densityKgM3;
}

function bendRows(alphaDeg, Rmm, gapMm, outerMm) {
  const ar = (alphaDeg * Math.PI) / 180;
  const ro = Math.max(0, outerMm / 2);
  const arcOut = (Rmm + ro) * ar;
  const arcIn = Math.max(0, Rmm - ro) * ar;
  const chord = 2 * Rmm * Math.sin(ar / 2);
  const buildLen = Rmm * Math.tan(ar / 2) + gapMm;
  return {
    outerArc: arcOut,
    innerArc: arcIn,
    chord,
    buildLen,
  };
}

/**
 * Isometrische Projektion: Achsen x=V, y=L, z=H (senkrecht).
 */
function Pproj(vx, ly, hz, k, ox, oy) {
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);
  const sx = ox + (vx - ly) * c * k;
  const sy = oy + (vx + ly) * s * k - hz * k;
  return [sx, sy];
}

/** Eckpunkte des Einbauprismas (mm-Raum: x=V, y=L, z=H) */
function isoPrismCorners(H, V, L) {
  return [
    [0, 0, 0],
    [V, 0, 0],
    [V, L, 0],
    [0, L, 0],
    [0, 0, H],
    [V, 0, H],
    [V, L, H],
    [0, L, H],
  ];
}

/**
 * Skaliert und verschiebt die Iso-Projektion so, dass sie den Bereich
 * [pad, W-pad] × [drawTop, drawBottom] optimal ausfüllt (ohne Verzerrung).
 */
function fitIsoToRect(H, V, L, W, Hs, drawTop, drawBottom, pad, margin = 0.96) {
  const corners = isoPrismCorners(H, V, L);
  let minx = Infinity;
  let maxx = -Infinity;
  let miny = Infinity;
  let maxy = -Infinity;
  for (const [vx, ly, hz] of corners) {
    const [x, y] = Pproj(vx, ly, hz, 1, 0, 0);
    minx = Math.min(minx, x);
    maxx = Math.max(maxx, x);
    miny = Math.min(miny, y);
    maxy = Math.max(maxy, y);
  }
  const wu = Math.max(maxx - minx, 1e-6);
  const hu = Math.max(maxy - miny, 1e-6);
  const cxu = (minx + maxx) / 2;
  const cyu = (miny + maxy) / 2;

  const dw = Math.max(W - 2 * pad, 1);
  const dh = Math.max(drawBottom - drawTop, 1);
  const k = Math.min(dw / wu, dh / hu) * margin;

  const cxDraw = W / 2;
  const cyDraw = (drawTop + drawBottom) / 2;
  const ox = cxDraw - k * cxu;
  const oy = cyDraw - k * cyu;
  return { k, ox, oy };
}

/** Bounding-Box der projizierten Prismakanten (nach Skalierung), für viewBox. */
function isoProjectedBBox(H, V, L, k, ox, oy) {
  let minx = Infinity;
  let maxx = -Infinity;
  let miny = Infinity;
  let maxy = -Infinity;
  for (const [vx, ly, hz] of isoPrismCorners(H, V, L)) {
    const [x, y] = Pproj(vx, ly, hz, k, ox, oy);
    minx = Math.min(minx, x);
    maxx = Math.max(maxx, x);
    miny = Math.min(miny, y);
    maxy = Math.max(maxy, y);
  }
  return { minx, maxx, miny, maxy };
}

/**
 * Statische Leitgrafik Plansprung: rechtwinkliges Dreieck H–V–D.
 */
function renderGuideSvgPlanar() {
  const H = 100;
  const V = 120;
  const W = 480;
  const Hs = 260;
  const m = Math.max(H, V);
  const s = (Math.min(W, Hs) - 100) / m;
  const x0 = 70;
  const y0 = Hs - 50;
  const x1 = x0 + V * s;
  const y1 = y0;
  const x2 = x0;
  const y2 = y0 - H * s;

  const gid = `g-gpl-${Math.random().toString(36).slice(2, 9)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hs}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Prinzip Plansprung">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#141d28"/>
      <stop offset="100%" style="stop-color:#10161d"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#${gid})" rx="10"/>
  <text x="${W / 2}" y="22" text-anchor="middle" fill="#e8edf2" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">Plansprung (Ansicht)</text>
  <text x="${W / 2}" y="40" text-anchor="middle" fill="#8b9bab" font-size="10" font-family="DM Sans,system-ui,sans-serif">Rechtwinklig: Katheten H und V, Hypotenuse D = √(H²+V²). Kein weiteres L.</text>
  <path d="M ${x0} ${y0} L ${x1} ${y1} L ${x2} ${y2} Z" fill="rgba(61,157,240,0.08)" stroke="rgba(139,155,171,0.5)" stroke-width="1.5"/>
  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(232,147,92,0.85)" stroke-width="3" stroke-linecap="round"/>
  <text x="${(x0 + x1) / 2 + 6}" y="${y0 + 16}" fill="#7dd3fc" font-size="13" font-weight="700" font-family="DM Sans,system-ui,sans-serif">V</text>
  <text x="${x0 - 22}" y="${(y0 + y2) / 2}" fill="#7dd3fc" font-size="13" font-weight="700" font-family="DM Sans,system-ui,sans-serif">H</text>
  <text x="${W / 2}" y="${Hs - 18}" text-anchor="middle" fill="#6b7d8f" font-size="9.5" font-family="DM Sans,system-ui,sans-serif">α = atan(H/V) · Passstück auf der Hypotenuse</text>
</svg>`;
}

function renderGuideSvgPick(sprung) {
  return sprung === "planar" ? renderGuideSvgPlanar() : renderGuideSvgSpace();
}

/**
 * Mini-Legende: erklärt Bogenmaß außen/innen/mittig am Viertelkreis.
 */
function renderBendLegendSvg() {
  const W = 420;
  const H = 260;
  const cx = 150;
  const cy = 200;
  const rMid = 94;
  const wall = 20;
  const rOut = rMid + wall / 2;
  const rIn = rMid - wall / 2;
  const a0 = -Math.PI / 2;
  const a1 = 0;

  function P(r, a) {
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  }
  function arcD(r) {
    const [sx, sy] = P(r, a0);
    const [ex, ey] = P(r, a1);
    return `M ${sx.toFixed(1)} ${sy.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  }

  const gid = `g-legend-${Math.random().toString(36).slice(2, 9)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Legende Bogenmaß außen innen">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#141d28"/>
      <stop offset="100%" style="stop-color:#10161d"/>
    </linearGradient>
    <marker id="arrLegend" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
      <path d="M0,0 L6,3 L0,6 z" fill="#8b9bab"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="url(#${gid})" rx="10"/>
  <text x="${W / 2}" y="24" text-anchor="middle" fill="#e8edf2" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">Bogenmaß außen / innen — was ist was?</text>
  <path d="${arcD(rOut)}" fill="none" stroke="#7dd3fc" stroke-width="5" stroke-linecap="round"/>
  <path d="${arcD(rMid)}" fill="none" stroke="#e8935c" stroke-width="3" stroke-dasharray="6 5" stroke-linecap="round"/>
  <path d="${arcD(rIn)}" fill="none" stroke="#6ee7b7" stroke-width="5" stroke-linecap="round"/>
  <line x1="${cx}" y1="${cy}" x2="${(cx + rOut).toFixed(1)}" y2="${cy}" stroke="rgba(139,155,171,0.25)" stroke-width="1"/>
  <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${(cy - rOut).toFixed(1)}" stroke="rgba(139,155,171,0.25)" stroke-width="1"/>
  <line x1="256" y1="78" x2="218" y2="108" stroke="#8b9bab" stroke-width="1.2" marker-end="url(#arrLegend)"/>
  <line x1="282" y1="128" x2="234" y2="148" stroke="#8b9bab" stroke-width="1.2" marker-end="url(#arrLegend)"/>
  <line x1="276" y1="176" x2="222" y2="178" stroke="#8b9bab" stroke-width="1.2" marker-end="url(#arrLegend)"/>
  <text x="262" y="74" fill="#7dd3fc" font-size="11.5" font-weight="700" font-family="DM Sans,system-ui,sans-serif">Bogenmaß außen</text>
  <text x="288" y="126" fill="#e8935c" font-size="11.5" font-weight="700" font-family="DM Sans,system-ui,sans-serif">Bogenmaß Mitte</text>
  <text x="282" y="174" fill="#6ee7b7" font-size="11.5" font-weight="700" font-family="DM Sans,system-ui,sans-serif">Bogenmaß innen</text>
  <text x="212" y="224" fill="#8b9bab" font-size="10" font-family="DM Sans,system-ui,sans-serif">Formeln: L außen=(R+OD/2)·α · L innen=(R−OD/2)·α</text>
</svg>`;
}

/**
 * Statische Prinzip-Zeichnung Raumsprung: Bedeutung von H, V, L am Raumprisma (nicht maßstäblich).
 */
function renderGuideSvgSpace() {
  const W = 480;
  const Hs = 290;
  const H = 100;
  const V = 120;
  const L = 90;
  const pad = 14;
  const drawTop = 54;
  const drawBottom = Hs - 36;
  const { k, ox, oy } = fitIsoToRect(H, V, L, W, Hs, drawTop, drawBottom, pad, 0.98);

  function Lbl(x, y, t, fill = "#b8c5d4") {
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" fill="${fill}" font-size="13" font-weight="700" font-family="DM Sans,system-ui,sans-serif">${escapeHtml(
      t
    )}</text>`;
  }

  const floor = `M ${Pproj(0, 0, 0, k, ox, oy).join(",")} L ${Pproj(V, 0, 0, k, ox, oy).join(",")} L ${Pproj(
    V,
    L,
    0,
    k,
    ox,
    oy
  ).join(",")} L ${Pproj(0, L, 0, k, ox, oy).join(",")} Z`;
  const top = `M ${Pproj(0, 0, H, k, ox, oy).join(",")} L ${Pproj(V, 0, H, k, ox, oy).join(",")} L ${Pproj(
    V,
    L,
    H,
    k,
    ox,
    oy
  ).join(",")} L ${Pproj(0, L, H, k, ox, oy).join(",")} Z`;

  const verts = [
    [0, 0],
    [V, 0],
    [V, L],
    [0, L],
  ]
    .map(([vx, ly]) => {
      const [x0, y0] = Pproj(vx, ly, 0, k, ox, oy);
      const [x1, y1] = Pproj(vx, ly, H, k, ox, oy);
      return `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="rgba(139,155,171,0.5)" stroke-width="1.25"/>`;
    })
    .join("\n  ");

  const [vxm, vym] = Pproj(V / 2, 0, 0, k, ox, oy);
  const [lxm, lym] = Pproj(V, L / 2, 0, k, ox, oy);
  const [hxm, hym] = Pproj(0, 0, H / 2, k, ox, oy);

  const gid = `g-guide-${Math.random().toString(36).slice(2, 9)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hs}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Prinzip H V L">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#141d28"/>
      <stop offset="100%" style="stop-color:#10161d"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#${gid})" rx="10"/>
  <text x="${W / 2}" y="24" text-anchor="middle" fill="#e8edf2" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">So sind H, V und L gemeint</text>
  <text x="${W / 2}" y="42" text-anchor="middle" fill="#8b9bab" font-size="10" font-family="DM Sans,system-ui,sans-serif">Gerades Passstück liegt auf der Raumdiagonale — H, V und L begrenzen das Einbauprisma.</text>
  <path d="${floor}" fill="rgba(61,157,240,0.06)" stroke="rgba(139,155,171,0.45)" stroke-width="1.25"/>
  <path d="${top}" fill="none" stroke="rgba(139,155,171,0.4)" stroke-width="1.25"/>
  ${verts}
  <path d="M ${Pproj(0, 0, 0, k, ox, oy).join(" ")} L ${Pproj(V, L, H, k, ox, oy).join(" ")}" fill="none" stroke="rgba(232,147,92,0.65)" stroke-width="3" stroke-dasharray="7 5" stroke-linecap="round"/>
  ${Lbl(vxm + 4, vym + 4, "V", "#7dd3fc")}
  ${Lbl(lxm + 6, lym - 2, "L", "#7dd3fc")}
  ${Lbl(hxm - 18, hym, "H", "#7dd3fc")}
  <text x="${W / 2}" y="${Hs - 18}" text-anchor="middle" fill="#6b7d8f" font-size="9.5" font-family="DM Sans,system-ui,sans-serif">D = √(H²+V²+L²) · α = Winkel der Diagonale zur Grundfläche (Achse L)</text>
</svg>`;
}

/**
 * Schema Plansprung: rechter Winkel, Katheten H und V, Hypotenuse = D.
 */
function renderSvgPlanar(H, V, alphaDeg, passMm, Dmm) {
  const Wb = 400;
  const Hb = 300;
  const m = Math.max(H, V, 1e-6);
  const s = 0.88 * (Math.min(Wb, Hb) - 48) / m;
  const x0 = 32;
  const y0 = Hb - 36;
  const x1 = x0 + V * s;
  const y1 = y0;
  const x2 = x0;
  const y2 = y0 - H * s;
  const padG = 24;
  const minx = Math.min(x0, x1, x2) - padG;
  const maxx = Math.max(x0, x1, x2) + padG;
  const miny = Math.min(y0, y1, y2) - padG;
  const maxy = Math.max(y0, y1, y2) + padG;
  const vbW = Math.max(maxx - minx, 1);
  const vbH = Math.max(maxy - miny, 1);
  const sw = Math.max(2, Math.min(10, 0.022 * Math.min(vbW, vbH)));
  const swP = Math.max(4, Math.min(14, 0.032 * Math.min(vbW, vbH)));
  const r = Math.max(5, Math.min(12, 0.02 * Math.min(vbW, vbH)));

  const gid = `g-pl-${Math.random().toString(36).slice(2, 9)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minx.toFixed(2)} ${miny.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Plansprung Schema">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#131c26"/>
      <stop offset="100%" style="stop-color:#0f1419"/>
    </linearGradient>
  </defs>
  <rect x="${minx.toFixed(2)}" y="${miny.toFixed(2)}" width="${vbW.toFixed(2)}" height="${vbH.toFixed(2)}" fill="url(#${gid})"/>
  <path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} L ${x1.toFixed(1)} ${y1.toFixed(1)} L ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="rgba(61,157,240,0.08)" stroke="rgba(139,155,171,0.45)" stroke-width="${sw.toFixed(2)}"/>
  <line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(139,155,171,0.35)" stroke-width="${(sw * 0.85).toFixed(2)}" stroke-dasharray="6 5"/>
  <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#e8935c" stroke-width="${swP.toFixed(2)}" stroke-linecap="round"/>
  <circle cx="${x0.toFixed(1)}" cy="${y0.toFixed(1)}" r="${r.toFixed(2)}" fill="#5eb0f0"/>
  <circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="${r.toFixed(2)}" fill="#8b9bab"/>
  <circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${r.toFixed(2)}" fill="#6ee7b7"/>
  <text x="${((x0 + x1) / 2 + 6).toFixed(1)}" y="${(y0 + 14).toFixed(1)}" fill="#7dd3fc" font-size="12" font-weight="700" font-family="DM Sans,system-ui,sans-serif">V</text>
  <text x="${(x0 - 18).toFixed(1)}" y="${((y0 + y2) / 2).toFixed(1)}" fill="#7dd3fc" font-size="12" font-weight="700" font-family="DM Sans,system-ui,sans-serif">H</text>
</svg>`;
}

function renderSvgSpace(H, V, L, alphaDeg, passMm, Dmm) {
  const W = 560;
  const Hs = 420;
  const pad = 14;
  const drawTop = 52;
  const drawBottom = Hs - 6;
  const { k, ox, oy } = fitIsoToRect(H, V, L, W, Hs, drawTop, drawBottom, pad, 0.995);

  const bb = isoProjectedBBox(H, V, L, k, ox, oy);
  const padGeom = 18;
  const vbX = bb.minx - padGeom;
  const vbY = bb.miny - padGeom;
  const vbW = Math.max(bb.maxx - bb.minx + 2 * padGeom, 1);
  const vbH = Math.max(bb.maxy - bb.miny + 2 * padGeom, 1);
  const swEdge = Math.max(1.5, Math.min(7, 0.016 * Math.min(vbW, vbH)));
  const swPipe = Math.max(4, Math.min(16, 0.026 * Math.min(vbW, vbH)));
  const rDot = Math.max(4, Math.min(14, 0.018 * Math.min(vbW, vbH)));

  function lineIso(vx0, ly0, hz0, vx1, ly1, hz1) {
    const [x0, y0] = Pproj(vx0, ly0, hz0, k, ox, oy);
    const [x1, y1] = Pproj(vx1, ly1, hz1, k, ox, oy);
    return `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="rgba(139,155,171,0.55)" stroke-width="${swEdge.toFixed(2)}"/>`;
  }

  const floor = `M ${Pproj(0, 0, 0, k, ox, oy).join(",")} L ${Pproj(V, 0, 0, k, ox, oy).join(",")} L ${Pproj(
    V,
    L,
    0,
    k,
    ox,
    oy
  ).join(",")} L ${Pproj(0, L, 0, k, ox, oy).join(",")} Z`;
  const top = `M ${Pproj(0, 0, H, k, ox, oy).join(",")} L ${Pproj(V, 0, H, k, ox, oy).join(",")} L ${Pproj(
    V,
    L,
    H,
    k,
    ox,
    oy
  ).join(",")} L ${Pproj(0, L, H, k, ox, oy).join(",")} Z`;

  const verts = [
    [0, 0],
    [V, 0],
    [V, L],
    [0, L],
  ]
    .map(([vx, ly]) => lineIso(vx, ly, 0, vx, ly, H))
    .join("\n  ");

  const [p0x, p0y] = Pproj(0, 0, 0, k, ox, oy);
  const [p1x, p1y] = Pproj(V, L, H, k, ox, oy);
  const pipePath = `M ${p0x.toFixed(1)},${p0y.toFixed(1)} L ${p1x.toFixed(1)},${p1y.toFixed(1)}`;

  const gid = `g-et-${Math.random().toString(36).slice(2, 9)}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX.toFixed(2)} ${vbY.toFixed(2)} ${vbW.toFixed(2)} ${vbH.toFixed(2)}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Raumprisma und Raumdiagonale">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#131c26"/>
      <stop offset="100%" style="stop-color:#0f1419"/>
    </linearGradient>
  </defs>
  <rect x="${vbX.toFixed(2)}" y="${vbY.toFixed(2)}" width="${vbW.toFixed(2)}" height="${vbH.toFixed(2)}" fill="url(#${gid})"/>
  <path d="${floor}" fill="none" stroke="rgba(139,155,171,0.35)" stroke-width="${swEdge.toFixed(2)}"/>
  <path d="${top}" fill="none" stroke="rgba(139,155,171,0.48)" stroke-width="${swEdge.toFixed(2)}"/>
  ${verts}
  <path d="${pipePath}" fill="none" stroke="#e8935c" stroke-width="${swPipe.toFixed(2)}" stroke-linecap="round"/>
  <circle cx="${p0x.toFixed(1)}" cy="${p0y.toFixed(1)}" r="${rDot.toFixed(2)}" fill="#5eb0f0"/>
  <circle cx="${p1x.toFixed(1)}" cy="${p1y.toFixed(1)}" r="${rDot.toFixed(2)}" fill="#6ee7b7"/>
</svg>`;
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

function populateFromData() {
  const series = document.getElementById("pipeSeries");
  series.innerHTML = "";
  for (const r of DATA?.pipeRows ?? []) {
    const opt = document.createElement("option");
    opt.value = r.id;
    opt.textContent = r.label;
    series.appendChild(opt);
  }

  const e1 = document.getElementById("elbow1");
  const e2 = document.getElementById("elbow2");
  e1.innerHTML = "";
  e2.innerHTML = "";
  for (const e of DATA?.elbowTypes ?? []) {
    const o1 = document.createElement("option");
    o1.value = e.id;
    o1.textContent = e.label;
    e1.appendChild(o1);
    const o2 = document.createElement("option");
    o2.value = e.id;
    o2.textContent = e.label;
    e2.appendChild(o2);
  }
  if (e1.options.length >= 2) {
    e1.selectedIndex = 0;
    e2.selectedIndex = 1;
  }
}

function selectedPipeRow() {
  const id = document.getElementById("pipeSeries").value;
  return (DATA?.pipeRows ?? []).find((r) => r.id === id);
}

function wireDnDropdown() {
  const row = selectedPipeRow();
  const wrap = document.getElementById("dnWrap");
  const manualWrap = document.getElementById("manualDnWrap");
  const dnSel = document.getElementById("dnSelect");
  if (!row || row.id === "manual") {
    wrap.hidden = true;
    manualWrap.hidden = false;
    return;
  }
  wrap.hidden = false;
  manualWrap.hidden = true;
  const pipes = row.pipes ?? [];
  const cur = dnSel.value;
  dnSel.innerHTML = "";
  for (const p of pipes) {
    const o = document.createElement("option");
    o.value = String(p.dn);
    o.textContent = `DN ${p.dn} (Ø ${p.odMm} mm)`;
    dnSel.appendChild(o);
  }
  if (pipes.some((p) => String(p.dn) === cur)) dnSel.value = cur;
}

function applyPipeSelection() {
  const row = selectedPipeRow();
  const auto = document.getElementById("autoWall").checked;
  const outerEl = document.getElementById("outerMm");
  const wallEl = document.getElementById("wallMm");

  if (!row || row.id === "manual") {
    outerEl.removeAttribute("readonly");
    wallEl.removeAttribute("readonly");
    return;
  }

  outerEl.setAttribute("readonly", "readonly");

  const pipes = row.pipes ?? [];
  const dn = parseInt(String(document.getElementById("dnSelect").value), 10);
  const p = pipes.find((x) => x.dn === dn) ?? pipes[0];
  if (p) {
    outerEl.value = String(p.odMm).replace(".", ",");
    if (auto) {
      wallEl.value = String(p.wallMm).replace(".", ",");
      wallEl.setAttribute("readonly", "readonly");
    } else {
      wallEl.removeAttribute("readonly");
    }
  }
}

function getSprungMode() {
  return document.getElementById("sprung-space").classList.contains("etagen-sprung-btn--active") ? "space" : "planar";
}

function setSprungMode(sprung) {
  const space = sprung === "space";
  document.getElementById("sprung-space").classList.toggle("etagen-sprung-btn--active", space);
  document.getElementById("sprung-planar").classList.toggle("etagen-sprung-btn--active", !space);
  document.getElementById("sprung-space").setAttribute("aria-selected", space ? "true" : "false");
  document.getElementById("sprung-planar").setAttribute("aria-selected", !space ? "true" : "false");
  const lead = document.getElementById("guideLead");
  if (lead) lead.innerHTML = GUIDE_LEAD[sprung] ?? GUIDE_LEAD.space;
  const hint = document.getElementById("etagenFormulaHint");
  if (hint) {
    hint.innerHTML = space
      ? 'Raumdiagonale <strong>D</strong> = √(H² + V² + L²) im Modus „Länge L“; im Modus „Winkel α“ wird <strong>L</strong> aus H, V und α ermittelt (<strong>D·cos α</strong>).'
      : 'Plansprung: <strong>D</strong> = √(H² + V²). Der Winkel α zwischen den Rohrachsen ist <strong>α = atan(H/V)</strong>. Die Felder „Länge L“ / „Winkel α“ gelten hier nicht.';
  }
  const gh = document.getElementById("guideSvgHost");
  if (gh) gh.innerHTML = renderGuideSvgPick(sprung);
  const wrL = document.getElementById("wrapL");
  const wrA = document.getElementById("wrapAlpha");
  const modeBar = document.querySelector(".etagen-mode-bar");
  if (wrL && wrA && modeBar) {
    wrL.hidden = !space;
    wrA.hidden = !space;
    modeBar.hidden = !space;
  }
  const sh = document.getElementById("schemaHint");
  if (sh) {
    sh.textContent = space
      ? "Nicht maßstäblich; Maße H, V, L und Raumdiagonale."
      : "Nicht maßstäblich; rechtwinkliges Dreieck H–V–D (Ansicht).";
  }
}

function setMode(mode) {
  const isLen = mode === "length";
  document.getElementById("mode-length").classList.toggle("etagen-mode-btn--active", isLen);
  document.getElementById("mode-angle").classList.toggle("etagen-mode-btn--active", !isLen);
  document.getElementById("mode-length").setAttribute("aria-selected", isLen ? "true" : "false");
  document.getElementById("mode-angle").setAttribute("aria-selected", !isLen ? "true" : "false");
  document.getElementById("wrapL").hidden = !isLen;
  document.getElementById("wrapAlpha").hidden = isLen;
}

function collectInputs() {
  const sprung = getSprungMode();
  const mode =
    sprung === "planar"
      ? "planar"
      : document.getElementById("mode-length").classList.contains("etagen-mode-btn--active")
        ? "length"
        : "angle";
  const H = parseNum(document.getElementById("inputH").value);
  const V = parseNum(document.getElementById("inputV").value);
  const Lraw = parseNum(document.getElementById("inputL").value);
  const alphaRaw = parseNum(document.getElementById("inputAlpha").value);
  const gap = parseNum(document.getElementById("gapMm").value);
  const outerMm = parseNum(document.getElementById("outerMm").value);
  const wallMm = parseNum(document.getElementById("wallMm").value);
  const row = selectedPipeRow();
  let dn = NaN;
  if (row && row.id !== "manual") {
    dn = parseInt(String(document.getElementById("dnSelect").value), 10);
  } else {
    dn = parseNum(document.getElementById("manualDn").value);
  }
  return {
    mode,
    H,
    V,
    Lraw,
    alphaRaw,
    gap,
    outerMm,
    wallMm,
    dn,
    elbow1: document.getElementById("elbow1").value,
    elbow2: document.getElementById("elbow2").value,
    material: document.getElementById("material").value,
    sprung,
  };
}

function computeGeometry(inp) {
  const { H, V, mode } = inp;
  if (!Number.isFinite(H) || H <= 0) return { err: "Bitte eine positive Höhe H (mm) angeben." };
  if (!Number.isFinite(V) || V <= 0) return { err: "Bitte einen positiven Versatz V (mm) angeben." };

  if (mode === "planar") {
    const D = Math.sqrt(H * H + V * V);
    const alphaRad = Math.atan2(H, V);
    const alphaDeg = (alphaRad * 180) / Math.PI;
    return { H, V, L: NaN, D, alphaRad, alphaDeg, base: Math.sqrt(H * H + V * V), sprung: "planar" };
  }

  const base = Math.sqrt(H * H + V * V);
  let L;
  let D;
  let alphaRad;
  let alphaDeg;

  if (mode === "length") {
    L = inp.Lraw;
    if (!Number.isFinite(L) || L <= 0) return { err: "Bitte eine positive Länge L (mm) angeben." };
    D = Math.sqrt(H * H + V * V + L * L);
    const c = L / D;
    if (c >= 1 || c <= 0) return { err: "Ungültige Kombination aus H, V, L." };
    alphaRad = Math.acos(c);
    alphaDeg = (alphaRad * 180) / Math.PI;
  } else {
    alphaDeg = inp.alphaRaw;
    if (!Number.isFinite(alphaDeg) || alphaDeg <= 0 || alphaDeg >= 90)
      return { err: "Winkel α bitte zwischen 0° und 90°." };
    alphaRad = (alphaDeg * Math.PI) / 180;
    const t = Math.tan(alphaRad);
    if (!Number.isFinite(t) || t <= 0) return { err: "Winkel ungültig." };
    L = base / t;
    D = L / Math.cos(alphaRad);
  }

  if (!Number.isFinite(D) || D <= 0) return { err: "Berechnung der Raumdiagonale fehlgeschlagen." };

  return { H, V, L, D, alphaRad, alphaDeg, base, sprung: "space" };
}

function run() {
  const msg = document.getElementById("msg");
  const block = document.getElementById("resultBlock");
  msg.hidden = true;
  msg.textContent = "";
  msg.className = "msg";
  block.hidden = true;

  const inp = collectInputs();
  const geo = computeGeometry(inp);
  if (geo.err) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = geo.err;
    return;
  }

  const { H, V, L, D, alphaRad, alphaDeg } = geo;

  let dn = inp.dn;
  if (!Number.isFinite(dn) || dn <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte Nennweite DN angeben (Auswahl oder bei „Manuell“ das Feld DN).";
    return;
  }

  const gap = Number.isFinite(inp.gap) && inp.gap >= 0 ? inp.gap : 0;
  const R1 = radiusCenterMm(dn, inp.elbow1);
  const R2 = radiusCenterMm(dn, inp.elbow2);

  const halfTan = Math.tan(alphaRad / 2);
  const ded = R1 * halfTan + gap + R2 * halfTan + gap;
  const pass = D - ded;

  if (!Number.isFinite(pass) || pass <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent =
      "Passstück wird ≤ 0 — Kombination aus Diagonale, Bogenradien und Schweißspalt ist nicht plausibel (bitte Eingaben prüfen).";
    return;
  }

  const od = inp.outerMm;
  const wall = inp.wallMm;
  if (!Number.isFinite(od) || od <= 0 || !Number.isFinite(wall) || wall <= 0 || wall >= od / 2) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte gültigen Außen-Ø und Wandstärke angeben.";
    return;
  }

  const rho = DATA?.materialDensityKgM3?.[inp.material] ?? 7850;
  const arcLen = alphaRad * R1 + alphaRad * R2;
  const approxCenterMm = pass + arcLen;
  const kg = metalMassKg(od, wall, approxCenterMm, rho);

  document.getElementById("outPassMm").textContent = `${fmtMm(pass)} mm`;

  const kv = document.getElementById("kvList");
  kv.innerHTML = "";
  const isPlanar = inp.mode === "planar";
  const items = [
    [isPlanar ? "Schräge D (Hypotenuse)" : "Raumdiagonale D", `${fmtMm(D)} mm`],
    [
      isPlanar ? "Winkel α (Achsen, atan H/V)" : "Winkel α (am Passstück / Diagonale)",
      `${fmtDeg(alphaDeg)}°`,
    ],
    ...(isPlanar ? [] : [["Projektion L", `${fmtMm(L)} mm`]]),
    ["R₁ (Mitte, Bogen 1)", `${fmtMm(R1)} mm`],
    ["R₂ (Mitte, Bogen 2)", `${fmtMm(R2)} mm`],
    ["Summe Bogenbögen (Mitte)", `${fmtMm(arcLen)} mm`],
    ["Rohrmasse (Passstück + Bogenbögen, Näherung)", `${fmtKg(kg)} kg`],
  ];
  for (const [k, v] of items) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="etagen-kv__k">${escapeHtml(k)}</span><span class="etagen-kv__v">${escapeHtml(v)}</span>`;
    kv.appendChild(li);
  }

  function fillBend(titleId, dlId, label, elbowId, Rmm) {
    document.getElementById(titleId).textContent = `${label} — ${elbowId} — ${fmtDeg(alphaDeg)}°`;
    const br = bendRows(alphaDeg, Rmm, gap, od);
    const dl = document.getElementById(dlId);
    dl.innerHTML = "";
    const pairs = [
      ["Bogenmaß außen", fmtMm(br.outerArc)],
      ["Baulänge (tan·R+Spalt, Näherung)", fmtMm(br.buildLen)],
      ["Sehne", fmtMm(br.chord)],
      ["Bogenmaß innen", fmtMm(br.innerArc)],
    ];
    for (const [dt, dd] of pairs) {
      const ddt = document.createElement("dt");
      ddt.textContent = dt;
      const ddd = document.createElement("dd");
      ddd.textContent = dd;
      dl.appendChild(ddt);
      dl.appendChild(ddd);
    }
  }

  fillBend("bendTitle1", "bendDl1", "Bogen 1", inp.elbow1, R1);
  fillBend("bendTitle2", "bendDl2", "Bogen 2", inp.elbow2, R2);
  const bendLegendHost = document.getElementById("bendLegendHost");
  if (bendLegendHost) bendLegendHost.innerHTML = renderBendLegendSvg();

  document.getElementById("svgHost").innerHTML = isPlanar
    ? renderSvgPlanar(H, V, alphaDeg, pass, D)
    : renderSvgSpace(H, V, L, alphaDeg, pass, D);
  const cap = document.getElementById("svgCaption");
  cap.hidden = false;
  if (isPlanar) {
    cap.innerHTML = `<strong>Maße:</strong> H=${escapeHtml(fmtMm(H))} mm · V=${escapeHtml(fmtMm(V))} mm · D=${escapeHtml(
      fmtMm(D)
    )} mm · α≈${escapeHtml(fmtDeg(alphaDeg))}° · Passstück≈${escapeHtml(fmtMm(pass))} mm`;
  } else {
    cap.innerHTML = `<strong>Maße:</strong> H=${escapeHtml(fmtMm(H))} mm · V=${escapeHtml(fmtMm(V))} mm · L=${escapeHtml(
      fmtMm(L)
    )} mm · D=${escapeHtml(fmtMm(D))} mm · α≈${escapeHtml(fmtDeg(alphaDeg))}° · Passstück≈${escapeHtml(fmtMm(pass))} mm`;
  }

  block.hidden = false;

  saveState({
    sprung: getSprungMode(),
    mode: document.getElementById("mode-length").classList.contains("etagen-mode-btn--active") ? "length" : "angle",
    H: document.getElementById("inputH").value,
    V: document.getElementById("inputV").value,
    L: document.getElementById("inputL").value,
    alpha: document.getElementById("inputAlpha").value,
    pipeSeries: document.getElementById("pipeSeries").value,
    dn: document.getElementById("dnSelect").value,
    manualDn: document.getElementById("manualDn").value,
    autoWall: document.getElementById("autoWall").checked,
    outerMm: document.getElementById("outerMm").value,
    wallMm: document.getElementById("wallMm").value,
    gapMm: document.getElementById("gapMm").value,
    elbow1: inp.elbow1,
    elbow2: inp.elbow2,
    material: inp.material,
  });
}

function restore(preloaded) {
  const s = preloaded !== undefined ? preloaded : loadSaved();
  if (!s || typeof s !== "object") return;
  const sprung = s.sprung === "planar" ? "planar" : "space";
  setSprungMode(sprung);
  if (sprung === "space" && (s.mode === "length" || s.mode === "angle")) setMode(s.mode);
  if (s.H != null) document.getElementById("inputH").value = String(s.H);
  if (s.V != null) document.getElementById("inputV").value = String(s.V);
  if (s.L != null) document.getElementById("inputL").value = String(s.L);
  if (s.alpha != null) document.getElementById("inputAlpha").value = String(s.alpha);
  if (s.pipeSeries) document.getElementById("pipeSeries").value = s.pipeSeries;
  wireDnDropdown();
  if (s.dn != null) document.getElementById("dnSelect").value = String(s.dn);
  if (s.manualDn != null) document.getElementById("manualDn").value = String(s.manualDn);
  if (typeof s.autoWall === "boolean") document.getElementById("autoWall").checked = s.autoWall;
  if (s.outerMm != null) document.getElementById("outerMm").value = String(s.outerMm);
  if (s.wallMm != null) document.getElementById("wallMm").value = String(s.wallMm);
  if (s.gapMm != null) document.getElementById("gapMm").value = String(s.gapMm);
  if (s.elbow1) document.getElementById("elbow1").value = s.elbow1;
  if (s.elbow2) document.getElementById("elbow2").value = s.elbow2;
  if (s.material) document.getElementById("material").value = s.material;
  applyPipeSelection();
  const rowAfter = selectedPipeRow();
  if (rowAfter && rowAfter.id !== "manual") {
    document.getElementById("manualDn").value = document.getElementById("dnSelect").value;
  }
}

async function init() {
  try {
    const res = await fetch("etagen-daten.json", { cache: "no-store" });
    DATA = await res.json();
  } catch {
    const msg = document.getElementById("msg");
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Daten konnten nicht geladen werden (etagen-daten.json).";
    return;
  }

  populateFromData();

  document.getElementById("sprung-space").addEventListener("click", () => {
    setSprungMode("space");
    run();
  });
  document.getElementById("sprung-planar").addEventListener("click", () => {
    setSprungMode("planar");
    run();
  });

  document.getElementById("pipeSeries").addEventListener("change", () => {
    wireDnDropdown();
    const row = selectedPipeRow();
    if (row && row.id === "manual") {
      const md = document.getElementById("manualDn");
      if (!parseNum(md.value)) md.value = document.getElementById("dnSelect").value || "250";
    } else if (row && row.id !== "manual") {
      const mdVal = parseInt(String(document.getElementById("manualDn").value), 10);
      const pipes = row.pipes ?? [];
      if (pipes.some((p) => p.dn === mdVal)) {
        document.getElementById("dnSelect").value = String(mdVal);
      }
      document.getElementById("manualDn").value = document.getElementById("dnSelect").value;
    }
    applyPipeSelection();
    run();
  });

  document.getElementById("dnSelect").addEventListener("change", () => {
    document.getElementById("manualDn").value = document.getElementById("dnSelect").value;
    applyPipeSelection();
    run();
  });

  document.getElementById("autoWall").addEventListener("change", () => {
    applyPipeSelection();
    run();
  });

  document.getElementById("mode-length").addEventListener("click", () => {
    setMode("length");
    run();
  });
  document.getElementById("mode-angle").addEventListener("click", () => {
    setMode("angle");
    run();
  });

  wireDnDropdown();
  const initialSaved = loadSaved();
  restore(initialSaved);
  if (!initialSaved) setSprungMode("space");

  [
    "inputH",
    "inputV",
    "inputL",
    "inputAlpha",
    "wallMm",
    "outerMm",
    "gapMm",
    "manualDn",
    "elbow1",
    "elbow2",
    "material",
  ].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => run());
    el.addEventListener("change", () => run());
  });

  run();
}

document.addEventListener("DOMContentLoaded", init);
