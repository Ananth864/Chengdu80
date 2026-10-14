import { z } from "zod";
import { canonicalCapabilityJson } from "./json";
import {
  capabilityDefinitions,
  capabilityContractSchemas,
  capabilityStatusSchema,
  getCapabilityPorts,
  contractAccepts,
  SIMULATION_WARNING,
} from "./definitions";
import type {
  CapabilityContracts,
  CapabilityDefinition,
  CapabilityPorts,
  SimulationContractValues,
  SimulationPorts,
} from "./definitions";
import { capabilityPlanSchema, validateCapabilityPlan } from "./plans";
import type { CapabilityBinding, CapabilityPlan } from "./plans";
import {
  finmatchImplementations,
  finmatchImplementationSource,
  finmatchRequestSchema,
} from "./finmatch";
import {
  finmatchCompanySizeImplementations,
  finmatchCompanySizeImplementationSource,
} from "./finmatch-size";

export const UNVERIFIED_CAPABILITY_WARNING =
  "Unverified deterministic developer-draft implementations. Demo scoring is not a validated suitability assessment; no investment recommendations.";

type PortValues<P extends SimulationPorts> = { [K in keyof P]: SimulationContractValues[P[K]] };

// Implementations live only in the trusted runtime, never in catalog descriptions.
function implementation<I extends SimulationPorts, O extends SimulationPorts>(
  inputs: I,
  outputs: O,
  invoke: (input: PortValues<I>) => PortValues<O>,
) {
  return { inputs, outputs, invoke };
}
const implementations = {
  "research.market@1.0.0": implementation(
    { query: "simulation.text@1" },
    { research: "simulation.text@1" },
    () => ({ research: "Fictional market research fixture. No sources or search." }),
  ),
  "analysis.company-history@1.0.0": implementation(
    { company: "simulation.text@1" },
    { history: "simulation.text@1" },
    () => ({ history: "Fictional company history fixture." }),
  ),
  "data.stock-price-api@1.0.0": implementation(
    { symbol: "simulation.text@1" },
    { metrics: "simulation.metrics@1" },
    () => ({ metrics: { fixtureValue: 7, unit: "arbitrary-fixture-units" } }),
  ),
  "data.company-news@1.0.0": implementation(
    { company: "simulation.text@1" },
    { news: "simulation.items@1" },
    () => ({ news: ["Fictional news fixture, not a real event."] }),
  ),
  "profile.risk-appetite@1.0.0": implementation(
    { answers: "simulation.nine-answers@1" },
    { risk: "simulation.risk@1" },
    () => ({ risk: "simulated-low" }),
  ),
  "profile.industry-preference@1.0.0": implementation(
    { preference: "simulation.industry@1" },
    { industry: "simulation.industry@1" },
    (input) => ({ industry: input.preference }),
  ),
  "selection.risk-industry@1.0.0": implementation(
    { risk: "simulation.risk@1", industry: "simulation.industry@1" },
    { selections: "simulation.items@1" },
    () => ({ selections: ["FICTIONAL-SELECTION-NOT-AN-INVESTMENT"] }),
  ),
  "extraction.annual-report-metrics@1.0.0": implementation(
    { report: "simulation.text@1" },
    { metrics: "simulation.metrics@1" },
    () => ({ metrics: { fixtureValue: 11, unit: "arbitrary-fixture-units" } }),
  ),
  "presentation.metrics-dashboard@1.0.0": implementation(
    { metrics: "simulation.metrics@1" },
    { dashboard: "simulation.dashboard@1" },
    (input) => ({
      dashboard: {
        title: "Prototype fixture dashboard",
        fixtureValue: input.metrics.fixtureValue,
        warning: SIMULATION_WARNING,
      },
    }),
  ),
  ...finmatchImplementations,
  ...finmatchCompanySizeImplementations,
};

function portSchema(ports: CapabilityPorts) {
  return z.strictObject(
    Object.fromEntries(
      Object.entries(ports).map(([name, contract]) => {
        if (!Object.hasOwn(capabilityContractSchemas, contract))
          throw new Error(`Unknown input contract ${contract}.`);
        return [
          name,
          capabilityContractSchemas[contract as keyof typeof capabilityContractSchemas],
        ];
      }),
    ),
  );
}

export interface RegistryEntry {
  readonly definition: CapabilityDefinition;
  invoke(input: unknown): Promise<Record<string, unknown>>;
}

export interface CapabilityImplementation {
  readonly inputs: CapabilityPorts;
  readonly outputs: CapabilityPorts;
  readonly invoke: (input: never) => unknown;
}

export function defineCapabilityImplementation<
  C extends CapabilityContracts,
  const I extends Readonly<Record<string, keyof C & string>>,
  const O extends Readonly<Record<string, keyof C & string>>,
>(
  contracts: C,
  inputs: I,
  outputs: O,
  invoke: (input: { [K in keyof I]: z.output<C[I[K]]> }) =>
    | { [K in keyof O]: z.input<C[O[K]]> }
    | Promise<{ [K in keyof O]: z.input<C[O[K]]> }>,
) {
  for (const contract of [...Object.values(inputs), ...Object.values(outputs)]) {
    if (!Object.hasOwn(contracts, contract))
      throw new Error(`Unknown implementation contract ${contract}.`);
  }
  return { inputs, outputs, invoke };
}

export function createCapabilityRegistry(
  definitions: readonly CapabilityDefinition[],
  contracts: CapabilityContracts,
  handlers: Readonly<Record<string, CapabilityImplementation>>,
) {
  const entries = new Map<string, RegistryEntry>();
  for (const original of definitions) {
    const definition = capabilityDefinitions.includes(original)
      ? original
      : structuredClone(original);
    const freeze = (value: object): void => {
      for (const child of Object.values(value))
        if (child && typeof child === "object") freeze(child);
      Object.freeze(value);
    };
    freeze(definition);
    capabilityStatusSchema.parse(definition.status);
    if (
      !/^[A-Za-z][A-Za-z0-9._-]{0,99}$/.test(definition.id) ||
      !definition.version ||
      definition.version.length > 40 ||
      definition.version.includes("@")
    )
      throw new Error("Registry requires explicit identity and version.");
    const key = `${definition.id}@${definition.version}`;
    if (entries.has(key)) throw new Error(`Duplicate registry entry ${key}.`);
    if (!Object.hasOwn(handlers, key)) throw new Error(`No exact implementation ${key}.`);
    const impl = handlers[key]!;
    for (const direction of ["inputs", "outputs"] as const) {
      const declared = getCapabilityPorts(definition, direction);
      if (
        !declared ||
        Object.keys(declared).length !== Object.keys(impl[direction]).length ||
        Object.entries(declared).some(([name, contract]) => impl[direction][name] !== contract)
      )
        throw new Error(`Registry contract drift: ${key}.`);
    }
    for (const [names, ports] of [
      [definition.optionalInputs ?? [], impl.inputs],
      [definition.internalOutputs ?? [], impl.outputs],
    ] as const) {
      if (new Set(names).size !== names.length || names.some((name) => !Object.hasOwn(ports, name)))
        throw new Error(`Registry port metadata drift: ${key}.`);
    }
    const schema = (ports: CapabilityPorts, optional: readonly string[] = []) =>
      z.strictObject(
        Object.fromEntries(
          Object.entries(ports).map(([name, contract]) => {
            if (!Object.hasOwn(contracts, contract))
              throw new Error(`Unknown registry contract ${contract}.`);
            if (["__proto__", "constructor", "prototype"].includes(name))
              throw new Error(`Unsafe port ${name}.`);
            const contractSchema = contracts[contract]!;
            return [name, optional.includes(name) ? contractSchema.optional() : contractSchema];
          }),
        ),
      );
    const declaredInputSchema = schema(impl.inputs, definition.optionalInputs);
    const inputSchema =
      definition.inputValidation === "handler" ? finmatchRequestSchema : declaredInputSchema;
    const outputSchema = schema(impl.outputs);
    const invoke = impl.invoke;
    entries.set(
      key,
      Object.freeze({
        definition,
        async invoke(input: unknown) {
          if (definition.status === "deprecated" || definition.status === "unavailable")
            throw new Error(`Capability ${key} is ${definition.status}.`);
          const parsed = structuredClone(inputSchema.parse(input));
          return outputSchema.parse(await invoke(parsed as never));
        },
      }),
    );
  }
  for (const key of Object.keys(handlers))
    if (!entries.has(key)) throw new Error(`Handler has no definition ${key}.`);
  return Object.freeze({
    resolve(id: string, version: string): RegistryEntry {
      const entry = entries.get(`${id}@${version}`);
      if (!entry) throw new Error(`No exact registry entry ${id}@${version}.`);
      return entry;
    },
  });
}

export const capabilityRegistry = createCapabilityRegistry(
  capabilityDefinitions,
  capabilityContractSchemas,
  implementations,
);

export function capabilityImplementationSources(id: string, version: string): string {
  capabilityRegistry.resolve(id, version);
  return JSON.stringify({
    handler: implementations[`${id}@${version}` as keyof typeof implementations].invoke.toString(),
    finmatch: finmatchImplementationSource,
    finmatchCompanySize: finmatchCompanySizeImplementationSource,
    definitions: capabilityDefinitions,
    contractAccepts,
    ports: getCapabilityPorts.toString(),
    publicResult: publicCapabilityResult.toString(),
    warnings: { simulation: SIMULATION_WARNING, unverified: UNVERIFIED_CAPABILITY_WARNING },
    runner: runCapabilityPlan.toString(),
    registry: createCapabilityRegistry.toString(),
    portValidation: portSchema.toString(),
    planValidation: validateCapabilityPlan.toString(),
    schemas: Object.fromEntries(
      Object.entries(capabilityContractSchemas).map(([name, schema]) => [
        name,
        z.toJSONSchema(schema),
      ]),
    ),
  });
}

export interface CapabilityRunResult {
  results: Record<string, unknown>;
  outputs: Record<string, unknown>;
  provenance: { simulated: boolean; unverified: boolean; warning: string };
}

export async function runCapabilityPlan(
  plan: CapabilityPlan,
  inputs: Record<string, unknown>,
): Promise<CapabilityRunResult> {
  // Parse a fresh snapshot before the first await to avoid caller mutation during execution.
  const parsed = structuredClone(capabilityPlanSchema.parse(plan));
  const validation = validateCapabilityPlan(parsed);
  if (!validation.executable)
    throw new Error(
      `Plan is not executable: ${validation.issues.map((i) => i.message).join("; ")}`,
    );
  const declarations: Record<string, string> = Object.create(null);
  for (const binding of [
    ...parsed.steps.flatMap((step) => Object.values(step.inputs)),
    ...Object.values(parsed.outputs),
  ]) {
    if (binding.kind === "input") declarations[binding.name] = binding.contract;
  }
  const appInputs = structuredClone(portSchema(declarations).parse(inputs));
  const results: Record<string, Record<string, unknown>> = Object.create(null);
  const resolve = (binding: CapabilityBinding): unknown =>
    binding.kind === "literal"
      ? binding.value
      : binding.kind === "input"
        ? appInputs[binding.name]
        : results[binding.stepId]![binding.output];
  for (const id of validation.order) {
    const step = parsed.steps.find((s) => s.id === id)!;
    const bound: Record<string, unknown> = Object.create(null);
    for (const [name, binding] of Object.entries(step.inputs)) {
      bound[name] = resolve(binding);
    }
    results[id] = await capabilityRegistry.resolve(step.capabilityId, step.version).invoke(bound);
  }
  const outputs: Record<string, unknown> = Object.create(null);
  for (const [name, binding] of Object.entries(parsed.outputs)) outputs[name] = resolve(binding);
  const statuses = parsed.steps.map(
    (step) => capabilityRegistry.resolve(step.capabilityId, step.version).definition.status,
  );
  const simulated = statuses.includes("mock");
  const unverified = statuses.some((status) => status !== "verified");
  return {
    results,
    outputs,
    provenance: {
      simulated,
      unverified,
      warning: simulated ? SIMULATION_WARNING : unverified ? UNVERIFIED_CAPABILITY_WARNING : "",
    },
  };
}

// Trusted composition keeps complete risk data; browser responses must use this projection.
export function publicCapabilityResult(
  plan: CapabilityPlan,
  result: CapabilityRunResult,
): CapabilityRunResult {
  const parsed = capabilityPlanSchema.parse(plan);
  const internal = new Map(
    parsed.steps.map((step) => [
      step.id,
      capabilityRegistry.resolve(step.capabilityId, step.version).definition.internalOutputs ?? [],
    ]),
  );
  const redact = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(redact);
    if (value !== null && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !["total_score", "risk_profile_bucket", "answers"].includes(key))
          .map(([key, child]) => [key, redact(child)]),
      );
    return value;
  };
  return {
    results: Object.fromEntries(
      Object.entries(result.results).map(([stepId, value]) => [
        stepId,
        redact(
          Object.fromEntries(
            Object.entries(value as Record<string, unknown>).filter(
              ([name]) => !internal.get(stepId)?.includes(name),
            ),
          ),
        ),
      ]),
    ),
    outputs: Object.fromEntries(
      Object.entries(result.outputs)
        .filter(([name]) => {
          const binding = parsed.outputs[name];
          return !(
            binding?.kind === "step" && internal.get(binding.stepId)?.includes(binding.output)
          );
        })
        .map(([name, value]) => [name, redact(value)]),
    ),
    provenance: { ...result.provenance },
  };
}

export function generateCapabilityTypeScript(plan: CapabilityPlan): string {
  const parsed = capabilityPlanSchema.parse(plan);
  const validation = validateCapabilityPlan(parsed);
  if (!validation.executable) throw new Error("Cannot generate a non-executable plan.");
  const finmatch =
    parsed.steps.some(
      (step) =>
        Object.hasOwn(finmatchImplementations, `${step.capabilityId}@${step.version}`) ||
        Object.hasOwn(finmatchCompanySizeImplementations, `${step.capabilityId}@${step.version}`),
    ) ||
    Object.values(parsed.outputs).some(
      (binding) => binding.kind === "input" && binding.contract.startsWith("finmatch."),
    );
  const contractValues = finmatch ? "CapabilityContractValues" : "SimulationContractValues";
  const contracts = new Map<string, string>();
  for (const binding of [
    ...parsed.steps.flatMap((step) => Object.values(step.inputs)),
    ...Object.values(parsed.outputs),
  ]) {
    if (binding.kind === "input") contracts.set(binding.name, binding.contract);
  }
  const inputType = contracts.size
    ? `{\n${[...contracts]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(
          ([name, contract]) =>
            `  ${JSON.stringify(name)}: ${contractValues}[${JSON.stringify(contract)}];`,
        )
        .join("\n")}\n}`
    : "Record<string, never>";
  // Delegate binding and invocation to the same pinned, schema-checked registry runner.
  return `// ${finmatch ? `Generated developer draft. ${UNVERIFIED_CAPABILITY_WARNING}` : `Generated prototype simulation. ${SIMULATION_WARNING}`}\nimport { runCapabilityPlan } from "@web-starter/capabilities/runtime";\nimport type { CapabilityPlan${contracts.size ? `, ${contractValues}` : ""} } from "@web-starter/capabilities";\n\nconst plan: CapabilityPlan = ${canonicalCapabilityJson(parsed, 2)};\n\nexport async function runGenerated(inputs: ${inputType}) {\n  return runCapabilityPlan(plan, inputs);\n}\n`;
}

// Fail immediately if a catalog entry is shipped without its exact implementation.
for (const definition of capabilityDefinitions)
  capabilityRegistry.resolve(definition.id, definition.version);
