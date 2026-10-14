import { z } from "zod";
import type { CapabilityDefinition } from "./definitions";

export const finmatchIndustries = [
  "technology",
  "finance",
  "agriculture",
  "manufacturing",
  "fmcg",
  "energy",
] as const;
const industrySchema = z.enum(finmatchIndustries);
const industriesSchema = z.array(industrySchema);
const uniqueIndustriesSchema = industriesSchema.refine(
  (values) => new Set(values).size === values.length,
  "Industries must be unique.",
);
const bucketSchema = z.enum(["low", "medium", "high"]);
const answerSchema = z.number().int().min(1).max(3);
const answersSchema = z.strictObject({
  q1: answerSchema,
  q2: answerSchema,
  q3: answerSchema,
  q4: answerSchema,
  q5: answerSchema,
  q6: answerSchema,
  q7: answerSchema,
});
const submissionSchema = z.strictObject({
  questionnaire_version: z.literal("v0-demo"),
  answers: answersSchema,
});
const preferenceSchema = z.discriminatedUnion("selection_mode", [
  z.strictObject({
    selection_mode: z.literal("selected"),
    selected_industries: uniqueIndustriesSchema.refine((values) => values.length > 0),
  }),
  z.strictObject({
    selection_mode: z.literal("balanced_coverage"),
    selected_industries: industriesSchema.length(0),
  }),
]);

function bucketForScore(score: number): z.infer<typeof bucketSchema> {
  return score <= 11 ? "low" : score <= 16 ? "medium" : "high";
}

// Producer contracts remain exact; mapping requests delegate malformed shapes
// and semantic failures to the handler for documented error results.
const riskResultSchema = z.strictObject({
  questionnaire_version: z.string().min(1),
  total_score: z.number().finite(),
  risk_profile_bucket: bucketSchema,
  answers: answersSchema.optional(),
});
export const validatedRiskSchema = riskResultSchema.refine(
  (risk) =>
    risk.questionnaire_version === "v0-demo" &&
    Number.isInteger(risk.total_score) &&
    risk.total_score >= 7 &&
    risk.total_score <= 21 &&
    risk.risk_profile_bucket === bucketForScore(risk.total_score) &&
    (!risk.answers ||
      Object.values(risk.answers).reduce((total, answer) => total + answer, 0) ===
        risk.total_score),
  "Risk result must match the complete v0-demo scoring rules.",
);
const scoredResultSchema = riskResultSchema
  .extend({ questionnaire_version: z.literal("v0-demo"), answers: answersSchema })
  .refine((risk) => validatedRiskSchema.safeParse(risk).success);

const policySchema = z.strictObject({
  policy_id: z.string().trim().min(1),
  policy_version: z.string().trim().min(1),
  questionnaire_versions: z.array(z.string().min(1)).min(1),
  bucket_to_industries: z.strictObject({
    low: industriesSchema.min(1),
    medium: industriesSchema.min(1),
    high: industriesSchema.min(1),
  }),
});
const validatedRiskFields = {
  questionnaire_version: z.literal("v0-demo"),
  total_score: z.number().int().min(7).max(21),
  risk_profile_bucket: bucketSchema,
};
const comparisonSchema = z.discriminatedUnion("selection_mode", [
  z.strictObject({
    selection_mode: z.literal("selected"),
    user_selected_industries: uniqueIndustriesSchema.refine((values) => values.length > 0),
    overlap_industries: uniqueIndustriesSchema,
    selected_outside_mapping: uniqueIndustriesSchema,
  }),
  z.strictObject({
    selection_mode: z.literal("balanced_coverage"),
    user_selected_industries: industriesSchema.length(0),
    overlap_industries: industriesSchema.length(0),
    selected_outside_mapping: industriesSchema.length(0),
  }),
]);
const mappingResultSchema = z
  .discriminatedUnion("mapping_status", [
    z.strictObject({
      mapping_status: z.literal("mapped"),
      mapping_policy_id: z.string().min(1),
      mapping_policy_version: z.string().min(1),
      ...validatedRiskFields,
      risk_aligned_industries: uniqueIndustriesSchema.refine((values) => values.length > 0),
      industry_preference_comparison: comparisonSchema.optional(),
    }),
    z.strictObject({
      mapping_status: z.literal("mapping_not_configured"),
      error_code: z.enum(["MAPPING_POLICY_MISSING", "UNSUPPORTED_QUESTIONNAIRE_VERSION"]),
      message: z.string().min(1),
      ...validatedRiskFields,
      risk_aligned_industries: industriesSchema.length(0),
    }),
    z.strictObject({
      mapping_status: z.literal("invalid_input"),
      error_code: z.enum([
        "INVALID_RISK_RESULT",
        "UNSUPPORTED_QUESTIONNAIRE_VERSION",
        "INVALID_MAPPING_POLICY",
        "INVALID_INDUSTRY_PREFERENCE",
      ]),
      message: z.string().min(1),
      questionnaire_version: validatedRiskFields.questionnaire_version.optional(),
      total_score: validatedRiskFields.total_score.optional(),
      risk_profile_bucket: validatedRiskFields.risk_profile_bucket.optional(),
      risk_aligned_industries: industriesSchema.length(0),
    }),
  ])
  .refine((result) => {
    if (result.questionnaire_version === undefined)
      return result.total_score === undefined && result.risk_profile_bucket === undefined;
    return (
      result.total_score !== undefined &&
      result.risk_profile_bucket === bucketForScore(result.total_score)
    );
  }, "Returned risk fields must be complete and consistent.");

function isBoundedFinmatchRequest(value: unknown): boolean {
  const queue = [{ value, depth: 0 }];
  let nodes = 0;
  let characters = 0;
  while (queue.length) {
    const item = queue.pop()!;
    if (++nodes > 2048 || item.depth > 12) return false;
    const current = item.value;
    if (current === null || typeof current === "boolean") continue;
    if (typeof current === "number") {
      if (!Number.isFinite(current)) return false;
      continue;
    }
    if (typeof current === "string") {
      characters += current.length;
      if (characters > 32768) return false;
      continue;
    }
    if (typeof current !== "object") return false;
    const array = Array.isArray(current);
    if (
      !array &&
      Object.getPrototypeOf(current) !== Object.prototype &&
      Object.getPrototypeOf(current) !== null
    )
      return false;
    const keys = Reflect.ownKeys(current).filter((key) => !(array && key === "length"));
    if (keys.length > 128 || (array && keys.length !== current.length)) return false;
    for (const key of keys) {
      if (typeof key !== "string" || ["__proto__", "prototype", "constructor"].includes(key))
        return false;
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= current.length)) return false;
      const descriptor = Object.getOwnPropertyDescriptor(current, key)!;
      if (!descriptor.enumerable || !("value" in descriptor)) return false;
      characters += key.length;
      if (characters > 32768) return false;
      queue.push({ value: descriptor.value, depth: item.depth + 1 });
    }
  }
  return true;
}
export const finmatchRequestSchema = z
  .unknown()
  .refine(isBoundedFinmatchRequest, "Expected bounded safe JSON request.")
  .pipe(z.json());

export const finmatchContractSchemas = {
  "finmatch.industry-selection@1": industriesSchema,
  "finmatch.industry-preference@1": preferenceSchema,
  "finmatch.questionnaire-submission@v0-demo": submissionSchema,
  "finmatch.risk-result@v0-demo": riskResultSchema,
  "finmatch.mapping-policy@1": policySchema.nullable(),
  "finmatch.risk-request@1": finmatchRequestSchema,
  "finmatch.industry-preference-request@1": finmatchRequestSchema,
  "finmatch.mapping-policy-request@1": finmatchRequestSchema,
  "finmatch.mapping-result@1": mappingResultSchema,
} as const;
export type FinmatchContractId = keyof typeof finmatchContractSchemas;
export type FinmatchContractValues = {
  [K in FinmatchContractId]: z.infer<(typeof finmatchContractSchemas)[K]>;
};
export type FinmatchScoredResult = z.infer<typeof scoredResultSchema>;
export type FinmatchMappingResult = z.infer<typeof mappingResultSchema>;

export const finmatchQuestionnaire = [
  {
    id: "q1",
    title: "Comfort with investment fluctuations",
    question:
      "How comfortable are you with the value of an investment moving up and down over time?",
    choices: [
      {
        label: "Low",
        score: 1,
        text: "I prefer small changes in value, even if potential growth may be lower.",
      },
      {
        label: "Medium",
        score: 2,
        text: "I can accept some ups and downs for potential long-term growth.",
      },
      {
        label: "High",
        score: 3,
        text: "I can accept large ups and downs for potential long-term growth.",
      },
    ],
  },
  {
    id: "q2",
    title: "Reaction to a loss",
    question:
      "Imagine you invest RMB 10,000 and its value falls to RMB 8,000 for a time. What would you most likely do?",
    choices: [
      { label: "Low", score: 1, text: "Sell all or most of it to prevent further losses." },
      {
        label: "Medium",
        score: 2,
        text: "Hold it for now and review the situation before deciding.",
      },
      {
        label: "High",
        score: 3,
        text: "Stay with my plan, or add more if that was already part of my plan.",
      },
    ],
  },
  {
    id: "q3",
    title: "Tolerance for a temporary decline",
    question:
      "What temporary fall in the value of your investments could you tolerate without changing your plan?",
    choices: [
      { label: "Low", score: 1, text: "Up to 5%." },
      { label: "Medium", score: 2, text: "More than 5% and up to 20%." },
      { label: "High", score: 3, text: "More than 20%." },
    ],
  },
  {
    id: "q4",
    title: "Risk and growth trade-off",
    question: "Which investment trade-off feels closest to you?",
    choices: [
      {
        label: "Low",
        score: 1,
        text: "Lower ups and downs, even if the potential for growth is more limited.",
      },
      {
        label: "Medium",
        score: 2,
        text: "A balance between ups and downs and potential long-term growth.",
      },
      {
        label: "High",
        score: 3,
        text: "More ups and downs in exchange for the possibility of higher long-term growth.",
      },
    ],
  },
  {
    id: "q5",
    title: "When the money may be needed",
    question: "When might you need to use the money you are considering investing?",
    choices: [
      { label: "Low", score: 1, text: "Within 1 year." },
      { label: "Medium", score: 2, text: "In 1 to 3 years." },
      { label: "High", score: 3, text: "More than 3 years from now." },
    ],
  },
  {
    id: "q6",
    title: "Emergency savings buffer",
    question: "If your income stopped, how long could your savings cover essential expenses?",
    choices: [
      { label: "Low", score: 1, text: "Less than 1 month." },
      { label: "Medium", score: 2, text: "From 1 month to 6 months." },
      { label: "High", score: 3, text: "More than 6 months." },
    ],
  },
  {
    id: "q7",
    title: "Expected one-year portfolio return",
    question: "What return do you expect your investment portfolio to achieve over the next year?",
    choices: [
      { label: "Low", score: 1, text: "Less than 10%." },
      { label: "Medium", score: 2, text: "10% to 20%." },
      { label: "High", score: 3, text: "More than 20%." },
    ],
  },
] as const;

export function normalizeIndustryPreference(
  raw: unknown,
): FinmatchContractValues["finmatch.industry-preference@1"] {
  const selected_industries = [...new Set(industriesSchema.parse(raw))];
  return preferenceSchema.parse({
    selection_mode: selected_industries.length ? "selected" : "balanced_coverage",
    selected_industries,
  });
}

export function scoreRiskQuestionnaire(raw: unknown): FinmatchScoredResult {
  const submission = submissionSchema.parse(raw);
  const total_score = Object.values(submission.answers).reduce(
    (total, answer) => total + answer,
    0,
  );
  return scoredResultSchema.parse({
    ...submission,
    total_score,
    risk_profile_bucket: bucketForScore(total_score),
  });
}

export function mapRiskToIndustries(raw: unknown): FinmatchMappingResult {
  const request = z
    .strictObject({
      risk_result: z.unknown(),
      mapping_policy: z.unknown().optional(),
      industry_preference: z.unknown().optional(),
    })
    .safeParse(raw);
  const fail = (
    mapping_status: "invalid_input" | "mapping_not_configured",
    error_code: string,
    message: string,
    risk?: z.infer<typeof validatedRiskSchema>,
  ): FinmatchMappingResult =>
    mappingResultSchema.parse({
      mapping_status,
      error_code,
      message,
      ...(risk
        ? {
            questionnaire_version: risk.questionnaire_version,
            total_score: risk.total_score,
            risk_profile_bucket: risk.risk_profile_bucket,
          }
        : {}),
      risk_aligned_industries: [],
    });
  if (!request.success)
    return fail(
      "invalid_input",
      "INVALID_RISK_RESULT",
      "Provide a request with a complete risk_result and only documented input fields.",
    );
  const structuralRisk = riskResultSchema.safeParse(request.data.risk_result);
  if (!structuralRisk.success)
    return fail(
      "invalid_input",
      "INVALID_RISK_RESULT",
      "Provide a questionnaire version, integer score from 7 to 21, and a known risk bucket; answers, if present, must be complete.",
    );
  if (structuralRisk.data.questionnaire_version !== "v0-demo")
    return fail(
      "invalid_input",
      "UNSUPPORTED_QUESTIONNAIRE_VERSION",
      "Only the documented v0-demo questionnaire scoring rules are supported.",
    );
  const risk = validatedRiskSchema.safeParse(structuralRisk.data);
  if (!risk.success)
    return fail(
      "invalid_input",
      "INVALID_RISK_RESULT",
      "The score, bucket, and any complete answers must agree with the v0-demo scoring rules.",
    );
  const preference =
    request.data.industry_preference === undefined
      ? undefined
      : preferenceSchema.safeParse(request.data.industry_preference);
  if (preference && !preference.success)
    return fail(
      "invalid_input",
      "INVALID_INDUSTRY_PREFERENCE",
      "Provide unique supported selections with selected mode, or an empty list with balanced_coverage mode.",
      risk.data,
    );
  if (request.data.mapping_policy === undefined || request.data.mapping_policy === null)
    return fail(
      "mapping_not_configured",
      "MAPPING_POLICY_MISSING",
      "No approved industry mapping policy is configured for this questionnaire version.",
      risk.data,
    );
  const policy = policySchema.safeParse(request.data.mapping_policy);
  if (!policy.success)
    return fail(
      "invalid_input",
      "INVALID_MAPPING_POLICY",
      "Provide a policy ID, version, questionnaire coverage, and non-empty supported-industry mappings for all three buckets.",
      risk.data,
    );
  if (!policy.data.questionnaire_versions.includes(risk.data.questionnaire_version))
    return fail(
      "mapping_not_configured",
      "UNSUPPORTED_QUESTIONNAIRE_VERSION",
      "The supplied mapping policy does not cover this questionnaire version.",
      risk.data,
    );
  const mapped = [...new Set(policy.data.bucket_to_industries[risk.data.risk_profile_bucket])];
  let comparison: z.infer<typeof comparisonSchema> | undefined;
  if (preference?.success) {
    const selected = preference.data.selected_industries;
    comparison = comparisonSchema.parse({
      selection_mode: preference.data.selection_mode,
      user_selected_industries: selected,
      overlap_industries: selected.filter((industry) => mapped.includes(industry)),
      selected_outside_mapping: selected.filter((industry) => !mapped.includes(industry)),
    });
  }
  return mappingResultSchema.parse({
    mapping_status: "mapped",
    mapping_policy_id: policy.data.policy_id,
    mapping_policy_version: policy.data.policy_version,
    questionnaire_version: risk.data.questionnaire_version,
    total_score: risk.data.total_score,
    risk_profile_bucket: risk.data.risk_profile_bucket,
    risk_aligned_industries: mapped,
    ...(comparison ? { industry_preference_comparison: comparison } : {}),
  });
}

const preferenceInputs = { selected_industries: "finmatch.industry-selection@1" } as const;
const preferenceOutputs = { industry_preference: "finmatch.industry-preference@1" } as const;
const riskInputs = { submission: "finmatch.questionnaire-submission@v0-demo" } as const;
const riskOutputs = { risk_result: "finmatch.risk-result@v0-demo" } as const;
const mappingInputs = {
  risk_result: "finmatch.risk-request@1",
  mapping_policy: "finmatch.mapping-policy-request@1",
  industry_preference: "finmatch.industry-preference-request@1",
} as const;
const mappingOutputs = { mapping_result: "finmatch.mapping-result@1" } as const;

// Independent descriptors avoid a runtime -> definitions -> FinMatch -> runtime cycle.
export const finmatchImplementations = {
  "CAP-001@0.2.0": {
    inputs: preferenceInputs,
    outputs: preferenceOutputs,
    invoke: (input: {
      selected_industries: FinmatchContractValues["finmatch.industry-selection@1"];
    }) => ({
      industry_preference: normalizeIndustryPreference(input.selected_industries),
    }),
  },
  "CAP-002@0.2.0": {
    inputs: riskInputs,
    outputs: riskOutputs,
    invoke: (input: {
      submission: FinmatchContractValues["finmatch.questionnaire-submission@v0-demo"];
    }) => ({
      risk_result: scoreRiskQuestionnaire(input.submission),
    }),
  },
  "CAP-003@0.2.0": {
    inputs: mappingInputs,
    outputs: mappingOutputs,
    invoke: (input: unknown) => ({ mapping_result: mapRiskToIndustries(input) }),
  },
} as const;

// Include helper and refinement sources, not only the thin registry handlers.
export const finmatchImplementationSource = JSON.stringify({
  functions: [
    bucketForScore,
    normalizeIndustryPreference,
    scoreRiskQuestionnaire,
    mapRiskToIndustries,
    isBoundedFinmatchRequest,
  ].map((fn) => fn.toString()),
  refinements: [
    uniqueIndustriesSchema,
    preferenceSchema.options[0].shape.selected_industries,
    validatedRiskSchema,
    scoredResultSchema,
    mappingResultSchema,
  ].flatMap((schema) =>
    (schema._zod.def.checks ?? []).map((check) => {
      const definition = check._zod.def as { fn?: (input: never) => unknown };
      return definition.fn?.toString() ?? check._zod.check.toString();
    }),
  ),
});

const exampleSubmission = {
  questionnaire_version: "v0-demo",
  answers: { q1: 3, q2: 2, q3: 3, q4: 2, q5: 1, q6: 2, q7: 2 },
} as const;
export const finmatchContractExamples = {
  "finmatch.industry-selection@1": ["technology", "energy"],
  "finmatch.industry-preference@1": {
    selection_mode: "selected",
    selected_industries: ["technology", "energy"],
  },
  "finmatch.questionnaire-submission@v0-demo": exampleSubmission,
  "finmatch.risk-result@v0-demo": scoreRiskQuestionnaire(exampleSubmission),
  "finmatch.risk-request@1": scoreRiskQuestionnaire(exampleSubmission),
  "finmatch.industry-preference-request@1": {
    selection_mode: "selected",
    selected_industries: ["technology", "energy"],
  },
  "finmatch.mapping-policy@1": null,
  "finmatch.mapping-policy-request@1": null,
  "finmatch.mapping-result@1": mapRiskToIndustries({
    risk_result: scoreRiskQuestionnaire(exampleSubmission),
  }),
} satisfies FinmatchContractValues;

const sourceRoot = "capability-resources/capability_library/";
const common = {
  version: "0.2.0",
  status: "unverified",
  financial: true,
  supportedAssetTypes: ["stocks"],
  markets: ["China", "Shanghai Stock Exchange (SSE)"],
  dependencies: [],
  simulation: {
    prototypeOnly: true,
    inputs: {},
    outputs: {},
    behavior:
      "Not a mock; deterministic unverified documented implementation. No simulation ports.",
    dependencies: [],
  },
} as const;
export const finmatchDefinitions: readonly CapabilityDefinition[] = [
  {
    ...common,
    id: "CAP-001",
    name: "Industry preference capture and normalization",
    purpose:
      "Capture explicit industry choices separately from risk and normalize no selections as balanced coverage.",
    inputs: preferenceInputs,
    outputs: preferenceOutputs,
    behavior:
      "Validate six canonical industry IDs, deduplicate in input order, and return selected or balanced_coverage without inferring preferences.",
    coverage:
      "Industry preference normalization only; downstream SSE company selection is separate.",
    constraints: [
      "Do not infer preferences, calculate risk, fetch companies, or select or rank investments.",
      "Balanced coverage is not an explicit selection of all six industries.",
    ],
    unknowns: [
      "Downstream company selection and risk-based recommendation rules are outside this contract.",
    ],
    evidence: {
      verified: false,
      references: [`${sourceRoot}finmatch-industry-preference-capability.md`],
    },
  },
  {
    ...common,
    id: "CAP-002",
    name: "Risk questionnaire capture and demo scoring",
    purpose:
      "Validate complete seven-answer submissions and calculate an internal provisional demo risk profile.",
    inputs: riskInputs,
    outputs: riskOutputs,
    internalOutputs: ["risk_result"],
    behavior:
      "Require v0-demo and q1-q7 integer answers 1-3; sum all answers; use 7-11 low, 12-16 medium, 17-21 high; preserve complete answers.",
    coverage:
      "Provisional v0-demo scoring only, combining willingness, capacity indicators, and return expectations; not pure risk appetite.",
    constraints: [
      "Not a validated psychometric instrument or official suitability assessment; thresholds are provisional demo rules.",
      "Do not persist incomplete attempts, expose score or bucket in the UI, add timestamps or explanations, map industries, or recommend investments.",
      "China-specific legal review and Simplified Chinese localization testing are required before personalization, filtering, or recommendation.",
    ],
    unknowns: [
      "Psychometric validation, Simplified Chinese localization testing, and China-specific legal review are not established.",
    ],
    evidence: {
      verified: false,
      references: [
        `${sourceRoot}finmatch-risk-questionnaire-capability-io.md`,
        `${sourceRoot}finmatch-risk-questionnaire-scoring.md`,
      ],
    },
  },
  {
    ...common,
    id: "CAP-003",
    inputValidation: "handler" as const,
    name: "Risk-to-industry mapping",
    purpose:
      "Apply an explicit supplied policy to validated risk data, keeping suggestions and user choices separate; supplying a policy does not establish approval.",
    inputs: mappingInputs,
    optionalInputs: ["mapping_policy", "industry_preference"],
    outputs: mappingOutputs,
    behavior:
      "Validate v0-demo risk consistency, policy coverage and all buckets; deduplicate policy suggestions in configured order; optionally compare preferences in user order; return structured failures and no guessed mappings.",
    coverage:
      "Industry suggestions only; accepts explicit upstream-compatible risk and preference data without requiring those capabilities to run in the same plan.",
    constraints: [
      "An explicit product-approved versioned policy is the sole mapping authority; missing or null policy returns mapping_not_configured.",
      "No supplied preference means no comparison; balanced coverage is never converted to explicit selections or a mapping filter.",
      "Do not establish financial suitability, select or rank investments, fetch market data, persist preferences, or take brokerage actions.",
      "Upstream risk is a provisional demo, sector labels do not establish company risk, and China-specific legal review is required before investment personalization.",
    ],
    unknowns: [
      "No product-approved bucket-to-industry policy is supplied by the source documents.",
      "Policy approval, downstream use of suggestions, and China-specific legal review remain unresolved.",
    ],
    evidence: {
      verified: false,
      references: [
        `${sourceRoot}finmatch-risk-to-industry-mapping-capability.md`,
        `${sourceRoot}finmatch-risk-questionnaire-capability-io.md`,
        `${sourceRoot}finmatch-industry-preference-capability.md`,
      ],
    },
  },
].map((definition) => ({
  ...definition,
  sourceDocuments: definition.evidence.references,
}));
