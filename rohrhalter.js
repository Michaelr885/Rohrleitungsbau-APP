/**
 * Rohrhalter — Stützabstände (Merker, keine Normersetzung).
 * Richtwerte: typische Praxis für waagerechte Stahlrohre in Gebäuden/Anlagen.
 */

/** Stützweite in m; „bis“ = Nennweite DN kleiner oder gleich dieser Spalte */
const SUPPORT_BANDS = [
  { dnMax: 25, cold: 2.0, hot: 1.8 },
  { dnMax: 40, cold: 2.5, hot: 2.2 },
  { dnMax: 50, cold: 3.0, hot: 2.6 },
  { dnMax: 65, cold: 3.5, hot: 3.0 },
  { dnMax: 80, cold: 4.0, hot: 3.5 },
  { dnMax: 100, cold: 4.5, hot: 4.0 },
  { dnMax: 125, cold: 5.0, hot: 4.5 },
  { dnMax: 150, cold: 5.5, hot: 5.0 },
  { dnMax: 200, cold: 6.0, hot: 5.5 },
  { dnMax: 250, cold: 7.0, hot: 6.5 },
  { dnMax: 300, cold: 8.0, hot: 7.5 },
  { dnMax: 400, cold: 9.5, hot: 9.0 },
  { dnMax: 500, cold: 11.0, hot: 10.0 },
];

function parseDn(str) {
  const v = parseInt(String(str || "").replace(/\s/g, "").replace(",", "."), 10);
  return Number.isFinite(v) && v > 0 ? v : NaN;
}

function bandForDn(dn) {
  for (const row of SUPPORT_BANDS) {
    if (dn <= row.dnMax) return row;
  }
  return SUPPORT_BANDS[SUPPORT_BANDS.length - 1];
}

function fmtM(n) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function renderSupportSketch(spanM) {
  const W = 520;
  const H = 220;
  const yPipe = 88;
  const yBase = 150;
  const xL = 50;
  const xR = 470;
  const supports = [70, 220, 370, 450];
  const scale = (xR - xL) / 10;
  const spanPx = Math.max(50, Math.min(180, spanM * scale));
  const xA = 210;
  const xB = xA + spanPx;
  const gid = `g-support-${Math.random().toString(36).slice(2, 9)}`;

  const supportSvg = supports
    .map(
      (x) => `<line x1="${x}" y1="${yPipe + 8}" x2="${x}" y2="${yBase}" stroke="rgba(139,155,171,0.65)" stroke-width="2"/>
      <path d="M ${x - 14} ${yBase} L ${x + 14} ${yBase} L ${x} ${yBase + 18} Z" fill="rgba(139,155,171,0.35)"/>`
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Schema Stützabstand Rohrhalter">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#141d28"/>
      <stop offset="100%" style="stop-color:#10161d"/>
    </linearGradient>
    <marker id="arrSpan" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0,0 L7,3.5 L0,7 z" fill="#7dd3fc"/>
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="url(#${gid})" rx="10"/>
  <text x="${W / 2}" y="24" text-anchor="middle" fill="#e8edf2" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">Prinzip Stützabstand a</text>
  <line x1="${xL}" y1="${yPipe}" x2="${xR}" y2="${yPipe}" stroke="#e8935c" stroke-width="8" stroke-linecap="round"/>
  ${supportSvg}
  <line x1="${xA}" y1="${yPipe - 26}" x2="${xB}" y2="${yPipe - 26}" stroke="#7dd3fc" stroke-width="2" marker-start="url(#arrSpan)" marker-end="url(#arrSpan)"/>
  <text x="${(xA + xB) / 2}" y="${yPipe - 34}" text-anchor="middle" fill="#7dd3fc" font-size="12" font-weight="700" font-family="DM Sans,system-ui,sans-serif">a ≈ ${fmtM(spanM)} m</text>
  <text x="${W / 2}" y="${H - 14}" text-anchor="middle" fill="#8b9bab" font-size="10" font-family="DM Sans,system-ui,sans-serif">Abstand zwischen zwei benachbarten Auflagern (schematisch)</text>
</svg>`;
}

function renderTable() {
  const body = document.getElementById("supportTableBody");
  if (!body) return;
  body.innerHTML = SUPPORT_BANDS.map(
    (r) =>
      `<tr><td>≤ ${r.dnMax}</td><td>${fmtM(r.cold)}</td><td>${fmtM(r.hot)}</td></tr>`
  ).join("");
}

function computeSpan() {
  const msg = document.getElementById("msgSpan");
  const out = document.getElementById("resultSpan");
  const dnInp = document.getElementById("dnNom");
  const med = document.getElementById("mediumSpan").value;
  msg.hidden = true;
  msg.textContent = "";
  msg.className = "msg";
  out.hidden = true;

  const dn = parseDn(dnInp.value);
  if (!Number.isFinite(dn)) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte eine gültige DN (positive ganze Zahl) eingeben.";
    return;
  }

  const band = bandForDn(dn);
  const span = med === "hot" ? band.hot : band.cold;
  const label = med === "hot" ? "warm / Dampf / ausgebaut" : "flüssig / kalt / unbeheizt";

  document.getElementById("spanValM").textContent = fmtM(span);
  document.getElementById("spanNote").innerHTML =
    `DN <strong>${dn}</strong> liegt in der Bandbreite bis DN <strong>${band.dnMax}</strong> · gewählt: <strong>${label}</strong>. ` +
    `Werte sind nur grobe Orientierung — Statik, Isolation und Projektregeln können kleinere Abstände erfordern.`;
  const sketch = document.getElementById("supportSvgHost");
  if (sketch) sketch.innerHTML = renderSupportSketch(span);

  out.hidden = false;
}

function init() {
  renderTable();
  document.getElementById("calcSpan").addEventListener("click", computeSpan);
}

document.addEventListener("DOMContentLoaded", init);
