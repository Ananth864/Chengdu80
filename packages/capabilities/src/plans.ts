import { z } from "zod";
import { capabilityDefinitions, simulationContractSchemas } from "./definitions";
import type { CapabilityContracts, CapabilityDefinition } from "./definitions";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
const unsafeKeys = new Set(["__proto__", "prototype", "constructor"]);
const identifier = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z][A-Za-z0-9._-]*$/)
  .refine((value) => !unsafeKeys.has(value));
const text = z.string().min(1).max(4000);

// Bound depth, nodes, and characters without recursively following untrusted literals.
export const jsonLiteralSchema = z
  .unknown()
  .refine((value) => {
    const queue: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
    let nodes = 0;
    let characters = 0;
    while (queue.length) {
      const item = queue.pop()!;
      if (++nodes > 2048 || item.depth > 12) return false;
      const current = item.value;
      if (current === null || typeof current === "boolean") continue;
      if (typeof current === "number") {
        if (!Number.isFinite(current)) return false;
        continue;
      }
      if (typeof current === "string") {
        characters += current.length;
        if (characters > 32768) return false;
        continue;
      }
      if (typeof current !== "object") return false;
      if (
        !Array.isArray(current) &&
        Object.getPrototypeOf(current) !== Object.prototype &&
        Object.getPrototypeOf(current) !== null
      )
        return false;
      const keys = Reflect.ownKeys(current).filter(
        (key) => !(Array.isArray(current) && key === "length"),
      );
      if (keys.length > 128 || (Array.isArray(current) && keys.length !== current.length))
        return false;
      for (const key of keys) {
        if (typeof key !== "string" || unsafeKeys.has(key)) return false;
        if (
          Array.isArray(current) &&
          (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= current.length)
        )
          return false;
        const descriptor = Object.getOwnPropertyDescriptor(current, key)!;
        if (!descriptor.enumerable || !("value" in descriptor)) return false;
        characters += key.length;
        if (characters > 32768) return false;
        queue.push({ value: descriptor.value, depth: item.depth + 1 });
      }
    }
    return true;
  }, "Expected bounded, safe JSON literal")
  .pipe(z.json());

export const capabilityBindingSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("literal"), value: jsonLiteralSchema }),
  z.strictObject({
    kind: z.literal("input"),
    name: identifier,
    contract: z.string().min(1).max(100),
  }),
  z.strictObject({ kind: z.literal("step"), stepId: identifier, output: identifier }),
]);
export type CapabilityBinding = z.infer<typeof capabilityBindingSchema>;
const bindings = z
  .record(identifier, capabilityBindingSchema)
  .refine((value) => Object.keys(value).length <= 64);

export const capabilityPlanSchema = z.strictObject({
  schemaVersion: z.literal(1),
  requirements: z
    .array(
      z.strictObject({
        id: identifier,
        text,
        assetTypes: z.array(text).max(20),
        markets: z.array(text).max(20),
      }),
    )
    .min(1)
    .max(100),
  steps: z
    .array(
      z.strictObject({
        id: identifier,
        capabilityId: identifier,
        version: z.string().min(1).max(40),
        inputs: bindings,
      }),
    )
    .max(128),
  coverage: z
    .array(
      z.strictObject({
        requirementId: identifier,
        status: z.enum(["supported", "partial", "unsupported"]),
        stepIds: z.array(identifier).max(128),
        reason: text,
      }),
    )
    .max(100),
  outputs: bindings,
  gaps: z.array(text).max(100),
  questions: z.array(text).max(100),
  assumptions: z.array(text).max(100),
});

export type CapabilityPlan = z.infer<typeof capabilityPlanSchema>;
export interface PlanIssue {
  code: string;
  message: string;
  stepId?: string;
}
export interface PlanValidation {
  valid: boolean;
  executable: boolean;
  productionReady: boolean;
  issues: PlanIssue[];
  order: string[];
}

export interface PlanValidationOptions {
  readonly definitions?: readonly CapabilityDefinition[];
  readonly contracts?: CapabilityContracts;
  // Trusted integration checks must inspect evidence and actual requirement coverage,
  // rather than simply echoing the catalog's self-declared verified status.
  readonly verifyEvidence?: (definition: CapabilityDefinition) => boolean;
  readonly supportsRequirement?: (
    definition: CapabilityDefinition,
    requirement: CapabilityPlan["requirements"][number],
  ) => boolean;
}

export function validateCapabilityPlan(
  plan: unknown,
  expectedRequirements?: { id: string; text: string }[],
  options: PlanValidationOptions = {},
): PlanValidation {
  const parsed = capabilityPlanSchema.safeParse(plan);
  if (!parsed.success)
    return {
      valid: false,
      executable: false,
      productionReady: false,
      order: [],
      issues: parsed.error.issues.map((issue) => ({
        code: "SCHEMA",
        message: `${issue.path.join(".")}: ${issue.message}`,
      })),
    };
  const p = parsed.data;
  const issues: PlanIssue[] = [];
  let valid = true;
  let productionReady = p.steps.length > 0;
  const error = (code: string, message: string, stepId?: string) => {
    valid = false;
    issues.push({ code, message, ...(stepId ? { stepId } : {}) });
  };
  const gap = (code: string, message: string, stepId?: string) => {
    productionReady = false;
    issues.push({ code, message, ...(stepId ? { stepId } : {}) });
  };
  const unique = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) error("DUPLICATE_ID", `Duplicate ${label} IDs.`);
  };
  unique(
    p.steps.map((s) => s.id),
    "step",
  );
  unique(
    p.requirements.map((r) => r.id),
    "requirement",
  );
  unique(
    p.coverage.map((r) => r.requirementId),
    "coverage",
  );
  const catalog = options.definitions ?? capabilityDefinitions;
  const contracts: CapabilityContracts = options.contracts ?? simulationContractSchemas;
  unique(
    catalog.map((d) => `${d.id}@${d.version}`),
    "catalog identity",
  );
  const verified = (d: CapabilityDefinition) =>
    d.status === "verified" &&
    d.evidence.verified &&
    d.evidence.references.length > 0 &&
    d.evidence.references.every((reference) => reference.trim().length > 0) &&
    options.verifyEvidence?.(d) === true &&
    d.inputs !== null &&
    d.outputs !== null &&
    !!d.behavior &&
    d.behavior !== "UNKNOWN" &&
    !!d.coverage &&
    d.coverage !== "UNKNOWN" &&
    d.supportedAssetTypes !== null &&
    d.markets !== null &&
    d.dependencies !== null &&
    d.unknowns.length === 0;
  const ports = (d: CapabilityDefinition, direction: "inputs" | "outputs") =>
    d.status === "mock" ? d.simulation[direction] : d[direction];
  if (expectedRequirements) {
    unique(
      expectedRequirements.map((r) => r.id),
      "expected requirement",
    );
    if (
      expectedRequirements.length !== p.requirements.length ||
      expectedRequirements.some(
        (r) => !p.requirements.some((actual) => actual.id === r.id && actual.text === r.text),
      )
    ) {
      error(
        "REQUIREMENTS_MISMATCH",
        "Plan must preserve all expected requirement IDs and text exactly.",
      );
    }
  }
  const steps = new Map(p.steps.map((s) => [s.id, s]));
  const definitions = new Map(
    p.steps.map((s) => [
      s.id,
      catalog.find((d) => d.id === s.capabilityId && d.version === s.version),
    ]),
  );
  const inputContracts = new Map<string, string>();
  const edges = new Map(p.steps.map((s) => [s.id, new Set<string>()]));
  const bindingContract = (binding: CapabilityBinding, consumer?: string): string | undefined => {
    if (binding.kind === "literal") return;
    if (binding.kind === "input") {
      if (!Object.hasOwn(contracts, binding.contract)) {
        error("UNKNOWN_CONTRACT", `Unknown input contract ${binding.contract}.`, consumer);
        return;
      }
      const prior = inputContracts.get(binding.name);
      if (prior && prior !== binding.contract)
        error(
          "INPUT_CONTRACT_CONFLICT",
          `Input ${binding.name} has conflicting contracts.`,
          consumer,
        );
      inputContracts.set(binding.name, binding.contract);
      return binding.contract;
    }
    if (!steps.has(binding.stepId)) {
      error("UNKNOWN_STEP", `Unknown source step ${binding.stepId}.`, consumer);
      return;
    }
    const source = definitions.get(binding.stepId);
    if (!source) return;
    const port = ports(source, "outputs")?.[binding.output];
    if (!port)
      error("UNKNOWN_OUTPUT", `Step ${binding.stepId} has no output ${binding.output}.`, consumer);
    return port;
  };
  for (const step of p.steps) {
    const def = definitions.get(step.id);
    if (!def) {
      error(
        "UNKNOWN_CAPABILITY",
        `No exact capability ${step.capabilityId}@${step.version}.`,
        step.id,
      );
      continue;
    }
    if (!["mock", "unverified", "verified"].includes(def.status))
      error("NOT_AVAILABLE", `Capability status ${def.status} cannot execute.`, step.id);
    if (!verified(def))
      gap(
        "UNVERIFIED",
        "No independently verified complete product contract and evidence.",
        step.id,
      );
    const inputPorts = ports(def, "inputs");
    const outputPorts = ports(def, "outputs");
    if (!inputPorts || !outputPorts) {
      error("UNKNOWN_CONTRACT", "Execution requires known input and output ports.", step.id);
      continue;
    }
    for (const contract of [...Object.values(inputPorts), ...Object.values(outputPorts)]) {
      if (!Object.hasOwn(contracts, contract))
        error("UNKNOWN_CONTRACT", `Unknown port contract ${contract}.`, step.id);
    }
    for (const dependency of (def.status === "mock"
      ? def.simulation.dependencies
      : def.dependencies) ?? []) {
      const boundIds = new Set(
        Object.values(step.inputs).flatMap((b) => (b.kind === "step" ? [b.stepId] : [])),
      );
      const candidates = p.steps.filter(
        (s) =>
          `${s.capabilityId}@${s.version}` === dependency && boundIds.has(s.id) && s.id !== step.id,
      );
      if (candidates.length !== 1)
        error(
          "UNRESOLVED_DEPENDENCY",
          `Dependency ${dependency} must resolve through a binding to exactly one step.`,
          step.id,
        );
      else edges.get(step.id)!.add(candidates[0]!.id);
    }
    for (const name of Object.keys(inputPorts)) {
      if (!Object.hasOwn(step.inputs, name))
        error("MISSING_BINDING", `Missing input ${name}.`, step.id);
    }
    for (const [name, binding] of Object.entries(step.inputs)) {
      if (binding.kind === "step") edges.get(step.id)!.add(binding.stepId);
      const source = bindingContract(binding, step.id);
      const target = inputPorts[name];
      if (!target) {
        error("UNKNOWN_INPUT_PORT", `Unknown input port ${name}.`, step.id);
        continue;
      }
      if (binding.kind === "literal") {
        if (
          Object.hasOwn(contracts, target) &&
          !contracts[target]!.safeParse(binding.value).success
        )
          error("INVALID_LITERAL", `Literal does not satisfy ${target} for ${name}.`, step.id);
      } else if (source && source !== target) {
        error("CONTRACT_MISMATCH", `${source} cannot compose with ${target} for ${name}.`, step.id);
      }
    }
  }
  for (const binding of Object.values(p.outputs)) bindingContract(binding);
  const order: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id) || !steps.has(id)) return;
    if (visiting.has(id)) {
      error("CYCLE", `Dependency cycle at ${id}.`, id);
      return;
    }
    visiting.add(id);
    for (const dep of edges.get(id)!) visit(dep);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  };
  for (const step of p.steps) visit(step.id);
  for (const row of p.coverage) {
    const requirement = p.requirements.find((r) => r.id === row.requirementId);
    if (!p.requirements.some((r) => r.id === row.requirementId))
      error("UNKNOWN_REQUIREMENT", `Unknown coverage requirement ${row.requirementId}.`);
    unique(row.stepIds, `coverage step for ${row.requirementId}`);
    for (const id of row.stepIds)
      if (!steps.has(id)) error("UNKNOWN_COVERAGE_STEP", `Unknown coverage step ${id}.`);
    if (row.status !== "unsupported" && !row.stepIds.length)
      error("EMPTY_COVERAGE", "Supported or partial coverage must reference steps.");
    if (row.status === "unsupported" && row.stepIds.length)
      error("UNSUPPORTED_STEPS", "Unsupported coverage must not claim implementing steps.");
    let supported = row.stepIds.length > 0;
    for (const id of row.stepIds) {
      const def = definitions.get(id);
      if (!def || !requirement) {
        supported = false;
        continue;
      }
      for (const [requested, available, code] of [
        [requirement.assetTypes, def.supportedAssetTypes, "UNSUPPORTED_ASSET"],
        [requirement.markets, def.markets, "UNSUPPORTED_MARKET"],
      ] as const) {
        if (available === null) {
          supported = false;
          gap(
            "UNKNOWN_SCOPE",
            `${row.requirementId}: ${code === "UNSUPPORTED_ASSET" ? "asset" : "market"} coverage is UNKNOWN.`,
            id,
          );
        } else
          for (const value of requested)
            if (!available.includes(value)) {
              supported = false;
              gap(code, `${row.requirementId}: ${value} is outside known coverage.`, id);
            }
      }
      if (!verified(def) || options.supportsRequirement?.(def, requirement) !== true)
        supported = false;
    }
    if (row.status === "supported" && !supported)
      error(
        "UNJUSTIFIED_SUPPORT",
        "Full support requires independently verified contracts, evidence, scope, and requirement coverage.",
      );
    if (row.status !== "supported") gap("COVERAGE_GAP", `${row.requirementId}: ${row.reason}`);
    if (row.status === "partial")
      gap(
        "PARTIAL_MATCH_UNVERIFIED",
        `${row.requirementId}: Partial matching is a model-authored, unverified rationale, not deterministic semantic proof of requirement coverage. Product coverage remains UNKNOWN unless independently verified. Rationale: ${row.reason}`,
      );
  }
  for (const requirement of p.requirements) {
    if (!p.coverage.some((r) => r.requirementId === requirement.id))
      error("MISSING_COVERAGE", `Missing coverage row for ${requirement.id}.`);
  }
  if (p.gaps.length || p.questions.length || p.assumptions.length)
    gap("OPEN_QUESTIONS", "Plan retains gaps, questions, or unverified assumptions.");
  return {
    valid,
    executable: valid,
    productionReady: valid && productionReady,
    issues,
    order: valid ? order : [],
  };
}
