/**
 * Schraubenlängen — Logik entspricht Excel „Schraubenlänge“:
 * - Zeile aus Flansch-Tabelle: MATCH über Art, DN, PN (wie Probe[Prüfung]=1)
 * - C6 starre Schraube, C9 Stehbolzen (siehe meta.formeln in JSON)
 */

const STATE = {
  data: null,
  mapKey: new Map(),
};

function parseThreadNumeric(thread) {
  if (!thread || typeof thread !== "string") return null;
  const m = thread.replace(",", ".").match(/^M([\d.]+)/i);
  if (!m) return null;
  return parseFloat(m[1]);
}

function buildLookupMaps(data) {
  const pitch = new Map();
  const mutter = new Map();
  const scheibe = new Map();
  for (const r of data.steigung) pitch.set(r.gewinde, r.steigungMm);
  for (const r of data.mutterHoehe) mutter.set(r.gewinde, r.hoeheMm);
  for (const r of data.scheibeHoehe) scheibe.set(r.gewinde, r.hoeheMm);
  return { pitch, mutter, scheibe };
}

function sortedKeysBySize(map) {
  const entries = [...map.entries()]
    .map(([k, v]) => ({ k, v, n: parseThreadNumeric(k) }))
    .filter((x) => x.n != null && !Number.isNaN(x.v))
    .sort((a, b) => a.n - b.n);
  return entries;
}

function interpolateValue(map, gewinde) {
  if (map.has(gewinde)) return map.get(gewinde);
  const target = parseThreadNumeric(gewinde);
  if (target == null) return null;
  const seq = sortedKeysBySize(map);
  if (seq.length === 0) return null;
  if (target <= seq[0].n) return seq[0].v;
  if (target >= seq[seq.length - 1].n) return seq[seq.length - 1].v;
  let lower = seq[0];
  let upper = seq[seq.length - 1];
  for (let i = 0; i < seq.length - 1; i++) {
    if (seq[i].n <= target && seq[i + 1].n >= target) {
      lower = seq[i];
      upper = seq[i + 1];
      break;
    }
  }
  if (lower.k === upper.k) return lower.v;
  const t = (target - lower.n) / (upper.n - lower.n);
  return lower.v + t * (upper.v - lower.v);
}

function rowKey(art, dn, pn) {
  return `${art}|||${dn}|||${pn}`;
}

function indexFlansche(flansche) {
  STATE.mapKey.clear();
  for (const f of flansche) {
    STATE.mapKey.set(rowKey(f.art, f.dn, f.pn), f);
  }
}

function findFlansch(art, dn, pn) {
  return STATE.mapKey.get(rowKey(art, dn, pn)) ?? null;
}

function uniqueSorted(arr) {
  return [...new Set(arr)].sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b), "de");
  });
}

function populateArt(data) {
  const sel = document.getElementById("art");
  const arts = uniqueSorted(data.flansche.map((f) => f.art));
  sel.innerHTML = '<option value="">— Art wählen —</option>';
  for (const a of arts) {
    const o = document.createElement("option");
    o.value = a;
    o.textContent = a;
    sel.appendChild(o);
  }
}

function dnsForArt(art) {
  return uniqueSorted(
    STATE.data.flansche.filter((f) => f.art === art).map((f) => f.dn)
  );
}

function pnsForArtDn(art, dn) {
  return uniqueSorted(
    STATE.data.flansche.filter((f) => f.art === art && f.dn === dn).map((f) => f.pn)
  );
}

function wireFilters() {
  const art = document.getElementById("art");
  const dn = document.getElementById("dn");
  const pn = document.getElementById("pn");

  art.addEventListener("change", () => {
    dn.innerHTML = '<option value="">— DN —</option>';
    pn.innerHTML = '<option value="">— PN —</option>';
    if (!art.value) return;
    for (const d of dnsForArt(art.value)) {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = String(d);
      dn.appendChild(o);
    }
  });

  dn.addEventListener("change", () => {
    pn.innerHTML = '<option value="">— PN —</option>';
    if (!art.value || dn.value === "") return;
    const dnum = dn.value.includes(".")
      ? parseFloat(dn.value)
      : parseInt(dn.value, 10);
    for (const p of pnsForArtDn(art.value, dnum)) {
      const o = document.createElement("option");
      o.value = p;
      o.textContent = String(p);
      pn.appendChild(o);
    }
  });
}

function parseField(el, fallback) {
  const raw = String(el.value).trim().replace(",", ".");
  if (raw === "") return fallback;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

function readInputs() {
  const d = STATE.data.defaults;
  const eEl = document.getElementById("e3");
  const fEl = document.getElementById("f3");
  const hEl = document.getElementById("h3");
  const hoeheOverride = document.getElementById("hoeheOverride");
  const hoRaw = hoeheOverride.value.trim().replace(",", ".");
  const hoNum = hoRaw === "" ? NaN : parseFloat(hoRaw);
  return {
    dichtungHoeheMm: parseField(eEl, d.dichtungHoeheMm),
    ueberstandGewindegange: parseField(fEl, d.ueberstandGewindegange),
    ueberstandBolzenMm: parseField(hEl, d.ueberstandBolzenMm),
    hoeheOverrideMm: Number.isFinite(hoNum) ? hoNum : null,
  };
}

function compute() {
  const msg = document.getElementById("msg");
  const out = document.getElementById("result");
  msg.className = "msg";
  msg.textContent = "";
  out.classList.remove("visible");

  const art = document.getElementById("art").value;
  const dnRaw = document.getElementById("dn").value;
  const pnRaw = document.getElementById("pn").value;

  if (!art || dnRaw === "" || pnRaw === "") {
    msg.classList.add("visible", "err");
    msg.textContent = "Bitte Art, DN und PN auswählen.";
    return;
  }

  const dn = dnRaw.includes(".") ? parseFloat(dnRaw) : parseInt(dnRaw, 10);
  const pn = pnRaw.includes(".") ? parseFloat(pnRaw) : parseInt(pnRaw, 10);

  const fl = findFlansch(art, dn, pn);
  if (!fl) {
    msg.classList.add("visible", "err");
    msg.textContent = "Keine Datenzeile für diese Kombination.";
    return;
  }

  const inp = readInputs();

  const maps = buildLookupMaps(STATE.data);
  const gw = fl.gewinde;
  const pitch = interpolateValue(maps.pitch, gw);
  const mutH = interpolateValue(maps.mutter, gw);
  const schH = interpolateValue(maps.scheibe, gw);

  if (pitch == null || mutH == null || schH == null) {
    msg.classList.add("visible", "err");
    msg.textContent = `Keine Steigung/Mutter/Scheibe für Gewinde ${gw} (auch keine Interpolation möglich).`;
    return;
  }

  let hoehe = fl.hoeheFlanschMm;
  if (hoehe == null || Number.isNaN(hoehe)) {
    if (inp.hoeheOverrideMm != null && !Number.isNaN(inp.hoeheOverrideMm)) {
      hoehe = inp.hoeheOverrideMm;
    } else {
      msg.classList.add("visible", "err");
      msg.textContent =
        "Für diese Zeile fehlt die Flanschhöhe in den Excel-Daten (z. B. „NA“). Bitte „Flanschhöhe (mm)“ manuell eintragen.";
      return;
    }
  }

  const E3 = inp.dichtungHoeheMm;
  const F3 = inp.ueberstandGewindegange;
  const H3 = inp.ueberstandBolzenMm;
  const nut = fl.nutRuecksprungMm ?? 0;
  const bund = fl.bundMm ?? 0;

  const starre =
    2 * hoehe +
    pitch * F3 +
    mutH +
    schH +
    E3 +
    H3 -
    nut +
    2 * bund;

  const stehbolzen =
    2 * hoehe +
    2 * (pitch * F3) +
    2 * mutH +
    2 * schH +
    E3 +
    2 * H3 -
    nut +
    2 * bund;

  const fmt = (n) =>
    n.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });

  document.getElementById("kpi-gewinde").textContent = gw;
  document.getElementById("kpi-anzahl").textContent = String(fl.anzahlSchrauben ?? "—");
  document.getElementById("kpi-starre").textContent = fmt(starre);
  document.getElementById("kpi-steh").textContent = fmt(stehbolzen);

  const detail = document.getElementById("detail");
  detail.innerHTML = `
    <strong>Gewinde:</strong> ${gw} · <strong>Anzahl Schrauben:</strong> ${fl.anzahlSchrauben ?? "—"}<br/>
    Steigung ${fmt(pitch)} mm, Mutter ${fmt(mutH)} mm, Scheibe ${fmt(
    schH
  )} mm
    ${
      !STATE.data.mutterHoehe.some((x) => x.gewinde === gw) ||
      !STATE.data.steigung.some((x) => x.gewinde === gw)
        ? " <em>(Werte für dieses Gewinde per Interpolation zwischen benachbarten Größen)</em>"
        : ""
    }<br/>
    Flanschhöhe <strong>${fmt(hoehe)} mm</strong>${
    fl.hoeheFlanschMm == null ? " (manuell)" : ""
  },
    Nut/Rücksprung ${fmt(nut)} mm, Bund ${fmt(bund)} mm ·
    Dichtung ${fmt(E3)} mm, Gewindegänge ${F3}, Überstand Bolzen ${fmt(H3)} mm
  `;

  out.classList.add("visible");
}

async function init() {
  let data;
  try {
    const res = await fetch("schrauben-daten.json", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    data = await res.json();
  } catch (e) {
    document.getElementById("msg").className = "msg visible err";
    document.getElementById("msg").innerHTML =
      "Daten konnten nicht geladen werden. Bei <code>file://</code> blockiert der Browser oft <code>fetch</code>. " +
      "Bitte im Projektordner z. B. <code>python3 -m http.server 8080</code> starten und " +
      '<a href="http://localhost:8080">http://localhost:8080</a> öffnen.';
    return;
  }

  STATE.data = data;
  indexFlansche(data.flansche);
  populateArt(data);

  const d = data.defaults;
  document.getElementById("e3").value = String(d.dichtungHoeheMm).replace(".", ",");
  document.getElementById("f3").value = String(d.ueberstandGewindegange).replace(".", ",");
  document.getElementById("h3").value = String(d.ueberstandBolzenMm).replace(".", ",");

  document.getElementById("formeln").textContent = `${data.meta.formeln.starreSchraubeMm} | ${data.meta.formeln.stehbolzenMm}`;

  wireFilters();
  document.getElementById("calc").addEventListener("click", (ev) => {
    ev.preventDefault();
    compute();
  });
}

document.addEventListener("DOMContentLoaded", init);
