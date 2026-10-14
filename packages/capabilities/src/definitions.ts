import { z } from "zod";
import { finmatchContractExamples, finmatchContractSchemas, finmatchDefinitions } from "./finmatch";
import {
  finmatchCompanySizeContractExamples,
  finmatchCompanySizeContractSchemas,
  finmatchCompanySizeDefinitions,
} from "./finmatch-size";

export const SIMULATION_WARNING =
  "Prototype-only arbitrary fixtures; not financial advice, live data, verified analysis, or a real risk classification.";

// Identity, not structural similarity, determines whether two ports compose.
export const simulationContractSchemas = {
  "simulation.text@1": z.string().min(1).max(4000),
  "simulation.nine-answers@1": z.array(z.string().max(500)).length(9),
  "simulation.risk@1": z.literal("simulated-low"),
  "simulation.industry@1": z.string().min(1).max(100),
  "simulation.items@1": z.array(z.string().min(1).max(200)).max(20),
  "simulation.metrics@1": z.strictObject({
    fixtureValue: z.number().finite(),
    unit: z.literal("arbitrary-fixture-units"),
  }),
  "simulation.dashboard@1": z.strictObject({
    title: z.string().max(100),
    fixtureValue: z.number().finite(),
    warning: z.literal(SIMULATION_WARNING),
  }),
} as const;

export type SimulationContractId = keyof typeof simulationContractSchemas;
export type SimulationContractValues = {
  [K in SimulationContractId]: z.infer<(typeof simulationContractSchemas)[K]>;
};
export type SimulationPorts = Readonly<Record<string, SimulationContractId>>;
export const capabilityContractSchemas = {
  ...simulationContractSchemas,
  ...finmatchContractSchemas,
  ...finmatchCompanySizeContractSchemas,
} as const;
export type CapabilityContractId = keyof typeof capabilityContractSchemas;
export type CapabilityContractValues = {
  [K in CapabilityContractId]: z.infer<(typeof capabilityContractSchemas)[K]>;
};
// Only these named producer contracts compose into the broader request contracts.
export const contractAccepts: Readonly<
  Partial<Record<CapabilityContractId, readonly CapabilityContractId[]>>
> = {
  "finmatch.risk-request@1": ["finmatch.risk-result@v0-demo"],
  "finmatch.industry-preference-request@1": ["finmatch.industry-preference@1"],
  "finmatch.mapping-policy-request@1": ["finmatch.mapping-policy@1"],
};
export const capabilityContractExamples = {
  "simulation.text@1": "fixture",
  "simulation.nine-answers@1": Array.from({ length: 9 }, () => "arbitrary"),
  "simulation.risk@1": "simulated-low",
  "simulation.industry@1": "fictional industry",
  "simulation.items@1": ["fictional"],
  "simulation.metrics@1": { fixtureValue: 1, unit: "arbitrary-fixture-units" },
  "simulation.dashboard@1": { title: "fixture", fixtureValue: 1, warning: SIMULATION_WARNING },
  ...finmatchContractExamples,
  ...finmatchCompanySizeContractExamples,
} satisfies CapabilityContractValues;
export type CapabilityPorts = Readonly<Record<string, string>>;
export type CapabilityContracts = Readonly<Record<string, z.ZodType>>;

export const capabilityStatusSchema = z.enum([
  "mock",
  "unverified",
  "verified",
  "deprecated",
  "unavailable",
]);
export type CapabilityStatus = z.infer<typeof capabilityStatusSchema>;

export interface CapabilityDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly purpose: string;
  readonly status: CapabilityStatus;
  readonly financial: boolean;
  readonly inputs: CapabilityPorts | null;
  readonly outputs: CapabilityPorts | null;
  readonly optionalInputs?: readonly string[];
  readonly inputValidation?: "handler";
  readonly internalOutputs?: readonly string[];
  readonly sourceDocuments?: readonly string[];
  readonly behavior: string | null;
  readonly coverage: string | null;
  readonly supportedAssetTypes: readonly string[] | null;
  readonly markets: readonly string[] | null;
  readonly constraints: readonly string[];
  readonly dependencies: readonly string[] | null;
  readonly unknowns: readonly string[];
  readonly evidence: { readonly verified: boolean; readonly references: readonly string[] };
  readonly simulation: {
    readonly prototypeOnly: true;
    readonly inputs: SimulationPorts;
    readonly outputs: SimulationPorts;
    readonly behavior: string;
    readonly dependencies: readonly string[];
  };
}

function definition(
  id: string,
  name: string,
  purpose: string,
  inputs: SimulationPorts,
  outputs: SimulationPorts,
  behavior: string,
  dependencies: readonly string[] = [],
): CapabilityDefinition {
  return {
    id,
    version: "1.0.0",
    name,
    purpose,
    status: "mock",
    financial: true,
    inputs: null,
    outputs: null,
    behavior: "UNKNOWN",
    coverage: "UNKNOWN",
    supportedAssetTypes: null,
    markets: null,
    constraints: [SIMULATION_WARNING],
    dependencies: null,
    unknowns: [
      "Product inputs, outputs, behavior, dependencies, asset and market coverage, and verification evidence are UNKNOWN.",
    ],
    evidence: { verified: false, references: [] },
    simulation: { prototypeOnly: true, inputs, outputs, behavior, dependencies },
  };
}

export const capabilityDefinitions: readonly CapabilityDefinition[] = [
  definition(
    "research.market",
    "Market Research",
    "Extract key metrics for specified companies; contracts and methodology are UNKNOWN.",
    { query: "simulation.text@1" },
    { research: "simulation.text@1" },
    "Return a fixed simulated research note; no search or sources.",
  ),
  definition(
    "analysis.company-history",
    "Company History",
    "Analyze company history and trends; methodology is UNKNOWN.",
    { company: "simulation.text@1" },
    { history: "simulation.text@1" },
    "Return a fixed fictional history note.",
  ),
  definition(
    "data.stock-price-api",
    "Stock Price API",
    "Obtain stock information through an API, not forecasts; data coverage is UNKNOWN.",
    { symbol: "simulation.text@1" },
    { metrics: "simulation.metrics@1" },
    "Return arbitrary fixture units; no API or stock price.",
  ),
  definition(
    "data.company-news",
    "Company News",
    "Obtain company news headlines; sources and coverage are UNKNOWN.",
    { company: "simulation.text@1" },
    { news: "simulation.items@1" },
    "Return a fixed fictional news item; no news feed.",
  ),
  definition(
    "profile.risk-appetite",
    "Risk Appetite",
    "Profile low/mid/high risk appetite from nine answers; scoring is UNKNOWN.",
    { answers: "simulation.nine-answers@1" },
    { risk: "simulation.risk@1" },
    "Ignore scoring and return simulated-low; not a real classification.",
  ),
  definition(
    "profile.industry-preference",
    "Industry Preference",
    "Concept: capture industry preference.",
    { preference: "simulation.industry@1" },
    { industry: "simulation.industry@1" },
    "Echo a prototype preference without analysis.",
  ),
  definition(
    "selection.risk-industry",
    "Risk and Industry Selection",
    "Select companies by company size, industry, and risk; selection rules are UNKNOWN.",
    { risk: "simulation.risk@1", industry: "simulation.industry@1" },
    { selections: "simulation.items@1" },
    "Return a fictional selection label, not an investment recommendation.",
    ["profile.risk-appetite@1.0.0", "profile.industry-preference@1.0.0"],
  ),
  definition(
    "extraction.annual-report-metrics",
    "Annual Report Metrics",
    "Extract metrics from annual-report PDFs; the PDF input format is known conceptually, but its contract and extraction behavior are UNKNOWN.",
    { report: "simulation.text@1" },
    { metrics: "simulation.metrics@1" },
    "Ignore report contents and return arbitrary fixture units; no extraction.",
  ),
  definition(
    "presentation.metrics-dashboard",
    "Metrics Dashboard",
    "Concept: present metrics in a dashboard.",
    { metrics: "simulation.metrics@1" },
    { dashboard: "simulation.dashboard@1" },
    "Return a prototype dashboard payload with a fixture warning; no UI rendering.",
  ),
  ...finmatchDefinitions,
  ...finmatchCompanySizeDefinitions,
];

// Shared catalog objects must not be alterable into fabricated verified evidence.
function freeze(value: object): void {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object") freeze(child);
  }
  Object.freeze(value);
}
freeze(capabilityDefinitions);
freeze(capabilityContractExamples);
freeze(contractAccepts);

export function resolveCapabilityDefinition(id: string, version: string) {
  return capabilityDefinitions.find((entry) => entry.id === id && entry.version === version);
}

export function getCapabilityPorts(
  definition: CapabilityDefinition,
  direction: "inputs" | "outputs",
): CapabilityPorts | null {
  return definition.status === "mock" ? definition.simulation[direction] : definition[direction];
}
