import { z } from "zod";

export const riskQuestionnaireDefinition = {
  version: "v0-demo",
  questions: [
    {
      id: "q1",
      text: "How comfortable are you with the value of an investment moving up and down over time?",
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
      text: "Imagine you invest RMB 10,000 and its value falls to RMB 8,000 for a time. What would you most likely do?",
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
      text: "What temporary fall in the value of your investments could you tolerate without changing your plan?",
      choices: [
        { label: "Low", score: 1, text: "Up to 5%." },
        { label: "Medium", score: 2, text: "More than 5% and up to 20%." },
        { label: "High", score: 3, text: "More than 20%." },
      ],
    },
    {
      id: "q4",
      text: "Which investment trade-off feels closest to you?",
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
      text: "When might you need to use the money you are considering investing?",
      choices: [
        { label: "Low", score: 1, text: "Within 1 year." },
        { label: "Medium", score: 2, text: "In 1 to 3 years." },
        { label: "High", score: 3, text: "More than 3 years from now." },
      ],
    },
    {
      id: "q6",
      text: "If your income stopped, how long could your savings cover essential expenses?",
      choices: [
        { label: "Low", score: 1, text: "Less than 1 month." },
        { label: "Medium", score: 2, text: "From 1 month to 6 months." },
        { label: "High", score: 3, text: "More than 6 months." },
      ],
    },
    {
      id: "q7",
      text: "What return do you expect your investment portfolio to achieve over the next year?",
      choices: [
        { label: "Low", score: 1, text: "Less than 10%." },
        { label: "Medium", score: 2, text: "10% to 20%." },
        { label: "High", score: 3, text: "More than 20%." },
      ],
    },
  ],
  scoring_bands: [
    { min: 7, max: 11, bucket: "low" },
    { min: 12, max: 16, bucket: "medium" },
    { min: 17, max: 21, bucket: "high" },
  ],
} as const;

const answerSchema = z.number().int().min(1).max(3);
export const riskProfileInputSchema = z
  .object({
    questionnaire_version: z.literal("v0-demo"),
    answers: z
      .object({
        q1: answerSchema,
        q2: answerSchema,
        q3: answerSchema,
        q4: answerSchema,
        q5: answerSchema,
        q6: answerSchema,
        q7: answerSchema,
      })
      .strict(),
  })
  .strict();

export type RiskProfileInput = z.infer<typeof riskProfileInputSchema>;

export const completedRiskProfileSchema = riskProfileInputSchema
  .extend({
    status: z.literal("completed"),
    total_score: z.number().int().min(7).max(21),
    risk_profile_bucket: z.enum(["low", "medium", "high"]),
  })
  .strict()
  .refine(
    (result) => {
      const total = Object.values(result.answers).reduce((sum, value) => sum + value, 0);
      const bucket = total <= 11 ? "low" : total <= 16 ? "medium" : "high";
      return result.total_score === total && result.risk_profile_bucket === bucket;
    },
    { message: "Completed questionnaire result is inconsistent." },
  );

export type RiskProfileCompleted = z.infer<typeof completedRiskProfileSchema>;

export const riskProfileResultSchema = z.union([
  completedRiskProfileSchema,
  z
    .object({
      status: z.literal("invalid_input"),
      error_code: z.string().min(1),
      message: z.string().min(1),
    })
    .strict(),
]);

export function scoreRiskProfile(
  raw: unknown,
): RiskProfileCompleted | { status: "invalid_input"; error_code: string; message: string } {
  const input = riskProfileInputSchema.safeParse(raw);
  if (!input.success) {
    return {
      status: "invalid_input",
      error_code: "INVALID_INPUT",
      message:
        "Provide all seven answers as integers from 1 to 3 using questionnaire version v0-demo.",
    };
  }
  const total_score = Object.values(input.data.answers).reduce((sum, value) => sum + value, 0);
  return {
    status: "completed",
    ...input.data,
    total_score,
    risk_profile_bucket: total_score <= 11 ? "low" : total_score <= 16 ? "medium" : "high",
  };
}
