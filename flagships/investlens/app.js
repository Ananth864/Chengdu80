/* InvestLens — self-contained research memo for the platform sandbox.
 * All observations come from the bundled sample universe and are labelled as
 * samples. If the platform grants capability access to this release, the
 * bridge layer upgrades shared inputs and price panels and re-stamps them. */
"use strict";

/* ------------------------------------------------------------- utilities -- */
const $ = (s) => document.querySelector(s);
const esc = (v) =>
  String(v == null ? "" : v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const num = (v, d = 2) =>
  v == null || !isFinite(v)
    ? null
    : Number(v).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (v, d = 2) => (v == null || !isFinite(v) ? null : (v > 0 ? "+" : "") + num(v, d) + "%");
const cnMoney = (v) => {
  // Shanghai-terminal units: 亿 = 1e8, 万 = 1e4
  if (v == null || !isFinite(v)) return null;
  const a = Math.abs(v);
  if (a >= 1e12) return num(v / 1e12, 2) + "万亿";
  if (a >= 1e8) return num(v / 1e8, 2) + "亿";
  if (a >= 1e4) return num(v / 1e4, 1) + "万";
  return num(v, 2);
};
// Fire-and-forget re-renders: user-triggered refreshes never block the UI.
const fire = (p) => {
  p.catch(() => {});
};

/* --------------------------------------------------------- sample universe -- */
/* Static observations bundled with the app. Deterministic series are generated
   from the ticker seed — they are layout samples, never market quotes. */
const AS_OF = "2026-09-30";
const UNIVERSE = [
  {
    t: "600519",
    name: "Kweichow Moutai",
    cn: "贵州茅台",
    ind: "Consumer staples",
    size: "Large cap",
    px: 1542.6,
    chg: 0.62,
    pe: 25.6,
    ps: 12.1,
    dy: 2.8,
    roe: 31.2,
    rg: 11.4,
    ic: null,
    drift: 0.00028,
    vol: 0.014,
    news: [
      [
        "Sample Wire",
        "2026-08-28",
        "Moutai posts steady H1 as direct-sales channel keeps mix stable",
      ],
      ["Sample Daily", "2026-09-12", "Premium liquor inventory cycles stay inside historical band"],
    ],
    targets: [
      ["Samples Securities", "2026-09-02", 1680, 1860],
      ["Demo Research Co.", "2026-07-18", 1540, 1720],
      ["Mock Capital", "2026-06-30", 1490, 1660],
    ],
  },
  {
    t: "600887",
    name: "Yili Group",
    cn: "伊利股份",
    ind: "Consumer staples",
    size: "Large cap",
    px: 28.9,
    chg: -0.48,
    pe: 17.4,
    ps: 1.9,
    dy: 4.0,
    roe: 19.6,
    rg: 4.2,
    ic: 12.4,
    drift: 0.00008,
    vol: 0.013,
    news: [
      ["Sample Wire", "2026-09-04", "Dairy input costs ease; raw-milk spread improves modestly"],
      ["Sample Daily", "2026-08-19", "Consumer staples: rural channel restocking slows in Q2"],
    ],
    targets: [
      ["Demo Research Co.", "2026-09-10", 30.5, 34.0],
      ["Mock Capital", "2026-08-02", 29.0, 31.5],
    ],
  },
  {
    t: "600036",
    name: "China Merchants Bank",
    cn: "招商银行",
    ind: "Banking",
    size: "Large cap",
    px: 43.1,
    chg: 0.41,
    pe: 6.9,
    ps: 2.2,
    dy: 5.1,
    roe: 15.1,
    rg: 2.9,
    ic: null,
    drift: 0.00019,
    vol: 0.012,
    news: [
      [
        "Sample Wire",
        "2026-09-22",
        "CMB keeps fee-income mix stable while retail deposits lengthen",
      ],
      [
        "Sample Daily",
        "2026-08-30",
        "Banks: net-interest margins stabilise across the sample cohort",
      ],
    ],
    targets: [
      ["Samples Securities", "2026-09-15", 48.0, 55.0],
      ["Demo Research Co.", "2026-08-21", 46.0, 51.0],
      ["Mock Capital", "2026-07-09", 44.0, 49.0],
    ],
  },
  {
    t: "601318",
    name: "Ping An Insurance",
    cn: "中国平安",
    ind: "Insurance",
    size: "Large cap",
    px: 59.2,
    chg: -0.32,
    pe: 9.8,
    ps: 1.1,
    dy: 3.6,
    roe: 11.3,
    rg: 6.8,
    ic: null,
    drift: 0.00015,
    vol: 0.015,
    news: [
      ["Sample Wire", "2026-09-08", "Life new-business value growth slows to single digits in H1"],
      ["Sample Daily", "2026-08-25", "Insurers: bond-portfolio duration extends as yields flatten"],
    ],
    targets: [
      ["Demo Research Co.", "2026-09-19", 64.0, 72.0],
      ["Mock Capital", "2026-08-11", 60.0, 68.0],
    ],
  },
  {
    t: "688981",
    name: "SMIC",
    cn: "中芯国际",
    ind: "Semiconductors",
    size: "Large cap",
    px: 96.45,
    chg: 1.18,
    pe: 84.5,
    ps: 6.4,
    dy: 0.4,
    roe: 4.2,
    rg: 21.5,
    ic: 9.1,
    drift: 0.00042,
    vol: 0.024,
    news: [
      ["Sample Wire", "2026-09-26", "Foundry utilisation rises on mature-node restocking"],
      ["Sample Daily", "2026-09-01", "Semis: equipment spending approvals concentrate at头部 fabs"],
    ],
    targets: [
      ["Samples Securities", "2026-09-24", 102.0, 120.0],
      ["Mock Capital", "2026-08-29", 90.0, 108.0],
    ],
  },
  {
    t: "601899",
    name: "China Shenhua",
    cn: "中国神华",
    ind: "Mining & energy",
    size: "Large cap",
    px: 41.8,
    chg: 0.21,
    pe: 11.2,
    ps: 1.8,
    dy: 5.9,
    roe: 13.8,
    rg: -2.4,
    ic: 8.7,
    drift: 0.00011,
    vol: 0.014,
    news: [
      ["Sample Wire", "2026-08-15", "Long-term contract ratio keeps realised price above spot"],
      ["Sample Daily", "2026-09-17", "Energy: port inventories draw down ahead of heating season"],
    ],
    targets: [
      ["Demo Research Co.", "2026-09-05", 44.0, 49.0],
      ["Mock Capital", "2026-07-27", 42.0, 46.5],
    ],
  },
  {
    t: "600104",
    name: "SAIC Motor",
    cn: "上汽集团",
    ind: "Automobiles",
    size: "Large cap",
    px: 17.05,
    chg: -0.81,
    pe: 14.8,
    ps: 0.4,
    dy: 3.9,
    roe: 6.1,
    rg: -6.2,
    ic: 5.2,
    drift: -0.00007,
    vol: 0.016,
    news: [
      [
        "Sample Wire",
        "2026-09-11",
        "Export mix lifts unit revenue; domestic price competition persists",
      ],
      ["Sample Daily", "2026-08-07", "Autos: NEV share of retail crosses 46% in the sample month"],
    ],
    targets: [
      ["Mock Capital", "2026-09-02", 17.5, 21.0],
      ["Samples Securities", "2026-08-14", 16.5, 19.0],
    ],
  },
  {
    t: "600009",
    name: "Shanghai Airport",
    cn: "上海机场",
    ind: "Transport",
    size: "Large cap",
    px: 37.55,
    chg: 0.11,
    pe: 27.3,
    ps: 5.8,
    dy: 1.2,
    roe: 5.4,
    rg: 15.7,
    ic: 3.1,
    drift: 0.00024,
    vol: 0.015,
    news: [
      ["Sample Wire", "2026-09-29", "International seat capacity reaches 94% of the 2019 base"],
      [
        "Sample Daily",
        "2026-09-14",
        "Transport: duty-free per-pax spend recovers slower than traffic",
      ],
    ],
    targets: [["Demo Research Co.", "2026-09-21", 40.0, 45.0]],
  },
];

/* ------------------------------------------------- deterministic series -- */
function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const SERIES_LEN = 1260; // ~5 trading years
function seriesFor(c) {
  const r = rng(hash32(c.t));
  const out = [];
  let p = c.px * (0.62 + r() * 0.1);
  let wave = 0;
  for (let i = 0; i < SERIES_LEN; i++) {
    wave = wave * 0.94 + (r() - 0.5) * c.vol * 1.7;
    p = Math.max(0.5, p * (1 + c.drift + wave * 0.05 + (r() - 0.5) * c.vol * 0.28));
    out.push(p);
  }
  // Anchor the final close to the bundled quote.
  const k = c.px / out[SERIES_LEN - 1];
  return out.map((v, i) => ({
    close: +(v * (k + (1 - k) * (i / (SERIES_LEN - 1)) * 0.35)).toFixed(2),
  }));
}
function seriesWindow(c, period) {
  const n = period === "1m" ? 22 : period === "6m" ? 126 : period === "1y" ? 252 : SERIES_LEN;
  const all = seriesFor(c);
  return all.slice(Math.max(0, all.length - n));
}
function maxDrawdown(points) {
  let peak = points[0].close,
    dd = 0;
  for (const s of points) {
    peak = Math.max(peak, s.close);
    dd = Math.max(dd, ((peak - s.close) / peak) * 100);
  }
  return dd;
}
function cohortMedian(ind, key) {
  const vals = UNIVERSE.filter((c) => c.ind === ind)
    .map((c) => c[key])
    .filter((v) => typeof v === "number" && isFinite(v))
    .sort((a, b) => a - b);
  if (vals.length < 2) return { med: null, n: vals.length };
  const mid = Math.floor(vals.length / 2);
  return {
    med: +(vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2).toFixed(1),
    n: vals.length,
  };
}

/* ------------------------------------------------------------ bridge layer -- */
const bridge = { on: false };
function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}
async function probeBridge() {
  if (typeof cd80 === "undefined") {
    setChip("#mode-bridge", "Platform link: sandboxed", "");
    return;
  }
  try {
    const inputs = await Promise.race([
      cd80.call("storage.read", { key: "inputs" }),
      timeout(2500),
    ]);
    bridge.on = true;
    if (inputs && Array.isArray(inputs.holdings)) {
      holdings = inputs.holdings;
      cash = typeof inputs.cash === "number" ? inputs.cash : cash;
    }
    setChip("#mode-bridge", "Platform link: shared data", "live");
    setChip("#mode-data", "Platform data", "live");
  } catch {
    setChip("#mode-bridge", "Platform link: offline", "");
  }
}
function setChip(sel, text, extra) {
  const el = $(sel);
  if (el) {
    el.textContent = text;
    el.className = "mode-chip " + (extra || "");
  }
}
async function liveSeries(c) {
  if (!bridge.on) return null;
  try {
    return await Promise.race([cd80.call("market.prices", { symbol: c.t }), timeout(2500)]);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- state -- */
let current = UNIVERSE[0];
let period = "1y";
let holdings = [
  { symbol: "600519", units: 200, cost: 1520.0, price: 1542.6 },
  { symbol: "600036", units: 2000, cost: 38.5, price: 43.1 },
  { symbol: "600887", units: 1500, cost: 26.0, price: 28.9 },
  { symbol: "601899", units: 1000, cost: 36.0, price: 41.8 },
];
let cash = 50000;

/* Portfolio math mirrors calculations.js (the verified protocol contract);
   the sandbox cannot import it, so the two must stay in sync. */
function portfolioMath(list, cashBalance) {
  const positions = list.map((h) => {
    const c = UNIVERSE.find((u) => u.t === h.symbol);
    const price = c ? c.px : h.price;
    return {
      symbol: h.symbol,
      value: h.units * price,
      invested: h.units * h.cost,
      units: h.units,
      cost: h.cost,
      price,
    };
  });
  const totalValue = positions.reduce((s, p) => s + p.value, cashBalance);
  const invested = positions.reduce((s, p) => s + p.invested, 0);
  const profit = totalValue - cashBalance - invested;
  return {
    totalValue,
    invested,
    profit,
    returnPct: invested ? (profit / invested) * 100 : 0,
    concentrationPct: totalValue
      ? (Math.max(0, ...positions.map((p) => p.value)) / totalValue) * 100
      : 0,
    positions: positions.map((p) => ({
      ...p,
      weightPct: totalValue ? (p.value / totalValue) * 100 : 0,
    })),
  };
}

/* ------------------------------------------------------------- ticker strip -- */
function renderStrip() {
  const row = UNIVERSE.map((c) => {
    const up = c.chg >= 0;
    return (
      `<span class="tk"><b>${c.t}</b><span class="p">${esc(c.name.split(" ")[0].toUpperCase())}</span>` +
      `<span class="${up ? "u" : "d"}">${up ? "+" : "−"}${Math.abs(c.chg).toFixed(1)}%</span> ${num(c.px)}</span>`
    );
  }).join("");
  $("#strip-track").innerHTML = row + row; // duplicated for the seamless loop
}

/* ------------------------------------------------------------- search -- */
let searchTimer;
function wireSearch() {
  const box = $("#results"),
    input = $("#search");
  const pick = (c) => {
    box.hidden = true;
    input.value = `${c.name} (${c.t})`;
    select(c);
  };
  input.addEventListener("input", () => {
    clearTimeout(searchTimer);
    const v = input.value.trim().toLowerCase();
    searchTimer = setTimeout(() => {
      if (!v) {
        box.hidden = true;
        return;
      }
      const hits = UNIVERSE.filter((c) =>
        (c.t + " " + c.name + " " + c.cn + " " + c.ind).toLowerCase().includes(v),
      ).slice(0, 8);
      box.innerHTML = hits
        .map(
          (c, i) =>
            `<button data-i="${UNIVERSE.indexOf(c)}" class="${i === 0 ? "sel" : ""}"><b>${esc(c.name)}</b><span class="rtk">${c.t}</span>` +
            `<small>${esc(c.cn)} · ${esc(c.ind)} · ${esc(c.size)} · sample close ${num(c.px)}</small></button>`,
        )
        .join("");
      box.hidden = !hits.length;
      [...box.querySelectorAll("button")].forEach((b) => {
        b.onclick = () => pick(UNIVERSE[+b.dataset.i]);
      });
    }, 180);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const m = input.value.match(/\d{6}/);
    const c = m ? UNIVERSE.find((u) => u.t === m[0]) : null;
    if (c) {
      box.hidden = true;
      pick(c);
    }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) box.hidden = true;
  });
}

function select(c) {
  current = c;
  fire(renderCompany());
}

/* ------------------------------------------------------------- render -- */
function stamp(text, cls) {
  return `<span class="stamp ${cls || ""}">${esc(text)}</span>`;
}

async function renderCompany() {
  const c = current;
  $("#company-panel").innerHTML =
    `<div class="company-h"><h2>${esc(c.name)}</h2><span class="cid">SSE ${c.t}</span>` +
    `<span class="ind">${esc(c.ind)} · ${esc(c.size)}</span>${stamp("Sample record", "ok")}</div>` +
    `<p class="sub">Every panel reports its own source. Bundled observations are stamped as samples; nothing here is a live market quote.</p>` +
    `<div class="quote">` +
    quote("Latest close", `CNY ${num(c.px)}`) +
    quote("Daily change", pct(c.chg), c.chg > 0 ? "up" : c.chg < 0 ? "down" : "") +
    quote("P/E (TTM)", c.pe != null ? num(c.pe, 1) + "×" : null) +
    quote("Div yield", c.dy != null ? num(c.dy, 1) + "%" : null) +
    quote("Max drawdown · 1Y", "−" + num(maxDrawdown(seriesWindow(c, "1y")), 1) + "%", "down") +
    `</div>`;
  fire(renderPrice(c));
  renderMetrics(c);
  renderPeers(c);
  renderTargets(c);
  renderNews(c);
  renderPortfolio();
}

function quote(k, v, cls) {
  return `<div class="q"><div class="k">${esc(k)}</div><div class="v ${v == null ? "na" : cls || ""}">${v == null ? "N/A" : esc(v)}</div></div>`;
}

async function renderPrice(c) {
  const live = await liveSeries(c);
  let series, note, st;
  if (
    live &&
    Array.isArray(live.prices) &&
    live.prices.length > 1 &&
    live.meta &&
    live.meta.synthetic === false
  ) {
    series = live.prices.map((p) => ({ close: p.close }));
    note = `platform live series · ${live.meta.provider} · ${esc(live.meta.coverage || "")} · currency ${esc(live.meta.currency || "CNY")}`;
    st = stamp("Live platform data", "live");
  } else {
    series = seriesWindow(c, period);
    note = `deterministic sample series · ${periodLabel()} · hover points for values`;
    st = stamp("Sample series");
  }
  const stampEl = $("#price-stamp");
  if (stampEl) stampEl.outerHTML = st.replace('class="stamp', 'id="price-stamp" class="stamp');
  const w = series.map((s) => s.close);
  const min = Math.min(...w),
    max = Math.max(...w),
    span = max - min || 1;
  const W = 900,
    H = 250,
    P = 46,
    n = series.length;
  const x = (i) => P + (i * (W - 2 * P)) / (n - 1);
  const y = (v) => H - 28 - ((v - min) / span) * (H - 64);
  let grid = "";
  for (let k = 0; k <= 3; k++) {
    const v = min + (span * k) / 3;
    grid +=
      `<line class="grid-l" x1="${P}" y1="${y(v).toFixed(1)}" x2="${W - P}" y2="${y(v).toFixed(1)}"/>` +
      `<text class="axis" x="${P - 8}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${num(v, v > 100 ? 0 : 2)}</text>`;
  }
  const pts = series.map((s, i) => `${x(i).toFixed(1)},${y(s.close).toFixed(1)}`).join(" ");
  const area =
    `M${x(0).toFixed(1)},${H - 28} L` +
    pts.split(" ").join(" L") +
    ` L${x(n - 1).toFixed(1)},${H - 28} Z`;
  let dots = "";
  const step = Math.max(1, Math.floor(n / 60));
  series.forEach((s, i) => {
    if (i % step === 0 || i === n - 1)
      dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(s.close).toFixed(1)}" r="8" fill="transparent"><title>point ${i + 1} · close ${num(s.close)} CNY (sample)</title></circle>`;
  });
  document.querySelector("#price-chart").innerHTML =
    `${grid}<path class="area" d="${area}"/><polyline class="line" points="${pts}"/>${dots}` +
    `<circle class="line end" cx="${x(n - 1).toFixed(1)}" cy="${y(series[n - 1].close).toFixed(1)}" r="3.5"/>`;
  $("#price-meta").textContent = note + ` · ${n} points`;
  const up = series[n - 1].close >= series[0].close;
  $("#basis-note").textContent =
    `${up ? "sample window trending up" : "sample window trending down"} · sample daily closes · CNY · not market quotes`;
}
function periodLabel() {
  return {
    "1m": "1-month window",
    "6m": "6-month window",
    "1y": "1-year window",
    "5y": "5-year window",
  }[period];
}

/** @type {[string, string, string, (c: (typeof UNIVERSE)[number]) => number | null, (m: number) => string][]} */
const METRIC_DEFS = [
  ["pe", "P/E (TTM)", "×", (c) => c.pe, (m) => `${num(m, 1)}×`],
  ["ps", "P/S (TTM)", "×", (c) => c.ps, (m) => `${num(m, 1)}×`],
  ["dy", "Dividend yield (TTM)", "%", (c) => c.dy, (m) => `${num(m, 1)}%`],
  ["roe", "ROE", "%", (c) => c.roe, (m) => `${num(m, 1)}%`],
  ["rg", "Revenue growth", "%", (c) => c.rg, (m) => pct(m, 1)],
  ["ic", "Interest coverage", "×", (c) => c.ic, (m) => `${num(m, 1)}×`],
];
function renderMetrics(c) {
  $("#metrics").innerHTML = METRIC_DEFS.map(([id, label, _unit, get, fmt]) => {
    const v = get(c);
    const bm = cohortMedian(c.ind, id === "dy" ? "dy" : id);
    const bench = (id === "pe" || id === "dy" || id === "roe") && bm.med != null && v != null;
    const scale = Math.max(Math.abs(v || 0), Math.abs(bm.med)) * 1.2 || 1;
    return (
      `<div class="mcard"><div class="lab">${esc(label)} <button class="info" data-x="${id}" aria-label="Explain ${esc(label)}">i</button></div>` +
      `<div class="val${v == null ? " na" : ""}">${v == null ? "N/A" : fmt(v)}</div>` +
      (bench
        ? `<div class="bm"><div class="bar"><div class="fill" style="width:${((Math.abs(v) / scale) * 100).toFixed(1)}%"></div><div class="med" style="left:${((Math.abs(bm.med) / scale) * 100).toFixed(1)}%" title="sample-universe median"></div></div>` +
          `<div class="txt"><span>this company ${fmt(v)}</span><span>median ${fmt(bm.med)} (n=${bm.n})</span></div></div>`
        : `<div class="fine">${v == null ? "not reported in the sample record" : "FY2025 · sample-universe value"}</div>`) +
      `</div>`
    );
  }).join("");
  wireInfo();
}

function renderPeers(c) {
  const med = (k) => cohortMedian(c.ind, k).med;
  $("#peers-title").innerHTML = `Industry peers ${stamp("Sample universe")}`;
  $("#peers-sub").textContent =
    `${c.ind} cohort inside the bundled ${UNIVERSE.length}-company sample — not an industry benchmark.`;
  $("#peers-body").innerHTML =
    UNIVERSE.filter((u) => u.ind === c.ind)
      .map(
        (u) =>
          `<tr${u.t === c.t ? ' class="me"' : ""}><td>${esc(u.name)} · ${u.t}</td><td class="num">${num(u.px)}</td>` +
          `<td class="num">${u.pe == null ? "—" : num(u.pe, 1)}</td><td class="num">${u.dy == null ? "—" : num(u.dy, 1) + "%"}</td><td class="num">${u.roe == null ? "—" : num(u.roe, 1) + "%"}</td></tr>`,
      )
      .join("") +
    `<tr><td><b>Cohort median</b></td><td class="num">—</td><td class="num">${med("pe") == null ? "—" : num(med("pe"), 1)}</td>` +
    `<td class="num">${med("dy") == null ? "—" : num(med("dy"), 1) + "%"}</td><td class="num">${med("roe") == null ? "—" : num(med("roe"), 1) + "%"}</td></tr>`;
}

function renderTargets(c) {
  // Deterministic rating per brokerage from the ticker seed; fictional record.
  const order = ["Buy", "Buy", "Hold", "Sell"];
  const dist = { Buy: 0, Hold: 0, Sell: 0 };
  c.targets.forEach((t, i) => {
    dist[order[(hash32(c.t + t[0]) + i) % order.length]]++;
  });
  const total = c.targets.length || 1;
  const mids = c.targets.map((t) => (t[2] + t[3]) / 2);
  const avg = mids.length ? mids.reduce((a, b) => a + b, 0) / mids.length : null;
  $("#targets-title").innerHTML =
    `Brokerage research summary ${stamp("Third-party opinions", "warn")}`;
  $("#targets-sub").textContent =
    `${c.targets.length} sample brokerages · counts are brokerages, not analysts · as of ${AS_OF}`;
  let html = Object.entries(dist)
    .map(
      ([k, n]) =>
        `<div class="ratebar"><span>${k}</span><span class="t"><span class="f" style="width:${((n / total) * 100).toFixed(1)}%"></span></span><span class="n">${n}</span></div>`,
    )
    .join("");
  if (avg != null)
    html += `<p class="fine">Average target midpoint <b>CNY ${num(avg)}</b> — implied difference vs close ${pct((avg / c.px - 1) * 100, 1)} · a price comparison, not a forecast return.</p>`;
  html +=
    '<table><thead><tr><th>Brokerage</th><th>Report date</th><th class="num">Low</th><th class="num">High</th><th class="num">Midpoint</th></tr></thead><tbody>' +
    c.targets
      .map(
        (t) =>
          `<tr><td>${esc(t[0])}</td><td>${esc(t[1])}</td><td class="num">${num(t[2], t[2] >= 100 ? 0 : 2)}</td><td class="num">${num(t[3], t[3] >= 100 ? 0 : 2)}</td><td class="num">${num((t[2] + t[3]) / 2, t[3] >= 100 ? 0 : 2)}</td></tr>`,
      )
      .join("") +
    "</tbody></table>" +
    '<p class="fine">Sample record: brokerages and reports are fictional and bundled for layout. Ratings are attributed third-party opinions, never personalised advice.</p>';
  $("#targets-body").innerHTML = html;
}

function renderNews(c) {
  $("#news-title").innerHTML = `Company &amp; industry news ${stamp("Sample headlines")}`;
  $("#news-list").innerHTML = c.news
    .map(
      (n) =>
        `<li><div class="mt">Sample record</div><div class="t">${esc(n[2])}</div><div class="when">${esc(n[0])} · ${esc(n[1])} · bundled for layout only</div></li>`,
    )
    .join("");
}

function renderPortfolio() {
  const m = portfolioMath(holdings, cash);
  const grid = document.querySelector(".hsum");
  grid.innerHTML =
    `<div><div class="k">Total value · CNY</div><div class="v">${cnMoney(m.totalValue)}</div></div>` +
    `<div><div class="k">Unrealized profit</div><div class="v ${m.profit >= 0 ? "up" : "down"}">${m.profit >= 0 ? "+" : ""}${cnMoney(m.profit)}</div></div>` +
    `<div><div class="k">Return</div><div class="v ${m.returnPct >= 0 ? "up" : "down"}">${pct(m.returnPct, 1)}</div></div>` +
    `<div><div class="k">Largest position</div><div class="v">${num(m.concentrationPct, 1)}%</div></div>`;
  document.querySelector(".conc .fill").style.width = Math.min(100, m.concentrationPct) + "%";
  document.querySelector(".conc .txt").innerHTML =
    `<span>concentration: largest position weight</span><span>${num(m.concentrationPct, 1)}% of total value</span>`;
  $("#holdings").innerHTML = m.positions
    .map((p) => {
      const c = UNIVERSE.find((u) => u.t === p.symbol);
      return (
        `<tr><td>${p.symbol} ${c ? esc(c.name) : ""}</td><td class="num">${num(p.units, 0)}</td><td class="num">${num(p.cost)}</td>` +
        `<td class="num">${num(p.price)}</td><td class="num">${num(p.weightPct, 1)}%</td></tr>`
      );
    })
    .join("");
  $("#hold-note").textContent =
    `plus cash CNY ${num(cash, 0)} · ${bridge.on ? "shared platform inputs" : "sample cost basis"} · valued at bundled sample closes`;
}

/* ------------------------------------------------------------- education -- */
const GUIDE = {
  pe: [
    "P/E (TTM)",
    "Price divided by trailing-twelve-month earnings per share — how many years of recent profit the market pays for one share.",
    "A cheap-looking P/E can mean value, or expected profit decline. Compare only within the same industry and period.",
    "The amber tick is the median of this sample universe cohort — not an industry standard level.",
  ],
  ps: [
    "P/S (TTM)",
    "Price divided by trailing-twelve-month revenue — what you pay per unit of sales.",
    "Useful when profit is thin or negative. It ignores cost structure, so a low P/S in a thin-margin industry is not automatically cheap.",
    "Only compare P/S inside one industry: wholesale runs far below software.",
  ],
  dy: [
    "Dividend yield (TTM)",
    "Gross cash dividends actually paid over the last twelve months, divided by the closing price.",
    "Shows income received at today\u2019s price. Only payments already made count; proposed dividends are excluded.",
    "A yield is not a promised return — dividends can be cut at any board meeting.",
  ],
  roe: [
    "ROE",
    "Net profit attributable to shareholders divided by the average of opening and closing equity.",
    "How hard each unit of shareholder capital earned. High ROE can also come from heavy debt — read it next to interest coverage.",
    "This sample uses the simple-average basis; weighted-average ROE quoted elsewhere is not directly comparable.",
  ],
  rg: [
    "Revenue growth",
    "Change in consolidated total revenue versus the previous financial year.",
    "Separates expanding businesses from shrinking ones before valuation enters the picture.",
    "Growth off a small base is easier than off a large one — judge against same-industry peers in the same year.",
  ],
  ic: [
    "Interest coverage",
    "Annual EBIT divided by annual interest expense.",
    "The main early-warning metric for leverage: values near 1× mean almost all operating profit goes to interest.",
    "Banks and insurers have no comparable interest-expense concept under this definition, so the field reports N/A rather than an estimate.",
  ],
};
function wireInfo() {
  document.querySelectorAll(".info").forEach((b) => {
    b.onclick = () => explain(b.dataset.x);
  });
}
function explain(id) {
  const g = GUIDE[id];
  if (!g) return;
  $("#explain-title").textContent = g[0];
  $("#explain-body").innerHTML =
    `<div class="dh">What it means</div><p>${esc(g[1])}</p><div class="dh">Why it is useful</div><p>${esc(g[2])}</p>` +
    `<div class="dh">Reading the comparison</div><p>${esc(g[3])}</p>` +
    `<p class="fine">There is no universal good or bad level. A benchmark is only valid when definitions, periods and units match. Value shown is a bundled sample.</p>`;
  $("#explain").showModal();
}
$("#explain-close").onclick = () => $("#explain").close();
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("#explain").open) $("#explain").close();
});

/* ------------------------------------------------------------- chat -- */
function bubble(role, html) {
  const log = $("#chatlog");
  const b = document.createElement("div");
  b.className = "bubble " + role;
  b.innerHTML = html;
  log.appendChild(b);
  log.scrollTop = log.scrollHeight;
  return b;
}
function answer(qRaw) {
  const q = qRaw.toLowerCase();
  const c = current;
  const has = (...ws) => ws.some((w) => q.includes(w));
  if (has("hello", "hi ", "hey", "what can you")) {
    return [
      "ok",
      "I answer only from the bundled sample records for the selected company. Try: “latest close”, “P/E vs median”, “ROE”, “max drawdown”, “broker targets”, “what news is stored”, or “portfolio”.",
    ];
  }
  if (has("close", "price", "quote")) {
    return [
      "ok",
      `Latest bundled sample close for ${c.name} (${c.t}) is CNY ${num(c.px)} as of ${AS_OF}, daily change ${pct(c.chg)}. Not a market quote.`,
    ];
  }
  if (has("p/e", "pe ", " pe", "valuation")) {
    const m = cohortMedian(c.ind, "pe");
    return [
      "ok",
      c.pe == null
        ? "P/E is not reported in this sample record."
        : `Sample P/E (TTM) is ${num(c.pe, 1)}× against a cohort median of ${m.med == null ? "unavailable" : num(m.med, 1) + "×"} (n=${m.n}).`,
    ];
  }
  if (has("roe"))
    return [
      "ok",
      c.roe == null
        ? "ROE is not reported in this sample record."
        : `Sample ROE is ${num(c.roe, 1)}% (simple-average basis, FY2025).`,
    ];
  if (has("yield", "dividend"))
    return [
      "ok",
      c.dy == null
        ? "Dividend yield is not reported in this sample record."
        : `Sample TTM cash dividend yield is ${num(c.dy, 1)}%. Only payments already made count.`,
    ];
  if (has("drawdown")) {
    const dd = maxDrawdown(seriesWindow(c, "1y"));
    return [
      "ok",
      `Max drawdown on the 1-year sample series is −${num(dd, 1)}%. Computed on bundled sample closes, never on real prices.`,
    ];
  }
  if (has("target", "broker", "rating")) {
    const mids = c.targets.map((t) => (t[2] + t[3]) / 2);
    const avg = mids.reduce((a, b) => a + b, 0) / (mids.length || 1);
    return [
      "ok",
      `${c.targets.length} sample brokerages; average target midpoint CNY ${num(avg)} vs close CNY ${num(c.px)} (${pct((avg / c.px - 1) * 100, 1)}). Third-party opinions in a fictional sample record — not advice.`,
    ];
  }
  if (has("news", "headline")) {
    return [
      "ok",
      `${c.news.length} headlines stored for this company. Latest: “${c.news[0][2]}” (${c.news[0][0]}, ${c.news[0][1]}). Sample records bundled for layout.`,
    ];
  }
  if (has("portfolio", "holding", "position")) {
    const m = portfolioMath(holdings, cash);
    return [
      "ok",
      `Sample portfolio: total value CNY ${cnMoney(m.totalValue)}, unrealized profit ${cnMoney(m.profit)} (${pct(m.returnPct, 1)}), largest position ${num(m.concentrationPct, 1)}%.`,
    ];
  }
  return [
    "bad",
    "That is not in the bundled sample records. I do not guess. Try “latest close”, “P/E vs median”, “max drawdown”, “broker targets”, or “portfolio”.",
  ];
}
async function ask() {
  const input = $("#chatInput");
  const q = input.value.trim();
  if (!q) return;
  input.value = "";
  bubble("user", esc(q));
  const [status, text] = answer(q);
  const b = bubble(
    "bot",
    `<div class="st ${status === "ok" ? "ok" : "bad"}">${status === "ok" ? "answered from sample records" : "unsupported question"}</div><div>${esc(text)}</div>`,
  );
  if (bridge.on) {
    try {
      const m = portfolioMath(holdings, cash);
      const better = await cd80.call("ai.explain", {
        question: q,
        result: {
          company: current.name,
          ticker: current.t,
          close: current.px,
          portfolio: { totalValue: m.totalValue, returnPct: m.returnPct },
        },
      });
      if (typeof better === "string" && better.trim())
        b.innerHTML = `<div class="st ok">platform AI explanation</div><div>${esc(better)}</div>`;
    } catch {
      /* keep the deterministic local answer */
    }
  }
}
$("#chatGo").onclick = ask;
$("#chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") fire(ask());
});

/* ------------------------------------------------------------- boot -- */
document.querySelectorAll(".periods button").forEach((b) => {
  b.onclick = () => {
    document
      .querySelectorAll(".periods button")
      .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    period = b.dataset.p;
    fire(renderPrice(current));
  };
});

async function boot() {
  renderStrip();
  wireSearch();
  await probeBridge();
  await renderCompany();
  bubble(
    "bot",
    '<div class="st ok">memo ready</div><div>Bundled sample records loaded. Ask about the selected company, or search the universe above.</div>',
  );
  if (typeof cd80 !== "undefined") cd80.ready();
}
boot().catch((e) => {
  const el = document.createElement("p");
  el.className = "fine";
  el.textContent = "Render error: " + (e && e.message ? e.message : e);
  $("#wrap").prepend(el);
  if (typeof cd80 !== "undefined") cd80.ready();
});
