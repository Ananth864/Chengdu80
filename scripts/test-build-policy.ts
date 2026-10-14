import { importCompanyCsv } from "../apps/web/src/lib/company-table";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseStockBasic, resetSseCompanyCache } from "../apps/web/src/server/providers";
import {
  prepareBuild,
  requireBuild,
  resolveCapabilities,
  managedCompanies,
  validateScopedBundle,
} from "../apps/web/src/server/build-policy";
import { protocols } from "../apps/web/src/lib/contracts";
import { sampleBundle } from "../apps/web/src/lib/samples";
const plan = {
  requirements: "An industry research demo",
  capabilities: ["market-research"],
  companyQueries: [],
  mode: "fixture",
  themeOverride: null,
};
const record = await prepareBuild(plan, "turn-1", 1);
assert.deepEqual(record.resolvedCapabilities, ["market-research", "news"]);
assert.equal(record.theme, "starter-default");
requireBuild(record, "turn-1");
assert.throws(() =>
  requireBuild({ ...record, readiness: "fixture", provider: "wind" } as never, "turn-1"),
);
assert.throws(() =>
  requireBuild({ ...record, plan: { ...record.plan, capabilities: ["company-cards"] } }, "turn-1"),
);
const rejectedIntent = await prepareBuild(plan, "turn-1", 2, ["Unsupported user intent"]);
assert.throws(() => requireBuild(rejectedIntent, "turn-1"));
assert.throws(() => requireBuild(record, "turn-2"));
assert.throws(() => requireBuild(undefined, "turn-1"));
assert.throws(() => resolveCapabilities(["weather"] as never));
assert.deepEqual(resolveCapabilities(["price-target"]), ["historical-analysis", "price-target"]);
assert.deepEqual(resolveCapabilities(["company-cards"]), [
  "company-cards",
  "industry-preference",
  "risk-assessment",
  "risk-industry-matching",
]);
const unknown = await prepareBuild({ ...plan, companyQueries: ["Apple"] }, "turn-1", 2);
assert.equal(unknown.readiness, "blocked");
assert.throws(() => requireBuild(unknown, "turn-1"));
const historical = await prepareBuild(
  { ...plan, capabilities: ["price-target"], companyQueries: ["DEMO001"] },
  "turn-1",
  3,
);
assert.equal(historical.readiness, "fixture");
assert.deepEqual(historical.companyIds, ["DEMO001"]);
const withoutCompany = await prepareBuild(
  { ...plan, capabilities: ["historical-analysis"] },
  "turn-1",
  4,
);
assert.equal(withoutCompany.readiness, "blocked");
await assert.rejects(() => prepareBuild({ ...plan, capabilities: ["weather"] }, "turn-1", 1));
const bundle = sampleBundle(protocols[0]!.defaultSpec);
assert.throws(() => validateScopedBundle(bundle, record));
bundle.manifest.permissions = ["finance.calculate", "storage.read", "storage.write"];
assert.throws(() => validateScopedBundle(bundle, record));
bundle.files["index.html"] = "<main><p>Synthetic demo</p></main>";
validateScopedBundle(bundle, record);
const sample = JSON.parse(
  await readFile(new URL("./fixtures/stock-basic-sample.json", import.meta.url), "utf8"),
);
const previousToken = process.env.TUSHARE_TOKEN;
const originalFetch = globalThis.fetch;
try {
  process.env.TUSHARE_TOKEN = "";
  resetSseCompanyCache();
  const unavailable = await prepareBuild({ ...plan, mode: "live" }, "turn-1", 1);
  assert.equal(unavailable.readiness, "blocked");
  assert(
    unavailable.blockers.some((blocker) =>
      blocker.includes("Live company lookup is unavailable: TUSHARE_TOKEN"),
    ),
  );
  process.env.TUSHARE_TOKEN = "test-token";
  globalThis.fetch = (async () => new Response(JSON.stringify(sample))) as typeof fetch;
  resetSseCompanyCache();
  const live = await managedCompanies("live");
  assert(live.available);
  const tickers = live.companies.map((company) => company.ticker);
  assert(tickers.includes("600000.SH"));
  assert(tickers.includes("689009.SH"));
  assert(!tickers.includes("900901.SH"), "B-shares are outside the SSE Class A scope");
  assert(!tickers.includes("000001.SZ"), "SZSE companies are outside the SSE Class A scope");
  assert(/sse-a:[0-9a-f]+:\d{8}/.test(live.version));
  const valid = await prepareBuild(
    { ...plan, mode: "live", companyQueries: ["600000.SH"] },
    "turn-1",
    1,
  );
  assert.deepEqual(valid.companyIds, ["600000.SH"]);
  assert.equal(
    valid.readiness,
    "live",
    "A verified Tushare feed (company probe succeeded) opens live builds",
  );
  const byFullName = await prepareBuild(
    { ...plan, mode: "live", companyQueries: ["上海浦东发展银行股份有限公司"] },
    "turn-1",
    2,
  );
  assert.deepEqual(byFullName.companyIds, ["600000.SH"]);
  const outside = await prepareBuild(
    { ...plan, mode: "live", companyQueries: ["Apple"] },
    "turn-1",
    3,
  );
  assert(outside.blockers.some((blocker) => blocker.includes("SSE Class A scope")));
  const duplicates = JSON.parse(JSON.stringify(sample)) as typeof sample;
  duplicates.data.items.push(duplicates.data.items[0]);
  assert.throws(() => parseStockBasic(duplicates), /duplicate tickers/);
  assert.throws(() => parseStockBasic({ code: 401, msg: "token check failed" }), /token check/);
} finally {
  if (previousToken === undefined) delete process.env.TUSHARE_TOKEN;
  else process.env.TUSHARE_TOKEN = previousToken;
  globalThis.fetch = originalFetch;
  resetSseCompanyCache();
}
console.log(
  "PASS dependency closure, unsupported capabilities, turn gating, labels/permissions, live SSE Class A identity and blockers",
);

const csv =
  'Company Name,Ticker Symbol,Industry,A-share Market Capitalisation (RMB),Size Category\r\n"Test, Company",000001.SZ,Technology,"1,000",Large Cap\r\n';
assert.equal(importCompanyCsv(csv)[0]!.ticker, "000001.SZ");
assert.equal(importCompanyCsv(csv)[0]!.name, "Test, Company");
assert.equal(importCompanyCsv(csv)[0]!.marketCapRmb, 1000);
assert.throws(() => importCompanyCsv(csv + "Other,000001.SZ,Tech,5,Small Cap\n"));
assert.throws(() => importCompanyCsv(csv.replace("Large Cap", "Unknown")));
assert.throws(() => importCompanyCsv(csv + '"unclosed'));
console.log("PASS team CSV quoted fields, ticker identity, categories and malformed rows");

const cardRecord = await prepareBuild(
  { ...plan, capabilities: ["company-cards"], cardMetrics: ["ps"] },
  "cards-turn",
  1,
);
bundle.manifest.permissions = ["finance.company-cards", "finance.match-companies"];
validateScopedBundle(bundle, cardRecord);
assert.throws(() => validateScopedBundle(bundle, record));
assert.equal(cardRecord.moduleVersions.companies, "company-capabilities-v1");
assert.deepEqual(cardRecord.plan.cardMetrics, ["ps"]);
console.log(
  "PASS platform module permissions follow selected capabilities and pin versions/metrics",
);
