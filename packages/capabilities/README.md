# Capability Library

All nine catalog entries are mock implementations at exact version `1.0.0`.
Product inputs, outputs, dependencies, behavior, data coverage, asset coverage,
and markets are unknown. `simulation` contains separately labeled prototype-only
contracts, not verified financial contracts. No network, inference, scoring,
search, financial calculations, or real financial data is used.

## Browser Entry

`@web-starter/capabilities` exports:

- `capabilityDefinitions`, `resolveCapabilityDefinition`, `SIMULATION_WARNING`
- `capabilityStatusSchema`: mock, unverified, verified, deprecated, unavailable
- `capabilityPlanSchema`, `capabilityBindingSchema`, `jsonLiteralSchema`
- `validateCapabilityPlan(plan, expectedRequirements?, options?)`
- `exportCapabilityMarkdown(plan, prose?)`, `parseCapabilityMarkdown(text)`
- `b2cPerformancePlan`
- `canonicalCapabilityJson(value, space?)`: bounded safe JSON serialization with
  recursively sorted object keys, preserved array order and string contents,
  and optional JSON-style indentation. It does not mutate input or invoke accessors.
- Types `CapabilityDefinition`, `CapabilityStatus`, `SimulationContractId`,
  `SimulationContractValues`, `SimulationPorts`, `CapabilityPlan`,
  `CapabilityBinding`, `JsonValue`, `PlanIssue`, `PlanValidation`,
  `PlanValidationOptions`, `CapabilityPorts`, `CapabilityContracts`

The browser entry does not import the runtime or Node APIs.

## Plan Shape

```ts
type Plan = {
  schemaVersion: 1;
  requirements: { id: string; text: string; assetTypes: string[]; markets: string[] }[];
  steps: { id: string; capabilityId: string; version: string; inputs: Record<string, Binding> }[];
  coverage: {
    requirementId: string;
    status: "supported" | "partial" | "unsupported";
    stepIds: string[];
    reason: string;
  }[];
  outputs: Record<string, Binding>;
  gaps: string[];
  questions: string[];
  assumptions: string[];
};
type Binding =
  | { kind: "literal"; value: JsonValue }
  | { kind: "input"; name: string; contract: string }
  | { kind: "step"; stepId: string; output: string };
```

Input bindings declare external inputs. Repeated names must use the same known
contract. Bindings infer dependencies and topological execution order; there is
no separate input list, explicit dependency field, or mode. Valid plans run only
as scoped prototype simulations. Partial coverage and gaps are allowed, but
unknown catalog entries cannot justify `supported` claims. Every current plan
using the default catalog has `productionReady: false`. Empty step/output lists
are valid for plans whose requirements are all unsupported; no capabilities
need to be forced into the plan. Prototype selection requires actual step
bindings to both risk-appetite and industry-preference outputs.

Custom validation options accept `definitions`, `contracts`, `verifyEvidence`,
and `supportsRequirement`. A verified status or evidence flag alone is not
proof. Production readiness requires nonempty evidence references accepted by
the independent evidence check, complete known product metadata with no unknowns,
matching asset and market scope, independently confirmed full requirement
coverage, and no gaps, questions, or assumptions. Known scope mismatches report
`UNSUPPORTED_ASSET`/`UNSUPPORTED_MARKET`, separately from `UNKNOWN_SCOPE`.
These checks assess the supplied catalog, not whether a handler has been
installed; execution still resolves implementations through a registry.
Every partial coverage row emits `PARTIAL_MATCH_UNVERIFIED`: its model-authored
rationale is not deterministic semantic proof. This qualification does not block
simulation; consumers can display it alongside the coverage reason.

Markdown parsing returns `{ plan, prose }`. Exactly one complete three-backtick
`cd80-capabilities-v1` JSON fence is required. Surrounding prose is preserved
byte-for-byte, including separator whitespace and line endings. Export appends
two newlines to nonempty prose before the block. Documents are bounded to
1,000,000 characters; literals have depth, node, and character limits.

## Runtime Entry

`@web-starter/capabilities/runtime` exports `capabilityRegistry`,
`runCapabilityPlan`, `generateCapabilityTypeScript`, `capabilityImplementationSources`,
`createCapabilityRegistry`, `defineCapabilityImplementation`, and types
`RegistryEntry`, `CapabilityRunResult`, `CapabilityImplementation`.
Registry resolution requires an exact ID and version; there is no dynamic
registration or version fallback. Catalog and registry entries are frozen.
The default implementation source export remains available for existing consumers.

`defineCapabilityImplementation(contracts, inputPorts, outputPorts, handler)`
types handler input/output values from Zod schemas. The factory
`createCapabilityRegistry(definitions, contracts, handlers)` accepts these
implementations keyed by `id@version`. It checks contract agreement, snapshots
definitions and handlers, and validates input and output independently at every
invocation. Deprecated/unavailable entries cannot execute; unverified entries
may execute but cannot justify production readiness. Non-mock implementations
use product ports, not prototype ports. Creating a registry does not certify its
evidence. The existing runner and generator continue to use the default mock
registry; custom registry entries are invoked explicitly via `resolve().invoke()`.

`runCapabilityPlan(plan, inputs)` validates exact input and output schemas and
returns `{ results, outputs, provenance }`. Provenance always includes
`simulated: true`, `unverified: true`, and an explicit fixture warning.
TypeScript generation produces a deterministic, contract-typed function that
delegates to this runner; it never regenerates financial logic.
Embedded plan JSON is canonicalized, so persisted object key order does not
change generated source. Array order and literal values remain unchanged.

## Verification

```sh
bun test packages/capabilities/test
bun run --cwd packages/capabilities typecheck
```

Tests compile and execute generated TypeScript in memory using the TypeScript
API. They validate mock contracts, composition, scope claims, execution,
mutation isolation, and bounded markdown parsing. They do not establish live
data coverage or verified financial behavior.
