import { z } from "zod";
import { metricSelectionSchema } from "./company-capabilities";
import { businessCapabilities, type BusinessCapability } from "./capability-catalog";

export { businessCapabilities, type BusinessCapability } from "./capability-catalog";
export const buildPlanSchema = z
  .object({
    requirements: z.string().trim().min(10).max(4000),
    capabilities: z.array(z.enum(businessCapabilities)).min(1).max(8),
    companyQueries: z.array(z.string().trim().min(1).max(100)).max(20),
    mode: z.enum(["fixture", "live"]),
    themeOverride: z.string().trim().min(1).max(300).nullable().default(null),
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
  companyTableVersion: string;
  protocolHashes: Record<string, string>;
  provider: "tushare";
  moduleVersions: Record<string, string>;
  theme: string;
  readiness: "fixture" | "live" | "blocked";
  blockers: string[];
  artifactHash?: string;
};
