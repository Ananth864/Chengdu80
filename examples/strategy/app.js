const spec = {
  name: "Strategy lab",
  purpose:
    "Compare buy-and-hold performance with cash, showing historical return, maximum drawdown, and a simple fee estimate.",
  protocol: "strategy",
  inputs: ["Chronological daily close prices", "Transaction fee in basis points"],
  outputs: ["Gross and net return", "Maximum drawdown", "Historical performance chart"],
  constraints: [
    "No look-ahead",
    "Disclose fee approximation",
    "Historical results only",
    "Do not claim predictive returns",
  ],
};
const el = (id) => document.getElementById(id);
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
el("title").textContent = spec.name;
el("purpose").textContent = spec.purpose;
let data;
let result;
function metric(label, value) {
  return (
    '<div class="metric"><span>' + esc(label) + "</span><strong>" + esc(value) + "</strong></div>"
  );
}
function table(headers, rows) {
  return (
    "<table><thead><tr>" +
    headers.map((h) => "<th>" + esc(h) + "</th>").join("") +
    "</tr></thead><tbody>" +
    rows.map((r) => "<tr>" + r.map((v) => "<td>" + esc(v) + "</td>").join("") + "</tr>").join("") +
    "</tbody></table>"
  );
}
async function render() {
  el("error").textContent = "";
  result = await cd80.call("finance.calculate", data);
  el("inputs").value = JSON.stringify(data, null, 2);
  const meta = await cd80.call("storage.read", { key: "_provenance" });
  if (meta)
    el("notice").textContent =
      meta.provider +
      " · " +
      (meta.currency || "CNY") +
      " · " +
      (meta.coverage || "") +
      " · " +
      meta.warning;
  if (spec.protocol === "portfolio") {
    el("metrics").innerHTML =
      metric("Total value · CNY", fmt(result.totalValue)) +
      metric("Unrealized profit · CNY", fmt(result.profit)) +
      metric("Return", fmt(result.returnPct) + "%") +
      metric("Largest position", fmt(result.concentrationPct) + "%");
    el("chart-title").textContent = "Portfolio composition";
    el("chart").innerHTML = (result.positions || [])
      .map(
        (p) =>
          '<div class="bar-row"><span class="bar-label">' +
          esc(p.symbol) +
          '</span><div class="bar-track"><div class="bar" style="width:' +
          Math.max(0, Math.min(100, p.weightPct)) +
          '%"></div></div><span class="bar-value">' +
          fmt(p.weightPct) +
          "%</span></div>",
      )
      .join("");
    el("table").innerHTML = table(
      ["Position", "Units", "Cost", "Price"],
      data.holdings.map((h) => [h.symbol, fmt(h.units), fmt(h.cost), fmt(h.price)]),
    );
  } else if (spec.protocol === "screening") {
    el("metrics").innerHTML =
      metric("Matching assets", result.selected.length) +
      metric("Maximum PE", data.maxPE) +
      metric("Minimum yield", data.minYield + "%") +
      metric("Missing records", result.missing ?? 0);
    el("chart-title").textContent = "Asset shortlist";
    el("chart").textContent = "Selected: " + (result.selected.join(", ") || "No matches");
    el("table").innerHTML = table(
      ["Asset", "PE", "Dividend yield", "Result"],
      data.assets.map((a) => [
        a.symbol,
        a.pe ?? "Missing",
        a.dividendYield == null ? "Missing" : a.dividendYield + "%",
        result.selected.includes(a.symbol) ? "Matches" : "Excluded",
      ]),
    );
  } else {
    el("metrics").innerHTML =
      metric("Gross return", fmt(result.grossReturnPct) + "%") +
      metric("Net return", fmt(result.netReturnPct) + "%") +
      metric("Max drawdown", fmt(result.maxDrawdownPct) + "%") +
      metric("Price observations", data.prices.length);
    el("chart-title").textContent = "Historical price path";
    let min = Math.min(...data.prices),
      max = Math.max(...data.prices);
    const pts = data.prices
      .map(
        (p, i) =>
          (i / (data.prices.length - 1)) * 700 + "," + (140 - ((p - min) / (max - min || 1)) * 120),
      )
      .join(" ");
    el("chart").innerHTML =
      '<svg viewBox="0 0 700 160" role="img" aria-label="Historical price chart"><polyline points="' +
      pts +
      '" fill="none" stroke="var(--primary)" stroke-width="3"/></svg>';
    el("table").textContent =
      "Cash benchmark: 0% return. Fees use a simple two-transaction approximation at " +
      data.feeBps +
      " bps per transaction.";
  }
}
el("save").onclick = async () => {
  try {
    const next = JSON.parse(el("inputs").value);
    await cd80.call("finance.calculate", next);
    await cd80.call("storage.write", { key: "inputs", value: next });
    data = next;
    await render();
  } catch (e) {
    el("error").textContent = e.message;
  }
};
el("explain").onclick = async () => {
  el("explain").disabled = true;
  try {
    el("explanation").textContent = await cd80.call("ai.explain", {
      question:
        "Explain these verified results in plain English. Disclose data limits and avoid recommendations.",
      result,
    });
  } catch (e) {
    el("explanation").textContent = e.message;
  } finally {
    el("explain").disabled = false;
  }
};
try {
  data = await cd80.call("storage.read", { key: "inputs" });
  await render();
  cd80.ready();
} catch (e) {
  el("error").textContent = e.message;
  cd80.ready();
}
