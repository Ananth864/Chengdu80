import { z } from "zod";
import { isSseATicker } from "../lib/company-table";
import { suppliedCompanyUniverse, type SuppliedCompany } from "./company-universe";
import type { TushareQuery } from "./tushare";

export type IndustryResearchStatus = "available" | "partial" | "unavailable" | "insufficient_data";
export interface IndustryMonetaryEvidence {
  currency: "CNY";
  unit: "yuan";
  source: string;
}
type QueryResult = Awaited<ReturnType<TushareQuery>>;
export interface IndustryIncomeResponse {
  company_id: string;
  result: QueryResult;
}
export interface IndustryExclusion {
  company_id: string;
  reasons: string[];
}
export interface IndustryRevenueSource {
  company_id: string;
  provider: "Tushare";
  endpoint: "income";
  field: "total_revenue";
  end_date: string;
  publication_date: string;
  publication_field: "f_ann_date" | "ann_date";
  report_type: string;
  scope: "consolidated";
  currency: "CNY";
  source_unit: string;
  normalized_unit: "yuan";
  currency_unit_basis: string;
  retrieved_at: string;
  as_of_date: string;
  documentation: string;
}
export interface IndustryAnnualRevenue {
  financial_year: number;
  status: IndustryResearchStatus;
  value: number | null;
  currency: "CNY";
  unit: "yuan";
  included_company_ids: string[];
  included_company_count: number;
  total_universe_count: number;
  coverage: number;
  exclusions: IndustryExclusion[];
  sources: IndustryRevenueSource[];
  limitations: string[];
}
export interface IndustryMatchedGrowth {
  preceding_year: number;
  financial_year: number;
  status: IndustryResearchStatus;
  value: number | null;
  unit: "percentage_points";
  currency: "CNY";
  revenue_unit: "yuan";
  matched_company_ids: string[];
  matched_company_count: number;
  total_universe_count: number;
  coverage: number;
  preceding_cohort_revenue: number | null;
  current_cohort_revenue: number | null;
  exclusions: IndustryExclusion[];
  sources: IndustryRevenueSource[];
  calculation_basis: string;
  limitations: string[];
}
export interface IndustryResearchResult {
  status: IndustryResearchStatus | "invalid_input";
  selected_company: SuppliedCompany | null;
  industry_label: string | null;
  universe_scope: string;
  total_universe_count: number;
  queried_company_count: number;
  unqueried_company_count: number;
  as_of_date: string;
  retrieved_at: string;
  data_label: "live_provider_responses" | "test_fixture" | "fixture_unavailable";
  annual_revenue_totals: IndustryAnnualRevenue[];
  matched_cohort_yoy_growth: IndustryMatchedGrowth[];
  section_statuses: {
    annual_revenue_totals: IndustryResearchStatus;
    matched_cohort_yoy_growth: IndustryResearchStatus;
  };
  data_limitations: string[];
}

const documentation = "https://tushare.pro/document/2?doc_id=33";
const incomeFields = "ts_code,ann_date,f_ann_date,end_date,report_type,total_revenue";
const scope = "Listed-company statistics for the supplied SSE A-share universe only";
const scopeLimitations = [
  "Not mainland-China market size, total industry revenue, or demand/supply evidence.",
  "Supplied-universe membership and current CSV classifications may introduce survivorship and classification bias; no size filter applies.",
  "Annual available-universe totals and pairwise matched-cohort growth are separate series; cohorts may differ between comparisons.",
  "Historical observations only; no projections or industry outlook.",
  "The income documentation does not establish currency or units. Observations require explicit monetary metadata or trusted server-owned monetary evidence; otherwise excluded as unverified_currency_units.",
  "Report types 1/4/5 include retained variants: use the latest valid publication at the cutoff only when its values agree; no report-type supersession priority is assumed.",
];

function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1900 &&
    Number(value.slice(0, 4)) <= 9998 &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}

function providerDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{8}$/.test(value)) return null;
  const date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  return validDate(date) ? date : null;
}

function shanghaiToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  return ["year", "month", "day"]
    .map((key) => parts.find((part) => part.type === key)!.value)
    .join("-");
}

const requestSchema = z
  .object({
    company_id: z.string().regex(/^\d{6}$/),
    exchange: z.literal("SSE").default("SSE"),
    company_name: z.string().optional(),
    industry_label: z.string().optional(),
    as_of_date: z.string().refine(validDate).optional(),
    period: z
      .string()
      .regex(/^\d{4}1231$/)
      .optional(),
    years: z.number().int().min(1).max(5).default(5),
  })
  .strict();
const monetaryEvidenceSchema = z.object({
  currency: z.literal("CNY"),
  unit: z.literal("yuan"),
  source: z.string().trim().min(1),
});

function peerUniverse(selected: SuppliedCompany, companies: readonly SuppliedCompany[]) {
  const unique = new Map<string, SuppliedCompany>();
  for (const company of companies) {
    if (company.exchange !== "SSE" || !isSseATicker(`${company.ticker}.SH`))
      throw new Error("Invalid supplied SSE A-share identity");
    const previous = unique.get(company.ticker);
    if (previous && (previous.name !== company.name || previous.industry !== company.industry))
      throw new Error("Conflicting supplied company identity");
    unique.set(company.ticker, company);
  }
  const canonical = unique.get(selected.ticker);
  if (
    !canonical ||
    canonical.name !== selected.name ||
    canonical.industry !== selected.industry ||
    selected.exchange !== "SSE"
  )
    throw new Error("Selected identity does not match supplied CSV");
  return [...unique.values()]
    .filter((company) => company.industry === selected.industry)
    .sort((a, b) =>
      a.ticker === selected.ticker
        ? -1
        : b.ticker === selected.ticker
          ? 1
          : a.ticker.localeCompare(b.ticker),
    );
}

function sectionStatus(statuses: IndustryResearchStatus[]): IndustryResearchStatus {
  if (!statuses.length) return "insufficient_data";
  if (statuses.every((status) => status === "available")) return "available";
  if (statuses.some((status) => status === "available" || status === "partial")) return "partial";
  return statuses.includes("insufficient_data") ? "insufficient_data" : "unavailable";
}

export interface IndustryAggregationInput {
  selectedCompany: SuppliedCompany;
  companies: readonly SuppliedCompany[];
  asOfDate: string;
  years?: number;
  period?: string;
  responses: readonly IndustryIncomeResponse[];
  retrievedAt?: string;
  dataLabel?: "live_provider_responses" | "test_fixture";
  unqueriedReason?: string;
  monetaryEvidence?: IndustryMonetaryEvidence;
}

// Pure aggregation: fixtures may cover the entire universe without a retrieval budget.
export function aggregateIndustryResearch(input: IndustryAggregationInput): IndustryResearchResult {
  const request = requestSchema.parse({
    company_id: input.selectedCompany.ticker,
    as_of_date: input.asOfDate,
    years: input.years,
    period: input.period,
  });
  const peers = peerUniverse(input.selectedCompany, input.companies);
  const monetaryEvidence =
    input.monetaryEvidence === undefined
      ? undefined
      : monetaryEvidenceSchema.parse(input.monetaryEvidence);
  const lastYear = request.period
    ? Number(request.period.slice(0, 4))
    : Number(input.asOfDate.slice(0, 4)) - 1;
  if (lastYear >= Number(input.asOfDate.slice(0, 4)) || lastYear - request.years + 1 < 1900)
    throw new Error("Only completed financial years are supported");
  const years = Array.from(
    { length: request.years },
    (_, index) => lastYear - request.years + index + 1,
  );
  const responses = new Map(
    input.responses.map((response) => [response.company_id.replace(/\.SH$/, ""), response.result]),
  );
  const observations = new Map<
    number,
    Map<string, { value: number; source: IndustryRevenueSource }>
  >();
  const dataLimitations = [...scopeLimitations];
  const queried = peers.filter((company) => responses.has(company.ticker)).length;
  if (queried < peers.length)
    dataLimitations.push(
      input.unqueriedReason ?? `bounded request budget; ${peers.length - queried} unqueried`,
    );
  if (input.dataLabel !== "live_provider_responses")
    dataLimitations.push(
      "Test fixtures only; not actual financial observations or verified live access.",
    );
  const annual: IndustryAnnualRevenue[] = years.map((year) => {
    const included = new Map<string, { value: number; source: IndustryRevenueSource }>();
    observations.set(year, included);
    const exclusions: IndustryExclusion[] = [];
    for (const company of peers) {
      const result = responses.get(company.ticker);
      const reasons = new Set<string>();
      let invalidPublication = false;
      const candidates: {
        date: string;
        value: number | null;
        reason: string | null;
        source: IndustryRevenueSource;
      }[] = [];
      if (!result) reasons.add(input.unqueriedReason ?? "unqueried: bounded request budget");
      else if (result.status !== "available") {
        // Partial responses cannot establish that a later revision was not omitted.
        reasons.add(`income retrieval ${result.status}`);
        for (const limitation of result.limitations) reasons.add(limitation);
      } else if (
        result.endpoint !== "income" ||
        incomeFields.split(",").some((field) => !result.fields.includes(field))
      )
        reasons.add("income endpoint or required field evidence missing");
      else {
        for (const limitation of result.limitations)
          dataLimitations.push(`${company.ticker}: ${limitation}`);
        for (const row of result.rows) {
          if (row.ts_code !== `${company.ticker}.SH`) {
            reasons.add("response identity mismatch");
            continue;
          }
          const endDate = providerDate(row.end_date);
          if (!endDate) {
            reasons.add("invalid annual reporting date");
            continue;
          }
          if (endDate !== `${year}-12-31`) {
            reasons.add("not the requested completed annual period");
            continue;
          }
          const reportType = String(row.report_type);
          if (!["1", "4", "5"].includes(reportType)) {
            reasons.add("not annual consolidated report_type 1, 4 or 5");
            continue;
          }
          const actual =
            row.f_ann_date !== null && row.f_ann_date !== undefined && row.f_ann_date !== "";
          const publicationField = actual ? "f_ann_date" : "ann_date";
          const publication = providerDate(row[publicationField]);
          if (!publication || publication < endDate) {
            reasons.add("missing or invalid publication date");
            invalidPublication = true;
            continue;
          }
          if (publication > input.asOfDate) {
            reasons.add("publication after as_of_date");
            continue;
          }
          const currency = row.currency ?? monetaryEvidence?.currency;
          const unit = row.unit ?? monetaryEvidence?.unit;
          const multiplier =
            unit === "yuan" || unit === "CNY" || unit === "RMB"
              ? 1
              : unit === "ten_thousand_yuan"
                ? 10000
                : unit === "million_yuan"
                  ? 1000000
                  : null;
          const raw = row.total_revenue;
          const numeric =
            typeof raw === "number"
              ? raw
              : typeof raw === "string" && /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw)
                ? Number(raw)
                : NaN;
          const value = multiplier === null ? NaN : numeric * multiplier;
          const reason =
            currency === undefined || unit === undefined
              ? "unverified_currency_units"
              : currency !== "CNY" && currency !== "RMB"
                ? "non-CNY currency"
                : multiplier === null
                  ? "unsupported revenue unit"
                  : !Number.isFinite(value)
                    ? "missing or invalid total_revenue"
                    : null;
          candidates.push({
            date: publication,
            value: reason ? null : value,
            reason,
            source: {
              company_id: company.ticker,
              provider: "Tushare",
              endpoint: "income",
              field: "total_revenue",
              end_date: endDate,
              publication_date: publication,
              publication_field: publicationField,
              report_type: reportType,
              scope: "consolidated",
              currency: "CNY",
              source_unit: String(unit),
              normalized_unit: "yuan",
              currency_unit_basis:
                row.currency != null && row.unit != null
                  ? "Explicit observation currency/unit metadata, normalized to CNY yuan"
                  : `Trusted server-owned monetary evidence: ${monetaryEvidence?.source ?? "absent"}; explicit observation metadata takes precedence`,
              retrieved_at: result.retrieved_at,
              as_of_date: input.asOfDate,
              documentation,
            },
          });
        }
      }
      // Use the latest actual publication available at the cutoff; ties must agree.
      candidates.sort((a, b) => b.date.localeCompare(a.date));
      const latest = candidates[0];
      if (invalidPublication)
        reasons.add("unresolved revision publication date blocks company-year; no older backfill");
      if (latest && !invalidPublication) {
        const tied = candidates.filter((candidate) => candidate.date === latest.date);
        if (
          tied.some(
            (candidate) => candidate.value !== latest.value || candidate.reason !== latest.reason,
          )
        )
          reasons.add("conflicting equal-publication-date statements");
        else if (latest.reason) reasons.add(latest.reason);
        else included.set(company.ticker, { value: latest.value!, source: latest.source });
      }
      if (!included.has(company.ticker))
        exclusions.push({
          company_id: company.ticker,
          reasons: [...(reasons.size ? reasons : ["no eligible annual observation"])],
        });
    }
    const sum = [...included.values()].reduce((total, observation) => total + observation.value, 0);
    const finite = Number.isFinite(sum);
    const status =
      !included.size || !finite
        ? "unavailable"
        : included.size === peers.length
          ? "available"
          : "partial";
    return {
      financial_year: year,
      status,
      value: included.size && finite ? sum : null,
      currency: "CNY",
      unit: "yuan",
      included_company_ids: [...included.keys()],
      included_company_count: included.size,
      total_universe_count: peers.length,
      coverage: included.size / peers.length,
      exclusions,
      sources: [...included.values()].map((observation) => observation.source),
      limitations: [
        ...(status === "available"
          ? []
          : ["Partial coverage: missing observations are excluded, not replaced with zero."]),
        ...(!finite ? ["Aggregate exceeds finite numeric range."] : []),
      ],
    };
  });
  const growth: IndustryMatchedGrowth[] = years.slice(1).map((year) => {
    const previous = observations.get(year - 1)!;
    const current = observations.get(year)!;
    const matched = peers
      .map((company) => company.ticker)
      .filter((ticker) => previous.has(ticker) && current.has(ticker));
    const precedingSum = matched.reduce((sum, ticker) => sum + previous.get(ticker)!.value, 0);
    const currentSum = matched.reduce((sum, ticker) => sum + current.get(ticker)!.value, 0);
    const value = matched.length && precedingSum > 0 ? (currentSum / precedingSum - 1) * 100 : null;
    const valid =
      value !== null &&
      Number.isFinite(value) &&
      Number.isFinite(precedingSum) &&
      Number.isFinite(currentSum);
    const limitations = [
      "Pairwise intersection only; membership can differ from other year pairs and annual totals.",
    ];
    if (!matched.length) limitations.push("No comparable observations in both consecutive years.");
    else if (precedingSum <= 0)
      limitations.push("Preceding matched-cohort aggregate must be positive.");
    else if (!valid) limitations.push("Growth exceeds finite numeric range.");
    if (matched.length < peers.length)
      limitations.push("Partial matched-cohort coverage of the supplied universe.");
    return {
      preceding_year: year - 1,
      financial_year: year,
      status: !valid
        ? "insufficient_data"
        : matched.length === peers.length
          ? "available"
          : "partial",
      value: valid ? value : null,
      unit: "percentage_points",
      currency: "CNY",
      revenue_unit: "yuan",
      matched_company_ids: matched,
      matched_company_count: matched.length,
      total_universe_count: peers.length,
      coverage: matched.length / peers.length,
      preceding_cohort_revenue:
        matched.length && Number.isFinite(precedingSum) ? precedingSum : null,
      current_cohort_revenue: matched.length && Number.isFinite(currentSum) ? currentSum : null,
      exclusions: peers
        .filter((company) => !previous.has(company.ticker) || !current.has(company.ticker))
        .map((company) => ({
          company_id: company.ticker,
          reasons: annual
            .filter((entry) => entry.financial_year === year - 1 || entry.financial_year === year)
            .flatMap((entry) =>
              entry.exclusions
                .filter((exclusion) => exclusion.company_id === company.ticker)
                .flatMap((exclusion) =>
                  exclusion.reasons.map((reason) => `${entry.financial_year}: ${reason}`),
                ),
            ),
        })),
      sources: matched.flatMap((ticker) => [
        previous.get(ticker)!.source,
        current.get(ticker)!.source,
      ]),
      calculation_basis:
        "(sum current-year matched-cohort CNY revenue / sum preceding-year matched-cohort CNY revenue - 1) * 100",
      limitations,
    };
  });
  const annualStatus = sectionStatus(annual.map((entry) => entry.status));
  const growthStatus = sectionStatus(growth.map((entry) => entry.status));
  if (years.length < 2)
    dataLimitations.push(
      "At least two adjacent completed annual observations are required for YoY growth.",
    );
  return {
    status:
      annualStatus === "unavailable" ? "unavailable" : sectionStatus([annualStatus, growthStatus]),
    selected_company: input.selectedCompany,
    industry_label: input.selectedCompany.industry,
    universe_scope: scope,
    total_universe_count: peers.length,
    queried_company_count: queried,
    unqueried_company_count: peers.length - queried,
    as_of_date: input.asOfDate,
    retrieved_at: input.retrievedAt ?? new Date().toISOString(),
    data_label: input.dataLabel ?? "test_fixture",
    annual_revenue_totals: annual,
    matched_cohort_yoy_growth: growth,
    section_statuses: {
      annual_revenue_totals: annualStatus,
      matched_cohort_yoy_growth: growthStatus,
    },
    data_limitations: [...new Set(dataLimitations)],
  };
}

export interface IndustryResearchContext {
  mode: "fixture" | "live";
  companyIds?: readonly string[];
  query?: TushareQuery;
  companies?: readonly SuppliedCompany[];
  monetaryEvidence?: IndustryMonetaryEvidence;
  // Trusted caller controls only; raw SDK requests cannot increase these limits.
  maxRequests?: number;
  deadlineMs?: number;
}

export async function industryResearch(
  raw: unknown,
  context: IndustryResearchContext,
): Promise<IndustryResearchResult> {
  const retrievedAt = new Date().toISOString();
  let selected: SuppliedCompany | null = null;
  let peers: SuppliedCompany[] = [];
  let asOfDate = shanghaiToday();
  let validated = false;
  try {
    const request = requestSchema.parse(raw);
    const today = asOfDate;
    asOfDate = request.as_of_date ?? asOfDate;
    if (asOfDate > today) throw new Error("as_of_date must not be after today in Asia/Shanghai");
    const companies = context.companies ?? suppliedCompanyUniverse();
    selected = companies.find((company) => company.ticker === request.company_id) ?? null;
    if (
      !selected ||
      (request.company_name !== undefined && request.company_name !== selected.name) ||
      (request.industry_label !== undefined && request.industry_label !== selected.industry)
    )
      throw new Error(
        "Selected company name, ticker or exact industry does not match supplied CSV",
      );
    if (
      context.companyIds &&
      !context.companyIds.some((id) => id.replace(/\.SH$/, "") === selected!.ticker)
    )
      throw new Error("Selected company is not in the pinned company IDs");
    peers = peerUniverse(selected, companies);
    // Validate periods before any financial fetch, including fixture mode.
    const empty = aggregateIndustryResearch({
      selectedCompany: selected,
      companies,
      asOfDate,
      years: request.years,
      period: request.period,
      responses: [],
      retrievedAt,
      monetaryEvidence: context.monetaryEvidence,
    });
    validated = true;
    if (context.mode !== "live")
      return {
        ...empty,
        status: "unavailable",
        data_label: "fixture_unavailable",
        data_limitations: [
          ...scopeLimitations,
          "Fixture mode: live financial retrieval disabled; no synthetic observations supplied.",
        ],
      };
    const query: TushareQuery = context.query ?? (await import("./tushare")).queryTushare;
    const maxRequests = Number.isFinite(context.maxRequests)
      ? Math.max(0, Math.min(80, Math.floor(context.maxRequests!)))
      : 80;
    const deadlineMs = Number.isFinite(context.deadlineMs)
      ? Math.max(1, Math.min(30000, context.deadlineMs!))
      : 30000;
    const deadline = Date.now() + deadlineMs;
    const responses: IndustryIncomeResponse[] = [];
    // income defaults to type 1. Retrieve preserved/adjusted versions explicitly,
    // using publication windows no longer than the shared transport's five-year cap.
    const windows: { start_date: string; end_date: string }[] = [];
    let start = `${empty.annual_revenue_totals[0]!.financial_year + 1}-01-01`;
    while (start <= asOfDate) {
      const boundary = new Date(`${start}T00:00:00Z`);
      boundary.setUTCFullYear(boundary.getUTCFullYear() + 5);
      const end =
        boundary.toISOString().slice(0, 10) < asOfDate
          ? boundary.toISOString().slice(0, 10)
          : asOfDate;
      windows.push({ start_date: start.replaceAll("-", ""), end_date: end.replaceAll("-", "") });
      const next = new Date(`${end}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      start = next.toISOString().slice(0, 10);
    }
    const perCompany = windows.length * 3;
    const companyBudget = Math.min(40, Math.floor(maxRequests / perCompany));
    let cursor = 0;
    let stop = false;
    await Promise.all(
      Array.from({ length: 2 }, async () => {
        while (!stop && cursor < Math.min(companyBudget, peers.length) && Date.now() < deadline) {
          const company = peers[cursor++]!;
          const combined: QueryResult = {
            status: "available",
            rows: [],
            endpoint: "income",
            fields: incomeFields.split(","),
            retrieved_at: retrievedAt,
            limitations: [],
          };
          const requests = windows.flatMap((window) =>
            ["1", "4", "5"].map((report_type) => ({ ...window, report_type })),
          );
          for (const params of requests) {
            if (stop || Date.now() >= deadline) {
              combined.status = "partial";
              combined.limitations.push(
                "Incomplete revision history: retrieval stopped or aggregate deadline reached",
              );
              break;
            }
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              const result = await Promise.race([
                query(
                  "income",
                  {
                    ts_code: `${company.ticker}.SH`,
                    ...params,
                  },
                  incomeFields,
                ),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(
                    () => reject(new Error("deadline")),
                    Math.max(1, deadline - Date.now()),
                  );
                }),
              ]);
              combined.retrieved_at = result.retrieved_at;
              combined.limitations.push(...result.limitations);
              if (
                result.endpoint !== "income" ||
                (result.status === "available" &&
                  incomeFields.split(",").some((field) => !result.fields.includes(field)))
              ) {
                combined.status = "partial";
                combined.limitations.push("income endpoint or required field evidence missing");
                break;
              }
              if (result.status === "available") combined.rows.push(...result.rows);
              else if (result.status !== "no_results") combined.status = result.status;
              if (
                ["missing_credentials", "permission_denied", "rate_limited"].includes(result.status)
              )
                stop = true;
              if (result.status !== "available" && result.status !== "no_results") break;
            } catch {
              combined.status = "error";
              combined.limitations.push(
                Date.now() >= deadline
                  ? "Aggregate retrieval deadline exceeded"
                  : "Income retrieval failed",
              );
              break;
            } finally {
              if (timer) clearTimeout(timer);
            }
          }
          if (combined.status === "available" && !combined.rows.length)
            combined.status = "no_results";
          responses.push({ company_id: company.ticker, result: combined });
        }
      }),
    );
    const output = aggregateIndustryResearch({
      selectedCompany: selected,
      companies,
      asOfDate,
      years: request.years,
      period: request.period,
      responses,
      retrievedAt,
      dataLabel: context.query ? "test_fixture" : "live_provider_responses",
      monetaryEvidence: context.monetaryEvidence,
      unqueriedReason: `bounded request budget; ${peers.length - responses.length} unqueried${stop ? "; provider access/rate limit stopped retrieval" : Date.now() >= deadline ? "; aggregate deadline reached" : ""}`,
    });
    output.data_limitations.push(
      `Retrieval bounded to ${maxRequests} shared-query calls, at most 40 companies, concurrency 2 and ${deadlineMs}ms aggregate deadline; each company requires ${perCompany} calls for publication windows and report types 1/4/5. Shared transport retries are separately bounded.`,
      "The aggregate deadline stops waiting and scheduling; an already-started shared query may finish under its own transport timeout.",
    );
    return output;
  } catch (error) {
    return {
      status: validated ? "unavailable" : "invalid_input",
      selected_company: selected,
      industry_label: selected?.industry ?? null,
      universe_scope: scope,
      total_universe_count: peers.length,
      queried_company_count: 0,
      unqueried_company_count: peers.length,
      as_of_date: asOfDate,
      retrieved_at: retrievedAt,
      data_label:
        context.mode === "fixture"
          ? "fixture_unavailable"
          : context.query
            ? "test_fixture"
            : "live_provider_responses",
      annual_revenue_totals: [],
      matched_cohort_yoy_growth: [],
      section_statuses: {
        annual_revenue_totals: "unavailable",
        matched_cohort_yoy_growth: "unavailable",
      },
      data_limitations: [
        ...scopeLimitations,
        error instanceof z.ZodError
          ? "Invalid industry research request"
          : error instanceof Error
            ? error.message
            : "Industry research unavailable",
      ],
    };
  }
}
