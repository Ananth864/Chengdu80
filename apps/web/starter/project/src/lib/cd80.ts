import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
type Capability =
  | "storage.read"
  | "storage.write"
  | "finance.match-companies"
  | "finance.company-cards"
  | "finance.research";
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
  synthetic: z.literal(false),
});
const cardsInput = z.discriminatedUnion("action", [
  criteriaSchema.extend({ action: z.literal("batch"), revisitDismissed: z.boolean().optional() }),
  z.object({ action: z.literal("decide"), ticker: z.string(), choice: z.enum(["yes", "no"]) }),
  z.object({ action: z.literal("watchlist") }),
]);
const cardsResult = z.object({
  day: z.string(),
  synthetic: z.literal(false),
  moduleVersion: z.literal("company-capabilities-v1"),
  criteria: criteriaSchema.nullable(),
  exhausted: z.boolean(),
  companies: z.array(displayCompanySchema),
  watchlist: z.array(z.string()),
  notice: z.string().nullable(),
});
export const researchResultSchema = z.object({
  available: z.literal(true),
  asOf: z.string(),
  company: z.object({
    tsCode: z.string(),
    name: z.string().nullable(),
    indicators: z
      .object({
        endDate: z.string(),
        announced: z.string().nullable(),
        revenueYoy: z.number().nullable(),
        profitYoy: z.number().nullable(),
        roe: z.number().nullable(),
        grossMargin: z.number().nullable(),
      })
      .nullable(),
  }),
  industry: z
    .object({
      path: z.string(),
      l3Code: z.string().nullable(),
      peers: z.array(z.object({ tsCode: z.string(), name: z.string(), sse: z.boolean() })),
      valuation: z
        .object({
          totalMvRmb: z.number(),
          pe: z.number().nullable(),
          pb: z.number().nullable(),
          asOf: z.string(),
        })
        .nullable(),
      reports: z.array(
        z.object({ date: z.string(), title: z.string(), inst: z.string(), url: z.string() }),
      ),
    })
    .nullable(),
  macro: z
    .object({
      gdp: z.array(z.object({ quarter: z.string(), yoy: z.number() })),
      pmi: z.array(
        z.object({
          month: z.string(),
          pmi: z.number(),
          production: z.number(),
          newOrders: z.number(),
        }),
      ),
    })
    .nullable(),
  unavailable: z.array(z.string()),
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
    async matchCompanies(input: z.input<typeof criteriaSchema>) {
      return matchingResult.parse(
        await call("finance.match-companies", criteriaSchema.parse(input)),
      );
    },
    async companyCards(input: z.input<typeof cardsInput>) {
      return cardsResult.parse(await call("finance.company-cards", cardsInput.parse(input)));
    },
    async research(tsCode: string) {
      return researchResultSchema.parse(await call("finance.research", { tsCode }));
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
