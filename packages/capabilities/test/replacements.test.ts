import { expect, test } from "bun:test";
import { rejects } from "node:assert/strict";
import { z } from "zod";
import {
  b2cPerformancePlan,
  capabilityDefinitions,
  exportCapabilityMarkdown,
  parseCapabilityMarkdown,
  validateCapabilityPlan,
} from "../src/index";
import type { CapabilityDefinition, CapabilityPlan, PlanValidationOptions } from "../src/index";
import {
  capabilityImplementationSources,
  createCapabilityRegistry,
  defineCapabilityImplementation,
  runCapabilityPlan,
} from "../src/runtime";

const contracts = {
  "test.text@2": z.string().min(1),
  "test.count@2": z.number().int().nonnegative(),
};
const replacement = (): CapabilityDefinition => ({
  ...structuredClone(capabilityDefinitions[0]!),
  version: "2.0.0",
  status: "verified",
  inputs: { query: "test.text@2" },
  outputs: { count: "test.count@2" },
  behavior: "Count characters in supplied fixture text; no financial behavior.",
  coverage: "Test-only character counting.",
  supportedAssetTypes: ["test-text"],
  markets: ["test-market"],
  dependencies: [],
  unknowns: [],
  constraints: ["Independent test fixture, not verified financial data."],
  evidence: { verified: true, references: ["test:independent-character-count-check"] },
});
const plan = (): CapabilityPlan => ({
  schemaVersion: 1,
  requirements: [
    {
      id: "count",
      text: "Count supplied test text characters.",
      assetTypes: ["test-text"],
      markets: ["test-market"],
    },
  ],
  steps: [
    {
      id: "count",
      capabilityId: "research.market",
      version: "2.0.0",
      inputs: { query: { kind: "literal", value: "abc" } },
    },
  ],
  coverage: [
    {
      requirementId: "count",
      status: "supported",
      stepIds: ["count"],
      reason: "Independent test character counting only.",
    },
  ],
  outputs: { count: { kind: "step", stepId: "count", output: "count" } },
  gaps: [],
  questions: [],
  assumptions: [],
});
const options = (definition: CapabilityDefinition): PlanValidationOptions => ({
  definitions: [definition],
  contracts,
  verifyEvidence: (d) =>
    d.evidence.references.includes("test:independent-character-count-check") &&
    d.behavior === replacement().behavior,
  supportsRequirement: (d, r) =>
    d.id === "research.market" && r.text === "Count supplied test text characters.",
});

test("typed replacements have pinned immutable identities and independent schemas", async () => {
  const definition = replacement();
  const handler = defineCapabilityImplementation(
    contracts,
    { query: "test.text@2" },
    { count: "test.count@2" },
    (input) => ({ count: input.query.length }),
  );
  const handlers = { "research.market@2.0.0": handler };
  const registry = createCapabilityRegistry([definition], contracts, handlers);
  (definition as { version: string }).version = "3.0.0";
  // The external catalog is intentionally mutable; the registry owns an immutable snapshot.
  expect(registry.resolve("research.market", "2.0.0").definition.version).toBe("2.0.0");
  expect(() => registry.resolve("research.market", "3.0.0")).toThrow();
  expect(() => registry.resolve("research.market", "latest")).toThrow();
  handler.invoke = () => ({ count: 99 });
  expect(await registry.resolve("research.market", "2.0.0").invoke({ query: "abc" })).toEqual({
    count: 3,
  });
  await rejects(registry.resolve("research.market", "2.0.0").invoke({ query: 42 }));
  await rejects(registry.resolve("research.market", "2.0.0").invoke({ query: "abc", extra: true }));
  expect(() =>
    createCapabilityRegistry([replacement(), replacement()], contracts, handlers),
  ).toThrow("Duplicate");
  expect(() => createCapabilityRegistry([replacement()], contracts, {})).toThrow(
    "No exact implementation",
  );
  expect(() => createCapabilityRegistry([replacement()], {}, handlers)).toThrow(
    "Unknown registry contract",
  );
  expect(() =>
    createCapabilityRegistry([replacement()], contracts, {
      "research.market@2.0.0": { ...handler, outputs: { count: "test.text@2" } },
    }),
  ).toThrow("drift");
});

test("factory rejects bogus implementation outputs independently of input validation", async () => {
  const registry = createCapabilityRegistry([replacement()], contracts, {
    "research.market@2.0.0": {
      inputs: { query: "test.text@2" },
      outputs: { count: "test.count@2" },
      invoke: () => ({ count: "bogus" }),
    },
  });
  await rejects(registry.resolve("research.market", "2.0.0").invoke({ query: "valid input" }));
});

test("statuses remain distinct without treating verified assertions as evidence", async () => {
  const definition = replacement();
  const partial = plan();
  partial.coverage[0]!.status = "partial";
  expect(
    validateCapabilityPlan(partial, undefined, { definitions: [definition], contracts }),
  ).toMatchObject({ valid: true, executable: true, productionReady: false });
  expect(
    validateCapabilityPlan(plan(), undefined, { definitions: [definition], contracts }),
  ).toMatchObject({ valid: false, productionReady: false });
  expect(validateCapabilityPlan(plan(), undefined, options(definition))).toMatchObject({
    valid: true,
    executable: true,
    productionReady: true,
  });
  const noEvidence = { ...definition, evidence: { verified: true, references: [] } };
  expect(validateCapabilityPlan(partial, undefined, options(noEvidence)).productionReady).toBe(
    false,
  );
  for (const status of ["unverified", "deprecated", "unavailable"] as const) {
    const d = { ...replacement(), status };
    const validation = validateCapabilityPlan(partial, undefined, options(d));
    expect(validation.productionReady).toBe(false);
    expect(validation.executable).toBe(status === "unverified");
    const registry = createCapabilityRegistry([d], contracts, {
      "research.market@2.0.0": defineCapabilityImplementation(
        contracts,
        { query: "test.text@2" },
        { count: "test.count@2" },
        (input) => ({ count: input.query.length }),
      ),
    });
    if (status === "unverified")
      expect(await registry.resolve(d.id, d.version).invoke({ query: "abc" })).toEqual({
        count: 3,
      });
    else
      await rejects(registry.resolve(d.id, d.version).invoke({ query: "abc" }), new RegExp(status));
  }
});

test("verified readiness requires complete contracts, scope, evidence and actual requirements", () => {
  for (const patch of [
    { inputs: null },
    { outputs: null },
    { behavior: null },
    { coverage: "UNKNOWN" },
    { dependencies: null },
    { unknowns: ["unresolved source"] },
    { supportedAssetTypes: null },
    { markets: null },
  ]) {
    const definition = { ...replacement(), ...patch };
    expect(validateCapabilityPlan(plan(), undefined, options(definition)).productionReady).toBe(
      false,
    );
  }
  expect(
    validateCapabilityPlan(plan(), undefined, {
      ...options(replacement()),
      verifyEvidence: () => false,
    }).productionReady,
  ).toBe(false);
  expect(
    validateCapabilityPlan(plan(), undefined, {
      ...options(replacement()),
      supportsRequirement: () => false,
    }).productionReady,
  ).toBe(false);
  const question = plan();
  question.questions = ["Unresolved test convention?"];
  expect(validateCapabilityPlan(question, undefined, options(replacement())).productionReady).toBe(
    false,
  );
});

test("known unsupported scope is distinguished from unknown scope", () => {
  const partial = plan();
  partial.coverage[0]!.status = "partial";
  partial.requirements[0]!.assetTypes = ["bonds"];
  partial.requirements[0]!.markets = ["China"];
  const known = validateCapabilityPlan(partial, undefined, options(replacement()));
  expect(known.issues.map((i) => i.code)).toContain("UNSUPPORTED_ASSET");
  expect(known.issues.map((i) => i.code)).toContain("UNSUPPORTED_MARKET");
  expect(known.issues.map((i) => i.code)).not.toContain("UNKNOWN_SCOPE");
  const unknown = validateCapabilityPlan(
    partial,
    undefined,
    options({ ...replacement(), supportedAssetTypes: null, markets: null }),
  );
  expect(unknown.issues.map((i) => i.code)).toContain("UNKNOWN_SCOPE");
  expect(unknown.issues.map((i) => i.code)).not.toContain("UNSUPPORTED_ASSET");
});

test("prototype selection requires risk and industry dependencies through actual bindings", () => {
  const p: CapabilityPlan = {
    ...structuredClone(b2cPerformancePlan),
    steps: [
      {
        id: "selection",
        capabilityId: "selection.risk-industry",
        version: "1.0.0",
        inputs: {
          risk: { kind: "literal", value: "simulated-low" },
          industry: { kind: "literal", value: "fixture" },
        },
      },
    ],
    outputs: {},
    coverage: b2cPerformancePlan.requirements.map((r) => ({
      requirementId: r.id,
      status: "unsupported",
      stepIds: [],
      reason: "No implementation.",
    })),
  };
  expect(
    validateCapabilityPlan(p).issues.filter((i) => i.code === "UNRESOLVED_DEPENDENCY"),
  ).toHaveLength(2);
  p.steps.push(
    {
      id: "risk",
      capabilityId: "profile.risk-appetite",
      version: "1.0.0",
      inputs: { answers: { kind: "literal", value: Array.from({ length: 9 }, () => "fixture") } },
    },
    {
      id: "industry",
      capabilityId: "profile.industry-preference",
      version: "1.0.0",
      inputs: { preference: { kind: "literal", value: "fixture" } },
    },
  );
  expect(validateCapabilityPlan(p).executable).toBe(false);
  p.steps[0]!.inputs = {
    risk: { kind: "step", stepId: "risk", output: "risk" },
    industry: { kind: "step", stepId: "industry", output: "industry" },
  };
  expect(validateCapabilityPlan(p)).toMatchObject({
    executable: true,
    order: ["risk", "industry", "selection"],
  });
  expect(
    capabilityDefinitions.find((d) => d.id === "selection.risk-industry")!.dependencies,
  ).toBeNull();
});

test("all-unsupported plans need no forced steps or outputs", async () => {
  const p: CapabilityPlan = {
    ...structuredClone(b2cPerformancePlan),
    steps: [],
    outputs: {},
    coverage: b2cPerformancePlan.requirements.map((r) => ({
      requirementId: r.id,
      status: "unsupported",
      stepIds: [],
      reason: "No suitable capabilities.",
    })),
  };
  expect(validateCapabilityPlan(p)).toMatchObject({
    valid: true,
    executable: true,
    productionReady: false,
    order: [],
  });
  expect(parseCapabilityMarkdown(exportCapabilityMarkdown(p)).plan).toEqual(p);
  expect(await runCapabilityPlan(p, {})).toMatchObject({
    results: {},
    outputs: {},
    provenance: { simulated: false, unverified: false, warning: "" },
  });
  for (const id of ["search", "holdings"])
    expect(b2cPerformancePlan.coverage.find((r) => r.requirementId === id)).toMatchObject({
      status: "unsupported",
      stepIds: [],
    });
  expect(b2cPerformancePlan.coverage.find((r) => r.requirementId === "metrics")!.status).toBe(
    "partial",
  );
  expect(capabilityImplementationSources("research.market", "1.0.0")).toContain("Fictional");
});

test("runtime snapshots nested external inputs before asynchronous execution", async () => {
  const p = structuredClone(b2cPerformancePlan);
  p.outputs.metrics = { kind: "input", name: "metrics", contract: "simulation.metrics@1" };
  const metrics = { fixtureValue: 17, unit: "arbitrary-fixture-units" };
  const pending = runCapabilityPlan(p, { query: "fixture", metrics });
  metrics.fixtureValue = 999;
  expect((await pending).outputs.metrics).toEqual({
    fixtureValue: 17,
    unit: "arbitrary-fixture-units",
  });
});
