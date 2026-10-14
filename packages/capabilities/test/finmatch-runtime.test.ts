import { expect, test } from "bun:test";
import { rejects } from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import {
  capabilityContractSchemas,
  capabilityContractExamples,
  capabilityDefinitions,
  finmatchContractExamples,
  getCapabilityPorts,
  contractAccepts,
  validateCapabilityPlan,
} from "../src/index";
import type { CapabilityPlan } from "../src/index";
import {
  capabilityImplementationSources,
  capabilityRegistry,
  createCapabilityRegistry,
  generateCapabilityTypeScript,
  publicCapabilityResult,
  runCapabilityPlan,
  UNVERIFIED_CAPABILITY_WARNING,
} from "../src/runtime";
import { finmatchImplementations } from "../src/finmatch";

const inputs = () => ({
  industries: ["technology", "energy", "technology"],
  submission: structuredClone(
    finmatchContractExamples["finmatch.questionnaire-submission@v0-demo"],
  ),
});
const plan = (): CapabilityPlan => ({
  schemaVersion: 1,
  requirements: [
    {
      id: "profile",
      text: "Developer-draft preference and risk mapping",
      assetTypes: ["stocks"],
      markets: ["China"],
    },
  ],
  steps: [
    {
      id: "mapping",
      capabilityId: "CAP-003",
      version: "0.2.0",
      inputs: {
        risk_result: { kind: "step", stepId: "risk", output: "risk_result" },
        industry_preference: { kind: "step", stepId: "preference", output: "industry_preference" },
      },
    },
    {
      id: "preference",
      capabilityId: "CAP-001",
      version: "0.2.0",
      inputs: {
        selected_industries: {
          kind: "input",
          name: "industries",
          contract: "finmatch.industry-selection@1",
        },
      },
    },
    {
      id: "risk",
      capabilityId: "CAP-002",
      version: "0.2.0",
      inputs: {
        submission: {
          kind: "input",
          name: "submission",
          contract: "finmatch.questionnaire-submission@v0-demo",
        },
      },
    },
  ],
  coverage: [
    {
      requirementId: "profile",
      status: "partial",
      stepIds: ["preference", "risk", "mapping"],
      reason: "Unverified developer draft, no approved mapping policy.",
    },
  ],
  outputs: {
    preference: { kind: "step", stepId: "preference", output: "industry_preference" },
    riskAlias: { kind: "step", stepId: "risk", output: "risk_result" },
    mapping: { kind: "step", stepId: "mapping", output: "mapping_result" },
  },
  gaps: ["Mapping policy approval is unresolved."],
  questions: [],
  assumptions: [],
});
const policy = {
  policy_id: "test-supplied-not-approved",
  policy_version: "1",
  questionnaire_versions: ["v0-demo"],
  bucket_to_industries: {
    low: ["finance"],
    medium: ["energy", "energy", "manufacturing"],
    high: ["technology"],
  },
};

test("exact frozen unverified Finmatch entries have source references and schema examples", async () => {
  const definitions = capabilityDefinitions.filter((definition) => definition.status !== "mock");
  expect(definitions.map(({ id, version }) => `${id}@${version}`)).toEqual([
    "CAP-001@0.2.0",
    "CAP-002@0.2.0",
    "CAP-003@0.2.0",
    "CAP-003@0.3.0",
  ]);
  for (const definition of definitions) {
    expect(definition.status).toBe("unverified");
    expect(definition.evidence.verified).toBe(false);
    expect(definition.sourceDocuments).toEqual(definition.evidence.references);
    expect(definition.sourceDocuments!.length).toBeGreaterThan(0);
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.sourceDocuments)).toBe(true);
    const input = Object.fromEntries(
      Object.entries(getCapabilityPorts(definition, "inputs")!).map(([name, contract]) => [
        name,
        capabilityContractExamples[contract as keyof typeof capabilityContractExamples],
      ]),
    );
    const entry = capabilityRegistry.resolve(definition.id, definition.version);
    const result = await entry.invoke(input);
    expect(Object.keys(result)).toEqual(Object.keys(getCapabilityPorts(definition, "outputs")!));
    for (const [name, contract] of Object.entries(getCapabilityPorts(definition, "outputs")!))
      expect(
        capabilityContractSchemas[contract as keyof typeof capabilityContractSchemas].safeParse(
          result[name],
        ).success,
      ).toBe(true);
    if (definition.inputValidation === "handler") {
      for (const raw of [{ ...input, unknown: true }, {}])
        expect(await entry.invoke(raw)).toMatchObject({
          mapping_result: { mapping_status: "invalid_input", error_code: "INVALID_RISK_RESULT" },
        });
    } else {
      await rejects(entry.invoke({ ...input, unknown: true }));
      await rejects(entry.invoke({}));
    }
    expect(() => capabilityRegistry.resolve(definition.id, "0.1.0")).toThrow();
  }
  for (const [contract, value] of Object.entries(finmatchContractExamples))
    expect(
      capabilityContractSchemas[contract as keyof typeof capabilityContractSchemas].safeParse(value)
        .success,
    ).toBe(true);
  expect(Object.keys(capabilityContractExamples).sort()).toEqual(
    Object.keys(capabilityContractSchemas).sort(),
  );
  for (const [contract, value] of Object.entries(capabilityContractExamples))
    expect(
      capabilityContractSchemas[contract as keyof typeof capabilityContractSchemas].safeParse(value)
        .success,
    ).toBe(true);
});

test("composed preference, questionnaire and mapping execute without mock provenance or guessed policy", async () => {
  const p = plan();
  expect(validateCapabilityPlan(p)).toMatchObject({
    executable: true,
    productionReady: false,
    order: ["risk", "preference", "mapping"],
  });
  const result = await runCapabilityPlan(p, inputs());
  expect(result.provenance).toEqual({
    simulated: false,
    unverified: true,
    warning: UNVERIFIED_CAPABILITY_WARNING,
  });
  expect(result.outputs.preference).toEqual({
    selection_mode: "selected",
    selected_industries: ["technology", "energy"],
  });
  expect(result.outputs.riskAlias).toMatchObject({
    total_score: 15,
    risk_profile_bucket: "medium",
    answers: inputs().submission.answers,
  });
  expect(result.outputs.mapping).toMatchObject({
    mapping_status: "mapping_not_configured",
    error_code: "MAPPING_POLICY_MISSING",
    risk_aligned_industries: [],
  });
  await rejects(runCapabilityPlan(p, { ...inputs(), extra: true }));
  await rejects(runCapabilityPlan(p, { ...inputs(), industries: ["invented"] }));
  await rejects(
    runCapabilityPlan(p, {
      ...inputs(),
      submission: { questionnaire_version: "v0-demo", answers: { q1: 1 } },
    }),
  );
  delete p.steps[0]!.inputs.industry_preference;
  expect(validateCapabilityPlan(p).executable).toBe(true);
  delete p.steps[0]!.inputs.risk_result;
  expect(validateCapabilityPlan(p).issues.some((issue) => issue.code === "MISSING_BINDING")).toBe(
    true,
  );
});

test("optional policy and preference bind explicitly with structured shape and semantic errors", async () => {
  const p = plan();
  p.steps[0]!.inputs.mapping_policy = {
    kind: "input",
    name: "policy",
    contract: "finmatch.mapping-policy-request@1",
  };
  const mapped = await runCapabilityPlan(p, { ...inputs(), policy });
  expect(mapped.outputs.mapping).toMatchObject({
    mapping_status: "mapped",
    mapping_policy_id: "test-supplied-not-approved",
    risk_aligned_industries: ["energy", "manufacturing"],
    industry_preference_comparison: {
      user_selected_industries: ["technology", "energy"],
      overlap_industries: ["energy"],
      selected_outside_mapping: ["technology"],
    },
  });
  expect((await runCapabilityPlan(p, { ...inputs(), policy: null })).outputs.mapping).toMatchObject(
    { error_code: "MAPPING_POLICY_MISSING" },
  );
  expect((await runCapabilityPlan(p, { ...inputs(), policy: {} })).outputs.mapping).toMatchObject({
    mapping_status: "invalid_input",
    error_code: "INVALID_MAPPING_POLICY",
  });
  await rejects(runCapabilityPlan(p, inputs()));
  const entry = capabilityRegistry.resolve("CAP-003", "0.2.0");
  expect(
    await entry.invoke({
      risk_result: {
        questionnaire_version: "v0-demo",
        total_score: 15,
        risk_profile_bucket: "low",
      },
    }),
  ).toMatchObject({ mapping_result: { error_code: "INVALID_RISK_RESULT" } });
  expect(await entry.invoke({ risk_result: { total_score: "15" } })).toMatchObject({
    mapping_result: { mapping_status: "invalid_input", error_code: "INVALID_RISK_RESULT" },
  });
  expect(
    await entry.invoke({
      risk_result: finmatchContractExamples["finmatch.risk-result@v0-demo"],
      mapping_policy: policy,
      industry_preference: null,
    }),
  ).toMatchObject({
    mapping_result: { mapping_status: "invalid_input", error_code: "INVALID_INDUSTRY_PREFERENCE" },
  });
  p.steps[0]!.inputs.industry_preference = { kind: "step", stepId: "risk", output: "risk_result" };
  expect(validateCapabilityPlan(p).issues.some((issue) => issue.code === "CONTRACT_MISMATCH")).toBe(
    true,
  );
});

test("registry optional metadata applies only to named input ports", async () => {
  const definition = capabilityDefinitions.find(({ id }) => id === "CAP-003")!;
  for (const patch of [{ optionalInputs: ["guessed"] }, { internalOutputs: ["guessed"] }])
    expect(() =>
      createCapabilityRegistry([{ ...definition, ...patch }], capabilityContractSchemas, {
        "CAP-003@0.2.0": finmatchImplementations["CAP-003@0.2.0"],
      }),
    ).toThrow("metadata drift");
  const registry = createCapabilityRegistry([definition], capabilityContractSchemas, {
    "CAP-003@0.2.0": { ...finmatchImplementations["CAP-003@0.2.0"], invoke: () => ({}) },
  });
  await rejects(
    registry
      .resolve("CAP-003", "0.2.0")
      .invoke({ risk_result: finmatchContractExamples["finmatch.risk-result@v0-demo"] }),
  );
});

test("registered mapping returns stable failures for every malformed JSON field and request shape", async () => {
  const entry = capabilityRegistry.resolve("CAP-003", "0.2.0");
  const risk = finmatchContractExamples["finmatch.risk-result@v0-demo"];
  for (const raw of [null, 1, "request", [], {}, { unexpected: true }])
    expect(await entry.invoke(raw)).toMatchObject({
      mapping_result: {
        mapping_status: "invalid_input",
        error_code: "INVALID_RISK_RESULT",
        risk_aligned_industries: [],
      },
    });
  for (const malformed of [
    null,
    1,
    "bad",
    [],
    {},
    { total_score: "15" },
    { ...risk, answers: { q1: 1 } },
  ])
    expect(await entry.invoke({ risk_result: malformed })).toMatchObject({
      mapping_result: {
        mapping_status: "invalid_input",
        error_code: "INVALID_RISK_RESULT",
        risk_aligned_industries: [],
      },
    });
  for (const malformed of [1, "bad", [], {}, { ...policy, bucket_to_industries: null }])
    expect(await entry.invoke({ risk_result: risk, mapping_policy: malformed })).toMatchObject({
      mapping_result: {
        mapping_status: "invalid_input",
        error_code: "INVALID_MAPPING_POLICY",
        risk_aligned_industries: [],
      },
    });
  for (const malformed of [
    null,
    1,
    "bad",
    [],
    {},
    { selection_mode: "selected", selected_industries: ["invented"] },
  ])
    expect(
      await entry.invoke({
        risk_result: risk,
        mapping_policy: policy,
        industry_preference: malformed,
      }),
    ).toMatchObject({
      mapping_result: {
        mapping_status: "invalid_input",
        error_code: "INVALID_INDUSTRY_PREFERENCE",
        risk_aligned_industries: [],
      },
    });
});

test("external request contracts deliver malformed literals and app inputs to mapping without weakening strict consumers", async () => {
  const p = plan();
  p.steps = [
    {
      id: "mapping",
      capabilityId: "CAP-003",
      version: "0.2.0",
      inputs: {
        risk_result: { kind: "input", name: "risk", contract: "finmatch.risk-request@1" },
        mapping_policy: {
          kind: "input",
          name: "policy",
          contract: "finmatch.mapping-policy-request@1",
        },
        industry_preference: {
          kind: "input",
          name: "preference",
          contract: "finmatch.industry-preference-request@1",
        },
      },
    },
  ];
  p.outputs = { mapping: { kind: "step", stepId: "mapping", output: "mapping_result" } };
  p.coverage[0]!.stepIds = ["mapping"];
  expect(validateCapabilityPlan(p).executable).toBe(true);
  const risk = finmatchContractExamples["finmatch.risk-result@v0-demo"];
  for (const [values, code] of [
    [{ risk: { total_score: "15" }, policy, preference: null }, "INVALID_RISK_RESULT"],
    [
      {
        risk,
        policy: "malformed",
        preference: finmatchContractExamples["finmatch.industry-preference@1"],
      },
      "INVALID_MAPPING_POLICY",
    ],
    [{ risk, policy, preference: 1 }, "INVALID_INDUSTRY_PREFERENCE"],
  ] as const)
    expect((await runCapabilityPlan(p, values)).outputs.mapping).toMatchObject({
      mapping_status: "invalid_input",
      error_code: code,
      risk_aligned_industries: [],
    });
  const entry = capabilityRegistry.resolve("CAP-003", "0.2.0");
  expect(await entry.invoke({ risk_result: risk, industry_preference: null })).toMatchObject({
    mapping_result: { error_code: "INVALID_INDUSTRY_PREFERENCE" },
  });
  p.steps[0]!.inputs.risk_result = { kind: "literal", value: null };
  expect(validateCapabilityPlan(p).executable).toBe(true);
  expect((await runCapabilityPlan(p, { policy, preference: null })).outputs.mapping).toMatchObject({
    error_code: "INVALID_RISK_RESULT",
  });
  p.steps[0]!.inputs.risk_result = {
    kind: "input",
    name: "risk",
    contract: "finmatch.risk-result@v0-demo",
  };
  await rejects(runCapabilityPlan(p, { risk: { total_score: "15" }, policy, preference: null }));
  p.steps.push({
    id: "strict-consumer",
    capabilityId: "CAP-002",
    version: "0.2.0",
    inputs: {
      submission: { kind: "input", name: "risk", contract: "finmatch.risk-request@1" },
    },
  });
  expect(validateCapabilityPlan(p).issues.map(({ code }) => code)).toContain("CONTRACT_MISMATCH");
  expect(validateCapabilityPlan(p).issues.map(({ code }) => code)).toContain(
    "INPUT_CONTRACT_CONFLICT",
  );
  expect(generateCapabilityTypeScript(plan())).toContain("CapabilityContractValues");
});

test("assignability is explicit, directional and frozen, not broad JSON structural compatibility", () => {
  expect(contractAccepts).toEqual({
    "finmatch.risk-request@1": ["finmatch.risk-result@v0-demo"],
    "finmatch.industry-preference-request@1": ["finmatch.industry-preference@1"],
    "finmatch.mapping-policy-request@1": ["finmatch.mapping-policy@1"],
  });
  expect(Object.isFrozen(contractAccepts)).toBe(true);
  expect(Object.isFrozen(contractAccepts["finmatch.risk-request@1"])).toBe(true);
  const p = plan();
  p.steps[0]!.inputs.mapping_policy = {
    kind: "input",
    name: "policy",
    contract: "finmatch.mapping-policy@1",
  };
  expect(validateCapabilityPlan(p).executable).toBe(true);
  p.steps[0]!.inputs.mapping_policy = {
    kind: "input",
    name: "policy",
    contract: "finmatch.risk-request@1",
  };
  expect(validateCapabilityPlan(p).issues.map(({ code }) => code)).toContain("CONTRACT_MISMATCH");
});

test("request bounds reject non-JSON, unsafe, cyclic and oversized values before recursive validation", async () => {
  const entry = capabilityRegistry.resolve("CAP-003", "0.2.0");
  const cycle: unknown[] = [];
  cycle.push(cycle);
  let deep: unknown = null;
  for (let index = 0; index < 14; index++) deep = [deep];
  let getterInvoked = false;
  const getter = Object.defineProperty({}, "risk_result", {
    enumerable: true,
    get() {
      getterInvoked = true;
      return {};
    },
  });
  for (const value of [
    undefined,
    NaN,
    Infinity,
    1n,
    new Date(),
    cycle,
    deep,
    getter,
    "x".repeat(32769),
    JSON.parse('{"__proto__":{}}'),
    Array.from({ length: 129 }, () => null),
  ]) {
    await rejects(entry.invoke(value));
    expect(capabilityContractSchemas["finmatch.risk-request@1"].safeParse(value).success).toBe(
      false,
    );
  }
  expect(getterInvoked).toBe(false);
  expect(capabilityImplementationSources("CAP-003", "0.2.0")).toContain("isBoundedFinmatchRequest");
  expect(capabilityImplementationSources("CAP-003", "0.2.0")).toContain("contractAccepts");
});

test("public projection removes private ports, aliases and nested risk fields without mutating trusted results", async () => {
  const p = plan();
  p.outputs.nested = {
    kind: "literal",
    value: {
      rows: [
        { total_score: 15, risk_profile_bucket: "medium", answers: { q1: 1 }, visible: "kept" },
      ],
    },
  };
  p.outputs.externalRisk = {
    kind: "input",
    name: "riskSummary",
    contract: "finmatch.risk-result@v0-demo",
  };
  const raw = await runCapabilityPlan(p, {
    ...inputs(),
    riskSummary: finmatchContractExamples["finmatch.risk-result@v0-demo"],
  });
  const snapshot = structuredClone(raw);
  const publicResult = publicCapabilityResult(p, raw);
  expect(publicResult.results.risk).toEqual({});
  expect(Object.hasOwn(publicResult.outputs, "riskAlias")).toBe(false);
  expect(publicResult.outputs.nested).toEqual({ rows: [{ visible: "kept" }] });
  expect(publicResult.outputs.externalRisk).toEqual({ questionnaire_version: "v0-demo" });
  for (const key of ["total_score", "risk_profile_bucket", "answers"])
    expect(JSON.stringify(publicResult)).not.toContain(`"${key}"`);
  expect(publicResult.outputs.mapping).toMatchObject({
    error_code: "MAPPING_POLICY_MISSING",
    risk_aligned_industries: [],
  });
  expect(publicResult.provenance).toEqual(raw.provenance);
  expect(raw).toEqual(snapshot);
});

test("mixed execution preserves the exact mock warning", async () => {
  const p = plan();
  p.steps.push({
    id: "mock",
    capabilityId: "research.market",
    version: "1.0.0",
    inputs: { query: { kind: "literal", value: "fixture" } },
  });
  expect((await runCapabilityPlan(p, inputs())).provenance).toMatchObject({
    simulated: true,
    unverified: true,
    warning:
      "Prototype-only arbitrary fixtures; not financial advice, live data, verified analysis, or a real risk classification.",
  });
});

test("fingerprints include every Finmatch function, helper, contracts and private-port metadata", () => {
  for (const id of ["CAP-001", "CAP-002", "CAP-003", "research.market"]) {
    const source = capabilityImplementationSources(id, id.startsWith("CAP-") ? "0.2.0" : "1.0.0");
    for (const part of [
      "bucketForScore",
      "normalizeIndustryPreference",
      "scoreRiskQuestionnaire",
      "mapRiskToIndustries",
      "finmatch.mapping-result@1",
      "internalOutputs",
      "optionalInputs",
      "sourceDocuments",
    ])
      expect(source).toContain(part);
  }
});

test("generated Finmatch TypeScript infers merged contracts, compiles strictly and executes identically", async () => {
  const p = plan();
  p.steps[0]!.inputs.mapping_policy = {
    kind: "input",
    name: "policy",
    contract: "finmatch.mapping-policy-request@1",
  };
  const source = generateCapabilityTypeScript(p);
  expect(source).toBe(generateCapabilityTypeScript(p));
  expect(source).toContain(
    '"submission": CapabilityContractValues["finmatch.questionnaire-submission@v0-demo"]',
  );
  expect(source).not.toContain("SimulationContractValues");
  const root = fileURLToPath(new URL("..", import.meta.url)).replace(/\/$/, "");
  const virtualPath = `${root}/generated-finmatch-test.ts`;
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
  expect(
    ts
      .getPreEmitDiagnostics(ts.createProgram([virtualPath], options, host))
      .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
  ).toEqual([]);
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ESNext },
  }).outputText;
  const exported: { runGenerated?: (input: Record<string, unknown>) => Promise<unknown> } = {};
  runInNewContext(js, {
    exports: exported,
    require(name: string) {
      expect(name).toBe("@web-starter/capabilities/runtime");
      return { runCapabilityPlan };
    },
  });
  expect(await exported.runGenerated!({ ...inputs(), policy })).toEqual(
    await runCapabilityPlan(p, { ...inputs(), policy }),
  );
  expect(await exported.runGenerated!({ ...inputs(), policy: "malformed" })).toMatchObject({
    outputs: {
      mapping: {
        mapping_status: "invalid_input",
        error_code: "INVALID_MAPPING_POLICY",
        risk_aligned_industries: [],
      },
    },
  });
});
