import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
const historyMetrics = [
  "Current price",
  "52-week high",
  "52-week low",
  "All-time high",
  "All-time low",
  "Maximum drawdown",
  "Distance from 52-week high",
  "Distance from 52-week low",
  "Daily change",
  "Daily change (%)",
];

export function FinancialDemo() {
  const capabilities: readonly string[] = buildContext.capabilities;
  return (
    <main
      data-financial-module-version="financial-react-v3"
      className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10"
    >
      <header className="space-y-3">
        <Badge variant="secondary">Live · Shanghai Stock Exchange</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{buildContext.name}</h1>
        <p className="text-muted-foreground">
          Explore the confirmed financial workflow with real Shanghai Stock Exchange Class A
          companies. Expert assessments are unavailable.
        </p>
      </header>
      {capabilities.includes("risk-industry-matching") && (
        <CompanySelection cards={capabilities.includes("company-cards")} />
      )}
      {capabilities.includes("historical-analysis") && (
        <section aria-label="Historical analysis" className="space-y-4">
          <h2 className="text-xl font-semibold">Historical analysis and sourced price target</h2>
          <p className="text-muted-foreground">
            {buildContext.companies.join(", ")} · Tushare market data and the financial website
            source are pending.
          </p>
          <div className="rounded-xl border p-8 text-muted-foreground">Price chart unavailable</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {historyMetrics.map((label) => (
              <MetricCard key={label} label={label} value={null} />
            ))}
            <MetricCard label="Sourced price target" value={null} />
          </div>
        </section>
      )}
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
                  <div key={metric.id} className="flex justify-between gap-4 text-sm">
                    <span>{metricNames[metric.id] ?? metric.id}</span>
                    <span className="text-muted-foreground">Unavailable</span>
                  </div>
                ))}
              <details>
                <summary className="cursor-pointer text-sm font-medium">Company research</summary>
                <p className="pt-2 text-sm text-muted-foreground">
                  Company-specific research and relevant industry context will appear here when
                  approved sources are connected.
                </p>
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
