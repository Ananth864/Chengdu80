function finite(v, min = 0) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min)
    throw new Error("Invalid numeric input");
  return v;
}
export function analyze(d) {
  if (!Array.isArray(d.holdings)) throw new Error("Holdings required");
  const cash = finite(d.cash ?? 0);
  const p = d.holdings.map((h) => ({
    symbol: h.symbol,
    value: finite(h.units) * finite(h.price),
    invested: finite(h.units) * finite(h.cost),
  }));
  const totalValue = p.reduce((s, h) => s + h.value, cash);
  const invested = p.reduce((s, h) => s + h.invested, 0);
  const profit = totalValue - cash - invested;
  return {
    totalValue,
    profit,
    returnPct: invested ? (profit / invested) * 100 : 0,
    concentrationPct: totalValue ? (Math.max(0, ...p.map((h) => h.value)) / totalValue) * 100 : 0,
    positions: p.map((h) => ({ ...h, weightPct: totalValue ? (h.value / totalValue) * 100 : 0 })),
  };
}
