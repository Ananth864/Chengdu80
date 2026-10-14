import { z } from "zod";
import { suppliedCompanyUniverse, type SuppliedCompany } from "./company-universe";
import { financialRequestSchema } from "../../starter/project/src/lib/financial-results";
import { queryTushare, type TushareQuery } from "./tushare";

export const ratingCategories = ["Strong Sell", "Sell", "Hold", "Buy", "Strong Buy"] as const;
const dateSchema = z.iso.date();
const text = z.string().min(1);
const references = z.array(text).min(1);
const horizonSchema = z.discriminatedUnion("reference", [
  z
    .object({
      reference: z.literal("report_date"),
      amount: z.number().int().positive(),
      unit: z.enum(["days", "months", "years"]),
      label: text,
    })
    .strict(),
  z.object({ reference: z.literal("fixed_date"), target_date: dateSchema, label: text }).strict(),
]);

// Configuration belongs to the server, never to a financial tool request. URLs are
// provenance only: this capability does not fetch arbitrary evidence URLs.
export const brokerageEvidenceSchema = z
  .object({
    version: z.literal(1),
    sources: z.array(
      z
        .object({
          id: text,
          url: z
            .url()
            .refine((url) => new URL(url).protocol === "https:", "HTTPS evidence required"),
          description: text,
        })
        .strict(),
    ),
    brokerages: z.array(
      z
        .object({
          id: text,
          aliases: z.array(text).min(1),
          source_ids: references,
          rating_mapping: z
            .object({
              version: text,
              source_ids: references,
              values: z
                .array(z.object({ raw: text, category: z.enum(ratingCategories) }).strict())
                .min(1),
            })
            .strict()
            .optional(),
        })
        .strict(),
    ),
    targets: z.array(
      z
        .object({
          report_identity: text,
          brokerage_id: text,
          source_ids: references,
          currency: z.literal("CNY"),
          per_share_basis: text,
          horizon: horizonSchema,
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((evidence, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const sources = new Set(evidence.sources.map((source) => source.id));
    const brokerages = new Set(evidence.brokerages.map((brokerage) => brokerage.id));
    if (sources.size !== evidence.sources.length || brokerages.size !== evidence.brokerages.length)
      fail("Duplicate source or brokerage identity");
    const checkReferences = (ids: string[]) => {
      if (ids.some((id) => !sources.has(id))) fail("Unknown evidence source reference");
    };
    for (const brokerage of evidence.brokerages) {
      checkReferences(brokerage.source_ids);
      if (brokerage.rating_mapping) {
        checkReferences(brokerage.rating_mapping.source_ids);
        const raw = brokerage.rating_mapping.values.map((value) => value.raw);
        if (new Set(raw).size !== raw.length) fail("Ambiguous brokerage rating mapping");
      }
    }
    const targets = new Set<string>();
    for (const target of evidence.targets) {
      checkReferences(target.source_ids);
      if (!brokerages.has(target.brokerage_id)) fail("Unknown target brokerage");
      try {
        const identity: unknown = JSON.parse(target.report_identity);
        const tuple = z
          .tuple([z.string().regex(/^\d{6}\.SH$/), text, dateSchema, text])
          .parse(identity);
        if (
          !evidence.brokerages
            .find((entry) => entry.id === target.brokerage_id)
            ?.aliases.includes(tuple[1])
        )
          fail("Target report identity does not match brokerage aliases");
      } catch {
        fail("Invalid target report identity tuple");
      }
      const key = JSON.stringify([target.brokerage_id, target.report_identity]);
      if (targets.has(key)) fail("Ambiguous report target evidence");
      targets.add(key);
    }
  });

export type BrokerageEvidence = z.infer<typeof brokerageEvidenceSchema>;
export const emptyBrokerageEvidence: BrokerageEvidence = {
  version: 1,
  sources: [],
  brokerages: [],
  targets: [],
};
type Row = Record<string, string | number | null>;
export type BrokerageQuote = {
  close: number;
  trade_date: string;
  currency: "CNY";
  per_share_basis: string;
};

function sourceDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const iso = /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : value;
  return dateSchema.safeParse(iso).success ? iso : null;
}

function windowFor(asOf: string) {
  dateSchema.parse(asOf);
  return {
    start_date: new Date(Date.parse(`${asOf}T00:00:00Z`) - 89 * 86400000)
      .toISOString()
      .slice(0, 10),
    end_date: asOf,
    calendar_days: 90,
    inclusive: true,
  };
}

// report_rc has no documented publication-order identifier. The tuple is an
// identity approximation, NOT proof that equal-title same-day publications differ.
export function brokerageReportIdentity(row: Row): string {
  return JSON.stringify([row.ts_code, row.org_name, sourceDate(row.report_date), row.report_title]);
}

function horizonKey(horizon: z.infer<typeof horizonSchema>): string {
  return horizon.reference === "report_date"
    ? JSON.stringify([horizon.reference, horizon.amount, horizon.unit])
    : JSON.stringify([horizon.reference, horizon.target_date]);
}

export function summarizeBrokerageReports(
  data: readonly Row[],
  asOf: string,
  quote: BrokerageQuote | null,
  suppliedEvidence: BrokerageEvidence = emptyBrokerageEvidence,
) {
  const evidence = brokerageEvidenceSchema.parse(suppliedEvidence);
  const query_window = windowFor(asOf);
  const exclusions: {
    summary: "report" | "rating" | "target";
    reason: string;
    brokerage_id?: string;
    report_identities: string[];
  }[] = [];
  const exclude = (
    summary: "report" | "rating" | "target",
    reason: string,
    identities: string[],
    brokerage_id?: string,
  ) => {
    exclusions.push({ summary, reason, brokerage_id, report_identities: identities });
  };
  const reports = new Map<
    string,
    { identity: string; brokerage_id: string; date: string; rows: Row[]; incomplete: boolean }
  >();
  for (const row of data) {
    const identity = brokerageReportIdentity(row);
    const date = sourceDate(row.report_date);
    if (!date || date < query_window.start_date || date > asOf) {
      exclude(
        "report",
        !date ? "invalid_report_date" : date > asOf ? "future_report" : "outside_report_window",
        [identity],
      );
      continue;
    }
    const incomplete =
      typeof row.report_title !== "string" ||
      !row.report_title.trim() ||
      typeof row.ts_code !== "string" ||
      !/^\d{6}\.SH$/.test(row.ts_code);
    if (incomplete) exclude("report", "invalid_report_identity", [identity]);
    // Exact documented aliases only; no transliteration, fuzzy matching or suffix removal.
    const matches = evidence.brokerages.filter((brokerage) =>
      brokerage.aliases.includes(String(row.org_name)),
    );
    if (matches.length !== 1) {
      exclude(
        "report",
        row.org_name == null || row.org_name === ""
          ? "missing_brokerage_identity"
          : matches.length
            ? "ambiguous_brokerage_identity"
            : "unresolved_brokerage_identity",
        [identity],
      );
      continue;
    }
    const existing = reports.get(identity);
    if (existing) existing.rows.push(row);
    else
      reports.set(identity, {
        identity,
        brokerage_id: matches[0]!.id,
        date,
        rows: [row],
        incomplete,
      });
  }
  const latest = new Map<string, (typeof reports extends Map<string, infer R> ? R : never)[]>();
  for (const report of reports.values()) {
    const previous = latest.get(report.brokerage_id);
    if (!previous || report.date > previous[0]!.date) latest.set(report.brokerage_id, [report]);
    else if (report.date === previous[0]!.date) previous.push(report);
  }
  const selected = [...latest.values()].flat();
  for (const report of reports.values()) {
    if (!selected.includes(report))
      exclude("report", "superseded_report_no_backfill", [report.identity], report.brokerage_id);
  }
  const counts = Object.fromEntries(ratingCategories.map((category) => [category, 0])) as Record<
    (typeof ratingCategories)[number],
    number
  >;
  type Opinion = {
    brokerage_id: string;
    report_identities: string[];
    report_dates: string[];
    original_ratings: (string | number | null)[];
    category: (typeof ratingCategories)[number];
    mapping_version: string;
    mapping_sources: BrokerageEvidence["sources"];
  };
  const opinions: Opinion[] = [];
  type Contribution = {
    brokerage_id: string;
    report_identities: string[];
    report_dates: string[];
    minimum: number;
    maximum: number;
    midpoint: number;
    source_evidence: BrokerageEvidence["targets"];
  };
  const groups = new Map<
    string,
    {
      horizon: z.infer<typeof horizonSchema>;
      currency: "CNY";
      per_share_basis: string;
      contributions: Contribution[];
    }
  >();
  const sourcesFor = (ids: string[]) =>
    evidence.sources.filter((source) => ids.includes(source.id));
  for (const [brokerage_id, tiedReports] of latest) {
    const identities = tiedReports.map((report) => report.identity);
    const dates = tiedReports.map((report) => report.date);
    const rows = tiedReports.flatMap((report) => report.rows);
    // A dated, resolved brokerage row still establishes recency when its report
    // identity is incomplete. Do not silently select an older complete report.
    if (tiedReports.some((report) => report.incomplete)) {
      exclude("rating", "incomplete_latest_report_identity", identities, brokerage_id);
      exclude("target", "incomplete_latest_report_identity", identities, brokerage_id);
      continue;
    }
    const brokerage = evidence.brokerages.find((entry) => entry.id === brokerage_id)!;
    const ratings = [...new Set(rows.map((row) => row.rating ?? null))];
    const mapping = brokerage.rating_mapping;
    if (ratings.length !== 1)
      exclude("rating", "conflicting_latest_ratings", identities, brokerage_id);
    else if (ratings[0] == null || ratings[0] === "")
      exclude("rating", "missing_rating", identities, brokerage_id);
    else {
      const mapped = mapping?.values.find((value) => value.raw === ratings[0]);
      if (!mapped || !mapping) exclude("rating", "unmapped_rating", identities, brokerage_id);
      else {
        counts[mapped.category]++;
        opinions.push({
          brokerage_id,
          report_identities: identities,
          report_dates: dates,
          original_ratings: ratings,
          category: mapped.category,
          mapping_version: mapping.version,
          mapping_sources: sourcesFor(mapping.source_ids),
        });
      }
    }
    const bounds = new Set(
      rows.map((row) => JSON.stringify([row.min_price ?? null, row.max_price ?? null])),
    );
    if (bounds.size !== 1) {
      exclude("target", "conflicting_latest_targets", identities, brokerage_id);
      continue;
    }
    const minimum = rows[0]!.min_price;
    const maximum = rows[0]!.max_price;
    if (minimum == null || maximum == null) {
      exclude("target", "missing_target_bounds", identities, brokerage_id);
      continue;
    }
    if (
      typeof minimum !== "number" ||
      typeof maximum !== "number" ||
      !Number.isFinite(minimum) ||
      !Number.isFinite(maximum) ||
      minimum <= 0 ||
      maximum <= 0 ||
      minimum > maximum
    ) {
      exclude("target", "invalid_target_bounds", identities, brokerage_id);
      continue;
    }
    const targetEvidence = tiedReports.map((report) =>
      evidence.targets.find(
        (target) =>
          target.brokerage_id === brokerage_id && target.report_identity === report.identity,
      ),
    );
    if (targetEvidence.some((entry) => !entry)) {
      exclude("target", "unverified_target_horizon", identities, brokerage_id);
      continue;
    }
    const verified = targetEvidence as BrokerageEvidence["targets"];
    const keys = new Set(
      verified.map((target) =>
        JSON.stringify([horizonKey(target.horizon), target.per_share_basis]),
      ),
    );
    if (keys.size !== 1) {
      exclude("target", "conflicting_latest_target_evidence", identities, brokerage_id);
      continue;
    }
    const target = verified[0]!;
    const midpoint = minimum + (maximum - minimum) / 2;
    if (!Number.isFinite(midpoint) || midpoint <= 0) {
      exclude("target", "non_finite_calculation", identities, brokerage_id);
      continue;
    }
    const key = [...keys][0]!;
    const group = groups.get(key) ?? {
      horizon: target.horizon,
      currency: target.currency,
      per_share_basis: target.per_share_basis,
      contributions: [],
    };
    group.contributions.push({
      brokerage_id,
      report_identities: identities,
      report_dates: dates,
      minimum,
      maximum,
      midpoint,
      source_evidence: verified,
    });
    groups.set(key, group);
  }
  const mappedCount = opinions.length;
  const modeCount = Math.max(...Object.values(counts));
  const tied = ratingCategories.filter(
    (category) => counts[category] === modeCount && modeCount > 0,
  );
  const quoteDate = sourceDate(quote?.trade_date);
  const validQuote =
    quote &&
    Number.isFinite(quote.close) &&
    quote.close > 0 &&
    quote.currency === "CNY" &&
    quoteDate &&
    quoteDate <= asOf;
  const target_groups = [...groups.values()].map((group) => {
    const sufficient = group.contributions.length >= 3;
    const computedAverage = sufficient
      ? group.contributions.reduce(
          (sum, contribution) => sum + contribution.midpoint / group.contributions.length,
          0,
        )
      : null;
    const average =
      computedAverage !== null && Number.isFinite(computedAverage) && computedAverage > 0
        ? computedAverage
        : null;
    const compatible = validQuote && quote.per_share_basis === group.per_share_basis;
    const computedPercentage =
      average !== null && compatible ? (average / quote.close - 1) * 100 : null;
    const percentage =
      computedPercentage !== null && Number.isFinite(computedPercentage)
        ? computedPercentage
        : null;
    const reason = !sufficient
      ? "insufficient_brokerage_coverage"
      : average === null || (computedPercentage !== null && percentage === null)
        ? "non_finite_calculation"
        : null;
    return {
      ...group,
      label: "Average brokerage target midpoint",
      count_unit: "brokerages",
      eligible_brokerage_count: group.contributions.length,
      status: reason ? "unavailable" : "available",
      availability_reason: reason,
      average_midpoint: average,
      calculation_method:
        "Equal-weight arithmetic mean of one (minimum + maximum) / 2 per brokerage",
      implied_percentage_difference: percentage,
      price_difference_label:
        percentage === null
          ? null
          : percentage < 0
            ? "downside"
            : percentage > 0
              ? "upside"
              : "unchanged",
      price_difference_reason:
        reason ??
        (!validQuote
          ? "missing_valid_dated_raw_quote"
          : !compatible
            ? "incompatible_quote_share_basis"
            : null),
      quote: quote ? { ...quote, trade_date: quoteDate } : null,
      exclusions: exclusions.filter((entry) => entry.summary === "target"),
    };
  });
  const useful = mappedCount > 0 || target_groups.some((group) => group.average_midpoint !== null);
  return {
    status: useful
      ? exclusions.some((entry) => entry.summary !== "report") ||
        !mappedCount ||
        !target_groups.length ||
        target_groups.some((group) => group.price_difference_reason)
        ? "partial"
        : "available"
      : "unavailable",
    query_window,
    rating_summary: {
      label: "Most common brokerage rating",
      method: "Unique mode; positive ties are Mixed; no opinions is unavailable",
      status: mappedCount ? "available" : "unavailable",
      count_unit: "brokerages",
      counts,
      mapped_brokerage_count: mappedCount,
      eligible_brokerage_count: mappedCount,
      excluded_brokerage_count: latest.size - mappedCount,
      availability_reason: mappedCount ? null : "no_mapped_brokerage_opinions",
      category: !mappedCount ? null : tied.length === 1 ? tied[0] : "Mixed",
      modal_count: modeCount,
      tied_categories: tied.length > 1 ? tied : [],
      majority: mappedCount > 0 && tied.length === 1 && modeCount > mappedCount / 2,
      query_window,
      data_date: asOf,
      opinions,
      exclusions: exclusions.filter((entry) => entry.summary === "rating"),
    },
    target_groups,
    selected_reports: selected.map(({ rows, ...report }) => ({ ...report, original_rows: rows })),
    exclusions,
    evidence_sources: evidence.sources,
    limitations: [
      "Report identity uses ts_code, org_name, report_date and report_title; identical-title same-day publications cannot be distinguished. Forecast-quarter rows are deduplicated, not counted as brokerages.",
      "Same-date reports have no documented publication ordering; conflicting ratings and targets are excluded independently. create_time is a provider update time, not publication time.",
      "Only exact evidence-backed brokerage aliases and versioned raw-rating mappings are used. No default translation or quarter-derived horizon is applied.",
      "Targets are sourced brokerage opinions and calculated midpoint summaries, not provider consensus, personalized recommendations, guaranteed prices or forecast returns.",
      "Report-date durations are not exact common forecast dates. Equivalent horizon units are not merged without documented equivalence.",
    ],
  };
}

export async function priceTarget(
  raw: unknown,
  context: {
    mode: "fixture" | "live";
    companyIds?: readonly string[];
    query?: TushareQuery;
    companies?: readonly SuppliedCompany[];
    evidence?: BrokerageEvidence;
  },
): Promise<unknown> {
  const parsed = financialRequestSchema.parse(raw);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const request = { ...parsed, as_of_date: parsed.as_of_date ?? today };
  if (request.as_of_date > today)
    throw new Error("Future as_of_date is not allowed (Asia/Shanghai)");
  const companies = context.companies ?? suppliedCompanyUniverse();
  const company = companies.find(
    (entry) => entry.ticker === request.company_id && entry.exchange === "SSE",
  );
  if (
    !/^\d{6}$/.test(request.company_id) ||
    request.exchange !== "SSE" ||
    !company ||
    (request.company_name !== undefined && company.name !== request.company_name) ||
    (request.industry_label !== undefined && company.industry !== request.industry_label) ||
    (context.companyIds &&
      !context.companyIds.some((id) => id.replace(/\.SH$/, "") === request.company_id))
  )
    throw new Error("Invalid canonical or pinned SSE company identity");
  // The common request schema must never become an evidence injection channel.
  if (
    raw &&
    typeof raw === "object" &&
    ["evidence", "brokerages", "targets", "rating_mapping", "quote"].some((key) => key in raw)
  )
    throw new Error("Brokerage evidence and quotes are server-owned");
  const evidence = brokerageEvidenceSchema.parse(context.evidence ?? emptyBrokerageEvidence);
  const window = windowFor(request.as_of_date);
  const code = `${company.ticker}.SH`;
  const query = context.query ?? queryTushare;
  const retrieved_at = new Date().toISOString();
  const base = {
    capability_id: "price-target",
    provider: "Tushare",
    mode: context.mode,
    company,
    source: {
      provider: "Tushare",
      endpoint: "report_rc",
      documentation_url: "https://tushare.pro/document/2?doc_id=292",
      mode: context.mode,
      fixture: context.mode === "fixture",
    },
    as_of_date: request.as_of_date,
    retrieved_at,
  };
  if (context.mode === "fixture" && !context.query) {
    return {
      ...summarizeBrokerageReports([], request.as_of_date, null, evidence),
      ...base,
      status: "no_results",
      limitations: [
        "Fixture mode requires an explicitly supplied test query; no live retrieval was attempted.",
      ],
    };
  }
  const params = {
    ts_code: code,
    start_date: window.start_date.replaceAll("-", ""),
    end_date: window.end_date.replaceAll("-", ""),
  };
  // The shared adapter owns bounded pagination, retries, timeouts and caching.
  const rows: Row[] = [];
  const retrievals: Awaited<ReturnType<TushareQuery>>[] = [];
  const limitations: string[] = [];
  let reportStatus = "available";
  try {
    {
      const response = await query(
        "report_rc",
        params,
        "ts_code,org_name,author_name,report_date,report_title,quarter,rating,min_price,max_price",
      );
      retrievals.push(response);
      limitations.push(...response.limitations);
      reportStatus = response.status;
      rows.push(...response.rows.filter((row) => row.ts_code === code));
      const required = [
        "ts_code",
        "org_name",
        "report_date",
        "report_title",
        "rating",
        "min_price",
        "max_price",
      ];
      const missing = required.filter((field) => !response.fields.includes(field));
      if (missing.length && response.status === "available")
        limitations.push(`missing_report_fields: ${missing.join(", ")}`);
    }
    // A truncated window cannot safely establish the latest report per brokerage.
    if (
      retrievals.some((response) => response.status === "partial") ||
      (rows.length > 0 && !["available", "no_results"].includes(reportStatus))
    ) {
      return {
        ...summarizeBrokerageReports([], request.as_of_date, null, evidence),
        ...base,
        status: "partial",
        retrievals: retrievals.map(({ rows: _rows, ...metadata }) => metadata),
        limitations: [
          ...limitations,
          "Incomplete report retrieval cannot establish latest brokerage opinions; summaries suppressed.",
        ],
      };
    }
    let quote: BrokerageQuote | null = null;
    if (rows.length) {
      try {
        const response = await query("daily", params, "ts_code,trade_date,close");
        retrievals.push(response);
        limitations.push(...response.limitations);
        const dated = response.rows
          .filter(
            (row) =>
              row.ts_code === code &&
              sourceDate(row.trade_date) &&
              sourceDate(row.trade_date)! <= request.as_of_date &&
              typeof row.close === "number" &&
              Number.isFinite(row.close) &&
              row.close > 0,
          )
          .sort((a, b) => sourceDate(b.trade_date)!.localeCompare(sourceDate(a.trade_date)!));
        const newest = dated[0];
        if (
          response.status === "available" &&
          newest &&
          !dated.some((row) => row.trade_date === newest.trade_date && row.close !== newest.close)
        )
          quote = {
            close: newest.close as number,
            trade_date: sourceDate(newest.trade_date)!,
            currency: "CNY",
            per_share_basis: "raw",
          };
        else limitations.push(`raw_quote_unavailable: ${response.status}`);
      } catch {
        limitations.push("raw_quote_unavailable: retrieval_error");
        retrievals.push({
          status: "error",
          endpoint: "daily",
          retrieved_at: new Date().toISOString(),
          rows: [],
          fields: [],
          limitations: ["raw_quote_retrieval_failed"],
        });
      }
    }
    const summary = summarizeBrokerageReports(rows, request.as_of_date, quote, evidence);
    return {
      ...summary,
      ...base,
      status: !["available", "partial", "no_results"].includes(reportStatus)
        ? reportStatus
        : !rows.length
          ? "no_results"
          : limitations.length && summary.status === "available"
            ? "partial"
            : summary.status,
      retrieved_at: retrievals[0]?.retrieved_at ?? retrieved_at,
      retrievals: retrievals.map(({ rows: _rows, ...metadata }) => metadata),
      limitations: [...summary.limitations, ...limitations],
    };
  } catch {
    const summary = summarizeBrokerageReports(rows, request.as_of_date, null, evidence);
    return {
      ...summary,
      ...base,
      status: rows.length ? "partial" : "error",
      limitations: [
        ...summary.limitations,
        "Tushare retrieval failed; authenticated access and source completeness are unverified.",
      ],
    };
  }
}
