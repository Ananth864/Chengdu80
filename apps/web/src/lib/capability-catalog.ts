import { z } from "zod";
import source from "./capability.json";

const text = z.string().trim().min(1);
const catalogSchema = z
  .object({
    library_id: z.literal("shared-financial-capabilities"),
    version: text,
    revision_notes: z.array(text),
    capabilities: z
      .array(
        z
          .object({
            id: text,
            name: text,
            purpose: text,
            inputs: z.array(text),
            outputs: z.array(text).min(1),
            specifications: z.array(text).optional(),
            depends_on: z.array(text).optional(),
            optional_dependencies: z.array(text).optional(),
            contract_version: text,
            implementation_status: text,
            implementation: text,
          })
          .passthrough(),
      )
      .min(1),
    limitations: z.array(text),
    composition: text,
    prototype_generation_instructions: z.array(text),
    legacy_id_maps: z.record(z.string(), z.record(z.string(), text)),
  })
  .passthrough()
  .superRefine((catalog, ctx) => {
    const ids = new Set(catalog.capabilities.map((capability) => capability.id));
    if (ids.size !== catalog.capabilities.length)
      ctx.addIssue({ code: "custom", message: "Catalog capability IDs must be unique." });
    for (const capability of catalog.capabilities) {
      const dependencies = [
        ...(capability.depends_on ?? []),
        ...(capability.optional_dependencies ?? []),
      ];
      if (
        new Set(dependencies).size !== dependencies.length ||
        dependencies.some((id) => id === capability.id || !ids.has(id))
      )
        ctx.addIssue({ code: "custom", message: `Invalid dependencies for ${capability.id}.` });
    }
  });
export function parseCapabilityCatalog(value: unknown) {
  return catalogSchema.parse(value);
}
export const capabilityCatalog = parseCapabilityCatalog(source);

// These IDs also occur in persisted releases. Canonical catalog references do not
// change a release's pinned contracts or grant executable permissions.
export const businessCapabilities = [
  "market-research",
  "historical-analysis",
  "price-target",
  "risk-assessment",
  "industry-preference",
  "risk-industry-matching",
  "company-cards",
] as const;
// The removed ID remains readable in persisted build records, never selectable in new plans.
export type BusinessCapability = (typeof businessCapabilities)[number] | "news";
type RuntimeDefinition = {
  label: string;
  description: string;
  availability: string;
  dependencies: BusinessCapability[];
  protocol: "research" | "history" | "matching";
  relatedCatalogIds: string[];
};
export const capabilityDefinitions: Record<BusinessCapability, RuntimeDefinition> = {
  "market-research": {
    label: "Market research",
    description: "Historical listed-company revenue and matched-cohort industry growth.",
    availability:
      "Implemented in server/industry-research.ts with Tushare income retrieval through the platform bridge. Representative authenticated transport is documented, not complete annual coverage or source currency/unit comparability; missing observations remain partial or unavailable. No whole-China market size, news or outlook.",
    dependencies: [],
    protocol: "research",
    relatedCatalogIds: ["industry-research"],
  },
  news: {
    label: "News retrieval",
    description: "Persisted legacy news ID; unsupported by the supplied six-capability catalog.",
    availability:
      "Unavailable: company and industry news retrieval is excluded from the supplied catalog. Retaining this runtime ID does not authorize retrieval or grant new permissions.",
    dependencies: [],
    protocol: "research",
    relatedCatalogIds: [],
  },
  "historical-analysis": {
    label: "Historical analysis",
    description: "Independent raw-price history and adjusted-close drawdown analysis.",
    availability:
      "Implemented in server/historical-analysis.ts using Tushare daily and adj_factor through the platform bridge. Representative authenticated retrieval is documented; actual period coverage and missing factors remain explicit. No price-target dependency or all-time claims.",
    dependencies: [],
    protocol: "history",
    relatedCatalogIds: ["historical-analysis"],
  },
  "price-target": {
    label: "Sourced price target",
    description: "Externally sourced targets, never locally predicted prices.",
    availability:
      "Implemented in server/price-target.ts with latest-per-brokerage selection, evidence-gated rating mappings and verified-horizon midpoint groups. Representative report_rc retrieval is documented; live rating mappings and target horizons remain unverified and must not be invented. Its internal raw-quote retrieval does not require historical-analysis UI scope.",
    dependencies: [],
    protocol: "history",
    relatedCatalogIds: ["price-target"],
  },
  "risk-assessment": {
    label: "Risk appetite assessment",
    description: "Seven-question provisional demo profile, separate from company matching.",
    availability:
      "Seven-question v0-demo scoring and protected RiskQuestionnaire are implemented via finance.risk-profile. This is not a validated suitability assessment.",
    dependencies: [],
    protocol: "matching",
    relatedCatalogIds: ["risk-profile"],
  },
  "industry-preference": {
    label: "Industry preference",
    description: "Independent five-industry preference capture and exact-label filtering.",
    availability:
      "Protected IndustryPreference from @/components/industry-preference implements catalog contract v1.4.0 capture_preferences and exact-label filter_companies via finance.industry-preferences. Capture saves validated completed normalized preferences under industry-preference through platform storage only after success. No risk result, questionnaire, company catalog or market data required.",
    dependencies: [],
    protocol: "matching",
    relatedCatalogIds: ["industry-preferences"],
  },
  "risk-industry-matching": {
    label: "Risk/industry matching",
    description: "CSV-backed company discovery with independent size and industry filters.",
    availability:
      "Protected CompanyDiscovery and finance.company-discovery implement up to five memory-only single-company rounds. Requires completed risk result and normalized preferences; no live metrics or suitability claims.",
    dependencies: ["risk-assessment", "industry-preference"],
    protocol: "matching",
    relatedCatalogIds: ["company-discovery"],
  },
  "company-cards": {
    label: "Company discovery cards",
    description:
      "One discovered company per round; card actions and saved-company state are app-owned.",
    availability:
      "Protected CompanyDiscovery uses CSV-backed memory-only sessions. App-owned exclusions and actions are optional; existing persisted releases retain pinned behavior until an approved upgrade. Financial metrics, medians and watchlists are not standalone catalog capabilities or implied by discovery.",
    dependencies: ["risk-industry-matching"],
    protocol: "matching",
    relatedCatalogIds: ["company-discovery"],
  },
};
for (const definition of Object.values(capabilityDefinitions))
  for (const id of definition.relatedCatalogIds)
    if (!capabilityCatalog.capabilities.some((capability) => capability.id === id))
      throw new Error(`Runtime references missing catalog capability: ${id}`);

export const capabilityCatalogInstructions = [
  `Requirement mapping catalog (capability.json): ${JSON.stringify(capabilityCatalog)}`,
  `Current executable build IDs and implementation boundaries: ${JSON.stringify(Object.fromEntries(businessCapabilities.map((id) => [id, capabilityDefinitions[id]])))}`,
  "The six canonical contracts are risk-profile v1.0.0, industry-preferences v1.4.0, company-discovery v1.3.0, historical-analysis v1.2.0, industry-research v1.2.0 and price-target v1.2.0 in library v1.9.0. All have platform demo implementations. Preserve protected React modules and each prepared release's pinned runtime contracts; catalog versions do not rewrite persisted releases. CompanyDiscovery and finance.company-discovery use supplied CSV identities/size categories, normalized five-industry preferences and completed v0-demo risk results. Sessions stay in memory with one company per round, up to five distinct companies. Optional excluded_company_ids come from app-owned state; absence means no app exclusions. Prior exposure alone does not permanently exclude a company. The consuming app owns card actions and any saved-company list; discovery does not implement a watchlist or financial metrics.",
  "For approved prepared industry-preference scope, the platform derives executable finance.industry-preferences and storage permissions; markdown is not authorization. capture_preferences needs no risk result, questionnaire, company catalog or market data. selected_industries accepts only manufacturing, information_software_it, utilities, financial_services and wholesale_retail; deduplicate in first-occurrence order. Explicitly submitting an empty array produces selection_mode=all_supported with all five effective IDs; absent or invalid input is invalid. Explicitly selecting all five remains selection_mode=selected. After successful capture, persist only the validated completed normalized industry_preference under industry-preference through platform storage and report a save only after storage succeeds. Do not persist drafts or infer preferences from questionnaire answers. filter_companies matches exact labels from the protected five-industry CSV taxonomy, preserving input record order and duplicates; an explicit empty industry_labels array preserves all records. Do not translate, fuzzy-match or widen labels. All-supported discovery remains subject to the independent size filter and does not promise equal industry representation.",
  "Use the supplied catalog as authoritative financial semantics, selecting only relevant contracts, not every entry or example composition. Related catalog IDs are requirement references, not aliases or executable permissions. Risk assessment and industry preference are independent; matching requires both and company-cards retains its runtime matching dependency. Industry research, historical analysis and price-target are independent requested operations. Price-target retrieves its prerequisite raw quote internally; do not add a historical-analysis panel or permission scope solely for that quote.",
  "The platform integration and safety rules take precedence over conflicting catalog architecture instructions. New apps must retain the protected React starter and modules; do not switch to four-file legacy bundles, alter financial algorithms or create server adapters from a generated app. Use implemented TypeScript financial adapters only through authorized platform bridges. Require an application-specific specification, explicit Workflow approval recorded server-side for the exact proposal, per-turn capability/dependency/company/permission checks and server-key-protected writes. Changed plan fields require new approval; passing previews still require separate explicit user activation. Generated Node/Bash/SSR code runs only in the Linux Bubblewrap sandbox, through the Docker launcher on macOS, never on the host. The v0-demo risk questionnaire uses protected RiskQuestionnaire and finance.risk-profile; keep score/bucket hidden, discard partial attempts, and persist only completed validated results through platform storage.read/storage.write. Never use direct browser storage or direct financial network requests. ui.open remains unavailable without an implemented authorized platform method.",
  "server/historical-analysis.ts, server/industry-research.ts and server/price-target.ts are implemented, not pending ports. docs/tushare-verification.md records representative authenticated daily, adj_factor, income and report_rc retrieval. This proves transport access at the recorded instant, not complete five-year coverage, every-company annual statement comparability, brokerage-specific rating mappings or target horizons. Keep data status, source, units, dates and limitations explicit. Unverified rating mappings and horizons must stay unavailable, never inferred from wording, report age or financial forecast quarter. Price-target displays sourced brokerage opinions and evidence-backed midpoint groups, not a local forecast, personalized recommendation or guaranteed return. Industry research is historical supplied-universe listed-company revenue only; no whole-China market size, industry outlook or forecasting. News retrieval and annual-report extraction/comparison are outside the supplied catalog; the persisted news ID grants no new permission. No generic personalized suitability, trading or continuous monitoring.",
  "Ordinary forms, navigation, uploads, CSV/JSON parsing, import previews, permitted app-owned persistence and record-search interfaces within a supported financial app do not require new financial capabilities. A database-grounded chatbot is a skill-guided application component, not a financial capability ID. The removed grounded-chatbot catalog entry does not prohibit implementing its chat UI, approved conversational templates, clarification or deterministic read-only handlers over authorized app-owned records. Load read_financial_skill('database-grounded-chatbot') for such requests; do not reject them solely because that ID is absent from the catalog or silently replace the requested chat with education panels. Keep only the underlying requested financial operations in the build plan. This does not grant external model/database access, new financial calculations or unrestricted financial synthesis. Standalone unrelated apps, trading and continuous monitoring remain outside scope. Missing data stays unavailable; never replace explicitly requested live data with fixtures.",
].join("\n\n");
