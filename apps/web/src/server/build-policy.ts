import {
  approvedPermissions,
  inspectProjectProtection,
  financialStarterVersion,
} from "../lib/financial-starter";
import { companyModuleVersion } from "../lib/company-capabilities";
import { createHash } from "node:crypto";
import communication from "./protocols/communication.md?raw";
import builder from "./protocols/builder.md?raw";
import applicationLlm from "./protocols/application-llm.md?raw";
import research from "./protocols/research.md?raw";
import history from "./protocols/history.md?raw";
import matching from "./protocols/matching.md?raw";
import frontendDesign from "./protocols/frontend-design.md?raw";
import { buildPlanSchema, type BusinessCapability, type BuildRecord } from "../lib/build-plan";
import type { AppBundle } from "../lib/contracts";
import { settings } from "./settings";
import { sseACompanies } from "./providers";
import { type Company, type CompanyLookupInput, type LiveCompany } from "../lib/company-table";

export const agentProtocols = { communication, builder, "application-llm": applicationLlm };
export { frontendDesign };
const capabilityProtocols: Record<BusinessCapability, string> = {
  "market-research": research,
  news: research,
  "historical-analysis": history,
  "price-target": history,
  "risk-assessment": matching,
  "industry-preference": matching,
  "risk-industry-matching": matching,
  "company-cards": matching,
};
export const capabilityDependencies: Record<BusinessCapability, BusinessCapability[]> = {
  "market-research": ["news"],
  news: ["market-research"],
  "historical-analysis": ["price-target"],
  "price-target": ["historical-analysis"],
  "risk-assessment": ["risk-industry-matching"],
  "industry-preference": ["risk-industry-matching"],
  "risk-industry-matching": ["risk-assessment", "industry-preference"],
  "company-cards": ["risk-industry-matching"],
};
export function resolveCapabilities(selected: BusinessCapability[]) {
  const resolved = new Set(selected);
  for (const id of resolved)
    for (const dependency of capabilityDependencies[id]) resolved.add(dependency);
  return [...resolved].sort();
}
export function selectedProtocols(selected: BusinessCapability[]) {
  return [...new Set(resolveCapabilities(selected).map((id) => capabilityProtocols[id]))];
}
export const fixtureCompanies: Company[] = [
  {
    name: "Demo Technology Large",
    ticker: "DEMO001",
    industry: "Technology",
    marketCapRmb: 100000000000,
    size: "large",
  },
  {
    name: "Demo Technology Medium",
    ticker: "DEMO002",
    industry: "Technology",
    marketCapRmb: 10000000000,
    size: "medium",
  },
  {
    name: "Demo Technology Small",
    ticker: "DEMO003",
    industry: "Technology",
    marketCapRmb: 1000000000,
    size: "small",
  },
];
export type ManagedCompanyTable =
  | { available: true; synthetic: true; version: string; companies: Company[] }
  | {
      available: true;
      synthetic: false;
      version: string;
      asOf: string;
      companies: LiveCompany[];
    }
  | {
      available: false;
      synthetic: false;
      version: "unavailable";
      companies: [];
      reason: string;
    };
// Live company identity comes from the platform's Tushare token (SSE Class A
// listed shares). App users cannot replace this table.
export async function managedCompanies(mode: "fixture" | "live"): Promise<ManagedCompanyTable> {
  if (mode === "fixture")
    return {
      version: "synthetic-companies-v1",
      companies: fixtureCompanies,
      available: true,
      synthetic: true,
    };
  const table = await sseACompanies();
  if (!table.available)
    return {
      version: "unavailable",
      companies: [],
      available: false,
      synthetic: false,
      reason: table.reason,
    };
  return {
    version: table.version,
    asOf: table.asOf,
    companies: table.companies,
    available: true,
    synthetic: false,
  };
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
// Build-time identity accepts ticker, bare code, short name, full registered
// name or English name, so a stated agent assumption survives the strict gate.
function identityMatches(normalized: string, company: CompanyLookupInput) {
  const ticker = company.ticker.toLocaleLowerCase();
  return (
    normalized === ticker ||
    normalized === ticker.split(".")[0] ||
    normalized === company.name.toLocaleLowerCase() ||
    normalized === (company.fullname ?? "").toLocaleLowerCase() ||
    normalized === (company.enname ?? "").toLocaleLowerCase()
  );
}
export async function prepareBuild(
  raw: unknown,
  turnId: string,
  revision: number,
  additionalBlockers: string[] = [],
): Promise<BuildRecord> {
  const plan = buildPlanSchema.parse(raw);
  const resolvedCapabilities = resolveCapabilities(plan.capabilities);
  const table = await managedCompanies(plan.mode);
  const blockers: string[] = [...additionalBlockers];
  if (!table.available) blockers.push(`Live company lookup is unavailable: ${table.reason}`);
  const companyIds: string[] = [];
  for (const query of plan.companyQueries) {
    if (!table.available) continue;
    const normalized = query.trim().toLocaleLowerCase();
    const matches = table.companies.filter((company) => identityMatches(normalized, company));
    if (matches.length !== 1)
      blockers.push(
        matches.length
          ? `Ambiguous company: ${query}. Ask which ticker is intended.`
          : `Company is outside the SSE Class A scope: ${query}. The platform currently supports Shanghai Stock Exchange Class A companies only.`,
      );
    else companyIds.push(matches[0].ticker);
  }
  if (resolvedCapabilities.includes("historical-analysis") && !plan.companyQueries.length)
    blockers.push(
      "Select a supported company for the historical-analysis and price-target package.",
    );
  if (plan.mode === "live") {
    const config = await settings();
    blockers.push(
      config.TUSHARE_TOKEN
        ? "Live scoped builds are not enabled yet. The platform team must verify the Tushare token and open the market-data capability."
        : "Live builds need the platform's Tushare token. The platform team must set TUSHARE_TOKEN on the server; users never provide API keys.",
    );
  }
  const protocolHashes = Object.fromEntries(
    [
      ...Object.entries(agentProtocols),
      ["frontend-design", frontendDesign] as const,
      ...resolvedCapabilities.map((id) => [id, capabilityProtocols[id]] as const),
    ].map(([id, content]) => [id, hash(content)]),
  );
  const record = {
    id: crypto.randomUUID(),
    version: 1 as const,
    revision,
    turnId,
    createdAt: new Date().toISOString(),
    plan,
    resolvedCapabilities,
    companyIds,
    companyTableVersion: table.version,
    protocolHashes,
    provider: "tushare" as const,
    moduleVersions: { companies: companyModuleVersion, starter: financialStarterVersion },
    theme: plan.themeOverride ?? "starter-default",
    readiness: blockers.length ? ("blocked" as const) : ("fixture" as const),
    blockers,
  };
  return { ...record, hash: recordHash(record) };
}
function recordHash(value: Omit<BuildRecord, "hash">) {
  const { artifactHash: _artifactHash, ...record } = value;
  return hash(
    JSON.stringify(record, (_key, item) =>
      item && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.keys(item)
              .sort()
              .map((key) => [key, item[key]]),
          )
        : item,
    ),
  );
}
export function requireBuild(record: BuildRecord | undefined, turnId: string) {
  if (!record || record.turnId !== turnId)
    throw new Error(
      "Call prepare_build for this turn before changing or deploying the application.",
    );
  const { hash: savedHash, ...payload } = record;
  if (recordHash(payload) !== savedHash)
    throw new Error("The internal build record changed after feasibility validation.");
  if (record.readiness === "blocked") throw new Error(record.blockers.join(" "));
  return record;
}
export function validateScopedBundle(bundle: AppBundle, record: BuildRecord) {
  requireBuild(record, record.turnId);
  const project = bundle.manifest.schemaVersion === 3;
  const allowed = approvedPermissions(record, project);
  if (project) {
    if (record.moduleVersions.starter !== financialStarterVersion)
      throw new Error("The financial starter version changed. Prepare a new build.");
    inspectProjectProtection(bundle, record);
  }
  if (bundle.manifest.permissions.some((id) => !allowed.includes(id)))
    throw new Error(
      "This build can use only its approved platform modules and app storage. The market-data capability, arbitrary plugins and LLM research are not wired yet.",
    );
  if (!project && !bundle.files["index.html"].includes("Synthetic demo"))
    throw new Error('Fixture applications must visibly include the label "Synthetic demo".');
  if (record.readiness !== "fixture") throw new Error("This build is not ready for activation.");
}
