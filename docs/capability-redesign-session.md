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

## User clarification, 13 October 2026

This section supersedes conflicting working interpretations and the earlier Round 1 questions above. It records the user's stated scope, not approval of an implementation design.

- The three demo apps are examples. They do not define the product's composition boundaries. Users can request capabilities across demo apps, subject to dependencies and feasibility.
- Market research is tied to news tracking. When requested independently, its output is industry-level analysis.
- Historical and predictive analysis can be requested without industry research. Whether either can be requested without the other remains unclear.
- Risk-appetite analysis and industry preference are separate assessments. The user sees no value in offering either alone. Risk/industry mapping requires both and is offered as a combined package.
- Users can add market research to the mapping package, or combine that package with historical and predictive analysis without market research.
- App 3 remains undecided. Do not settle annual-report/dashboard dependencies yet.
- The requested interaction is initial description, protocol-guided scoping, user confirmation or refinement, feasibility against supported capabilities, supported alternatives if infeasible, preview for human review if feasible, then user submission when satisfied.
- Domain experts will define the exact protocols. The platform should provide the surrounding structure.
- Ask only questions that require real user decisions. Resolve routine implementation choices through project evidence and engineering judgment.

### Recommendations awaiting agreement

Use Markdown for expert-authored guidance and validated structured definitions for capability identifiers, inputs, outputs, dependencies and availability. Feasibility checks use the structured definitions; the agent follows the expert guidance. The storage format is an engineering choice unless experts need a different editing workflow.

Two immediate decisions remain: whether the builder implements capability logic or composes platform-provided implementations, and whether the preview before submission is a working application or a design preview. The meaning of submission depends on the preview decision.

## Locked scope and builder handoff, 13 October 2026

The subsequent user answers settle the immediate design branches. This section supersedes conflicting open questions above. Builder documentation/templates are authorized; runtime redesign is not claimed complete.

- Stage A ends with specification/flow review and submission of a consistent, versioned builder contract. Stage B builds and verifies, shows a working preview, then requires separate deployment approval.
- The builder uses reusable expected functionality from the selected starter kit, mandatory shadcn libraries and a default theme. It varies configuration/presentation within the contract rather than rebuilding fixed financial logic.
- Historical analysis and external price targets always come together, independently of market research. Targets are sourced, not locally predicted. Fixed historical outputs are chart, current price, 52-week/all-time highs and lows, max drawdown, distance from 52-week high/low and daily amount/percentage change.
- News retrieval runs once for the demo. Missing expert/provider material receives templates. App 3 is excluded for now.
- The company CSV supplies name, ticker, industry, A-share market capitalization in RMB and size category. Risk mapping is fixed: low → large, medium → medium, high → small, intersected with chosen industries.
- Daily suggestions are five randomized company cards. Financial metrics appear inside each company card, using the supplied handoff's six choices and defaults, including ROE. Yes adds to an app watchlist. Brokerage partnerships are roadmap only.
- Exclude answered companies until exhaustion, then offer revisiting dismissed companies. Show fewer than five if fewer qualify. Routine assumptions cover stable China-calendar-day batches, persistence and exclusion of watchlisted companies.
- Company-card details may use App 1 research before the swipe. Research provides company-specific evidence plus industry context in this composition; standalone industry research remains available.
- English and Simplified Chinese apply to both platform and generated apps.
- The user delegated obvious implementation choices to documented assumptions and requested teammate templates plus a Stage B handoff.

See `platform/docs/builder/README.md` and `platform/docs/builder/templates/`. These specify the remaining domain inputs and implementation gap between existing plain-source bundles and reusable React/shadcn generation. They are documentation, not integrated runtime validation.

### Starter reuse and theme clarification

The user explicitly requires the adityamiskin/web-starter base, mandatory shadcn/library reuse and reuse of available framework/AI SDK functionality. Use the default theme unless the submitted contract specifies an override. Protocol and contract templates now state these requirements. The installed starter AI integration is TanStack AI; the generic AI SDK instruction does not mandate replacing it with a different SDK.

### Wind, company validation and review clarification

Wind is the selected official data provider, superseding Tushare or substitute production defaults. Exact Wind product, access and fields remain pending; this changes the implementation target, not proof of a live migration. Feasibility must also validate requested companies against the supplied company table. The specification review is high level and must not burden users with technical details; those stay in the builder contract.

## Latest UX agreement, 14 October 2026

The user accepted preserving the general conversational builder UX. There is no mandatory submit or separate deployment approval. Clarify meaningful ambiguity, check declared capabilities/company validity/readiness, save an internal versioned build record, build/verify, and activate on passing checks. Expose the working link only on success. Failed changes keep the prior release. Company table and Wind configuration are internal product-team inputs; end users do not upload the CSV or configure APIs. Clearly labeled fixtures demonstrate the first scope-controlled flow. See platform/docs/builder/implementation.md for implemented boundaries and remaining work.

### Repeated-request enforcement

The user requires feasibility boundaries to hold through repeated calls and iterations. The first implementation rechecks raw intent in a fresh classifier context, requires exact declared dependency closure, revokes editing permission when a new preflight fails, hashes internal records and gates every editing/deployment turn. Legacy bypass endpoints are rejected. Rejected requests do not redefine the last feasible goal. Fixture tests exercise repeated mislabeling and API bypass attempts; full output semantics still require reusable modules and capability acceptance checks.

## 14 October: invariant modules and build gallery

The user asked for confirmed builds in a separate navigable thumbnail view and a more professional, less dull theme after the scope safeguards. Implemented Built apps with static sandboxed layout thumbnails, search and links, using the existing shadcn components and central blue/teal theme tokens.

The user proposed prebuilding settled behavior to strengthen feasibility enforcement. Fixed company-capabilities-v1 owns risk/size/industry matching, China-day five-card batches, stable choices, exclusions/revisit and watchlists. Selected metric IDs replace defaults, with unavailable values retained. Its APIs are contract-scoped and reserved state cannot be replaced through generic writes. Expert assessment/calculations, Wind data and constrained React/shadcn generated UI assembly are still pending.

## 14 October: visual revision

The user rejected the blue/teal gallery as a generic AI template. Reworked the studio with a Chengdu80 wordmark, neutral background and plum accent, restrained navigation and larger framed app previews. Removed the nested rounded-card presentation, repetitive headings and status pills. Kept the existing shadcn controls, build selection/search/link behavior and thumbnail sandbox. This revision changes the platform presentation; it does not edit accepted generated-app source.

## 14 October: conversation durability and UI review

The user reported losing non-build discussion during later builds, requested Delete chat, and explicitly requested a UI/UX sub-agent review using frontend-design. The review read frontend-design, unslop and AGENTS and inspected desktop, tablet and mobile without model calls or chat changes.

Removed the destructive transcript-size trimming that discarded old turns. All user/assistant text stays in persistence; large historical tool/file payloads are abbreviated. Added periodic partial-response checkpoints and immediate single-owner local recovery after an interrupted process. Independent feasibility receives previous user refinements as untrusted context, excluding blocked requests and builder tool output. Capability limits still apply to every modifying turn.

Chat deletion now has a shadcn menu and confirmation dialog. Unbuilt workspaces are removed; completed apps/data remain in Built apps with cleared conversation history. Revision, ownership and active-reply checks protect both local and hosted deletion.

The review's immediate fixes include responsive Chat/Preview tabs below 1280px, clamped desktop chat width, removal of dead import controls and generic empty promises, scoped financial specifications, explicit loading/retry, activity-sorted conversations, browser history navigation, larger mobile tap areas and shadcn reuse for gallery controls. Actual rendered-release screenshot thumbnails remain pending. Current thumbnails are accurately labeled static layout previews.

Regression verification uses isolated synthetic stores and a deterministic Responses transport, including growth past the old trim threshold, discussions before any build, abrupt process death during a plain-text reply, fresh conversations after deletion, full-width tablet/mobile previews and browser history. It does not verify live model inference, Wind or hosted account isolation.
