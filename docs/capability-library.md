# Internal Capability Library

## Existing Architecture

Chengdu80 uses TanStack Start, Bun, Convex or explicit local file persistence,
and a constrained browser-source workspace. The existing builder produces four
JavaScript/HTML/CSS files, verifies numerical protocol fixtures in workerd, and
activates passing legacy releases automatically. Requirements are Zod-validated
JSON; the earlier workflow graph represents conceptual manifest permissions.
There was no Markdown application-spec parser or per-application Docker build.

## Integrated Architecture

`packages/capabilities` separates immutable, exact-version definitions from
typed executable handlers. Both inputs and outputs are schema validated.
Product contracts and coverage remain UNKNOWN where the supplied concept does
not specify them. Separate prototype-only contracts make mocks composable
without treating their arbitrary fixture behavior as financial methodology.

Plans preserve recorded requirement IDs and text, pins, explicit bindings,
outputs, partial/unsupported coverage, assumptions, questions, and gaps. The
validator rejects fabricated identities, invalid ports/literals, incompatible
contract identities, missing bound dependencies, cycles, and missing coverage.
UNKNOWN contracts cannot justify supported claims. Partial rationale remains
model-authored and unverified, not proven semantic coverage.

The existing model adapters receive the full small catalog and return structured
plans. `plan_capabilities` and `simulate_capabilities` integrate with the agent;
Requirements also offers explicit planning, Markdown import/export, and preview
actions. No capability-library navigation area is added. Actual flow bindings
drive the existing Workflow inspector. Stale requirements produce diagnostics.

Markdown uses exactly one `cd80-capabilities-v1` JSON fence. Surrounding prose is
preserved by the parser; structured specifications remain authoritative.

The platform generates TypeScript delegation to the pinned registry, not
financial logic. Each simulation release strictly compiles and executes its
exact deterministic wrapper using schema-derived declarations and a single
controlled runtime import. Untrusted model/source strings are never passed to
the compiler's execution function. Package tests additionally compile generated
source against the real package types. Browser previews use the same registry
runner through a restricted `capability.flow` RPC.

## Pinning And Deployment

Initial execution is bundled with the platform, behind its existing owner-checked
RPC. This fits the current shared Node/Docker deployment and avoids another
backend/service. Credential-bearing adapters must stay server-side. Generated
TypeScript also imports the reusable package and can be bundled into a future
application image by a controlled assembler.

Artifacts bind the source, specification, recorded requirements, canonical plan,
generated TypeScript, handler source, schema/runner policy, and exact versions.
Persistence key reordering does not change identity. There is no latest-version
fallback. Changing an implementation invalidates affected artifacts rather than
silently executing changed logic. Keep historical version entries and handler
code immutable to retain execution of old releases; publish replacements under
new versions.

A separate internal capability service is not required for mocks or pure
TypeScript. It may become appropriate for native/Python workloads, heavy
computations, or independently operated data connectors. It introduces network
failure, authentication, quotas, version routing, and operational costs. Do not
weaken public plugin SSRF controls to reach such a service.

Applications are still platform-managed releases, not separate Docker images.
Standalone image assembly, secret injection, storage migration, and orchestration
remain future work. No Docker deployment was performed for this change.

## Simulation And Production Gates

All nine initial entries are mock. Risk classification is a fixed
`simulated-low` label, not scoring of the nine answers. Market metrics are
arbitrary fixture units; no live API, PDF extraction, or predictive inference is
claimed.

Simulations run only as previews, with warnings outside generated UI and result
provenance. Their source/contract checks and TypeScript compilation can pass,
but production financial verification remains failed. They cannot write active
data, call legacy/plugin capabilities, or be promoted by approval/reverification.
Selecting capability mode records durable lineage so removing a draft plan does
not permit legacy source to replace it.

The activation path requires independently verified full contracts/coverage,
production verification, and a human approval bound to the artifact and owner.
The shipped catalog intentionally has no production-ready entries. Registry
factories allow future contracts and independently checked verification evidence;
connecting verified execution and a production assembler requires further work.

Legacy applications retain their existing behavior and automatic activation.
They are not certified capability-backed financial applications. A universal
final-human-approval migration for all legacy releases is not included.

## B2C Performance

The fixture explicitly leaves China-market and stocks/bonds/funds/gold coverage
UNKNOWN. Search and holdings are unsupported; company research and metrics
presentation are only partial conceptual matches. Industry P/E peer benchmarks,
contextual financial explanations, licensed multi-asset sources, and performance
methodology remain gaps. An unsupported requirement may have no selected steps;
the planner is not required to force a catalog match.

## Verification And Remaining Work

Use `bun run test:capabilities` for package contracts/composition/Markdown,
strict generated-TypeScript compilation, and release/RPC gate tests.
`bun run test:capability-ui` builds local mode and checks review, workflow,
simulation, external warnings, and mobile layout with a deterministic fixture.
Model suites use local transport fixtures, not live inference.

Production needs authoritative financial contracts, independent methodology and
test evidence, licensed coverage/freshness/corporate-action handling, revocation
policy, compiler/runtime resource quotas, and an explicit verified artifact
assembly path. Existing Docker wiring, tenant isolation, workload limits, and
data-egress policy need separate production verification. Demo workspaces remain
shared; local tests do not establish account privacy or cloud isolation.

The existing specification editor still requires a legacy protocol tag. A
capability preview does not execute that legacy protocol, but a future standalone
production bundle needs a dedicated capability-flow specification/runtime format.
Custom UI generation for capability-backed artifacts is not yet exposed; the
initial preview intentionally uses a deterministic input/result viewer.

### Verification Results

- Capability package: 29 tests passed, including contracts, composition, lifecycle
  statuses, future registry replacements, Markdown, canonical serialization, and
  generated TypeScript compilation.
- Compiler fixture passed; capability release/RPC integration: 7 checks passed.
- Prototype and release lifecycle: 13 checks each passed.
- OpenAI-compatible model fixtures: 5 checks passed; GLM fixtures: 11 passed.
- Agent browser/transport integration: 13 checks passed.
- Capability browser suite: 5 checks passed using installed Google Chrome via
  `PLAYWRIGHT_CHROMIUM_EXECUTABLE`, including 390px mobile layout.
- Default and local-mode builds passed, with existing CSS, chunk-size, and
  deprecated server-function validator warnings.
- Targeted lint and web/capability TypeScript checks passed; `git diff --check`
  passed.
- `bun run codegen` passed using self-hosted Convex credentials from
  `packages/backend/.env.local`. The launcher now supports those credentials as
  a fallback instead of requiring a Convex Cloud deploy key.
- `bun run check` stops on pre-existing formatting differences in
  `packages/backend/convex/_generated/api.d.ts` and `dataModel.d.ts`; those
  unrelated generated changes were preserved.
- The default Playwright browser is not installed. The browser tests passed with
  the explicitly configured system Chrome executable instead.
