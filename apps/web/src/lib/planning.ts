import { z } from "zod";
import { capabilityContracts, type AppBundle, type ProductSpec } from "./contracts";
import {
  capabilityPlanSchema,
  validateCapabilityPlan,
  resolveCapabilityDefinition,
  type CapabilityPlan,
} from "@web-starter/capabilities";

export const requirementsSchema = z
  .object({
    dataSource: z.enum(["user", "fixtures", "tushare", "plugins"]),
    analysisPeriod: z.string().trim().max(300),
    assumptions: z.array(z.string().trim().min(1).max(500)).max(12),
    missingInputs: z.array(z.string().trim().min(1).max(300)).max(12),
    questions: z
      .array(
        z.object({
          id: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
          question: z.string().trim().min(1).max(300),
          answer: z.string().trim().max(1000),
        }),
      )
      .max(12),
    pluginOperations: z
      .array(z.object({ pluginId: z.string().min(1), operationId: z.string().min(1) }))
      .max(20),
    capabilityPlan: capabilityPlanSchema.optional(),
  })
  .strict()
  .refine(
    (value) => new Set(value.questions.map((q) => q.id)).size === value.questions.length,
    "Question IDs must be unique",
  );
export type Requirements = z.infer<typeof requirementsSchema>;
export function initialRequirements(): Requirements {
  return {
    dataSource: "user",
    analysisPeriod: "",
    assumptions: [],
    missingInputs: [],
    questions: [],
    pluginOperations: [],
  };
}
export function designKey(spec: ProductSpec, requirements: Requirements) {
  return JSON.stringify({ spec, requirements });
}
export type FeasibilityCheck = {
  area: string;
  status: "supported" | "conditional" | "unavailable";
  reason: string;
  alternative?: string;
};
export type FeasibilityReport = {
  outcome: "pass" | "revise" | "reject";
  checkedAt: string;
  checks: FeasibilityCheck[];
  limitations: string;
};
export type WorkflowGraph = {
  basis: "planned" | "manifest" | "capability-plan" | "diagnostic";
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
export function workflowGraph(
  spec: ProductSpec,
  requirements: Requirements,
  bundle?: AppBundle,
): WorkflowGraph {
  if (requirements.capabilityPlan)
    return capabilityWorkflow(
      requirements.capabilityPlan,
      capabilityRequirements(spec, requirements),
    );
  const nodes: WorkflowGraph["nodes"] = [
    {
      id: "data",
      kind: "data",
      label: `${requirements.dataSource} inputs`,
      detail:
        requirements.assumptions.join("; ") ||
        "Review dataset coverage and assumptions before use.",
      inputs: spec.inputs.join("; "),
      outputs: "Application inputs",
    },
  ];
  const permissions = bundle?.manifest.permissions ?? ["storage.read", "finance.calculate"];
  for (const capability of permissions) {
    const contract = capabilityContracts[capability as keyof typeof capabilityContracts];
    nodes.push({
      id: capability,
      kind: "capability",
      label: capability,
      detail: bundle
        ? "Declared permission; use and execution order are not proven."
        : "Suggested capability; not yet a deployed permission.",
      inputs: contract.input,
      outputs: contract.output,
    });
  }
  for (const operation of requirements.pluginOperations) {
    nodes.push({
      id: `plugin:${operation.pluginId}:${operation.operationId}`,
      kind: "capability",
      label: operation.operationId,
      detail: `Planned registered plugin ${operation.pluginId}`,
      inputs: "Registered operation parameters",
      outputs: "Provider response (not credibility-verified)",
    });
  }
  nodes.push({
    id: "output",
    kind: "output",
    label: spec.name,
    detail: spec.purpose,
    inputs: "Application results",
    outputs: spec.outputs.join("; "),
  });
  const middle = nodes.filter((node) => node.kind === "capability");
  return {
    basis: bundle ? "manifest" : "planned",
    nodes,
    edges: middle.length
      ? middle.flatMap((node) => [
          { from: "data", to: node.id, label: "Conceptual input" },
          { from: node.id, to: "output", label: "Conceptual contribution" },
        ])
      : [{ from: "data", to: "output", label: "Conceptual input" }],
  };
}

export function capabilityRequirements(spec: ProductSpec, requirements: Requirements) {
  return [
    { id: "purpose", text: spec.purpose },
    { id: "data-source", text: `Selected data source: ${requirements.dataSource}` },
    { id: "analysis-period", text: `Analysis period: ${requirements.analysisPeriod || "UNKNOWN"}` },
    {
      id: "plugin-operations",
      text: `Selected registered operations: ${JSON.stringify(requirements.pluginOperations)}`,
    },
    ...spec.inputs.map((text, index) => ({ id: `input-${index + 1}`, text })),
    ...spec.outputs.map((text, index) => ({ id: `output-${index + 1}`, text })),
    ...spec.constraints.map((text, index) => ({ id: `constraint-${index + 1}`, text })),
    ...requirements.questions.map((question) => ({
      id: `answer-${question.id}`,
      text: `${question.question}: ${question.answer || "UNKNOWN"}`,
    })),
    ...requirements.missingInputs.map((text, index) => ({ id: `missing-${index + 1}`, text })),
    ...requirements.assumptions.map((text, index) => ({ id: `assumption-${index + 1}`, text })),
  ];
}

export function capabilityWorkflow(
  plan: CapabilityPlan,
  expectedRequirements?: { id: string; text: string }[],
): WorkflowGraph {
  const validation = validateCapabilityPlan(plan, expectedRequirements);
  if (!validation.executable)
    return {
      basis: "diagnostic",
      nodes: validation.issues.map((issue, index) => ({
        id: `issue-${index}`,
        kind: "output",
        label: issue.code,
        detail: issue.message,
        inputs: "UNKNOWN",
        outputs: "Not executable",
      })),
      edges: [],
    };
  const nodes: WorkflowGraph["nodes"] = [];
  const edges: WorkflowGraph["edges"] = [];
  const addBinding = (binding: CapabilityPlan["outputs"][string], to: string, port: string) => {
    if (binding.kind === "step")
      edges.push({ from: binding.stepId, to, label: `${binding.output} -> ${port}` });
    else {
      const id = binding.kind === "input" ? `input:${binding.name}` : `literal:${to}:${port}`;
      if (!nodes.some((node) => node.id === id))
        nodes.push({
          id,
          kind: "data",
          label: binding.kind === "input" ? binding.name : `Literal: ${port}`,
          detail:
            binding.kind === "input"
              ? "User-supplied prototype input"
              : JSON.stringify(binding.value),
          inputs: "Application input",
          outputs: binding.kind === "input" ? binding.contract : "Validated literal",
        });
      edges.push({ from: id, to, label: port });
    }
  };
  for (const id of validation.order) {
    const step = plan.steps.find((entry) => entry.id === id)!;
    const definition = resolveCapabilityDefinition(step.capabilityId, step.version)!;
    nodes.push({
      id,
      kind: "capability",
      label: `${definition.name} @ ${step.version} (${definition.status})`,
      detail: `${definition.purpose} ${definition.simulation.behavior} ${definition.unknowns.join(" ")}`,
      inputs: JSON.stringify(definition.simulation.inputs),
      outputs: JSON.stringify(definition.simulation.outputs),
    });
    for (const [port, binding] of Object.entries(step.inputs)) addBinding(binding, id, port);
  }
  for (const [name, binding] of Object.entries(plan.outputs)) {
    const id = `output:${name}`;
    nodes.push({
      id,
      kind: "output",
      label: name,
      detail: "Prototype-only result; not verified financial output",
      inputs: name,
      outputs: name,
    });
    addBinding(binding, id, name);
  }
  return { basis: "capability-plan", nodes, edges };
}
