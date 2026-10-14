/* Strategy protocol engine — identical contract to the platform's verified
 * example (contracts.ts strategy fixture). analyze(input) must keep returning
 * {grossReturnPct, maxDrawdownPct, netReturnPct} from at least two strictly
 * positive finite chronological prices, with the two-transaction fee
 * approximation disclosed. app.js mirrors this math for offline rendering;
 * keep the two in sync. */
function finite(v, min = 0) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min)
    throw new Error("Invalid numeric input");
  return v;
}
export function analyze(d) {
  if (!Array.isArray(d.prices) || d.prices.length < 2)
    throw new Error("At least two prices required");
  const prices = d.prices.map((p) => finite(p, Number.MIN_VALUE));
  let peak = prices[0],
    maxDrawdownPct = 0;
  for (const p of prices) {
    peak = Math.max(peak, p);
    maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - p) / peak) * 100);
  }
  const grossReturnPct = (prices.at(-1) / prices[0] - 1) * 100;
  return {
    grossReturnPct,
    maxDrawdownPct,
    netReturnPct: grossReturnPct - (finite(d.feeBps ?? 0) * 2) / 100,
  };
}
