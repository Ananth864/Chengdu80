import assert from "node:assert/strict";
import {
  historicalAnalysis,
  shanghaiDate,
  shiftCalendarMonths,
  validateFinancialRequest,
} from "../apps/web/src/server/historical-analysis";
import { suppliedCompanyUniverse } from "../apps/web/src/server/company-universe";
import type { TushareQuery } from "../apps/web/src/server/tushare";
import {
  financialRequestSchema,
  financialResultSchema,
  type FinancialMetric,
} from "../apps/web/starter/project/src/lib/financial-results";

type Row = Record<string, string | number | null>;
const company = suppliedCompanyUniverse()[0]!;
const request = { company_id: company.ticker, as_of_date: "2025-03-31", period: "1m" as const };
const calls: { endpoint: string; params: Record<string, string> }[] = [];
const quote = (date: string, close: number, extra: Row = {}): Row => ({
  ts_code: `${company.ticker}.SH`,
  trade_date: date.replaceAll("-", ""),
  close,
  high: close + 5,
  low: close - 5,
  pre_close: null,
  ...extra,
});
const factor = (date: string, value = 1, extra: Row = {}): Row => ({
  ts_code: `${company.ticker}.SH`,
  trade_date: date.replaceAll("-", ""),
  adj_factor: value,
  ...extra,
});
const query =
  (
    prices: Row[],
    factors: Row[],
    factorStatus: Awaited<ReturnType<TushareQuery>>["status"] = "available",
  ): TushareQuery =>
  async (endpoint, params, fields) => {
    calls.push({ endpoint, params });
    return {
      endpoint,
      status: endpoint === "adj_factor" ? factorStatus : "available",
      rows: endpoint === "daily" ? prices : factors,
      retrieved_at: "2025-03-31T09:00:00.000Z",
      fields: fields?.split(",") ?? [],
      limitations: [],
    };
  };
const run = (
  prices: Row[],
  factors: Row[],
  raw: unknown = request,
  factorStatus: Awaited<ReturnType<TushareQuery>>["status"] = "available",
) => historicalAnalysis(raw, { mode: "fixture", query: query(prices, factors, factorStatus) });
const metric = (result: Awaited<ReturnType<typeof run>>, name: string): FinancialMetric => {
  const value = result.metrics[name];
  assert(value, `Missing metric ${name}`);
  return value;
};
const dates = ["2025-03-25", "2025-03-26", "2025-03-27", "2025-03-28"];
const factors = dates.map((date) => factor(date));
const daily = await run([quote(dates[0]!, 100), quote(dates[1]!, 102)], factors);
assert.equal(metric(daily, "daily_change_amount").value, 2);
assert.equal(metric(daily, "daily_change_percentage").value, 2);
assert.equal(metric(daily, "daily_change_percentage").unit, "percentage_points");
assert.equal(metric(daily, "daily_change_amount").status, "available");
assert.equal(metric(daily, "daily_change_percentage").status, "available");
assert.match(daily.data_limitations.join(" "), /fixture/);
assert.equal("financials" in daily, false);
assert(financialResultSchema.safeParse(daily).success);
assert.equal(calls[0]!.params.start_date, "20200331");
assert.equal(calls[0]!.params.end_date, "20250331");

const decline = await run(
  dates.map((date, index) => quote(date, [100, 120, 90, 110][index]!)),
  factors,
);
assert.equal(metric(decline, "max_drawdown").value, -0.25);
assert.equal(metric(decline, "max_drawdown").unit, "fraction");
assert.equal(
  metric(await run([quote(dates[0]!, 100), quote(dates[1]!, 110)], factors), "max_drawdown").value,
  0,
);
const single = await run([quote(dates[0]!, 100)], factors);
assert.equal(single.status, "insufficient_data");
assert.equal(metric(single, "max_drawdown").status, "insufficient_data");
assert.equal(metric(single, "max_drawdown").value, null);
assert.equal(metric(single, "daily_change_percentage").value, null);

const splitQuotes = [quote(dates[0]!, 100), quote(dates[1]!, 50)];
const splitMissing = await run(splitQuotes, [], request, "permission_denied");
assert.equal(metric(splitMissing, "max_drawdown").value, null);
assert.equal(metric(splitMissing, "current_price").value, 50);
assert.match(metric(splitMissing, "max_drawdown").reason!, /permission_denied/);
const splitAdjusted = await run(splitQuotes, [factor(dates[0]!, 1), factor(dates[1]!, 2)]);
assert.equal(metric(splitAdjusted, "max_drawdown").value, 0);
assert.equal(
  metric(await run(splitQuotes, [factor(dates[0]!), factor(dates[1]!, 0)]), "max_drawdown").value,
  null,
);
assert.equal(
  metric(
    await run(splitQuotes, [factor(dates[0]!), factor(dates[1]!, 1, { ts_code: "600004.SH" })]),
    "max_drawdown",
  ).value,
  null,
);
const conflictingFactors = await run(splitQuotes, [
  factor(dates[0]!),
  factor(dates[1]!),
  factor(dates[1]!, 2),
]);
assert.equal(metric(conflictingFactors, "max_drawdown").value, null);

const boundaryPrices = [
  quote("2024-04-01", 500, { high: 999, low: 1 }),
  quote("2024-04-02", 100, { high: 200, low: 20 }),
  quote("2025-03-31", 110, { high: 120, low: 80 }),
];
const boundary = await run(boundaryPrices, [
  factor("2024-04-01"),
  factor("2024-04-02"),
  factor("2025-03-31"),
]);
assert.deepEqual(boundary.window_52_week, {
  start: "2024-04-02",
  end: "2025-03-31",
  inclusive_calendar_days: 364,
});
assert.equal(metric(boundary, "52_week_high").value, 200);
assert.equal(metric(boundary, "52_week_low").value, 20);
assert.equal(metric(boundary, "available_period_high").value, 999);
assert.equal(metric(boundary, "available_period_low").value, 1);
assert.equal(boundary.price_series.length, 1);
assert.equal(metric(boundary, "max_drawdown").value, null);
assert.equal(metric(boundary, "daily_change_amount").value, null);
assert.equal(metric(boundary, "daily_change_amount").status, "unavailable");
assert.match(
  metric(boundary, "daily_change_amount").reason!,
  /previous_trading_session_unverified/,
);
assert.equal(metric(boundary, "distance_from_52_week_high").value, -90);
const distance = metric(boundary, "distance_from_52_week_high").percentage as FinancialMetric;
assert(Math.abs(distance.value! + 45) < 1e-10);
assert.equal(distance.unit, "percentage_points");
assert.equal(metric(daily, "52_week_high").status, "partial");

const selectedOnly = await run(
  [quote("2025-01-01", 1000), quote(dates[0]!, 100), quote(dates[1]!, 110)],
  [factor("2025-01-01"), ...factors],
);
assert.equal(metric(selectedOnly, "max_drawdown").value, 0);
assert.equal(selectedOnly.price_series.length, 2);
const duplicate = await run(
  [quote(dates[0]!, 100), quote(dates[0]!, 100), quote(dates[1]!, 102)],
  factors,
);
assert.equal(duplicate.price_series.length, 2);
assert.match(duplicate.data_limitations.join(" "), /identical duplicate/);
const conflict = await run(
  [quote(dates[0]!, 100), quote(dates[1]!, 102), quote(dates[1]!, 101), quote(dates[2]!, 103)],
  factors,
);
assert.equal(conflict.price_series.length, 2);
assert.equal(metric(conflict, "max_drawdown").value, null);
assert.equal(metric(conflict, "daily_change_amount").value, null);
assert.match(conflict.data_limitations.join(" "), /conflicting duplicate/);
const invalid = await run(
  [
    quote("2025-02-30", 900),
    quote("2025-04-01", 900),
    quote(dates[0]!, 900, { ts_code: "600004.SH" }),
    quote(dates[0]!, 100),
    quote(dates[1]!, 102),
  ],
  factors,
);
assert.equal(metric(invalid, "current_price").value, 102);
assert.equal(invalid.price_series.length, 2);
const missingHigh = await run(
  [quote(dates[0]!, 100, { high: null }), quote(dates[1]!, 102)],
  factors,
);
assert.equal(metric(missingHigh, "52_week_high").status, "partial");
const invalidClose = await run(
  [quote(dates[0]!, 100), quote(dates[1]!, -1), quote(dates[2]!, 110)],
  factors,
);
assert.equal(metric(invalidClose, "max_drawdown").value, null);
const fallback = await run([quote(dates[0]!, 102, { pre_close: 100 })], factors);
assert.equal(metric(fallback, "daily_change_amount").value, 2);
assert.equal(metric(fallback, "daily_change_percentage").value, 2);
assert.equal(metric(fallback, "daily_change_amount").status, "available");
const preferProvider = await run(
  [quote(dates[0]!, 100), quote(dates[1]!, 102, { pre_close: 50 })],
  factors,
);
assert.equal(metric(preferProvider, "daily_change_amount").value, 52);
assert.equal(metric(preferProvider, "daily_change_percentage").value, 104);
assert.equal(metric(preferProvider, "daily_change_amount").status, "available");
assert.match(metric(preferProvider, "daily_change_amount").basis, /pre_close.*ex-rights/);
const gap = await run([quote(dates[0]!, 100), quote(dates[2]!, 102)], factors);
for (const name of ["daily_change_amount", "daily_change_percentage"]) {
  assert.equal(metric(gap, name).value, null);
  assert.equal(metric(gap, name).status, "unavailable");
  assert.match(metric(gap, name).reason!, /previous_trading_session_unverified/);
}
const weekend = await run(
  [quote("2025-03-28", 100), quote("2025-03-31", 102, { pre_close: 100 })],
  [factor("2025-03-28"), factor("2025-03-31")],
);
assert.equal(metric(weekend, "daily_change_amount").value, 2);
assert.equal(metric(weekend, "daily_change_percentage").value, 2);
assert.equal(metric(weekend, "daily_change_amount").status, "available");
assert.equal(metric(weekend, "daily_change_percentage").status, "available");
assert.deepEqual(metric(weekend, "daily_change_amount").period, {
  start: "2025-03-31",
  end: "2025-03-31",
});
const weekendMissing = await run(
  [quote("2025-03-28", 100), quote("2025-03-31", 102)],
  [factor("2025-03-28"), factor("2025-03-31")],
);
assert.equal(metric(weekendMissing, "daily_change_amount").value, null);
assert.match(
  metric(weekendMissing, "daily_change_amount").reason!,
  /previous_trading_session_unverified/,
);
const outsideChart = await run(
  [quote("2025-02-27", 100), quote("2025-02-28", 102)],
  [factor("2025-02-27"), factor("2025-02-28")],
);
assert.equal(outsideChart.price_series.length, 1);
assert.equal(metric(outsideChart, "daily_change_amount").value, 2);
assert.equal(metric(outsideChart, "daily_change_amount").status, "available");

assert.equal(shiftCalendarMonths("2024-02-29", -12), "2023-02-28");
assert.equal(shiftCalendarMonths("2025-03-31", -1), "2025-02-28");
assert.equal(shiftCalendarMonths("2024-03-31", -1), "2024-02-29");
await run([], [], { ...request, as_of_date: "2024-02-29" });
assert.equal(calls.at(-1)!.params.start_date, "20190228");
assert.equal(calls.at(-1)!.params.end_date, "20240229");
assert.equal(shanghaiDate(new Date("2025-03-31T16:30:00Z")), "2025-04-01");
for (const raw of [
  { ...request, company_id: "600000.SH" },
  { ...request, company_id: 600000 },
  { ...request, exchange: "SZSE" },
  { ...request, as_of_date: "2025-02-29" },
  { ...request, as_of_date: "2099-01-01" },
  { ...request, company_name: "Wrong" },
  { ...request, industry_label: "Wrong" },
  { ...request, unexpected: true },
  { ...request, years: 6 },
  { ...request, company_id: "000001" },
]) {
  const before = calls.length;
  assert.equal((await run([], [], raw)).status, "invalid_input");
  assert.equal(calls.length, before, "Invalid input must never retrieve financial data");
}
assert(
  financialRequestSchema.safeParse({ company_id: company.ticker, as_of_date: "2024-02-29" })
    .success,
);
assert(
  validateFinancialRequest(request, { mode: "fixture", companyIds: [`${company.ticker}.SH`] })
    .success,
);
assert(!validateFinancialRequest(request, { mode: "fixture", companyIds: [] }).success);
assert.equal((await historicalAnalysis(request, { mode: "fixture" })).status, "unavailable");
for (const status of [
  "missing_credentials",
  "permission_denied",
  "rate_limited",
  "error",
  "no_results",
] as const) {
  const blocked = await historicalAnalysis(request, {
    mode: "fixture",
    query: async (endpoint) => ({
      endpoint,
      status,
      rows: [],
      retrieved_at: "2025-03-31T09:00:00Z",
      fields: [],
      limitations: [],
    }),
  });
  assert.equal(blocked.status, "unavailable");
  assert.equal(metric(blocked, "current_price").value, null);
  assert.match(blocked.data_limitations.join(" "), new RegExp(status));
}
console.log(
  "PASS historical analysis: fixture arithmetic, adjustment joins, raw/adjusted isolation, 364-day boundary, coverage, calendar clamping, validation, duplicates and provider failures. Live authenticated retrieval not tested.",
);
