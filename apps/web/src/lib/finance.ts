import type { ProtocolId } from "./contracts";

export const assets = [
  {
    symbol: "600104.SHH",
    name: "SAIC Motor",
    sector: "Automobiles",
    price: 17.2,
    pe: 13.4,
    dividendYield: 4.1,
  },
  {
    symbol: "000001.SZ",
    name: "Ping An Bank",
    sector: "Banking",
    price: 12.8,
    pe: 6.2,
    dividendYield: 5.2,
  },
  {
    symbol: "600519.SHH",
    name: "Kweichow Moutai",
    sector: "Consumer",
    price: 1430,
    pe: 25.6,
    dividendYield: 2.8,
  },
  { symbol: "300750.SZ", name: "CATL", sector: "Energy", price: 268, pe: 31.2, dividendYield: 1.5 },
  {
    symbol: "600036.SHH",
    name: "China Merchants Bank",
    sector: "Banking",
    price: 42.6,
    pe: 8.1,
    dividendYield: 4.8,
  },
  {
    symbol: "601318.SHH",
    name: "Ping An Insurance",
    sector: "Insurance",
    price: 59.4,
    pe: null,
    dividendYield: 3.2,
  },
];
export const fixtureMeta = {
  provider: "Synthetic fixtures",
  synthetic: true,
  currency: "CNY",
  coverage: "2026-08-03 to 2026-09-30",
  warning: "Invented values for testing. Not current market quotes.",
};
export function fixturePrices(symbol = "600104.SHH") {
  const asset = assets.find((a) => a.symbol === symbol);
  if (!asset) throw new Error("Symbol is not in the fixture universe");
  return {
    meta: fixtureMeta,
    symbol,
    prices: Array.from({ length: 43 }, (_, i) => ({
      date: new Date(Date.UTC(2026, 7, 3 + Math.floor(i / 5) * 7 + (i % 5)))
        .toISOString()
        .slice(0, 10),
      close: Number((asset.price * (0.91 + i * 0.0022 + Math.sin(i * 0.57) * 0.032)).toFixed(2)),
    })),
  };
}
function number(value: unknown, min = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min)
    throw new Error("Expected a finite non-negative number");
  return value;
}
function finiteResult<T>(result: T): T {
  function visit(value: unknown) {
    if (typeof value === "number" && !Number.isFinite(value))
      throw new Error("Calculation exceeds the supported numerical range");
    if (value && typeof value === "object") Object.values(value).forEach(visit);
  }
  visit(result);
  return result;
}
export function calculate(protocol: ProtocolId, input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("Input must be an object");
  const data = input as Record<string, any>;
  if (protocol === "portfolio") {
    if (!Array.isArray(data.holdings) || data.holdings.length > 500)
      throw new Error("Expected at most 500 holdings");
    const cash = number(data.cash ?? 0);
    const positions = data.holdings.map((h: any) => ({
      symbol: String(h.symbol),
      value: number(h.units) * number(h.price),
      invested: number(h.units) * number(h.cost),
    }));
    const totalValue = positions.reduce((a: number, p: any) => a + p.value, cash);
    const invested = positions.reduce((a: number, p: any) => a + p.invested, 0);
    const profit = totalValue - cash - invested;
    return finiteResult({
      totalValue,
      profit,
      returnPct: invested ? (profit / invested) * 100 : 0,
      concentrationPct: totalValue
        ? (Math.max(0, ...positions.map((p: any) => p.value)) / totalValue) * 100
        : 0,
      positions: positions.map((p: any) => ({
        ...p,
        weightPct: totalValue ? (p.value / totalValue) * 100 : 0,
      })),
    });
  }
  if (protocol === "screening") {
    if (!Array.isArray(data.assets) || data.assets.length > 1000)
      throw new Error("Expected at most 1,000 assets");
    const maxPE = number(data.maxPE);
    const minYield = number(data.minYield);
    return {
      selected: data.assets
        .filter(
          (a: any) =>
            typeof a.pe === "number" &&
            Number.isFinite(a.pe) &&
            a.pe > 0 &&
            a.pe <= maxPE &&
            typeof a.dividendYield === "number" &&
            Number.isFinite(a.dividendYield) &&
            a.dividendYield >= minYield,
        )
        .map((a: any) => a.symbol),
      missing: data.assets.filter((a: any) => a.pe == null || a.dividendYield == null).length,
    };
  }
  if (!Array.isArray(data.prices) || data.prices.length < 2 || data.prices.length > 10000)
    throw new Error("Expected 2 to 10,000 prices");
  const prices = data.prices.map((p: unknown) => number(p, Number.MIN_VALUE));
  const grossReturnPct = (prices.at(-1)! / prices[0] - 1) * 100;
  let peak = prices[0];
  let maxDrawdownPct = 0;
  for (const price of prices) {
    peak = Math.max(peak, price);
    maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - price) / peak) * 100);
  }
  return finiteResult({
    grossReturnPct,
    maxDrawdownPct,
    netReturnPct: grossReturnPct - (number(data.feeBps ?? 0) * 2) / 100,
  });
}
export function defaultData(protocol: ProtocolId): Record<string, unknown> {
  if (protocol === "portfolio")
    return {
      holdings: assets.slice(0, 3).map((a, i) => ({
        symbol: a.symbol,
        units: [1200, 2400, 30][i],
        cost: a.price * 0.92,
        price: a.price,
      })),
      cash: 18000,
    };
  if (protocol === "screening") return { assets, maxPE: 20, minYield: 2 };
  return { prices: fixturePrices().prices.map((p) => p.close), feeBps: 10 };
}
