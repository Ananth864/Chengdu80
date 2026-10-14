import { z } from "zod";
import { discoveryIndustries, normalizedIndustryPreferenceSchema } from "./company-discovery";

export const supportedIndustries = [
  { id: "manufacturing", label: "Manufacturing", csv_value: discoveryIndustries.manufacturing },
  {
    id: "information_software_it",
    label: "Information transmission, software and IT services",
    csv_value: discoveryIndustries.information_software_it,
  },
  {
    id: "utilities",
    label: "Electricity, heat, gas and water production and supply",
    csv_value: discoveryIndustries.utilities,
  },
  {
    id: "financial_services",
    label: "Financial services",
    csv_value: discoveryIndustries.financial_services,
  },
  {
    id: "wholesale_retail",
    label: "Wholesale and retail",
    csv_value: discoveryIndustries.wholesale_retail,
  },
] as const;

export const industryPreferenceInputSchema = z
  .object({
    selected_industries: z.array(
      normalizedIndustryPreferenceSchema.shape.selected_industries.element,
    ),
  })
  .strict();

const companiesSchema = z.array(z.object({ industry: z.string().min(1) }).passthrough());
const industryLabelsSchema = z.array(z.string().min(1));

export const industryPreferenceRequestSchema = z.discriminatedUnion("operation", [
  industryPreferenceInputSchema.extend({ operation: z.literal("capture_preferences") }),
  z
    .object({
      operation: z.literal("filter_companies"),
      companies: companiesSchema,
      industry_labels: industryLabelsSchema,
    })
    .strict(),
]);

const completedPreferenceSchema = z
  .object({
    status: z.literal("completed"),
    industry_preference: normalizedIndustryPreferenceSchema,
  })
  .strict();
const invalidInputSchema = z
  .object({
    status: z.literal("invalid_input"),
    error_code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const industryPreferenceResultSchema = z.union([
  completedPreferenceSchema,
  z.object({ status: z.literal("completed"), companies: companiesSchema }).strict(),
  invalidInputSchema,
]);

export function capturePreferences(
  raw: unknown,
): z.infer<typeof completedPreferenceSchema> | z.infer<typeof invalidInputSchema> {
  const input = industryPreferenceInputSchema.safeParse(raw);
  if (!input.success)
    return {
      status: "invalid_input",
      error_code: "INVALID_INPUT",
      message: "Provide selected_industries as an array of supported canonical industry IDs.",
    };
  const selected = [...new Set(input.data.selected_industries)];
  return {
    status: "completed",
    industry_preference: {
      selection_mode: selected.length ? "selected" : "all_supported",
      selected_industries: selected,
      effective_industries: selected.length
        ? [...selected]
        : supportedIndustries.map(({ id }) => id),
    },
  };
}

export function filterCompanies(records: unknown, labels: unknown) {
  const companies = companiesSchema.parse(records);
  const selected = new Set(industryLabelsSchema.parse(labels));
  return companies.filter((company) => selected.size === 0 || selected.has(company.industry));
}

export function runIndustryPreference(
  raw: unknown,
): z.infer<typeof industryPreferenceResultSchema> {
  const request = industryPreferenceRequestSchema.safeParse(raw);
  if (!request.success)
    return {
      status: "invalid_input",
      error_code: "INVALID_INPUT",
      message: "Provide a valid capture_preferences or filter_companies request.",
    };
  if (request.data.operation === "capture_preferences")
    return capturePreferences({ selected_industries: request.data.selected_industries });
  return {
    status: "completed",
    companies: filterCompanies(request.data.companies, request.data.industry_labels),
  };
}
