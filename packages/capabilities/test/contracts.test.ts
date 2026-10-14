import { describe, expect, test } from "bun:test";
import { rejects } from "node:assert/strict";
import { z } from "zod";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import {
  b2cPerformancePlan,
  capabilityDefinitions,
  capabilityStatusSchema,
  SIMULATION_WARNING,
  capabilityPlanSchema,
  canonicalCapabilityJson,
  exportCapabilityMarkdown,
  jsonLiteralSchema,
  parseCapabilityMarkdown,
  validateCapabilityPlan,
} from "../src/index";
import type { CapabilityPlan, SimulationContractValues } from "../src/index";
import { simulationContractSchemas } from "../src/definitions";
import {
  capabilityRegistry,
  generateCapabilityTypeScript,
  runCapabilityPlan,
} from "../src/runtime";

const fixture = (): CapabilityPlan => structuredClone(b2cPerformancePlan);
const checkError = (plan: unknown, code: string) => {
  const validation = validateCapabilityPlan(plan);
  expect(validation.valid).toBe(false);
  expect(validation.executable).toBe(false);
  expect(validation.order).toEqual([]);
  expect(validation.issues.some((issue) => issue.code === code)).toBe(true);
};

describe("catalog and registry", () => {
  test("nine stable pinned concepts, unknown product contracts, no evidence", () => {
    expect(capabilityDefinitions.map((d) => d.id)).toEqual([
      "research.market",
      "analysis.company-history",
      "data.stock-price-api",
      "data.company-news",
      "profile.risk-appetite",
      "profile.industry-preference",
      "selection.risk-industry",
      "extraction.annual-report-metrics",
      "presentation.metrics-dashboard",
    ]);
    for (const definition of capabilityDefinitions) {
      expect(definition.version).toBe("1.0.0");
      expect(definition.status).toBe("mock");
      expect(definition.inputs).toBeNull();
      expect(definition.outputs).toBeNull();
      expect(definition.markets).toBeNull();
      expect(definition.supportedAssetTypes).toBeNull();
      expect(definition.dependencies).toBeNull();
      expect(definition.evidence.verified).toBe(false);
      expect(Object.isFrozen(definition.evidence)).toBe(true);
      expect(definition.simulation.prototypeOnly).toBe(true);
      expect(capabilityRegistry.resolve(definition.id, definition.version).definition).toBe(
        definition,
      );
    }
    expect(() => capabilityRegistry.resolve("research.market", "latest")).toThrow();
    expect(() => capabilityRegistry.resolve("unknown", "1.0.0")).toThrow();
    expect(() => capabilityRegistry.resolve("research.market", "2.0.0")).toThrow();
    expect(capabilityStatusSchema.options).toEqual([
      "mock",
      "unverified",
      "verified",
      "deprecated",
      "unavailable",
    ]);
    expect(Object.isFrozen(capabilityDefinitions)).toBe(true);
    expect(Object.isFrozen(capabilityDefinitions[0]!.simulation.inputs)).toBe(true);
    expect(() => {
      (capabilityDefinitions[0]!.simulation.inputs as Record<string, string>).query = "invented";
    }).toThrow();
  });

  test("every implementation validates inputs and returns exact declared outputs", async () => {
    const values: SimulationContractValues = {
      "simulation.text@1": "fixture",
      "simulation.nine-answers@1": Array.from({ length: 9 }, () => "arbitrary"),
      "simulation.risk@1": "simulated-low",
      "simulation.industry@1": "fictional industry",
      "simulation.items@1": ["fictional"],
      "simulation.metrics@1": { fixtureValue: 1, unit: "arbitrary-fixture-units" },
      "simulation.dashboard@1": { title: "fixture", fixtureValue: 1, warning: SIMULATION_WARNING },
    };
    for (const definition of capabilityDefinitions) {
      const entry = capabilityRegistry.resolve(definition.id, definition.version);
      const input = Object.fromEntries(
        Object.entries(definition.simulation.inputs).map(([name, contract]) => [
          name,
          values[contract],
        ]),
      );
      const result = await entry.invoke(input);
      expect(Object.keys(result)).toEqual(Object.keys(definition.simulation.outputs));
      for (const [name, contract] of Object.entries(definition.simulation.outputs)) {
        expect(simulationContractSchemas[contract].safeParse(result[name]).success).toBe(true);
      }
      await rejects(entry.invoke({}));
      await rejects(entry.invoke({ ...input, unexpected: "value" }));
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.keys(entry)).toEqual(["definition", "invoke"]);
    }
  });

  test("risk fixture never invents scoring or a financial classification", async () => {
    const entry = capabilityRegistry.resolve("profile.risk-appetite", "1.0.0");
    expect(await entry.invoke({ answers: Array.from({ length: 9 }, () => "high") })).toEqual({
      risk: "simulated-low",
    });
    expect(await entry.invoke({ answers: Array.from({ length: 9 }, () => "low") })).toEqual({
      risk: "simulated-low",
    });
    await rejects(entry.invoke({ answers: ["one"] }));
  });
});

describe("plan validation", () => {
  test("each partial row exposes its unverified semantic rationale without blocking simulation", () => {
    const plan = fixture();
    const result = validateCapabilityPlan(plan);
    const partial = plan.coverage.filter((row) => row.status === "partial");
    const qualifications = result.issues.filter(
      (issue) => issue.code === "PARTIAL_MATCH_UNVERIFIED",
    );
    expect(qualifications).toHaveLength(partial.length);
    for (const row of partial)
      expect(
        qualifications.some(
          (issue) =>
            issue.message.includes(row.requirementId) && issue.message.includes(row.reason),
        ),
      ).toBe(true);
    expect(result).toMatchObject({ valid: true, executable: true, productionReady: false });
  });
  test("plan input JSON Schema exports without unsupported custom schemas", () => {
    const schema = z.toJSONSchema(capabilityPlanSchema, { io: "input" });
    expect(schema.type).toBe("object");
    expect(schema.properties?.schemaVersion).toMatchObject({ const: 1 });
    expect(JSON.parse(JSON.stringify(schema))).toEqual(schema);
  });
  test("partial simulation is executable, never production ready", () => {
    const result = validateCapabilityPlan(fixture());
    expect(result.valid).toBe(true);
    expect(result.executable).toBe(true);
    expect(result.productionReady).toBe(false);
    expect(result.order).toEqual(["research", "fixture-metrics", "dashboard"]);
    expect(result.issues.some((i) => i.code === "UNKNOWN_SCOPE")).toBe(true);
    expect(result.issues.some((i) => i.code === "COVERAGE_GAP")).toBe(true);
    checkError({ ...fixture(), mode: "production" }, "SCHEMA");
  });

  test("all initially unverified even when gaps are removed", () => {
    const plan = fixture();
    plan.gaps = [];
    plan.questions = [];
    plan.assumptions = [];
    expect(validateCapabilityPlan(plan).productionReady).toBe(false);
  });

  test("unknown ID, version, contract, missing inputs, invalid literals", () => {
    let plan = fixture();
    plan.steps[0]!.capabilityId = "unknown.capability";
    checkError(plan, "UNKNOWN_CAPABILITY");
    plan = fixture();
    plan.steps[0]!.version = "latest";
    checkError(plan, "UNKNOWN_CAPABILITY");
    plan = fixture();
    plan.steps[0]!.inputs = {};
    checkError(plan, "MISSING_BINDING");
    plan = fixture();
    plan.steps[0]!.inputs.query = { kind: "literal", value: 42 };
    checkError(plan, "INVALID_LITERAL");
    plan = fixture();
    plan.steps[0]!.inputs.extra = { kind: "literal", value: "value" };
    checkError(plan, "UNKNOWN_INPUT_PORT");
    plan = fixture();
    plan.steps[0]!.inputs.query = { kind: "input", name: "query", contract: "unknown@1" };
    checkError(plan, "UNKNOWN_CONTRACT");
  });

  test("exact contract composition, no guessed outputs or conflicting app inputs", () => {
    let plan = fixture();
    plan.steps[2]!.inputs.metrics = { kind: "step", stepId: "research", output: "research" };
    checkError(plan, "CONTRACT_MISMATCH");
    plan = fixture();
    plan.steps[2]!.inputs.metrics = { kind: "step", stepId: "fixture-metrics", output: "price" };
    checkError(plan, "UNKNOWN_OUTPUT");
    plan = fixture();
    plan.steps[2]!.inputs.metrics = { kind: "step", stepId: "missing", output: "metrics" };
    checkError(plan, "UNKNOWN_STEP");
    plan = fixture();
    plan.outputs.echo = { kind: "input", name: "query", contract: "simulation.industry@1" };
    checkError(plan, "INPUT_CONTRACT_CONFLICT");
    plan = fixture();
    plan.steps[0]!.inputs.query = {
      kind: "input",
      name: "query",
      contract: "simulation.industry@1",
    };
    checkError(plan, "CONTRACT_MISMATCH");
    plan = fixture();
    plan.outputs.dashboard = { kind: "step", stepId: "dashboard", output: "guessed" };
    checkError(plan, "UNKNOWN_OUTPUT");
  });

  test("bindings infer dependency order; cycles and duplicates checked", () => {
    const plan = fixture();
    plan.steps.reverse();
    const order = validateCapabilityPlan(plan).order;
    expect(order.indexOf("fixture-metrics")).toBeLessThan(order.indexOf("dashboard"));
    plan.steps.find((s) => s.id === "fixture-metrics")!.inputs.symbol = {
      kind: "step",
      stepId: "dashboard",
      output: "dashboard",
    };
    checkError(plan, "CYCLE");
    const unknown = fixture();
    unknown.steps[0]!.inputs.query = { kind: "step", stepId: "missing", output: "research" };
    checkError(unknown, "UNKNOWN_STEP");
    const duplicate = fixture();
    duplicate.steps.push(structuredClone(duplicate.steps[0]!));
    checkError(duplicate, "DUPLICATE_ID");
  });

  test("coverage preserves requirements and rejects unsupported claims", () => {
    let plan = fixture();
    plan.coverage[0]!.status = "supported";
    checkError(plan, "UNJUSTIFIED_SUPPORT");
    plan = fixture();
    plan.coverage.pop();
    checkError(plan, "MISSING_COVERAGE");
    plan = fixture();
    plan.coverage[0]!.requirementId = "missing";
    checkError(plan, "UNKNOWN_REQUIREMENT");
    plan = fixture();
    plan.coverage[0]!.stepIds = ["missing"];
    checkError(plan, "UNKNOWN_COVERAGE_STEP");
    plan = fixture();
    plan.coverage[5]!.stepIds = [];
    checkError(plan, "EMPTY_COVERAGE");
    plan = fixture();
    plan.coverage[2]!.stepIds = ["research"];
    checkError(plan, "UNSUPPORTED_STEPS");
    const expected = fixture().requirements.map(({ id, text }) => ({ id, text }));
    expect(validateCapabilityPlan(fixture(), expected).valid).toBe(true);
    expected[0]!.text = "silently changed";
    expect(
      validateCapabilityPlan(fixture(), expected).issues.some(
        (i) => i.code === "REQUIREMENTS_MISMATCH",
      ),
    ).toBe(true);
  });

  test("bounded literal JSON rejects unsafe and non-JSON values", () => {
    const cycle: unknown[] = [];
    cycle.push(cycle);
    let deep: unknown = "leaf";
    for (let i = 0; i < 14; i++) deep = [deep];
    const sparse: unknown[] = [];
    sparse.length = 2;
    for (const value of [
      undefined,
      NaN,
      Infinity,
      1n,
      () => 1,
      new Date(),
      cycle,
      deep,
      sparse,
      "x".repeat(32769),
      JSON.parse('{"__proto__":{}}'),
      JSON.parse('{"constructor":{}}'),
    ]) {
      expect(jsonLiteralSchema.safeParse(value).success).toBe(false);
    }
    expect(jsonLiteralSchema.safeParse({ safe: [null, true, 1, "text"] }).success).toBe(true);
    expect(capabilityPlanSchema.safeParse({ ...fixture(), unexpected: true }).success).toBe(false);
    const getter = Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        throw new Error("Must not run");
      },
    });
    expect(jsonLiteralSchema.safeParse(getter).success).toBe(false);
    expect(
      jsonLiteralSchema.safeParse(Object.defineProperty({}, "hidden", { value: 1 })).success,
    ).toBe(false);
    const duplicate = fixture();
    duplicate.requirements.push(structuredClone(duplicate.requirements[0]!));
    checkError(duplicate, "DUPLICATE_ID");
    const coverage = fixture();
    coverage.coverage.push(structuredClone(coverage.coverage[0]!));
    checkError(coverage, "DUPLICATE_ID");
  });
});

describe("trusted execution", () => {
  test("literal and input output bindings validate and snapshot caller values", async () => {
    const plan = fixture();
    const value = { note: "original" };
    plan.outputs.literal = { kind: "literal", value };
    plan.outputs.echo = { kind: "input", name: "query", contract: "simulation.text@1" };
    const pending = runCapabilityPlan(plan, { query: "fixture" });
    value.note = "mutated after execution began";
    plan.steps[1]!.version = "unknown";
    const result = await pending;
    expect(result.outputs.literal).toEqual({ note: "original" });
    expect(result.outputs.echo).toBe("fixture");
    const outputOnly = fixture();
    outputOnly.outputs.answers = {
      kind: "input",
      name: "answers",
      contract: "simulation.nine-answers@1",
    };
    await rejects(runCapabilityPlan(outputOnly, { query: "fixture", answers: ["one"] }));
    expect(generateCapabilityTypeScript(outputOnly)).toContain(
      '"answers": SimulationContractValues["simulation.nine-answers@1"]',
    );
  });

  test("returns real bound outputs and explicit simulation provenance", async () => {
    const run = await runCapabilityPlan(fixture(), { query: "China stocks bonds funds gold" });
    expect(run.provenance).toMatchObject({ simulated: true, unverified: true });
    expect(run.provenance.warning).toContain("not financial advice");
    expect(run.outputs.dashboard).toEqual({
      title: "Prototype fixture dashboard",
      fixtureValue: 7,
      warning: run.provenance.warning,
    });
    expect(Object.keys(run.results)).toEqual(["research", "fixture-metrics", "dashboard"]);
    expect(Object.keys(run.outputs)).toEqual(["research", "dashboard"]);
    await rejects(runCapabilityPlan(fixture(), {}));
    await rejects(runCapabilityPlan(fixture(), { query: 42 }));
    await rejects(runCapabilityPlan(fixture(), { query: "fixture", extra: "value" }));
    const invalid = fixture();
    invalid.steps[0]!.version = "wrong";
    await rejects(runCapabilityPlan(invalid, { query: "fixture" }));
  });

  test("nine answers compose only through declared risk/industry ports", async () => {
    const plan: CapabilityPlan = {
      ...fixture(),
      requirements: [
        { id: "selection", text: "Prototype selection only", assetTypes: [], markets: [] },
      ],
      steps: [
        {
          id: "selection",
          capabilityId: "selection.risk-industry",
          version: "1.0.0",
          inputs: {
            risk: { kind: "step", stepId: "risk", output: "risk" },
            industry: { kind: "step", stepId: "industry", output: "industry" },
          },
        },
        {
          id: "risk",
          capabilityId: "profile.risk-appetite",
          version: "1.0.0",
          inputs: {
            answers: {
              kind: "literal",
              value: Array.from({ length: 9 }, () => "arbitrary answer"),
            },
          },
        },
        {
          id: "industry",
          capabilityId: "profile.industry-preference",
          version: "1.0.0",
          inputs: { preference: { kind: "literal", value: "fictional industry" } },
        },
      ],
      outputs: { selections: { kind: "step", stepId: "selection", output: "selections" } },
      coverage: [
        {
          requirementId: "selection",
          status: "partial",
          stepIds: ["selection"],
          reason: "Fictional fixture only, no verified financial behavior.",
        },
      ],
    };
    expect(validateCapabilityPlan(plan).order).toEqual(["risk", "industry", "selection"]);
    const result = await runCapabilityPlan(plan, {});
    expect(result.outputs.selections).toEqual(["FICTIONAL-SELECTION-NOT-AN-INVESTMENT"]);
  });
});

describe("markdown", () => {
  test("roundtrips plan and preserves optional prose", () => {
    const prose = "# Prototype\n\nHuman explanation.\n```ts\nconst x = 1;\n```";
    const markdown = exportCapabilityMarkdown(fixture(), prose);
    expect(markdown.startsWith(`${prose}\n\n`)).toBe(true);
    expect(parseCapabilityMarkdown(markdown)).toEqual({ plan: fixture(), prose: `${prose}\n\n` });
    expect(parseCapabilityMarkdown(markdown.replaceAll("\n", "\r\n"))).toEqual({
      plan: fixture(),
      prose: `${prose}\n\n`.replaceAll("\n", "\r\n"),
    });
    expect(parseCapabilityMarkdown(`${markdown}After prose.`).prose).toBe(
      `${prose}\n\nAfter prose.`,
    );
  });

  test("requires one exact versioned fence; rejects nested, duplicate, unsafe, non-JSON, malformed", () => {
    const valid = exportCapabilityMarkdown(fixture());
    for (const markdown of [
      "no block",
      valid + valid,
      valid.replace("cd80-capabilities-v1", "cd80-capabilities-v2"),
      valid.replace("```cd80-capabilities-v1", "~~~~cd80-capabilities-v1"),
      `~~~~\n${valid}\n~~~~`,
      valid.slice(0, -5),
      "```cd80-capabilities-v1\n{invalid}\n```",
      '```cd80-capabilities-v1\n{"__proto__":{}}\n```',
      valid.replace(
        '"kind": "input",\n          "name": "query",\n          "contract": "simulation.text@1"',
        '"kind": "literal",\n          "value": {"constructor": {}}',
      ),
      "x".repeat(1_000_001),
    ])
      expect(() => parseCapabilityMarkdown(markdown)).toThrow();
    const malformed = fixture();
    malformed.steps[0]!.inputs = {};
    expect(() => exportCapabilityMarkdown(malformed)).toThrow();
    expect(() => exportCapabilityMarkdown(fixture(), "```cd80-capabilities-v1")).toThrow();
    expect(() => exportCapabilityMarkdown(fixture(), "```ts\nunterminated")).toThrow();
  });
});

describe("generation", () => {
  test("persisted object key order does not change generated source or mutate plans", () => {
    const plan = fixture();
    plan.outputs.literal = {
      kind: "literal",
      value: { z: [{ b: 2, a: 1 }, "first", "second"], a: "unchanged source\ntext" },
    };
    const reversed = JSON.parse(
      JSON.stringify(plan, (_key, value: unknown) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => b.localeCompare(a)))
          : value,
      ),
    ) as CapabilityPlan;
    expect(JSON.stringify(reversed)).not.toBe(JSON.stringify(plan));
    const snapshot = JSON.stringify(plan);
    expect(generateCapabilityTypeScript(reversed)).toBe(generateCapabilityTypeScript(plan));
    expect(JSON.stringify(plan)).toBe(snapshot);
    expect(JSON.parse(canonicalCapabilityJson(plan, 2))).toEqual(plan);
    expect(canonicalCapabilityJson({ z: [2, 1], a: { z: false, a: null } })).toBe(
      '{"a":{"a":null,"z":false},"z":[2,1]}',
    );
    expect(canonicalCapabilityJson({ "10": 10, "2": 2 })).toBe('{"10":10,"2":2}');
    expect(canonicalCapabilityJson(Object.assign(Object.create(null), { safe: true }))).toBe(
      '{"safe":true}',
    );
  });

  test("canonical JSON rejects unsafe and non-JSON values without invoking accessors", () => {
    const cycle: unknown[] = [];
    cycle.push(cycle);
    const getter = Object.defineProperty({}, "value", {
      enumerable: true,
      get() {
        throw new Error("Getter invoked");
      },
    });
    for (const value of [
      undefined,
      NaN,
      Infinity,
      1n,
      new Date(),
      cycle,
      getter,
      JSON.parse('{"__proto__":{}}'),
    ])
      expect(() => canonicalCapabilityJson(value)).toThrow();
    expect(() => canonicalCapabilityJson(getter)).toThrow("Expected JSON data property");
  });
  test("deterministic output compiles with strict TypeScript and executes the same registry", async () => {
    const source = generateCapabilityTypeScript(fixture());
    expect(source).toBe(generateCapabilityTypeScript(fixture()));
    expect(source).toContain('"version": "1.0.0"');
    expect(source).toContain("runCapabilityPlan(plan, inputs)");
    const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
    const virtualPath = `${root}/generated-contract-test.ts`;
    const options: ts.CompilerOptions = {
      strict: true,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      paths: {
        "@web-starter/capabilities": [`${root}/src/index.ts`],
        "@web-starter/capabilities/runtime": [`${root}/src/runtime.ts`],
      },
    };
    const host = ts.createCompilerHost(options);
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (path, languageVersion, onError, shouldCreateNewSourceFile) =>
      path === virtualPath
        ? ts.createSourceFile(path, source, languageVersion, true)
        : original(path, languageVersion, onError, shouldCreateNewSourceFile);
    const program = ts.createProgram([virtualPath], options, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))).toEqual(
      [],
    );
    // Execute in memory without writing artifacts or needing a workspace install/link.
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
    }).outputText;
    const exported: { runGenerated?: (inputs: Record<string, unknown>) => Promise<unknown> } = {};
    runInNewContext(js, {
      require(name: string) {
        expect(name).toBe("@web-starter/capabilities/runtime");
        return { runCapabilityPlan };
      },
      exports: exported,
    });
    expect(await exported.runGenerated!({ query: "fixture" })).toEqual(
      await runCapabilityPlan(fixture(), { query: "fixture" }),
    );
  });

  test("refuses unresolved mock plans", () => {
    const invalid = fixture();
    invalid.steps[0]!.version = "unknown";
    expect(() => generateCapabilityTypeScript(invalid)).toThrow();
  });
});
