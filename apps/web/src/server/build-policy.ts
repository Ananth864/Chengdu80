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
import { financialExpertInstructions, financialSkills } from "./financial-expert";
import { buildPlanSchema, type BusinessCapability, type BuildRecord } from "../lib/build-plan";
import type { AppBundle } from "../lib/contracts";
import { sseACompanies } from "./providers";
import {
  type Company,
  type CompanyLookupInput,
  type LiveCompany,
  rankCompanyMatches,
} from "../lib/company-table";
import {
  capabilityCatalogInstructions,
  capabilityDefinitions,
  businessCapabilities,
} from "../lib/capability-catalog";

export const agentProtocols = {
  communication,
  builder,
  "application-llm": applicationLlm,
  "financial-expert": financialExpertInstructions,
  "capability-catalog": capabilityCatalogInstructions,
};
export { frontendDesign };
const protocols = { research, history, matching };
const capabilityProtocols = Object.fromEntries(
  businessCapabilities.map((id) => [id, protocols[capabilityDefinitions[id].protocol]]),
) as Record<BusinessCapability, string>;
export const capabilityDependencies = Object.fromEntries(
  businessCapabilities.map((id) => [id, capabilityDefinitions[id].dependencies]),
) as Record<BusinessCapability, BusinessCapability[]>;
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
// Build-time identity resolves with the same ranked matcher the
// lookup_companies tool uses, so the identity the search surfaced is the
// identity that gets pinned; strict equality stays as a fast path. Only a
// genuinely ambiguous or absent company blocks.
function resolveQueryIdentity(
  query: string,
  companies: CompanyLookupInput[],
): { ticker: string; ambiguous: false } | { ticker: null; ambiguous: boolean } {
  const normalized = query.trim().toLocaleLowerCase();
  const exact = companies.filter((company) => identityMatches(normalized, company));
  if (exact.length === 1) return { ticker: exact[0]!.ticker, ambiguous: false };
  const ranked = rankCompanyMatches(query, companies);
  const top = ranked[0];
  if (ranked.length === 1 && top?.ticker) return { ticker: top.ticker, ambiguous: false };
  return { ticker: null, ambiguous: ranked.length > 1 };
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
    const resolved = resolveQueryIdentity(query, table.companies);
    if (resolved.ticker) {
      companyIds.push(resolved.ticker);
      continue;
    }
    blockers.push(
      resolved.ambiguous
        ? `Ambiguous company: ${query}. Ask which ticker is intended.`
        : `Company is outside the SSE Class A scope: ${query}. The platform currently supports Shanghai Stock Exchange Class A companies only.`,
    );
  }
  if (resolvedCapabilities.includes("historical-analysis") && !plan.companyQueries.length)
    blockers.push(
      "Select a supported company for the historical-analysis and price-target package.",
    );
  const protocolHashes = Object.fromEntries(
    [
      ...Object.entries(agentProtocols),
      ...Object.entries(financialSkills).map(
        ([id, content]) => [`financial-skill:${id}`, content] as const,
      ),
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
    readiness: blockers.length ? ("blocked" as const) : plan.mode,
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
  if (
    !project &&
    record.readiness === "fixture" &&
    !bundle.files["index.html"].includes("Synthetic demo")
  )
    throw new Error('Fixture applications must visibly include the label "Synthetic demo".');
}
