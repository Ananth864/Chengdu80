import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildRecord } from "../apps/web/src/lib/build-plan";
import { capabilityStarterV1Files } from "../apps/web/src/lib/capability-starter-v1";
import { importCompanyCsv } from "../apps/web/src/lib/company-table";
import type { AppBundle, Application, ProductSpec, Release } from "../apps/web/src/lib/contracts";
import {
  approvedPermissions,
  buildContextPath,
  buildContextSource,
  projectStarterBundle,
} from "../apps/web/src/lib/financial-starter";
import { legacyFinancialSdkSource } from "../apps/web/src/lib/legacy-financial-sdk";
import { riskFinancialSdkSource } from "../apps/web/src/lib/risk-financial-sdk";
import { legacyFinancialModulesSource } from "../apps/web/src/lib/legacy-financial-modules";
import { preAnalysisStarterSnapshot } from "../apps/web/src/lib/pre-analysis-starter-snapshot";
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
  discoveryIndustries,
  discoveryResultSchema,
} from "../apps/web/starter/project/src/lib/company-discovery";

const previousEnv = {
  CD80_LOCAL_MODE: process.env.CD80_LOCAL_MODE,
  CD80_DATA_DIR: process.env.CD80_DATA_DIR,
};
const dir = await mkdtemp(join(tmpdir(), "chengdu80-discovery-integration-"));
process.env.CD80_LOCAL_MODE = "1";
process.env.CD80_DATA_DIR = dir;
const access = { ownerId: "local-prototype-owner", accessToken: null };
const spec: ProductSpec = {
  name: "Company discovery integration fixture",
  purpose: "Discover manufacturing companies from a completed provisional risk questionnaire.",
  protocol: "screening",
  inputs: ["Completed risk questionnaire", "Normalized industry preference", "Saved company IDs"],
  outputs: ["Current discovery company", "Explicitly saved watchlist"],
  outputDetails: {
    "Current discovery company":
      "One matching SSE company from the supplied CSV; no live financial metrics or advice.",
    "Explicitly saved watchlist":
      "Unique canonical supplied-company IDs retained only after an explicit storage write.",
  },
  constraints: ["Server-wiring fixture only; no generated application execution"],
};
const riskInput = {
  questionnaire_version: "v0-demo",
  answers: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1 },
};
const completedRisk = {
  status: "completed",
  ...riskInput,
  total_score: 7,
  risk_profile_bucket: "low",
};
const input = {
  action: "start",
  risk_result: completedRisk,
  industry_preference: {
    selection_mode: "selected",
    selected_industries: ["manufacturing"],
    effective_industries: ["manufacturing"],
  },
};

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
  const record = await prepareBuild(
    {
      requirements: spec.purpose,
      capabilities: ["risk-industry-matching"],
      companyQueries: [],
      mode: "live",
      themeOverride: null,
    },
    "discovery-integration-turn",
    1,
  );
  assert.equal(record.readiness, "live");
  await assert.rejects(prepareBuild({ ...record.plan, mode: "fixture" }, "fixture-rejected", 1));
  assert.equal(record.moduleVersions["company-discovery"], "v1.3.0");
  assert.equal(record.moduleVersions["industry-preferences"], "v1.4.0");
  assert.deepEqual(record.moduleVersions, {
    companies: "company-capabilities-v1",
    starter: "financial-react-v4",
    "risk-profile": "v0-demo",
    "industry-preferences": "v1.4.0",
    "company-discovery": "v1.3.0",
  });
  const bundle = projectStarterBundle(spec);
  bundle.manifest.permissions = approvedPermissions(record, true);
  bundle.files[buildContextPath] = buildContextSource(record, spec.name);
  assert.ok(bundle.manifest.permissions.includes("finance.company-discovery.v1-3"));
  assert.ok(!bundle.manifest.permissions.includes("finance.company-discovery"));
  assert.ok(!bundle.manifest.permissions.includes("finance.match-companies"));
  assert.ok(!bundle.manifest.permissions.includes("finance.company-cards"));
  validateScopedBundle(bundle, record);
  const editable = structuredClone(bundle);
  editable.files["src/components/company-discovery.tsx"] += "\n// editable presentation";
  validateScopedBundle(editable, record);
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
  const rpc = (capability: string, value: unknown, releaseId = release.id) =>
    dispatch(access, { action: "rpc", appId: app.id, releaseId, capability, input: value });
  const persisted = () => readFile(join(dir, "apps.json"), "utf8");
  const beforeDiscovery = await persisted();
  assert.deepEqual(await rpc("finance.risk-profile", riskInput), completedRisk);
  await assert.rejects(rpc("finance.company-discovery", input), /permission/);
  const started = discoveryResultSchema.parse(await rpc("finance.company-discovery.v1-3", input));
  assert.equal(started.status, "ready");
  if (started.status !== "ready" || !("target_size_category" in started))
    throw new Error("Expected a creation-ready discovery result");
  assert.equal(started.target_size_category, "Large cap");
  assert.equal(started.current_company.size_category, "Large cap");
  assert.equal(started.current_company.industry, discoveryIndustries.manufacturing);
  assert.equal(Array.isArray(started.current_company), false);
  assert.equal("companies" in started, false);
  const csv = importCompanyCsv(
    await readFile(
      new URL("../apps/web/src/server/data/sse-a-universe.csv", import.meta.url),
      "utf8",
    ),
  );
  const eligible = csv.filter(
    (company) => company.industry === discoveryIndustries.manufacturing && company.size === "large",
  );
  assert.equal(started.eligible_company_count, eligible.length);
  assert.equal(started.total_rounds, Math.min(5, eligible.length));
  const currentId = `SSE:${started.current_company.ticker}`;
  assert.deepEqual(started.metric_request_company_ids, [currentId]);
  assert.deepEqual(started.session_state.exposed_company_ids, [currentId]);
  for (const choice of ["add", "skip"]) {
    const invalid = discoveryResultSchema.parse(
      await rpc("finance.company-discovery.v1-3", {
        action: "advance",
        session_state: started.session_state,
        company_id: currentId,
        choice,
      }),
    );
    assert.equal(invalid.status, "invalid_input", "Neutral advances must reject legacy choices");
    assert.equal("watchlist_add" in invalid, false);
    assert.equal(await persisted(), beforeDiscovery);
  }
  const excluded = discoveryResultSchema.parse(
    await rpc("finance.company-discovery.v1-3", {
      ...input,
      excluded_company_ids: [currentId],
    }),
  );
  assert.equal(excluded.status, "ready");
  if (excluded.status !== "ready" || !("eligible_company_count" in excluded))
    throw new Error("Expected remaining eligible companies");
  assert.equal(excluded.eligible_company_count, eligible.length - 1);
  assert(!excluded.ordered_company_ids.includes(currentId));
  assert.equal(await persisted(), beforeDiscovery, "App-owned exclusions must not persist");
  const original = eligible.find((company) => company.ticker === started.current_company.ticker);
  assert.ok(original, "The displayed company must come from the actual CSV");
  assert.deepEqual(started.current_company, {
    exchange: "SSE",
    ticker: original.ticker,
    name: original.name,
    industry: original.industry,
    market_cap_rmb: original.marketCapRmb,
    size_category: "Large cap",
  });
  assert.deepEqual((await findApp(access, app.id)).data, app.data);
  assert.equal(await persisted(), beforeDiscovery, "Starting must not persist the session");

  let state = started.session_state;
  const additions: string[] = [];
  for (let round = 0; round < started.total_rounds; round++) {
    const id = state.ordered_company_ids[state.round_index]!;
    const choice = round === 1 ? "add" : "skip";
    const advanced = discoveryResultSchema.parse(
      await rpc("finance.company-discovery.v1-3", {
        action: "advance",
        session_state: state,
        company_id: id,
      }),
    );
    assert.equal(
      advanced.status,
      round + 1 === started.total_rounds ? "session_completed" : "ready",
    );
    if (advanced.status !== "ready" && advanced.status !== "session_completed")
      throw new Error("Expected a discovery transition");
    assert.equal("watchlist_add" in advanced, false);
    if (choice === "add") additions.push(id); // The consuming app owns saved-company choices.
    state = advanced.session_state;
    assert.equal(state.round_index, round + 1);
    assert.deepEqual((await findApp(access, app.id)).data, app.data);
    assert.equal(
      await persisted(),
      beforeDiscovery,
      "Neutral advancement must not save automatically",
    );
  }
  assert.equal(additions.length, 1);
  assert.equal(await rpc("storage.read", { key: "discovery-watchlist" }), null);
  console.log(
    "PASS neutral dispatch returns one CSV company per round without choices, watchlist actions or persistence",
  );

  const oldSessionsRecord = structuredClone(record);
  oldSessionsRecord.moduleVersions.starter = "financial-react-v1";
  oldSessionsRecord.moduleVersions["company-discovery"] = "v2-sessions";
  oldSessionsRecord.moduleVersions["industry-preferences"] = "v1.3.0";
  for (const key of Object.keys(oldSessionsRecord.moduleVersions))
    if (key.startsWith("finance.")) delete oldSessionsRecord.moduleVersions[key];
  assert.deepEqual(oldSessionsRecord.moduleVersions, {
    companies: "company-capabilities-v1",
    starter: "financial-react-v1",
    "risk-profile": "v0-demo",
    "industry-preferences": "v1.3.0",
    "company-discovery": "v2-sessions",
  });
  const {
    hash: _oldHash,
    artifactHash: _oldArtifactHash,
    ...oldSessionsPayload
  } = oldSessionsRecord;
  oldSessionsRecord.hash = createHash("sha256")
    .update(
      JSON.stringify(oldSessionsPayload, (_key, value) =>
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
  requireBuild(oldSessionsRecord, oldSessionsRecord.turnId);
  const oldSessionsBundle = structuredClone(bundle);
  Object.assign(oldSessionsBundle.files, capabilityStarterV1Files);
  oldSessionsBundle.manifest.permissions = approvedPermissions(oldSessionsRecord, true);
  oldSessionsBundle.files[buildContextPath] = buildContextSource(oldSessionsRecord, spec.name);
  Object.assign(oldSessionsBundle.files, preAnalysisStarterSnapshot);
  oldSessionsBundle.files["src/components/company-discovery.tsx"] =
    preAnalysisDiscoveryComponentSource;
  delete oldSessionsBundle.files["src/lib/discovery-contract.ts"];
  delete oldSessionsBundle.files["src/lib/financial-results.ts"];
  delete oldSessionsBundle.files["src/components/financial-analysis.tsx"];
  validateScopedBundle(oldSessionsBundle, oldSessionsRecord);
  const oldSessionsRelease = await fixtureRelease(oldSessionsBundle, oldSessionsRecord);
  let historicalApp = await findApp(access, app.id);
  historicalApp.current = oldSessionsRelease;
  await saveApp(access, historicalApp, historicalApp.revision);
  const beforeHistorical = await persisted();
  const historicalStart = discoveryResultSchema.parse(
    await rpc("finance.company-discovery", { ...input, watchlist: [] }, oldSessionsRelease.id),
  );
  if (historicalStart.status !== "ready") throw new Error("Expected historical discovery session");
  for (const choice of ["skip", "add"] as const) {
    const advanced = discoveryResultSchema.parse(
      await rpc(
        "finance.company-discovery",
        {
          action: "advance",
          session_state: historicalStart.session_state,
          company_id: historicalStart.ordered_company_ids[0],
          choice,
        },
        oldSessionsRelease.id,
      ),
    );
    assert.equal(
      advanced.status,
      historicalStart.total_rounds === 1 ? "session_completed" : "ready",
    );
    if (choice === "add") {
      assert.ok("watchlist_add" in advanced);
      assert.deepEqual(advanced.watchlist_add, {
        exchange: "SSE",
        ticker: historicalStart.current_company.ticker,
      });
    } else assert.equal("watchlist_add" in advanced, false);
    assert.equal(
      await persisted(),
      beforeHistorical,
      "Historical choices must not save automatically",
    );
  }
  await assert.rejects(
    rpc("finance.company-discovery.v1-3", input, oldSessionsRelease.id),
    /permission/,
  );
  historicalApp = await findApp(access, app.id);
  historicalApp.current = release;
  await saveApp(access, historicalApp, historicalApp.revision);
  const beforeWrites = await persisted();
  console.log(
    "PASS explicitly pinned historical v2-sessions retains Add/Skip without neutral RPC permission",
  );

  const unknownId = Array.from(
    { length: 1000 },
    (_, index) => `SSE:689${String(index).padStart(3, "0")}`,
  ).find((id) => !csv.some((company) => `SSE:${company.ticker}` === id));
  assert.ok(unknownId, "Expected an unused but well-formed SSE identity");
  const invalidWrites = [
    null,
    {},
    "arbitrary",
    ["arbitrary"],
    [original.name],
    [original.ticker],
    [currentId.toLowerCase()],
    [currentId, currentId],
    [unknownId],
    [{ exchange: "SSE", ticker: original.ticker }],
  ];
  for (const value of invalidWrites) {
    await assert.rejects(rpc("storage.write", { key: "discovery-watchlist", value }));
    assert.equal(await persisted(), beforeWrites);
  }
  assert.deepEqual(await rpc("storage.write", { key: "discovery-watchlist", value: additions }), {
    saved: true,
  });
  assert.deepEqual(await rpc("storage.read", { key: "discovery-watchlist" }), additions);
  assert.deepEqual((await findApp(access, app.id)).data, {
    ...app.data,
    "discovery-watchlist": additions,
  });
  assert.deepEqual(JSON.parse(await persisted())[0].data["discovery-watchlist"], additions);
  const afterSave = await persisted();
  for (const value of invalidWrites) {
    await assert.rejects(rpc("storage.write", { key: "discovery-watchlist", value }));
    assert.equal(
      await persisted(),
      afterSave,
      "Rejected replacements must retain the saved watchlist",
    );
  }
  assert.equal(
    discoveryResultSchema.parse(await rpc("finance.company-discovery.v1-3", input, preview.id))
      .status,
    "ready",
  );
  await assert.rejects(
    rpc("storage.write", { key: "discovery-watchlist", value: additions }, preview.id),
    /Only the active verified release/,
  );
  assert.equal(await persisted(), afterSave);
  console.log(
    "PASS canonical unique watchlist storage survives the adapter and rejects invalid or preview writes",
  );

  const noPermissionBundle = structuredClone(bundle);
  noPermissionBundle.manifest.permissions = bundle.manifest.permissions.filter(
    (permission) => permission !== "finance.company-discovery.v1-3",
  );
  const noPermission = await fixtureRelease(noPermissionBundle, record);
  let latest = await findApp(access, app.id);
  latest.current = noPermission;
  await saveApp(access, latest, latest.revision);
  const beforeDenied = await persisted();
  await assert.rejects(rpc("finance.company-discovery.v1-3", input, noPermission.id), /permission/);
  await assert.rejects(
    rpc("storage.write", { key: "discovery-watchlist", value: additions }, noPermission.id),
    /Company discovery permission/,
  );
  assert.equal(await persisted(), beforeDenied);

  for (const [label, sdk] of [
    ["v1", legacyFinancialSdkSource],
    ["risk", riskFinancialSdkSource],
  ] as const) {
    const oldRecord = structuredClone(record);
    oldRecord.moduleVersions.starter = "financial-react-v1";
    for (const key of Object.keys(oldRecord.moduleVersions))
      if (key.startsWith("finance.")) delete oldRecord.moduleVersions[key];
    delete oldRecord.moduleVersions["company-discovery"];
    delete oldRecord.moduleVersions["industry-preferences"];
    if (label === "v1") delete oldRecord.moduleVersions["risk-profile"];
    assert.deepEqual(oldRecord.moduleVersions, {
      companies: "company-capabilities-v1",
      starter: "financial-react-v1",
      ...(label === "risk" ? { "risk-profile": "v0-demo" } : {}),
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
    assert.ok(oldRecord.resolvedCapabilities.includes("risk-industry-matching"));
    assert.ok(!approvedPermissions(oldRecord, true).includes("finance.company-discovery"));
    const oldBundle = structuredClone(bundle);
    Object.assign(oldBundle.files, capabilityStarterV1Files);
    oldBundle.manifest.permissions = approvedPermissions(oldRecord, true);
    oldBundle.files[buildContextPath] = buildContextSource(oldRecord, spec.name);
    oldBundle.files["src/lib/cd80.ts"] = sdk;
    oldBundle.files["src/components/financial-app.tsx"] = legacyFinancialModulesSource;
    delete oldBundle.files["src/lib/company-discovery.ts"];
    delete oldBundle.files["src/components/company-discovery.tsx"];
    delete oldBundle.files["src/lib/industry-preference.ts"];
    delete oldBundle.files["src/components/industry-preference.tsx"];
    delete oldBundle.files["src/lib/discovery-contract.ts"];
    delete oldBundle.files["src/lib/financial-results.ts"];
    delete oldBundle.files["src/components/financial-analysis.tsx"];
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
      await rpc("storage.read", { key: "discovery-watchlist" }, oldRelease.id),
      additions,
    );
    await assert.rejects(rpc("finance.company-discovery", input, oldRelease.id), /permission/);
    await assert.rejects(rpc("finance.company-discovery.v1-3", input, oldRelease.id), /permission/);
    await assert.rejects(
      rpc("storage.write", { key: "discovery-watchlist", value: additions }, oldRelease.id),
      /Company discovery permission/,
    );
    assert.equal(await persisted(), beforeLegacy);
    for (const path of ["src/lib/cd80.ts", "src/lib/risk-profile.ts"]) {
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
        rpc("storage.read", { key: "discovery-watchlist" }, changedRelease.id),
        /starter file unchanged/,
      );
      assert.equal(await persisted(), beforeMutation);
    }

    // Escalate only discovery permission for the risk SDK case: no risk escalation is involved.
    const escalatedBundle = structuredClone(bundle);
    Object.assign(escalatedBundle.files, capabilityStarterV1Files);
    escalatedBundle.manifest.permissions = [
      ...approvedPermissions(oldRecord, true),
      "finance.company-discovery",
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
      rpc("finance.company-discovery", input, escalated.id),
      /approved platform modules/,
    );
    await assert.rejects(
      rpc("storage.write", { key: "discovery-watchlist", value: additions }, escalated.id),
      /approved platform modules/,
    );
    assert.equal(await persisted(), beforeEscalation);
  }
  console.log(
    "PASS v1 and previous risk SDK records remain readable, reject mutations, and cannot gain discovery permission",
  );

  for (const path of [
    "src/lib/cd80.ts",
    "src/lib/company-discovery.ts",
    "src/lib/discovery-contract.ts",
    "src/lib/financial-results.ts",
  ]) {
    assert.equal(typeof bundle.files[path], "string", `Protected starter file is missing: ${path}`);
    const changed = structuredClone(bundle);
    changed.files[path] += "\n// mutated protected discovery source";
    assert.throws(() => validateScopedBundle(changed, record), /starter file unchanged/);
    const changedRelease = await fixtureRelease(changed, record);
    latest = await findApp(access, app.id);
    latest.current = changedRelease;
    await saveApp(access, latest, latest.revision);
    const beforeMutation = await persisted();
    await assert.rejects(
      rpc("finance.company-discovery.v1-3", input, changedRelease.id),
      /starter file unchanged/,
    );
    assert.equal(await persisted(), beforeMutation);
  }
  console.log(
    "PASS protected discovery files reject mutations even with matching source/artifact hashes",
  );
  console.log(
    "Company discovery dispatch/local-persistence integration checks passed; no app build or execution.",
  );
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
}
