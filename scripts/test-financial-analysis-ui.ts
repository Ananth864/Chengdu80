/// <reference lib="dom" />
// Static protected component and injected service outputs only, no host app or SSR.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { historicalAnalysis } from "../apps/web/src/server/historical-analysis";
import { aggregateIndustryResearch } from "../apps/web/src/server/industry-research";
import {
  brokerageReportIdentity,
  priceTarget,
  type BrokerageEvidence,
} from "../apps/web/src/server/price-target";
import type { TushareQuery, TushareRow } from "../apps/web/src/server/tushare";

type Seed = { results: Record<string, unknown>; companyId?: string; fail?: string };
declare global {
  interface Window {
    financialAnalysisSeed: Seed;
    financialAnalysisTest: {
      calls: { capability: string; input: { company_id: string; period?: string } }[];
      results: Record<string, unknown>;
    };
  }
}
const asOf = "2026-10-01";
const timestamp = "2026-10-01T10:00:00.000Z";
const company = {
  ticker: "600000",
  name: "Fixture company",
  industry: "Fixture industry",
  exchange: "SSE" as const,
  market_cap_rmb: 100_000_000_000,
  size_category: "Large cap" as const,
};
const peer = { ...company, ticker: "600001", name: "Fixture peer" };
const queryResult = (endpoint: string, rows: TushareRow[], fields = "") => ({
  endpoint,
  rows,
  fields: fields.split(","),
  retrieved_at: timestamp,
  status: "available" as const,
  limitations: [],
});
const historyQuery: TushareQuery = async (endpoint, _params, fields) =>
  queryResult(
    endpoint,
    endpoint === "daily"
      ? [
          {
            ts_code: "600000.SH",
            trade_date: "20260929",
            close: 10,
            high: 11,
            low: 9,
            pre_close: 10,
          },
          {
            ts_code: "600000.SH",
            trade_date: "20260930",
            close: 8,
            high: 9,
            low: 7,
            pre_close: 10,
          },
          {
            ts_code: "600000.SH",
            trade_date: "20261001",
            close: 9,
            high: 10,
            low: 8,
            pre_close: 8,
          },
        ]
      : ["20260929", "20260930", "20261001"].map((trade_date) => ({
          ts_code: "600000.SH",
          trade_date,
          adj_factor: 1,
        })),
    fields,
  );
const history = await historicalAnalysis(
  { company_id: company.ticker, as_of_date: asOf, period: "1y" },
  { mode: "fixture", companies: [company], query: historyQuery },
);
const missingFactors = await historicalAnalysis(
  { company_id: company.ticker, as_of_date: asOf },
  {
    mode: "fixture",
    companies: [company],
    query: async (endpoint, params, fields) =>
      endpoint === "daily"
        ? historyQuery(endpoint, params, fields)
        : {
            ...queryResult(endpoint, [], fields),
            status: "permission_denied",
            limitations: ["Adjustment factors inaccessible"],
          },
  },
);
const incomeFields = "ts_code,ann_date,f_ann_date,end_date,report_type,total_revenue";
// Synthetic observations explicitly declare their monetary metadata; no provider convention is inferred.
const industryOutput = aggregateIndustryResearch({
  selectedCompany: company,
  companies: [company, peer],
  asOfDate: asOf,
  years: 3,
  retrievedAt: timestamp,
  responses: [
    {
      company_id: company.ticker,
      result: queryResult(
        "income",
        [
          {
            ts_code: "600000.SH",
            end_date: "20231231",
            ann_date: "20240401",
            f_ann_date: "20240401",
            report_type: "1",
            total_revenue: 100,
            currency: "CNY",
            unit: "yuan",
          },
          {
            ts_code: "600000.SH",
            end_date: "20241231",
            ann_date: "20250401",
            f_ann_date: "20250401",
            report_type: "1",
            total_revenue: 150,
            currency: "CNY",
            unit: "yuan",
          },
        ],
        incomeFields,
      ),
    },
    {
      company_id: peer.ticker,
      result: queryResult(
        "income",
        [
          {
            ts_code: "600001.SH",
            end_date: "20241231",
            ann_date: "20250401",
            f_ann_date: "20250401",
            report_type: "1",
            total_revenue: 200,
            currency: "CNY",
            unit: "yuan",
          },
        ],
        incomeFields,
      ),
    },
  ],
});
// The SDK transport envelope adds shared metadata without changing service sections.
const industry = {
  ...industryOutput,
  capability_id: "industry-research",
  provider: "Tushare",
  mode: "fixture",
};
const missingMonetaryMetadata = {
  ...industry,
  ...aggregateIndustryResearch({
    selectedCompany: company,
    companies: [company, peer],
    asOfDate: asOf,
    years: 2,
    retrievedAt: timestamp,
    responses: [
      {
        company_id: company.ticker,
        result: queryResult(
          "income",
          [
            {
              ts_code: "600000.SH",
              end_date: "20241231",
              ann_date: "20250401",
              f_ann_date: "20250401",
              report_type: "1",
              total_revenue: 150,
            },
          ],
          incomeFields,
        ),
      },
    ],
  }),
};
assert(missingMonetaryMetadata.annual_revenue_totals.every((row) => row.value === null));
assert(
  missingMonetaryMetadata.annual_revenue_totals.some((row) =>
    row.exclusions.some((entry) => entry.reasons.includes("unverified_currency_units")),
  ),
);
const reports: TushareRow[] = [10, 12, 14].map((min_price, index) => ({
  ts_code: "600000.SH",
  org_name: `Broker ${index}`,
  report_date: "20260930",
  report_title: `Fixture report ${index}`,
  rating: index === 2 ? "fixture-hold" : "fixture-buy",
  min_price,
  max_price: min_price + 4,
}));
const evidence: BrokerageEvidence = {
  version: 1,
  sources: [
    {
      id: "fixture",
      url: "https://example.com/fixture-only",
      description: "Synthetic mapping evidence",
    },
  ],
  brokerages: reports.map((row, index) => ({
    id: `b${index}`,
    aliases: [String(row.org_name)],
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
  targets: reports.map((row, index) => ({
    report_identity: brokerageReportIdentity(row),
    brokerage_id: `b${index}`,
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
async function targetResult(data = reports, denied = false) {
  const output = await priceTarget(
    { company_id: company.ticker, as_of_date: asOf },
    {
      mode: "fixture",
      companies: [company],
      evidence,
      query: async (endpoint, _params, fields) =>
        denied
          ? {
              ...queryResult(endpoint, [], fields),
              status: "permission_denied",
              limitations: ["Report access inaccessible"],
            }
          : queryResult(
              endpoint,
              endpoint === "report_rc"
                ? data
                : [{ ts_code: "600000.SH", trade_date: "20261001", close: 10 }],
              fields,
            ),
    },
  );
  assert(output && typeof output === "object" && "status" in output && "limitations" in output);
  return {
    ...output,
    status:
      output.status === "permission_denied" || output.status === "no_results"
        ? "unavailable"
        : output.status,
    data_limitations: output.limitations,
  };
}
const target = await targetResult();
const starterSrc = fileURLToPath(new URL("../apps/web/starter/project/src/", import.meta.url));
const build = await Bun.build({
  entrypoints: [fileURLToPath(new URL("./fixtures/financial-analysis-ui.js", import.meta.url))],
  target: "browser",
  format: "esm",
  define: { "process.env.NODE_ENV": JSON.stringify("development") },
  plugins: [
    {
      name: "starter-source-alias",
      setup(builder) {
        builder.onResolve(
          { filter: /^(react(?:\/.*)?|react-dom(?:\/.*)?|@tanstack\/react-query)$/ },
          ({ path }) => ({ path: Bun.resolveSync(path, starterSrc) }),
        );
        builder.onResolve({ filter: /^@\// }, ({ path }) => ({
          path: Bun.resolveSync(starterSrc + path.slice(2), starterSrc),
        }));
      },
    },
  ],
});
assert(build.success, build.logs.map(String).join("\n"));
assert.equal(build.outputs.length, 1);
const bundle = await build.outputs[0]!.text();
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  headless: true,
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let seed: Seed = { results: {} };
  await page.route("**/*", (route) => {
    if (route.request().url() === "https://financial-test.local/")
      return route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:8px}*{box-sizing:border-box}[data-slot=card]{min-width:0;max-width:100%;overflow-wrap:anywhere}[data-slot=table-container]{max-width:100%;overflow-x:auto}table{border-collapse:collapse}th,td{text-align:left;padding:8px}svg{display:block}</style></head><body><div id="root"></div><script>window.financialAnalysisSeed=${JSON.stringify(seed).replaceAll("<", "\\u003c")}</script><script type="module" src="/fixture.js"></script></body></html>`,
      });
    if (route.request().url() === "https://financial-test.local/fixture.js")
      return route.fulfill({ contentType: "text/javascript", body: bundle });
    throw new Error(`Unexpected browser request: ${route.request().url()}`);
  });
  const panel = (name: string) =>
    page.locator('[data-slot="card"]').filter({
      has: page.locator('[data-slot="card-title"]').filter({ hasText: new RegExp(`^${name}$`) }),
    });
  async function fresh(overrides: Partial<Seed> = {}) {
    seed = {
      results: {
        "historical-analysis": history,
        "industry-research": industry,
        "price-target": target,
      },
      ...overrides,
    };
    await page.goto("https://financial-test.local/");
    await page.waitForFunction(
      () =>
        document.querySelectorAll('[data-slot="card"]').length === 3 &&
        !document.querySelector('[aria-busy="true"]') &&
        !document.body.textContent?.includes("Loading financial analysis..."),
    );
  }
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await fresh();
    const historical = panel("Historical analysis");
    const research = panel("Industry research");
    const brokerage = panel("Brokerage ratings and targets");
    await historical.getByRole("heading", { name: "Adjusted maximum drawdown" }).waitFor();
    assert.match(await historical.innerText(), /-20 %/);
    assert.match(await historical.innerText(), /2026-09-29 to 2026-10-01/);
    assert.match(await historical.innerText(), /doc_id=146/);
    await historical.getByText("Accessible price values", { exact: true }).click();
    assert.equal(
      await historical
        .getByRole("table", { name: "Raw closing price values" })
        .getByRole("row")
        .count(),
      4,
    );
    assert.match(
      await research.getByRole("table", { name: "Annual revenue totals", exact: true }).innerText(),
      /350/,
    );
    assert.match(
      await research.getByRole("table", { name: "Matched cohort growth", exact: true }).innerText(),
      /50 %/,
    );
    assert.match(
      await research.getByRole("table", { name: "Matched cohort growth", exact: true }).innerText(),
      /1 \/ 2/,
    );
    assert.match(
      await research.getByRole("table", { name: "Annual revenue totals", exact: true }).innerText(),
      /2025\s+Unavailable/,
    );
    const ratings = brokerage.getByRole("table", { name: "Brokerage rating counts", exact: true });
    assert.equal(await ratings.getByRole("row").count(), 6);
    assert.match(await ratings.innerText(), /Buy\s+2/);
    assert.match(await brokerage.innerText(), /Modal category: Buy/);
    assert.match(await brokerage.innerText(), /14 CNY\/share/);
    assert.match(await brokerage.innerText(), /40 %/);
    assert.match(
      await brokerage
        .getByRole("table", { name: "Original brokerage ratings", exact: true })
        .innerText(),
      /fixture-buy/,
    );
    await brokerage.getByText("Sources and retrieval dates", { exact: true }).click();
    assert.match(await brokerage.innerText(), /2026-10-01T10:00:00.000Z/);
    await research.getByText("2024 coverage and evidence", { exact: true }).click();
    await research.getByText("Sources and retrieval dates", { exact: true }).nth(1).click();
    assert.match(await research.innerText(), /Published 2025-04-01/);
    for (const period of ["1m", "6m", "5y", "1y"]) {
      await historical.getByRole("combobox", { name: "Chart period" }).click();
      await page.getByRole("option", { name: period, exact: true }).click();
      await page.waitForFunction(
        (selected) =>
          window.financialAnalysisTest.calls.some(
            (call) =>
              call.capability === "finance.historical-analysis" && call.input.period === selected,
          ),
        period,
      );
      assert.equal(
        await historical.getByRole("combobox", { name: "Chart period" }).innerText(),
        period,
      );
    }
    const calls = await page.evaluate(() => window.financialAnalysisTest.calls);
    assert(
      calls.every(
        (call) => call.capability.startsWith("finance.") && call.input.company_id === "600000",
      ),
    );
    assert(
      calls
        .filter((call) => call.capability === "finance.historical-analysis")
        .some((call) => call.input.period === "5y"),
    );
    assert(
      calls
        .filter((call) => call.capability !== "finance.historical-analysis")
        .every((call) => call.input.period === undefined),
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      "No page-level horizontal overflow",
    );
    const body = await page.locator("body").innerText();
    assert.doesNotMatch(
      body,
      /all.time|forecast return:\s*\d|recommended (buy|sell)|"price_series"/i,
    );
  }
  await fresh({
    results: {
      "historical-analysis": history,
      "industry-research": missingMonetaryMetadata,
      "price-target": target,
    },
  });
  const missingAnnual = panel("Industry research").getByRole("table", {
    name: "Annual revenue totals",
    exact: true,
  });
  for (const row of await missingAnnual
    .getByRole("row")
    .all()
    .then((rows) => rows.slice(1))) {
    assert.equal(
      await row.getByRole("cell").nth(1).innerText(),
      "Unavailable",
      "Unverified monetary metadata must not become zero revenue",
    );
  }
  const missingGrowth = panel("Industry research").getByRole("table", {
    name: "Matched cohort growth",
    exact: true,
  });
  assert.equal(
    await missingGrowth.getByRole("row").nth(1).getByRole("cell").nth(1).innerText(),
    "Unavailable",
  );
  await panel("Industry research").getByText("2024 coverage and evidence", { exact: true }).click();
  assert.match(await panel("Industry research").innerText(), /unverified_currency_units/);
  assert.equal(await panel("Historical analysis").getByRole("img").count(), 1);
  await fresh({
    results: {
      "historical-analysis": missingFactors,
      "industry-research": industry,
      "price-target": await targetResult(reports.slice(0, 2)),
    },
  });
  assert.match(await panel("Historical analysis").innerText(), /9 CNY\/share/);
  const drawdown = panel("Historical analysis")
    .locator("div.rounded-md")
    .filter({ hasText: "Adjusted maximum drawdown" });
  assert.match(await drawdown.innerText(), /Unavailable/);
  assert.doesNotMatch(await drawdown.innerText(), /\b0 %/);
  assert.match(
    await panel("Brokerage ratings and targets").innerText(),
    /Average brokerage target midpoint: Unavailable/,
  );
  assert.equal(
    await panel("Brokerage ratings and targets")
      .getByRole("table", { name: "Brokerage rating counts", exact: true })
      .count(),
    1,
    "Insufficient targets must not suppress ratings",
  );
  await fresh({
    results: {
      "historical-analysis": history,
      "industry-research": { ...industry, annual_revenue_totals: null },
      "price-target": await targetResult([], true),
    },
  });
  assert.match(await panel("Industry research").innerText(), /Annual totals unavailable/);
  assert.equal(
    await panel("Industry research")
      .getByRole("table", { name: "Matched cohort growth", exact: true })
      .count(),
    1,
  );
  assert.equal(
    await panel("Brokerage ratings and targets")
      .getByRole("table", { name: "Brokerage rating counts", exact: true })
      .count(),
    0,
    "Inaccessible counts must not appear as five zeroes",
  );
  await fresh({ fail: "industry-research" });
  assert.match(await panel("Industry research").innerText(), /Financial analysis unavailable/);
  assert.equal(await panel("Historical analysis").getByRole("img").count(), 1);
  assert.equal(
    await panel("Brokerage ratings and targets")
      .getByRole("table", { name: "Brokerage rating counts", exact: true })
      .count(),
    1,
  );
  await fresh({ companyId: "not-a-ticker" });
  assert.equal((await page.evaluate(() => window.financialAnalysisTest.calls)).length, 0);
  assert.equal(
    await page.getByText("Six-digit SSE company ID unavailable", { exact: true }).count(),
    3,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS FinancialAnalysis browser: real service outputs, desktop/mobile, chart periods, adjusted fractions, separate cohorts, independent failures, null/access handling, brokerage counts, three-broker gate, provenance, and no storage writes.",
  );
} finally {
  await browser.close();
}
