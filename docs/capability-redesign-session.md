# Capability redesign session

13 October 2026. This is a design interview, not an implementation specification. The existing deployed prototype remains unchanged. The selected web-starter stack remains the base.

## User-stated changes

- Application scope is limited to supported business capabilities. The platform must stop promising arbitrary application construction.
- A business capability is a financial task that the platform agent can assign to a builder. Some capabilities work internally rather than having their own user-facing screen.
- The initial capability list is market research, historical data analysis, predictive stock-price analysis, news tracking, risk-appetite analysis, industry preference, risk/industry mapping, annual-report extraction into key metrics, and dashboard display.
- Domain experts will supply the detailed capability behavior and protocols later. Prepare the structure so instructions can be changed without repeatedly rebuilding the surrounding platform.
- Market research, historical analysis and predictive analysis form a group with expected outputs and research flows. Their execution order, dependencies and precise output shape remain open.
- A second application assesses risk appetite and industry preference, maps those to companies, consumes the first group's output, and displays key metrics for the user to decide.
- A third application imports an annual report, extracts key metrics, and displays a dashboard.
- The platform clarifies an initial request through a protocol, asks the user to confirm or refine its interpretation, checks feasibility against its capabilities, and suggests supported alternatives when infeasible.
- A feasible request reaches a preview and human approval before a builder receives a standardized contract. What the pre-build preview contains is not yet settled.
- The starter environment must supply compatible foundations so the builder does not recreate them for every application.
- Tushare is the intended data provider for historical and predictive analysis. The exact datasets, permissions and predictive method remain open. A news provider has not been selected.

These changes supersede the earlier broad application scope. They do not yet settle how much custom code the builder may write, external-source import eligibility, or approval after building.

## Current implementation facts

- The current low-level capability catalog consists of market, calculation, storage and AI explanation API calls. It does not implement the nine business capabilities above.
- The current builder selects one of three provisional financial protocols and produces a whole source bundle. It does not assemble the new grouped business workflows.
- Current protocol instructions and fixtures live in TypeScript. Exported instruction files are examples, not dynamically loaded expert protocols.
- The current preview is an executable, verified source release produced after building. The proposed pre-builder approval therefore needs a distinct definition.
- Current feasibility uses a keyword gate, not dependency checks against available business tasks, providers and output contracts. Suggested alternatives are not implemented.
- The current deployed platform has no general research workflow, news connector, stock-prediction pipeline, or annual-report extraction pipeline.

Existing source references: `apps/web/src/lib/contracts.ts`, `apps/web/src/lib/samples.ts`, `apps/web/src/server/models.ts`, `apps/web/src/server/platform.ts`, and `examples/capabilities.json`.

## Working interpretation, awaiting confirmation

- Application 1 is a company-analysis workflow combining research, historical analysis and prediction.
- Application 2 combines investor preferences, company matching, Application 1's analysis and a dashboard.
- Application 3 combines annual-report extraction and a dashboard.
- A shared key-metrics contract may connect company analysis and report extraction to dashboard display. The exact fields and meaning are still to be defined.
- Report extraction produces metrics that dashboard display consumes. The user's note that extraction is dependent on display may instead mean extraction must match the dashboard's expected input. Confirm before implementing dependency direction.
- News tracking has no settled place in these workflows. Its name does not establish background monitoring, which was previously deferred.

## Round 1 frontier

1. What does the builder construct? Recommended: the platform supplies reusable capability execution and the builder configures selected flows, interfaces and permitted integration code. Alternative: the builder creates each capability's implementation from expert instructions for every app.
2. What does the user approve before the builder starts? Recommended: a design preview showing scope, workflow, data needs and illustrative dashboard layout. Then review the working app after building. Alternative: a working app must exist before this approval, which requires some building before contract handoff.
3. Which combinations can users request? Recommended: initially support the three described workflows with bounded options. Alternative: allow arbitrary compositions of the nine capabilities, subject to compatibility and feasibility rules.

## Dependent decisions for later rounds

- Capability ownership, allowed custom code, runtime execution and readiness criteria.
- App 1's internal flow, prediction's role, shared metrics, evidence, missing-data behavior and domain-expert acceptance examples.
- Assessment input, company universe and the boundary between company matching and personalized recommendations.
- Annual-report formats, extraction evidence and corrections.
- News tracking behavior and its relationship to previously deferred monitoring.
- Feasibility states when protocols or providers are not ready, and how the platform offers alternatives.
- Approval meaning, follow-up changes, and changes that require a fresh user approval.
- Builder contract contents, representation, versioning and compatibility with the starter environment.
- External-source import eligibility under the new scope.
- Durable execution, failures, progress and total time budgets.
- What the first skeleton must demonstrate before expert protocols and production data are supplied.

The proposed contract representation is validated structured data for machine checks plus a generated Markdown brief for the builder and reviewers. This is a recommendation, not an accepted decision. Instruction edits cannot by themselves make an unavailable API available or guarantee compatibility after an input/output contract changes.

Record answers here as they arrive. Create an ADR when a substantive trade-off is settled. Confirm shared understanding before implementing the redesigned skeleton.
