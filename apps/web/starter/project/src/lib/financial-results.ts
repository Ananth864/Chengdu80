import { z } from "zod";

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const financialRequestSchema = z
  .object({
    company_id: z.string().regex(/^\d{6}$/),
    exchange: z.literal("SSE").default("SSE"),
    company_name: z.string().min(1).optional(),
    industry_label: z.string().min(1).optional(),
    as_of_date: z.string().refine(isCalendarDate, "Expected a real ISO calendar date").optional(),
    period: z.enum(["1m", "6m", "1y", "5y"]).optional(),
    years: z.number().int().min(1).max(5).optional(),
  })
  .strict();

export const industryResearchRequestSchema = financialRequestSchema.omit({ period: true }).extend({
  period: z
    .string()
    .regex(/^\d{4}1231$/)
    .refine((value) => isCalendarDate(`${value.slice(0, 4)}-12-31`), "Expected a real annual date")
    .optional(),
});

export const priceTargetRequestSchema = financialRequestSchema.omit({ period: true, years: true });

// Transport acceptance is not capability dispatch; callers must select the matching schema.
export const financialOperationRequestSchema = z.union([
  financialRequestSchema,
  industryResearchRequestSchema,
  priceTargetRequestSchema,
]);

export const financialStatusSchema = z.enum([
  "available",
  "partial",
  "unavailable",
  "insufficient_data",
  "invalid_input",
]);

export const financialSourceSchema = z
  .object({
    provider: z.string().min(1),
    endpoint: z.string().min(1),
    retrieved_at: z.iso.datetime(),
    fields: z.array(z.string()),
    status: z.string().min(1),
    limitations: z.array(z.string()),
  })
  .passthrough();

export const financialMetricSchema = z
  .object({
    value: z.number().finite().nullable(),
    status: financialStatusSchema,
    unit: z.string().min(1),
    reason: z.string().nullable(),
    basis: z.string().min(1),
    period: z
      .object({ start: z.string().refine(isCalendarDate), end: z.string().refine(isCalendarDate) })
      .nullable(),
    source: z.array(financialSourceSchema),
  })
  .passthrough();

// Capability services validate their own payloads; this is the shared transport envelope.
export const financialResultSchema = z
  .object({
    status: financialStatusSchema,
    capability_id: z.enum(["historical-analysis", "industry-research", "price-target"]),
    provider: z.string().min(1),
    retrieved_at: z.iso.datetime(),
    data_limitations: z.array(z.string()),
    mode: z.enum(["fixture", "live"]).optional(),
    sources: z.array(financialSourceSchema).optional(),
  })
  .passthrough();

export type FinancialRequest = z.infer<typeof financialRequestSchema>;
export type FinancialResult = z.infer<typeof financialResultSchema>;
export type FinancialMetric = z.infer<typeof financialMetricSchema>;
