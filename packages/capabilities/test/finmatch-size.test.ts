import { expect, test } from "bun:test";
import { z } from "zod";
import {
  capabilityContractSchemas,
  capabilityContractExamples,
  finmatchRiskCompanySizePolicy,
  mapRiskToCompanySize,
  resolveCapabilityDefinition,
  validateCapabilityPlan,
} from "../src/index";
import type { CapabilityPlan } from "../src/index";
import { scoreRiskQuestionnaire, normalizeIndustryPreference } from "../src/finmatch";
import {
  capabilityImplementationSources,
  capabilityRegistry,
  generateCapabilityTypeScript,
  publicCapabilityResult,
  runCapabilityPlan,
} from "../src/runtime";

const schema = capabilityContractSchemas["finmatch.company-size-result@1"];
const risk = () => structuredClone(capabilityContractExamples["finmatch.risk-result@v0-demo"]);

test("pinned policy maps every boundary from both summary and complete scorer results", () => {
  for (const [total_score, risk_profile_bucket, company_size] of [
    [7, "low", "large"],
    [11, "low", "large"],
    [12, "medium", "medium"],
    [16, "medium", "medium"],
    [17, "high", "small"],
    [21, "high", "small"],
  ] as const) {
    let remaining = total_score - 7;
    const answers = Object.fromEntries(
      Array.from({ length: 7 }, (_, index) => {
        const extra = Math.min(remaining, 2);
        remaining -= extra;
        return [`q${index + 1}`, 1 + extra];
      }),
    );
    const full = scoreRiskQuestionnaire({ questionnaire_version: "v0-demo", answers });
    for (const risk_result of [
      { questionnaire_version: "v0-demo", total_score, risk_profile_bucket },
      full,
    ]) {
      const before = structuredClone(risk_result);
      const result = mapRiskToCompanySize({ risk_result });
      expect(result).toEqual({
        mapping_status: "mapped",
        mapping_policy_id: "finmatch-risk-company-size",
        mapping_policy_version: "1.0.0",
        questionnaire_version: "v0-demo",
        total_score,
        risk_profile_bucket,
        company_size,
      });
      expect(schema.safeParse(result).success).toBe(true);
      expect(risk_result).toEqual(before);
    }
  }
  expect(Object.isFrozen(finmatchRiskCompanySizePolicy)).toBe(true);
  expect(Object.isFrozen(finmatchRiskCompanySizePolicy.bucket_to_company_size)).toBe(true);
  expect(() => z.toJSONSchema(schema)).not.toThrow();
});

test("preferences preserve explicit order and balanced coverage without inferred industries", () => {
  for (const industry_preference of [
    normalizeIndustryPreference(["energy", "technology", "finance"]),
    normalizeIndustryPreference([]),
  ]) {
    const request = { risk_result: risk(), industry_preference };
    const before = structuredClone(request);
    const result = mapRiskToCompanySize(request);
    expect(result).toMatchObject({
      mapping_status: "mapped",
      company_size: "medium",
      industry_preference,
    });
    expect(result).not.toHaveProperty("risk_aligned_industries");
    expect(result).not.toHaveProperty("industry_preference_comparison");
    expect(request).toEqual(before);
  }
  expect(mapRiskToCompanySize({ risk_result: risk() })).not.toHaveProperty("industry_preference");
});

test("registered handler returns structured failures for malformed requests and inconsistent risk", async () => {
  const entry = capabilityRegistry.resolve("CAP-003", "0.3.0");
  for (const request of [
    null,
    1,
    "bad",
    [],
    {},
    { unexpected: true },
    { risk_result: risk(), mapping_policy: null },
    ...[
      null,
      1,
      "bad",
      [],
      {},
      { ...risk(), total_score: 6 },
      { ...risk(), total_score: 22 },
      { ...risk(), total_score: 15.5 },
      { ...risk(), total_score: "15" },
      { ...risk(), risk_profile_bucket: "low" },
      { ...risk(), risk_profile_bucket: "unknown" },
      { ...risk(), answers: { q1: 1 } },
      { ...risk(), answers: { ...risk().answers, q1: 1 } },
      { ...risk(), extra: true },
    ].map((risk_result) => ({ risk_result })),
  ]) {
    const result = await entry.invoke(request);
    expect(result).toMatchObject({
      mapping_result: { mapping_status: "invalid_input", error_code: "INVALID_RISK_RESULT" },
    });
    expect(schema.safeParse(result.mapping_result).success).toBe(true);
    for (const key of [
      "total_score",
      "risk_profile_bucket",
      "company_size",
      "risk_aligned_industries",
    ])
      expect(result.mapping_result).not.toHaveProperty(key);
  }
  expect(
    await entry.invoke({ risk_result: { ...risk(), questionnaire_version: "v1" } }),
  ).toMatchObject({
    mapping_result: {
      mapping_status: "invalid_input",
      error_code: "UNSUPPORTED_QUESTIONNAIRE_VERSION",
    },
  });
  for (const industry_preference of [
    null,
    1,
    "bad",
    [],
    {},
    { selection_mode: "selected", selected_industries: [] },
    { selection_mode: "selected", selected_industries: ["invented"] },
    { selection_mode: "selected", selected_industries: ["energy", "energy"] },
    { selection_mode: "balanced_coverage", selected_industries: ["energy"] },
  ])
    expect(await entry.invoke({ risk_result: risk(), industry_preference })).toMatchObject({
      mapping_result: {
        mapping_status: "invalid_input",
        error_code: "INVALID_INDUSTRY_PREFERENCE",
      },
    });
});

test("result schema rejects wrong policy, size, score/bucket and fabricated output fields", () => {
  const result = mapRiskToCompanySize({ risk_result: risk() });
  for (const patch of [
    { mapping_policy_id: "other" },
    { mapping_policy_version: "2.0.0" },
    { questionnaire_version: "v1" },
    { company_size: "small" },
    { total_score: 11 },
    { total_score: 22 },
    { risk_profile_bucket: "low" },
    { risk_aligned_industries: ["energy"] },
    { answers: risk().answers },
    {
      industry_preference: { selection_mode: "balanced_coverage", selected_industries: ["energy"] },
    },
  ])
    expect(schema.safeParse({ ...result, ...patch }).success).toBe(false);
  expect(schema.safeParse({ mapping_status: "mapping_not_configured" }).success).toBe(false);
});

const plan = (): CapabilityPlan => ({
  schemaVersion: 1,
  requirements: [
    {
      id: "size",
      text: "Apply categorical size product rule",
      assetTypes: ["stocks"],
      markets: ["China"],
    },
  ],
  steps: [
    {
      id: "mapping",
      capabilityId: "CAP-003",
      version: "0.3.0",
      inputs: {
        risk_result: { kind: "step", stepId: "risk", output: "risk_result" },
        industry_preference: { kind: "step", stepId: "preference", output: "industry_preference" },
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
  ],
  coverage: [
    {
      requirementId: "size",
      status: "partial",
      stepIds: ["mapping", "risk", "preference"],
      reason: "Unverified product rule, not financial validation.",
    },
  ],
  outputs: {
    mapping: { kind: "step", stepId: "mapping", output: "mapping_result" },
    privateRisk: { kind: "step", stepId: "risk", output: "risk_result" },
  },
  gaps: [],
  questions: [],
  assumptions: [],
});

test("scorer and optional preference compose into the new pinned handler with safe public projection", async () => {
  for (const industries of [["energy", "technology"], []]) {
    const p = plan();
    expect(validateCapabilityPlan(p)).toMatchObject({ executable: true, productionReady: false });
    const raw = await runCapabilityPlan(p, {
      submission: capabilityContractExamples["finmatch.questionnaire-submission@v0-demo"],
      industries,
    });
    expect(raw.outputs.mapping).toMatchObject({
      mapping_status: "mapped",
      company_size: "medium",
      total_score: 15,
      risk_profile_bucket: "medium",
      industry_preference: normalizeIndustryPreference(industries),
    });
    expect(raw.provenance).toMatchObject({ simulated: false, unverified: true });
    const snapshot = structuredClone(raw);
    const visible = publicCapabilityResult(p, raw);
    expect(visible.outputs.mapping).toEqual({
      mapping_status: "mapped",
      mapping_policy_id: "finmatch-risk-company-size",
      mapping_policy_version: "1.0.0",
      questionnaire_version: "v0-demo",
      company_size: "medium",
      industry_preference: normalizeIndustryPreference(industries),
    });
    expect(visible.results.risk).toEqual({});
    expect(visible.outputs).not.toHaveProperty("privateRisk");
    for (const key of ["total_score", "risk_profile_bucket", "answers", "risk_aligned_industries"])
      expect(JSON.stringify(visible)).not.toContain(`"${key}"`);
    expect(raw).toEqual(snapshot);
    delete p.steps[0]!.inputs.industry_preference;
    p.steps = p.steps.filter(({ id }) => id !== "preference");
    p.coverage[0]!.stepIds = ["mapping", "risk"];
    expect(validateCapabilityPlan(p).executable).toBe(true);
    expect(
      (
        await runCapabilityPlan(p, {
          submission: capabilityContractExamples["finmatch.questionnaire-submission@v0-demo"],
        })
      ).outputs.mapping,
    ).not.toHaveProperty("industry_preference");
  }
});

test("new catalog, generated code and fingerprint are pinned without replacing legacy behavior", async () => {
  const definition = resolveCapabilityDefinition("CAP-003", "0.3.0")!;
  expect(definition.status).toBe("unverified");
  expect(definition.evidence.verified).toBe(false);
  expect(definition.optionalInputs).toEqual(["industry_preference"]);
  expect(definition.outputs).toEqual({ mapping_result: "finmatch.company-size-result@1" });
  expect(definition.sourceDocuments).toContain(
    "capability-resources/capability_library/finmatch-risk-to-company-size-mapping-capability.md",
  );
  expect(Object.isFrozen(definition)).toBe(true);
  expect(definition.constraints.join(" ")).toContain("company.size");
  const p = plan();
  p.steps = [
    {
      id: "mapping",
      capabilityId: "CAP-003",
      version: "0.3.0",
      inputs: {
        risk_result: { kind: "input", name: "risk", contract: "finmatch.risk-request@1" },
      },
    },
  ];
  p.coverage[0]!.stepIds = ["mapping"];
  delete p.outputs.privateRisk;
  const generated = generateCapabilityTypeScript(p);
  expect(generated).toContain('"risk": CapabilityContractValues["finmatch.risk-request@1"]');
  expect(generated).toContain('"version": "0.3.0"');
  expect(generated).not.toContain("SimulationContractValues");
  expect((await runCapabilityPlan(p, { risk: null })).outputs.mapping).toMatchObject({
    error_code: "INVALID_RISK_RESULT",
  });
  p.steps[0]!.inputs.mapping_policy = { kind: "literal", value: null };
  expect(validateCapabilityPlan(p).issues.map(({ code }) => code)).toContain("UNKNOWN_INPUT_PORT");
  const source = capabilityImplementationSources("CAP-003", "0.3.0");
  for (const part of [
    "mapRiskToCompanySize",
    "bucketForScore",
    "Number.isInteger(risk.total_score)",
    "finmatch-risk-company-size",
    "bucket_to_company_size",
    "finmatch.company-size-result@1",
    "1.0.0",
  ])
    expect(source).toContain(part);
  expect(
    await capabilityRegistry.resolve("CAP-003", "0.2.0").invoke({ risk_result: risk() }),
  ).toMatchObject({
    mapping_result: {
      mapping_status: "mapping_not_configured",
      error_code: "MAPPING_POLICY_MISSING",
      risk_aligned_industries: [],
    },
  });
  expect(resolveCapabilityDefinition("CAP-003", "0.2.0")!.outputs).toEqual({
    mapping_result: "finmatch.mapping-result@1",
  });
});
