/**
 * Parallele Rohre — vertikaler Versatz der Biegungsanfänge bei gleichem Biegewinkel.
 * Formel: Versatz zwischen zwei Rohren = Abstand × tan(α/2)
 */

const STORAGE_KEY = "parallelrohre-form-v1";

function fmtNum(n, decimals = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function computeOffsetMm(spacingMm, angleDeg) {
  const halfRad = (angleDeg * Math.PI) / 180 / 2;
  return spacingMm * Math.tan(halfRad);
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

function saveState(spacing, angle, count) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ spacing, angle, count })
    );
  } catch {
    /* ignore */
  }
}

function renderSvg(spacingMm, angleDeg, pipeCount, stepMm) {
  const n = Math.max(2, Math.min(12, pipeCount));
  const W = 420;
  const H = 280;
  const pad = 36;
  const pipeGap = (W - 2 * pad) / Math.max(n - 1, 1);

  const labelBand = 34;
  const yBottom = H - labelBand - 8;
  let bendY0 = 78;
  let stepPx = Math.min(26, (yBottom - bendY0 - 36) / Math.max(n - 1, 1));
  if (stepPx < 8) stepPx = 8;

  const legLen = 88;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(angleRad) * legLen;
  const dy = Math.sin(angleRad) * legLen;

  const paths = [];
  const labels = [];

  for (let i = 0; i < n; i++) {
    const x = pad + i * pipeGap;
    const yBend = bendY0 + i * stepPx;
    const x2 = x + dx;
    const y2 = yBend - dy;
    paths.push(
      `<path d="M ${x} ${yBottom} L ${x} ${yBend} L ${x2} ${y2}" fill="none" stroke="#5eb0f0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
    );
    paths.push(`<circle cx="${x}" cy="${yBend}" r="4" fill="#8b9bab"/>`);
    labels.push(
      `<text x="${x}" y="${H - 12}" text-anchor="middle" fill="#8b9bab" font-size="11" font-family="DM Sans,system-ui,sans-serif">Rohr ${i + 1}</text>`
    );
  }

  const note = `Abstand a = ${fmtNum(spacingMm, 0)} mm · Winkel α = ${fmtNum(angleDeg, 0)}° · Schritt h = ${fmtNum(stepMm, 2)} mm`;

  const gid = `bgGrad-${Math.random().toString(36).slice(2, 9)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Schema parallele Rohre mit versetzten Biegungen">
  <defs>
    <linearGradient id="${gid}" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#131c26"/>
      <stop offset="100%" style="stop-color:#0f1419"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#${gid})" rx="8"/>
  <text x="${W / 2}" y="30" text-anchor="middle" fill="#e8edf2" font-size="13" font-weight="600" font-family="DM Sans,system-ui,sans-serif">Prinzip (schematisch, nicht maßstäblich)</text>
  <text x="${W / 2}" y="46" text-anchor="middle" fill="#8b9bab" font-size="10" font-family="DM Sans,system-ui,sans-serif">${escapeHtml(
    note
  )}</text>
  ${paths.join("\n  ")}
  <line x1="${pad}" y1="${bendY0}" x2="${pad + (n - 1) * pipeGap}" y2="${bendY0 + (n - 1) * stepPx}" stroke="rgba(139,155,171,0.35)" stroke-width="1" stroke-dasharray="4 4"/>
  <text x="${pad + 8}" y="${Math.min(bendY0 + (n - 1) * stepPx + 18, yBottom - 6)}" fill="#6b7d8f" font-size="10" font-family="DM Sans,system-ui,sans-serif">versetzte Biegungsanfänge</text>
  ${labels.join("\n  ")}
</svg>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function run() {
  const spacingEl = document.getElementById("spacingMm");
  const angleEl = document.getElementById("angleDeg");
  const countEl = document.getElementById("pipeCount");
  const msg = document.getElementById("msg");

  const spacing = parseFloat(String(spacingEl.value).replace(",", "."));
  const angle = parseFloat(String(angleEl.value).replace(",", "."));
  const count = parseInt(String(countEl.value), 10);

  msg.className = "msg";
  msg.textContent = "";

  if (!Number.isFinite(spacing) || spacing <= 0) {
    msg.className = "msg visible err";
    msg.textContent = "Bitte einen gültigen Rohrabstand größer 0 eingeben.";
    return;
  }
  if (!Number.isFinite(angle) || angle <= 0 || angle >= 180) {
    msg.className = "msg visible err";
    msg.textContent = "Bitte einen Biegewinkel zwischen 0° und 180° eingeben.";
    return;
  }
  if (!Number.isFinite(count) || count < 2 || count > 12) {
    msg.className = "msg visible err";
    msg.textContent = "Anzahl Rohre: 2 bis 12.";
    return;
  }

  const h = computeOffsetMm(spacing, angle);
  saveState(spacing, angle, count);

  const tbody = document.querySelector("#resultTable tbody");
  tbody.innerHTML = "";
  for (let k = 1; k <= count; k++) {
    const cum = (k - 1) * h;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${k}</td><td>${fmtNum(cum, 2)}</td><td>${
      k === 1 ? "—" : fmtNum(h, 2)
    }</td>`;
    tbody.appendChild(tr);
  }

  document.getElementById("formulaStep").textContent = fmtNum(h, 2);
  document.getElementById("diagram").innerHTML = renderSvg(
    spacing,
    angle,
    count,
    h
  );
  document.getElementById("resultBlock").hidden = false;
}

function init() {
  const saved = loadSaved();
  if (saved && saved.spacing != null) {
    document.getElementById("spacingMm").value = String(saved.spacing).replace(".", ",");
    document.getElementById("angleDeg").value = String(saved.angle ?? 45).replace(".", ",");
    document.getElementById("pipeCount").value = String(saved.count ?? 4);
  }

  document.getElementById("calc").addEventListener("click", (e) => {
    e.preventDefault();
    run();
  });

  ["spacingMm", "angleDeg", "pipeCount"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const spacing = parseFloat(
        String(document.getElementById("spacingMm").value).replace(",", ".")
      );
      const angle = parseFloat(
        String(document.getElementById("angleDeg").value).replace(",", ".")
      );
      const count = parseInt(String(document.getElementById("pipeCount").value), 10);
      if (
        Number.isFinite(spacing) &&
        Number.isFinite(angle) &&
        Number.isFinite(count)
      ) {
        saveState(spacing, angle, count);
      }
    });
  });

  run();
}

document.addEventListener("DOMContentLoaded", init);
