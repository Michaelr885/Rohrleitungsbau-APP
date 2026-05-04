/**
 * Thermische Längenausdehnung: ΔL = α · L · ΔT
 * α in 10^-6/K (wie üblich tabelliert), L in m, T in °C (ΔT = ΔK).
 */

const STORAGE_KEY = "rohr-laengenausdehnung-v1";

/** α in 10^-6 / K (Richtwerte, Orientierung) */
const ALPHA_PRESET = {
  steel: 12,
  stainless: 16.5,
  cu: 17,
  al: 23,
  pp: 150,
  pe: 200,
};

function parseNum(str) {
  const v = parseFloat(String(str || "").replace(",", ".").trim());
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
  const mat = document.getElementById("material");
  if (s.material && [...mat.options].some((o) => o.value === s.material)) {
    mat.value = s.material;
  }
  if (s.alphaManual != null) {
    document.getElementById("alphaManual").value = String(s.alphaManual).replace(".", ",");
  }
  if (s.lengthM != null) document.getElementById("lengthM").value = String(s.lengthM).replace(".", ",");
  if (s.t0 != null) document.getElementById("t0").value = String(s.t0).replace(".", ",");
  if (s.t1 != null) document.getElementById("t1").value = String(s.t1).replace(".", ",");
}

function alphaFromUi() {
  const mat = document.getElementById("material").value;
  if (mat === "custom") {
    const a = parseNum(document.getElementById("alphaManual").value);
    return Number.isFinite(a) && a > 0 ? a * 1e-6 : NaN;
  }
  const preset = ALPHA_PRESET[mat];
  return Number.isFinite(preset) ? preset * 1e-6 : NaN;
}

function alphaDisplayPerMillion() {
  const mat = document.getElementById("material").value;
  if (mat === "custom") {
    const a = parseNum(document.getElementById("alphaManual").value);
    return Number.isFinite(a) && a > 0 ? a : NaN;
  }
  return ALPHA_PRESET[mat] ?? NaN;
}

function compute() {
  const msg = document.getElementById("msg");
  const block = document.getElementById("resultBlock");
  msg.hidden = true;
  msg.textContent = "";
  msg.className = "msg";
  block.hidden = true;

  const L = parseNum(document.getElementById("lengthM").value);
  const t0 = parseNum(document.getElementById("t0").value);
  const t1 = parseNum(document.getElementById("t1").value);
  const mat = document.getElementById("material").value;

  if (mat === "custom") {
    const am = parseNum(document.getElementById("alphaManual").value);
    if (!Number.isFinite(am) || am <= 0) {
      msg.hidden = false;
      msg.className = "msg visible err";
      msg.textContent = "Bitte einen gültigen Wert für α (10⁻⁶/K) eintragen.";
      return;
    }
  }

  const alpha = alphaFromUi();
  if (!Number.isFinite(alpha) || alpha <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte einen gültigen Werkstoff bzw. α wählen.";
    return;
  }
  if (!Number.isFinite(L) || L <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte eine gültige Länge L in Metern angeben.";
    return;
  }
  if (!Number.isFinite(t0)) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte T₀ in °C angeben.";
    return;
  }
  if (!Number.isFinite(t1)) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte T₁ in °C angeben.";
    return;
  }

  const dT = t1 - t0;
  const dLm = alpha * L * dT;
  const dLmm = dLm * 1000;
  const lenAtT1m = L + dLm;

  const aDisp = alphaDisplayPerMillion();

  document.getElementById("alphaUsed").textContent = fmtNum(aDisp, 1, 3);
  document.getElementById("lenUsed").textContent = fmtNum(L, 2, 4);
  document.getElementById("dtUsed").textContent = fmtNum(dT, 1, 2);
  document.getElementById("deltaLmm").textContent = fmtNum(dLmm, 2, 4);
  document.getElementById("deltaLm").textContent = fmtNum(dLm, 4, 6);
  document.getElementById("lenAtT1mm").textContent = fmtNum(lenAtT1m * 1000, 2, 4);

  saveState({
    material: mat,
    alphaManual: mat === "custom" ? parseNum(document.getElementById("alphaManual").value) : null,
    lengthM: L,
    t0,
    t1,
  });

  block.hidden = false;
}

function init() {
  syncDomFromSaved();
  document.getElementById("calc").addEventListener("click", compute);

  document.getElementById("material").addEventListener("change", () => {
    const mat = document.getElementById("material").value;
    if (mat !== "custom") {
      const v = ALPHA_PRESET[mat];
      if (v != null) {
        document.getElementById("alphaManual").value = String(v).replace(".", ",");
      }
    }
    saveState({
      material: mat,
      alphaManual: parseNum(document.getElementById("alphaManual").value),
      lengthM: parseNum(document.getElementById("lengthM").value),
      t0: parseNum(document.getElementById("t0").value),
      t1: parseNum(document.getElementById("t1").value),
    });
  });

  ["alphaManual", "lengthM", "t0", "t1"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      saveState({
        material: document.getElementById("material").value,
        alphaManual: parseNum(document.getElementById("alphaManual").value),
        lengthM: parseNum(document.getElementById("lengthM").value),
        t0: parseNum(document.getElementById("t0").value),
        t1: parseNum(document.getElementById("t1").value),
      });
    });
  });

  const mat0 = document.getElementById("material").value;
  if (mat0 !== "custom" && ALPHA_PRESET[mat0] != null) {
    document.getElementById("alphaManual").value = String(ALPHA_PRESET[mat0]).replace(".", ",");
  }
}

document.addEventListener("DOMContentLoaded", init);
