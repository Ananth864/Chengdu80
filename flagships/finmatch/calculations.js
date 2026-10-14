/* Screening protocol engine — identical contract to the platform's verified
 * example (contracts.ts screening fixture). analyze(input) must keep returning
 * {selected, missing}: assets kept when PE is positive, finite and at or below
 * maxPE while dividendYield is finite and at or above minYield; missing values
 * exclude an asset and are counted, never treated as zero. app.js mirrors
 * these exact semantics for offline rendering; keep the two in sync. */
function finite(v, min = 0) {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min)
    throw new Error("Invalid numeric input");
  return v;
}
export function analyze(d) {
  if (!Array.isArray(d.assets)) throw new Error("Assets required");
  const maxPE = finite(d.maxPE),
    minYield = finite(d.minYield);
  return {
    selected: d.assets
      .filter(
        (a) =>
          typeof a.pe === "number" &&
          Number.isFinite(a.pe) &&
          a.pe > 0 &&
          a.pe <= maxPE &&
          typeof a.dividendYield === "number" &&
          Number.isFinite(a.dividendYield) &&
          a.dividendYield >= minYield,
      )
      .map((a) => a.symbol),
    missing: d.assets.filter((a) => a.pe == null || a.dividendYield == null).length,
  };
}
