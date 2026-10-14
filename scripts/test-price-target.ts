import assert from "node:assert/strict";
import {
  brokerageEvidenceSchema,
  brokerageReportIdentity,
  priceTarget,
  summarizeBrokerageReports,
  type BrokerageEvidence,
} from "../apps/web/src/server/price-target";
import type { SuppliedCompany } from "../apps/web/src/server/company-universe";
import type { TushareQuery, TushareRow } from "../apps/web/src/server/tushare";

// Synthetic server-owned evidence proves arithmetic and gates, not live definitions.
const asOf = "2026-10-01";
const quote = { close: 10, trade_date: asOf, currency: "CNY" as const, per_share_basis: "raw" };
const rows: TushareRow[] = [10, 12, 14].map((minimum, index) => ({
  ts_code: "600000.SH",
  org_name: `Broker ${index}`,
  author_name: "Fixture author",
  report_date: "20260930",
  report_title: `Fixture ${index}`,
  quarter: "2026Q4",
  rating: index === 2 ? "fixture-hold" : "fixture-buy",
  min_price: minimum,
  max_price: minimum + 4,
}));
function evidenceFor(data: TushareRow[]): BrokerageEvidence {
  return {
    version: 1,
    sources: [
      {
        id: "fixture",
        url: "https://example.com/fixture-only",
        description: "Synthetic test evidence, not brokerage definitions",
      },
    ],
    brokerages: [...new Set(data.map((row) => String(row.org_name)))].map((alias, index) => ({
      id: `b${index}`,
      aliases: [alias],
      source_ids: ["fixture"],
      rating_mapping: {
        version: "fixture-v1",
        source_ids: ["fixture"],
        values: [
          { raw: "fixture-buy", category: "Buy" },
          { raw: "fixture-hold", category: "Hold" },
        ],
      },
    })),
    targets: data.map((row) => ({
      report_identity: brokerageReportIdentity(row),
      brokerage_id: `b${[...new Set(data.map((entry) => String(entry.org_name)))].indexOf(String(row.org_name))}`,
      source_ids: ["fixture"],
      currency: "CNY",
      per_share_basis: "raw",
      horizon: {
        reference: "report_date",
        amount: 12,
        unit: "months",
        label: "12 months from report date",
      },
    })),
  };
}
const evidence = evidenceFor(rows);
const summarize = (data: TushareRow[], configured = evidence) =>
  summarizeBrokerageReports(data, asOf, quote, configured);
const result = summarize(rows);
assert.equal(result.target_groups[0]!.average_midpoint, 14);
assert(Math.abs(result.target_groups[0]!.implied_percentage_difference! - 40) < 1e-10);
assert.deepEqual(
  result.target_groups[0]!.contributions.map((entry) => entry.midpoint),
  [12, 14, 16],
);
assert.deepEqual(result.rating_summary.counts, {
  "Strong Sell": 0,
  Sell: 0,
  Hold: 1,
  Buy: 2,
  "Strong Buy": 0,
});
assert.equal(result.rating_summary.category, "Buy");
assert.equal(result.rating_summary.majority, true);
const two = summarize(rows.slice(0, 2));
assert.equal(two.target_groups[0]!.average_midpoint, null);
assert.equal(two.target_groups[0]!.implied_percentage_difference, null);
assert.equal(two.target_groups[0]!.availability_reason, "insufficient_brokerage_coverage");
assert.equal(two.rating_summary.mapped_brokerage_count, 2);
const downside = summarizeBrokerageReports(rows, asOf, { ...quote, close: 20 }, evidence);
assert.equal(downside.target_groups[0]!.implied_percentage_difference, -30.000000000000004);
assert.equal(downside.target_groups[0]!.price_difference_label, "downside");
for (const badQuote of [
  { ...quote, close: 0 },
  { ...quote, trade_date: "2026-10-02" },
  { ...quote, per_share_basis: "adjusted" },
]) {
  assert.equal(
    summarizeBrokerageReports(rows, asOf, badQuote, evidence).target_groups[0]!
      .implied_percentage_difference,
    null,
  );
}
assert.equal(
  summarize([...rows, { ...rows[0]!, quarter: "2027Q4" }]).rating_summary.mapped_brokerage_count,
  3,
);
assert.equal(
  summarize([...rows, { ...rows[0]!, quarter: "2027Q4" }]).target_groups[0]!.contributions.length,
  3,
);
const latestMissing = [
  ...rows,
  { ...rows[0]!, report_date: "20261001", rating: null, min_price: null, max_price: null },
];
const noBackfill = summarize(latestMissing);
assert.equal(noBackfill.rating_summary.mapped_brokerage_count, 2);
assert.equal(noBackfill.target_groups[0]!.contributions.length, 2);
assert(noBackfill.exclusions.some((entry) => entry.reason === "superseded_report_no_backfill"));
for (const date of ["20260930", "20261001"]) {
  for (const title of [null, "", "   "]) {
    const incompleteRow = { ...rows[0]!, report_date: date, report_title: title };
    for (const ordered of [
      [...rows, incompleteRow],
      [incompleteRow, ...rows.toReversed()],
    ]) {
      const blocked = summarize(ordered);
      assert.equal(blocked.rating_summary.mapped_brokerage_count, 2);
      assert.equal(blocked.rating_summary.excluded_brokerage_count, 1);
      assert.equal(blocked.target_groups[0]!.contributions.length, 2);
      assert(blocked.exclusions.some((entry) => entry.reason === "invalid_report_identity"));
      assert(
        blocked.exclusions.some(
          (entry) =>
            entry.summary === "rating" && entry.reason === "incomplete_latest_report_identity",
        ),
      );
      assert(
        blocked.exclusions.some(
          (entry) =>
            entry.summary === "target" && entry.reason === "incomplete_latest_report_identity",
        ),
      );
      assert(
        blocked.selected_reports.some((report) => report.original_rows.includes(incompleteRow)),
      );
    }
  }
}
const olderIncomplete = summarize([
  ...rows,
  { ...rows[0]!, report_date: "20260929", report_title: null },
]);
assert.equal(olderIncomplete.rating_summary.mapped_brokerage_count, 3);
assert.equal(olderIncomplete.target_groups[0]!.average_midpoint, 14);
const extremeRows = rows.map((row) => ({ ...row, min_price: 1e308, max_price: 1.6e308 }));
const extreme = summarize(extremeRows).target_groups[0]!;
assert(
  extreme.contributions.every(
    (entry) => Number.isFinite(entry.midpoint) && entry.midpoint === 1.3e308,
  ),
);
assert(Number.isFinite(extreme.average_midpoint));
assert.equal(extreme.implied_percentage_difference, null);
assert.equal(extreme.status, "unavailable");
assert.equal(extreme.availability_reason, "non_finite_calculation");
assert.equal(extreme.price_difference_reason, "non_finite_calculation");
const overflowAverage = summarize(
  rows.map((row) => ({
    ...row,
    min_price: Number.MAX_VALUE,
    max_price: Number.MAX_VALUE,
  })),
).target_groups[0]!;
assert(overflowAverage.contributions.every((entry) => entry.midpoint === Number.MAX_VALUE));
assert.equal(overflowAverage.average_midpoint, null);
assert.equal(overflowAverage.implied_percentage_difference, null);
assert.equal(overflowAverage.status, "unavailable");
assert.equal(overflowAverage.availability_reason, "non_finite_calculation");
const tinyQuote = summarizeBrokerageReports(
  rows,
  asOf,
  { ...quote, close: Number.MIN_VALUE },
  evidence,
).target_groups[0]!;
assert.equal(tinyQuote.implied_percentage_difference, null);
assert.equal(tinyQuote.price_difference_reason, "non_finite_calculation");
const tinyBounds = summarize(
  rows.map((row) => ({ ...row, min_price: Number.MIN_VALUE, max_price: Number.MIN_VALUE })),
).target_groups[0]!;
assert(tinyBounds.contributions.every((entry) => entry.midpoint === Number.MIN_VALUE));
assert.equal(tinyBounds.average_midpoint, null);
assert.equal(tinyBounds.availability_reason, "non_finite_calculation");
const invalidBounds: TushareRow[] = [
  { min_price: null },
  { min_price: -1 },
  { min_price: 0 },
  { min_price: 99 },
  { max_price: Infinity },
];
for (const bounds of invalidBounds) {
  const invalid = summarize([{ ...rows[0]!, ...bounds }, ...rows.slice(1)]);
  assert.equal(invalid.target_groups[0]!.contributions.length, 2);
  assert.equal(invalid.rating_summary.mapped_brokerage_count, 3);
}
const cutoffRows = ["20260704", "20260703", "20261002"].map((date, i) => ({
  ...rows[i]!,
  report_date: date,
}));
const cutoff = summarize(cutoffRows, evidenceFor(cutoffRows));
assert.equal(cutoff.query_window.start_date, "2026-07-04");
assert.equal(cutoff.selected_reports.length, 1);
assert(cutoff.exclusions.some((entry) => entry.reason === "future_report"));
assert(cutoff.exclusions.some((entry) => entry.reason === "outside_report_window"));
const aliasEvidence = structuredClone(evidence);
aliasEvidence.brokerages[0]!.aliases.push("Documented alias");
const aliasRow = { ...rows[0]!, org_name: "Documented alias" };
const alias = summarize([aliasRow, ...rows], aliasEvidence);
assert.equal(alias.rating_summary.mapped_brokerage_count, 3);
assert.equal(alias.target_groups[0]!.contributions.length, 2); // alias report lacks its own target source
const reversedAlias = summarize([aliasRow, ...rows].toReversed(), aliasEvidence);
assert.deepEqual(reversedAlias.rating_summary.counts, alias.rating_summary.counts);
assert.equal(reversedAlias.target_groups[0]!.contributions.length, 2);
assert.equal(reversedAlias.target_groups[0]!.average_midpoint, null);
const incompleteAlias = { ...aliasRow, report_date: "20261001", report_title: null };
for (const ordered of [
  [...rows, incompleteAlias],
  [incompleteAlias, ...rows.toReversed()],
]) {
  const blockedAlias = summarize(ordered, aliasEvidence);
  assert.equal(blockedAlias.rating_summary.mapped_brokerage_count, 2);
  assert.equal(blockedAlias.target_groups[0]!.contributions.length, 2);
}
assert(
  summarize([{ ...rows[0]!, org_name: "Unknown" }]).exclusions.some(
    (entry) => entry.reason === "unresolved_brokerage_identity",
  ),
);
assert(
  summarize([{ ...rows[0]!, org_name: null }]).exclusions.some(
    (entry) => entry.reason === "missing_brokerage_identity",
  ),
);
aliasEvidence.brokerages[1]!.aliases.push("Broker 0");
assert(
  summarize(rows, aliasEvidence).exclusions.some(
    (entry) => entry.reason === "ambiguous_brokerage_identity",
  ),
);
const tiedRatings = [
  { ...rows[0]!, rating: "fixture-buy" },
  { ...rows[1]!, rating: "fixture-hold" },
];
assert.equal(summarize(tiedRatings).rating_summary.category, "Mixed");
assert.deepEqual(summarize(tiedRatings).rating_summary.tied_categories, ["Hold", "Buy"]);
assert.equal(summarize(tiedRatings).rating_summary.majority, false);
assert.equal(summarize([]).rating_summary.category, null);
assert.equal(summarize([]).rating_summary.status, "unavailable");
const noEvidence = summarizeBrokerageReports(rows, asOf, quote);
assert.equal(noEvidence.rating_summary.mapped_brokerage_count, 0);
assert.equal(noEvidence.target_groups.length, 0);
const aliasesOnly = structuredClone(evidence);
aliasesOnly.targets = [];
for (const brokerage of aliasesOnly.brokerages) delete brokerage.rating_mapping;
const noInference = summarize(
  rows.map((row) => ({ ...row, rating: "买入" })),
  aliasesOnly,
);
assert.equal(noInference.rating_summary.category, null);
assert.equal(noInference.target_groups.length, 0);
assert(noInference.exclusions.some((entry) => entry.reason === "unverified_target_horizon"));
const targetsWithoutRatings = summarize(rows.map((row) => ({ ...row, rating: "unmapped" })));
assert.equal(targetsWithoutRatings.rating_summary.category, null);
assert.equal(targetsWithoutRatings.target_groups[0]!.average_midpoint, 14);
const ratingsWithoutTargets = summarize(rows, { ...evidence, targets: [] });
assert.equal(ratingsWithoutTargets.rating_summary.mapped_brokerage_count, 3);
assert.equal(ratingsWithoutTargets.target_groups.length, 0);
// Conflicting same-report forecast rows affect the two summaries independently.
const ratingConflict = summarize([
  ...rows,
  { ...rows[0]!, quarter: "2027Q4", rating: "fixture-hold" },
]);
assert.equal(ratingConflict.rating_summary.mapped_brokerage_count, 2);
assert.equal(ratingConflict.target_groups[0]!.contributions.length, 3);
const targetConflict = summarize([...rows, { ...rows[0]!, quarter: "2027Q4", min_price: 9 }]);
assert.equal(targetConflict.rating_summary.mapped_brokerage_count, 3);
assert.equal(targetConflict.target_groups[0]!.contributions.length, 2);
// A lexical title/identity is never a publication timestamp.
const otherReport = { ...rows[0]!, report_title: "ZZZ later-looking ID", rating: "fixture-hold" };
const conflictEvidence = structuredClone(evidence);
conflictEvidence.targets.push({
  ...evidence.targets[0]!,
  report_identity: brokerageReportIdentity(otherReport),
});
const unorderable = summarize([...rows, otherReport], conflictEvidence);
assert.equal(unorderable.rating_summary.mapped_brokerage_count, 2);
assert.equal(unorderable.target_groups[0]!.contributions.length, 3);
for (const ordered of [
  [...rows, { ...otherReport, create_time: "2099-12-31 23:59:59" }],
  [{ ...otherReport, create_time: "1900-01-01 00:00:00" }, ...rows.toReversed()],
]) {
  const misleadingUpdateTime = summarize(ordered, conflictEvidence);
  assert.deepEqual(misleadingUpdateTime.rating_summary.counts, unorderable.rating_summary.counts);
  assert.equal(misleadingUpdateTime.target_groups[0]!.average_midpoint, 14);
  assert(
    misleadingUpdateTime.exclusions.some((entry) => entry.reason === "conflicting_latest_ratings"),
  );
}
const sixMonths = structuredClone(evidence);
sixMonths.targets[0]!.horizon = {
  reference: "report_date",
  amount: 6,
  unit: "months",
  label: "6 months",
};
const separated = summarize(rows, sixMonths);
assert.equal(separated.target_groups.length, 2);
assert(separated.target_groups.every((group) => group.average_midpoint === null));
sixMonths.targets[1]!.horizon = {
  reference: "fixed_date",
  target_date: "2027-09-30",
  label: "Fixed date",
};
assert.equal(summarize(rows, sixMonths).target_groups.length, 3);
assert(
  summarize([{ ...rows[0]!, report_title: null }]).exclusions.some(
    (entry) => entry.reason === "invalid_report_identity",
  ),
);
assert.throws(() =>
  brokerageEvidenceSchema.parse({
    ...evidence,
    targets: [...evidence.targets, evidence.targets[0]],
  }),
);
assert.throws(() => brokerageEvidenceSchema.parse({ ...evidence, sources: [] }));
assert.throws(() =>
  brokerageEvidenceSchema.parse({
    ...evidence,
    targets: [{ ...evidence.targets[0]!, report_identity: "invented-id" }],
  }),
);
const company: SuppliedCompany = {
  exchange: "SSE",
  ticker: "600000",
  name: "Fixture company",
  industry: "Fixture industry",
  market_cap_rmb: 1,
  size_category: "Small cap",
};
const request = {
  company_id: company.ticker,
  exchange: "SSE",
  company_name: company.name,
  industry_label: company.industry,
  as_of_date: asOf,
};
const calls: { endpoint: string; params: Record<string, string>; fields?: string }[] = [];
const query: TushareQuery = async (endpoint, params, fields) => {
  calls.push({ endpoint, params, fields });
  return {
    status: "available",
    endpoint,
    retrieved_at: "2026-10-01T00:00:00Z",
    fields: fields!.split(","),
    limitations: [],
    rows:
      endpoint === "report_rc"
        ? [...rows, { ...rows[0]!, ts_code: "600001.SH" }]
        : [{ ts_code: "600000.SH", trade_date: "20261001", close: 10 }],
  };
};
const context = {
  mode: "fixture" as const,
  companies: [company],
  companyIds: [company.ticker],
  query,
  evidence,
};
const api = (await priceTarget(request, context)) as typeof result & {
  capability_id: string;
  source: { fixture: boolean };
};
assert.equal(api.capability_id, "price-target");
assert.equal(api.source.fixture, true);
assert.equal(api.target_groups[0]!.average_midpoint, 14);
assert.equal(calls.length, 2);
assert.deepEqual(calls[0]!.params, {
  ts_code: "600000.SH",
  start_date: "20260704",
  end_date: "20261001",
});
assert(calls[0]!.fields!.includes("author_name"));
const quoteFailure = (await priceTarget(request, {
  ...context,
  query: async (endpoint, params, fields) => {
    if (endpoint === "daily") throw new Error("private provider failure");
    return query(endpoint, params, fields);
  },
})) as typeof result & {
  retrieved_at: string;
  retrievals: { endpoint: string; status: string; retrieved_at: string; fields: string[] }[];
};
assert.equal(quoteFailure.status, "partial");
assert.equal(quoteFailure.retrieved_at, "2026-10-01T00:00:00Z");
assert.equal(quoteFailure.retrievals[0]!.endpoint, "report_rc");
assert.equal(quoteFailure.retrievals[0]!.status, "available");
assert.equal(quoteFailure.retrievals[0]!.retrieved_at, quoteFailure.retrieved_at);
assert(quoteFailure.retrievals[0]!.fields.includes("author_name"));
assert.equal(quoteFailure.retrievals[1]!.endpoint, "daily");
assert.equal(quoteFailure.retrievals[1]!.status, "error");
assert.equal(quoteFailure.rating_summary.mapped_brokerage_count, 3);
assert.equal(quoteFailure.target_groups[0]!.average_midpoint, 14);
assert.equal(quoteFailure.target_groups[0]!.implied_percentage_difference, null);
assert.equal(
  quoteFailure.target_groups[0]!.price_difference_reason,
  "missing_valid_dated_raw_quote",
);
assert(quoteFailure.limitations.includes("raw_quote_unavailable: retrieval_error"));
assert(!JSON.stringify(quoteFailure).includes("private provider failure"));
for (const patch of [
  { company_id: "000000" },
  { company_id: 600000 },
  { company_name: "Wrong" },
  { industry_label: "Wrong" },
  { exchange: "SZSE" },
  { as_of_date: "2026-02-30" },
  { evidence },
]) {
  await assert.rejects(priceTarget({ ...request, ...patch }, context));
}
await assert.rejects(priceTarget(request, { ...context, companyIds: [] }));
for (const status of [
  "missing_credentials",
  "permission_denied",
  "rate_limited",
  "error",
  "no_results",
] as const) {
  const failure = (await priceTarget(request, {
    ...context,
    query: async (endpoint) => ({
      status,
      endpoint,
      retrieved_at: "2026-10-01T00:00:00Z",
      rows: [],
      fields: [],
      limitations: [status],
    }),
  })) as { status: string };
  assert.equal(failure.status, status);
}
const incomplete = (await priceTarget(request, {
  ...context,
  query: async (endpoint) => ({
    status: "partial",
    endpoint,
    retrieved_at: "2026-10-01T00:00:00Z",
    rows,
    fields: [],
    limitations: ["pagination_cycle_detected"],
  }),
})) as typeof result;
assert.equal(incomplete.rating_summary.mapped_brokerage_count, 0);
assert.equal(incomplete.status, "partial");
const fixtureEmpty = (await priceTarget(request, { ...context, query: undefined })) as {
  status: string;
};
assert.equal(fixtureEmpty.status, "no_results");
console.log(
  "PASS price-target: synthetic evidence, arithmetic, coverage, selection, conflicts, provenance, horizons, identity and bounded adapter wiring; no authenticated retrieval claimed",
);
