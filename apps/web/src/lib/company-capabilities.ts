import { z } from "zod";
import type { Company } from "./company-table";

// Settled product rules. Expert scoring and metric formulas do not belong here.
export const companyModuleVersion = "company-capabilities-v1";
export const riskToSize = { low: "large", medium: "medium", high: "small" } as const;
export const cardMetrics = [
  "pe",
  "ps",
  "dividendYield",
  "revenueGrowth",
  "roe",
  "interestCoverage",
] as const;
export type CardMetric = (typeof cardMetrics)[number];
export const defaultCardMetrics: CardMetric[] = ["pe", "dividendYield", "roe", "interestCoverage"];
export const metricSelectionSchema = z
  .array(z.enum(cardMetrics))
  .min(1)
  .max(6)
  .refine((values) => new Set(values).size === values.length, "Select each metric once");
export const matchingInputSchema = z
  .object({
    risk: z.enum(["low", "medium", "high"]),
    industries: z.array(z.string().trim().min(1).max(100)).min(1).max(30),
  })
  .strict();
export type MatchingInput = z.infer<typeof matchingInputSchema>;
export function matchCompanies(companies: Company[], raw: unknown) {
  const criteria = matchingInputSchema.parse(raw);
  const industries = [...new Set(criteria.industries)].sort();
  const available = new Set(companies.map((company) => company.industry));
  if (industries.some((industry) => !available.has(industry)))
    throw new Error("Select an industry from the platform company table.");
  const size = riskToSize[criteria.risk];
  return {
    criteria: { risk: criteria.risk, industries },
    size,
    companies: companies.filter(
      (company) => company.size === size && industries.includes(company.industry),
    ),
    moduleVersion: companyModuleVersion,
  };
}
export type CardState = {
  batch?: {
    day: string;
    criteriaKey: string;
    tickers: string[];
    decisions: Record<string, "yes" | "no">;
  };
  watchlist: string[];
  dismissed: string[];
};
export const emptyCardState = (): CardState => ({ watchlist: [], dismissed: [] });
export function shanghaiDay(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
function seededOrder(seed: string, ticker: string) {
  let value = 2166136261;
  for (const char of `${seed}:${ticker}`) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
export function dailyCompanyCards(
  companies: Company[],
  raw: unknown,
  state: CardState,
  context: { day: string; appId: string; revisitDismissed?: boolean },
) {
  const matched = matchCompanies(companies, raw);
  const criteriaKey = JSON.stringify(matched.criteria);
  const next = structuredClone(state);
  if (next.batch?.day === context.day) {
    if (next.batch.criteriaKey !== criteriaKey)
      throw new Error("Today's companies are already selected. New preferences apply tomorrow.");
    return { state: next, matched, exhausted: !next.batch.tickers.length };
  }
  let eligible = matched.companies.filter(
    (company) =>
      !next.watchlist.includes(company.ticker) && !next.dismissed.includes(company.ticker),
  );
  if (!eligible.length && context.revisitDismissed)
    eligible = matched.companies.filter((company) => !next.watchlist.includes(company.ticker));
  // An empty pool is returned without fixing an empty batch so explicit revisiting remains possible.
  if (!eligible.length) return { state: next, matched, exhausted: true };
  const tickers = [...eligible]
    .sort(
      (a, b) =>
        seededOrder(`${context.appId}:${context.day}:${criteriaKey}`, a.ticker) -
          seededOrder(`${context.appId}:${context.day}:${criteriaKey}`, b.ticker) ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, 5)
    .map((company) => company.ticker);
  next.batch = { day: context.day, criteriaKey, tickers, decisions: {} };
  return { state: next, matched, exhausted: false };
}
export function decideCompanyCard(
  state: CardState,
  day: string,
  ticker: string,
  choice: "yes" | "no",
) {
  if (state.batch?.day !== day || !state.batch.tickers.includes(ticker))
    throw new Error("Choose a company from today's batch.");
  const previous = state.batch.decisions[ticker];
  if (previous && previous !== choice) throw new Error("This company's choice is already saved.");
  const next = structuredClone(state);
  next.batch!.decisions[ticker] = choice;
  if (choice === "yes") {
    next.watchlist = [...new Set([...next.watchlist, ticker])];
    next.dismissed = next.dismissed.filter((id) => id !== ticker);
  } else next.dismissed = [...new Set([...next.dismissed, ticker])];
  return next;
}
// Card metrics come from the latest daily_basic fundamentals the feed publishes
// (trailing P/E, P/S and dividend yield); everything else stays honestly
// unavailable until an approved source supplies it.
export type CardFundamentals = {
  peTtm: number | null;
  psTtm: number | null;
  dividendYieldTtm: number | null;
};
export function companyCardMetrics(
  fundamentals: CardFundamentals | undefined,
  selected: CardMetric[] = defaultCardMetrics,
) {
  const source: Record<CardMetric, number | null> = {
    pe: fundamentals?.peTtm ?? null,
    ps: fundamentals?.psTtm ?? null,
    dividendYield: fundamentals?.dividendYieldTtm ?? null,
    revenueGrowth: null,
    roe: null,
    interestCoverage: null,
  };
  return metricSelectionSchema.parse(selected).map((id) => {
    const value = source[id];
    return value === null
      ? {
          id,
          value: null,
          status: "unavailable" as const,
          reason: "Not published by the current market feed yet.",
        }
      : { id, value, status: "available" as const };
  });
}
export const companyCardsInputSchema = z.discriminatedUnion("action", [
  matchingInputSchema
    .extend({ action: z.literal("batch"), revisitDismissed: z.boolean().default(false) })
    .strict(),
  z
    .object({
      action: z.literal("decide"),
      ticker: z.string().min(1).max(100),
      choice: z.enum(["yes", "no"]),
    })
    .strict(),
  z.object({ action: z.literal("watchlist") }).strict(),
]);
