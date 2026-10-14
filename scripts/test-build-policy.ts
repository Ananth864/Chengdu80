import { importCompanyCsv } from "../apps/web/src/lib/company-table";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
  requireBuild({ ...record, readiness: "fixture", provider: "tushare" } as never, "turn-1"),
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
const dir = await mkdtemp(join(tmpdir(), "cd80-company-test-"));
const previous = process.env.CD80_COMPANY_TABLE_PATH;
try {
  delete process.env.CD80_COMPANY_TABLE_PATH;
  const pending = await prepareBuild({ ...plan, mode: "live" }, "turn-1", 1);
  assert.equal(pending.readiness, "blocked");
  assert(pending.blockers.some((b) => b.includes("platform team")));
  const file = join(dir, "companies.json");
  process.env.CD80_COMPANY_TABLE_PATH = file;
  await writeFile(
    file,
    JSON.stringify([
      {
        name: "Test Company",
        ticker: "000001.SZ",
        industry: "Test",
        marketCapRmb: 100,
        size: "large",
      },
    ]),
  );
  const companies = await managedCompanies("live");
  assert.equal(companies.companies[0]!.ticker, "000001.SZ");
  const valid = await prepareBuild(
    { ...plan, mode: "live", companyQueries: ["000001.SZ"] },
    "turn-1",
    1,
  );
  assert.deepEqual(valid.companyIds, ["000001.SZ"]);
  assert.equal(
    valid.readiness,
    "blocked",
    "Company membership does not prove Wind or module readiness",
  );
  await writeFile(file, JSON.stringify([companies.companies[0], companies.companies[0]]));
  await assert.rejects(() => managedCompanies("live"));
} finally {
  if (previous === undefined) delete process.env.CD80_COMPANY_TABLE_PATH;
  else process.env.CD80_COMPANY_TABLE_PATH = previous;
  await rm(dir, { recursive: true, force: true });
}
console.log(
  "PASS dependency closure, unsupported capabilities, turn gating, labels/permissions, managed company identity, live blockers",
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
