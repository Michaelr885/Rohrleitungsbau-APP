/**
 * Rohr: Gewicht & Volumen — zylinderförmiges Hohlrohr.
 * ρ Stahl / Edelstahl als typische Näherungen [kg/m³]; Wasser 1000 kg/m³ bei ~20 °C.
 */

const STORAGE_KEY = "rohr-gewicht-v1";

const RHO = {
  steel: 7850,
  stainless: 7900,
};

const RHO_WATER = 1000;

function parseNum(str) {
  const v = parseFloat(String(str || "").replace(",", ".").trim());
  return Number.isFinite(v) ? v : NaN;
}

function fmtNum(n, decimals) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return null;
    return s;
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
  if (s.material === "steel" || s.material === "stainless") {
    document.getElementById("material").value = s.material;
  }
  if (s.lengthM != null) document.getElementById("lengthM").value = String(s.lengthM).replace(".", ",");
  if (s.outerMm != null) document.getElementById("outerMm").value = String(s.outerMm).replace(".", ",");
  if (s.wallMm != null) document.getElementById("wallMm").value = String(s.wallMm).replace(".", ",");
}

function collectInputs() {
  return {
    material: document.getElementById("material").value,
    lengthM: parseNum(document.getElementById("lengthM").value),
    outerMm: parseNum(document.getElementById("outerMm").value),
    wallMm: parseNum(document.getElementById("wallMm").value),
  };
}

function compute() {
  const msg = document.getElementById("msg");
  const block = document.getElementById("resultBlock");
  msg.hidden = true;
  msg.textContent = "";
  msg.className = "msg";
  block.hidden = true;

  const inp = collectInputs();
  const rhoMetal = RHO[inp.material] ?? RHO.steel;

  if (!Number.isFinite(inp.lengthM) || inp.lengthM <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte eine gültige Länge in Metern angeben.";
    return;
  }
  if (!Number.isFinite(inp.outerMm) || inp.outerMm <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte einen gültigen Außen-Ø in mm angeben.";
    return;
  }
  if (!Number.isFinite(inp.wallMm) || inp.wallMm <= 0) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent = "Bitte eine gültige Wandstärke in mm angeben.";
    return;
  }
  if (inp.outerMm <= 2 * inp.wallMm) {
    msg.hidden = false;
    msg.className = "msg visible err";
    msg.textContent =
      "Außen-Ø muss größer als das Doppelte der Wandstärke sein (Innen-Ø muss positiv sein).";
    return;
  }

  const Da_m = inp.outerMm / 1000;
  const s_m = inp.wallMm / 1000;
  const Ro = Da_m / 2;
  const Ri = Ro - s_m;
  const L = inp.lengthM;

  const volWaterM3 = Math.PI * Ri * Ri * L;
  const volMetalM3 = Math.PI * (Ro * Ro - Ri * Ri) * L;

  const massPipeKg = volMetalM3 * rhoMetal;
  const massWaterKg = volWaterM3 * RHO_WATER;
  const massTotalKg = massPipeKg + massWaterKg;

  const volWaterL = volWaterM3 * 1000;
  const volMetalDm3 = volMetalM3 * 1000;

  const innerMm = inp.outerMm - 2 * inp.wallMm;

  document.getElementById("densityLabel").textContent =
    inp.material === "stainless"
      ? "Edelstahl typ. ca. 7,90 kg/dm³ (7900 kg/m³)"
      : "Stahl typ. ca. 7,85 kg/dm³ (7850 kg/m³)";

  document.getElementById("innerDiamMm").textContent = `${fmtNum(innerMm, 3)} mm`;
  document.getElementById("volWaterL").textContent = fmtNum(volWaterL, 3);
  document.getElementById("volWaterM3").textContent = fmtNum(volWaterM3, 6);
  document.getElementById("volMetalDm3").textContent = fmtNum(volMetalDm3, 4);
  document.getElementById("massPipeKg").textContent = fmtNum(massPipeKg, 3);
  document.getElementById("massWaterKg").textContent = fmtNum(massWaterKg, 3);
  document.getElementById("massTotalKg").textContent = fmtNum(massTotalKg, 3);

  saveState({
    material: inp.material,
    lengthM: inp.lengthM,
    outerMm: inp.outerMm,
    wallMm: inp.wallMm,
  });

  block.hidden = false;
}

function init() {
  syncDomFromSaved();
  document.getElementById("calc").addEventListener("click", compute);

  ["material", "lengthM", "outerMm", "wallMm"].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      const inp = collectInputs();
      if (
        Number.isFinite(inp.lengthM) &&
        inp.lengthM > 0 &&
        Number.isFinite(inp.outerMm) &&
        inp.outerMm > 0 &&
        Number.isFinite(inp.wallMm) &&
        inp.wallMm > 0 &&
        inp.outerMm > 2 * inp.wallMm
      ) {
        saveState({
          material: inp.material,
          lengthM: inp.lengthM,
          outerMm: inp.outerMm,
          wallMm: inp.wallMm,
        });
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
