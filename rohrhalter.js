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

  out.hidden = false;
}

function init() {
  renderTable();
  document.getElementById("calcSpan").addEventListener("click", computeSpan);
}

document.addEventListener("DOMContentLoaded", init);
