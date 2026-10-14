import { z } from "zod";
import { assets, fixtureMeta, fixturePrices } from "../lib/finance";
import { isSseATicker, normalizeSseATicker, type LiveCompany } from "../lib/company-table";
import { settings } from "./settings";
import { createHash } from "node:crypto";

const STOCK_BASIC_TTL_MS = 24 * 60 * 60 * 1000;
const STOCK_BASIC_STALE_MS = 7 * 24 * 60 * 60 * 1000;
export type SseCompanyTable =
  | { available: true; version: string; asOf: string; companies: LiveCompany[] }
  | { available: false; reason: string };
type StockBasicCache = {
  companies: LiveCompany[];
  version: string;
  asOf: string;
  fetchedAt: number;
};
let stockBasicCache: StockBasicCache | undefined;
export function resetSseCompanyCache() {
  stockBasicCache = undefined;
}
function compactDay(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}
const stockBasicFields = ["ts_code", "name", "fullname", "enname", "industry"] as const;
// Cells arrive as parsed JSON; only scalar text is meaningful company data.
function cellText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return value.toString();
  return "";
}
// Pure mapping so tests can validate responses without the network.
export function parseStockBasic(body: unknown): LiveCompany[] {
  if (!body || typeof body !== "object") throw new Error("Tushare returned an invalid response");
  const payload = body as {
    code?: number;
    msg?: string;
    data?: { fields?: unknown; items?: unknown };
  };
  const fields = payload.data?.fields;
  const items = payload.data?.items;
  if (payload.code !== 0 || !Array.isArray(fields) || !Array.isArray(items))
    throw new Error(
      `Tushare company list was rejected: ${String(payload.msg || "invalid schema")}`,
    );
  const indices = stockBasicFields.map((field) => fields.indexOf(field));
  if (indices[0]! < 0 || indices[1]! < 0)
    throw new Error("Tushare response is missing required fields");
  const companies = items
    .map((row) =>
      row && typeof row === "object" && Array.isArray(row)
        ? (row as unknown[])
        : ([row] as unknown[]),
    )
    .map((row) => ({
      ticker: cellText(row[indices[0]!]),
      name: cellText(row[indices[1]!]),
      fullname: indices[2]! >= 0 ? cellText(row[indices[2]!]) : "",
      enname: indices[3]! >= 0 ? cellText(row[indices[3]!]) : "",
      industry: indices[4]! >= 0 ? cellText(row[indices[4]!]) : "",
    }))
    .filter((company) => company.name.length > 0 && isSseATicker(company.ticker));
  if (!companies.length) throw new Error("Tushare returned no usable SSE Class A companies");
  if (new Set(companies.map((company) => company.ticker)).size !== companies.length)
    throw new Error("Tushare company list contains duplicate tickers");
  return companies;
}
// Live company scope: SSE Class A listed shares, fetched through the platform token.
// The token stays server-side; results are cached for 24 hours and reused for up
// to 7 days when a refresh fails. An injected fetch (tests) bypasses the cache.
export async function sseACompanies(options?: { fetch?: typeof fetch }): Promise<SseCompanyTable> {
  const config = await settings();
  if (!config.TUSHARE_TOKEN)
    return { available: false, reason: "TUSHARE_TOKEN is not configured on the server" };
  const useCache = !options?.fetch;
  if (useCache && stockBasicCache && Date.now() - stockBasicCache.fetchedAt < STOCK_BASIC_TTL_MS)
    return {
      available: true,
      version: stockBasicCache.version,
      asOf: stockBasicCache.asOf,
      companies: stockBasicCache.companies,
    };
  try {
    const doFetch = options?.fetch ?? fetch;
    const response = await doFetch("https://api.tushare.pro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_name: "stock_basic",
        token: config.TUSHARE_TOKEN,
        params: { exchange: "SSE", list_status: "L" },
        fields: stockBasicFields.join(","),
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`Tushare HTTP request failed with status ${response.status}`);
    const companies = parseStockBasic(await response.json());
    const fetchedAt = new Date();
    const cache: StockBasicCache = {
      companies,
      version: `sse-a:${createHash("sha256")
        .update(JSON.stringify(companies))
        .digest("hex")
        .slice(0, 16)}:${compactDay(fetchedAt)}`,
      asOf: fetchedAt.toISOString().slice(0, 10),
      fetchedAt: fetchedAt.getTime(),
    };
    if (useCache) stockBasicCache = cache;
    return {
      available: true,
      version: cache.version,
      asOf: cache.asOf,
      companies: cache.companies,
    };
  } catch (error) {
    if (
      useCache &&
      stockBasicCache &&
      Date.now() - stockBasicCache.fetchedAt < STOCK_BASIC_STALE_MS
    )
      return {
        available: true,
        version: stockBasicCache.version,
        asOf: stockBasicCache.asOf,
        companies: stockBasicCache.companies,
      };
    return {
      available: false,
      reason: error instanceof Error ? error.message : "Tushare request failed",
    };
  }
}
// Tushare caps rows per call; walk backwards in ~4-year windows for full history.
async function tushareDaily(token: string, tsCode: string) {
  const rows: Array<{ date: string; close: number }> = [];
  const seen = new Set<string>();
  let end = new Date();
  for (let window = 0; window < 14; window++) {
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 4);
    const response = await fetch("https://api.tushare.pro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_name: "daily",
        token,
        params: {
          ts_code: tsCode,
          start_date: compactDay(start),
          end_date: compactDay(end),
        },
        fields: "ts_code,trade_date,close",
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error("Tushare HTTP request failed");
    const body = (await response.json()) as any;
    if (body.code !== 0 || !body.data?.fields || !body.data?.items)
      throw new Error("Tushare request was rejected or returned an invalid schema");
    const dateIndex = body.data.fields.indexOf("trade_date");
    const closeIndex = body.data.fields.indexOf("close");
    if (dateIndex < 0 || closeIndex < 0)
      throw new Error("Tushare response is missing required fields");
    const windowRows = body.data.items
      .map((r: any[]) => ({
        date: String(r[dateIndex]).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
        close: Number(r[closeIndex]),
      }))
      .filter(
        (r: any) =>
          /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
          Number.isFinite(r.close) &&
          r.close > 0 &&
          !seen.has(r.date),
      );
    if (!windowRows.length) break;
    for (const row of windowRows) {
      seen.add(row.date);
      rows.push(row);
    }
    end = start;
  }
  if (!rows.length) throw new Error("Tushare returned no usable daily prices");
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}
export async function prices(input: unknown) {
  const { symbol, provider } = z
    .object({
      symbol: z.string().regex(/^[A-Za-z0-9.]{1,20}$/),
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
  const tsCode = normalizeSseATicker(symbol);
  if (!tsCode || !isSseATicker(tsCode))
    throw new Error("The platform currently supports SSE Class A companies only.");
  const rows = await tushareDaily(config.TUSHARE_TOKEN, tsCode);
  return {
    symbol: tsCode,
    prices: rows,
    meta: {
      provider: "Tushare daily",
      synthetic: false,
      currency: "CNY",
      coverage: `${rows[0]!.date} to ${rows.at(-1)!.date}`,
      warning:
        "Unadjusted daily closes. Corporate actions can distort returns. Coverage depends on token permissions.",
    },
  };
}
export function assetUniverse() {
  return { assets, meta: fixtureMeta };
}
