import type { BuildPlan, BuildRecord, BusinessCapability } from "./build-plan";
import type { Application, ProductSpec, Requirements } from "./contracts";
import { capabilityDefinitions } from "./capability-catalog";

export type WorkflowGraph = {
  basis: "draft" | "build-record" | "active-release" | "proposal";
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

export function capabilityLabel(id: BusinessCapability) {
  return capabilityDefinitions[id].label;
}

export function applicationWorkflow(app: Application): WorkflowGraph {
  if (app.buildProposal?.specification && app.buildProposal.plan)
    return {
      ...workflowGraph(
        app.buildProposal.specification,
        app.requirements,
        undefined,
        app.buildProposal.plan,
      ),
      basis: "proposal",
    };
  if (app.current)
    return {
      ...workflowGraph(app.current.spec, undefined, app.current.buildRecord),
      basis: "active-release",
    };
  const record = app.buildRecords?.at(-1);
  return workflowGraph(
    app.workspaceSpec ?? app.spec,
    app.requirements,
    record?.readiness === "blocked" ? undefined : record,
  );
}

// Conceptual explanation for review; not an executable graph or proven execution order.
export function workflowGraph(
  spec: ProductSpec,
  requirements: Requirements | undefined,
  record: BuildRecord | undefined,
  proposal?: BuildPlan,
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
        ? `Company table ${record.companyTableVersion} · provider ${record.provider}`
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
  if (proposal && spec.inputs.length) {
    nodes[0] = {
      ...nodes[0]!,
      label: spec.inputs[0]!,
      detail: "Proposed application input; not verified runtime data.",
    };
    for (const [index, input] of spec.inputs.slice(1).entries())
      nodes.push({
        id: `input-${index + 1}`,
        kind: "data",
        label: input,
        detail: "Proposed application input; not verified runtime data.",
        inputs: input,
        outputs: "Application input",
      });
  }
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
  const capabilities: BusinessCapability[] = proposal
    ? [...new Set(proposal.capabilities)]
    : record
      ? [...new Set(record.plan.capabilities)].filter((id) =>
          record.resolvedCapabilities.includes(id),
        )
      : [];
  const dependencies =
    record?.resolvedCapabilities.filter((id) => !capabilities.includes(id)) ?? [];
  for (const id of capabilities)
    nodes.push({
      id,
      kind: "capability",
      label: capabilityLabel(id),
      detail: [
        capabilityDefinitions[id].description,
        capabilityDefinitions[id].availability,
        dependencies.length
          ? `Build supporting dependencies: ${dependencies.map(capabilityLabel).join(", ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      inputs:
        sourceIds.includes("companies") && id !== "market-research"
          ? "Application and company-table inputs"
          : "Application inputs",
      outputs: "Capability results",
    });
  const outputs = spec.outputs.map((output) => output.trim()).filter(Boolean);
  for (const [index, output] of (outputs.length ? outputs : ["No outputs specified yet"]).entries())
    nodes.push({
      id: `output-${index}`,
      kind: "output",
      label: output,
      detail: outputs.length
        ? (spec.outputDetails?.[output] ?? "No additional detail recorded for this output.")
        : "The application specification has not defined any outputs yet.",
      inputs: "As defined by the application specification; not verified runtime results",
      outputs: outputs.length ? output : "None recorded.",
    });
  const middle = nodes.filter((node) => node.kind === "capability");
  const outputNodes = nodes.filter((node) => node.kind === "output");
  return {
    basis: record ? "build-record" : "draft",
    nodes,
    edges: middle.length
      ? [
          ...sourceIds.flatMap((from) =>
            middle.map((node) => ({ from, to: node.id, label: "Provides inputs" })),
          ),
          ...middle.flatMap((node) =>
            outputNodes.map((output) => ({
              from: node.id,
              to: output.id,
              label: "Contributes results",
            })),
          ),
        ]
      : sourceIds.flatMap((from) =>
          outputNodes.map((output) => ({ from, to: output.id, label: "Conceptual input" })),
        ),
  };
}
