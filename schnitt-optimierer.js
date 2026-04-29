/**
 * Schnitt-Optimierer — 1D Stangen & 2D Platten
 *
 * 1D: Beim Bel einer Stange zählt jedes weitere Teil einen Schnittspalt VOR dem Teil:
 *     Bedarf = L1 + (kerf + L2) + (kerf + L3) + … = Summe(L) + (n−1)·kerf  (n Teile auf einer Stange).
 *     So wie bei realen Sägeschnitten zwischen den Stücken; kein „Schwanz“-Kerf nach dem letzten Stück.
 *
 * 2D: Rechteck-Packing mit Guillotine-Packer; Kantenabstand der Teil-Footprints enthält kerf (wie im Original).
 */

const STORAGE_KEY = "schnitt-optimierer-v1";

class Packer {
  constructor(w, h) {
    this.root = { x: 0, y: 0, w, h };
  }

  fit(blocks) {
    for (let n = 0; n < blocks.length; n++) {
      const block = blocks[n];
      delete block.fit;
      const node = this.findNode(this.root, block.w, block.h);
      if (node) block.fit = this.splitNode(node, block.w, block.h);
    }
  }

  findNode(root, w, h) {
    if (root.used)
      return this.findNode(root.right, w, h) || this.findNode(root.down, w, h);
    if (w <= root.w && h <= root.h) return root;
    return null;
  }

  splitNode(node, w, h) {
    node.used = true;
    node.down = { x: node.x, y: node.y + h, w: node.w, h: node.h - h };
    node.right = { x: node.x + w, y: node.y, w: node.w - w, h };
    return node;
  }
}

function parseNum(el) {
  const v = parseFloat(String(el.value).replace(",", "."));
  return Number.isFinite(v) ? v : 0;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowIndexLabel1D(rowId) {
  const ix = state.items1D.findIndex((i) => i.id === rowId);
  return ix >= 0 ? String(ix + 1) : "—";
}

function rowIndexLabel2D(rowId) {
  const ix = state.items2D.findIndex((i) => i.id === rowId);
  return ix >= 0 ? String(ix + 1) : "—";
}

let state = {
  mode: "1d",
  stockLength: 6000,
  bladeWidth1D: 3,
  items1D: [
    { id: 1, length: 1860, quantity: 2 },
    { id: 2, length: 2800, quantity: 2 },
  ],
  sheetWidth: 2000,
  sheetHeight: 1000,
  bladeWidth2D: 3,
  items2D: [
    { id: 1, width: 500, height: 400, quantity: 5 },
    { id: 2, width: 800, height: 600, quantity: 2 },
  ],
};

let results1D = null;
let stats1D = null;
let results2D = null;
let stats2D = null;
let errorMsg = "";

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        stockLength: state.stockLength,
        bladeWidth1D: state.bladeWidth1D,
        items1D: state.items1D,
        sheetWidth: state.sheetWidth,
        sheetHeight: state.sheetHeight,
        bladeWidth2D: state.bladeWidth2D,
        items2D: state.items2D,
      })
    );
  } catch (_) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object") return;
    if (s.mode === "1d" || s.mode === "2d") state.mode = s.mode;
    if (s.stockLength != null) state.stockLength = s.stockLength;
    if (s.bladeWidth1D != null) state.bladeWidth1D = s.bladeWidth1D;
    if (Array.isArray(s.items1D)) state.items1D = s.items1D;
    if (s.sheetWidth != null) state.sheetWidth = s.sheetWidth;
    if (s.sheetHeight != null) state.sheetHeight = s.sheetHeight;
    if (s.bladeWidth2D != null) state.bladeWidth2D = s.bladeWidth2D;
    if (Array.isArray(s.items2D)) state.items2D = s.items2D;
  } catch (_) {}
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("[data-mode-tab]").forEach((btn) => {
    const m = btn.getAttribute("data-mode-tab");
    btn.classList.toggle("schnitt-tab--active", m === mode);
    btn.setAttribute("aria-selected", m === mode ? "true" : "false");
  });
  document.getElementById("section-1d").hidden = mode !== "1d";
  document.getElementById("section-2d").hidden = mode !== "2d";
  document.getElementById("results-1d").hidden = true;
  document.getElementById("results-2d").hidden = true;
  errorMsg = "";
  renderError();
  saveState();
}

function renderError() {
  const el = document.getElementById("cut-error");
  if (!errorMsg) {
    el.className = "msg";
    el.textContent = "";
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.className = "msg visible err";
  el.textContent = errorMsg;
}

function renderItems1D() {
  const root = document.getElementById("items-1d");
  root.innerHTML = "";
  state.items1D.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cut-item-row";
    row.innerHTML = `
      <span class="cut-item-num">#${index + 1}</span>
      <input type="text" inputmode="decimal" class="cut-inp" data-field="length" data-id="${item.id}" value="${item.length || ""}" placeholder="Länge mm" aria-label="Länge mm" />
      <input type="text" inputmode="numeric" class="cut-inp cut-inp--qty" data-field="quantity" data-id="${item.id}" value="${item.quantity || ""}" placeholder="Anz." aria-label="Anzahl" />
      <button type="button" class="cut-remove" data-remove-1d="${item.id}" aria-label="Zeile löschen">✕</button>
    `;
    root.appendChild(row);
  });
}

function renderItems2D() {
  const root = document.getElementById("items-2d");
  root.innerHTML = "";
  state.items2D.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "cut-item-row cut-item-row--2d";
    row.innerHTML = `
      <span class="cut-item-num">#${index + 1}</span>
      <div class="cut-pair">
        <input type="text" inputmode="decimal" class="cut-inp" data-field="width" data-id="${item.id}" value="${item.width || ""}" placeholder="B" aria-label="Breite mm" />
        <span class="cut-x">×</span>
        <input type="text" inputmode="decimal" class="cut-inp" data-field="height" data-id="${item.id}" value="${item.height || ""}" placeholder="H" aria-label="Höhe mm" />
      </div>
      <input type="text" inputmode="numeric" class="cut-inp cut-inp--qty" data-field="quantity" data-id="${item.id}" value="${item.quantity || ""}" placeholder="Anz." aria-label="Anzahl" />
      <button type="button" class="cut-remove" data-remove-2d="${item.id}" aria-label="Zeile löschen">✕</button>
    `;
    root.appendChild(row);
  });
}

function bindInputsFromDom() {
  state.stockLength = parseNum(document.getElementById("stockLength"));
  state.bladeWidth1D = parseNum(document.getElementById("bladeWidth1D"));
  state.sheetWidth = parseNum(document.getElementById("sheetWidth"));
  state.sheetHeight = parseNum(document.getElementById("sheetHeight"));
  state.bladeWidth2D = parseNum(document.getElementById("bladeWidth2D"));

  document.querySelectorAll("#items-1d [data-field]").forEach((inp) => {
    const id = Number(inp.getAttribute("data-id"));
    const field = inp.getAttribute("data-field");
    const item = state.items1D.find((i) => i.id === id);
    if (!item) return;
    const v = inp.classList.contains("cut-inp--qty")
      ? parseInt(inp.value, 10) || 0
      : parseNum(inp);
    item[field] = v;
  });

  document.querySelectorAll("#items-2d [data-field]").forEach((inp) => {
    const id = Number(inp.getAttribute("data-id"));
    const field = inp.getAttribute("data-field");
    const item = state.items2D.find((i) => i.id === id);
    if (!item) return;
    const v = inp.classList.contains("cut-inp--qty")
      ? parseInt(inp.value, 10) || 0
      : parseNum(inp);
    item[field] = v;
  });
}

function calculate1D() {
  bindInputsFromDom();
  errorMsg = "";
  results1D = null;
  stats1D = null;
  document.getElementById("results-1d").hidden = true;
  document.getElementById("results-2d").hidden = true;

  if (state.stockLength <= 0) {
    errorMsg = "Stangenlänge ungültig.";
    renderError();
    return;
  }

  const blade = state.bladeWidth1D;
  const stock = state.stockLength;
  const allCuts = [];
  const errors = [];

  for (const item of state.items1D) {
    if (item.length <= 0 || item.quantity <= 0) continue;
    if (item.length > stock) errors.push(`Teil ${item.length} mm ist länger als die Stange.`);
    for (let i = 0; i < item.quantity; i++) {
      allCuts.push({
        rowId: item.id,
        rowIdx: rowIndexLabel1D(item.id),
        length: item.length,
      });
    }
  }

  if (errors.length) {
    errorMsg = errors[0];
    renderError();
    return;
  }
  if (allCuts.length === 0) {
    errorMsg = "Keine Teile eingetragen.";
    renderError();
    return;
  }

  let pid = 1;
  const cutsWithIds = allCuts.map((c) => ({
    ...c,
    pieceId: pid++,
  }));

  cutsWithIds.sort((a, b) => b.length - a.length);
  const bars = [];

  function spaceIfAdded(bar, cutLen) {
    const n = bar.cuts.length;
    const kerfs = n > 0 ? blade : 0;
    return kerfs + cutLen;
  }

  for (const cut of cutsWithIds) {
    let placed = false;
    for (const bar of bars) {
      const need = spaceIfAdded(bar, cut.length);
      if (bar.remainingSpace >= need) {
        bar.cuts.push(cut);
        bar.remainingSpace -= need;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bars.push({
        cuts: [cut],
        remainingSpace: stock - cut.length,
      });
    }
  }

  const totalWaste = bars.reduce((a, b) => a + b.remainingSpace, 0);
  const usedMat = bars.length * stock;
  const reqMat = cutsWithIds.reduce((acc, c) => acc + c.length, 0);

  const assignRows = [];
  bars.forEach((bar, bi) => {
    bar.cuts.forEach((cut) => {
      assignRows.push({
        pieceId: cut.pieceId,
        lengthMm: cut.length,
        rowIdx: cut.rowIdx,
        barNumber: bi + 1,
      });
    });
  });
  assignRows.sort((a, b) => a.pieceId - b.pieceId);

  stats1D = {
    totalBars: bars.length,
    wastePercentage: usedMat > 0 ? ((usedMat - reqMat) / usedMat) * 100 : 0,
    totalWaste,
    assignRows,
  };
  results1D = bars;

  renderError();
  renderResults1D();
  saveState();
}

function partFitsSheet(w, h, sw, sh, blade) {
  const W = w + blade;
  const H = h + blade;
  const fitsNormal = W <= sw && H <= sh;
  const fitsRot = W <= sh && H <= sw;
  return fitsNormal || fitsRot;
}

function calculate2D() {
  bindInputsFromDom();
  errorMsg = "";
  results2D = null;
  stats2D = null;
  document.getElementById("results-2d").hidden = true;
  document.getElementById("results-1d").hidden = true;

  const sw = state.sheetWidth;
  const sh = state.sheetHeight;
  const blade = state.bladeWidth2D;

  if (sw <= 0 || sh <= 0) {
    errorMsg = "Plattengröße ungültig.";
    renderError();
    return;
  }

  let pieceId2 = 1;
  const blocks = [];

  for (const item of state.items2D) {
    if (item.width <= 0 || item.height <= 0 || item.quantity <= 0) continue;
    if (!partFitsSheet(item.width, item.height, sw, sh, blade)) {
      errorMsg = `Teil ${item.width}×${item.height} mm passt nicht auf die Platte.`;
      renderError();
      return;
    }
    for (let i = 0; i < item.quantity; i++) {
      blocks.push({
        w: item.width + blade,
        h: item.height + blade,
        originalW: item.width,
        originalH: item.height,
        rowId: item.id,
        rowIdx: rowIndexLabel2D(item.id),
        pieceId: pieceId2++,
      });
    }
  }

  if (blocks.length === 0) {
    errorMsg = "Keine Platten-Teile eingetragen.";
    renderError();
    return;
  }

  blocks.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h));

  const sheets = [];
  let unpacked = blocks.map((b) => ({ ...b }));

  let safety = 0;
  while (unpacked.length > 0 && safety < 100) {
    safety++;
    for (const b of unpacked) delete b.fit;

    const packer = new Packer(sw, sh);
    packer.fit(unpacked);

    const current = [];
    const next = [];

    for (const block of unpacked) {
      if (block.fit) current.push(block);
      else next.push(block);
    }

    if (next.length === unpacked.length) {
      errorMsg = "Ein Teil ist zu groß für die Platte (Packung nicht möglich).";
      renderError();
      return;
    }

    sheets.push({ blocks: current });
    unpacked = next;
  }

  const usedAreaTotal = sheets.length * sw * sh;
  const partsAreaTotal = blocks.reduce(
    (acc, b) => acc + b.originalW * b.originalH,
    0
  );
  const wastePct =
    usedAreaTotal > 0 ? ((usedAreaTotal - partsAreaTotal) / usedAreaTotal) * 100 : 0;

  stats2D = {
    totalSheets: sheets.length,
    wastePercentage: wastePct,
    usedArea: partsAreaTotal,
    assignRows: [],
  };
  results2D = sheets;

  const assignRows2d = [];
  sheets.forEach((sheet, si) => {
    sheet.blocks.forEach((block) => {
      assignRows2d.push({
        pieceId: block.pieceId,
        widthMm: block.originalW,
        heightMm: block.originalH,
        rowIdx: block.rowIdx,
        sheetNumber: si + 1,
      });
    });
  });
  assignRows2d.sort((a, b) => a.pieceId - b.pieceId);
  stats2D.assignRows = assignRows2d;

  renderError();
  renderResults2D(sw, sh);
  saveState();
}

function renderAssignTable1D() {
  const el = document.getElementById("cut-assign-1d");
  if (!stats1D || !stats1D.assignRows || !stats1D.assignRows.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  const rows = stats1D.assignRows
    .map(
      (r) =>
        `<tr><td>${r.pieceId}</td><td>${r.lengthMm} mm</td><td>Zeile ${r.rowIdx}</td><td>Stange ${r.barNumber}</td></tr>`
    )
    .join("");
  el.innerHTML = `
    <h2 class="assign-title">Wofür welche Stange?</h2>
    <p class="assign-lead">Jedes Stück (Nr.) schneidest du aus der angegebenen Stange — Reihenfolge von links nach rechts im Balken oben.</p>
    <div class="table-wrap">
      <table class="data-table data-table--assign">
        <thead>
          <tr><th>Stück</th><th>Länge</th><th>aus Teile-Zeile</th><th>Stange</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderAssignTable2D() {
  const el = document.getElementById("cut-assign-2d");
  if (!stats2D || !stats2D.assignRows || !stats2D.assignRows.length) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  const rows = stats2D.assignRows
    .map(
      (r) =>
        `<tr><td>${r.pieceId}</td><td>${r.widthMm}×${r.heightMm} mm</td><td>Zeile ${r.rowIdx}</td><td>Platte ${r.sheetNumber}</td></tr>`
    )
    .join("");
  el.innerHTML = `
    <h2 class="assign-title">Wofür welche Platte?</h2>
    <p class="assign-lead">Position siehe Skizze — gleiche Nummer wie im Diagramm.</p>
    <div class="table-wrap">
      <table class="data-table data-table--assign">
        <thead>
          <tr><th>Stück</th><th>Maße</th><th>aus Teile-Zeile</th><th>Platte</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderResults1D() {
  const wrap = document.getElementById("results-1d");
  const stock = state.stockLength;
  if (!results1D || !stats1D) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  document.getElementById("stat-bars").textContent = String(stats1D.totalBars);
  document.getElementById("stat-waste-1d").textContent = fmt(stats1D.wastePercentage, 1);

  renderAssignTable1D();

  const list = document.getElementById("bars-list");
  list.innerHTML = "";

  const blade = state.bladeWidth1D;
  results1D.forEach((bar, idx) => {
    const card = document.createElement("div");
    card.className = "card cut-result-card";
    const segs = bar.cuts
      .map((cut, ci) => {
        const first = ci === 0;
        const segsW = first ? cut.length : blade + cut.length;
        const pct = (segsW / stock) * 100;
        const title = first
          ? `Stück ${cut.pieceId}: ${cut.length} mm`
          : `${blade} mm Kerf + Stück ${cut.pieceId}: ${cut.length} mm`;
        const inner = first
          ? `<span class="cut-bar-piece-id">${cut.pieceId}</span><span class="cut-bar-mm">${cut.length}</span>`
          : `<span class="cut-bar-kerf">${blade}</span><span class="cut-bar-plus">+</span><span class="cut-bar-piece-id">${cut.pieceId}</span><span class="cut-bar-mm">${cut.length}</span>`;
        return `<div class="cut-bar-seg${first ? "" : " cut-bar-seg--with-kerf"}" style="width:${pct}%" title="${escapeHtml(title)}">${inner}</div>`;
      })
      .join("");
    const restPct = (bar.remainingSpace / stock) * 100;
    card.innerHTML = `
      <div class="cut-result-head">
        <strong>Stange ${idx + 1}</strong>
        <span class="cut-result-rest">Rest: ${fmt(bar.remainingSpace, 0)} mm</span>
      </div>
      <div class="cut-bar-track" role="img" aria-label="Schnittverteilung">
        ${segs}
        <div class="cut-bar-rest" style="width:${restPct}%"><span>Rest</span></div>
      </div>
    `;
    list.appendChild(card);
  });
}

function renderResults2D(sw, sh) {
  const wrap = document.getElementById("results-2d");
  if (!results2D || !stats2D) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  document.getElementById("stat-sheets").textContent = String(stats2D.totalSheets);
  document.getElementById("stat-waste-2d").textContent = fmt(stats2D.wastePercentage, 1);

  renderAssignTable2D();

  const list = document.getElementById("sheets-list");
  list.innerHTML = "";

  const strokeW = Math.max(sw, sh) / 400;

  results2D.forEach((sheet, idx) => {
    const usedArea = sheet.blocks.reduce(
      (a, b) => a + b.originalW * b.originalH,
      0
    );
    const wasteSheet =
      sw * sh > 0 ? ((1 - usedArea / (sw * sh)) * 100).toFixed(1) : "0";

    const rects = sheet.blocks
      .map((block, bIdx) => {
        const cx = block.fit.x + block.originalW / 2;
        const cy = block.fit.y + block.originalH / 2;
        const fsDim = Math.min(block.originalW, block.originalH) / 5;
        const fsId = Math.min(block.originalW, block.originalH) / 3.5;
        const showDim =
          block.originalW > sw / 18 && block.originalH > sh / 18;
        const dimLabel = showDim
          ? `<text x="${cx}" y="${cy + fsDim * 0.35}" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.95)" font-size="${fsDim}" font-family="DM Sans, sans-serif" pointer-events="none">${block.originalW}×${block.originalH}</text>`
          : "";
        const idLabel = `<text x="${cx}" y="${cy - fsDim * 0.5}" dominant-baseline="middle" text-anchor="middle" fill="#fef08a" font-weight="700" font-size="${fsId}" font-family="DM Sans, sans-serif" pointer-events="none">#${block.pieceId}</text>`;
        return `<g>
      <rect x="${block.fit.x}" y="${block.fit.y}" width="${block.originalW}" height="${block.originalH}" fill="#3d9df0" stroke="#1e5a8a" stroke-width="${strokeW}"/>
      ${idLabel}
      ${dimLabel}
    </g>`;
      })
      .join("");

    const div = document.createElement("div");
    div.className = "card cut-result-card";
    div.innerHTML = `
      <div class="cut-result-head">
        <strong>Platte ${idx + 1}</strong>
        <span class="cut-plate-badge">${sw} × ${sh} mm</span>
      </div>
      <div class="cut-sheet-svg-wrap" style="aspect-ratio: ${sw} / ${sh}">
        <svg viewBox="0 0 ${sw} ${sh}" class="cut-sheet-svg" preserveAspectRatio="xMidYMid meet" aria-label="Plattenbelegung">
          <rect x="0" y="0" width="${sw}" height="${sh}" fill="#2a3644"/>
          ${rects}
        </svg>
      </div>
      <p class="cut-sheet-foot">Hintergrund = Platte; blaue Flächen = Teile. Abfall auf dieser Platte ca. ${wasteSheet} %.</p>
    `;
    list.appendChild(div);
  });
}

function syncDomFromState() {
  document.getElementById("stockLength").value = String(state.stockLength).replace(".", ",");
  document.getElementById("bladeWidth1D").value = String(state.bladeWidth1D).replace(".", ",");
  document.getElementById("sheetWidth").value = String(state.sheetWidth).replace(".", ",");
  document.getElementById("sheetHeight").value = String(state.sheetHeight).replace(".", ",");
  document.getElementById("bladeWidth2D").value = String(state.bladeWidth2D).replace(".", ",");
  renderItems1D();
  renderItems2D();
}

function addItem1DRow(focusLength = true) {
  bindInputsFromDom();
  const newId = Date.now();
  state.items1D.push({
    id: newId,
    length: 0,
    quantity: 1,
  });
  renderItems1D();
  saveState();
  if (focusLength) {
    requestAnimationFrame(() => {
      const inp = document.querySelector(
        `#items-1d input[data-field="length"][data-id="${newId}"]`
      );
      if (inp) inp.focus();
    });
  }
}

function init() {
  loadState();
  syncDomFromState();
  setMode(state.mode);

  document.querySelectorAll("[data-mode-tab]").forEach((btn) => {
    btn.addEventListener("click", () =>
      setMode(btn.getAttribute("data-mode-tab"))
    );
  });

  document.getElementById("add-1d").addEventListener("click", () => addItem1DRow(true));

  document.getElementById("section-1d").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const id = e.target && e.target.id;
    if (id !== "stockLength" && id !== "bladeWidth1D") return;
    e.preventDefault();
    addItem1DRow(true);
  });

  document.getElementById("add-2d").addEventListener("click", () => {
    bindInputsFromDom();
    state.items2D.push({
      id: Date.now(),
      width: 0,
      height: 0,
      quantity: 1,
    });
    renderItems2D();
    saveState();
  });

  document.getElementById("items-1d").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-remove-1d");
    if (!id) return;
    bindInputsFromDom();
    state.items1D = state.items1D.filter((i) => String(i.id) !== id);
    if (state.items1D.length === 0)
      state.items1D.push({ id: Date.now(), length: 0, quantity: 1 });
    renderItems1D();
    saveState();
  });

  document.getElementById("items-2d").addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-remove-2d");
    if (!id) return;
    bindInputsFromDom();
    state.items2D = state.items2D.filter((i) => String(i.id) !== id);
    if (state.items2D.length === 0)
      state.items2D.push({ id: Date.now(), width: 0, height: 0, quantity: 1 });
    renderItems2D();
    saveState();
  });

  document.getElementById("calc-1d").addEventListener("click", () => calculate1D());
  document.getElementById("calc-2d").addEventListener("click", () => calculate2D());

  ["stockLength", "bladeWidth1D", "sheetWidth", "sheetHeight", "bladeWidth2D"].forEach(
    (id) => {
      document.getElementById(id).addEventListener("change", () => {
        bindInputsFromDom();
        saveState();
      });
    }
  );
}

document.addEventListener("DOMContentLoaded", init);
