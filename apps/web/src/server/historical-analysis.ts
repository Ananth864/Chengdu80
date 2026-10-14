import { z } from "zod";
import {
  financialMetricSchema,
  financialRequestSchema,
  financialResultSchema,
  isCalendarDate,
  type FinancialMetric,
  type FinancialRequest,
} from "../../starter/project/src/lib/financial-results";
import { suppliedCompanyUniverse, type SuppliedCompany } from "./company-universe";
import type { TushareQuery } from "./tushare";

export type FinancialContext = {
  mode: "fixture" | "live";
  companyIds?: readonly string[];
  query?: TushareQuery;
  companies?: readonly SuppliedCompany[];
};

export function shanghaiDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function shiftCalendarMonths(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year!, month! - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date!, last));
  return first.toISOString().slice(0, 10);
}

export function validateFinancialRequest(
  raw: unknown,
  context: FinancialContext,
):
  | { success: true; request: FinancialRequest; company: SuppliedCompany; asOfDate: string }
  | { success: false; reason: string } {
  const parsed = financialRequestSchema.safeParse(raw);
  if (!parsed.success) return { success: false, reason: parsed.error.message };
  const request = parsed.data;
  const asOfDate = request.as_of_date ?? shanghaiDate();
  if (asOfDate > shanghaiDate())
    return { success: false, reason: "Future as_of_date is not allowed (Asia/Shanghai)." };
  const company = (context.companies ?? suppliedCompanyUniverse()).find(
    (entry) => entry.ticker === request.company_id && entry.exchange === "SSE",
  );
  if (
    !company ||
    (request.company_name !== undefined && request.company_name !== company.name) ||
    (request.industry_label !== undefined && request.industry_label !== company.industry)
  )
    return {
      success: false,
      reason: "Company ticker, full name and industry must match the supplied SSE universe.",
    };
  if (
    context.companyIds &&
    !context.companyIds.some((id) => id.replace(/\.SH$/, "") === company.ticker)
  )
    return { success: false, reason: "Company is outside the permitted company IDs." };
  return { success: true, request, company, asOfDate };
}

// Verified against the official A-share pro_bar documentation, not inferred from payloads.
export const adjustmentConvention = {
  verified: true,
  source: "https://tushare.pro/document/2?doc_id=146",
  convention: "Tushare A-share qfq; dividend-reinvestment factor convention",
  formula: "adjusted_close_t = raw_close_t * factor_t / factor_reference",
  reference_rule:
    "Latest valid selected-period trading date; common reference for every observation",
} as const;

const coverageSchema = z
  .object({ start: z.string().refine(isCalendarDate), end: z.string().refine(isCalendarDate) })
  .nullable();
const priceSchema = z.object({
  date: z.string().refine(isCalendarDate),
  close: z.number().finite().positive(),
  high: z.number().finite().positive().nullable(),
  low: z.number().finite().positive().nullable(),
  pre_close: z.number().finite().positive().nullable(),
});
const historicalResultSchema = financialResultSchema.extend({
  capability_id: z.literal("historical-analysis"),
  selected_company: z
    .object({
      company_id: z.string(),
      company_name: z.string(),
      industry_label: z.string(),
      exchange: z.literal("SSE"),
    })
    .nullable(),
  requested_period: z.enum(["1m", "6m", "1y", "5y"]),
  as_of_date: z.string().refine(isCalendarDate),
  actual_coverage_period: coverageSchema,
  selected_coverage_period: coverageSchema,
  currency: z.literal("CNY"),
  price_basis: z.literal("raw daily end-of-day quotes; not intraday"),
  price_series: z.array(priceSchema),
  metrics: z.record(z.string(), financialMetricSchema),
});
export type HistoricalAnalysisResult = z.infer<typeof historicalResultSchema>;
type Price = z.infer<typeof priceSchema>;
type QueryResult = Awaited<ReturnType<TushareQuery>>;

const positive = (value: unknown): number | null => {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};
const coverage = (rows: readonly { date: string }[]) =>
  rows.length ? { start: rows[0]!.date, end: rows[rows.length - 1]!.date } : null;
const usable = (result: QueryResult) =>
  result.status === "available" || result.status === "partial";
const dayOffset = (day: string, days: number) =>
  new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);

export async function historicalAnalysis(
  raw: unknown,
  context: FinancialContext,
): Promise<HistoricalAnalysisResult> {
  const validation = validateFinancialRequest(raw, context);
  const limitations: string[] =
    context.mode === "fixture"
      ? ["Development fixture observations only; not live financial data."]
      : [];
  const base = {
    capability_id: "historical-analysis" as const,
    provider: "Tushare",
    retrieved_at: new Date().toISOString(),
    mode: context.mode,
    currency: "CNY" as const,
    price_basis: "raw daily end-of-day quotes; not intraday" as const,
    requested_period: validation.success ? (validation.request.period ?? "1y") : ("1y" as const),
    as_of_date: validation.success ? validation.asOfDate : shanghaiDate(),
    selected_company: validation.success
      ? {
          company_id: validation.company.ticker,
          company_name: validation.company.name,
          industry_label: validation.company.industry,
          exchange: "SSE" as const,
        }
      : null,
    actual_coverage_period: null,
    selected_coverage_period: null,
    price_series: [] as Price[],
    metrics: {} as Record<string, FinancialMetric>,
    data_limitations: limitations,
  };
  if (!validation.success)
    return historicalResultSchema.parse({
      ...base,
      status: "invalid_input",
      data_limitations: [...limitations, validation.reason],
    });
  const { request, asOfDate } = validation;
  const start = shiftCalendarMonths(asOfDate, -60);
  const selectedStart = shiftCalendarMonths(
    asOfDate,
    -{ "1m": 1, "6m": 6, "1y": 12, "5y": 60 }[base.requested_period],
  );
  const params = {
    ts_code: `${request.company_id}.SH`,
    start_date: start.replaceAll("-", ""),
    end_date: asOfDate.replaceAll("-", ""),
  };
  if (context.mode === "fixture" && !context.query)
    return historicalResultSchema.parse({
      ...base,
      status: "unavailable",
      data_limitations: [
        ...limitations,
        "Fixture mode requires an explicitly injected fixture query; no live retrieval performed.",
      ],
    });
  const query = context.query ?? (await import("./tushare")).queryTushare;
  const safeQuery = async (
    endpoint: "daily" | "adj_factor",
    fields: string,
  ): Promise<QueryResult> => {
    try {
      return await query(endpoint, params, fields);
    } catch {
      return {
        status: "error",
        endpoint,
        rows: [],
        fields: fields.split(","),
        retrieved_at: new Date().toISOString(),
        limitations: ["Tushare retrieval failed; no fallback provider used."],
      };
    }
  };
  const [daily, factors] = await Promise.all([
    safeQuery("daily", "ts_code,trade_date,close,high,low,pre_close"),
    safeQuery("adj_factor", "ts_code,trade_date,adj_factor"),
  ]);
  const sources = [daily, factors].map(({ rows: _rows, ...source }) => ({
    provider: "Tushare",
    ...source,
  }));
  for (const result of [daily, factors]) {
    limitations.push(...result.limitations.map((reason) => `${result.endpoint}: ${reason}`));
    if (!usable(result)) limitations.push(`${result.endpoint}: ${result.status}`);
  }
  const rejectedPrices = new Set<string>();
  const normalize = (result: QueryResult, kind: "price" | "factor") => {
    const records = new Map<string, Price | number>();
    const excluded = new Set<string>();
    if (!usable(result)) return records;
    for (const row of result.rows) {
      if (row.ts_code !== params.ts_code) {
        limitations.push(`${result.endpoint}: excluded mismatched ticker.`);
        continue;
      }
      const compact = typeof row.trade_date === "string" ? row.trade_date : "";
      const date = /^\d{8}$/.test(compact)
        ? `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`
        : "";
      if (!isCalendarDate(date)) {
        limitations.push(`${result.endpoint}: excluded invalid trading date.`);
        continue;
      }
      if (date < start || date > asOfDate) {
        limitations.push(`${result.endpoint}: excluded date outside requested cutoff: ${date}.`);
        continue;
      }
      let value: Price | number | null;
      if (kind === "factor") value = positive(row.adj_factor);
      else {
        const close = positive(row.close);
        let high = positive(row.high);
        let low = positive(row.low);
        if (
          (high !== null && high < (close ?? 0)) ||
          (low !== null && close !== null && low > close) ||
          (high !== null && low !== null && high < low)
        ) {
          high = null;
          low = null;
        }
        value =
          close === null ? null : { date, close, high, low, pre_close: positive(row.pre_close) };
        if (high === null || low === null)
          limitations.push(`daily: missing/invalid raw high or low on ${date}.`);
      }
      if (value === null || excluded.has(date)) {
        excluded.add(date);
        records.delete(date);
        if (kind === "price") rejectedPrices.add(date);
        limitations.push(`${result.endpoint}: excluded invalid observation on ${date}.`);
        continue;
      }
      if (records.has(date)) {
        if (JSON.stringify(records.get(date)) === JSON.stringify(value)) {
          limitations.push(`${result.endpoint}: collapsed identical duplicate on ${date}.`);
        } else {
          excluded.add(date);
          records.delete(date);
          if (kind === "price") rejectedPrices.add(date);
          limitations.push(
            `${result.endpoint}: excluded all conflicting duplicate observations on ${date}.`,
          );
        }
      } else records.set(date, value);
    }
    return records;
  };
  const prices = [...normalize(daily, "price").values()]
    .filter((value): value is Price => typeof value !== "number")
    .sort((a, b) => a.date.localeCompare(b.date));
  const factorMap = normalize(factors, "factor");
  const selected = prices.filter((price) => price.date >= selectedStart);
  const latest = prices.at(-1);
  const actualCoverage = coverage(prices);
  const selectedCoverage = coverage(selected);
  const windowStart = latest ? dayOffset(latest.date, -363) : null;
  const windowPrices = prices.filter((price) => windowStart !== null && price.date >= windowStart);
  limitations.push(
    "Coverage describes observed records only, not complete listing history. Trading-calendar completeness and suspensions are not verified; charts must not imply gap-free history.",
  );
  if (actualCoverage && actualCoverage.start > start)
    limitations.push(
      `Retrieved history begins ${actualCoverage.start}, later than requested ${start}; listing date is unknown.`,
    );
  if (latest && latest.date < asOfDate)
    limitations.push(
      `Latest observed close is ${latest.date}, not an intraday quote or a verified quote on ${asOfDate}.`,
    );
  const dailySource = [sources[0]!];
  const partialReason =
    "Observed coverage is shorter than the requested window, or source records are incomplete; no complete trading-calendar verification.";
  const metric = (
    value: number | null,
    unit: string,
    period: FinancialMetric["period"],
    options: Partial<FinancialMetric> = {},
  ): FinancialMetric => {
    const finite = value !== null && Number.isFinite(value) ? value : null;
    return {
      value: finite,
      status: finite === null ? "unavailable" : "available",
      reason: finite === null ? "Required observations are unavailable or invalid." : null,
      unit,
      basis: base.price_basis,
      period,
      source: dailySource,
      ...options,
    };
  };
  const metrics: Record<string, FinancialMetric> = {};
  const latestPeriod = latest ? { start: latest.date, end: latest.date } : null;
  metrics.current_price = metric(latest?.close ?? null, "CNY/share", latestPeriod);
  const range = (rows: Price[], field: "high" | "low", boundary: string | null) => {
    const values = rows.flatMap((row) => (row[field] === null ? [] : [row[field]!]));
    const value = values.length
      ? field === "high"
        ? Math.max(...values)
        : Math.min(...values)
      : null;
    const partial =
      value !== null &&
      (daily.status === "partial" ||
        rows.some((row) => row[field] === null) ||
        rejectedPrices.size > 0 ||
        !actualCoverage ||
        (boundary !== null && actualCoverage.start > boundary));
    return metric(
      value,
      "CNY/share",
      coverage(rows),
      partial ? { status: "partial", reason: partialReason } : {},
    );
  };
  metrics["52_week_high"] = range(windowPrices, "high", windowStart);
  metrics["52_week_low"] = range(windowPrices, "low", windowStart);
  metrics.available_period_high = range(prices, "high", start);
  metrics.available_period_low = range(prices, "low", start);
  for (const side of ["high", "low"] as const) {
    const reference = metrics[`52_week_${side}`]!;
    const amount = latest && reference.value !== null ? latest.close - reference.value : null;
    const percentage =
      latest && reference.value !== null ? (latest.close / reference.value - 1) * 100 : null;
    const options = { status: reference.status, reason: reference.reason };
    metrics[`distance_from_52_week_${side}`] = {
      ...metric(amount, "CNY/share", reference.period, options),
      percentage: metric(percentage, "percentage_points", reference.period, options),
      definition:
        "amount = latest_close - reference; percentage = (latest_close / reference - 1) * 100",
    };
  }
  const previous = prices.at(-2);
  const consecutiveDates = previous && latest && dayOffset(previous.date, 1) === latest.date;
  const providerPreviousClose = latest?.pre_close ?? null;
  const previousClose = providerPreviousClose ?? (consecutiveDates ? previous.close : null);
  const previousBasis =
    providerPreviousClose !== null
      ? "Tushare daily.pre_close documented previous-session ex-rights quote basis (https://tushare.pro/document/2?doc_id=27); previous session date is not supplied"
      : "Previous raw daily close on the immediately preceding calendar date, independently of chart period";
  // pre_close is Tushare's documented previous-session quote basis, which may differ after a corporate action.
  if (previous && latest?.pre_close && Math.abs(previous.close - latest.pre_close) > 1e-8) {
    limitations.push(
      "daily.pre_close differs from the previous observed raw close (possible corporate action or gap). Daily change uses the documented provider previous-session ex-rights quote basis.",
    );
  }
  const changeReason =
    previousClose === null
      ? "previous_trading_session_unverified: valid provider pre_close is absent and no consecutive-calendar-day preceding daily observation is available."
      : null;
  if (changeReason) limitations.push(changeReason);
  const changePeriod =
    providerPreviousClose === null && consecutiveDates
      ? { start: previous.date, end: latest.date }
      : latestPeriod;
  const changeOptions = {
    basis: `${base.price_basis}; ${previousBasis}`,
    reason: changeReason,
  };
  metrics.daily_change_amount = metric(
    latest && previousClose !== null ? latest.close - previousClose : null,
    "CNY/share",
    changePeriod,
    changeOptions,
  );
  metrics.daily_change_percentage = metric(
    latest && previousClose !== null
      ? ((latest.close - previousClose) / previousClose) * 100
      : null,
    "percentage_points",
    changePeriod,
    changeOptions,
  );
  const referenceDate = selected.at(-1)?.date ?? null;
  const referenceFactor = referenceDate ? factorMap.get(referenceDate) : undefined;
  let drawdown: number | null = null;
  let drawdownReason: string | null = null;
  let drawdownStatus: FinancialMetric["status"] = "available";
  const invalidSelected = [...rejectedPrices].some((date) => date >= selectedStart);
  if (selected.length < 2) {
    drawdownStatus = "insufficient_data";
    drawdownReason = "Adjusted drawdown requires at least two selected-period observations.";
  } else if (
    invalidSelected ||
    !usable(factors) ||
    typeof referenceFactor !== "number" ||
    selected.some((price) => typeof factorMap.get(price.date) !== "number")
  ) {
    drawdownStatus = "unavailable";
    drawdownReason = `Adjusted drawdown unavailable: invalid/excluded selected prices or missing, invalid or conflicting ticker/date factors (${factors.status}); raw-price fallback is forbidden.`;
  } else {
    let peak = 0;
    drawdown = 0;
    for (const price of selected) {
      const adjusted = price.close * ((factorMap.get(price.date) as number) / referenceFactor);
      if (!Number.isFinite(adjusted) || adjusted <= 0) {
        drawdown = null;
        drawdownStatus = "unavailable";
        drawdownReason = "Non-positive or non-finite adjusted close.";
        break;
      }
      peak = Math.max(peak, adjusted);
      drawdown = Math.min(drawdown, adjusted / peak - 1);
    }
    if (
      drawdown !== null &&
      (daily.status === "partial" ||
        factors.status === "partial" ||
        selectedCoverage!.start > selectedStart)
    ) {
      drawdownStatus = "partial";
      drawdownReason = partialReason;
    }
  }
  if (drawdownReason) limitations.push(drawdownReason);
  const adjustmentBasis = {
    ...adjustmentConvention,
    reference_date: referenceDate,
    reference_factor: typeof referenceFactor === "number" ? referenceFactor : null,
    actual_coverage_period: drawdown === null ? null : selectedCoverage,
    source_status: factors.status,
  };
  metrics.max_drawdown = {
    ...metric(drawdown, "fraction", selectedCoverage, {
      status: drawdownStatus,
      reason: drawdownReason,
      basis: adjustmentConvention.formula,
      source: sources,
    }),
    adjustment_basis: adjustmentBasis,
    selected_period: base.requested_period,
  };
  const status = !usable(daily)
    ? "unavailable"
    : prices.length < 2 || selected.length < 2
      ? "insufficient_data"
      : Object.values(metrics).some((entry) => entry.status !== "available")
        ? "partial"
        : "available";
  return historicalResultSchema.parse({
    ...base,
    status,
    retrieved_at: daily.retrieved_at,
    sources,
    actual_coverage_period: actualCoverage,
    selected_coverage_period: selectedCoverage,
    requested_coverage_period: { start, end: asOfDate },
    selected_requested_period: { start: selectedStart, end: asOfDate },
    window_52_week:
      windowStart && latest
        ? { start: windowStart, end: latest.date, inclusive_calendar_days: 364 }
        : null,
    adjustment_basis: adjustmentBasis,
    price_series: selected,
    metrics,
    data_limitations: [...new Set(limitations)],
    calculation_definitions: {
      ranges:
        "Raw daily highs/lows over observed coverage, never all-time; 52 weeks = D minus 363 days through latest quote date D, inclusive.",
      drawdown:
        "min(adjusted_close / running_peak - 1), selected period only; non-positive fraction, display multiplied by 100.",
      daily_change:
        "latest raw close minus previous-session close; percentage points = amount / previous close * 100.",
      duplicates:
        "Collapse identical normalized observations; exclude every observation on conflicting ticker/date keys.",
    },
  });
}
