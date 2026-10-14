import assert from "node:assert/strict";
import {
  dailyCompanyCards,
  decideCompanyCard,
  emptyCardState,
  matchCompanies,
  shanghaiDay,
  unavailableCardMetrics,
} from "../apps/web/src/lib/company-capabilities";
import type { Company } from "../apps/web/src/lib/company-table";
const companies: Company[] = Array.from({ length: 8 }, (_, i) => ({
  name: `Synthetic Company ${i}`,
  ticker: `DEMO${i}`,
  industry: i === 7 ? "Health" : "Technology",
  marketCapRmb: 1000,
  size: i < 6 ? "large" : i === 6 ? "medium" : "small",
}));
assert.equal(
  matchCompanies(companies, { risk: "low", industries: ["Technology"] }).companies.length,
  6,
);
assert.deepEqual(
  matchCompanies(companies, { risk: "medium", industries: ["Technology"] }).companies.map(
    (c) => c.ticker,
  ),
  ["DEMO6"],
);
assert.equal(
  matchCompanies(companies, { risk: "high", industries: ["Health"] }).companies[0]!.ticker,
  "DEMO7",
);
assert.equal(
  matchCompanies(companies, { risk: "high", industries: ["Technology"] }).companies.length,
  0,
);
assert.throws(() => matchCompanies(companies, { risk: "low", industries: ["Invented"] }));
const criteria = { risk: "low", industries: ["Technology"] };
const context = { appId: "test-app", day: "2026-10-14" };
const first = dailyCompanyCards(companies, criteria, emptyCardState(), context);
assert.equal(first.state.batch!.tickers.length, 5);
assert.equal(new Set(first.state.batch!.tickers).size, 5);
assert.deepEqual(
  dailyCompanyCards([...companies].reverse(), criteria, emptyCardState(), context).state,
  first.state,
);
assert.deepEqual(
  dailyCompanyCards(companies, criteria, JSON.parse(JSON.stringify(first.state)), context).state,
  first.state,
);
assert.throws(() =>
  dailyCompanyCards(
    companies,
    { risk: "medium", industries: ["Technology"] },
    first.state,
    context,
  ),
);
let state = first.state;
for (const [i, ticker] of state.batch!.tickers.entries())
  state = decideCompanyCard(state, context.day, ticker, i ? "no" : "yes");
assert.equal(state.watchlist.length, 1);
assert.equal(state.dismissed.length, 4);
assert.deepEqual(decideCompanyCard(state, context.day, state.watchlist[0]!, "yes"), state);
assert.throws(() => decideCompanyCard(state, context.day, state.watchlist[0]!, "no"));
assert.throws(() => decideCompanyCard(state, "2026-10-15", state.watchlist[0]!, "yes"));
assert.throws(() => decideCompanyCard(state, context.day, "not-in-batch", "yes"));
const second = dailyCompanyCards(companies, criteria, state, { ...context, day: "2026-10-15" });
assert.equal(second.state.batch!.tickers.length, 1);
state = decideCompanyCard(second.state, "2026-10-15", second.state.batch!.tickers[0]!, "no");
const thirdContext = { ...context, day: "2026-10-16" };
assert(dailyCompanyCards(companies, criteria, state, thirdContext).exhausted);
const revisited = dailyCompanyCards(companies, criteria, state, {
  ...thirdContext,
  revisitDismissed: true,
});
assert.equal(revisited.state.batch!.tickers.length, 5);
assert(!revisited.state.batch!.tickers.includes(state.watchlist[0]!));
assert.equal(shanghaiDay(new Date("2026-10-14T15:59:59Z")), "2026-10-14");
assert.equal(shanghaiDay(new Date("2026-10-14T16:00:00Z")), "2026-10-15");
assert.deepEqual(
  unavailableCardMetrics().map((m) => m.id),
  ["pe", "dividendYield", "roe", "interestCoverage"],
);
assert.deepEqual(
  unavailableCardMetrics(["ps"]).map((m) => m.id),
  ["ps"],
);
assert.equal(unavailableCardMetrics(["roe"])[0]!.value, null);
assert.throws(() => unavailableCardMetrics(["roe", "roe"]));
console.log(
  "PASS fixed matching, independent filters, five-card limit, stable reload/order, decisions, exclusion/exhaustion/revisit, China day, metric selection and missing values",
);
