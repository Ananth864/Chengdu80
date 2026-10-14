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
  const live = buildContext.mode === "live";
  return (
    <main
      data-financial-module-version="financial-react-v2"
      className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10"
    >
      <header className="space-y-3">
        <Badge variant="secondary">
          {live ? "Live · Shanghai Stock Exchange" : "Synthetic demo"}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{buildContext.name}</h1>
        <p className="text-muted-foreground">
          {live
            ? "Explore the confirmed financial workflow with real Shanghai Stock Exchange Class A companies. Expert assessments are unavailable."
            : "Explore the confirmed financial workflow. Live data and expert assessments are unavailable."}
        </p>
      </header>
      {capabilities.includes("risk-industry-matching") && (
        <CompanySelection cards={capabilities.includes("company-cards")} live={live} />
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
        <Card>
          <CardHeader>
            <CardTitle>Company and industry research</CardTitle>
            <CardDescription>
              {buildContext.companies.length
                ? `Company research with industry context: ${buildContext.companies.join(", ")}`
                : "Standalone industry research"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            Research and news sources are pending. No financial conclusions have been generated.
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function CompanySelection({ cards, live }: { cards: boolean; live: boolean }) {
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
            {live
              ? "Your risk comfort chooses the company size band. It is not an expert risk assessment."
              : "This synthetic risk choice demonstrates the mapping. It is not an expert risk assessment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="risk-profile">
              {live ? "Risk profile" : "Synthetic risk profile"}
            </FieldLabel>
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
              {live
                ? "Industries come from the live Shanghai Stock Exchange company table."
                : "The synthetic table contains Technology examples."}
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
