import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildRecord } from "../apps/web/src/lib/build-plan";
import { capabilityStarterV1Files } from "../apps/web/src/lib/capability-starter-v1";
import { capabilityCatalog, capabilityDefinitions } from "../apps/web/src/lib/capability-catalog";
import type { AppBundle, Application, ProductSpec, Release } from "../apps/web/src/lib/contracts";
import { discoveryStarterSnapshot } from "../apps/web/src/lib/discovery-starter-snapshot";
import {
  approvedPermissions,
  buildContextPath,
  buildContextSource,
  projectStarterBundle,
} from "../apps/web/src/lib/financial-starter";
import { legacyFinancialSdkSource } from "../apps/web/src/lib/legacy-financial-sdk";
import { preAnalysisStarterSnapshot } from "../apps/web/src/lib/pre-analysis-starter-snapshot";
import { riskFinancialSdkSource } from "../apps/web/src/lib/risk-financial-sdk";
import {
  prepareBuild,
  requireBuild,
  validateScopedBundle,
} from "../apps/web/src/server/build-policy";
import {
  suppliedCompanyUniverse,
  suppliedCompanyUniverseVersion,
} from "../apps/web/src/server/company-universe";
import type { historicalAnalysis } from "../apps/web/src/server/historical-analysis";
import type { industryResearch } from "../apps/web/src/server/industry-research";
import { dispatch } from "../apps/web/src/server/platform";
import type { summarizeBrokerageReports } from "../apps/web/src/server/price-target";
import { findApp, saveApp } from "../apps/web/src/server/repository";
import { sourceHash } from "../apps/web/src/server/runtime";
import type { TushareRow } from "../apps/web/src/server/tushare";
import { financialResultSchema } from "../apps/web/starter/project/src/lib/financial-results";

const previousEnv = {
  CD80_LOCAL_MODE: process.env.CD80_LOCAL_MODE,
  CD80_DATA_DIR: process.env.CD80_DATA_DIR,
  TUSHARE_TOKEN: process.env.TUSHARE_TOKEN,
};
const originalFetch = globalThis.fetch;
const dir = await mkdtemp(join(tmpdir(), "chengdu80-financial-integration-"));
process.env.CD80_LOCAL_MODE = "1";
process.env.CD80_DATA_DIR = dir;
process.env.TUSHARE_TOKEN = "integration-fixture-token-not-a-credential";
const access = { ownerId: "local-prototype-owner", accessToken: null };
const scopes = ["historical-analysis", "market-research", "price-target"];
const permissions = [
  "finance.historical-analysis",
  "finance.industry-research",
  "finance.price-target",
] as const;
const catalogIds = ["historical-analysis", "industry-research", "price-target"];
const spec: ProductSpec = {
  name: "Financial dispatch integration fixture",
  purpose:
    "Check authorized historical prices, historical industry revenue and sourced brokerage reports.",
  protocol: "screening",
  inputs: ["Canonical supplied SSE company", "Analysis date"],
  outputs: ["Historical prices", "Industry revenue", "Brokerage reports"],
  outputDetails: {
    "Historical prices":
      "Synthetic daily prices and adjustment factors test raw extremes and adjusted drawdown.",
    "Industry revenue":
      "Synthetic annual statements test bounded supplied-universe coverage, not national market size.",
    "Brokerage reports":
      "Synthetic original ratings remain unmapped without server-owned rating and horizon evidence.",
  },
  constraints: ["Server-wiring fixtures only; no generated application build or execution"],
};
const company = suppliedCompanyUniverse().find(({ ticker }) => ticker === "600000")!;
assert.ok(company);
const request = {
  company_id: company.ticker,
  exchange: "SSE",
  company_name: company.name,
  industry_label: company.industry,
  as_of_date: "2025-03-31",
  years: 2,
};
const plan = {
  requirements: spec.purpose,
  capabilities: scopes,
  companyQueries: ["600000"],
  mode: "live",
  themeOverride: null,
};
const calls: { endpoint: string; params: Record<string, string> }[] = [];
let allowFixtureTransport = false;
let fetchAttempts = 0;
const prices = [100, 60, 45, 55];
const dates = ["20250325", "20250326", "20250327", "20250328"];
// Keep Bun's fetch helper while replacing every network request with a strict spy.
globalThis.fetch = Object.assign(
  (async (url, init) => {
    fetchAttempts++;
    assert.ok(allowFixtureTransport, "Fixture/denied RPCs must not fetch");
    assert.equal(url, "https://api.tushare.pro");
    assert.equal(init?.method, "POST");
    assert.equal(typeof init?.body, "string");
    const { api_name: endpoint, params, fields, token } = JSON.parse(init?.body as string);
    assert.equal(token, process.env.TUSHARE_TOKEN);
    assert.ok(["daily", "adj_factor", "income", "report_rc"].includes(endpoint));
    assert.match(params.ts_code, /^\d{6}\.SH$/);
    assert.ok(params.start_date <= params.end_date);
    calls.push({ endpoint, params });
    let rows: TushareRow[];
    if (endpoint === "daily") {
      rows = dates.map((trade_date, index) => ({
        ts_code: params.ts_code,
        trade_date,
        close: prices[index]!,
        high: prices[index]! + 5,
        low: prices[index]! - 5,
        pre_close: null,
      }));
    } else if (endpoint === "adj_factor") {
      rows = dates.map((trade_date, index) => ({
        ts_code: params.ts_code,
        trade_date,
        adj_factor: index ? 2 : 1,
      }));
    } else if (endpoint === "income") {
      assert.ok(["1", "4", "5"].includes(params.report_type));
      assert.equal(fields, "ts_code,ann_date,f_ann_date,end_date,report_type,total_revenue");
      // The real endpoint supplies no monetary evidence; do not inject unrequested fields.
      rows =
        params.report_type === "1"
          ? [2023, 2024].map((year) => ({
              ts_code: params.ts_code,
              end_date: `${year}1231`,
              ann_date: `${year + 1}0301`,
              f_ann_date: `${year + 1}0301`,
              report_type: "1",
              total_revenue: year === 2023 ? 100 : 110,
            }))
          : [];
    } else {
      assert.equal(params.start_date, "20250101");
      assert.equal(params.end_date, "20250331");
      rows = [0, 1, 2].map((index) => ({
        ts_code: params.ts_code,
        org_name: `Unverified fixture broker ${index}`,
        author_name: "Fixture author",
        report_date: "20250328",
        report_title: `Synthetic report ${index}`,
        quarter: "2026Q4",
        rating: "unmapped-original-rating",
        min_price: 120 + index,
        max_price: 140 + index,
      }));
    }
    const columns: string[] = fields.split(",");
    return Response.json({
      code: 0,
      data: {
        fields: columns,
        items: rows.map((row) => columns.map((field) => row[field] ?? null)),
      },
    });
  }) as typeof fetch,
  { preconnect: originalFetch.preconnect },
);

function rehashRecord(record: BuildRecord) {
  const { hash: _hash, artifactHash: _artifactHash, ...payload } = record;
  record.hash = createHash("sha256")
    .update(
      JSON.stringify(payload, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, value[key]]),
            )
          : value,
      ),
    )
    .digest("hex");
  requireBuild(record, record.turnId);
}

// Matching hashes exercise dispatch policy, not a real build or sandbox verification.
async function fixtureRelease(bundle: AppBundle, record: BuildRecord): Promise<Release> {
  const hash = await sourceHash(bundle);
  return {
    id: crypto.randomUUID(),
    spec,
    bundle,
    buildRecord: { ...record, artifactHash: hash },
    verification: { passed: true, checks: [], checkedAt: record.createdAt, sourceHash: hash },
    createdAt: record.createdAt,
    origin: "model",
    notes: "Constructed server-wiring fixture; no application executed",
  };
}

try {
  const expectedCatalog = [
    "risk-profile",
    "industry-preferences",
    "company-discovery",
    ...catalogIds,
  ];
  assert.deepEqual(
    capabilityCatalog.capabilities.map(({ id }) => id).sort(),
    expectedCatalog.sort(),
  );
  assert.deepEqual(
    [
      ...new Set(
        Object.values(capabilityDefinitions).flatMap(({ relatedCatalogIds }) => relatedCatalogIds),
      ),
    ].sort(),
    expectedCatalog,
  );
  for (const entry of capabilityCatalog.capabilities) {
    assert.equal(entry.implementation_status, "implemented_demo_contract");
    assert.ok(entry.implementation.length > 0);
  }
  for (const [index, scope] of scopes.entries()) {
    assert.deepEqual(
      capabilityDefinitions[scope as keyof typeof capabilityDefinitions].dependencies,
      [],
    );
    assert.deepEqual(
      capabilityDefinitions[scope as keyof typeof capabilityDefinitions].relatedCatalogIds,
      [catalogIds[index]],
    );
  }
  const liveRecord = await prepareBuild(plan, "financial-integration-live", 1);
  assert.equal(liveRecord.readiness, "live");
  assert.equal(liveRecord.moduleVersions.starter, "financial-react-v4");
  await assert.rejects(prepareBuild({ ...plan, mode: "fixture" }, "fixture-rejected", 1));
  // Reconstruct a persisted historical fixture, never a newly prepared fixture plan.
  const record: BuildRecord = structuredClone(liveRecord);
  record.plan.mode = "fixture";
  record.readiness = "fixture";
  record.moduleVersions.starter = "financial-react-v1";
  rehashRecord(record);
  assert.equal(record.readiness, "fixture");
  assert.deepEqual(record.blockers, []);
  assert.deepEqual(record.resolvedCapabilities, [...scopes].sort());
  assert.deepEqual(record.companyIds, ["600000.SH"]);
  assert.equal(record.companyTableVersion, suppliedCompanyUniverseVersion);
  assert.equal(fetchAttempts, 0, "Canonical preparation must not call Tushare");
  for (const [index, permission] of permissions.entries()) {
    assert.equal(
      record.moduleVersions[permission],
      capabilityCatalog.capabilities.find(({ id }) => id === catalogIds[index])!.contract_version,
    );
  }
  const all = await prepareBuild(
    { ...plan, capabilities: [...scopes, "risk-industry-matching"] },
    "all-six-live",
    1,
  );
  assert.equal(all.readiness, "live");
  assert.deepEqual(
    approvedPermissions(all, true).sort(),
    [
      "storage.read",
      "storage.write",
      "finance.risk-profile",
      "finance.industry-preferences",
      "finance.company-discovery.v1-3",
      ...permissions,
    ].sort(),
  );
  assert.equal(all.moduleVersions["risk-profile"], "v0-demo");
  assert.equal(all.moduleVersions["industry-preferences"], "v1.4.0");
  assert.equal(all.moduleVersions["company-discovery"], "v1.3.0");
  await assert.rejects(prepareBuild({ ...plan, capabilities: ["news"] }, "news-blocked", 1));
  assert.deepEqual(capabilityDefinitions.news.relatedCatalogIds, []);
  assert.equal(fetchAttempts, 0);

  const bundle = projectStarterBundle(spec);
  Object.assign(bundle.files, capabilityStarterV1Files);
  bundle.manifest.permissions = approvedPermissions(record, true);
  bundle.files[buildContextPath] = buildContextSource(record, spec.name);
  assert.deepEqual(bundle.manifest.permissions, ["storage.read", "storage.write", ...permissions]);
  validateScopedBundle(bundle, record);
  const release = await fixtureRelease(bundle, record);
  const app: Application = {
    id: crypto.randomUUID(),
    ownerId: access.ownerId,
    name: spec.name,
    spec,
    revision: 0,
    current: release,
    preview: null,
    data: { sentinel: { retained: true } },
    history: [],
    events: [],
    createdAt: record.createdAt,
  };
  await saveApp(access, app, null);
  const rpc = (capability: string, input: unknown = request, releaseId = release.id) =>
    dispatch(access, { action: "rpc", appId: app.id, releaseId, capability, input });
  const persisted = () => readFile(join(dir, "apps.json"), "utf8");
  const install = async (next: Release) => {
    const latest = await findApp(access, app.id);
    latest.current = next;
    await saveApp(access, latest, latest.revision);
    return persisted();
  };
  const before = await persisted();
  for (const [index, permission] of permissions.entries()) {
    const result = financialResultSchema.parse(await rpc(permission));
    assert.equal(result.capability_id, catalogIds[index]);
    assert.equal(result.status, "unavailable");
    assert.equal(result.mode, "fixture");
    assert.match(result.data_limitations.join(" "), /fixture/i);
    assert.equal(await persisted(), before);
    assert.equal(fetchAttempts, 0);
  }
  console.log(
    "PASS all six catalog/registry contracts align; new fixture plans rejected; historical fixture RPCs never fetch or mutate data; news blocked",
  );

  assert.equal(liveRecord.readiness, "live");
  assert.deepEqual(liveRecord.companyIds, ["600000.SH"]);
  assert.equal(fetchAttempts, 0, "Live preparation uses canonical CSV, not Tushare");
  const liveBundle = projectStarterBundle(spec);
  liveBundle.manifest.permissions = approvedPermissions(liveRecord, true);
  liveBundle.files[buildContextPath] = buildContextSource(liveRecord, spec.name);
  validateScopedBundle(liveBundle, liveRecord);
  const editable = structuredClone(liveBundle);
  for (const path of ["src/components/financial-app.tsx", "src/components/financial-analysis.tsx"])
    editable.files[path] += "\n// editable presentation";
  validateScopedBundle(editable, liveRecord);
  const liveRelease = await fixtureRelease(liveBundle, liveRecord);
  const liveBefore = await install(liveRelease);
  for (const patch of [
    { company_id: "000000" },
    { company_id: "600000.SH" },
    {
      company_id: suppliedCompanyUniverse().find(({ ticker }) => ticker !== company.ticker)!.ticker,
    },
    { company_name: "Wrong canonical name" },
    { industry_label: "Wrong exact industry" },
    { exchange: "SZSE" },
  ]) {
    for (const permission of permissions) {
      if (permission === "finance.price-target") {
        await assert.rejects(
          rpc(permission, { ...request, ...patch }, liveRelease.id),
          /canonical|pinned|SSE|Invalid|invalid/,
        );
      } else {
        const result = financialResultSchema.parse(
          await rpc(permission, { ...request, ...patch }, liveRelease.id),
        );
        assert.ok(["invalid_input", "unavailable"].includes(result.status));
        assert.match(
          result.data_limitations.join(" "),
          /match|supplied|pinned|permitted|Invalid|invalid|SSE/,
        );
      }
      assert.equal(fetchAttempts, 0, "Rejected identities must not retrieve data");
      assert.equal(await persisted(), liveBefore);
    }
  }
  allowFixtureTransport = true;
  const history = (await rpc(
    permissions[0],
    { ...request, period: "1m" },
    liveRelease.id,
  )) as Awaited<ReturnType<typeof historicalAnalysis>>;
  financialResultSchema.parse(history);
  assert.ok(["available", "partial"].includes(history.status));
  assert.equal(history.metrics.current_price!.value, 55);
  assert.equal(history.metrics["52_week_high"]!.value, 105);
  assert.equal(history.metrics["52_week_low"]!.value, 40);
  assert.equal(history.metrics.available_period_high!.value, 105);
  assert.equal(history.metrics.available_period_low!.value, 40);
  assert.equal(history.metrics.max_drawdown!.value, -0.25);
  assert.equal(history.metrics.max_drawdown!.unit, "fraction");
  assert.deepEqual(
    history.price_series.map(({ close }) => close),
    prices,
  );
  assert.match(history.price_basis, /raw.*end-of-day/);
  assert.equal(await persisted(), liveBefore);

  const incomeStart = calls.length;
  const industry = (await rpc(permissions[1], request, liveRelease.id)) as Awaited<
    ReturnType<typeof industryResearch>
  >;
  financialResultSchema.parse(industry);
  assert.equal(industry.status, "unavailable");
  const peers = suppliedCompanyUniverse().filter(({ industry }) => industry === company.industry);
  assert.equal(industry.total_universe_count, peers.length);
  assert.equal(industry.queried_company_count, Math.min(26, peers.length));
  assert.equal(industry.unqueried_company_count, peers.length - industry.queried_company_count);
  const incomeCalls = calls.slice(incomeStart);
  assert.ok(incomeCalls.length > 0 && incomeCalls.length <= 80);
  assert.equal(incomeCalls.length, industry.queried_company_count * 3);
  assert.ok(
    incomeCalls.every(
      ({ endpoint, params }) =>
        endpoint === "income" && peers.some(({ ticker }) => `${ticker}.SH` === params.ts_code),
    ),
  );
  assert.deepEqual([...new Set(incomeCalls.map(({ params }) => params.report_type!))].sort(), [
    "1",
    "4",
    "5",
  ]);
  const queriedIds = new Set(incomeCalls.map(({ params }) => params.ts_code!.slice(0, 6)));
  assert.equal(industry.annual_revenue_totals.length, 2);
  assert.equal(industry.section_statuses.annual_revenue_totals, "unavailable");
  for (const annual of industry.annual_revenue_totals) {
    assert.equal(annual.status, "unavailable");
    assert.equal(
      annual.value,
      null,
      "Missing monetary evidence must not become default CNY revenue",
    );
    assert.equal(annual.included_company_count, 0);
    assert.deepEqual(annual.included_company_ids, []);
    assert.deepEqual(annual.sources, []);
    assert.equal(annual.coverage, 0);
    const unsupported = annual.exclusions.filter(({ company_id }) => queriedIds.has(company_id));
    assert.equal(unsupported.length, industry.queried_company_count);
    assert.ok(unsupported.every(({ reasons }) => reasons.includes("unverified_currency_units")));
  }
  assert.equal(industry.matched_cohort_yoy_growth.length, 1);
  for (const growth of industry.matched_cohort_yoy_growth) {
    assert.equal(growth.value, null);
    assert.equal(growth.status, "insufficient_data");
    assert.equal(growth.matched_company_count, 0);
    assert.equal(growth.preceding_cohort_revenue, null);
    assert.equal(growth.current_cohort_revenue, null);
    assert.deepEqual(growth.sources, []);
  }
  assert.match(industry.data_limitations.join(" "), /unverified_currency_units/);
  assert.equal(await persisted(), liveBefore);

  const target = (await rpc(permissions[2], request, liveRelease.id)) as ReturnType<
    typeof summarizeBrokerageReports
  >;
  financialResultSchema.parse(target);
  assert.deepEqual(
    target.selected_reports,
    [],
    "Unverified brokerage identities must not become eligible reports",
  );
  assert.equal(target.rating_summary.mapped_brokerage_count, 0);
  assert.equal(target.rating_summary.category, null);
  assert.ok(Object.values(target.rating_summary.counts).every((count) => count === 0));
  assert.deepEqual(target.target_groups, []);
  assert.equal(target.exclusions.length, 3);
  assert.ok(target.exclusions.every(({ reason }) => reason === "unresolved_brokerage_identity"));
  assert.match(target.limitations.join(" "), /No default translation or quarter-derived horizon/);
  assert.deepEqual([...new Set(calls.map(({ endpoint }) => endpoint))].sort(), [
    "adj_factor",
    "daily",
    "income",
    "report_rc",
  ]);
  assert.equal(await persisted(), liveBefore);
  console.log(
    "PASS synthetic four-endpoint live-mode dispatch preserves raw extremes and adjusted -0.25 drawdown; bounded income retrieval without monetary evidence stays unavailable/null; unverified brokers produce no mapped ratings or invented targets",
  );

  allowFixtureTransport = false;
  const priorFetches = fetchAttempts;
  for (const permission of permissions) {
    const deniedBundle = structuredClone(bundle);
    deniedBundle.manifest.permissions = deniedBundle.manifest.permissions.filter(
      (id) => id !== permission,
    );
    const denied = await fixtureRelease(deniedBundle, record);
    const deniedBefore = await install(denied);
    await assert.rejects(rpc(permission, request, denied.id), /permission/);
    assert.equal(await persisted(), deniedBefore);
  }
  const oldRecord = structuredClone(record);
  for (const permission of permissions) delete oldRecord.moduleVersions[permission];
  rehashRecord(oldRecord);
  assert.deepEqual(approvedPermissions(oldRecord, true), ["storage.read", "storage.write"]);
  const oldBundle = structuredClone(bundle);
  oldBundle.manifest.permissions = approvedPermissions(oldRecord, true);
  oldBundle.files[buildContextPath] = buildContextSource(oldRecord, spec.name);
  validateScopedBundle(oldBundle, oldRecord);
  const oldRelease = await fixtureRelease(oldBundle, oldRecord);
  const oldBefore = await install(oldRelease);
  assert.deepEqual(
    await rpc("storage.read", { key: "sentinel" }, oldRelease.id),
    app.data.sentinel,
  );
  for (const permission of permissions) {
    await assert.rejects(rpc(permission, request, oldRelease.id), /permission/);
    const escalatedBundle = structuredClone(oldBundle);
    escalatedBundle.manifest.permissions.push(permission);
    assert.throws(
      () => validateScopedBundle(escalatedBundle, oldRecord),
      /approved platform modules/,
    );
    const escalated = await fixtureRelease(escalatedBundle, oldRecord);
    const escalationBefore = await install(escalated);
    await assert.rejects(rpc(permission, request, escalated.id), /approved platform modules/);
    assert.equal(await persisted(), escalationBefore);
    await install(oldRelease);
  }
  assert.deepEqual((await findApp(access, app.id)).data, app.data);
  assert.equal(JSON.parse(oldBefore)[0].data.sentinel.retained, true);

  for (const [label, sdk] of [
    ["legacy", legacyFinancialSdkSource],
    ["risk", riskFinancialSdkSource],
    ["discovery", discoveryStarterSnapshot["src/lib/cd80.ts"]],
    ["pre-analysis", preAnalysisStarterSnapshot["src/lib/cd80.ts"]],
  ] as const) {
    assert.equal(typeof sdk, "string", `Missing ${label} SDK snapshot`);
    for (const permission of permissions) {
      for (const pinned of [true, false]) {
        const replaced = structuredClone(pinned ? bundle : oldBundle);
        const replacedRecord = pinned ? record : oldRecord;
        replaced.files["src/lib/cd80.ts"] = sdk!;
        replaced.manifest.permissions = ["storage.read", "storage.write", permission];
        assert.throws(
          () => validateScopedBundle(replaced, replacedRecord),
          /starter file unchanged: src\/lib\/cd80.ts/,
          `${label} SDK must not bypass current financial protection (pinned=${pinned})`,
        );
        const replacedRelease = await fixtureRelease(replaced, replacedRecord);
        const replacedBefore = await install(replacedRelease);
        await assert.rejects(
          rpc(permission, request, replacedRelease.id),
          /starter file unchanged: src\/lib\/cd80.ts/,
        );
        assert.equal(await persisted(), replacedBefore);
      }
    }
  }

  for (const path of [
    "src/lib/cd80.ts",
    "src/lib/financial-results.ts",
    "package.json",
    "vite.config.ts",
  ]) {
    assert.equal(typeof liveBundle.files[path], "string", `Missing protected source: ${path}`);
    const changed = structuredClone(liveBundle);
    changed.files[path] += "\n// mutated protected financial source";
    assert.throws(() => validateScopedBundle(changed, liveRecord), /starter file unchanged/);
    const changedRelease = await fixtureRelease(changed, liveRecord);
    const mutationBefore = await install(changedRelease);
    for (const permission of permissions) {
      await assert.rejects(rpc(permission, request, changedRelease.id), /starter file unchanged/);
      assert.equal(await persisted(), mutationBefore);
    }
  }
  assert.equal(
    fetchAttempts,
    priorFetches,
    "Permission and protected-source failures must not fetch",
  );
  assert.deepEqual((await findApp(access, app.id)).data, app.data);
  console.log(
    "PASS missing permissions, rehashed unpinned records, all four historical SDK replacements and rehashed protected-source mutations cannot escalate or mutate data",
  );
  console.log(
    "Financial capability dispatch/local-persistence integration passed; synthetic transport only, no live retrieval or generated app execution.",
  );
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
}
