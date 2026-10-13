import { z } from "zod";
import { assets, fixtureMeta, fixturePrices } from "../lib/finance";
import { settings } from "./settings";

export async function prices(input: unknown) {
  const { symbol, provider } = z
    .object({
      symbol: z.string().regex(/^[A-Z0-9.]{1,20}$/),
      provider: z.enum(["fixtures", "alpha-demo", "tushare"]).default("fixtures"),
    })
    .parse(input);
  if (provider === "fixtures") return fixturePrices(symbol);
  if (provider === "alpha-demo") {
    if (symbol !== "600104.SHH")
      throw new Error(
        "The public demo test supports 600104.SHH only. Other symbols require a licensed provider key.",
      );
    const response = await fetch(
      "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=600104.SHH&outputsize=full&apikey=demo",
      { signal: AbortSignal.timeout(20000) },
    );
    if (!response.ok) throw new Error("Financial test provider returned an HTTP error");
    const data = (await response.json()) as any;
    const series = data["Time Series (Daily)"];
    if (!series)
      throw new Error(data.Information || data.Note || "Provider did not return daily prices");
    const rows = Object.entries(series)
      .map(([date, row]) => ({ date, close: Number((row as any)["4. close"]) }))
      .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.close) && r.close > 0)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!rows.length) throw new Error("Provider response has no valid price rows");
    return {
      symbol,
      prices: rows,
      meta: {
        provider: "Alpha Vantage public demo",
        synthetic: false,
        currency: "CNY",
        coverage: `${rows[0].date} to ${rows.at(-1)!.date}`,
        warning:
          "Limited technical test endpoint. Provider licensing applies. These are daily closes, not live quotes. Dates remain market dates.",
      },
    };
  }
  const config = await settings();
  if (!config.TUSHARE_TOKEN) throw new Error("TUSHARE_TOKEN is not configured");
  const tsCode = symbol.replace(/\.SHH$/, ".SH");
  const response = await fetch("https://api.tushare.pro", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_name: "daily",
      token: config.TUSHARE_TOKEN,
      params: { ts_code: tsCode },
      fields: "ts_code,trade_date,close",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error("Tushare HTTP request failed");
  const body = (await response.json()) as any;
  if (body.code !== 0 || !body.data?.fields || !body.data?.items)
    throw new Error("Tushare request was rejected or returned an invalid schema");
  const dateIndex = body.data.fields.indexOf("trade_date"),
    closeIndex = body.data.fields.indexOf("close");
  if (dateIndex < 0 || closeIndex < 0)
    throw new Error("Tushare response is missing required fields");
  const rows = body.data.items
    .map((r: any[]) => ({
      date: String(r[dateIndex]).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
      close: Number(r[closeIndex]),
    }))
    .filter(
      (r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && Number.isFinite(r.close) && r.close > 0,
    )
    .sort((a: any, b: any) => a.date.localeCompare(b.date));
  if (!rows.length) throw new Error("Tushare returned no usable daily prices");
  return {
    symbol,
    prices: rows,
    meta: {
      provider: "Tushare daily",
      synthetic: false,
      currency: "CNY",
      coverage: `${rows[0].date} to ${rows.at(-1)!.date}`,
      warning:
        "Unadjusted daily closes. Corporate actions can distort returns. Coverage depends on token permissions.",
    },
  };
}
export function assetUniverse() {
  return { assets, meta: fixtureMeta };
}
