import type { BuildRecord, BusinessCapability } from "./build-plan";
import type { ProductSpec, Requirements } from "./contracts";

export type WorkflowGraph = {
  basis: "draft" | "build-record";
  nodes: {
    id: string;
    kind: "data" | "capability" | "output";
    label: string;
    detail: string;
    inputs: string;
    outputs: string;
  }[];
  edges: { from: string; to: string; label: string }[];
};

const capabilityLabels: Record<BusinessCapability, string> = {
  "market-research": "Market research",
  news: "News retrieval",
  "historical-analysis": "Historical analysis",
  "price-target": "Sourced price target",
  "risk-assessment": "Risk appetite assessment",
  "industry-preference": "Industry preference",
  "risk-industry-matching": "Risk/industry matching",
  "company-cards": "Daily company cards",
};
const capabilityDetails: Record<BusinessCapability, string> = {
  "market-research":
    "Industry-level research; company-card details add company-specific context before each decision.",
  news: "Demo news is retrieved once per research run; there is no recurring monitoring.",
  "historical-analysis":
    "Price chart, current price, 52-week/all-time extremes, drawdown and daily change.",
  "price-target":
    "Externally sourced target with source, date, currency and horizon; never locally predicted.",
  "risk-assessment":
    "Expert questionnaire and scoring are pending; only explicit synthetic demo profiles exist.",
  "industry-preference": "Industries come from the platform-managed company table.",
  "risk-industry-matching":
    "Fixed mapping: low to large, medium to medium, high to small cap, intersected with chosen industries.",
  "company-cards":
    "Up to five random eligible companies per China day with yes/no decisions and a watchlist.",
};
export function capabilityLabel(id: BusinessCapability) {
  return capabilityLabels[id];
}

// Conceptual explanation for review; not an executable graph or proven execution order.
export function workflowGraph(
  spec: ProductSpec,
  requirements: Requirements | undefined,
  record: BuildRecord | undefined,
): WorkflowGraph {
  const nodes: WorkflowGraph["nodes"] = [
    {
      id: "data",
      kind: "data",
      label: record
        ? record.plan.mode === "fixture"
          ? "Synthetic demo data"
          : "Live platform data"
        : "Application inputs",
      detail: record
        ? `Company table ${record.companyTableVersion} · provider ${record.provider} (integration pending)`
        : "Inputs are confirmed when the internal build record is prepared.",
      inputs: [
        spec.inputs.join("; "),
        requirements?.assumptions.length
          ? `Assumptions: ${requirements.assumptions.join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      outputs: requirements?.missingInputs.length
        ? `Normalized application inputs (missing: ${requirements.missingInputs.join("; ")})`
        : "Normalized application inputs",
    },
  ];
  if (record?.companyIds.length)
    nodes.push({
      id: "companies",
      kind: "data",
      label: "Requested companies",
      detail: "Resolved against the platform-managed company table.",
      inputs: record.companyIds.join(", "),
      outputs: "Table identities with industry and size category",
    });
  const sourceIds = record?.companyIds.length ? ["data", "companies"] : ["data"];
  const capabilities = record?.resolvedCapabilities ?? [];
  for (const id of capabilities)
    nodes.push({
      id,
      kind: "capability",
      label: capabilityLabels[id],
      detail: capabilityDetails[id],
      inputs:
        sourceIds.includes("companies") && id !== "market-research"
          ? "Application and company-table inputs"
          : "Application inputs",
      outputs: "Capability results",
    });
  nodes.push({
    id: "output",
    kind: "output",
    label: spec.name,
    detail: spec.purpose,
    inputs: "Capability results",
    outputs: spec.outputs.join("; "),
  });
  const middle = nodes.filter((node) => node.kind === "capability");
  return {
    basis: record ? "build-record" : "draft",
    nodes,
    edges: middle.length
      ? [
          ...sourceIds.flatMap((from) =>
            middle.map((node) => ({ from, to: node.id, label: "Provides inputs" })),
          ),
          ...middle.map((node) => ({ from: node.id, to: "output", label: "Contributes results" })),
        ]
      : sourceIds.map((from) => ({ from, to: "output", label: "Conceptual input" })),
  };
}
