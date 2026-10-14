import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { defineChart, lineY } from "@tanstack/charts";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { Chart } from "@tanstack/charts/react";
import { tooltip } from "@tanstack/charts/tooltip";
import { scaleUtc } from "d3-scale";
import { cd80 } from "@/lib/cd80";
import { buildContext } from "@/lib/build-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/capabilities";

const metricNames: Record<string, string> = {
  pe: "P/E",
  ps: "P/S",
  dividendYield: "Dividend yield",
  revenueGrowth: "Revenue growth",
  roe: "ROE",
  interestCoverage: "Interest coverage",
};
// One-line plain-language explanations, shown as the row's tooltip.
const metricHints: Record<string, string> = {
  pe: "Share price divided by the company's yearly profit per share. Lower can mean cheaper, but it can also mean slower expected growth.",
  ps: "Share price divided by yearly revenue per share. Useful when profits are thin or uneven.",
  dividendYield: "Cash dividends paid over the past year as a percentage of the share price.",
  revenueGrowth: "How much the company's yearly income grew compared with the previous year.",
  roe: "Profit earned per yuan of shareholders' capital — how efficiently the company uses its capital.",
  interestCoverage: "How comfortably the company's profits cover its interest payments.",
};
function formatMetric(id: string, value: number) {
  if (id === "dividendYield" || id === "revenueGrowth" || id === "roe")
    return `${value.toFixed(2)}%`;
  return value.toFixed(2);
}
const money = (value: number) =>
  `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (value: number, format: (input: number) => string) =>
  `${value >= 0 ? "+" : "−"}${format(Math.abs(value))}`;
const percent = (value: number) => `${value.toFixed(2)}%`;

type PriceRow = { date: string; close: number };
// Standard price figures computed from the daily closes. The one-year window
// uses the last 365 calendar days of trading; drawdown is the worst
// peak-to-trough fall over the whole sourced period.
function priceStats(rows: PriceRow[]) {
  const last = rows[rows.length - 1]!;
  const prev = rows[rows.length - 2]!;
  const cutoff = new Date(Date.parse(`${last.date}T00:00:00Z`) - 365 * 86400000)
    .toISOString()
    .slice(0, 10);
  const yearRows = rows.filter((row) => row.date >= cutoff);
  const window = yearRows.length > 1 ? yearRows : rows;
  let high52 = -Infinity;
  let low52 = Infinity;
  for (const row of window) {
    high52 = Math.max(high52, row.close);
    low52 = Math.min(low52, row.close);
  }
  let highAll = -Infinity;
  let lowAll = Infinity;
  let peak = rows[0]!.close;
  let maxDrawdown = 0;
  for (const row of rows) {
    highAll = Math.max(highAll, row.close);
    lowAll = Math.min(lowAll, row.close);
    peak = Math.max(peak, row.close);
    maxDrawdown = Math.max(maxDrawdown, (peak - row.close) / peak);
  }
  return {
    last: last.close,
    change: last.close - prev.close,
    changePct: ((last.close - prev.close) / prev.close) * 100,
    high52,
    low52,
    highAll,
    lowAll,
    maxDrawdownPct: maxDrawdown * 100,
    distanceFromHighPct: ((high52 - last.close) / high52) * 100,
    distanceFromLowPct: ((last.close - low52) / low52) * 100,
  };
}
function priceChart(rows: PriceRow[]) {
  const data = rows.map((row) => ({
    date: new Date(`${row.date}T00:00:00Z`),
    close: row.close,
  }));
  return defineChart({
    marks: [lineY(data, { x: "date", y: "close" })],
    scales: {
      x: { scale: scaleUtc, nice: true },
      y: { scale: scaleLinear, nice: true, grid: true },
    },
    svgAnimation: false,
    tooltip,
  });
}

export function FinancialDemo() {
  const capabilities: readonly string[] = buildContext.capabilities;
  return (
    <main
      data-financial-module-version="financial-react-v4"
      className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10"
    >
      <header className="space-y-3">
        <Badge variant="secondary">Live · Shanghai Stock Exchange</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{buildContext.name}</h1>
        <p className="text-muted-foreground">
          Real Shanghai Stock Exchange Class A companies and live market figures. Nothing here is
          investment advice.
        </p>
      </header>
      {capabilities.includes("risk-industry-matching") && (
        <CompanySelection cards={capabilities.includes("company-cards")} />
      )}
      {capabilities.includes("historical-analysis") && <PriceHistorySection />}
      {capabilities.includes("market-research") && (
        <CompanyResearch companies={buildContext.companies} />
      )}
    </main>
  );
}

function CompanySelection({ cards }: { cards: boolean }) {
  const client = useQueryClient();
  const industries: readonly string[] = buildContext.industries.length
    ? buildContext.industries
    : ["Technology"];
  const [risk, setRisk] = useState<"low" | "medium" | "high">("low");
  const [industry, setIndustry] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const saved = useQuery({
    queryKey: ["company-state"],
    queryFn: () => cd80.finance.companyCards({ action: "watchlist" }),
    enabled: cards,
    retry: false,
  });
  const criteria = saved.data?.criteria ?? {
    risk,
    industries: [industry ?? industries[0]!],
  };
  const today = useQuery<
    | Awaited<ReturnType<typeof cd80.finance.companyCards>>
    | Awaited<ReturnType<typeof cd80.finance.matchCompanies>>
  >({
    queryKey: ["daily-companies", criteria],
    queryFn: () =>
      cards
        ? cd80.finance.companyCards({ action: "batch", ...criteria })
        : cd80.finance.matchCompanies(criteria),
    enabled: cards ? !saved.isPending && (started || !!saved.data?.criteria) : started,
    retry: false,
  });
  const decide = useMutation({
    mutationFn: ({ ticker, choice }: { ticker: string; choice: "yes" | "no" }) =>
      cd80.finance.companyCards({ action: "decide", ticker, choice }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["daily-companies"] }),
        client.invalidateQueries({ queryKey: ["company-state"] }),
      ]);
    },
  });
  const companies = today.data?.companies ?? [];
  const error = today.error ?? saved.error ?? decide.error;
  return (
    <section className="space-y-5" aria-label="Company matching">
      <Card>
        <CardHeader>
          <CardTitle>Find companies for your profile</CardTitle>
          <CardDescription>
            Your risk comfort chooses the company size band. It is not an expert risk assessment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="risk-profile">Risk profile</FieldLabel>
            <Select
              value={criteria.risk}
              disabled={!!saved.data?.criteria || started}
              onValueChange={(value) => {
                if (value === "low" || value === "medium" || value === "high") setRisk(value);
              }}
            >
              <SelectTrigger id="risk-profile">
                <SelectValue>
                  {criteria.risk === "low"
                    ? "Low risk · large cap"
                    : criteria.risk === "medium"
                      ? "Medium risk · medium cap"
                      : "High risk · small cap"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low risk · large cap</SelectItem>
                <SelectItem value="medium">Medium risk · medium cap</SelectItem>
                <SelectItem value="high">High risk · small cap</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="industry">Industry</FieldLabel>
            <Select
              value={criteria.industries[0]}
              disabled={!!saved.data?.criteria || started}
              onValueChange={(value) => {
                if (typeof value === "string" && industries.includes(value)) setIndustry(value);
              }}
            >
              <SelectTrigger id="industry">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {industries.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Industries come from the live Shanghai Stock Exchange company table.
            </p>
          </Field>
        </CardContent>
        <CardFooter>
          <Button
            disabled={(cards && saved.isPending) || today.isFetching}
            onClick={() => {
              if (started || saved.data?.criteria) void today.refetch();
              else setStarted(true);
            }}
          >
            {cards ? "Show today's companies" : "Find matching companies"}
          </Button>
        </CardFooter>
      </Card>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Companies could not load</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {today.isFetching && <p role="status">Loading companies…</p>}
      {today.data && "notice" in today.data && today.data.notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {today.data.notice}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {companies.map((company) => (
          <Card key={company.ticker}>
            <CardHeader>
              <CardTitle>{company.name}</CardTitle>
              <CardDescription>
                {company.ticker} · {company.industry} · {company.size} cap
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {"metrics" in company &&
                company.metrics.map((metric) => (
                  <div
                    key={metric.id}
                    className="flex justify-between gap-4 text-sm"
                    title={metric.reason ?? metricHints[metric.id]}
                  >
                    <span>{metricNames[metric.id] ?? metric.id}</span>
                    <span
                      className={
                        metric.status === "available"
                          ? "font-medium tabular-nums"
                          : "text-muted-foreground"
                      }
                    >
                      {metric.status === "available" && metric.value !== null
                        ? formatMetric(metric.id, metric.value)
                        : "Unavailable"}
                    </span>
                  </div>
                ))}
              <details>
                <summary className="cursor-pointer text-sm font-medium">
                  What do these numbers mean?
                </summary>
                <dl className="space-y-2 pt-2 text-sm text-muted-foreground">
                  {Object.entries(metricHints)
                    .filter(([id]) => company.metrics.some((metric) => metric.id === id))
                    .map(([id, hint]) => (
                      <div key={id}>
                        <dt className="font-medium text-foreground">{metricNames[id] ?? id}</dt>
                        <dd>{hint}</dd>
                      </div>
                    ))}
                  <div>
                    <dt className="font-medium text-foreground">Company research</dt>
                    <dd>Verified company and industry facts appear in the research section.</dd>
                  </div>
                </dl>
              </details>
            </CardContent>
            {cards && (
              <CardFooter className="gap-2">
                {company.choice ? (
                  <Badge variant="secondary">
                    {company.choice === "yes" ? "Added to watchlist" : "Passed"}
                  </Badge>
                ) : (
                  <>
                    <Button
                      disabled={decide.isPending}
                      aria-label={`Yes, watch ${company.name}`}
                      onClick={() => decide.mutate({ ticker: company.ticker, choice: "yes" })}
                    >
                      Yes
                    </Button>
                    <Button
                      variant="outline"
                      disabled={decide.isPending}
                      aria-label={`No, pass ${company.name}`}
                      onClick={() => decide.mutate({ ticker: company.ticker, choice: "no" })}
                    >
                      No
                    </Button>
                  </>
                )}
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
      {cards && (
        <Card>
          <CardHeader>
            <CardTitle>Watchlist</CardTitle>
          </CardHeader>
          <CardContent>
            {saved.data?.companies.length ? (
              <ul className="space-y-2">
                {saved.data.companies.map((company) => (
                  <li key={company.ticker}>
                    {company.name} <span className="text-muted-foreground">{company.ticker}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Companies you choose Yes for appear here.</p>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function PriceHistorySection() {
  const tickers: readonly string[] = buildContext.companies;
  const [symbol, setSymbol] = useState<string | null>(tickers[0] ?? null);
  const history = useQuery({
    queryKey: ["price-history", symbol],
    queryFn: () => cd80.finance.priceHistory(symbol!),
    enabled: !!symbol,
    retry: false,
  });
  const rows = history.data?.prices ?? [];
  const stats = rows.length >= 2 ? priceStats(rows) : null;
  const definition = useMemo(() => (rows.length ? priceChart(rows) : null), [rows]);
  if (!tickers.length)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price history</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Pin at least one company in the build plan to show its price history.
          </p>
        </CardContent>
      </Card>
    );
  return (
    <section aria-label="Historical analysis" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">How the price has moved</h2>
        {tickers.length > 1 && (
          <Select value={symbol ?? undefined} onValueChange={(value) => setSymbol(value)}>
            <SelectTrigger aria-label="Company" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tickers.map((ticker) => (
                <SelectItem key={ticker} value={ticker}>
                  {ticker}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <p className="text-muted-foreground">
        Daily closing prices for {symbol} from the live exchange feed
        {history.data ? ` · ${history.data.meta.coverage} · unadjusted closes` : ""}.
      </p>
      {history.isFetching && <p role="status">Loading prices…</p>}
      {history.error && (
        <Alert variant="destructive">
          <AlertTitle>Prices could not load</AlertTitle>
          <AlertDescription>{history.error.message}</AlertDescription>
        </Alert>
      )}
      {history.data && stats && definition && (
        <div className="space-y-4">
          <div className="rounded-xl border p-4">
            <Chart
              definition={definition}
              ariaLabel={`Daily closing prices for ${symbol}`}
              height={280}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Current price" value={money(stats.last)} />
            <MetricCard
              label="Daily change"
              value={`${signed(stats.change, money)} (${signed(stats.changePct, percent)})`}
            />
            <MetricCard label="52-week high" value={money(stats.high52)} />
            <MetricCard label="52-week low" value={money(stats.low52)} />
            <MetricCard label="All-time high" value={money(stats.highAll)} />
            <MetricCard label="All-time low" value={money(stats.lowAll)} />
            <MetricCard label="Maximum drawdown" value={percent(stats.maxDrawdownPct)} />
            <MetricCard
              label="Distance from 52-week high"
              value={percent(stats.distanceFromHighPct)}
            />
            <MetricCard
              label="Distance from 52-week low"
              value={percent(stats.distanceFromLowPct)}
            />
            <MetricCard label="Sourced price target" value={null} />
          </div>
          <p className="text-xs text-muted-foreground">
            {history.data.meta.warning} An outside price target is not connected yet, so none is
            shown. Figures describe the past; they are not predictions.
          </p>
        </div>
      )}
    </section>
  );
}
const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? "Unavailable" : `${value.toFixed(1)}%`;
const compactRmb = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  notation: "compact",
  maximumFractionDigits: 2,
});
const day = (value: string | null | undefined) =>
  value && value.length === 8
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : (value ?? "—");

function CompanyResearch({ companies }: { companies: readonly string[] }) {
  const [tsCode, setTsCode] = useState<string | null>(companies[0] ?? null);
  const research = useQuery({
    queryKey: ["research", tsCode],
    queryFn: () => cd80.finance.research(tsCode!),
    enabled: !!tsCode,
    retry: false,
  });
  if (!companies.length)
    return (
      <Card>
        <CardHeader>
          <CardTitle>Company and industry research</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Pin at least one company in the build plan to enable research. Standalone industry
            research is pending.
          </p>
        </CardContent>
      </Card>
    );
  const data = research.data;
  return (
    <section className="space-y-5" aria-label="Company and industry research">
      <Card>
        <CardHeader>
          <CardTitle>Company and industry research</CardTitle>
          <CardDescription>
            Live facts from the platform's market sources. This is reference information, not an
            expert assessment or a recommendation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="research-company">Company</FieldLabel>
            <Select value={tsCode ?? undefined} onValueChange={(value) => setTsCode(value)}>
              <SelectTrigger id="research-company">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {companies.map((ticker) => (
                  <SelectItem key={ticker} value={ticker}>
                    {ticker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {research.isFetching && <p role="status">Loading research…</p>}
          {research.error && (
            <Alert variant="destructive">
              <AlertTitle>Research could not load</AlertTitle>
              <AlertDescription>{research.error.message}</AlertDescription>
            </Alert>
          )}
          {data && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold">
                  {data.company.name ?? data.company.tsCode}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {data.company.tsCode}
                  </span>
                </h3>
                {data.industry && (
                  <p className="text-sm text-muted-foreground">{data.industry.path}</p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label="Revenue growth (YoY)"
                  value={pct(data.company.indicators?.revenueYoy)}
                />
                <MetricCard
                  label="Net profit growth (YoY)"
                  value={pct(data.company.indicators?.profitYoy)}
                />
                <MetricCard label="ROE" value={pct(data.company.indicators?.roe)} />
                <MetricCard
                  label="Gross margin"
                  value={pct(data.company.indicators?.grossMargin)}
                />
              </div>
              {data.company.indicators && (
                <p className="text-xs text-muted-foreground">
                  Report period {day(data.company.indicators.endDate)}
                  {data.company.indicators.announced
                    ? ` · announced ${day(data.company.indicators.announced)}`
                    : ""}
                </p>
              )}
              {data.industry?.valuation && (
                <div className="rounded-xl border p-4 text-sm">
                  <p className="font-medium">
                    Industry snapshot · as of {day(data.industry.valuation.asOf)}
                  </p>
                  <p className="text-muted-foreground">
                    Total market value {compactRmb.format(data.industry.valuation.totalMvRmb)} · P/E{" "}
                    {data.industry.valuation.pe ?? "unavailable"} · P/B{" "}
                    {data.industry.valuation.pb ?? "unavailable"}
                  </p>
                </div>
              )}
              {data.industry && data.industry.peers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold">
                    Industry peers ({data.industry.peers.length})
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {data.industry.peers.map((peer, index) => (
                      <span key={peer.tsCode}>
                        {index > 0 && " · "}
                        {peer.name}
                        <span className="text-xs"> {peer.tsCode}</span>
                        {!peer.sse && <span className="text-xs"> (non-SSE)</span>}
                      </span>
                    ))}
                  </p>
                </div>
              )}
              {data.industry && data.industry.reports.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold">Recent industry research reports</h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {data.industry.reports.map((report) => (
                      <li key={report.url}>
                        <a
                          className="underline underline-offset-4"
                          href={report.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {report.title}
                        </a>
                        <span className="ml-2 text-muted-foreground">
                          {report.inst} · {day(report.date)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {data.macro && (data.macro.gdp.length > 0 || data.macro.pmi.length > 0) && (
                <div className="rounded-xl border p-4 text-sm">
                  <p className="font-medium">Macro context</p>
                  {data.macro.gdp.length > 0 && (
                    <p className="text-muted-foreground">
                      GDP YoY ·{" "}
                      {data.macro.gdp
                        .map((row) => `${row.quarter}: ${row.yoy.toFixed(1)}%`)
                        .join(" · ")}
                    </p>
                  )}
                  {data.macro.pmi.length > 0 && (
                    <p className="text-muted-foreground">
                      Manufacturing PMI ·{" "}
                      {data.macro.pmi
                        .map(
                          (row) =>
                            `${row.month}: ${row.pmi.toFixed(1)} (production ${row.production.toFixed(1)}, new orders ${row.newOrders.toFixed(1)})`,
                        )
                        .join(" · ")}
                    </p>
                  )}
                </div>
              )}
              {data.unavailable.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {data.unavailable.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Not available from current sources: industry market size, five-year outlooks and
                news tracking. Sources as of {day(data.asOf)}.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
