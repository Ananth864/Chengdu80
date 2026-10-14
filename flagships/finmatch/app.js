/* FinMatch — gamified watchlist discovery, ported to the platform sandbox.
 * Companies, industries and sizes describe a bundled SSE-style sample universe;
 * every metric is a deterministic local fixture, labelled as such everywhere.
 * The value screen follows the platform's screening contract exactly. */
"use strict";

/* ------------------------------------------------------------- utilities -- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const esc = (v) =>
  String(v == null ? "" : v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const f2 = (v, d = 2) => (v == null || !isFinite(v) ? "—" : Number(v).toFixed(d));
const capTxt = (v) =>
  v >= 1e12 ? "¥" + (v / 1e12).toFixed(2) + "万亿" : "¥" + (v / 1e8).toFixed(0) + "亿";

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

/* --------------------------------------------------------- sample universe -- */
const INDUSTRIES = [
  { id: "mfg", label: "Manufacturing", cn: "制造业" },
  { id: "it", label: "IT & software", cn: "信息软件" },
  { id: "util", label: "Utilities", cn: "公用事业" },
  { id: "fin", label: "Financial services", cn: "金融业" },
  { id: "retail", label: "Wholesale & retail", cn: "批发零售" },
];
const IND_NAME = Object.fromEntries(INDUSTRIES.map((i) => [i.id, i.label]));
/* [ticker, nameCN, nameEN, industry, size(L/M/S), market cap RMB] */
const ROWS = [
  ["600104", "上汽集团", "SAIC Motor", "mfg", "L", 198e9],
  ["600089", "特变电工", "TBEA", "mfg", "L", 76e9],
  ["601727", "上海电气", "Shanghai Electric", "mfg", "L", 68e9],
  ["600741", "华域汽车", "Huayu Auto", "mfg", "M", 41e9],
  ["600875", "东方电气", "Dongfang Electric", "mfg", "M", 46e9],
  ["601100", "恒立液压", "Hengli Hydraulics", "mfg", "M", 39e9],
  ["603160", "汇顶科技", "Goodix", "mfg", "S", 6.2e9],
  ["603288", "海天味业", "Haitian Flavouring", "mfg", "L", 130e9],
  ["600588", "用友网络", "Yonyou Network", "it", "M", 25e9],
  ["600845", "宝信软件", "Baosight Software", "it", "L", 72e9],
  ["688111", "金山办公", "Kingsoft Office", "it", "L", 132e9],
  ["603019", "中科曙光", "Sugon", "it", "L", 59e9],
  ["600797", "浙大网新", "Insigma", "it", "S", 5.1e9],
  ["688188", "柏楚电子", "Friendess", "it", "M", 19e9],
  ["600536", "中国软件", "China National Software", "it", "M", 14e9],
  ["603444", "吉比特", "G-bits", "it", "M", 11e9],
  ["600900", "长江电力", "China Yangtze Power", "util", "L", 560e9],
  ["600886", "国投电力", "SDIC Power", "util", "L", 73e9],
  ["601991", "大唐发电", "Datang Power", "util", "L", 41e9],
  ["600795", "国电电力", "GD Power", "util", "L", 69e9],
  ["600674", "川投能源", "Chuantou Energy", "util", "M", 37e9],
  ["600021", "上海电力", "Shanghai Electric Power", "util", "M", 30e9],
  ["600023", "浙能电力", "Zheneng Electric", "util", "L", 58e9],
  ["600101", "明星电力", "Mingxing Power", "util", "S", 4.4e9],
  ["600036", "招商银行", "China Merchants Bank", "fin", "L", 1.08e12],
  ["601318", "中国平安", "Ping An Insurance", "fin", "L", 1.1e12],
  ["601601", "中国太保", "CPIC", "fin", "L", 260e9],
  ["601628", "中国人寿", "China Life", "fin", "L", 790e9],
  ["600919", "江苏银行", "Bank of Jiangsu", "fin", "L", 170e9],
  ["600926", "杭州银行", "Hangzhou Bank", "fin", "M", 98e9],
  ["601128", "常熟银行", "Changshu Bank", "fin", "M", 22e9],
  ["600030", "中信证券", "CITIC Securities", "fin", "L", 280e9],
  ["600859", "老凤祥", "Lao Feng Xiang", "retail", "L", 27e9],
  ["600655", "豫园股份", "Yuyuan Tourist Mart", "retail", "L", 31e9],
  ["600827", "百联股份", "Bailian Group", "retail", "M", 17e9],
  ["600729", "重庆百货", "Chongqing Dept Store", "retail", "M", 6.8e9],
  ["600415", "小商品城", "Yiwu China Commodities City", "retail", "L", 61e9],
  ["600824", "益民集团", "Yimin Group", "retail", "S", 4.1e9],
  ["600814", "杭州解百", "Hangzhou Jiebai", "retail", "S", 3.6e9],
  ["600785", "新华百货", "Xinhua Dept Store", "retail", "S", 2.9e9],
];
const SIZE_LABEL = { L: "Large cap", M: "Mid cap", S: "Small cap" };
const UNIVERSE = ROWS.map(([t, cn, en, ind, size, cap]) => ({ id: t, t, cn, en, ind, size, cap }));

/* Deterministic fixture metrics — same generator family as the original app. */
const IND_BASE = {
  mfg: { pe: 26, ps: 2.1, dy: 1.8, rg: 9, roe: 9, ic: 7.5 },
  it: { pe: 42, ps: 3.6, dy: 0.8, rg: 14, roe: 8, ic: 11 },
  util: { pe: 15, ps: 1.6, dy: 3.6, rg: 5, roe: 9, ic: 2.6 },
  fin: { pe: 8, ps: 2.4, dy: 3.2, rg: 4, roe: 10, ic: null },
  retail: { pe: 22, ps: 0.7, dy: 1.6, rg: 8, roe: 8, ic: 5.5 },
};
const fixtureCache = new Map();
function metricsOf(c) {
  if (fixtureCache.has(c.id)) return fixtureCache.get(c.id);
  const r = rng(hash32(c.id));
  const b = IND_BASE[c.ind];
  const sizeAdj = c.size === "L" ? 0.9 : c.size === "M" ? 1.0 : 1.15;
  const span = (lo, hi) => lo + r() * (hi - lo);
  const m = {};
  m.pe = +(span(b.pe * 0.45, b.pe * 1.8) * sizeAdj).toFixed(2);
  m.ps = +span(b.ps * 0.4, b.ps * 2.2).toFixed(2);
  m.dy = +span(Math.max(0, b.dy * 0.15), b.dy * 2.4).toFixed(2);
  m.rg = +(span(b.rg * -0.9, b.rg * 2.4) - (c.size === "S" ? 2 : 0)).toFixed(1);
  m.roe = +span(b.roe * 0.25, b.roe * 2.3).toFixed(1);
  m.ic = b.ic == null ? null : +span(b.ic * 0.35, b.ic * 2.1).toFixed(1);
  if (r() < 0.07) m.dy = null; // sparse coverage states stay visible
  if (m.pe <= 0) m.pe = null;
  fixtureCache.set(c.id, m);
  return m;
}
function industryMedian(ind, key) {
  const vals = UNIVERSE.filter((c) => c.ind === ind)
    .map((c) => metricsOf(c)[key])
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (vals.length < 5) return null;
  const mid = Math.floor(vals.length / 2);
  return +(vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2).toFixed(2);
}

/* The screening contract — identical semantics to calculations.js: keep when
   P/E is a positive finite number at or below maxPE and yield is a finite
   number at or above minYield; missing values exclude, never become zero. */
function screenUniverse(maxPE, minYield) {
  const pass = [],
    missing = [];
  for (const c of UNIVERSE) {
    const m = metricsOf(c);
    if (m.pe == null || m.dy == null) {
      missing.push(c);
      continue;
    }
    if (m.pe > 0 && m.pe <= maxPE && m.dy >= minYield) pass.push(c);
  }
  return { pass, missing };
}

/* ------------------------------------------------------------- metrics UI -- */
const METRICS = [
  {
    id: "pe",
    name: "P/E (TTM)",
    unit: "×",
    basis: "Trailing twelve months",
    fmt: (v) => f2(v) + "×",
    meaning:
      "Price divided by trailing-twelve-month earnings per share — how many years of recent profit the market is currently paying for one share.",
    useful:
      "A cheap-looking P/E can mean value, or that the market expects profit to fall. Compare it to companies measured the same way, not to a universal number.",
    compare:
      "Banks and utilities typically carry lower multiples than software issuers, so only the same-industry median is a fair yardstick.",
  },
  {
    id: "ps",
    name: "P/S (TTM)",
    unit: "×",
    basis: "Trailing twelve months",
    fmt: (v) => f2(v) + "×",
    meaning:
      "Price divided by trailing-twelve-month revenue — what you pay per unit of sales, useful when profit is thin or negative.",
    useful:
      "Works across loss-making issuers where P/E is meaningless. Because it ignores cost structure, a low P/S in a thin-margin industry is not automatically cheap.",
    compare:
      "Only compare P/S inside one industry: wholesale and retail runs far below software on margin.",
  },
  {
    id: "dy",
    name: "Dividend yield (TTM)",
    unit: "%",
    basis: "Cash actually paid in trailing 12 months",
    fmt: (v) => f2(v) + "%",
    meaning:
      "Gross cash dividends per share actually paid over the last twelve months, divided by the closing price.",
    useful:
      "Shows income you would have received at today\u2019s price. Only payments already made count.",
    compare: "A yield is not a promised return: dividends can be cut at any future board meeting.",
  },
  {
    id: "rg",
    name: "Revenue growth",
    unit: "%",
    basis: "Latest completed financial year",
    fmt: (v) => (v > 0 ? "+" : "") + f2(v, 1) + "%",
    meaning: "Change in consolidated total revenue versus the previous financial year.",
    useful:
      "Separates expanding businesses from shrinking ones before valuation enters the picture.",
    compare:
      "Growth off a small base is easier than off a large one, so judge against same-industry peers in the same year.",
  },
  {
    id: "roe",
    name: "ROE (simple average)",
    unit: "%",
    basis: "Latest completed financial year",
    fmt: (v) => f2(v, 1) + "%",
    meaning:
      "Annual net profit attributable to parent shareholders divided by the average of opening and closing equity.",
    useful:
      "How hard each unit of shareholder capital earned. This fixture uses the simple-average basis.",
    compare:
      "High ROE can also come from heavy debt rather than better operations — read it next to interest coverage.",
  },
  {
    id: "ic",
    name: "Interest coverage",
    unit: "×",
    basis: "Latest completed financial year",
    fmt: (v) => f2(v, 1) + "×",
    meaning:
      "Annual EBIT divided by annual interest expense — how many times operating profit covers borrowing costs.",
    useful:
      "The main early-warning metric for leverage risk. Values near 1× mean almost all operating profit goes to interest.",
    compare:
      "For bank-type issuers interest expense is not comparable under this definition, so it reports unavailable rather than estimated.",
  },
];
const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m]));

/* ------------------------------------------------------------- quiz -- */
const QUESTIONS = [
  {
    id: "q1",
    text: "How comfortable are you with the value of an investment moving up and down over time?",
    choices: [
      ["Low", "I prefer small changes in value, even if potential growth may be lower."],
      ["Medium", "I can accept some ups and downs for potential long-term growth."],
      ["High", "I can accept large ups and downs for potential long-term growth."],
    ],
  },
  {
    id: "q2",
    text: "Imagine you invest ¥10,000 and its value falls to ¥8,000 for a time. What would you most likely do?",
    choices: [
      ["Low", "Sell all or most of it to prevent further losses."],
      ["Medium", "Hold it for now and review the situation before deciding."],
      ["High", "Stay with my plan, or add more if that was already part of my plan."],
    ],
  },
  {
    id: "q3",
    text: "What temporary fall in the value of your investments could you tolerate without changing your plan?",
    choices: [
      ["Low", "Up to 5%."],
      ["Medium", "More than 5% and up to 20%."],
      ["High", "More than 20%."],
    ],
  },
  {
    id: "q4",
    text: "Which investment trade-off feels closest to you?",
    choices: [
      ["Low", "Lower ups and downs, even if the potential for growth is more limited."],
      ["Medium", "A balance between ups and downs and potential long-term growth."],
      ["High", "More ups and downs in exchange for the possibility of higher long-term growth."],
    ],
  },
  {
    id: "q5",
    text: "When might you need to use the money you are considering investing?",
    choices: [
      ["Low", "Within 1 year."],
      ["Medium", "In 1 to 3 years."],
      ["High", "More than 3 years from now."],
    ],
  },
  {
    id: "q6",
    text: "If your income stopped, how long could your savings cover essential expenses?",
    choices: [
      ["Low", "Less than 1 month."],
      ["Medium", "From 1 month to 6 months."],
      ["High", "More than 6 months."],
    ],
  },
  {
    id: "q7",
    text: "What return do you expect your investment portfolio to achieve over the next year?",
    choices: [
      ["Low", "Less than 10%."],
      ["Medium", "10% to 20%."],
      ["High", "More than 20%."],
    ],
  },
];
const BANDS = [
  [7, 11, "L"],
  [12, 16, "M"],
  [17, 21, "S"],
];
const RISK2SIZE = { L: "Large cap", M: "Mid cap", S: "Small cap" };

/* ------------------------------------------------------------- state -- */
let profile = null; // {total,bucket}
let industries = new Set(); // empty = all
let maxPE = 30,
  minYield = 1;
let chosen = ["pe", "dy", "roe"];
let session = null; // {queue:[company], idx, keeps}
let watchlist = []; // session-only
let quizDraft = {},
  quizIdx = 0;
let subScreen = "home";
const bridge = { on: false };

/* ------------------------------------------------------------- bridge -- */
function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms));
}
async function probeBridge() {
  if (typeof cd80 === "undefined") {
    $("#d-bridge").textContent = "sandboxed";
    return;
  }
  try {
    const inputs = await Promise.race([
      cd80.call("storage.read", { key: "inputs" }),
      timeout(2500),
    ]);
    bridge.on = true;
    $("#d-bridge").textContent = "shared data";
    if (inputs && typeof inputs.maxPE === "number") maxPE = inputs.maxPE;
    if (inputs && typeof inputs.minYield === "number") minYield = inputs.minYield;
    $("#pe-max").value = Math.min(60, Math.max(5, maxPE));
    $("#pe-out").textContent = maxPE + "×";
    $("#dy-min").value = Math.min(6, Math.max(0, minYield));
    $("#dy-out").textContent = minYield.toFixed(1) + "%";
    updateScreenCounts();
  } catch {
    $("#d-bridge").textContent = "offline";
  }
}

/* ------------------------------------------------------------- navigation -- */
function tab(t) {
  $$(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
  ["play", "metrics", "watchlist", "data"].forEach((s) =>
    $("#screen-" + s).classList.toggle("hidden", s !== t),
  );
  if (t === "metrics") renderToggles();
  if (t === "watchlist") renderWatchlist();
  $("#wl-count").textContent = watchlist.length;
}
$$(".tabs button").forEach((b) => {
  b.onclick = () => tab(b.dataset.tab);
});
function show(name) {
  subScreen = name;
  ["home", "quiz", "industries", "screen", "game", "end"].forEach((s) =>
    $("#s-" + s).classList.toggle("hidden", s !== name),
  );
}

/* ------------------------------------------------------------- home -- */
function renderHome() {
  const pool = profile ? RISK2SIZE[profile.bucket] : "—";
  $("#home-stat").innerHTML =
    `<div>Behavioural match<b>${profile ? "Complete" : "Not started"}</b></div>` +
    `<div>Company size pool<b>${pool}</b></div>` +
    `<div>Value screen<b>PE ≤ ${maxPE} · yield ≥ ${minYield.toFixed(1)}%</b></div>` +
    `<div>Watchlist<b>${watchlist.length} kept</b></div>`;
  if (profile) {
    show("screen");
    updateScreenCounts();
  }
}
$("#go-quiz").onclick = () => {
  quizDraft = {};
  quizIdx = 0;
  renderQuiz();
  show("quiz");
};
$("#go-metrics").onclick = () => tab("metrics");

/* ------------------------------------------------------------- quiz UI -- */
function renderQuiz() {
  const q = QUESTIONS[quizIdx];
  $("#q-num").textContent = quizIdx + 1;
  $("#q-dealt").innerHTML = QUESTIONS.map(
    (_, i) => `<i class="${i < quizIdx ? "done" : i === quizIdx ? "cur" : ""}"></i>`,
  ).join("");
  $("#q-text").textContent = q.text;
  $("#q-choices").innerHTML = q.choices
    .map(
      ([label, desc], i) =>
        `<button class="choice" role="radio" aria-checked="${quizDraft[q.id] === i + 1}" data-v="${i + 1}"><b>${esc(label)}</b><span>${esc(desc)}</span></button>`,
    )
    .join("");
  $$("#q-choices .choice").forEach((b) => {
    b.onclick = () => {
      quizDraft[q.id] = +b.dataset.v;
      renderQuiz();
    };
  });
  $("#q-back").disabled = quizIdx === 0;
  $("#q-next").disabled = quizDraft[q.id] == null;
  $("#q-next").textContent = quizIdx === QUESTIONS.length - 1 ? "See my pool" : "Next";
}
$("#q-back").onclick = () => {
  quizIdx = Math.max(0, quizIdx - 1);
  renderQuiz();
};
$("#q-next").onclick = () => {
  if (quizIdx < QUESTIONS.length - 1) {
    quizIdx++;
    renderQuiz();
    return;
  }
  const total = QUESTIONS.reduce((s, q) => s + (quizDraft[q.id] || 0), 0);
  const band = BANDS.find(([lo, hi]) => total >= lo && total <= hi);
  profile = { total, bucket: band[2] };
  renderChips();
  show("industries");
};
$("#q-quit").onclick = () => {
  show("home");
  renderHome();
};

/* ------------------------------------------------------------- industries -- */
function renderChips() {
  $("#ind-chips").innerHTML = INDUSTRIES.map(
    (i) =>
      `<button class="chip" aria-checked="${industries.has(i.id)}" data-id="${i.id}">${esc(i.label)} · ${esc(i.cn)}</button>`,
  ).join("");
  $$("#ind-chips .chip").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id;
      if (industries.has(id)) industries.delete(id);
      else industries.add(id);
      renderChips();
    };
  });
}
$("#ind-clear").onclick = () => {
  industries.clear();
  renderChips();
};
$("#ind-save").onclick = () => {
  show("screen");
  updateScreenCounts();
};
$("#sc-back").onclick = () => {
  show("industries");
};

/* ------------------------------------------------------------- value screen -- */
function effectiveIndustries() {
  return industries.size ? [...industries] : INDUSTRIES.map((i) => i.id);
}
function poolFor() {
  const { pass, missing } = screenUniverse(maxPE, minYield);
  const pool = pass.filter(
    (c) =>
      profile &&
      c.size === profile.bucket &&
      effectiveIndustries().includes(c.ind) &&
      !watchlist.includes(c.id),
  );
  return { pass, missing, pool };
}
function updateScreenCounts() {
  if (!profile) return;
  const { pass, missing, pool } = poolFor();
  $("#sc-pass").textContent = pass.length;
  $("#sc-miss").textContent = missing.length;
  $("#sc-pool").textContent = pool.length;
  $("#sc-deal").disabled = !pool.length;
  $("#sc-deal").textContent = pool.length
    ? `Deal the cards — up to ${Math.min(5, pool.length)}`
    : "No companies pass — widen the screen";
}
$("#pe-max").addEventListener("input", (e) => {
  maxPE = +e.target.value;
  $("#pe-out").textContent = maxPE + "×";
  updateScreenCounts();
});
$("#dy-min").addEventListener("input", (e) => {
  minYield = +e.target.value;
  $("#dy-out").textContent = minYield.toFixed(1) + "%";
  updateScreenCounts();
});
$("#sc-deal").onclick = deal;

/* ------------------------------------------------------------- the deck -- */
function deal() {
  const { pool } = poolFor();
  if (!pool.length) return;
  const rnd = rng(
    (hash32(profile.bucket + effectiveIndustries().join() + maxPE) ^ Date.now()) >>> 0,
  );
  const a = pool.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  session = { queue: a.slice(0, 5), idx: 0, total: Math.min(5, a.length) };
  show("game");
  renderDots();
  renderCard();
}
function renderDots() {
  $("#g-dots").innerHTML = Array.from(
    { length: session.total },
    (_, i) => `<i class="${i < session.idx ? "done" : i === session.idx ? "cur" : ""}"></i>`,
  ).join("");
}
function renderCard() {
  if (session.idx >= session.queue.length) return endRound();
  const c = session.queue[session.idx];
  const m = metricsOf(c);
  const card = $("#gcard");
  card.className = "gcard";
  card.style.transform = "";
  $("#stamp-keep").style.opacity = 0;
  $("#stamp-fold").style.opacity = 0;
  const chosenMetrics = METRICS.filter((x) => chosen.includes(x.id));
  card.querySelector(".cardtop").innerHTML =
    `<div><div class="cname">${esc(c.en)} ${esc(c.cn)}</div><div class="cticker">${c.t} · SH</div>` +
    `<div class="cind">${esc(IND_NAME[c.ind])} · ${esc(SIZE_LABEL[c.size])}</div></div>` +
    `<div class="cprice"><b>${m.pe == null ? "—" : f2(m.pe) + "×"}</b><span>P/E fixture</span></div>`;
  card.querySelector(".kv").innerHTML =
    `<span>market cap ${capTxt(c.cap)}</span><span>deterministic fixtures</span>`;
  card.querySelector(".metrics").innerHTML = chosenMetrics.length
    ? chosenMetrics
        .map((x) => {
          const v = m[x.id];
          const med = industryMedian(c.ind, x.id);
          const bench =
            med != null && v != null && ["pe", "dy", "roe"].includes(x.id)
              ? `<div class="bench"><div class="bar"><i style="width:${Math.min(100, (Math.abs(v) / Math.max(Math.abs(v), Math.abs(med))) * 100).toFixed(0)}%"></i>` +
                `<u style="left:${Math.min(100, (Math.abs(med) / Math.max(Math.abs(v), Math.abs(med))) * 100).toFixed(0)}%" title="industry fixture median ${med}"></u></div>` +
                `<span class="fine">median ${f2(med)}</span></div>`
              : "";
          return (
            `<div class="mrow"><div><div class="mname" data-m="${x.id}">${esc(x.name)}</div><div class="mbasis">${esc(x.basis)}</div></div>` +
            `<div class="mval${v == null ? " na" : ""}">${v == null ? "unavailable" : x.fmt(v)}</div>${bench}</div>`
          );
        })
        .join("")
    : '<p class="fine" style="align-self:center;margin:auto">No metrics selected. Keep company facts only, or turn metrics on in the Metrics tab.</p>';
  card.querySelectorAll(".mname").forEach((el) => {
    el.onclick = () => educate(el.dataset.m);
  });
  wireDrag(card);
}
function decide(choice) {
  const c = session.queue[session.idx];
  const card = $("#gcard");
  card.style.transform = "";
  card.className = "gcard " + (choice === "keep" ? "fly-keep" : "fly-fold");
  $("#stamp-keep").style.opacity = choice === "keep" ? 1 : 0;
  $("#stamp-fold").style.opacity = choice === "fold" ? 1 : 0;
  if (choice === "keep") {
    if (!watchlist.includes(c.id)) watchlist.push(c.id);
    if (bridge.on)
      cd80.call("storage.write", { key: "finmatch_watchlist", value: watchlist }).catch(() => {});
  }
  $("#wl-count").textContent = watchlist.length;
  setTimeout(() => {
    session.idx++;
    renderDots();
    renderCard();
  }, 420);
}
$("#b-keep").onclick = () => decide("keep");
$("#b-fold").onclick = () => decide("fold");
$("#g-exit").onclick = endRound;
document.addEventListener("keydown", (e) => {
  if (subScreen !== "game" || $("#screen-play").classList.contains("hidden")) return;
  if (e.key === "ArrowRight") decide("keep");
  if (e.key === "ArrowLeft") decide("fold");
});
function wireDrag(card) {
  let sx = 0,
    sy = 0,
    dx = 0,
    active = false;
  const keep = $("#stamp-keep"),
    fold = $("#stamp-fold");
  const move = (x, y) => {
    dx = x - sx;
    card.style.transform = `translate(${dx}px,${(y - sy) * 0.15}px) rotate(${dx / 18}deg)`;
    keep.style.opacity = Math.max(0, Math.min(1, dx / 110));
    fold.style.opacity = Math.max(0, Math.min(1, -dx / 110));
  };
  card.onpointerdown = (e) => {
    active = true;
    sx = e.clientX;
    sy = e.clientY;
    card.classList.add("dragging");
    card.setPointerCapture(e.pointerId);
  };
  card.onpointermove = (e) => {
    if (active) move(e.clientX, e.clientY);
  };
  const up = () => {
    if (!active) return;
    active = false;
    card.classList.remove("dragging");
    if (Math.abs(dx) > 105) decide(dx > 0 ? "keep" : "fold");
    else {
      card.style.transform = "";
      keep.style.opacity = 0;
      fold.style.opacity = 0;
    }
  };
  card.onpointerup = up;
  card.onpointercancel = up;
}
function endRound() {
  if (!session) {
    show("home");
    renderHome();
    return;
  }
  const kept = session.queue.filter((c) => watchlist.includes(c.id)).length;
  $("#end-title").textContent =
    session.idx >= session.queue.length ? "Round complete" : "Round ended early";
  $("#end-body").innerHTML =
    `<div class="stat"><div>Cards seen<b>${Math.min(session.idx + (subScreen === "game" ? 0 : 0), session.queue.length)}</b></div>` +
    `<div>Kept<b>${kept}</b></div><div>Still passing<b>${poolFor().pool.length}</b></div><div>Watchlist<b>${watchlist.length}</b></div></div>` +
    `<p class="fine" style="margin-top:12px">Round order was random inside your pool — not a financial ranking. Session-only keeps unless the platform grants storage access.</p>`;
  session = null;
  show("end");
}
$("#end-new").onclick = () => {
  show("screen");
  updateScreenCounts();
};
$("#end-wl").onclick = () => tab("watchlist");

/* ------------------------------------------------------------- toggles -- */
function renderToggles() {
  $("#metric-toggles").innerHTML = METRICS.map(
    (m) =>
      `<div class="toggle"><div><b>${esc(m.name)}</b><span>${esc(m.basis)} · tap the name on cards for the full guide</span></div>` +
      `<button class="sw" role="switch" aria-checked="${chosen.includes(m.id)}" aria-label="Show ${esc(m.name)}" data-id="${m.id}"><i></i></button></div>`,
  ).join("");
  $$("#metric-toggles .sw").forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id;
      chosen = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
      renderToggles();
    };
  });
}
$("#m-all").onclick = () => {
  chosen = METRICS.map((m) => m.id);
  renderToggles();
};
$("#m-none").onclick = () => {
  chosen = [];
  renderToggles();
};
function educate(id) {
  const m = METRIC_BY_ID[id];
  if (!m) return;
  $("#edu-title").textContent = m.name;
  $("#edu-meaning").textContent = m.meaning;
  $("#edu-useful").textContent = m.useful;
  $("#edu-compare").textContent = m.compare;
  $("#edu").showModal();
}
$("#edu-close").onclick = () => $("#edu").close();

/* ------------------------------------------------------------- watchlist -- */
function renderWatchlist() {
  const body = $("#wl-body");
  if (!watchlist.length) {
    body.innerHTML =
      '<p class="fine" style="margin:6px 0">No companies kept yet. Deal a round from the Play tab and keep the cards that interest you.</p>';
    return;
  }
  body.innerHTML = watchlist
    .map((id) => {
      const c = UNIVERSE.find((u) => u.id === id);
      const m = metricsOf(c);
      return (
        `<div class="wl"><div class="who"><b>${esc(c.en)} ${esc(c.cn)}</b><span>${c.t} · ${esc(IND_NAME[c.ind])} · ${esc(SIZE_LABEL[c.size])} · ${capTxt(c.cap)}</span>` +
        `<div class="wlgrid">${METRICS.filter((x) => chosen.includes(x.id))
          .map(
            (x) =>
              `<em>${esc(x.name.split(" (")[0])}<b>${m[x.id] == null ? "—" : x.fmt(m[x.id])}</b></em>`,
          )
          .join("")}</div></div>` +
        `<button class="btn ghost" data-rm="${id}">Remove</button></div>`
      );
    })
    .join("");
  body.querySelectorAll("[data-rm]").forEach((b) => {
    b.onclick = () => {
      watchlist = watchlist.filter((x) => x !== b.dataset.rm);
      $("#wl-count").textContent = watchlist.length;
      renderWatchlist();
    };
  });
}
$("#wl-clear").onclick = () => {
  watchlist = [];
  $("#wl-count").textContent = 0;
  renderWatchlist();
};
$("#wl-play").onclick = () => {
  tab("play");
  show(profile ? "screen" : "home");
  if (profile) updateScreenCounts();
  else renderHome();
};
$("#d-universe").textContent = UNIVERSE.length;

/* ------------------------------------------------------------- boot -- */
async function boot() {
  renderChips();
  await probeBridge();
  renderHome();
  if (typeof cd80 !== "undefined") cd80.ready();
}
boot().catch((e) => {
  const p = document.createElement("p");
  p.className = "fine";
  p.textContent = "Render error: " + (e && e.message ? e.message : e);
  $(".shell").prepend(p);
  if (typeof cd80 !== "undefined") cd80.ready();
});
