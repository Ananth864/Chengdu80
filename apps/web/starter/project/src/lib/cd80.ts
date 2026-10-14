import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { discoveryRequestSchema, discoveryResultSchema } from "./company-discovery";
import {
  discoveryContractRequestSchema,
  discoveryContractResultSchema,
} from "./discovery-contract";
import {
  financialRequestSchema,
  financialResultSchema,
  financialOperationRequestSchema,
  industryResearchRequestSchema,
  priceTargetRequestSchema,
} from "./financial-results";
import {
  industryPreferenceRequestSchema,
  industryPreferenceResultSchema,
} from "./industry-preference";
import {
  riskProfileInputSchema,
  riskProfileResultSchema,
  type RiskProfileInput,
} from "./risk-profile";
type Capability =
  | "storage.read"
  | "storage.write"
  | "finance.risk-profile"
  | "finance.company-discovery"
  | "finance.company-discovery.v1-3"
  | "finance.historical-analysis"
  | "finance.industry-research"
  | "finance.price-target"
  | "finance.industry-preferences"
  | "finance.match-companies"
  | "finance.company-cards";
declare global {
  interface Window {
    cd80: { call: (capability: Capability, input: unknown) => Promise<unknown>; ready: () => void };
  }
}
export const criteriaSchema = z
  .object({ risk: z.enum(["low", "medium", "high"]), industries: z.array(z.string()).min(1) })
  .strict();
export const companySchema = z.object({
  name: z.string(),
  ticker: z.string(),
  industry: z.string(),
  marketCapRmb: z.number(),
  size: z.enum(["small", "medium", "large"]),
});
const displayCompanySchema = companySchema.extend({
  choice: z.enum(["yes", "no"]).nullable().default(null),
  metrics: z
    .array(
      z.object({
        id: z.string(),
        value: z.null(),
        status: z.literal("unavailable"),
        reason: z.string(),
      }),
    )
    .default([]),
});
const matchingResult = z.object({
  criteria: criteriaSchema,
  size: z.enum(["small", "medium", "large"]),
  companies: z.array(displayCompanySchema),
  moduleVersion: z.literal("company-capabilities-v1"),
  synthetic: z.literal(true),
});
const cardsInput = z.discriminatedUnion("action", [
  criteriaSchema.extend({ action: z.literal("batch"), revisitDismissed: z.boolean().optional() }),
  z.object({ action: z.literal("decide"), ticker: z.string(), choice: z.enum(["yes", "no"]) }),
  z.object({ action: z.literal("watchlist") }),
]);
const cardsResult = z.object({
  day: z.string(),
  synthetic: z.literal(true),
  moduleVersion: z.literal("company-capabilities-v1"),
  criteria: criteriaSchema.nullable(),
  exhausted: z.boolean(),
  companies: z.array(displayCompanySchema),
  watchlist: z.array(z.string()),
  notice: z.string().nullable(),
});
async function call(capability: Capability, input: unknown): Promise<unknown> {
  if (typeof window === "undefined" || !window.cd80)
    throw new Error("Financial capabilities are available only in the platform preview.");
  return window.cd80.call(capability, input);
}
export const cd80 = {
  storage: {
    async read<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
      const value = await call("storage.read", { key });
      return value === null ? null : schema.parse(value);
    },
    async write(key: string, value: unknown) {
      return call("storage.write", { key, value });
    },
  },
  finance: {
    async companyDiscoveryContract(input: z.input<typeof discoveryContractRequestSchema>) {
      return discoveryContractResultSchema.parse(
        await call("finance.company-discovery.v1-3", discoveryContractRequestSchema.parse(input)),
      );
    },
    async financialAnalysis(
      capability: "historical-analysis" | "industry-research" | "price-target",
      input: z.input<typeof financialOperationRequestSchema>,
    ) {
      const schema =
        capability === "industry-research"
          ? industryResearchRequestSchema
          : capability === "price-target"
            ? priceTargetRequestSchema
            : financialRequestSchema;
      const request = schema.parse(input);
      const permission = {
        "historical-analysis": "finance.historical-analysis",
        "industry-research": "finance.industry-research",
        "price-target": "finance.price-target",
      } as const;
      const result = financialResultSchema.parse(await call(permission[capability], request));
      if (result.capability_id !== capability)
        throw new Error("Financial result capability mismatch.");
      return result;
    },
    async industryPreferences(input: z.input<typeof industryPreferenceRequestSchema>) {
      return industryPreferenceResultSchema.parse(
        await call("finance.industry-preferences", industryPreferenceRequestSchema.parse(input)),
      );
    },
    async companyDiscovery(input: z.input<typeof discoveryRequestSchema>) {
      return discoveryResultSchema.parse(
        await call("finance.company-discovery", discoveryRequestSchema.parse(input)),
      );
    },
    async riskProfile(input: RiskProfileInput) {
      return riskProfileResultSchema.parse(
        await call("finance.risk-profile", riskProfileInputSchema.parse(input)),
      );
    },
    async matchCompanies(input: z.input<typeof criteriaSchema>) {
      return matchingResult.parse(
        await call("finance.match-companies", criteriaSchema.parse(input)),
      );
    },
    async companyCards(input: z.input<typeof cardsInput>) {
      return cardsResult.parse(await call("finance.company-cards", cardsInput.parse(input)));
    },
  },
};
export function useStoredValue<T>(key: string, schema: z.ZodType<T>) {
  const client = useQueryClient();
  const queryKey = ["cd80", "storage", key] as const;
  const query = useQuery({ queryKey, queryFn: () => cd80.storage.read(key, schema), retry: false });
  const write = useMutation({
    mutationFn: (value: T) => cd80.storage.write(key, schema.parse(value)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
    },
  });
  return { query, write };
}
