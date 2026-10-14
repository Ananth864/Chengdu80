import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildRecord } from "../apps/web/src/lib/build-plan";
import { capabilityStarterV1Files } from "../apps/web/src/lib/capability-starter-v1";
import type { AppBundle, Application, ProductSpec, Release } from "../apps/web/src/lib/contracts";
import {
  approvedPermissions,
  buildContextPath,
  buildContextSource,
  projectStarterBundle,
} from "../apps/web/src/lib/financial-starter";
import { legacyFinancialSdkSource } from "../apps/web/src/lib/legacy-financial-sdk";
import { legacyFinancialModulesSource } from "../apps/web/src/lib/legacy-financial-modules";
import {
  prepareBuild,
  requireBuild,
  validateScopedBundle,
} from "../apps/web/src/server/build-policy";
import { dispatch } from "../apps/web/src/server/platform";
import { findApp, saveApp } from "../apps/web/src/server/repository";
import { sourceHash } from "../apps/web/src/server/runtime";

const previousEnv = {
  CD80_LOCAL_MODE: process.env.CD80_LOCAL_MODE,
  CD80_DATA_DIR: process.env.CD80_DATA_DIR,
};
const dir = await mkdtemp(join(tmpdir(), "chengdu80-risk-integration-"));
process.env.CD80_LOCAL_MODE = "1";
process.env.CD80_DATA_DIR = dir;
const access = { ownerId: "local-prototype-owner", accessToken: null };
const spec: ProductSpec = {
  name: "Risk questionnaire integration fixture",
  purpose: "Complete and retain a provisional seven-question risk profile.",
  protocol: "screening",
  inputs: ["Seven questionnaire answers"],
  outputs: ["Questionnaire completion"],
  outputDetails: {
    "Questionnaire completion": "A validated v0-demo completion, not investment advice.",
  },
  constraints: ["Synthetic wiring fixture only; no generated application execution"],
};
const input = {
  questionnaire_version: "v0-demo",
  answers: { q1: 3, q2: 2, q3: 3, q4: 2, q5: 1, q6: 2, q7: 2 },
};
const completed = {
  status: "completed",
  ...input,
  total_score: 15,
  risk_profile_bucket: "medium",
};
const invalidResult = {
  status: "invalid_input",
  error_code: "INVALID_INPUT",
  message: "Provide all seven answers as integers from 1 to 3 using questionnaire version v0-demo.",
};

// This is a server-wiring fixture, not evidence of an application build or sandbox verification.
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
      capabilities: ["risk-assessment", "company-cards"],
      companyQueries: [],
      mode: "live",
      themeOverride: null,
    },
    "risk-integration-turn",
    1,
  );
  assert.equal(record.readiness, "live");
  await assert.rejects(prepareBuild({ ...record.plan, mode: "fixture" }, "fixture-rejected", 1));
  assert.equal(record.moduleVersions["risk-profile"], "v0-demo");
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
  assert.ok(bundle.manifest.permissions.includes("finance.risk-profile"));
  validateScopedBundle(bundle, record);
  const editable = structuredClone(bundle);
  editable.files["src/components/risk-questionnaire.tsx"] += "\n// editable presentation";
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
  const beforeScoring = await persisted();
  assert.deepEqual(await rpc("finance.risk-profile", input), completed);
  assert.equal(await persisted(), beforeScoring, "Scoring must not persist answers");
  const { q7: _q7, ...partialAnswers } = input.answers;
  const invalidInputs = [
    null,
    {},
    { ...input, answers: partialAnswers },
    { ...input, questionnaire_version: "v1" },
    { ...input, answers: { ...input.answers, q1: "3" } },
    { ...input, answers: { ...input.answers, q1: 1.5 } },
    { ...input, answers: { ...input.answers, q1: 0 } },
    { ...input, answers: { ...input.answers, q1: 4 } },
    { ...input, answers: { ...input.answers, q8: 1 } },
    { ...input, extra: true },
  ];
  for (const invalid of invalidInputs) {
    assert.deepEqual(await rpc("finance.risk-profile", invalid), invalidResult);
    assert.deepEqual((await findApp(access, app.id)).data, app.data);
    assert.equal(await persisted(), beforeScoring);
  }
  console.log(
    "PASS dispatch returns exact completed/invalid results without persisting scoring inputs",
  );

  const invalidWrites = [
    input,
    invalidResult,
    { ...completed, answers: partialAnswers },
    { ...completed, total_score: 16 },
    { ...completed, risk_profile_bucket: "high" },
    { ...completed, answers: { ...input.answers, q1: 1 } },
    { ...completed, questionnaire_version: "v1" },
    { ...completed, extra: true },
  ];
  for (const value of invalidWrites) {
    await assert.rejects(rpc("storage.write", { key: "risk-profile", value }));
    assert.equal(
      await persisted(),
      beforeScoring,
      "Rejected risk writes must not touch persistence",
    );
    assert.equal(await rpc("storage.read", { key: "risk-profile" }), null);
  }
  assert.deepEqual(await rpc("storage.write", { key: "risk-profile", value: completed }), {
    saved: true,
  });
  assert.deepEqual(await rpc("storage.read", { key: "risk-profile" }), completed);
  assert.deepEqual((await findApp(access, app.id)).data, {
    ...app.data,
    "risk-profile": completed,
  });
  assert.deepEqual(JSON.parse(await persisted())[0].data["risk-profile"], completed);
  const afterCompletion = await persisted();
  for (const value of invalidWrites) {
    await assert.rejects(rpc("storage.write", { key: "risk-profile", value }));
    assert.equal(await persisted(), afterCompletion, "Invalid replacements must retain completion");
  }
  assert.deepEqual(await rpc("finance.risk-profile", input, preview.id), completed);
  await assert.rejects(
    rpc("storage.write", { key: "risk-profile", value: completed }, preview.id),
    /Only the active verified release/,
  );
  assert.equal(await persisted(), afterCompletion);
  console.log(
    "PASS reserved risk storage rejects partial/tampered data, retains completion, and blocks preview writes",
  );

  const noPermissionBundle = structuredClone(bundle);
  noPermissionBundle.manifest.permissions = bundle.manifest.permissions.filter(
    (permission) => permission !== "finance.risk-profile",
  );
  const noPermission = await fixtureRelease(noPermissionBundle, record);
  let latest = await findApp(access, app.id);
  latest.current = noPermission;
  await saveApp(access, latest, latest.revision);
  const beforeDenied = await persisted();
  await assert.rejects(rpc("finance.risk-profile", input, noPermission.id), /permission/);
  await assert.rejects(
    rpc("storage.write", { key: "risk-profile", value: completed }, noPermission.id),
    /Risk questionnaire permission/,
  );
  assert.equal(await persisted(), beforeDenied);
  console.log("PASS scoring and reserved storage require the risk permission");

  const oldRecord = structuredClone(record);
  oldRecord.moduleVersions.starter = "financial-react-v1";
  delete oldRecord.moduleVersions["risk-profile"];
  delete oldRecord.moduleVersions["company-discovery"];
  delete oldRecord.moduleVersions["industry-preferences"];
  for (const key of Object.keys(oldRecord.moduleVersions))
    if (key.startsWith("finance.")) delete oldRecord.moduleVersions[key];
  assert.deepEqual(oldRecord.moduleVersions, {
    companies: "company-capabilities-v1",
    starter: "financial-react-v1",
  });
  const { hash: _hash, ...oldPayload } = oldRecord;
  oldRecord.hash = createHash("sha256")
    .update(
      JSON.stringify(oldPayload, (_key, value) =>
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
  assert.ok(oldRecord.resolvedCapabilities.includes("risk-assessment"));
  assert.ok(!approvedPermissions(oldRecord, true).includes("finance.risk-profile"));
  const legacyBundle = structuredClone(bundle);
  Object.assign(legacyBundle.files, capabilityStarterV1Files);
  legacyBundle.manifest.permissions = approvedPermissions(oldRecord, true);
  legacyBundle.files[buildContextPath] = buildContextSource(oldRecord, spec.name);
  legacyBundle.files["src/lib/cd80.ts"] = legacyFinancialSdkSource;
  legacyBundle.files["src/components/financial-app.tsx"] = legacyFinancialModulesSource;
  delete legacyBundle.files["src/lib/risk-profile.ts"];
  delete legacyBundle.files["src/components/risk-questionnaire.tsx"];
  delete legacyBundle.files["src/lib/company-discovery.ts"];
  delete legacyBundle.files["src/components/company-discovery.tsx"];
  delete legacyBundle.files["src/lib/industry-preference.ts"];
  delete legacyBundle.files["src/components/industry-preference.tsx"];
  delete legacyBundle.files["src/lib/discovery-contract.ts"];
  delete legacyBundle.files["src/lib/financial-results.ts"];
  delete legacyBundle.files["src/components/financial-analysis.tsx"];
  validateScopedBundle(legacyBundle, oldRecord);
  const legacy = await fixtureRelease(legacyBundle, oldRecord);
  latest = await findApp(access, app.id);
  latest.current = legacy;
  await saveApp(access, latest, latest.revision);
  assert.deepEqual(await rpc("storage.read", { key: "risk-profile" }, legacy.id), completed);
  await assert.rejects(rpc("finance.risk-profile", input, legacy.id), /permission/);
  const changedLegacy = structuredClone(legacyBundle);
  changedLegacy.files["src/lib/cd80.ts"] += "\n// mutated legacy SDK";
  assert.throws(() => validateScopedBundle(changedLegacy, oldRecord), /starter file unchanged/);
  const escalatedBundle = structuredClone(bundle);
  Object.assign(escalatedBundle.files, capabilityStarterV1Files);
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
    rpc("finance.risk-profile", input, escalated.id),
    /approved platform modules/,
  );
  assert.equal(await persisted(), beforeEscalation);
  console.log(
    "PASS legacy SDK/releases remain readable but cannot gain risk permission without a module snapshot",
  );

  for (const path of ["src/lib/cd80.ts", "src/lib/risk-profile.ts", "src/lib/build-context.ts"]) {
    assert.equal(typeof bundle.files[path], "string", `Protected starter file is missing: ${path}`);
    const changed = structuredClone(bundle);
    changed.files[path] += "\n// mutated protected risk source";
    assert.throws(
      () => validateScopedBundle(changed, record),
      /starter file unchanged|project context/,
    );
    const changedRelease = await fixtureRelease(changed, record);
    latest = await findApp(access, app.id);
    latest.current = changedRelease;
    await saveApp(access, latest, latest.revision);
    const beforeMutation = await persisted();
    await assert.rejects(
      rpc("finance.risk-profile", input, changedRelease.id),
      /starter file unchanged|project context/,
    );
    assert.equal(await persisted(), beforeMutation);
  }
  console.log(
    "PASS protected risk files reject mutations even with matching source/artifact hashes",
  );
  console.log(
    "Risk profile dispatch/local-persistence integration checks passed; no app build or execution.",
  );
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
}
