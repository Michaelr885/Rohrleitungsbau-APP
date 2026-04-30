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

function buildDevelopmentSvg(D, d, L, n) {
  const U = Math.PI * D;
  const CD = U / n;
  const Cd = (Math.PI * d) / n;

  const padX = U * 0.04;
  const padY = L * 0.12;
  const vbW = U + 2 * padX;
  const vbH = L + 2 * padY;
  const x0 = padX;
  const yTop = padY;
  const yBot = padY + L;

  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Abwicklung Reduzierung">`
  );
  parts.push(`<defs>
    <pattern id="reducer-cut" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
      <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(248,113,113,0.35)" stroke-width="2"/>
    </pattern>
  </defs>`);

  parts.push(
    `<rect x="0" y="0" width="${vbW}" height="${vbH}" fill="rgba(15,20,25,0.35)" rx="4"/>`
  );

  for (let k = 0; k < n; k++) {
    const xL = x0 + k * CD;
    const xR = x0 + (k + 1) * CD;
    const cx = x0 + (k + 0.5) * CD;
    const xSl = cx - Cd / 2;
    const xSr = cx + Cd / 2;
    const wedgeLeft = `${xL},${yBot} ${xSl},${yTop} ${xL},${yTop}`;
    const wedgeRight = `${xSr},${yTop} ${xR},${yTop} ${xR},${yBot}`;
    const sw = Math.max(0.5, U * 0.001);
    parts.push(
      `<polygon points="${wedgeLeft}" fill="url(#reducer-cut)" stroke="rgba(248,113,113,0.45)" stroke-width="${sw}"/>`
    );
    parts.push(
      `<polygon points="${wedgeRight}" fill="url(#reducer-cut)" stroke="rgba(248,113,113,0.45)" stroke-width="${sw}"/>`
    );
  }

  const palette = ["rgba(61,157,240,0.5)", "rgba(74,222,128,0.45)", "rgba(196,181,253,0.48)"];
  for (let k = 0; k < n; k++) {
    const xL = x0 + k * CD;
    const xR = x0 + (k + 1) * CD;
    const cx = x0 + (k + 0.5) * CD;
    const xSl = cx - Cd / 2;
    const xSr = cx + Cd / 2;
    const fill = palette[k % palette.length];
    const pts = `${xL},${yBot} ${xR},${yBot} ${xSr},${yTop} ${xSl},${yTop}`;
    parts.push(
      `<polygon points="${pts}" fill="${fill}" stroke="rgba(232,237,242,0.55)" stroke-width="${Math.max(
        0.6,
        U * 0.0012
      )}"/>`
    );
  }

  parts.push(
    `<line x1="${x0}" y1="${yBot}" x2="${x0 + U}" y2="${yBot}" stroke="rgba(232,237,242,0.85)" stroke-width="${Math.max(
      1,
      U * 0.0015
    )}"/>`
  );
  parts.push(
    `<line x1="${x0}" y1="${yTop}" x2="${x0 + U}" y2="${yTop}" stroke="rgba(232,237,242,0.85)" stroke-width="${Math.max(
      1,
      U * 0.0015
    )}"/>`
  );

  const fs = Math.max(10, Math.min(22, U * 0.028));
  const labelY = Math.max(8, padY * 0.55);
  parts.push(
    `<text x="${vbW / 2}" y="${labelY}" text-anchor="middle" fill="rgba(232,237,242,0.9)" font-size="${fs}" font-family="DM Sans, system-ui, sans-serif">großer Ø (U = ${esc(
      fmtNum(U, 2, 2)
    )} mm)</text>`
  );
  parts.push(
    `<text x="${vbW / 2}" y="${vbH - labelY * 0.35}" text-anchor="middle" fill="rgba(232,237,242,0.85)" font-size="${fs}" font-family="DM Sans, system-ui, sans-serif">kleiner Ø · n = ${n}</text>`
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
