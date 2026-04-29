/**
 * Einheiten-Umrechner + Taschenrechner (Normal / Winkel).
 */

const STORAGE_MODE = "einheiten-rechner-mode-v1";
const STORAGE_CALC_SUB = "einheiten-rechner-calc-sub-v1";
const STORAGE_ANGLE_DEG = "einheiten-rechner-angle-deg-v1";

function parseNum(str) {
  const t = String(str ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  if (t === "" || t === "-" || t === "." || t === "-.") return NaN;
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : NaN;
}

function fmtDe(n, maxFrac = 10) {
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("de-DE", {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  });
}

function wireUnits() {
  const barEl = document.getElementById("barVal");
  const paEl = document.getElementById("paVal");
  const cEl = document.getElementById("celsiusVal");
  const fEl = document.getElementById("fahrenheitVal");
  const m3hEl = document.getElementById("m3hVal");
  const lsEl = document.getElementById("lsVal");

  let lock = null;

  function setLock() {
    lock = true;
    queueMicrotask(() => {
      lock = false;
    });
  }

  barEl.addEventListener("input", () => {
    if (lock) return;
    const bar = parseNum(barEl.value);
    if (!Number.isFinite(bar)) {
      paEl.value = "";
      return;
    }
    setLock();
    paEl.value = fmtDe(bar * 100000, 3);
  });

  paEl.addEventListener("input", () => {
    if (lock) return;
    const pa = parseNum(paEl.value);
    if (!Number.isFinite(pa)) {
      barEl.value = "";
      return;
    }
    setLock();
    barEl.value = fmtDe(pa / 100000, 10);
  });

  cEl.addEventListener("input", () => {
    if (lock) return;
    const c = parseNum(cEl.value);
    if (!Number.isFinite(c)) {
      fEl.value = "";
      return;
    }
    setLock();
    fEl.value = fmtDe((c * 9) / 5 + 32, 6);
  });

  fEl.addEventListener("input", () => {
    if (lock) return;
    const f = parseNum(fEl.value);
    if (!Number.isFinite(f)) {
      cEl.value = "";
      return;
    }
    setLock();
    cEl.value = fmtDe(((f - 32) * 5) / 9, 6);
  });

  m3hEl.addEventListener("input", () => {
    if (lock) return;
    const m3h = parseNum(m3hEl.value);
    if (!Number.isFinite(m3h)) {
      lsEl.value = "";
      return;
    }
    setLock();
    lsEl.value = fmtDe(m3h / 3.6, 10);
  });

  lsEl.addEventListener("input", () => {
    if (lock) return;
    const ls = parseNum(lsEl.value);
    if (!Number.isFinite(ls)) {
      m3hEl.value = "";
      return;
    }
    setLock();
    m3hEl.value = fmtDe(ls * 3.6, 10);
  });
}

function applyBinOp(a, b, op) {
  switch (op) {
    case "+":
      return a + b;
    case "-":
      return a - b;
    case "*":
      return a * b;
    case "/":
      if (b === 0) return NaN;
      return a / b;
    default:
      return b;
  }
}

function formatCalcEntry(r) {
  if (!Number.isFinite(r)) return "0";
  const x = Number(r.toPrecision(14));
  let s = String(x);
  if (s.includes("e") || s.includes("E")) s = x.toFixed(10).replace(/\.?0+$/, "");
  return s;
}

function applyAngleFn(fn, displayVal, inputIsDeg) {
  const v = displayVal;
  const radFromInput = inputIsDeg ? (v * Math.PI) / 180 : v;

  switch (fn) {
    case "sin":
      return Math.sin(radFromInput);
    case "cos":
      return Math.cos(radFromInput);
    case "tan": {
      const t = Math.tan(radFromInput);
      if (!Number.isFinite(t) || Math.abs(t) > 1e15) return NaN;
      return t;
    }
    case "atan": {
      const ar = Math.atan(v);
      return inputIsDeg ? (ar * 180) / Math.PI : ar;
    }
    case "deg2rad":
      return (v * Math.PI) / 180;
    case "rad2deg":
      return (v * 180) / Math.PI;
    default:
      return NaN;
  }
}

function createCalculator() {
  const display = document.getElementById("calcDisplay");
  const panelCalc = document.getElementById("panel-calc");
  const keysPad = document.getElementById("calcKeysPad");
  const keysAngleRow = document.getElementById("calcKeysAngleRow");
  const btnBasic = document.getElementById("calc-sub-basic");
  const btnAngle = document.getElementById("calc-sub-angle");
  const angleUnitWrap = document.getElementById("calcAngleUnitWrap");
  const angleUnitToggle = document.getElementById("calcAngleUnitToggle");
  const angleHint = document.getElementById("calcAngleHint");

  let operand = null;
  let pendingOp = null;
  let entry = "0";
  let newEntry = true;

  /** @type {'basic' | 'angle'} */
  let calcSubMode = "basic";
  /** sin/cos/tan: Eingabe als Grad vs. Radiant (atan-Ausgabe followt) */
  let angleInputDeg = true;

  function loadCalcPrefs() {
    try {
      const s = localStorage.getItem(STORAGE_CALC_SUB);
      if (s === "basic" || s === "angle") calcSubMode = s;
      const d = localStorage.getItem(STORAGE_ANGLE_DEG);
      if (d === "0") angleInputDeg = false;
      if (d === "1") angleInputDeg = true;
    } catch (_) {}
  }

  function saveCalcPrefs() {
    try {
      localStorage.setItem(STORAGE_CALC_SUB, calcSubMode);
      localStorage.setItem(STORAGE_ANGLE_DEG, angleInputDeg ? "1" : "0");
    } catch (_) {}
  }

  function entryNum() {
    const n = parseFloat(entry);
    return Number.isFinite(n) ? n : 0;
  }

  function showEntry() {
    const s = entry.replace(".", ",");
    display.textContent = s.length ? s : "0";
  }

  function updateSubModeUi() {
    const angle = calcSubMode === "angle";
    keysAngleRow.hidden = !angle;
    btnBasic.classList.toggle("calc-submode-btn--active", !angle);
    btnAngle.classList.toggle("calc-submode-btn--active", angle);
    angleUnitWrap.hidden = !angle;
    angleHint.hidden = !angle;
    if (angleUnitToggle) {
      angleUnitToggle.textContent = angleInputDeg ? "Grad (°)" : "Radiant (rad)";
      angleUnitToggle.setAttribute("aria-pressed", angleInputDeg ? "true" : "false");
    }
    saveCalcPrefs();
  }

  function clearAll() {
    operand = null;
    pendingOp = null;
    entry = "0";
    newEntry = true;
    showEntry();
  }

  function appendDigit(d) {
    if (newEntry) {
      entry = d;
      newEntry = false;
    } else {
      if (entry === "0" && d !== "0") entry = d;
      else if (entry !== "0" || d === "0") entry += d;
    }
    showEntry();
  }

  function appendDot() {
    if (newEntry) {
      entry = "0.";
      newEntry = false;
      showEntry();
      return;
    }
    if (!entry.includes(".")) entry += ".";
    showEntry();
  }

  function backspace() {
    if (newEntry) return;
    if (entry.length <= 1) {
      entry = "0";
      newEntry = true;
    } else entry = entry.slice(0, -1);
    showEntry();
  }

  function pressOperator(op) {
    const v = entryNum();
    if (operand !== null && pendingOp !== null && !newEntry) {
      const r = applyBinOp(operand, v, pendingOp);
      if (!Number.isFinite(r)) {
        display.textContent = "Fehler";
        clearAll();
        return;
      }
      operand = r;
      entry = formatCalcEntry(r);
      showEntry();
    } else {
      operand = v;
    }
    pendingOp = op;
    newEntry = true;
    showEntry();
  }

  function pressEquals() {
    if (pendingOp === null || operand === null) return;
    const v = entryNum();
    const r = applyBinOp(operand, v, pendingOp);
    if (!Number.isFinite(r)) {
      display.textContent = "Fehler";
      clearAll();
      return;
    }
    entry = formatCalcEntry(r);
    operand = null;
    pendingOp = null;
    newEntry = true;
    showEntry();
  }

  function pressAngleFn(fn) {
    const v = entryNum();
    let r;
    if (fn === "deg2rad") {
      r = applyAngleFn(fn, v, true);
    } else if (fn === "rad2deg") {
      r = applyAngleFn(fn, v, false);
    } else {
      r = applyAngleFn(fn, v, angleInputDeg);
    }
    if (!Number.isFinite(r)) {
      display.textContent = "Fehler";
      clearAll();
      return;
    }
    entry = formatCalcEntry(r);
    newEntry = true;
    showEntry();
  }

  loadCalcPrefs();
  updateSubModeUi();

  btnBasic.addEventListener("click", () => {
    calcSubMode = "basic";
    updateSubModeUi();
  });
  btnAngle.addEventListener("click", () => {
    calcSubMode = "angle";
    updateSubModeUi();
  });

  angleUnitToggle.addEventListener("click", () => {
    angleInputDeg = !angleInputDeg;
    updateSubModeUi();
  });

  panelCalc.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || !panelCalc.contains(btn)) return;

    const fn = btn.getAttribute("data-fn");
    if (fn) {
      pressAngleFn(fn);
      return;
    }

    const digit = btn.getAttribute("data-digit");
    const op = btn.getAttribute("data-op");
    const act = btn.getAttribute("data-act");

    if (digit !== null) {
      appendDigit(digit);
      return;
    }
    if (op) {
      pressOperator(op);
      return;
    }
    if (act === "dot") {
      appendDot();
      return;
    }
    if (act === "clear") {
      clearAll();
      return;
    }
    if (act === "back") {
      backspace();
      return;
    }
    if (act === "eq") {
      pressEquals();
      return;
    }
  });

  showEntry();
}

function setMode(mode) {
  const unitsPanel = document.getElementById("panel-units");
  const calcPanel = document.getElementById("panel-calc");
  const btnUnits = document.getElementById("mode-units");
  const btnCalc = document.getElementById("mode-calc");

  const isUnits = mode === "units";
  unitsPanel.hidden = !isUnits;
  calcPanel.hidden = isUnits;
  btnUnits.classList.toggle("calc-mode-btn--active", isUnits);
  btnCalc.classList.toggle("calc-mode-btn--active", !isUnits);
  btnUnits.setAttribute("aria-selected", isUnits ? "true" : "false");
  btnCalc.setAttribute("aria-selected", !isUnits ? "true" : "false");

  try {
    localStorage.setItem(STORAGE_MODE, mode);
  } catch (_) {}
}

function initModeToggle() {
  document.querySelectorAll(".calc-mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => setMode(btn.getAttribute("data-mode")));
  });

  let saved = "units";
  try {
    const s = localStorage.getItem(STORAGE_MODE);
    if (s === "units" || s === "calc") saved = s;
  } catch (_) {}
  setMode(saved);
}

document.addEventListener("DOMContentLoaded", () => {
  wireUnits();
  initModeToggle();
  createCalculator();
});
