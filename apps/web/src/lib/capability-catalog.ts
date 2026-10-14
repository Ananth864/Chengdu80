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

// These IDs also occur in persisted releases. Related v2 contracts are not aliases:
// their scoring, discovery, data and architecture requirements differ.
export const businessCapabilities = [
  "market-research",
  "historical-analysis",
  "price-target",
  "risk-assessment",
  "industry-preference",
  "risk-industry-matching",
  "company-cards",
] as const;
export type BusinessCapability = (typeof businessCapabilities)[number];
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
    description: "Industry research with company context when requested.",
    availability: "Research adapters and revised v2 industry calculations are not implemented.",
    // News is not pulled into the closure: the platform does not offer news
    // tracking, and catalog v2.1.0 removes the company-industry-news contract.
    dependencies: [],
    protocol: "research",
    relatedCatalogIds: ["industry-research"],
  },
  "historical-analysis": {
    label: "Historical analysis",
    description: "Historical price analysis within the existing history/target package.",
    availability:
      "The v2 adjusted drawdown and five-year coverage contract is not implemented in the scoped app runtime.",
    dependencies: ["price-target"],
    protocol: "history",
    relatedCatalogIds: ["historical-analysis"],
  },
  "price-target": {
    label: "Sourced price target",
    description: "Externally sourced targets, never locally predicted prices.",
    availability:
      "The v2 brokerage selection, rating mappings and horizon grouping adapters are pending.",
    dependencies: ["historical-analysis"],
    protocol: "history",
    relatedCatalogIds: ["price-target"],
  },
  "risk-assessment": {
    label: "Risk appetite assessment",
    description: "Explicit synthetic profile input for the existing matching module.",
    availability:
      "The v2 seven-question scoring contract is not implemented. Do not claim questionnaire validation.",
    dependencies: ["risk-industry-matching"],
    protocol: "matching",
    relatedCatalogIds: ["risk-profile"],
  },
  "industry-preference": {
    label: "Industry preference",
    description: "Company-table industry selection for matching.",
    availability: "Current table industries are not the supplied v2 five-industry CSV taxonomy.",
    dependencies: ["risk-industry-matching"],
    protocol: "matching",
    relatedCatalogIds: ["industry-preferences"],
  },
  "risk-industry-matching": {
    label: "Risk/industry matching",
    description: "Protected synthetic risk/size and industry matching.",
    availability: "Current matching does not implement the revised v2 company-discovery contract.",
    dependencies: ["risk-assessment", "industry-preference"],
    protocol: "matching",
    relatedCatalogIds: ["company-discovery"],
  },
  "company-cards": {
    label: "Daily company cards",
    description: "Stable China-day batches, decisions and watchlists using protected modules.",
    availability:
      "V2 uses sessions rather than daily batches. New metrics, medians and session policy are pending.",
    dependencies: ["risk-industry-matching"],
    protocol: "matching",
    relatedCatalogIds: ["company-discovery", "company-card-metrics", "watchlist"],
  },
};
for (const definition of Object.values(capabilityDefinitions))
  for (const id of definition.relatedCatalogIds)
    if (!capabilityCatalog.capabilities.some((capability) => capability.id === id))
      throw new Error(`Runtime references missing catalog capability: ${id}`);

export const capabilityCatalogInstructions = [
  `Requirement mapping catalog (capability.json): ${JSON.stringify(capabilityCatalog)}`,
  `Current executable build IDs and implementation boundaries: ${JSON.stringify(capabilityDefinitions)}`,
  "Use the supplied catalog to understand and explain requirements, selecting only relevant contracts, not every entry. Catalog implementation_status and verification claims describe the supplied specification, not independently verified platform readiness. Related catalog IDs are requirement references, not aliases or proof that revised contracts are implemented.",
  "The platform integration and safety rules take precedence over conflicting catalog architecture instructions. New apps must retain the protected React starter and modules; do not switch to four-file legacy bundles, alter financial algorithms or create server adapters from a generated app. Live preparation verifies company identity, not financial adapter coverage. Passing previews require user activation. ui.open, revised questionnaire/session logic and additional market-data bridges remain unavailable until implemented and verified by the platform team. Never claim these work from catalog text or endpoint-access claims alone.",
  "Ordinary forms, navigation, uploads, CSV/JSON parsing, import previews, permitted app-owned persistence and record-search interfaces within a supported financial app do not require new financial capabilities. A database-grounded chatbot is a skill-guided application component, not a financial capability ID. The removed grounded-chatbot catalog entry does not prohibit implementing its chat UI, approved conversational templates, clarification or deterministic read-only handlers over authorized app-owned records. Load read_financial_skill('database-grounded-chatbot') for such requests; do not reject them solely because that ID is absent from the catalog or silently replace the requested chat with education panels. Keep only the underlying requested financial operations in the build plan. This does not grant external model/database access, new financial calculations or unrestricted financial synthesis. Standalone unrelated apps, trading and continuous monitoring remain outside scope. Missing data stays unavailable; never replace explicitly requested live data with fixtures.",
].join("\n\n");
