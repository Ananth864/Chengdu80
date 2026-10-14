import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  b2cPerformancePlan,
  exportCapabilityMarkdown,
  SIMULATION_WARNING,
  validateCapabilityPlan,
  type CapabilityPlan,
} from "../packages/capabilities/src";
import { runCapabilityPlan } from "../packages/capabilities/src/runtime";
import { protocols, type Application, type Release } from "../apps/web/src/lib/contracts";
import { capabilityRequirements, initialRequirements } from "../apps/web/src/lib/planning";
import { sampleBundle } from "../apps/web/src/lib/samples";
import {
  assertCapabilityArtifact,
  capabilityArtifactHash,
} from "../apps/web/src/server/capability-release";
import { applyRelease, dispatch, makeRelease } from "../apps/web/src/server/platform";
import { findApp, saveApp } from "../apps/web/src/server/repository";
import { disposeRuntimes } from "../apps/web/src/server/runtime";

// JSON normalization matches persistence and the runner's null-prototype records.
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
const dir = await mkdtemp(join(tmpdir(), "chengdu80-capability-flow-"));
const original = { ...process.env };
const env = { CD80_LOCAL_MODE: "1", CD80_DATA_DIR: dir };
Object.assign(process.env, env);
const access = { ownerId: "local-prototype-owner", accessToken: null };
let passed = 0;
function pass(name: string) {
  passed++;
  console.log("PASS " + name);
}
try {
  const spec = { ...copy(protocols[0]!.defaultSpec), name: "Capability flow fixture" };
  const requirements = {
    ...initialRequirements(),
    dataSource: "fixtures" as const,
    questions: [
      { id: "market", question: "Which market?", answer: "China" },
      { id: "source", question: "Which licensed source?", answer: "" },
    ],
    missingInputs: ["Choose a licensed data source"],
  };
  const expected = capabilityRequirements(spec, requirements);
  assert.deepEqual(
    expected.map((row) => row.id),
    [
      "purpose",
      "data-source",
      "analysis-period",
      "plugin-operations",
      ...spec.inputs.map((_, index) => `input-${index + 1}`),
      ...spec.outputs.map((_, index) => `output-${index + 1}`),
      ...spec.constraints.map((_, index) => `constraint-${index + 1}`),
      "answer-market",
      "answer-source",
      "missing-1",
    ],
  );
  assert.equal(
    expected.find((row) => row.id === "answer-source")!.text,
    "Which licensed source?: UNKNOWN",
  );
  const plan: CapabilityPlan = {
    ...copy(b2cPerformancePlan),
    requirements: expected.map((row) => ({ ...row, assetTypes: ["stocks"], markets: ["China"] })),
    steps: copy(b2cPerformancePlan.steps.filter((step) => step.id !== "research")),
    outputs: { dashboard: { kind: "step", stepId: "dashboard", output: "dashboard" } },
    coverage: expected.map((row) => ({
      requirementId: row.id,
      status: "partial",
      stepIds: ["dashboard"],
      reason:
        "Only an arbitrary fixture dashboard; product contracts and China stock coverage are UNKNOWN.",
    })),
  };
  const validation = validateCapabilityPlan(plan, expected);
  assert.equal(validation.valid, true);
  assert.equal(validation.executable, true);
  assert.equal(validation.productionReady, false);
  const current = await makeRelease(spec, sampleBundle(spec), "sample", "Previously verified app");
  assert.equal(current.verification.passed, true);
  let app: Application = await saveApp(
    access,
    {
      id: crypto.randomUUID(),
      ownerId: access.ownerId,
      revision: 0,
      name: spec.name,
      spec,
      workspaceSpec: spec,
      workspace: current.bundle,
      current,
      preview: null,
      requirements,
      data: { inputs: copy(protocols[0]!.fixture.input), note: "Retain existing data" },
      history: [],
      events: [],
      createdAt: new Date().toISOString(),
    },
    null,
  );
  const oldCurrent = copy(app.current);
  const oldData = copy(app.data);
  const markdown = exportCapabilityMarkdown(plan, "Explicit mock-only coverage and gaps.");
  app = await dispatch(access, { action: "save-capability-plan", appId: app.id, markdown });
  app = await findApp(access, app.id);
  assert.deepEqual(app.requirements!.capabilityPlan, plan);
  assert.equal(
    exportCapabilityMarkdown(
      app.requirements!.capabilityPlan!,
      "Explicit mock-only coverage and gaps.",
    ),
    markdown,
  );
  assert.equal(app.workflow!.basis, "capability-plan");
  assert.deepEqual(app.workflow!.edges, [
    { from: "literal:fixture-metrics:symbol", to: "fixture-metrics", label: "symbol" },
    { from: "fixture-metrics", to: "dashboard", label: "metrics -> metrics" },
    { from: "dashboard", to: "output:dashboard", label: "dashboard -> dashboard" },
  ]);
  assert.equal(app.feasibility!.outcome, "revise");
  pass("Markdown dispatch persists exact requirements, gaps and actual bound workflow edges");

  // Invalid fixtures bypass the exporter so dispatch, not fixture construction, rejects them.
  for (const [name, change, error] of [
    [
      "bad version",
      (p: CapabilityPlan) => {
        p.steps[0]!.version = "999.0.0";
      },
      /No exact capability/,
    ],
    [
      "missing binding",
      (p: CapabilityPlan) => {
        delete p.steps[0]!.inputs.symbol;
      },
      /Missing input symbol/,
    ],
    [
      "binding mismatch",
      (p: CapabilityPlan) => {
        p.steps[1]!.inputs.metrics = { kind: "step", stepId: "fixture-metrics", output: "unknown" };
      },
      /no output unknown/,
    ],
    [
      "contract mismatch",
      (p: CapabilityPlan) => {
        p.steps[0]!.inputs.symbol = {
          kind: "input",
          name: "symbol",
          contract: "simulation.metrics@1",
        };
      },
      /cannot compose with/,
    ],
    [
      "requirements mismatch",
      (p: CapabilityPlan) => {
        p.requirements[0]!.text += " changed";
      },
      /preserve all expected requirement/,
    ],
    [
      "missing requirement",
      (p: CapabilityPlan) => {
        p.requirements.pop();
        p.coverage.pop();
      },
      /preserve all expected requirement/,
    ],
    [
      "unknown capability",
      (p: CapabilityPlan) => {
        p.steps[0]!.capabilityId = "invented.capability";
      },
      /No exact capability/,
    ],
    [
      "unsupported selection",
      (p: CapabilityPlan) => {
        p.steps[0]!.capabilityId = "selection.risk-industry";
      },
      /Dependency|Missing input/,
    ],
    [
      "unjustified support",
      (p: CapabilityPlan) => {
        p.coverage[0]!.status = "supported";
      },
      /Full support requires/,
    ],
  ] as const) {
    const invalid = copy(plan);
    change(invalid);
    const before = copy(await findApp(access, app.id));
    await assert.rejects(
      dispatch(access, {
        action: "save-capability-plan",
        appId: app.id,
        markdown: `\`\`\`cd80-capabilities-v1\n${JSON.stringify(invalid)}\n\`\`\`\n`,
      }),
      error,
      name,
    );
    assert.deepEqual(await findApp(access, app.id), before, name);
  }
  pass("Invalid pins, bindings, requirements and unsupported selections fail without writes");

  app = await dispatch(access, { action: "simulate-capabilities", appId: app.id });
  app = await findApp(access, app.id);
  const preview = copy(app.preview!);
  assert.equal(preview.verification.passed, false);
  assert.equal(preview.simulationPassed, true);
  assert.equal(preview.capabilityArtifact!.simulation, true);
  assert.deepEqual(app.current, oldCurrent);
  assert.deepEqual(app.data, oldData);
  await assertCapabilityArtifact(preview);
  const sorted = JSON.parse(
    JSON.stringify(preview, (_key, value) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
        : value,
    ),
  );
  assert.equal(await capabilityArtifactHash(sorted), preview.capabilityArtifact!.artifactHash);
  await assertCapabilityArtifact(sorted);
  assert.ok(
    preview.verification.checks.some(
      (check) => check.name === "Generated TypeScript compilation and execution" && check.passed,
    ),
  );
  pass("Persisted key ordering preserves the exact compiled capability artifact");
  const rpc = (input: unknown, capability = "capability.flow", releaseId = preview.id) =>
    dispatch(access, {
      action: "rpc",
      appId: app.id,
      releaseId,
      capability,
      input,
    });
  const result = await rpc({ inputs: {} });
  assert.deepEqual(copy(result), copy(await runCapabilityPlan(plan, {})));
  assert.deepEqual(copy(result.outputs.dashboard), {
    title: "Prototype fixture dashboard",
    fixtureValue: 7,
    warning: SIMULATION_WARNING,
  });
  assert.deepEqual(result.provenance, {
    simulated: true,
    unverified: true,
    warning: SIMULATION_WARNING,
  });
  for (const capability of [
    "storage.read",
    "storage.write",
    "plugin.call",
    "ai.explain",
    "finance.calculate",
  ])
    await assert.rejects(rpc({ inputs: {} }, capability), /only their pinned registered flow/);
  for (const input of [
    {},
    { inputs: [] },
    { inputs: {}, extra: true },
    { inputs: { unknown: "value" } },
  ])
    await assert.rejects(rpc(input), /Invalid|Unrecognized/);
  await assert.rejects(
    rpc({ inputs: { oversized: "x".repeat(150001) } }),
    /input exceeds size limit/,
  );
  await assert.rejects(rpc({ inputs: {} }, "capability.flow", "stale-preview"), /Verified release/);
  pass("Simulation stays a preview and RPC only executes the pinned, bounded, schema-checked flow");

  for (const action of ["accept", "reverify"])
    await assert.rejects(
      dispatch(access, {
        action,
        appId: app.id,
        releaseId: preview.id,
        artifactHash: preview.capabilityArtifact!.artifactHash,
      }),
      /Mock|mock/,
    );
  await assert.rejects(
    dispatch(access, { action: "reverify", appId: app.id, releaseId: "stale-preview" }),
    /Preview changed/,
  );
  await assert.rejects(
    dispatch(access, { action: "accept", appId: app.id, releaseId: "stale-preview" }),
    /Mock|mock|verified/,
  );
  await assert.rejects(
    dispatch(access, { action: "import", appId: app.id, spec, bundle: sampleBundle(spec) }),
    /cannot be replaced by legacy/,
  );
  await assert.rejects(
    dispatch(access, {
      action: "update",
      appId: app.id,
      request: "Improve layout",
      mode: "sample",
    }),
    /Revise the pinned capability plan/,
  );
  const forged = copy(preview);
  forged.verification.passed = true;
  forged.approval = {
    artifactHash: forged.capabilityArtifact!.artifactHash,
    ownerId: access.ownerId,
    approvedAt: new Date().toISOString(),
  };
  const candidate = copy(app);
  assert.equal(await applyRelease(candidate, forged), false);
  assert.deepEqual(candidate.current, oldCurrent);
  assert.deepEqual(candidate.data, oldData);
  forged.capabilityArtifact!.simulation = false;
  forged.capabilityArtifact!.artifactHash = await capabilityArtifactHash(forged);
  forged.approval.artifactHash = forged.capabilityArtifact!.artifactHash;
  assert.equal(await applyRelease(candidate, forged), false);
  assert.deepEqual(candidate.current, oldCurrent);
  pass(
    "Accept, reverify, legacy import/update and a forged verification boolean cannot activate mocks",
  );

  for (const [name, change] of [
    [
      "plan",
      (r: Release) => {
        r.capabilityArtifact!.plan.gaps.push("Changed gap");
      },
    ],
    [
      "typescript",
      (r: Release) => {
        r.capabilityArtifact!.typescript += "\n// changed";
      },
    ],
    [
      "source",
      (r: Release) => {
        r.bundle.files["app.js"] += "\n// changed";
      },
    ],
    [
      "pin",
      (r: Release) => {
        r.capabilityArtifact!.plan.steps[0]!.version = "999.0.0";
      },
    ],
    [
      "runtime metadata",
      (r: Release) => {
        r.capabilityArtifact!.simulation = false;
      },
    ],
    [
      "spec",
      (r: Release) => {
        r.spec.purpose += " changed";
      },
    ],
    [
      "requirements",
      (r: Release) => {
        r.requirements!.questions[0]!.answer = "Changed market";
      },
    ],
    [
      "permissions",
      (r: Release) => {
        r.bundle.manifest.permissions.push("storage.write");
      },
    ],
  ] as const) {
    const tampered = copy(preview);
    change(tampered);
    if (name !== "pin")
      assert.notEqual(
        await capabilityArtifactHash(tampered),
        preview.capabilityArtifact!.artifactHash,
        name,
      );
    await assert.rejects(
      assertCapabilityArtifact(tampered),
      /changed|no longer resolves|exact registry/,
      name,
    );
    await assert.rejects(
      applyRelease(copy(app), tampered),
      /changed|no longer resolves|exact registry/,
      name,
    );
    const stored = await findApp(access, app.id);
    stored.preview = tampered;
    await saveApp(access, stored, stored.revision);
    for (const action of ["rpc", "accept", "reverify"])
      await assert.rejects(
        dispatch(access, {
          action,
          appId: app.id,
          releaseId: preview.id,
          capability: "capability.flow",
          input: { inputs: {} },
          artifactHash: preview.capabilityArtifact!.artifactHash,
        }),
        /changed|no longer resolves|exact registry/,
        `${name}: ${action}`,
      );
    const retained = await findApp(access, app.id);
    assert.deepEqual(retained.current, oldCurrent);
    assert.deepEqual(retained.data, oldData);
    retained.preview = copy(preview);
    await saveApp(access, retained, retained.revision);
  }
  const retained = await findApp(access, app.id);
  assert.deepEqual(retained.current, oldCurrent);
  assert.deepEqual(retained.data, oldData);
  assert.deepEqual(retained.preview, preview);
  pass(
    "Plan, generated source, pins and runtime metadata tampering fails closed at every release gate",
  );
  app = await dispatch(access, { action: "save-design", appId: app.id, spec, requirements });
  assert.equal(app.capabilityMode, true);
  await assert.rejects(
    dispatch(access, { action: "import", appId: app.id, spec, bundle: sampleBundle(spec) }),
    /cannot be replaced by legacy/,
  );
  await assert.rejects(
    dispatch(access, {
      action: "update",
      appId: app.id,
      request: "Replace financial calculations",
      mode: "sample",
    }),
    /Revise the pinned/,
  );
  const legacyCandidate = copy(app);
  legacyCandidate.preview = copy(current);
  await saveApp(access, legacyCandidate, app.revision);
  for (const action of ["accept", "reverify"])
    await assert.rejects(
      dispatch(access, { action, appId: app.id, releaseId: current.id }),
      /cannot be replaced by legacy/,
    );
  pass(
    "Removing draft selections or retaining an old legacy preview cannot bypass capability lineage",
  );
  console.log(
    `${passed} local capability-flow integration checks passed. Production and live inference remain unverified.`,
  );
} finally {
  await disposeRuntimes();
  for (const key of Object.keys(env)) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  await rm(dir, { recursive: true, force: true });
}
