/**
 * Einheiten-Umrechner + einfacher Taschenrechner.
 */

const STORAGE_MODE = "einheiten-rechner-mode-v1";

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
  if (s.includes("e") || s.includes("E")) s = x.toFixed(8).replace(/\.?0+$/, "");
  return s;
}

function createCalculator() {
  const display = document.getElementById("calcDisplay");
  let operand = null;
  let pendingOp = null;
  /** aktuelle Zeichenkette der eingebenen Zahl */
  let entry = "0";
  /** nach Operator oder Start: nächste Ziffer beginnt neu */
  let newEntry = true;

  function entryNum() {
    const n = parseFloat(entry);
    return Number.isFinite(n) ? n : 0;
  }

  function showEntry() {
    const s = entry.replace(".", ",");
    display.textContent = s.length ? s : "0";
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

  document.getElementById("calcKeys").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
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
