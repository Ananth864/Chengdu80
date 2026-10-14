import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  finmatchContractExamples,
  finmatchContractSchemas,
  finmatchDefinitions,
  finmatchImplementations,
  finmatchIndustries,
  finmatchQuestionnaire,
  mapRiskToIndustries,
  normalizeIndustryPreference,
  scoreRiskQuestionnaire,
} from "../src/finmatch";
import type { FinmatchContractId } from "../src/finmatch";
import { contractAccepts } from "../src/definitions";

const submission = () =>
  structuredClone(finmatchContractExamples["finmatch.questionnaire-submission@v0-demo"]);
const risk = () => scoreRiskQuestionnaire(submission());
// Transport fixture only: not an approved or recommended financial mapping.
const policy = () => ({
  policy_id: "test-only-policy",
  policy_version: "test-1",
  questionnaire_versions: ["v0-demo"],
  bucket_to_industries: {
    low: ["agriculture"],
    medium: ["energy", "technology", "energy", "finance"],
    high: ["fmcg"],
  },
});
const mapping = (extra: Record<string, unknown> = {}) =>
  mapRiskToIndustries({
    risk_result: risk(),
    mapping_policy: policy(),
    ...extra,
  });
const failure = (result: ReturnType<typeof mapRiskToIndustries>, status: string, code: string) => {
  expect(result).toMatchObject({
    mapping_status: status,
    error_code: code,
    risk_aligned_industries: [],
  });
  expect(finmatchContractSchemas["finmatch.mapping-result@1"].safeParse(result).success).toBe(true);
  expect(result).not.toHaveProperty("mapping_policy_id");
  expect(result).not.toHaveProperty("industry_preference_comparison");
};

describe("FinMatch contracts and catalog", () => {
  test("examples validate and all schemas export as JSON Schema", () => {
    for (const id of Object.keys(finmatchContractSchemas) as FinmatchContractId[]) {
      expect(finmatchContractSchemas[id].safeParse(finmatchContractExamples[id]).success).toBe(
        true,
      );
      expect(() => z.toJSONSchema(finmatchContractSchemas[id])).not.toThrow();
    }
    expect(finmatchContractExamples["finmatch.mapping-policy@1"]).toBeNull();
    expect(finmatchContractExamples["finmatch.mapping-result@1"].mapping_status).toBe(
      "mapping_not_configured",
    );
  });

  test("exact v0.2 catalog identities, declared handler ports, and no verified claims", () => {
    expect(finmatchDefinitions.map((entry) => entry.id)).toEqual(["CAP-001", "CAP-002", "CAP-003"]);
    for (const entry of finmatchDefinitions) {
      expect(entry.version).toBe("0.2.0");
      expect(entry.status).toBe("unverified");
      expect(entry.evidence.verified).toBe(false);
      expect(entry.evidence.references.length).toBeGreaterThan(0);
      const key = `${entry.id}@${entry.version}` as keyof typeof finmatchImplementations;
      expect(entry.inputs).toEqual(finmatchImplementations[key].inputs);
      expect(entry.outputs).toEqual(finmatchImplementations[key].outputs);
      expect(entry.simulation).toMatchObject({ prototypeOnly: true, inputs: {}, outputs: {} });
    }
    expect(finmatchDefinitions[2]!.optionalInputs).toEqual([
      "mapping_policy",
      "industry_preference",
    ]);
    expect(finmatchDefinitions[2]!.dependencies).toEqual([]);
    expect(contractAccepts[finmatchImplementations["CAP-003@0.2.0"].inputs.risk_result]).toContain(
      finmatchImplementations["CAP-002@0.2.0"].outputs.risk_result,
    );
    expect(
      contractAccepts[finmatchImplementations["CAP-003@0.2.0"].inputs.industry_preference],
    ).toContain(finmatchImplementations["CAP-001@0.2.0"].outputs.industry_preference);
  });

  test("questionnaire copy exactly matches the scoring document", () => {
    const source = readFileSync(
      new URL(
        "../../../capability-resources/capability_library/finmatch-risk-questionnaire-scoring.md",
        import.meta.url,
      ),
      "utf8",
    );
    expect(finmatchQuestionnaire.map((question) => question.id)).toEqual([
      "q1",
      "q2",
      "q3",
      "q4",
      "q5",
      "q6",
      "q7",
    ]);
    expect([...source.matchAll(/^\*\*(.+)\*\*$/gm)].map((match) => match[1])).toEqual(
      finmatchQuestionnaire.map((question) => question.question),
    );
    expect(
      [...source.matchAll(/^- \*\*(Low|Medium|High) \(([123])\):\*\* (.+)$/gm)].map((match) => ({
        label: match[1],
        score: Number(match[2]),
        text: match[3],
      })),
    ).toEqual(
      finmatchQuestionnaire.flatMap((question) =>
        question.choices.map((choice) => ({
          label: String(choice.label),
          score: Number(choice.score),
          text: String(choice.text),
        })),
      ),
    );
  });
});

describe("industry preference normalization", () => {
  test("canonical enum, input order, deduplication, and balanced versus all selected", () => {
    expect(normalizeIndustryPreference(["energy", "technology", "energy", "finance"])).toEqual({
      selection_mode: "selected",
      selected_industries: ["energy", "technology", "finance"],
    });
    expect(normalizeIndustryPreference([])).toEqual({
      selection_mode: "balanced_coverage",
      selected_industries: [],
    });
    expect(normalizeIndustryPreference([...finmatchIndustries])).toEqual({
      selection_mode: "selected",
      selected_industries: [...finmatchIndustries],
    });
    expect(finmatchImplementations["CAP-001@0.2.0"].invoke({ selected_industries: [] })).toEqual({
      industry_preference: { selection_mode: "balanced_coverage", selected_industries: [] },
    });
  });

  test("missing, unknown, wrong-type, or localized values are never treated as no selection", () => {
    for (const value of [
      undefined,
      null,
      {},
      { selected_industries: [] },
      "energy",
      ["Technology"],
      ["tech"],
      [1],
      [" energy"],
      ["energy", null],
    ])
      expect(() => normalizeIndustryPreference(value)).toThrow();
    const schema = finmatchContractSchemas["finmatch.industry-preference@1"];
    for (const value of [
      { selection_mode: "selected", selected_industries: [] },
      { selection_mode: "balanced_coverage", selected_industries: ["energy"] },
      { selection_mode: "unknown", selected_industries: [] },
      { selection_mode: "selected", selected_industries: ["energy", "energy"] },
    ])
      expect(schema.safeParse(value).success).toBe(false);
  });
});

describe("provisional questionnaire scoring", () => {
  test("all 2187 complete answer combinations, preserved answers, and exact output fields", () => {
    const observed = new Set<number>();
    for (let combination = 0; combination < 3 ** 7; combination++) {
      let digits = combination;
      const answers = Object.fromEntries(
        finmatchQuestionnaire.map(({ id }) => {
          const answer = (digits % 3) + 1;
          digits = Math.floor(digits / 3);
          return [id, answer];
        }),
      );
      const input = { questionnaire_version: "v0-demo", answers };
      const before = structuredClone(input);
      const result = scoreRiskQuestionnaire(input);
      const total = Object.values(answers).reduce((sum, answer) => sum + answer, 0);
      observed.add(total);
      expect({
        ...input,
        total_score: total,
        risk_profile_bucket: total <= 11 ? "low" : total <= 16 ? "medium" : "high",
      }).toEqual(result);
      expect(input).toEqual(before);
      expect(result.answers).not.toBe(input.answers);
      expect(Object.keys(result).sort()).toEqual([
        "answers",
        "questionnaire_version",
        "risk_profile_bucket",
        "total_score",
      ]);
    }
    expect([...observed].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 15 }, (_, index) => index + 7),
    );
  });

  test("every missing answer, unknown key, fraction, out-of-range value, and wrong version rejects", () => {
    for (const { id } of finmatchQuestionnaire) {
      const input = { ...submission(), answers: { ...submission().answers } };
      const missing: Record<string, number> = { ...input.answers };
      delete missing[id];
      expect(() => scoreRiskQuestionnaire({ ...input, answers: missing })).toThrow();
      for (const bad of [0, 4, 1.5, "2", null, undefined, NaN, Infinity, [1, 2]])
        expect(() =>
          scoreRiskQuestionnaire({ ...input, answers: { ...input.answers, [id]: bad } }),
        ).toThrow();
    }
    for (const input of [
      {},
      { answers: submission().answers },
      { ...submission(), questionnaire_version: "v1" },
      { ...submission(), answers: { ...submission().answers, q8: 1 } },
      { ...submission(), timestamp: 1 },
    ])
      expect(() => scoreRiskQuestionnaire(input)).toThrow();
    expect(scoreRiskQuestionnaire(submission())).toEqual(risk());
    expect(finmatchImplementations["CAP-002@0.2.0"].invoke({ submission: submission() })).toEqual({
      risk_result: risk(),
    });
  });
});

describe("explicit policy mapping", () => {
  test("no missing or null policy ever produces guessed industries, even with preferences", () => {
    for (const mapping_policy of [undefined, null]) {
      const result = mapRiskToIndustries({
        risk_result: risk(),
        mapping_policy,
        industry_preference: normalizeIndustryPreference(["energy"]),
      });
      failure(result, "mapping_not_configured", "MAPPING_POLICY_MISSING");
      expect(result).toMatchObject({
        questionnaire_version: "v0-demo",
        total_score: 15,
        risk_profile_bucket: "medium",
      });
    }
    failure(
      finmatchImplementations["CAP-003@0.2.0"].invoke({ risk_result: risk() }).mapping_result,
      "mapping_not_configured",
      "MAPPING_POLICY_MISSING",
    );
  });

  test("policy order and deduplication; comparisons retain user order and outside selections", () => {
    const industry_preference = normalizeIndustryPreference([
      "finance",
      "manufacturing",
      "energy",
      "technology",
    ]);
    const request = { risk_result: risk(), mapping_policy: policy(), industry_preference };
    const before = structuredClone(request);
    const result = mapRiskToIndustries(request);
    expect(result).toEqual({
      mapping_status: "mapped",
      mapping_policy_id: "test-only-policy",
      mapping_policy_version: "test-1",
      questionnaire_version: "v0-demo",
      total_score: 15,
      risk_profile_bucket: "medium",
      risk_aligned_industries: ["energy", "technology", "finance"],
      industry_preference_comparison: {
        selection_mode: "selected",
        user_selected_industries: ["finance", "manufacturing", "energy", "technology"],
        overlap_industries: ["finance", "energy", "technology"],
        selected_outside_mapping: ["manufacturing"],
      },
    });
    expect(request).toEqual(before);
    expect(result).not.toHaveProperty("error_code");
    expect(result).not.toHaveProperty("message");
    expect(mapping()).not.toHaveProperty("industry_preference_comparison");
    expect(mapping({ industry_preference: normalizeIndustryPreference([]) })).toMatchObject({
      risk_aligned_industries: ["energy", "technology", "finance"],
      industry_preference_comparison: {
        selection_mode: "balanced_coverage",
        user_selected_industries: [],
        overlap_industries: [],
        selected_outside_mapping: [],
      },
    });
  });

  test("summary handoffs and exact band boundaries", () => {
    for (const [total_score, risk_profile_bucket, industries] of [
      [7, "low", ["agriculture"]],
      [11, "low", ["agriculture"]],
      [12, "medium", ["energy", "technology", "finance"]],
      [16, "medium", ["energy", "technology", "finance"]],
      [17, "high", ["fmcg"]],
      [21, "high", ["fmcg"]],
    ] as const) {
      expect(
        mapping({
          risk_result: { questionnaire_version: "v0-demo", total_score, risk_profile_bucket },
        }),
      ).toMatchObject({
        mapping_status: "mapped",
        total_score,
        risk_profile_bucket,
        risk_aligned_industries: [...industries],
      });
    }
  });

  test("invalid policy shapes and inapplicable coverage have stable distinct failures", () => {
    for (const mapping_policy of [
      {},
      "policy",
      [],
      1,
      { ...policy(), policy_id: "" },
      { ...policy(), policy_version: " " },
      { ...policy(), questionnaire_versions: [] },
      { ...policy(), bucket_to_industries: { medium: ["energy"] } },
      { ...policy(), bucket_to_industries: { ...policy().bucket_to_industries, low: [] } },
      {
        ...policy(),
        bucket_to_industries: { ...policy().bucket_to_industries, high: ["unknown"] },
      },
      { ...policy(), unexpected: true },
    ])
      failure(mapping({ mapping_policy }), "invalid_input", "INVALID_MAPPING_POLICY");
    failure(
      mapping({ mapping_policy: { ...policy(), questionnaire_versions: ["v1"] } }),
      "mapping_not_configured",
      "UNSUPPORTED_QUESTIONNAIRE_VERSION",
    );
    expect(
      finmatchContractSchemas["finmatch.mapping-policy-request@1"].safeParse({
        arbitrary: [false, null],
      }).success,
    ).toBe(true);
    expect(
      finmatchContractSchemas["finmatch.mapping-policy@1"].safeParse({ arbitrary: true }).success,
    ).toBe(false);
  });

  test("malformed or inconsistent risk never maps or leaks unvalidated risk fields", () => {
    for (const risk_result of [
      undefined,
      null,
      {},
      { ...risk(), total_score: 6 },
      { ...risk(), total_score: 22 },
      { ...risk(), total_score: 15.5 },
      { ...risk(), total_score: "15" },
      { ...risk(), total_score: NaN },
      { ...risk(), risk_profile_bucket: "low" },
      { ...risk(), risk_profile_bucket: "unknown" },
      { ...risk(), answers: { q1: 1 } },
      { ...risk(), answers: { ...risk().answers, q1: 1 } },
    ]) {
      const result = mapping({ risk_result });
      failure(result, "invalid_input", "INVALID_RISK_RESULT");
      expect(result).not.toHaveProperty("total_score");
    }
    failure(
      mapping({ risk_result: { ...risk(), questionnaire_version: "v1" } }),
      "invalid_input",
      "UNSUPPORTED_QUESTIONNAIRE_VERSION",
    );
    for (const request of [null, [], {}, "request", { risk_result: risk(), unexpected: true }])
      failure(mapRiskToIndustries(request), "invalid_input", "INVALID_RISK_RESULT");
    // Semantic inconsistencies pass the shared structural port to reach the handler.
    expect(
      finmatchContractSchemas["finmatch.risk-result@v0-demo"].safeParse({
        ...risk(),
        risk_profile_bucket: "low",
      }).success,
    ).toBe(true);
  });

  test("invalid or contradictory supplied preferences are not silently normalized", () => {
    for (const industry_preference of [
      null,
      {},
      { selection_mode: "selected", selected_industries: [] },
      { selection_mode: "balanced_coverage", selected_industries: ["energy"] },
      { selection_mode: "selected", selected_industries: ["unsupported"] },
      { selection_mode: "selected", selected_industries: ["energy", "energy"] },
      { selection_mode: "unknown", selected_industries: [] },
    ])
      failure(mapping({ industry_preference }), "invalid_input", "INVALID_INDUSTRY_PREFERENCE");
  });

  test("mapping output validation discriminates success, unavailable, and invalid data", () => {
    const schema = finmatchContractSchemas["finmatch.mapping-result@1"];
    const unavailable = mapRiskToIndustries({ risk_result: risk() });
    for (const output of [
      { ...unavailable, risk_aligned_industries: ["energy"] },
      { ...unavailable, mapping_status: "mapped" },
      { ...unavailable, error_code: "INVALID_MAPPING_POLICY" },
      { ...mapping(), error_code: "INVALID_RISK_RESULT" },
      { ...mapping(), message: "not success" },
      { ...mapping(), risk_aligned_industries: [] },
      { ...mapping(), risk_aligned_industries: ["energy", "energy"] },
      { ...mapping(), total_score: 11 },
      {
        mapping_status: "invalid_input",
        error_code: "INVALID_RISK_RESULT",
        message: "Bad risk",
        total_score: 15,
        risk_aligned_industries: [],
      },
    ])
      expect(schema.safeParse(output).success).toBe(false);
  });
});
