# Chengdu80 design session

This records source conflicts and the decisions being discussed. Accepted decisions are listed below; recommendations elsewhere remain proposals. The supplied proposal and plans remain unchanged.

Current implementation, 13 October 2026: [the shared studio is deployed](https://chengdu80-web-live-ananthacharya-mb7epyiddt4jehqm.chengdu80-1610dcd1.workers.dev), with 15 hosted lifecycle/runtime checks passed. The user deferred login and switched the main model to Gitee GLM-5.3. Actual GLM source import and a built-in revision pass verification. Earlier pending-hosting and unstarted-implementation statements below record the design session's historical state; use `implementation-status.md` for current evidence and limits.

## Sources and their roles

- `Context/`: photographed problem statement and supporting material. Requirements must be grounded in these sources.
- `proposal_Platform.pdf`: proposed product experience, capabilities, 17 proposed core commitments and five optional commitments.
- `updated_deliverables.heic`: a later image containing 13 core commitments. It removes four standalone rows and renumbers the remaining rows. It does not show the optional commitments, so their status cannot be inferred from this image.
- `update_to_language.png`: feedback that "node" sounds like a developer workflow tool. Suggested customer-facing alternatives include verified financial capabilities, functional building blocks, and platform capabilities. It does not explicitly remove the internal capability model or workflow.
- `chengdu80-plan.html` and `chengdu80-tasks.html`: an earlier VibeSDK implementation proposal with ten different commitment IDs. These IDs are not the corrected proposal's IDs.
- User-selected starter: `https://github.com/adityamiskin/web-starter`. The user requires this starter and stack as the base and allows additions where it is insufficient. The earlier VibeSDK fork is no longer assumed to be the platform base; any retained runtime mechanisms need an explicit fit assessment.

Recommended precedence, awaiting confirmation: official requirements constrain the product; the corrections supersede the affected proposal sections; the technical plans are implementation candidates to reconcile with that product.

## Corrected commitment crosswalk

| Corrected ID | Deliverable                                                                                        | Original proposal ID |
| ------------ | -------------------------------------------------------------------------------------------------- | -------------------- |
| C01          | Structured intent and specification engine                                                         | C01                  |
| C02          | Deterministic feasibility and guardrail checks                                                     | C02                  |
| C03          | Capability registry and compatibility validation, called node registry in the supplied image       | C04                  |
| C04          | Task-to-capability mapping and graph generation, called task-to-node mapping in the supplied image | C05                  |
| C05          | Hybrid application assembly                                                                        | C07                  |
| C06          | External API/data connector                                                                        | C08                  |
| C07          | Generated UI/dashboard                                                                             | C09                  |
| C08          | Automated build and verification gate                                                              | C10                  |
| C09          | Sandboxed build execution                                                                          | C11                  |
| C10          | Application hosting and deployment                                                                 | C12                  |
| C11          | Basic authentication, authorization, and logging                                                   | C13                  |
| C12          | Application specification and API documentation export                                             | C16                  |
| C13          | Third-party-generated specification import and execution                                           | C17                  |

Rows absent from the corrected core table: original C03 versioned financial node library, C06 visual workflow editor, C14 extensible node/plugin interface, and C15 documented SOP and release checkpoints. Their absence removes their standalone core commitments; it does not establish that all underlying concepts are forbidden or unnecessary.

## Conflicts to resolve

1. The proposal makes the specification and graph authoritative. The VibeSDK plan has a coding agent, finance APIs, and a small identity/permissions manifest; it does not specify the requirements-to-graph-to-build contract.
2. The correction removes a visual workflow editor commitment but retains graph generation. An inspectable workflow and configurable parameters remain a distinct option from drag-and-drop graph editing.
3. The corrected proposal imports specifications or documented workflows and maps them to supported capabilities. The technical plan accepts generated source files or ZIPs. These are different interoperability contracts.
4. The proposal requires deterministic pass/revise/reject feasibility and mandatory failed checks blocking release. The technical plan's build validator does not by itself establish pre-build financial feasibility or numerical correctness.
5. The technical plan's per-app shared storage is not automatically compatible with private user portfolios. Access and data ownership need a product decision before storage design.
6. The technical plan names 37 tables and their coverage, but the actual dataset workbook and released data files are not present in this workspace. Those claims need verification against the release.
7. The proposed Hong Kong Docker fallback is referenced but has no accompanying implementation plan in the supplied files.
8. The official brief permits application creation inside or outside the platform and requires externally generated applications to integrate, deploy and run. The final interoperability acceptance example must demonstrate a running externally prepared application, rather than stop at exchanging documentation or specifications.
9. The brief requires three distinct financial applications but prescribes no named use cases. CB Radar, Fund X-ray and Strategy in Words are technical-plan suggestions rather than official requirements.
10. The guide describes token expiry at competition end, while engineering review takes place the next day. Review-day credentials or permitted snapshots must be resolved so the locked platform still works during assessment.

## Decision tree

### Round 1, answered

- Q1. User chose free application generation guided by type-specific protocol/instruction files selected by the platform agent. Users confirm the final product specification before building. No drag-and-drop editor. A fixed executable graph does not govern construction.
- Q2. User chose to retain a broad audience for now. User-specific experience changes will be considered after feasibility and delivery scope are established.
- Q3. User accepted VPN/proxy access for this prototype. Ordinary mainland access is not a required acceptance gate for the current prototype.

### Round 2

- Q4. Accepted: retain a read-only explanatory workflow and capability catalog/API contracts. The builder decides how to implement the app within the product's constraints and information. Revise the proposal's claim that the graph is authoritative.
- Q5. Accepted: allow custom financial code with mandatory verification. The category protocol should supply required inputs, calculation rules and checks; exact criteria are still to be defined.
- Q6. Accepted after clarification: source-code import is the external integration path for now; specification-only import and internal regeneration from imported specifications are deferred. The platform checks, deploys and runs compatible externally prepared source. This decision concerns the two import alternatives, not removal of the agreed built-in builder. Applicable type protocols and mandatory verification govern imported apps too. Extra submission requirements such as a plain-language behavior description remain proposed. The small `cd80.json` manifest already exists in the technical plan.

### Round 3, answered

- Q7. Accepted: data is shared within an application rather than privately partitioned per viewer. Q8 bounds that sharing to the owning account and its authorized users; it is not public-by-default data.
- Q8. Accepted: applications are private to the owning account, whether an individual or a business. Explicit public publishing remains an option from the question the user accepted, but public-sharing details are not yet settled.
- Q9. User deferred monitoring entirely for now, rather than accepting on-demand monitoring as a feature. The user explicitly requires returning to an existing app, submitting changes and continuing development.
- Additional user requirement: plug-and-play APIs, described as enforcing OpenAI API standards for users' own APIs, with Tushare initially and a testing substitute to investigate. Model API versus financial-data API scope needs clarification; do not treat Tushare as OpenAI-compatible inference.

### Round 4, answered

- Q10. Clarified: the platform manages models. User-supplied model providers/BYOK are not required. The desired portability concerns financial-data providers. OpenAI compatibility is not applicable to Tushare's data protocol. The user delegates the adapter approach and test-provider selection, requesting an actual test API with financial data.
- Q11. Accepted: retain the current working app while the user reviews a verified updated preview; replace the release when the user accepts it. Existing app data survives ordinary updates.

### Round 5, answered

- Q12. Accepted: apps may use platform-managed AI for explanations and summaries; financial numbers come from calculations and data.
- Q13. Accepted: English requests only.
- Q14. Accepted: keep account scope simple; one owner represents an individual or business. Teams and membership are deferred.
- User authorized autonomous prototype construction, assumptions for gaps, and credential requests only when genuinely blocking. User selected gpt-6-luna as the main model and allowed use of an AI SDK where useful.

The local prototype is now implemented. See `implementation-status.md`, `assumptions.md` and the corrected-commitment evidence in `commitment-feasibility.md`. Routine packaging choices were made under the user's autonomy instruction. Live model and hosted delivery still require credentials. No further user answer is required to complete credentialless local work.

Application types are explicitly deferred by the user. Asset-management analysis is an example under consideration, not an accepted category or flagship application. Category-specific feasibility cannot be concluded until categories are selected.

### Pending factual prerequisites

- Official problem statement review is documented in `problem-statement-digest.md`. The reviewers visually confirmed Qwen-only software development, capability and product milestone locks, three distinct flagship applications, permission to generate applications inside or outside the platform, and code lock at hour 76. Detailed Stage 2 and Stage 3 scoring remains incomplete because printed page 10 is absent from the supplied photographs. Calendar event dates are also absent.
- Cloudflare investigation is documented in `cloudflare-china-feasibility.md` and `cloudflare-runtime-test-plan.md`. Public pages were reachable and custom calculations now run locally in workerd. The selected starter retains Cloudflare/Alchemy as its deployment target. Hosted proof is pending. Ordinary mainland access is not required after Q3.

### Cloudflare prerequisite still open

The original supplied files contained no deployed hostname, account configuration or application code. The implemented starter-based candidate now has local source, previews and durable demo storage. Public VibeSDK reachability remains historical investigation evidence, not hosted product proof. The next gate is a paid-account candidate deployment over the accepted proxy path. Cloudflare China Network is not a prerequisite for this prototype.

Read-only upstream inspection found a seam for the agreed generation model: ThinkAgent combines prompts/project context with Markdown skills and free workspace editing. Qwen integration and the scoped service/gateway bindings remain new work. The pinned upstream configuration disables `workers_dev` and carries upstream routes and resource IDs; the bootstrap must replace these rather than only set `CUSTOM_DOMAIN`. Qwen Code is installed locally, but no authenticated Cloudflare CLI context was available. See the evidence document for the smallest deployed pilot and account-dependent checks.

The selected starter was cloned to `../platform` at commit `fde7b8351c8179adf47a5d30efb72313430a87ba` and initialized with `init convex workos ai`. Baseline build/check passed. Custom product implementation, tests and remaining limits are now recorded in `implementation-status.md`. No remote services were provisioned.

### Later branches

- Supported financial use cases and the three demonstration applications, after the target customer is settled.
- Specification, workflow and external import/export boundaries, after the governing model is settled.
- Data freshness, financial calculation rules and unsupported-request behavior, after supported use cases are settled.
- Visibility, private data ownership and access policy, after the customer and application types are settled.
- Hosting choice and acceptance evidence, after the China connectivity result and access requirement are settled.
- Bilingual input, alerts, app AI, version updates and optional commitments, after the core scope is settled.
- Exact measurable acceptance criteria and final shared-understanding confirmation.

Implementation details such as folder layout, component choices, internal function names and routine indexing will be delegated to the implementation agent once the important decisions are locked.

## Accepted decisions

- Type-specific protocols guide free application generation after the user confirms the product specification. See `adr/0001-type-guided-free-application-generation.md`.
- No drag-and-drop workflow editor.
- Keep an explanatory workflow plan backed by a supported-capability catalog and API contracts. It does not dictate implementation.
- Allow custom financial code with mandatory verification.
- Support source-code import as the external integration path. Defer specification-only import. Retain the agreed built-in builder.
- Share data within each application instead of partitioning it per viewer.
- Applications are private by default to the owning individual or business account.
- Monitoring is deferred for now.
- Users can return to an existing app and request/submit changes. The detailed update/release behavior remains to be decided.
- Use `adityamiskin/web-starter` and its stack as the platform base. Add missing capabilities as necessary; the previous VibeSDK-fork base is superseded by this direction.
- Models are managed by the platform. User model BYOK is out of the current scope.
- Financial-data provider portability is desired. Use a stable platform data interface with provider-specific adapters; the implementation agent selects and tests a real-data test API. Provider coverage must remain explicit rather than implying arbitrary providers are interchangeable.
- Users review and accept verified update previews before replacement of an existing release. App data survives ordinary updates.
- Keep a broad customer audience during feasibility evaluation. Audience-specific user experiences remain undecided.
- VPN/proxy access is acceptable for this prototype. This does not establish ordinary mainland access or successful operation of a deployed app.
- Application categories will be selected later. Do not silently fix the technical plan's three suggested apps as the product scope.

Resolved domain terms are recorded in `../CONTEXT.md`. No hosting provider or complete commitment set has been accepted, and implementation has not started.

## Subsequent implementation decision, 13 October 2026

The user deferred WorkOS and authentication. Deploy the prototype as one shared demo workspace. Account privacy and login are outside the current hosted acceptance gate. Keep Convex storage and the server-only internal key.
