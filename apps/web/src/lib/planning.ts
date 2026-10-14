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
    "Research about an entire industry. The daily company cards then add detail about each company before a decision.",
  news: "News is gathered once each time the research runs — it does not refresh on its own.",
  "historical-analysis":
    "Price chart, latest price, 52-week and all-time highs and lows, how far the price has fallen from its peak, and the daily change.",
  "price-target":
    "A price target published by an outside source, always shown with who published it, when, in which currency, and over what time frame. The app never predicts prices itself.",
  "risk-assessment":
    "A proper expert questionnaire is not available yet; the risk profile is your own comfort choice, not an expert assessment.",
  "industry-preference": "Industries come from the platform's checked company list.",
  "risk-industry-matching":
    "Low risk is paired with larger companies, medium with mid-sized, and high with smaller ones — then narrowed to your chosen industries.",
  "company-cards":
    "Up to five companies per trading day, each with a simple yes/no decision and a watchlist option.",
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
      label: record ? "Live platform data" : "Your inputs",
      detail: record
        ? `Live market data from ${
            record.provider === "tushare" ? "Tushare" : record.provider
          }, using the platform's checked company list.`
        : "These are confirmed when the app is built.",
      inputs: [
        spec.inputs.join("; "),
        requirements?.assumptions.length
          ? `Assumptions: ${requirements.assumptions.join("; ")}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
      outputs: requirements?.missingInputs.length
        ? `The information the app needs (still missing: ${requirements.missingInputs.join("; ")})`
        : "The information the app needs",
    },
  ];
  if (record?.companyIds.length)
    nodes.push({
      id: "companies",
      kind: "data",
      label: "Companies you picked",
      detail: "Matched against the platform's checked company list.",
      inputs: record.companyIds.join(", "),
      outputs: "Each company's name, industry and size",
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
          ? "Your inputs and the company list"
          : "Your inputs",
      outputs: "Findings passed on to your app",
    });
  nodes.push({
    id: "output",
    kind: "output",
    label: spec.name,
    detail: spec.purpose,
    inputs: "Findings from the steps",
    outputs: spec.outputs.join("; "),
  });
  const middle = nodes.filter((node) => node.kind === "capability");
  return {
    basis: record ? "build-record" : "draft",
    nodes,
    edges: middle.length
      ? [
          ...sourceIds.flatMap((from) =>
            middle.map((node) => ({ from, to: node.id, label: "supplies information" })),
          ),
          ...middle.map((node) => ({ from: node.id, to: "output", label: "adds its findings" })),
        ]
      : sourceIds.map((from) => ({ from, to: "output", label: "provides the information" })),
  };
}
