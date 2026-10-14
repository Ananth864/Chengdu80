import { z } from "zod";
import type { CapabilityDefinition } from "./definitions";
import { finmatchContractSchemas, finmatchContractExamples, validatedRiskSchema } from "./finmatch";

export const finmatchRiskCompanySizePolicy = Object.freeze({
  policy_id: "finmatch-risk-company-size",
  policy_version: "1.0.0",
  questionnaire_version: "v0-demo",
  bucket_to_company_size: Object.freeze({ low: "large", medium: "medium", high: "small" }),
} as const);

const companySizeResultSchema = z.discriminatedUnion("mapping_status", [
  z
    .strictObject({
      mapping_status: z.literal("mapped"),
      mapping_policy_id: z.literal(finmatchRiskCompanySizePolicy.policy_id),
      mapping_policy_version: z.literal(finmatchRiskCompanySizePolicy.policy_version),
      questionnaire_version: z.literal(finmatchRiskCompanySizePolicy.questionnaire_version),
      total_score: z.number().int().min(7).max(21),
      risk_profile_bucket: z.enum(["low", "medium", "high"]),
      company_size: z.enum(["small", "medium", "large"]),
      industry_preference: finmatchContractSchemas["finmatch.industry-preference@1"].optional(),
    })
    .refine(
      (result) =>
        validatedRiskSchema.safeParse({
          questionnaire_version: result.questionnaire_version,
          total_score: result.total_score,
          risk_profile_bucket: result.risk_profile_bucket,
        }).success &&
        result.company_size ===
          finmatchRiskCompanySizePolicy.bucket_to_company_size[result.risk_profile_bucket],
      "Risk fields and company size must match the pinned policy.",
    ),
  z.strictObject({
    mapping_status: z.literal("invalid_input"),
    error_code: z.enum([
      "INVALID_RISK_RESULT",
      "UNSUPPORTED_QUESTIONNAIRE_VERSION",
      "INVALID_INDUSTRY_PREFERENCE",
    ]),
    message: z.string().min(1),
  }),
]);

export const finmatchCompanySizeContractSchemas = {
  "finmatch.company-size-result@1": companySizeResultSchema,
} as const;
export type FinmatchCompanySizeResult = z.infer<typeof companySizeResultSchema>;

export function mapRiskToCompanySize(raw: unknown): FinmatchCompanySizeResult {
  const fail = (
    error_code:
      | "INVALID_RISK_RESULT"
      | "UNSUPPORTED_QUESTIONNAIRE_VERSION"
      | "INVALID_INDUSTRY_PREFERENCE",
    message: string,
  ): FinmatchCompanySizeResult => ({ mapping_status: "invalid_input", error_code, message });
  const request = z
    .strictObject({ risk_result: z.unknown(), industry_preference: z.unknown().optional() })
    .safeParse(raw);
  if (!request.success)
    return fail("INVALID_RISK_RESULT", "Provide risk_result and only documented input fields.");
  const structuralRisk = finmatchContractSchemas["finmatch.risk-result@v0-demo"].safeParse(
    request.data.risk_result,
  );
  if (!structuralRisk.success)
    return fail(
      "INVALID_RISK_RESULT",
      "Provide complete risk fields; answers, if present, must be complete.",
    );
  if (
    structuralRisk.data.questionnaire_version !==
    finmatchRiskCompanySizePolicy.questionnaire_version
  )
    return fail("UNSUPPORTED_QUESTIONNAIRE_VERSION", "Only v0-demo scoring rules are supported.");
  const risk = validatedRiskSchema.safeParse(structuralRisk.data);
  if (!risk.success)
    return fail(
      "INVALID_RISK_RESULT",
      "Score, bucket, and any complete answers must agree with v0-demo scoring rules.",
    );
  const preference =
    request.data.industry_preference === undefined
      ? undefined
      : finmatchContractSchemas["finmatch.industry-preference@1"].safeParse(
          request.data.industry_preference,
        );
  if (preference && !preference.success)
    return fail(
      "INVALID_INDUSTRY_PREFERENCE",
      "Provide unique supported selections, or empty balanced_coverage.",
    );
  return companySizeResultSchema.parse({
    mapping_status: "mapped",
    mapping_policy_id: finmatchRiskCompanySizePolicy.policy_id,
    mapping_policy_version: finmatchRiskCompanySizePolicy.policy_version,
    questionnaire_version: risk.data.questionnaire_version,
    total_score: risk.data.total_score,
    risk_profile_bucket: risk.data.risk_profile_bucket,
    company_size:
      finmatchRiskCompanySizePolicy.bucket_to_company_size[risk.data.risk_profile_bucket],
    ...(preference?.success ? { industry_preference: preference.data } : {}),
  });
}

const inputs = {
  risk_result: "finmatch.risk-request@1",
  industry_preference: "finmatch.industry-preference-request@1",
} as const;
const outputs = { mapping_result: "finmatch.company-size-result@1" } as const;
export const finmatchCompanySizeImplementations = {
  "CAP-003@0.3.0": {
    inputs,
    outputs,
    invoke: (input: unknown) => ({ mapping_result: mapRiskToCompanySize(input) }),
  },
} as const;

// Shared risk validation sources are included separately by the runtime fingerprint.
export const finmatchCompanySizeImplementationSource = JSON.stringify({
  policy: finmatchRiskCompanySizePolicy,
  handler: mapRiskToCompanySize.toString(),
  refinements: (companySizeResultSchema.options[0]._zod.def.checks ?? []).map((check) => {
    const definition = check._zod.def as { fn?: (input: never) => unknown };
    return definition.fn?.toString() ?? check._zod.check.toString();
  }),
});

export const finmatchCompanySizeContractExamples = {
  "finmatch.company-size-result@1": mapRiskToCompanySize({
    risk_result: finmatchContractExamples["finmatch.risk-result@v0-demo"],
  }),
} as const;

const sourceDocuments = [
  "capability-resources/capability_library/finmatch-risk-to-company-size-mapping-capability.md",
  "capability-resources/capability_library/finmatch-risk-questionnaire-scoring.md",
  "capability-resources/capability_library/finmatch-industry-preference-capability.md",
];
export const finmatchCompanySizeDefinitions: readonly CapabilityDefinition[] = [
  {
    id: "CAP-003",
    version: "0.3.0",
    name: "Risk-to-company-size mapping",
    purpose:
      "Apply the explicit versioned product rule to validated demo risk, preserving optional industry preferences unchanged.",
    status: "unverified",
    financial: true,
    inputs,
    optionalInputs: ["industry_preference"],
    inputValidation: "handler",
    outputs,
    behavior:
      "Validate v0-demo score, bucket and optional complete answers; apply finmatch-risk-company-size@1.0.0: high -> small, medium -> medium, low -> large. No supplied mapping policy is required or accepted.",
    coverage:
      "Categorical company-size mapping only; no risk-to-industry inference or company classification.",
    supportedAssetTypes: ["stocks"],
    markets: ["China", "Shanghai Stock Exchange (SSE)"],
    constraints: [
      "User-confirmed product rule, not financial validation or a suitability assessment.",
      "Numeric CNY market-cap thresholds are undefined; downstream use must require upstream categorical company.size, never classify from a market-cap number.",
      "Do not fetch, select or rank companies, infer industries, persist preferences, or take brokerage actions.",
      "Preserve optional selected or balanced_coverage preferences unchanged; no preference means no inferred selection.",
      "Do not expose total_score, risk_profile_bucket or answers in public results; use the runtime public projection.",
      "Provisional questionnaire scoring and company size do not establish company risk; China-specific legal review is required before investment personalization.",
    ],
    dependencies: [],
    unknowns: [
      "Numeric CNY company-size thresholds and upstream company.size classification authority are undefined.",
      "Financial validation, questionnaire psychometric validation and China-specific legal review are not established.",
    ],
    evidence: { verified: false, references: sourceDocuments },
    sourceDocuments,
    simulation: {
      prototypeOnly: true,
      inputs: {},
      outputs: {},
      behavior:
        "Not a mock; deterministic unverified implementation of the user-confirmed product rule. No simulation ports.",
      dependencies: [],
    },
  },
];
