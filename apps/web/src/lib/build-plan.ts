import { z } from "zod";
import { metricSelectionSchema } from "./company-capabilities";
import { businessCapabilities, type BusinessCapability } from "./capability-catalog";

export { businessCapabilities, type BusinessCapability } from "./capability-catalog";
export const buildPlanSchema = z
  .object({
    requirements: z.string().trim().min(10).max(4000),
    capabilities: z.array(z.enum(businessCapabilities)).min(1).max(8),
    companyQueries: z.array(z.string().trim().min(1).max(100)).max(20),
    mode: z.enum(["live"], {
      error: () =>
        "The platform builds only in live mode on real Shanghai Stock Exchange Class A data. Never propose fixture or synthetic demo data; if the requested company is unsupported, reject it and propose a different real company instead.",
    }),
    themeOverride: z
      .string()
      .trim()
      .min(1)
      .max(300)
      .nullable()
      .describe(
        "Visual identity for this app when the subject warrants more than the starter default: a short theme name followed by its 4-6 named hex colors, grounded in the confirmed specification. Set it in propose_build and repeat the same value in prepare_build; a recorded override authorizes editing the starter's src/app.css. Null keeps the starter default theme (then src/app.css must not change).",
      ),
    cardMetrics: metricSelectionSchema.optional(),
  })
  .strict();
export type BuildPlan = z.infer<typeof buildPlanSchema>;
export type BuildRecord = {
  id: string;
  version: 1;
  revision: number;
  turnId: string;
  createdAt: string;
  hash: string;
  plan: BuildPlan;
  resolvedCapabilities: BusinessCapability[];
  companyIds: string[];
  companyIndustries: string[];
  companyTableVersion: string;
  protocolHashes: Record<string, string>;
  provider: "tushare";
  moduleVersions: Record<string, string>;
  theme: string;
  readiness: "live" | "blocked";
  blockers: string[];
  artifactHash?: string;
};
