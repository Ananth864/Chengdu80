import { useId, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { cd80 } from "@/lib/cd80";
import { financialMetricSchema, type FinancialResult } from "@/lib/financial-results";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Capability = "historical-analysis" | "industry-research" | "price-target";
const periods = ["1m", "6m", "1y", "5y"] as const;
const periodSchema = z.enum(periods);
const number = z.number().finite();
const count = number.int().nonnegative();
const date = z.iso.date();
const texts = z.array(z.string());
const rangeSchema = z.object({ start: date, end: date });
const sourceSchema = z.object({
  provider: z.string().optional(),
  endpoint: z.string(),
  retrieved_at: z.iso.datetime(),
  company_id: z.string().optional(),
  publication_date: date.optional(),
  documentation: z.string().optional(),
  limitations: texts.optional(),
});
const annualSchema = z.object({
  financial_year: count,
  status: z.string(),
  value: number.nullable(),
  included_company_count: count,
  total_universe_count: count,
  coverage: number,
  limitations: texts,
  exclusions: z.array(z.object({ company_id: z.string(), reasons: texts })),
  sources: z.array(sourceSchema),
});
const growthSchema = annualSchema.omit({ included_company_count: true }).extend({
  preceding_year: count,
  matched_company_count: count,
  preceding_cohort_revenue: number.nullable(),
  current_cohort_revenue: number.nullable(),
  calculation_basis: z.string(),
});
const categories = ["Strong Sell", "Sell", "Hold", "Buy", "Strong Buy"] as const;
const evidenceSchema = z.object({ url: z.string(), description: z.string() });
const ratingSchema = z.object({
  status: z.string(),
  category: z.string().nullable(),
  mapped_brokerage_count: count,
  excluded_brokerage_count: count,
  availability_reason: z.string().nullable(),
  counts: z.object({
    "Strong Sell": count,
    Sell: count,
    Hold: count,
    Buy: count,
    "Strong Buy": count,
  }),
  opinions: z.array(
    z.object({
      brokerage_id: z.string(),
      report_dates: texts,
      original_ratings: z.array(z.union([z.string(), number, z.null()])),
      category: z.string(),
      mapping_version: z.string(),
      mapping_sources: z.array(evidenceSchema),
    }),
  ),
});
const targetSchema = z.object({
  status: z.string(),
  eligible_brokerage_count: count,
  currency: z.literal("CNY"),
  per_share_basis: z.string(),
  horizon: z.discriminatedUnion("reference", [
    z.object({
      reference: z.literal("report_date"),
      amount: number.positive(),
      unit: z.string(),
      label: z.string(),
    }),
    z.object({ reference: z.literal("fixed_date"), target_date: date, label: z.string() }),
  ]),
  average_midpoint: number.nullable(),
  implied_percentage_difference: number.nullable(),
  availability_reason: z.string().nullable(),
  price_difference_reason: z.string().nullable(),
  calculation_method: z.string(),
  quote: z
    .object({ close: number.positive(), trade_date: date.nullable(), per_share_basis: z.string() })
    .nullable(),
  contributions: z.array(
    z.object({
      brokerage_id: z.string(),
      report_dates: texts,
      minimum: number,
      maximum: number,
      midpoint: number,
    }),
  ),
});
const usable = (status: string) => status === "available" || status === "partial";
const format = (value: number | null, unit = "") =>
  value === null
    ? "Unavailable"
    : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ""}`;
const range = (value: unknown) => {
  const parsed = rangeSchema.safeParse(value);
  return parsed.success ? `${parsed.data.start} to ${parsed.data.end}` : "Unavailable";
};

function Notes({ values }: { values: readonly string[] }) {
  return values.length ? (
    <ul className="list-disc space-y-1 pl-5">
      {values.map((value, index) => (
        <li key={index}>{value}</li>
      ))}
    </ul>
  ) : null;
}

function Sources({ value }: { value: unknown }) {
  const parsed = z.array(sourceSchema).safeParse(value);
  return (
    <details>
      <summary>Sources and retrieval dates</summary>
      {parsed.success && parsed.data.length ? (
        <ul className="space-y-2">
          {parsed.data.map((source, index) => (
            <li key={index}>
              {source.provider ?? "Provider not specified in section"} / {source.endpoint}
              {source.company_id ? ` / ${source.company_id}` : ""}. Retrieved {source.retrieved_at}.
              {source.publication_date ? ` Published ${source.publication_date}.` : ""}
              {source.documentation ? ` Documentation: ${source.documentation}` : ""}
              <Notes values={source.limitations ?? []} />
            </li>
          ))}
        </ul>
      ) : (
        <p>Source metadata unavailable.</p>
      )}
    </details>
  );
}

function ValuesTable({
  label,
  headers,
  rows,
}: {
  label: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <Table aria-label={label}>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header} scope="col">
              {header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={index}>
            {row.map((cell, cellIndex) => (
              <TableCell key={cellIndex}>{cell}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Missing({ label }: { label: string }) {
  return (
    <Alert>
      <AlertTitle>{label} unavailable</AlertTitle>
      <AlertDescription>
        Required section data is missing or invalid; no zero values have been substituted.
      </AlertDescription>
    </Alert>
  );
}

function History({ result }: { result: FinancialResult }) {
  const prices = z
    .array(z.object({ date, close: number.positive() }))
    .safeParse(result.price_series);
  const metrics = z.record(z.string(), z.unknown()).safeParse(result.metrics);
  const adjustment = z
    .object({
      convention: z.string(),
      formula: z.string(),
      source: z.string(),
      reference_date: date.nullable(),
      reference_factor: number.nullable(),
      source_status: z.string(),
    })
    .safeParse(result.adjustment_basis);
  const rows = prices.success ? [...prices.data].sort((a, b) => a.date.localeCompare(b.date)) : [];
  const min = Math.min(...rows.map((row) => row.close));
  const max = Math.max(...rows.map((row) => row.close));
  const start = rows.length ? Date.parse(rows[0]!.date) : 0;
  const span = rows.length ? Date.parse(rows.at(-1)!.date) - start : 0;
  const labels: Record<string, string> = {
    current_price: "Latest observed raw close",
    "52_week_high": "52-week observed raw high",
    "52_week_low": "52-week observed raw low",
    available_period_high: "Available-period raw high",
    available_period_low: "Available-period raw low",
    daily_change_amount: "Daily raw change",
    daily_change_percentage: "Daily raw change percentage",
    distance_from_52_week_high: "Distance from 52-week high",
    distance_from_52_week_low: "Distance from 52-week low",
    max_drawdown: "Adjusted maximum drawdown",
  };
  return (
    <>
      <section aria-label="Historical prices" className="space-y-3">
        <h3>Observed raw closing prices (CNY/share)</h3>
        <p>
          Raw daily end-of-day quotes, not intraday. Dots are observations, not a gap-free trading
          history.
        </p>
        <p>
          Retrieved coverage: {range(result.actual_coverage_period)}. Selected coverage:{" "}
          {range(result.selected_coverage_period)}.
        </p>
        {rows.length ? (
          <>
            <svg
              role="img"
              aria-label="Observed raw closing price chart; exact dates and values in the following table"
              viewBox="0 0 600 200"
              style={{ width: "100%", maxWidth: 800, height: "auto" }}
            >
              {rows.map((row) => (
                <circle
                  key={row.date}
                  cx={span ? 20 + ((Date.parse(row.date) - start) / span) * 560 : 300}
                  cy={max > min ? 180 - ((row.close - min) / (max - min)) * 160 : 100}
                  r="3"
                  fill="currentColor"
                >
                  <title>
                    {row.date}: {format(row.close, "CNY/share")}
                  </title>
                </circle>
              ))}
            </svg>
            <details>
              <summary>Accessible price values</summary>
              <ValuesTable
                label="Raw closing price values"
                headers={["Date", "Raw close (CNY/share)"]}
                rows={rows.map((row) => [row.date, format(row.close)])}
              />
            </details>
          </>
        ) : (
          <Missing label="Price observations" />
        )}
      </section>
      <section aria-label="Historical metrics" className="space-y-3">
        <h3>Raw metrics and adjusted drawdown</h3>
        {Object.entries(labels).map(([key, label]) => {
          const parsed = financialMetricSchema.safeParse(
            metrics.success ? metrics.data[key] : undefined,
          );
          if (!parsed.success)
            return (
              <div key={key}>
                <h4>{label}</h4>
                <Missing label={label} />
              </div>
            );
          const metric = parsed.data;
          const value = usable(metric.status) ? metric.value : null;
          const percentage = financialMetricSchema.safeParse(metric.percentage);
          return (
            <div key={key} className="rounded-md border p-3">
              <h4>{label}</h4>
              <p>
                {format(
                  value === null ? null : metric.unit === "fraction" ? value * 100 : value,
                  metric.unit === "fraction" || metric.unit === "percentage_points"
                    ? "%"
                    : metric.unit,
                )}{" "}
                ({metric.status})
              </p>
              {percentage.success ? (
                <p>
                  Percentage distance:{" "}
                  {format(usable(percentage.data.status) ? percentage.data.value : null, "%")}
                </p>
              ) : null}
              {metric.reason ? <p>{metric.reason}</p> : null}
              <p>
                Basis: {metric.basis}. Dates: {range(metric.period)}.
              </p>
              <Sources value={metric.source} />
            </div>
          );
        })}
        {adjustment.success ? (
          <div>
            <h4>Adjustment provenance</h4>
            <p>
              {adjustment.data.convention}. {adjustment.data.formula}.
            </p>
            <p>
              Reference date: {adjustment.data.reference_date ?? "Unavailable"}; factor:{" "}
              {format(adjustment.data.reference_factor)}; source status:{" "}
              {adjustment.data.source_status}.
            </p>
            <p>Documentation: {adjustment.data.source}</p>
          </div>
        ) : (
          <Missing label="Adjustment provenance" />
        )}
      </section>
    </>
  );
}

function Industry({ result }: { result: FinancialResult }) {
  const coverage = z
    .object({
      total_universe_count: count,
      queried_company_count: count,
      unqueried_company_count: count,
    })
    .safeParse(result);
  const annual = z.array(annualSchema).safeParse(result.annual_revenue_totals);
  const growth = z.array(growthSchema).safeParse(result.matched_cohort_yoy_growth);
  const statuses = z.record(z.string(), z.string()).safeParse(result.section_statuses);
  return (
    <>
      <p>
        Listed-company statistics for the supplied SSE A-share universe only. Not national market
        size. Historical observations, not forecasts. Annual totals and pairwise matched growth use
        different cohorts.
      </p>
      {typeof result.industry_label === "string" ? <p>Industry: {result.industry_label}</p> : null}
      {coverage.success ? (
        <p>
          Universe: {coverage.data.total_universe_count} companies; queried:{" "}
          {coverage.data.queried_company_count}; unqueried: {coverage.data.unqueried_company_count}.
          Missing observations are excluded, not zero-filled.
        </p>
      ) : null}
      <section aria-label="Annual revenue totals" className="space-y-3">
        <h3>Annual available-universe revenue totals</h3>
        <p>Status: {statuses.success ? statuses.data.annual_revenue_totals : "unavailable"}</p>
        {annual.success && annual.data.length ? (
          <>
            <ValuesTable
              label="Annual revenue totals"
              headers={["Year", "Revenue (CNY yuan)", "Included / universe", "Coverage", "Status"]}
              rows={annual.data.map((row) => [
                row.financial_year,
                format(usable(row.status) ? row.value : null),
                `${row.included_company_count} / ${row.total_universe_count}`,
                format(row.coverage * 100, "%"),
                row.status,
              ])}
            />
            {annual.data.map((row) => (
              <details key={row.financial_year}>
                <summary>{row.financial_year} coverage and evidence</summary>
                <Notes
                  values={[
                    ...row.limitations,
                    ...row.exclusions.flatMap((entry) =>
                      entry.reasons.map((reason) => `${entry.company_id}: ${reason}`),
                    ),
                  ]}
                />
                <Sources value={row.sources} />
              </details>
            ))}
          </>
        ) : (
          <Missing label="Annual totals" />
        )}
      </section>
      <section aria-label="Matched cohort growth" className="space-y-3">
        <h3>Pairwise matched-cohort year-on-year growth</h3>
        <p>Status: {statuses.success ? statuses.data.matched_cohort_yoy_growth : "unavailable"}</p>
        {growth.success && growth.data.length ? (
          <>
            <ValuesTable
              label="Matched cohort growth"
              headers={[
                "Years",
                "Growth",
                "Matched / universe",
                "Coverage",
                "Preceding revenue (CNY yuan)",
                "Current revenue (CNY yuan)",
                "Status",
              ]}
              rows={growth.data.map((row) => [
                `${row.preceding_year} to ${row.financial_year}`,
                format(usable(row.status) ? row.value : null, "%"),
                `${row.matched_company_count} / ${row.total_universe_count}`,
                format(row.coverage * 100, "%"),
                format(row.preceding_cohort_revenue),
                format(row.current_cohort_revenue),
                row.status,
              ])}
            />
            {growth.data.map((row) => (
              <details key={row.financial_year}>
                <summary>
                  {row.preceding_year} to {row.financial_year} matched evidence
                </summary>
                <p>{row.calculation_basis}</p>
                <Notes
                  values={[
                    ...row.limitations,
                    ...row.exclusions.flatMap((entry) =>
                      entry.reasons.map((reason) => `${entry.company_id}: ${reason}`),
                    ),
                  ]}
                />
                <Sources value={row.sources} />
              </details>
            ))}
          </>
        ) : (
          <Missing label="Matched growth" />
        )}
      </section>
    </>
  );
}

function Targets({ result }: { result: FinancialResult }) {
  const rating = ratingSchema.safeParse(result.rating_summary);
  const groups = z.array(targetSchema).safeParse(result.target_groups);
  const window = range(result.query_window);
  const reports = z
    .array(
      z.object({
        brokerage_id: z.string(),
        date,
        original_rows: z.array(
          z.object({
            org_name: z.string().nullable().optional(),
            report_title: z.string().nullable().optional(),
            rating: z.union([z.string(), number, z.null()]).optional(),
            min_price: number.nullable().optional(),
            max_price: number.nullable().optional(),
          }),
        ),
      }),
    )
    .safeParse(result.selected_reports);
  const exclusions = z
    .array(
      z.object({ summary: z.string(), reason: z.string(), brokerage_id: z.string().optional() }),
    )
    .safeParse(result.exclusions);
  const evidence = z.array(evidenceSchema).safeParse(result.evidence_sources);
  return (
    <>
      <p>
        Sourced brokerage opinions, not personal recommendations, guaranteed prices or forecast
        returns. Counts represent brokerages, not report rows. Report window: {window}.
      </p>
      <section aria-label="Brokerage ratings" className="space-y-3">
        <h3>Most common brokerage rating</h3>
        {rating.success ? (
          <>
            <p>
              Status: {rating.data.status}. Modal category:{" "}
              {usable(rating.data.status) ? (rating.data.category ?? "Unavailable") : "Unavailable"}
              . A mode is not necessarily a majority.
            </p>
            <p>
              Mapped brokerages: {rating.data.mapped_brokerage_count}; excluded brokerages:{" "}
              {rating.data.excluded_brokerage_count}.
            </p>
            {rating.data.availability_reason ? <p>{rating.data.availability_reason}</p> : null}
            {usable(rating.data.status) ? (
              <>
                <svg
                  role="img"
                  aria-label="Five-category brokerage rating counts; exact counts in the following table"
                  viewBox="0 0 600 180"
                  style={{ width: "100%", maxWidth: 800, height: "auto" }}
                >
                  {categories.map((category, index) => (
                    <g key={category}>
                      <rect
                        x="140"
                        y={index * 34}
                        width={
                          (rating.data.counts[category] /
                            Math.max(1, ...Object.values(rating.data.counts))) *
                          400
                        }
                        height="22"
                        fill="currentColor"
                      />
                      <text x="0" y={index * 34 + 16} fontSize="14">
                        {category}
                      </text>
                    </g>
                  ))}
                </svg>
                <ValuesTable
                  label="Brokerage rating counts"
                  headers={["Rating", "Brokerage count"]}
                  rows={categories.map((category) => [category, rating.data.counts[category]])}
                />
              </>
            ) : (
              <Missing label="Rating counts" />
            )}
            <ValuesTable
              label="Original brokerage ratings"
              headers={[
                "Brokerage",
                "Report dates",
                "Original rating",
                "Mapped rating",
                "Mapping version",
              ]}
              rows={rating.data.opinions.map((opinion) => [
                opinion.brokerage_id,
                opinion.report_dates.join(", "),
                opinion.original_ratings.map((value) => value ?? "Unavailable").join(", "),
                opinion.category,
                opinion.mapping_version,
              ])}
            />
          </>
        ) : (
          <Missing label="Brokerage ratings" />
        )}
      </section>
      <section aria-label="Brokerage target groups" className="space-y-3">
        <h3>Average brokerage target midpoints by horizon</h3>
        <p>
          At least three eligible brokerages with compatible currency, share basis and horizon are
          required per summary.
        </p>
        {groups.success && groups.data.length ? (
          groups.data.map((group, index) => {
            const sufficient =
              usable(group.status) &&
              group.eligible_brokerage_count >= 3 &&
              group.contributions.length >= 3;
            return (
              <div key={index} className="space-y-2 rounded-md border p-3">
                <h4>{group.horizon.label}</h4>
                <p>
                  {group.horizon.reference === "report_date"
                    ? `${group.horizon.amount} ${group.horizon.unit} from each report date; not a single common target date.`
                    : `Target date: ${group.horizon.target_date}`}
                </p>
                <p>
                  Status: {group.status}; eligible brokerages: {group.eligible_brokerage_count};
                  basis: {group.per_share_basis}.
                </p>
                <p>
                  Average brokerage target midpoint:{" "}
                  {format(sufficient ? group.average_midpoint : null, "CNY/share")}
                </p>
                <p>
                  Implied difference from dated quote:{" "}
                  {format(sufficient ? group.implied_percentage_difference : null, "%")}. Not a
                  forecast return.
                </p>
                <p>
                  {group.availability_reason ??
                    (!sufficient ? "insufficient_brokerage_coverage" : "")}
                </p>
                <p>{group.price_difference_reason}</p>
                <p>{group.calculation_method}</p>
                {group.quote ? (
                  <p>
                    Raw quote: {format(group.quote.close, "CNY/share")}; date:{" "}
                    {group.quote.trade_date ?? "Unavailable"}; basis: {group.quote.per_share_basis}.
                  </p>
                ) : (
                  <p>Dated raw quote unavailable.</p>
                )}
                <ValuesTable
                  label={`Target contributions ${index + 1}`}
                  headers={[
                    "Brokerage",
                    "Report dates",
                    "Minimum (CNY/share)",
                    "Maximum (CNY/share)",
                    "Midpoint (CNY/share)",
                  ]}
                  rows={group.contributions.map((entry) => [
                    entry.brokerage_id,
                    entry.report_dates.join(", "),
                    format(entry.minimum),
                    format(entry.maximum),
                    format(entry.midpoint),
                  ])}
                />
              </div>
            );
          })
        ) : (
          <Missing label="Target groups" />
        )}
      </section>
      {reports.success ? (
        <details>
          <summary>Original selected reports</summary>
          <ValuesTable
            label="Original selected reports"
            headers={["Brokerage", "Date", "Title", "Original rating", "Minimum", "Maximum"]}
            rows={reports.data.flatMap((report) =>
              report.original_rows.map((row) => [
                row.org_name ?? report.brokerage_id,
                report.date,
                row.report_title ?? "Unavailable",
                row.rating ?? "Unavailable",
                format(row.min_price ?? null),
                format(row.max_price ?? null),
              ]),
            )}
          />
        </details>
      ) : null}
      {exclusions.success ? (
        <Notes
          values={exclusions.data.map(
            (entry) =>
              `${entry.summary}${entry.brokerage_id ? ` / ${entry.brokerage_id}` : ""}: ${entry.reason}`,
          )}
        />
      ) : null}
      {evidence.success ? (
        <details>
          <summary>Brokerage evidence</summary>
          <Notes values={evidence.data.map((entry) => `${entry.description}: ${entry.url}`)} />
        </details>
      ) : null}
      <Sources value={result.retrievals} />
    </>
  );
}

export function FinancialAnalysis({
  capability,
  companyId,
}: {
  capability: Capability;
  companyId: string;
}) {
  const id = useId();
  const [period, setPeriod] = useState<(typeof periods)[number]>("1y");
  const company = companyId.trim().replace(/\.SH$/i, "");
  const valid = /^\d{6}$/.test(company);
  const query = useQuery({
    queryKey: [
      "cd80",
      "financial-analysis",
      capability,
      company,
      capability === "historical-analysis" ? period : null,
    ],
    queryFn: () =>
      cd80.finance.financialAnalysis(capability, {
        company_id: company,
        ...(capability === "historical-analysis" ? { period } : {}),
      }),
    enabled: valid,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const result: FinancialResult | undefined = query.data;
  const limitations = texts.safeParse(result?.data_limitations);
  const extraLimitations = texts.safeParse(result?.limitations);
  const title = {
    "historical-analysis": "Historical analysis",
    "industry-research": "Industry research",
    "price-target": "Brokerage ratings and targets",
  }[capability];
  return (
    <Card aria-labelledby={id} aria-busy={query.isFetching} className="min-w-0">
      <CardHeader>
        <CardTitle id={id}>{title}</CardTitle>
        <CardDescription>
          Company {company || "not selected"}. Financial source availability is assessed
          independently for each section.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 break-words">
        {capability === "historical-analysis" ? (
          <Select
            value={period}
            onValueChange={(value) => {
              const parsed = periodSchema.safeParse(value);
              if (parsed.success) setPeriod(parsed.data);
            }}
          >
            <SelectTrigger aria-label="Chart period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periods.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {!valid ? (
          <Missing label="Six-digit SSE company ID" />
        ) : query.isPending ? (
          <p role="status">Loading financial analysis...</p>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Financial analysis unavailable</AlertTitle>
            <AlertDescription>
              The request failed or its response could not be validated. No financial values are
              inferred.
            </AlertDescription>
          </Alert>
        ) : result && result.capability_id === capability ? (
          <>
            <p role="status">
              Status: {result.status}. Provider: {result.provider}. Retrieved {result.retrieved_at}.
            </p>
            <p>
              As of: {typeof result.as_of_date === "string" ? result.as_of_date : "Unavailable"}.
              Data mode:{" "}
              {result.mode ??
                (typeof result.data_label === "string" ? result.data_label : "Unspecified")}
              .
            </p>
            <Notes
              values={[
                ...(limitations.success ? limitations.data : []),
                ...(extraLimitations.success ? extraLimitations.data : []),
              ]}
            />
            {capability === "historical-analysis" ? (
              <History result={result} />
            ) : capability === "industry-research" ? (
              <Industry result={result} />
            ) : (
              <Targets result={result} />
            )}
            {capability !== "price-target" ? <Sources value={result.sources} /> : null}
          </>
        ) : (
          <Missing label="Matching capability response" />
        )}
      </CardContent>
    </Card>
  );
}
