/**
 * Schraubenlängen — Berechnung aus Stammdaten (JSON) und Zusatzparametern.
 */

const STATE = {
  data: null,
  mapKey: new Map(),
};

function buildLookupMaps(data) {
  const pitch = new Map();
  const mutter = new Map();
  const scheibe = new Map();
  for (const r of data.steigung) pitch.set(r.gewinde, r.steigungMm);
  for (const r of data.mutterHoehe) mutter.set(r.gewinde, r.hoeheMm);
  for (const r of data.scheibeHoehe) scheibe.set(r.gewinde, r.hoeheMm);
  return { pitch, mutter, scheibe };
}

function lookupOrNull(map, gewinde) {
  if (!gewinde || !map.has(gewinde)) return null;
  return map.get(gewinde);
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

function field(id, ...legacyIds) {
  for (const x of [id, ...legacyIds]) {
    const el = document.getElementById(x);
    if (el) return el;
  }
  return null;
}

function parseField(el, fallback) {
  if (!el) return fallback;
  const raw = String(el.value).trim().replace(",", ".");
  if (raw === "") return fallback;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
}

function readInputs() {
  const d = STATE.data.defaults;
  const eEl = field("dichtungHoehe", "e3");
  const fEl = field("gewindegaenge", "f3");
  const hEl = field("ueberstandBolzen", "h3");
  const hoeheOverride = field("flanschHoeheManuell", "hoeheOverride");
  const hoRaw = hoeheOverride
    ? hoeheOverride.value.trim().replace(",", ".")
    : "";
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
  const missing = [];
  if (!lookupOrNull(maps.pitch, gw)) missing.push("Steigung");
  if (!lookupOrNull(maps.mutter, gw)) missing.push("Mutterhöhe");
  if (!lookupOrNull(maps.scheibe, gw)) missing.push("Scheibenhöhe");
  if (missing.length > 0) {
    msg.classList.add("visible", "err");
    msg.textContent = `Für Gewinde ${gw} fehlen in den Stammdaten: ${missing.join(
      ", "
    )}. Bitte die Datei schrauben-daten.json ergänzen.`;
    return;
  }
  const pitch = maps.pitch.get(gw);
  const mutH = maps.mutter.get(gw);
  const schH = maps.scheibe.get(gw);

  let hoehe = fl.hoeheFlanschMm;
  if (hoehe == null || Number.isNaN(hoehe)) {
    if (inp.hoeheOverrideMm != null && !Number.isNaN(inp.hoeheOverrideMm)) {
      hoehe = inp.hoeheOverrideMm;
    } else {
      msg.classList.add("visible", "err");
      msg.textContent =
        "Für diesen Flansch ist keine Höhe hinterlegt. Bitte „Flanschhöhe (mm)“ manuell eintragen.";
      return;
    }
  }

  const dichtungMm = inp.dichtungHoeheMm;
  const gewindegaenge = inp.ueberstandGewindegange;
  const ueberstandBolzenMm = inp.ueberstandBolzenMm;
  const nut = fl.nutRuecksprungMm ?? 0;
  const bund = fl.bundMm ?? 0;

  const starre =
    2 * hoehe +
    pitch * gewindegaenge +
    mutH +
    schH +
    dichtungMm +
    ueberstandBolzenMm -
    nut +
    2 * bund;

  const stehbolzen =
    2 * hoehe +
    2 * (pitch * gewindegaenge) +
    2 * mutH +
    2 * schH +
    dichtungMm +
    2 * ueberstandBolzenMm -
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
  )} mm<br/>
    Flanschhöhe <strong>${fmt(hoehe)} mm</strong>${
    fl.hoeheFlanschMm == null ? " (manuell)" : ""
  },
    Nut/Rücksprung ${fmt(nut)} mm, Bund ${fmt(bund)} mm ·
    Dichtung ${fmt(dichtungMm)} mm, Gewindegänge ${gewindegaenge}, Überstand Bolzen ${fmt(ueberstandBolzenMm)} mm
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
  const setVal = (id, legacyId, val) => {
    const el = field(id, legacyId);
    if (el) el.value = String(val).replace(".", ",");
  };
  setVal("dichtungHoehe", "e3", d.dichtungHoeheMm);
  setVal("gewindegaenge", "f3", d.ueberstandGewindegange);
  setVal("ueberstandBolzen", "h3", d.ueberstandBolzenMm);

  wireFilters();
  document.getElementById("calc").addEventListener("click", (ev) => {
    ev.preventDefault();
    compute();
  });
}

document.addEventListener("DOMContentLoaded", init);
