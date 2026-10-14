import { importCompanyCsv } from "../apps/web/src/lib/company-table";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parseStockBasic, resetSseCompanyCache } from "../apps/web/src/server/providers";
import {
  prepareBuild,
  requireBuild,
  resolveCapabilities,
  managedCompanies,
  validateScopedBundle,
  agentProtocols,
} from "../apps/web/src/server/build-policy";
import { financialSkills, readFinancialSkill } from "../apps/web/src/server/financial-expert";
import { protocols } from "../apps/web/src/lib/contracts";
import { sampleBundle } from "../apps/web/src/lib/samples";
const plan = {
  requirements: "An industry research app on real Shanghai listings",
  capabilities: ["market-research"],
  companyQueries: [],
  mode: "live",
  themeOverride: null,
};
const csv =
  'Company Name,Ticker Symbol,Industry,A-share Market Capitalisation (RMB),Size Category\r\n"Test, Company",000001.SZ,Technology,"1,000",Large Cap\r\n';
assert.equal(importCompanyCsv(csv)[0]!.ticker, "000001.SZ");
assert.equal(importCompanyCsv(csv)[0]!.name, "Test, Company");
assert.equal(importCompanyCsv(csv)[0]!.marketCapRmb, 1000);
assert.throws(() => importCompanyCsv(csv + "Other,000001.SZ,Tech,5,Small Cap\n"));
assert.throws(() => importCompanyCsv(csv.replace("Large Cap", "Unknown")));
assert.throws(() => importCompanyCsv(csv + '"unclosed'));
console.log("PASS team CSV quoted fields, ticker identity, categories and malformed rows");

const sample = JSON.parse(
  await readFile(new URL("./fixtures/stock-basic-sample.json", import.meta.url), "utf8"),
);
const previousToken = process.env.TUSHARE_TOKEN;
const originalFetch = globalThis.fetch;
try {
  process.env.TUSHARE_TOKEN = "test-token";
  globalThis.fetch = (async () => new Response(JSON.stringify(sample))) as typeof fetch;
  resetSseCompanyCache();
  const record = await prepareBuild(plan, "turn-1", 1);
  assert(agentProtocols["financial-expert"].includes("# Financial Expert Agent"));
  assert(agentProtocols["financial-expert"].includes("read_financial_skill"));
  assert.equal(Object.keys(financialSkills).length, 8);
  const chatbotSkill = readFinancialSkill("database-grounded-chatbot").content;
  assert(chatbotSkill.includes("component-id: grounded-chatbot"));
  assert(chatbotSkill.includes("not a registered financial capability"));
  assert(
    agentProtocols["capability-catalog"].includes(
      "removed grounded-chatbot catalog entry does not prohibit",
    ),
  );
  assert(
    chatbotSkill.includes("convex database within the application is the sole factual source"),
  );
  assert(chatbotSkill.includes("conversational"));
  assert(chatbotSkill.includes("clarification_needed"));
  assert(chatbotSkill.includes("Do not require a selected company for a greeting"));
  assert(chatbotSkill.includes("Never let conversational routing bypass factual"));
  assert(chatbotSkill.includes("answering makes no external network calls or database mutations"));
  assert(agentProtocols["financial-expert"].includes("First route basic conversation"));
  for (const [id, content] of Object.entries(financialSkills)) {
    assert.deepEqual(readFinancialSkill(id), { path: `skills/${id}.md`, content });
    assert.equal(
      record.protocolHashes[`financial-skill:${id}`],
      createHash("sha256").update(content).digest("hex"),
    );
    assert(content.startsWith("# ") || content.startsWith("---\n"));
  }
  assert.equal(
    record.protocolHashes["financial-expert"],
    createHash("sha256").update(agentProtocols["financial-expert"]).digest("hex"),
  );
  assert.throws(() => readFinancialSkill("../../settings"));
  assert.throws(() => readFinancialSkill("unknown-skill"));
  console.log("PASS bundled financial expert, allowlisted skill loading and build provenance");
  assert.deepEqual(record.resolvedCapabilities, ["market-research"]);
  assert.equal(record.theme, "starter-default");
  requireBuild(record, "turn-1");
  assert.throws(() => requireBuild({ ...record, provider: "wind" } as never, "turn-1"));
  assert.throws(() =>
    requireBuild(
      { ...record, plan: { ...record.plan, capabilities: ["company-cards"] } },
      "turn-1",
    ),
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
    { ...plan, capabilities: ["price-target"], companyQueries: ["600000.SH"] },
    "turn-1",
    3,
  );
  assert.equal(historical.readiness, "live");
  assert.deepEqual(historical.companyIds, ["600000.SH"]);
  const withoutCompany = await prepareBuild(
    { ...plan, capabilities: ["historical-analysis"] },
    "turn-1",
    4,
  );
  assert.equal(withoutCompany.readiness, "blocked");
  await assert.rejects(() => prepareBuild({ ...plan, capabilities: ["weather"] }, "turn-1", 1));
  // There is no synthetic company table: fixture plans are rejected outright.
  await assert.rejects(() => prepareBuild({ ...plan, mode: "fixture" }, "turn-1", 5), /live mode/);
  const bundle = sampleBundle(protocols[0]!.defaultSpec);
  assert.throws(() => validateScopedBundle(bundle, record));
  bundle.manifest.permissions = ["finance.calculate", "storage.read", "storage.write"];
  validateScopedBundle(bundle, record);

  process.env.TUSHARE_TOKEN = "";
  resetSseCompanyCache();
  const unavailable = await prepareBuild(plan, "turn-1", 1);
  assert.equal(unavailable.readiness, "blocked");
  assert(
    unavailable.blockers.some((blocker) =>
      blocker.includes("Live company lookup is unavailable: TUSHARE_TOKEN"),
    ),
  );
  process.env.TUSHARE_TOKEN = "test-token";
  globalThis.fetch = (async () => new Response(JSON.stringify(sample))) as typeof fetch;
  resetSseCompanyCache();
  const live = await managedCompanies();
  assert(live.available);
  const tickers = live.companies.map((company) => company.ticker);
  assert(tickers.includes("600000.SH"));
  assert(tickers.includes("689009.SH"));
  assert(!tickers.includes("900901.SH"), "B-shares are outside the SSE Class A scope");
  assert(!tickers.includes("000001.SZ"), "SZSE companies are outside the SSE Class A scope");
  assert(/sse-a:[0-9a-f]+:\d{8}/.test(live.version));
  const valid = await prepareBuild({ ...plan, companyQueries: ["600000.SH"] }, "turn-1", 1);
  assert.deepEqual(valid.companyIds, ["600000.SH"]);
  assert.equal(
    valid.readiness,
    "live",
    "A verified Tushare feed (company probe succeeded) opens live builds",
  );
  const byFullName = await prepareBuild(
    { ...plan, companyQueries: ["上海浦东发展银行股份有限公司"] },
    "turn-1",
    2,
  );
  assert.deepEqual(byFullName.companyIds, ["600000.SH"]);
  const outside = await prepareBuild({ ...plan, companyQueries: ["Apple"] }, "turn-1", 3);
  assert(outside.blockers.some((blocker) => blocker.includes("SSE Class A scope")));
  const duplicates = JSON.parse(JSON.stringify(sample)) as typeof sample;
  duplicates.data.items.push(duplicates.data.items[0]);
  assert.throws(() => parseStockBasic(duplicates), /duplicate tickers/);
  assert.throws(() => parseStockBasic({ code: 401, msg: "token check failed" }), /token check/);

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
} finally {
  if (previousToken === undefined) delete process.env.TUSHARE_TOKEN;
  else process.env.TUSHARE_TOKEN = previousToken;
  globalThis.fetch = originalFetch;
  resetSseCompanyCache();
}
console.log(
  "PASS dependency closure, unsupported capabilities, turn gating, live-only plans, labels/permissions, live SSE Class A identity and blockers",
);
