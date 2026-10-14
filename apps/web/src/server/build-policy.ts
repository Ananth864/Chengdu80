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
import {
  buildPlanSchema,
  type BuildPlan,
  type BusinessCapability,
  type BuildRecord,
} from "../lib/build-plan";
import type { AppBundle } from "../lib/contracts";
import { sseACompanies } from "./providers";
import {
  type Company,
  type CompanyLookupInput,
  type LiveCompany,
  rankCompanyMatches,
} from "../lib/company-table";
import { capabilityCatalogInstructions, capabilityDefinitions } from "../lib/capability-catalog";
import { suppliedCompanyUniverse, suppliedCompanyUniverseVersion } from "./company-universe";

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
  Object.entries(capabilityDefinitions).map(([id, definition]) => [
    id,
    protocols[definition.protocol],
  ]),
) as Record<BusinessCapability, string>;
export const capabilityDependencies = Object.fromEntries(
  Object.entries(capabilityDefinitions).map(([id, definition]) => [id, definition.dependencies]),
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

// Workflow approval is asked once per plan. A model re-emitting the approved
// plan differs cosmetically (field order, list order, equivalent requirements
// wording); those proceed under the recorded approval, while material changes
// require a newly approved proposal.
const requirementsSimilarityFloor = 0.6;

export type PlanApprovalMismatch =
  | "mode"
  | "capabilities"
  | "companyQueries"
  | "themeOverride"
  | "cardMetrics"
  | "requirements";

function sameSet(left: string[], right: string[]) {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// English words plus individual CJK characters, so Chinese requirement texts
// compare by character overlap instead of as one unsplit token.
function requirementTokens(text: string) {
  return new Set(text.toLowerCase().match(/[a-z0-9]+|[\u4e00-\u9fff]/g) ?? []);
}

function requirementsSimilarity(approved: string, declared: string) {
  const left = requirementTokens(approved);
  const right = requirementTokens(declared);
  if (!left.size || !right.size) return approved.trim() === declared.trim() ? 1 : 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export function planMatchesApproval(
  approved: BuildPlan,
  declared: BuildPlan,
): PlanApprovalMismatch | undefined {
  if (approved.mode !== declared.mode) return "mode";
  // Capability order is immaterial: selection and explicit dependencies
  // resolve to the same dependency-closed set. Company queries likewise
  // resolve to the same companies regardless of ordering.
  if (
    JSON.stringify(resolveCapabilities(approved.capabilities)) !==
    JSON.stringify(resolveCapabilities(declared.capabilities))
  )
    return "capabilities";
  if (!sameSet(approved.companyQueries, declared.companyQueries)) return "companyQueries";
  if ((approved.themeOverride ?? null) !== (declared.themeOverride ?? null)) return "themeOverride";
  // Metric selection is a unique set, not an ordered list.
  if (!sameSet(approved.cardMetrics ?? [], declared.cardMetrics ?? [])) return "cardMetrics";
  if (
    requirementsSimilarity(approved.requirements, declared.requirements) <
    requirementsSimilarityFloor
  )
    return "requirements";
  return undefined;
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
// Fixture identity is retained only for pinned legacy releases; new plans are live-only.
export async function managedCompanies(
  mode: "fixture" | "live" = "live",
): Promise<ManagedCompanyTable> {
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
): Promise<BuildRecord & { plan: BuildPlan; readiness: "live" | "blocked" }> {
  const plan = buildPlanSchema.parse(raw);
  const resolvedCapabilities = resolveCapabilities(plan.capabilities);
  const table = {
    available: true as const,
    synthetic: false,
    version: suppliedCompanyUniverseVersion,
    companies: suppliedCompanyUniverse().map((company) => ({
      ticker: `${company.ticker}.SH`,
      name: company.name,
      industry: company.industry,
    })),
  };
  const blockers: string[] = [...additionalBlockers];
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
        : `Company is outside the SSE Class A scope: ${query}. Reject this company and propose a different real Shanghai Stock Exchange Class A company instead (lookup_companies); never offer demo or synthetic data.`,
    );
  }
  if (
    resolvedCapabilities.some((id) =>
      ["historical-analysis", "price-target", "market-research"].includes(id),
    ) &&
    !plan.companyQueries.length
  )
    blockers.push("Select a supplied-CSV company for the requested financial analysis.");
  const canonical = new Set(suppliedCompanyUniverse().map((company) => company.ticker));
  if (
    resolvedCapabilities.some((id) =>
      ["historical-analysis", "price-target", "market-research"].includes(id),
    )
  )
    for (const ticker of companyIds)
      if (!canonical.has(ticker.replace(/\.SH$/, "")))
        blockers.push(`Company ${ticker} is outside the supplied CSV universe.`);
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
  // Keep the shell's industry picker on the protected CSV taxonomy.
  const confirmed = new Set(companyIds);
  const companyIndustries = [
    ...new Set(
      suppliedCompanyUniverse()
        .filter((company) => confirmed.size === 0 || confirmed.has(`${company.ticker}.SH`))
        .map((company) => company.industry),
    ),
  ].sort();
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
    moduleVersions: {
      companies: companyModuleVersion,
      starter: financialStarterVersion,
      ...(resolvedCapabilities.includes("risk-assessment") ? { "risk-profile": "v0-demo" } : {}),
      ...(resolvedCapabilities.includes("industry-preference")
        ? { "industry-preferences": "v1.4.0" }
        : {}),
      ...(resolvedCapabilities.includes("risk-industry-matching")
        ? { "company-discovery": "v1.3.0" }
        : {}),
      ...(resolvedCapabilities.includes("historical-analysis")
        ? { "finance.historical-analysis": "1.2.0" }
        : {}),
      ...(resolvedCapabilities.includes("market-research")
        ? { "finance.industry-research": "1.2.0" }
        : {}),
      ...(resolvedCapabilities.includes("price-target") ? { "finance.price-target": "1.2.0" } : {}),
    },
    companyIndustries,
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
    if (
      ![financialStarterVersion, "financial-react-v1"].includes(record.moduleVersions.starter ?? "")
    )
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
