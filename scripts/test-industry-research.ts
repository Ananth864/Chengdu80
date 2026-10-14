import assert from "node:assert/strict";
import {
  aggregateIndustryResearch,
  industryResearch,
  type IndustryIncomeResponse,
} from "../apps/web/src/server/industry-research";
import {
  suppliedCompanyUniverse,
  type SuppliedCompany,
} from "../apps/web/src/server/company-universe";
import type { TushareQuery } from "../apps/web/src/server/tushare";

type Row = Record<string, string | number | null>;
const companies: SuppliedCompany[] = ["600001", "600002", "600003"].map((ticker, index) => ({
  exchange: "SSE",
  ticker,
  name: `Company ${index}`,
  industry: "Exact industry",
  market_cap_rmb: index,
  size_category: index ? "Small cap" : "Large cap",
}));
const selected = companies[0]!;
const fields = "ts_code,ann_date,f_ann_date,end_date,report_type,total_revenue".split(",");
function row(ticker: string, year: number, revenue: number | null, extra: Row = {}): Row {
  return {
    ts_code: `${ticker}.SH`,
    end_date: `${year}1231`,
    ann_date: `${year + 1}0301`,
    f_ann_date: `${year + 1}0301`,
    report_type: "1",
    total_revenue: revenue,
    currency: "CNY",
    unit: "yuan",
    ...extra,
  };
}
function response(ticker: string, rows: Row[]): IndustryIncomeResponse {
  return {
    company_id: ticker,
    result: {
      endpoint: "income",
      status: "available",
      rows,
      fields,
      retrieved_at: "2025-06-01T00:00:00Z",
      limitations: [],
    },
  };
}
function aggregate(
  responses: IndustryIncomeResponse[],
  extra: Partial<Parameters<typeof aggregateIndustryResearch>[0]> = {},
) {
  return aggregateIndustryResearch({
    selectedCompany: selected,
    companies,
    asOfDate: "2025-06-01",
    years: 2,
    retrievedAt: "2025-06-01T00:00:00Z",
    responses,
    ...extra,
  });
}

const matched = aggregate([
  response("600001", [row("600001", 2023, 100), row("600001", 2024, 110)]),
  response("600002", [row("600002", 2023, 200)]),
  response("600003", [row("600003", 2024, 400)]),
]);
assert.deepEqual(
  matched.annual_revenue_totals.map((entry) => entry.value),
  [300, 510],
);
assert.deepEqual(
  matched.annual_revenue_totals.map((entry) => entry.included_company_count),
  [2, 2],
);
const growth = matched.matched_cohort_yoy_growth[0]!;
assert(Math.abs(growth.value! - 10) < 1e-10);
assert.deepEqual(growth.matched_company_ids, ["600001"]);
assert.equal(growth.preceding_cohort_revenue, 100);
assert.equal(growth.current_cohort_revenue, 110);
assert.equal(growth.coverage, 1 / 3);
assert.equal(growth.status, "partial");
assert.equal(growth.sources.length, 2);
assert.equal(matched.data_label, "test_fixture");

const versions = aggregate([
  response("600001", [
    row("600001", 2024, 10),
    row("600001", 2024, 12, { f_ann_date: "20250501", report_type: "4" }),
    row("600001", 2024, 99, { f_ann_date: "20250602", report_type: "4" }),
    row("600001", 2024, 1000, { report_type: "6", f_ann_date: "20250502" }),
    row("600001", 2024, 2000, { report_type: "2", f_ann_date: "20250502" }),
    row("600001", 2024, 3000, { end_date: "20240930" }),
  ]),
]);
assert.equal(versions.annual_revenue_totals[1]!.value, 12);
assert.equal(versions.annual_revenue_totals[1]!.sources[0]!.publication_date, "2025-05-01");
assert.equal(versions.annual_revenue_totals[1]!.sources[0]!.report_type, "4");

for (const [extra, reason] of [
  [{ f_ann_date: "20250230" }, "invalid publication"],
  [{ f_ann_date: null, ann_date: null }, "publication date"],
  [{ f_ann_date: "20250602", ann_date: "20250301" }, "after as_of_date"],
  [{ f_ann_date: "20241201" }, "invalid publication"],
  [{ end_date: "20241331" }, "invalid annual"],
  [{ currency: "USD" }, "non-CNY"],
  [{ unit: "unknown" }, "unsupported revenue unit"],
  [{ total_revenue: "" }, "missing or invalid"],
  [{ total_revenue: null }, "missing or invalid"],
  [{ report_type: "6" }, "not annual consolidated"],
  [{ report_type: "2" }, "not annual consolidated"],
  [{ report_type: "3" }, "not annual consolidated"],
  [{ ts_code: "600999.SH" }, "identity mismatch"],
] as [Row, string][]) {
  const result = aggregate([response("600001", [row("600001", 2024, 10, extra)])]);
  const annual = result.annual_revenue_totals[1]!;
  assert.equal(annual.value, null, JSON.stringify(extra));
  assert(
    annual.exclusions[0]!.reasons.some((entry) => entry.includes(reason)),
    JSON.stringify(annual.exclusions),
  );
}
const fallback = aggregate([response("600001", [row("600001", 2024, 10, { f_ann_date: null })])]);
assert.equal(fallback.annual_revenue_totals[1]!.sources[0]!.publication_field, "ann_date");
for (const report_type of ["1", "4", "5"]) {
  assert.equal(
    aggregate([response("600001", [row("600001", 2024, 10, { report_type })])])
      .annual_revenue_totals[1]!.value,
    10,
  );
}
const conflict = aggregate([
  response("600001", [row("600001", 2024, 10), row("600001", 2024, 11)]),
]);
assert.equal(conflict.annual_revenue_totals[1]!.value, null);
assert(
  conflict.annual_revenue_totals[1]!.exclusions[0]!.reasons.includes(
    "conflicting equal-publication-date statements",
  ),
);
const badRevision = aggregate([
  response("600001", [
    row("600001", 2024, 10),
    row("600001", 2024, null, { f_ann_date: "20250501" }),
  ]),
]);
assert.equal(badRevision.annual_revenue_totals[1]!.value, null);
for (const publication of [
  { f_ann_date: "20250599" },
  { f_ann_date: null, ann_date: null },
  { f_ann_date: "20241201" },
] as Row[]) {
  for (const report_type of ["1", "4", "5"]) {
    const blocked = aggregate([
      response("600001", [
        row("600001", 2023, 100),
        row("600001", 2024, 10),
        row("600001", 2024, 12, { ...publication, report_type }),
      ]),
    ]);
    assert.equal(blocked.annual_revenue_totals[0]!.value, 100);
    assert.equal(blocked.annual_revenue_totals[1]!.value, null);
    assert(
      blocked.annual_revenue_totals[1]!.exclusions[0]!.reasons.some((reason) =>
        reason.includes("no older backfill"),
      ),
    );
    assert.equal(blocked.matched_cohort_yoy_growth[0]!.value, null);
  }
}
for (const report_type of ["2", "3", "6"]) {
  const unrelatedScope = aggregate([
    response("600001", [
      row("600001", 2024, 10),
      row("600001", 2024, 12, { report_type, f_ann_date: null, ann_date: null }),
    ]),
  ]);
  assert.equal(unrelatedScope.annual_revenue_totals[1]!.value, 10);
}
for (const report_type of ["4", "5"]) {
  const retainedConflict = aggregate([
    response("600001", [row("600001", 2024, 10), row("600001", 2024, 11, { report_type })]),
  ]);
  assert.equal(retainedConflict.annual_revenue_totals[1]!.value, null);
  assert(
    retainedConflict.annual_revenue_totals[1]!.exclusions[0]!.reasons.includes(
      "conflicting equal-publication-date statements",
    ),
  );
}
const units = aggregate([
  response("600001", [
    row("600001", 2023, 2, { unit: "ten_thousand_yuan", currency: "RMB" }),
    row("600001", 2024, 0.022, { unit: "million_yuan", currency: "CNY" }),
  ]),
]);
assert.deepEqual(
  units.annual_revenue_totals.map((entry) => entry.value),
  [20000, 22000],
);
assert(Math.abs(units.matched_cohort_yoy_growth[0]!.value! - 10) < 1e-10);
for (const denominator of [0, -10]) {
  const result = aggregate([
    response("600001", [row("600001", 2023, denominator), row("600001", 2024, 10)]),
  ]);
  assert.equal(result.annual_revenue_totals[0]!.value, denominator);
  assert.equal(result.matched_cohort_yoy_growth[0]!.value, null);
  assert.equal(result.matched_cohort_yoy_growth[0]!.status, "insufficient_data");
}
const noMatch = aggregate([
  response("600001", [row("600001", 2023, 10)]),
  response("600002", [row("600002", 2024, 20)]),
]);
assert.equal(noMatch.matched_cohort_yoy_growth[0]!.value, null);
assert.equal(noMatch.matched_cohort_yoy_growth[0]!.matched_company_count, 0);
const oneYear = aggregate([], { years: 1 });
assert.equal(oneYear.section_statuses.matched_cohort_yoy_growth, "insufficient_data");
assert.equal(oneYear.matched_cohort_yoy_growth.length, 0);
assert.throws(() => aggregate([], { period: "20251231" }));
assert.throws(() => aggregate([], { asOfDate: "2025-02-30" }));
assert.throws(() => aggregate([], { years: 6 }));
const five = aggregate([], { years: 5, asOfDate: "2025-01-01" });
assert.deepEqual(
  five.annual_revenue_totals.map((entry) => entry.financial_year),
  [2020, 2021, 2022, 2023, 2024],
);

let calls = 0;
const query: TushareQuery = async (endpoint, params, requestedFields) => {
  calls++;
  assert.equal(endpoint, "income");
  assert.match(params.ts_code!, /^\d{6}\.SH$/);
  assert.equal(requestedFields, fields.join(","));
  return response(params.ts_code!.slice(0, 6), []).result;
};
const request = { company_id: selected.ticker, as_of_date: "2025-06-01", years: 2 };
const shanghaiParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(new Date());
const today = ["year", "month", "day"]
  .map((key) => shanghaiParts.find((part) => part.type === key)!.value)
  .join("-");
const tomorrowDate = new Date(`${today}T00:00:00Z`);
tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
const tomorrow = tomorrowDate.toISOString().slice(0, 10);
for (const mode of ["fixture", "live"] as const) {
  const future = await industryResearch(
    { ...request, as_of_date: tomorrow },
    { mode, companies, query },
  );
  assert.equal(future.status, "invalid_input");
  assert(future.data_limitations.some((reason) => reason.includes("Asia/Shanghai")));
  assert.equal(calls, 0);
}
const currentCutoff = await industryResearch(
  { ...request, as_of_date: today },
  { mode: "fixture", companies, query },
);
assert.equal(currentCutoff.status, "unavailable");
assert.equal(currentCutoff.as_of_date, today);
assert.equal(calls, 0);
for (const invalid of [
  { company_id: 600001 },
  { company_id: "600001.SH" },
  { company_id: "600999" },
  { exchange: "SZSE" },
  { company_name: "Wrong" },
  { industry_label: "Exact" },
  { as_of_date: "2025-02-30" },
  { as_of_date: "9998-12-31" },
  { period: "20251231" },
  { years: 6 },
]) {
  const result = await industryResearch(
    { ...request, ...invalid },
    { mode: "live", companies, query },
  );
  assert.equal(result.status, "invalid_input");
  assert.equal(calls, 0);
}
const pinned = await industryResearch(request, {
  mode: "live",
  companies,
  query,
  companyIds: ["600002.SH"],
});
assert.equal(pinned.status, "invalid_input");
assert.equal(calls, 0);
const fixture = await industryResearch(request, { mode: "fixture", companies, query });
assert.equal(fixture.status, "unavailable");
assert.equal(fixture.data_label, "fixture_unavailable");
assert(fixture.annual_revenue_totals.every((entry) => entry.value === null));
assert.equal(calls, 0);
await industryResearch(request, { mode: "live", companies, query, companyIds: ["600001.SH"] });
assert.equal(calls, 9); // Three report types per peer; pins do not restrict peers.

// Ordinary income transport rows have neither currency nor unit fields.
const monetaryEvidence = {
  currency: "CNY",
  unit: "yuan",
  source: "Test-only verified monetary-basis evidence; not a live document verification",
} as const;
const ordinaryRows = [
  row(selected.ticker, 2023, 100, { currency: null, unit: null }),
  row(selected.ticker, 2024, 110, { currency: null, unit: null }),
];
for (const entry of ordinaryRows) {
  delete entry.currency;
  delete entry.unit;
}
const ordinaryQuery: TushareQuery = async (_, params) =>
  response(selected.ticker, params.report_type === "1" ? ordinaryRows : []).result;
const unverified = await industryResearch(request, {
  mode: "live",
  companies,
  query: ordinaryQuery,
  maxRequests: 3,
});
assert.equal(unverified.status, "unavailable");
assert(
  unverified.annual_revenue_totals.every(
    (entry) => entry.value === null && entry.status === "unavailable",
  ),
);
assert(
  unverified.annual_revenue_totals[1]!.exclusions[0]!.reasons.includes("unverified_currency_units"),
);
assert(unverified.data_limitations.some((reason) => reason.includes("unverified_currency_units")));
assert.equal(
  (
    await industryResearch(
      { ...request, monetaryEvidence },
      { mode: "live", companies, query: ordinaryQuery },
    )
  ).status,
  "invalid_input",
);
const verified = await industryResearch(request, {
  mode: "live",
  companies,
  query: ordinaryQuery,
  maxRequests: 3,
  monetaryEvidence,
});
assert.deepEqual(
  verified.annual_revenue_totals.map((entry) => entry.value),
  [100, 110],
);
assert.equal(verified.annual_revenue_totals[1]!.status, "partial");
assert(Math.abs(verified.matched_cohort_yoy_growth[0]!.value! - 10) < 1e-10);
assert(
  verified.annual_revenue_totals[1]!.sources[0]!.currency_unit_basis.includes(
    monetaryEvidence.source,
  ),
);
const pureUnverified = aggregate([response(selected.ticker, ordinaryRows)]);
assert.equal(pureUnverified.annual_revenue_totals[1]!.value, null);
const pureVerified = aggregate([response(selected.ticker, ordinaryRows)], { monetaryEvidence });
assert.deepEqual(
  pureVerified.annual_revenue_totals.map((entry) => entry.value),
  [100, 110],
);
for (const metadata of [{ currency: null }, { unit: null }] as Row[]) {
  const missingMetadata = aggregate([
    response(selected.ticker, [row(selected.ticker, 2024, 10, metadata)]),
  ]);
  assert(
    missingMetadata.annual_revenue_totals[1]!.exclusions[0]!.reasons.includes(
      "unverified_currency_units",
    ),
  );
}
const conflictingEvidence = aggregate(
  [response(selected.ticker, [row(selected.ticker, 2024, 10, { currency: "USD" })])],
  { monetaryEvidence },
);
assert.equal(conflictingEvidence.annual_revenue_totals[1]!.value, null);
assert(
  conflictingEvidence.annual_revenue_totals[1]!.exclusions[0]!.reasons.includes("non-CNY currency"),
);
assert.throws(() => aggregate([], { monetaryEvidence: { ...monetaryEvidence, source: " " } }));

const universe = suppliedCompanyUniverse();
const manufacturer = universe.find((company) => company.industry === "制造业")!;
const allManufacturers = universe.filter((company) => company.industry === manufacturer.industry);
assert.equal(allManufacturers.length, 1517);
const all = aggregate(
  allManufacturers.map((company) =>
    response(company.ticker, [row(company.ticker, 2023, 100), row(company.ticker, 2024, 110)]),
  ),
  { selectedCompany: manufacturer, companies: universe },
);
assert.deepEqual(
  all.annual_revenue_totals.map((entry) => entry.included_company_count),
  [1517, 1517],
);
assert.equal(all.annual_revenue_totals[0]!.value, 151700);
assert.equal(all.matched_cohort_yoy_growth[0]!.matched_company_count, 1517);
assert.equal(all.status, "available");

const order: string[] = [];
let active = 0;
let peak = 0;
const boundedQuery: TushareQuery = async (_, params) => {
  assert(["1", "4", "5"].includes(params.report_type!));
  const ticker = params.ts_code!.slice(0, 6);
  order.push(ticker);
  active++;
  peak = Math.max(peak, active);
  await Bun.sleep(1);
  active--;
  return response(ticker, [row(ticker, 2023, 100), row(ticker, 2024, 110)]).result;
};
const bounded = await industryResearch(
  { company_id: manufacturer.ticker, as_of_date: "2025-06-01" },
  { mode: "live", query: boundedQuery, maxRequests: 10000 },
);
assert.equal(order.length, 78);
assert.equal(order[0], manufacturer.ticker);
assert.deepEqual(
  [...new Set(order)].slice(1),
  allManufacturers
    .map((company) => company.ticker)
    .filter((ticker) => ticker !== manufacturer.ticker)
    .sort()
    .slice(0, 25),
);
assert.equal(peak, 2);
assert.equal(bounded.total_universe_count, 1517);
assert.equal(bounded.unqueried_company_count, 1491);
assert.equal(bounded.annual_revenue_totals[4]!.included_company_count, 26);
assert.equal(bounded.annual_revenue_totals[4]!.exclusions.length, 1491);
assert.equal(bounded.annual_revenue_totals[4]!.status, "partial");
assert(
  bounded.data_limitations.some((entry) =>
    entry.includes("bounded request budget; 1491 unqueried"),
  ),
);
assert.equal(bounded.data_label, "test_fixture");

const capped = await industryResearch(request, {
  mode: "live",
  companies,
  query: boundedQuery,
  maxRequests: 3,
});
assert.equal(capped.queried_company_count, 1);
assert.equal(capped.unqueried_company_count, 2);
const zeroBudget = await industryResearch(request, {
  mode: "live",
  companies,
  query,
  maxRequests: 0,
});
assert.equal(zeroBudget.queried_company_count, 0);
assert.equal(zeroBudget.unqueried_company_count, 3);
const outsideDiscovery = universe.find((company) => company.industry === "农、林、牧、渔业")!;
assert(outsideDiscovery);
const outside = await industryResearch(
  { company_id: outsideDiscovery.ticker },
  { mode: "live", query: boundedQuery, maxRequests: 3 },
);
assert.equal(outside.industry_label, outsideDiscovery.industry);
assert.equal(
  outside.total_universe_count,
  universe.filter((company) => company.industry === outsideDiscovery.industry).length,
);
assert.equal(outside.queried_company_count, 1);
const duplicate = aggregate([], { companies: [...companies, selected] });
assert.equal(duplicate.total_universe_count, 3);
assert.throws(() =>
  aggregate([], { companies: [...companies, { ...selected, industry: "Wrong" }] }),
);
const changingCohorts = aggregate(
  [
    response("600001", [row("600001", 2022, 10), row("600001", 2023, 20)]),
    response("600002", [row("600002", 2023, 20), row("600002", 2024, 30)]),
  ],
  { years: 3 },
);
assert.deepEqual(
  changingCohorts.matched_cohort_yoy_growth.map((entry) => entry.matched_company_ids),
  [["600001"], ["600002"]],
);
assert.deepEqual(
  changingCohorts.matched_cohort_yoy_growth.map((entry) => entry.value),
  [100, 50],
);

for (const status of [
  "missing_credentials",
  "permission_denied",
  "rate_limited",
  "error",
  "no_results",
  "partial",
] as const) {
  const result = await industryResearch(request, {
    mode: "live",
    companies,
    query: async () => ({
      ...response("600001", [row("600001", 2024, 10)]).result,
      status,
      limitations: [`fixture ${status}`],
    }),
  });
  assert.equal(result.annual_revenue_totals[1]!.value, null);
  assert(
    result.annual_revenue_totals[1]!.exclusions[0]!.reasons.includes(`income retrieval ${status}`),
  );
}
const started = Date.now();
const deadline = await industryResearch(request, {
  mode: "live",
  companies,
  deadlineMs: 15,
  query: async () => new Promise(() => {}),
});
assert(Date.now() - started < 1000);
assert.equal(deadline.queried_company_count, 2);
assert.equal(deadline.unqueried_company_count, 1);
assert(
  deadline.annual_revenue_totals[1]!.exclusions.some((entry) =>
    entry.reasons.some((reason) => reason.includes("deadline")),
  ),
);
const thrown = await industryResearch(request, {
  mode: "live",
  companies,
  query: async () => {
    throw new Error("secret must not leak");
  },
});
assert(!JSON.stringify(thrown).includes("secret must not leak"));
const missingFields = aggregate([
  {
    ...response("600001", [row("600001", 2024, 10)]),
    result: { ...response("600001", []).result, fields: [] },
  },
]);
assert.equal(missingFields.annual_revenue_totals[1]!.value, null);
console.log(
  "PASS industry research: full-universe membership, annual scope, fail-closed revision dates, Shanghai cutoff, trusted monetary evidence, missing/zero, matched cohorts, identity gates and bounded retrieval (fixtures only; no live requests)",
);
