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
import { capabilityCatalog, capabilityDefinitions } from "../apps/web/src/lib/capability-catalog";
import type { BusinessCapability } from "../apps/web/src/lib/capability-catalog";
import { approvedPermissions } from "../apps/web/src/lib/financial-starter";
import { buildPlanSchema } from "../apps/web/src/lib/build-plan";
const plan = {
  requirements: "An industry research demo",
  capabilities: ["market-research"],
  companyQueries: ["600000.SH"],
  mode: "fixture",
  themeOverride: null,
};
const record = await prepareBuild(plan, "turn-1", 1);
const { themeOverride: _defaultTheme, ...withoutTheme } = plan;
assert.deepEqual(buildPlanSchema.parse(withoutTheme), buildPlanSchema.parse(plan));
assert.equal(buildPlanSchema.parse({ ...plan, themeOverride: undefined }).themeOverride, null);
assert.equal(
  buildPlanSchema.parse({ ...plan, themeOverride: "Warm terracotta" }).themeOverride,
  "Warm terracotta",
);
for (const invalidTheme of ["", " ", 1, false, {}])
  assert.equal(buildPlanSchema.safeParse({ ...plan, themeOverride: invalidTheme }).success, false);
const noThemeRecord = await prepareBuild(withoutTheme, "no-theme", 1);
assert.equal(noThemeRecord.theme, "starter-default");
requireBuild(noThemeRecord, "no-theme");
assert(agentProtocols["financial-expert"].includes("# Financial Expert Agent"));
assert(agentProtocols["financial-expert"].includes("read_financial_skill"));
assert.equal(Object.keys(financialSkills).length, 8);
const chatbotSkill = readFinancialSkill("database-grounded-chatbot").content;
const dashboardSkill = readFinancialSkill("general-dashboard-generation").content;
assert(dashboardSkill.includes('contract-version: "1.2.0"'));
assert(dashboardSkill.includes("composition skill, not a capability-library entry"));
assert(dashboardSkill.includes("[Investment dashboard metrics](investment-dashboard-metrics.md)"));
assert(!dashboardSkill.includes("dashboard-financial-data.md"));
assert(dashboardSkill.includes("outputDetails"));
assert(dashboardSkill.includes("RiskQuestionnaire"));
assert(dashboardSkill.includes("storage.read"));
assert(chatbotSkill.includes("component-id: grounded-chatbot"));
assert(chatbotSkill.includes("not a registered financial capability"));
assert(
  agentProtocols["capability-catalog"].includes(
    "removed grounded-chatbot catalog entry does not prohibit",
  ),
);
assert(chatbotSkill.includes("convex database within the application is the sole factual source"));
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
assert.equal(capabilityCatalog.version, "1.9.0");
assert.equal(capabilityCatalog.capabilities.length, 6);
for (const capability of [
  "risk-assessment",
  "industry-preference",
  "historical-analysis",
  "price-target",
  "market-research",
] satisfies BusinessCapability[]) {
  assert.deepEqual(capabilityDefinitions[capability].dependencies, []);
  assert.deepEqual(resolveCapabilities([capability]), [capability]);
}
await assert.rejects(prepareBuild({ ...plan, capabilities: ["news"] }, "turn-1", 1));
assert.equal(
  buildPlanSchema.safeParse({ ...plan, capabilities: ["market-research", "news"] }).success,
  false,
);
assert.deepEqual(resolveCapabilities(["company-cards"]), [
  "company-cards",
  "industry-preference",
  "risk-assessment",
  "risk-industry-matching",
]);
assert.deepEqual(capabilityDefinitions["company-cards"].dependencies, ["risk-industry-matching"]);
assert.deepEqual(resolveCapabilities(["risk-industry-matching"]), [
  "industry-preference",
  "risk-assessment",
  "risk-industry-matching",
]);
for (const [capability, permission] of [
  ["historical-analysis", "finance.historical-analysis"],
  ["price-target", "finance.price-target"],
  ["market-research", "finance.industry-research"],
] as const) {
  const independent = await prepareBuild({ ...plan, capabilities: [capability] }, "turn-1", 1);
  requireBuild(independent, "turn-1");
  assert.deepEqual(independent.companyIds, ["600000.SH"]);
  assert.deepEqual(independent.resolvedCapabilities, [capability]);
  assert.deepEqual(independent.moduleVersions, {
    companies: "company-capabilities-v1",
    starter: "financial-react-v1",
    [permission]: "1.2.0",
  });
  assert.deepEqual(approvedPermissions(independent, true), [
    "storage.read",
    "storage.write",
    permission,
  ]);
  for (const companyQueries of [[], ["DEMO001"]]) {
    const blocked = await prepareBuild(
      { ...plan, capabilities: [capability], companyQueries },
      "turn-1",
      1,
    );
    assert.equal(blocked.readiness, "blocked");
    assert.throws(() => requireBuild(blocked, "turn-1"));
  }
}
const unknown = await prepareBuild({ ...plan, companyQueries: ["Apple"] }, "turn-1", 2);
assert.equal(unknown.readiness, "blocked");
assert.throws(() => requireBuild(unknown, "turn-1"));
const historical = await prepareBuild(
  { ...plan, capabilities: ["price-target"], companyQueries: ["600000.SH"] },
  "turn-1",
  3,
);
assert.equal(historical.readiness, "fixture");
assert.deepEqual(historical.companyIds, ["600000.SH"]);
assert.deepEqual(historical.resolvedCapabilities, ["price-target"]);
assert.equal(historical.moduleVersions["finance.price-target"], "1.2.0");
assert.equal(historical.moduleVersions["finance.historical-analysis"], undefined);
assert.deepEqual(approvedPermissions(historical, true), [
  "storage.read",
  "storage.write",
  "finance.price-target",
]);
assert.equal(record.moduleVersions["finance.industry-research"], "1.2.0");
assert.deepEqual(approvedPermissions(record, true), [
  "storage.read",
  "storage.write",
  "finance.industry-research",
]);
const withoutCompany = await prepareBuild(
  { ...plan, capabilities: ["historical-analysis"], companyQueries: [] },
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
  const unconfigured = await prepareBuild({ ...plan, mode: "live" }, "turn-1", 1);
  assert.equal(unconfigured.readiness, "live", "CSV identity preparation needs no provider token");
  assert.deepEqual(unconfigured.companyIds, ["600000.SH"]);
  assert.deepEqual(unconfigured.blockers, []);
  requireBuild(unconfigured, "turn-1");
  const unavailable = await managedCompanies("live");
  assert.equal(unavailable.available, false);
  if (unavailable.available) throw new Error("Expected unconfigured server lookup");
  assert.match(unavailable.reason, /TUSHARE_TOKEN/);
  process.env.TUSHARE_TOKEN = "test-token";
  globalThis.fetch = Object.assign(async () => new Response(JSON.stringify(sample)), {
    preconnect: originalFetch.preconnect,
  }) satisfies typeof fetch;
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
    "Prepared live readiness pins supplied-CSV identity, not financial adapter coverage",
  );
  requireBuild(valid, "turn-1");
  validateScopedBundle(bundle, valid);
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
  { ...plan, capabilities: ["company-cards"], companyQueries: [], cardMetrics: ["ps"] },
  "cards-turn",
  1,
);
bundle.manifest.permissions = ["finance.company-cards", "finance.match-companies"];
validateScopedBundle(bundle, cardRecord);
assert.throws(() => validateScopedBundle(bundle, record));
assert.equal(cardRecord.moduleVersions.companies, "company-capabilities-v1");
assert.equal(cardRecord.moduleVersions["company-discovery"], "v1.3.0");
assert.equal(cardRecord.moduleVersions["industry-preferences"], "v1.4.0");
assert(approvedPermissions(cardRecord, true).includes("finance.company-discovery.v1-3"));
assert(!approvedPermissions(cardRecord, true).includes("finance.company-discovery"));
assert.deepEqual(cardRecord.plan.cardMetrics, ["ps"]);
console.log(
  "PASS platform module permissions follow selected capabilities and pin versions/metrics",
);
