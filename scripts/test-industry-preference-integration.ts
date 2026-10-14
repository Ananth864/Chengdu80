import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildRecord } from "../apps/web/src/lib/build-plan";
import { capabilityDefinitions } from "../apps/web/src/lib/capability-catalog";
import type { AppBundle, Application, ProductSpec, Release } from "../apps/web/src/lib/contracts";
import { discoveryStarterSnapshot } from "../apps/web/src/lib/discovery-starter-snapshot";
import {
  approvedPermissions,
  buildContextPath,
  buildContextSource,
  projectStarterBundle,
} from "../apps/web/src/lib/financial-starter";
import { legacyFinancialModulesSource } from "../apps/web/src/lib/legacy-financial-modules";
import { legacyFinancialSdkSource } from "../apps/web/src/lib/legacy-financial-sdk";
import { riskFinancialSdkSource } from "../apps/web/src/lib/risk-financial-sdk";
import { preAnalysisDiscoveryComponentSource } from "../apps/web/src/lib/pre-analysis-discovery-component";
import {
  prepareBuild,
  requireBuild,
  validateScopedBundle,
} from "../apps/web/src/server/build-policy";
import { dispatch } from "../apps/web/src/server/platform";
import { findApp, saveApp } from "../apps/web/src/server/repository";
import { sourceHash } from "../apps/web/src/server/runtime";
import {
  industryPreferenceResultSchema,
  supportedIndustries,
} from "../apps/web/starter/project/src/lib/industry-preference";

const previousEnv = {
  CD80_LOCAL_MODE: process.env.CD80_LOCAL_MODE,
  CD80_DATA_DIR: process.env.CD80_DATA_DIR,
};
const dir = await mkdtemp(join(tmpdir(), "chengdu80-industry-preference-integration-"));
process.env.CD80_LOCAL_MODE = "1";
process.env.CD80_DATA_DIR = dir;
const access = { ownerId: "local-prototype-owner", accessToken: null };
const spec: ProductSpec = {
  name: "Independent industry preference integration fixture",
  purpose: "Capture industry preferences and filter supplied company records by exact industry.",
  protocol: "screening",
  inputs: ["Selected industry IDs", "Supplied company records", "Exact industry labels"],
  outputs: ["Normalized industry preference", "Filtered supplied companies"],
  outputDetails: {
    "Normalized industry preference":
      "Five supported industry IDs normalized without a risk questionnaire; saved only explicitly.",
    "Filtered supplied companies":
      "Only supplied records matching exact labels, with no catalog lookup or risk filtering.",
  },
  constraints: ["Server-wiring fixture only; no generated application execution"],
};
const ids = [
  "manufacturing",
  "information_software_it",
  "utilities",
  "financial_services",
  "wholesale_retail",
];
const all = {
  selection_mode: "all_supported",
  selected_industries: [],
  effective_industries: ids,
};
const selected = {
  selection_mode: "selected",
  selected_industries: ["utilities", "manufacturing"],
  effective_industries: ["utilities", "manufacturing"],
};
const capture = { operation: "capture_preferences", selected_industries: [] };

// Matching hashes exercise server policy, not an application build or sandbox verification.
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
  assert.deepEqual(capabilityDefinitions["industry-preference"].dependencies, []);
  const record = await prepareBuild(
    {
      requirements: spec.purpose,
      capabilities: ["industry-preference"],
      companyQueries: [],
      mode: "fixture",
      themeOverride: null,
    },
    "industry-preference-integration-turn",
    1,
  );
  assert.equal(record.readiness, "fixture");
  assert.deepEqual(record.plan.capabilities, ["industry-preference"]);
  assert.deepEqual(record.resolvedCapabilities, ["industry-preference"]);
  assert.deepEqual(record.companyIds, []);
  assert.equal(record.moduleVersions["industry-preferences"], "v1.4.0");
  assert.equal(record.moduleVersions["risk-profile"], undefined);
  assert.equal(record.moduleVersions["company-discovery"], undefined);
  assert.deepEqual(record.moduleVersions, {
    companies: "company-capabilities-v1",
    starter: "financial-react-v1",
    "industry-preferences": "v1.4.0",
  });
  const bundle = projectStarterBundle(spec);
  bundle.manifest.permissions = approvedPermissions(record, true);
  bundle.files[buildContextPath] = buildContextSource(record, spec.name);
  assert.deepEqual(bundle.manifest.permissions, [
    "storage.read",
    "storage.write",
    "finance.industry-preferences",
  ]);
  validateScopedBundle(bundle, record);
  const release = await fixtureRelease(bundle, record);
  const preview = { ...structuredClone(release), id: crypto.randomUUID() };
  const app: Application = {
    id: crypto.randomUUID(),
    ownerId: access.ownerId,
    name: spec.name,
    spec,
    revision: 0,
    current: release,
    preview,
    data: { sentinel: { retained: true } },
    history: [],
    events: [],
    createdAt: record.createdAt,
  };
  await saveApp(access, app, null);
  const rpc = (capability: string, input: unknown, releaseId = release.id) =>
    dispatch(access, { action: "rpc", appId: app.id, releaseId, capability, input });
  const persisted = () => readFile(join(dir, "apps.json"), "utf8");
  const beforeCapture = await persisted();
  assert.deepEqual(
    supportedIndustries.map(({ id }) => id),
    ids,
  );
  for (const input of [
    undefined,
    null,
    {},
    { operation: "capture_preferences" },
    { ...capture, selected_industries: null },
    { ...capture, selected_industries: "manufacturing" },
    { ...capture, selected_industries: ["energy"] },
    { ...capture, selected_industries: ["Manufacturing"] },
    { ...capture, selected_industries: [" manufacturing"] },
    { ...capture, risk_result: {} },
  ]) {
    const result = industryPreferenceResultSchema.parse(
      await rpc("finance.industry-preferences", input),
    );
    assert.equal(result.status, "invalid_input");
    assert.deepEqual(Object.keys(result).sort(), ["error_code", "message", "status"]);
    assert.equal(await persisted(), beforeCapture);
  }
  for (const [selection, expected] of [
    [[], all],
    [["utilities", "manufacturing", "utilities", "manufacturing"], selected],
    [ids, { selection_mode: "selected", selected_industries: ids, effective_industries: ids }],
  ] as const) {
    const input = { ...capture, selected_industries: [...selection] };
    const original = structuredClone(input);
    assert.deepEqual(
      industryPreferenceResultSchema.parse(await rpc("finance.industry-preferences", input)),
      { status: "completed", industry_preference: expected },
    );
    assert.deepEqual(input, original);
    assert.equal(await persisted(), beforeCapture, "Capture must not save preferences");
  }
  assert.deepEqual((await findApp(access, app.id)).data, app.data);
  assert.equal(await rpc("storage.read", { key: "industry-preference" }), null);

  const companies = [
    ...supportedIndustries.map(({ csv_value }, index) => ({
      id: `provided-only-${index}`,
      industry: csv_value,
      size: "not-a-risk-size",
      extra: { retained: true, index },
    })),
    { id: "outside-supported-industries", industry: "provided-only-industry", extra: [1, 2] },
  ];
  const originalCompanies = structuredClone(companies);
  const repeated = [companies[2], companies[0], companies[2], companies[5]];
  for (const [records, labels, expected] of [
    [companies, [], companies],
    [[], [], []],
    [companies, [supportedIndustries[0].csv_value], [companies[0]]],
    [companies, ["provided-only-industry"], [companies[5]]],
    [companies, ["Manufacturing"], []],
    [companies, [`${supportedIndustries[0].csv_value} `], []],
    [companies, [supportedIndustries[0].csv_value.slice(0, -1)], []],
    [repeated, [supportedIndustries[2].csv_value], [companies[2], companies[2]]],
  ] as const) {
    assert.deepEqual(
      industryPreferenceResultSchema.parse(
        await rpc("finance.industry-preferences", {
          operation: "filter_companies",
          companies: records,
          industry_labels: labels,
        }),
      ),
      { status: "completed", companies: expected },
    );
    assert.equal(await persisted(), beforeCapture);
  }
  assert.deepEqual(companies, originalCompanies);
  for (const capability of [
    "finance.risk-profile",
    "finance.company-discovery",
    "finance.company-discovery.v1-3",
  ]) {
    await assert.rejects(rpc(capability, {}), /permission/);
    assert.equal(await persisted(), beforeCapture);
  }
  console.log("PASS independent capture and exact supplied-record filtering never mutate data");

  const invalidPreferences = [
    undefined,
    null,
    {},
    [],
    { status: "completed", industry_preference: all },
    { ...all, effective_industries: ids.slice(1) },
    { ...all, selected_industries: [ids[0]] },
    { ...all, effective_industries: [...ids, "energy"] },
    { ...all, effective_industries: [ids[0], ...ids.slice(0, 4)] },
    { selection_mode: "selected", selected_industries: [], effective_industries: [] },
    { ...selected, effective_industries: [...selected.effective_industries].reverse() },
    { ...selected, selected_industries: ["utilities", "utilities", "manufacturing"] },
    { ...selected, selected_industries: ["energy"], effective_industries: ["energy"] },
  ];
  for (const value of [all, selected]) {
    const beforeSave = await persisted();
    for (const invalid of invalidPreferences) {
      await assert.rejects(rpc("storage.write", { key: "industry-preference", value: invalid }));
      assert.equal(await persisted(), beforeSave, "Rejected writes must retain prior data");
    }
    assert.deepEqual(await rpc("storage.write", { key: "industry-preference", value }), {
      saved: true,
    });
    assert.deepEqual(await rpc("storage.read", { key: "industry-preference" }), value);
    assert.deepEqual((await findApp(access, app.id)).data, {
      ...app.data,
      "industry-preference": value,
    });
    assert.deepEqual(JSON.parse(await persisted())[0].data["industry-preference"], value);
  }
  const afterSave = await persisted();
  assert.deepEqual(await rpc("finance.industry-preferences", capture, preview.id), {
    status: "completed",
    industry_preference: all,
  });
  await assert.rejects(
    rpc("storage.write", { key: "industry-preference", value: all }, preview.id),
    /Only the active verified release/,
  );
  assert.equal(await persisted(), afterSave);

  const noPermissionBundle = structuredClone(bundle);
  noPermissionBundle.manifest.permissions = ["storage.read", "storage.write"];
  const noPermission = await fixtureRelease(noPermissionBundle, record);
  let latest = await findApp(access, app.id);
  latest.current = noPermission;
  await saveApp(access, latest, latest.revision);
  const beforeDenied = await persisted();
  await assert.rejects(rpc("finance.industry-preferences", capture, noPermission.id), /permission/);
  await assert.rejects(
    rpc("storage.write", { key: "industry-preference", value: all }, noPermission.id),
    /Industry preference permission/,
  );
  assert.equal(await persisted(), beforeDenied);
  console.log(
    "PASS validated preference storage rejects invalid, unpermissioned and preview writes",
  );

  // Historical matching plans included industry-preference through the old dependency graph.
  const historicalRecord = await prepareBuild(
    { ...record.plan, capabilities: ["risk-industry-matching"] },
    "historical-industry-preference-turn",
    1,
  );
  const discoverySdk = discoveryStarterSnapshot["src/lib/cd80.ts"];
  const discoveryModules = discoveryStarterSnapshot["src/components/financial-app.tsx"];
  assert.ok(typeof discoverySdk === "string", "Previous discovery SDK snapshot is required");
  assert.ok(typeof discoveryModules === "string", "Previous discovery UI snapshot is required");
  for (const [label, sdk] of [
    ["v1", legacyFinancialSdkSource],
    ["risk", riskFinancialSdkSource],
    ["discovery", discoverySdk],
  ] as const) {
    const oldRecord = structuredClone(historicalRecord);
    for (const key of Object.keys(oldRecord.moduleVersions))
      if (key.startsWith("finance.")) delete oldRecord.moduleVersions[key];
    delete oldRecord.moduleVersions["industry-preferences"];
    if (label === "discovery") oldRecord.moduleVersions["company-discovery"] = "v2-sessions";
    if (label !== "discovery") delete oldRecord.moduleVersions["company-discovery"];
    if (label === "v1") delete oldRecord.moduleVersions["risk-profile"];
    assert.deepEqual(oldRecord.moduleVersions, {
      companies: "company-capabilities-v1",
      starter: "financial-react-v1",
      ...(label !== "v1" ? { "risk-profile": "v0-demo" } : {}),
      ...(label === "discovery" ? { "company-discovery": "v2-sessions" } : {}),
    });
    const { hash: _hash, artifactHash: _artifactHash, ...payload } = oldRecord;
    oldRecord.hash = createHash("sha256")
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
    requireBuild(oldRecord, oldRecord.turnId);
    assert.ok(oldRecord.resolvedCapabilities.includes("industry-preference"));
    assert.ok(!approvedPermissions(oldRecord, true).includes("finance.industry-preferences"));
    const oldBundle = structuredClone(bundle);
    oldBundle.manifest.permissions = approvedPermissions(oldRecord, true);
    oldBundle.files[buildContextPath] = buildContextSource(oldRecord, spec.name);
    oldBundle.files["src/lib/cd80.ts"] = sdk;
    oldBundle.files["src/components/financial-app.tsx"] =
      label === "discovery" ? discoveryModules : legacyFinancialModulesSource;
    delete oldBundle.files["src/lib/discovery-contract.ts"];
    delete oldBundle.files["src/lib/financial-results.ts"];
    delete oldBundle.files["src/components/financial-analysis.tsx"];
    if (label === "discovery")
      oldBundle.files["src/components/company-discovery.tsx"] = preAnalysisDiscoveryComponentSource;
    delete oldBundle.files["src/lib/industry-preference.ts"];
    delete oldBundle.files["src/components/industry-preference.tsx"];
    if (label !== "discovery") {
      delete oldBundle.files["src/lib/company-discovery.ts"];
      delete oldBundle.files["src/components/company-discovery.tsx"];
    }
    if (label === "v1") {
      delete oldBundle.files["src/lib/risk-profile.ts"];
      delete oldBundle.files["src/components/risk-questionnaire.tsx"];
    }
    validateScopedBundle(oldBundle, oldRecord);
    const oldRelease = await fixtureRelease(oldBundle, oldRecord);
    latest = await findApp(access, app.id);
    latest.current = oldRelease;
    await saveApp(access, latest, latest.revision);
    const beforeLegacy = await persisted();
    assert.deepEqual(
      await rpc("storage.read", { key: "industry-preference" }, oldRelease.id),
      selected,
    );
    await assert.rejects(rpc("finance.industry-preferences", capture, oldRelease.id), /permission/);
    await assert.rejects(
      rpc("storage.write", { key: "industry-preference", value: all }, oldRelease.id),
      /Industry preference permission/,
    );
    assert.equal(await persisted(), beforeLegacy);
    for (const path of [
      "src/lib/cd80.ts",
      "src/components/financial-app.tsx",
      "src/lib/risk-profile.ts",
      "src/components/risk-questionnaire.tsx",
      "src/lib/company-discovery.ts",
      "src/components/company-discovery.tsx",
    ]) {
      if (oldBundle.files[path] === undefined) continue;
      const changed = structuredClone(oldBundle);
      changed.files[path] += "\n// mutated historical protected source";
      assert.throws(() => validateScopedBundle(changed, oldRecord), /starter file unchanged/);
      const changedRelease = await fixtureRelease(changed, oldRecord);
      latest = await findApp(access, app.id);
      latest.current = changedRelease;
      await saveApp(access, latest, latest.revision);
      const beforeMutation = await persisted();
      await assert.rejects(
        rpc("storage.read", { key: "industry-preference" }, changedRelease.id),
        /starter file unchanged/,
      );
      assert.equal(await persisted(), beforeMutation);
    }
    const escalatedBundle = structuredClone(bundle);
    escalatedBundle.manifest.permissions = [
      ...approvedPermissions(oldRecord, true),
      "finance.industry-preferences",
    ];
    escalatedBundle.files[buildContextPath] = buildContextSource(oldRecord, spec.name);
    assert.throws(
      () => validateScopedBundle(escalatedBundle, oldRecord),
      /approved platform modules/,
    );
    const escalated = await fixtureRelease(escalatedBundle, oldRecord);
    latest = await findApp(access, app.id);
    latest.current = escalated;
    await saveApp(access, latest, latest.revision);
    const beforeEscalation = await persisted();
    await assert.rejects(
      rpc("finance.industry-preferences", capture, escalated.id),
      /approved platform modules/,
    );
    await assert.rejects(
      rpc("storage.write", { key: "industry-preference", value: all }, escalated.id),
      /approved platform modules/,
    );
    assert.equal(await persisted(), beforeEscalation);
  }
  console.log(
    "PASS v1, risk and discovery snapshots remain readable without preference escalation",
  );

  for (const path of [
    "src/lib/cd80.ts",
    "src/components/financial-app.tsx",
    "src/lib/industry-preference.ts",
    "src/components/industry-preference.tsx",
  ]) {
    assert.equal(typeof bundle.files[path], "string", `Protected starter file is missing: ${path}`);
    const changed = structuredClone(bundle);
    changed.files[path] += "\n// mutated protected preference source";
    assert.throws(() => validateScopedBundle(changed, record), /starter file unchanged/);
    const changedRelease = await fixtureRelease(changed, record);
    latest = await findApp(access, app.id);
    latest.current = changedRelease;
    await saveApp(access, latest, latest.revision);
    const beforeMutation = await persisted();
    await assert.rejects(
      rpc("finance.industry-preferences", capture, changedRelease.id),
      /starter file unchanged/,
    );
    assert.equal(await persisted(), beforeMutation);
  }
  console.log(
    "PASS protected preference sources reject mutations with matching source/artifact hashes",
  );
  console.log(
    "Industry preference dispatch/local-persistence integration checks passed; no app build or execution.",
  );
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
}
