# Builder stage handoff

13 October 2026. The product scope below is agreed in the design discussion. The templates are an engineering proposal for implementing it, not an already integrated runtime. Work in the `platform` repository and follow its `AGENTS.md`. The current upstream default branch is `feature/self-hosted-stack`.

## Product and stage boundary

The platform builds applications from supported financial capabilities. App 1 and App 2 are demo compositions, not product boundaries. Users may combine capabilities across them when dependencies and data access permit. App 3 and brokerage integration are outside this implementation.

Current flow: describe request → clarify material ambiguity → summarize outcomes → validate an internal build record → build and verify → activate automatically → show the working app link.

The builder receives the internal versioned record and selected protocols automatically. No separate submit or deployment-approval screen is required. See [first implementation](implementation.md) for current behavior and remaining gaps.

The Stage A review is high level and plain language: requested outcomes, what the user will see/do and material limitations. Keep technical configuration, dependency graphs, SDK choices and provider fields inside the builder contract, not in the required user review.

Feasibility validates every requested company against the platform-managed company table before preparing a build. Resolve ambiguous names, preserve ticker identity and reject companies outside the supported table with a supported alternative. Table membership does not by itself prove Wind field coverage.

Preparing the internal record freezes its version for that build. A builder must not silently change scope, metric definitions, dependencies or data sources to make a build pass. Return an explicit blocked result or request a revised contract. Passing verification activates the release. Failed updates preserve the existing release and app data.

## Agreed capabilities and dependencies

| Capability                                   | Required behavior and dependencies                                                                                                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Market research                              | Includes a one-time news retrieval for the demo. Standalone requests produce industry research. Company-card details use company-specific research plus relevant industry context.         |
| Historical analysis and sourced price target | Always offered together; may run without market research. Target price comes from an external financial source, never a builder-created prediction model.                                  |
| Risk appetite assessment                     | Internal input to matching; not offered alone. Expert questions and scoring remain to be supplied.                                                                                         |
| Industry preference                          | Separate assessment/input, not offered alone; uses the provided company-universe industries.                                                                                               |
| Risk/industry matching                       | Requires both assessments. Fixed mapping: low risk → large cap, medium risk → medium cap, high risk → small cap; intersect with selected industries.                                       |
| Company-card experience                      | Five random eligible companies per day, with financial metrics and yes/no interaction. Yes adds to watchlist. Optional research detail must include the research dependency when selected. |

Matching may be combined with market research or with historical analysis and sourced targets. Selecting a research detail view adds market research and its news dependency; matching itself does not always require research.

The company CSV has Company Name, Ticker Symbol, Industry, A-share Market Capitalisation (RMB), and Size Category. Preserve ticker leading zeros, reject ambiguous identities, and use the supplied category rather than inventing capitalization thresholds. Use deterministic lookups and filtering; the model interprets requests and explains evidence. CSV delivery, exchange disambiguation and category-value normalization remain outstanding.

## Official data provider

Wind is the selected official provider for the redesigned platform, superseding Tushare and current substitute-provider defaults. Use a Wind adapter as the production target; fixtures remain explicitly labeled demo data. Do not silently fall back to another provider.

Reference products: [Wind Client API](https://www.wind.com.cn/portal/zh/ClientApi/index.html) and [Wind market-data service](https://www.wind.com.cn/mobile/WDS/marketdata/zh.html). Exact product, credentials, licensed fields and display/caching permissions remain to be confirmed. Historical-feed availability does not establish fundamentals, target-price or news entitlements. Live Wind integration remains pending; scoped builds cannot call the old substitute-provider APIs.

## Required outputs

Historical package: price chart, current price, 52-week high and low, all-time high and low, maximum drawdown, distance from 52-week high and low, daily price change in amount and percentage, and externally sourced price target with source/date. One year of chart history cannot establish all-time extremes. Require sufficient full history or validated provider fields; otherwise show unavailable. Price basis, distance definitions, drawdown window and target aggregation/horizon need expert confirmation.

Each daily company card shows identity and selected financial metrics. Menu: P/E, P/S, dividend yield, revenue growth, ROE and interest coverage. Defaults: P/E, dividend yield, ROE and interest coverage. Explicit selections replace defaults. These are values inside a company card, not six separate company suggestions. Retain unavailable selected metrics with a reason; never substitute zero or an unselected metric.

The supplied financial handoff distinguishes confirmed selection rules from proposed calculation conventions. Use its definitions as candidate protocol content for expert validation, not as silently accepted final formulas. Metric evidence includes units, dates, underlying inputs and calculation version. Industry benchmarks do not require the broader narrative research capability. The supplied chatbot scope uses prepared analysis and approved explanations only, with no buy/hold/sell call. Selection of fewer dashboard metrics does not reduce its approved topic coverage. Do not activate unsupported topics without prepared material.

## Mandatory builder implementation rules

- Base every build on [adityamiskin/web-starter](https://github.com/adityamiskin/web-starter), using the existing project adaptation and its pinned versions.
- Use TanStack Start for application routing/server integration and shadcn components from `@web-starter/ui/components/*`. Reuse the starter component library and Base UI conventions before writing custom controls.
- Reuse the installed AI SDK/integration for model calls, chat and streaming. The starter currently uses TanStack AI; do not assume Vercel AI SDK is installed or replace the integration merely because another SDK exists.
- Inspect existing components, hooks, adapters and capability modules first. Add custom code only for a concrete requirement that those modules cannot satisfy; record the gap and reason in the build result. Do not recreate routing, chat transport, standard UI primitives or financial modules unnecessarily.
- Apply the default theme unless the submitted contract explicitly specifies a theme override. Put overrides in central theme tokens rather than scattered component styles. Record the resolved theme and version in the build result.
- Validate starter/library reuse and resolved theme against the contract before activating a build. An expert protocol can define financial behavior but cannot silently replace these implementation requirements.

## Starter kit and builder responsibilities

The selected web-starter and shadcn libraries are mandatory. Use `@web-starter/ui/components/*` and Base UI conventions. Both platform and generated app support English and Simplified Chinese, with identical figures and qualifications.

Fixed company filtering and daily card/watchlist state are implemented in `apps/web/src/lib/company-capabilities.ts`, exposed through capability-scoped server RPC. Reuse these rather than generating new logic. Risk scoring and financial values remain pending.

Provide a reusable app shell, default theme, company lookup, company card, metric display, history chart, research detail, swipe/buttons, watchlist, language switching, loading/error/unavailable states and provider interfaces. Build financial calculations and matching once as tested reusable modules. The builder composes these and implements permitted glue and request-specific presentation. It must not regenerate expected functionality or redefine standard metrics per application.

Engineering default: inherit starter typography, semantic colors, spacing and accessible shadcn states. Centralize theme tokens; record a theme version in contracts. Use this theme unless an explicit contract override is supplied. Contract variation covers selected capabilities, assets, industries, metric selection, supported chart periods, presentation and approved options. Changes to invariant financial behavior require a versioned capability update.

The current builder exports plain HTML/JS/CSS bundles and selects provisional TypeScript portfolio/screening/strategy protocols. That format does not yet implement reusable shadcn React applications. First establish a React starter build/artifact and preview integration compatible with the existing verification and release lifecycle. Do not claim shadcn compliance by merely naming it in a prompt or copying its appearance.

## Routine assumptions

These are implementation defaults, not additional questions for the user:

- A batch is stable per Asia/Shanghai calendar day and survives reloads. Create it on first visit; no scheduled job is required.
- Sample without replacement inside a batch. Persist batch IDs and decisions; concurrent visits must not generate different batches.
- Watchlisted companies remain excluded. Previously answered companies are excluded until the remaining pool is exhausted; offer an explicit revisit of dismissed companies.
- Fewer than five eligible companies means fewer cards and an explanation. Never broaden industry or risk filters silently.
- No records means an empty state. No silently substituted live data. Demo fixtures are clearly labeled.
- No means dismissal only. Yes means watchlist only; neither changes assessed risk or industry preferences. No broker connection or order execution.
- Account/app data follows the existing ownership model. Current shared demo mode must not be described as private personal accounts.

## Builder deliverables and checks

Return the submitted contract ID/version/hash, capability/protocol/starter versions, source artifact, dependency manifest, build report, verification results, preview reference, evidence/data status and known blockers. A failed or blocked build cannot become an accepted release.

Verify dependency closure, source coverage, stable metric definitions, deterministic matching, daily batch persistence, watchlist behavior, missing-data states, bilingual parity and reusable shadcn components. Check target attribution and prevent local prediction fabrication. Check industry-only and company research modes separately. Unsupported requests must be rejected before build with supported alternatives.

Follow repository verification: `bun run codegen`, `bun run check`; use `bun run build` for routing/config changes and relevant prototype/flow/model-contract suites for runtime or lifecycle changes. Record missing deployment credentials explicitly. Fixtures do not prove live APIs.

## Work teammates can start now

1. Contract integration: validate structured capability definitions, dependencies and readiness; persist submission versions; connect Stage A to Stage B.
2. Starter kit: reusable React/shadcn components, central default theme and bilingual messages; demonstrate one contract-driven fixture application.
3. Capability modules: CSV identity/filtering, daily batch/watchlist storage, metric and provider interfaces; keep expert-dependent computations pending.
4. Builder integration: constrained component assembly, verified artifact packaging, working preview/link and automatic activation after verification.
5. Domain/data handoff: fill the capability and provider templates and supply reviewed fixtures with expected outputs.

Use separate files/components for these work areas and agree contract/module interfaces before integration. This list allocates work; no tasks have been dispatched automatically.

## Remaining inputs

- Actual company CSV, valid categories and identity/exchange rules.
- Risk questionnaire, scoring, missing-answer behavior and industry-preference protocol.
- Research protocol, evidence requirements, approved chatbot library and bilingual copy.
- Historical metric conventions and reviewed calculation examples.
- Financial-card calculation approval, industry classification/minimum peer count and freshness limits.
- Data credentials and verified field coverage, for Wind, including whether price targets and news are covered by the selected product. Provider selection is settled; exact field access and integration remain pending.
- Full-history coverage for all-time values and financial fields for every required card.

Missing items have placeholders below. Teammates may build against labeled fixtures while readiness stays `template`; do not present the capability as live-ready.

## Templates

- `templates/builder-contract.json`: illustrative submitted contract for a combined daily-card/research application.
- `templates/capability-protocol.md`: domain expert instructions and fixed outputs.
- `templates/provider-handoff.md`: provider fields, coverage and evidence.
- `templates/build-result.json`: builder response including verification and preview status.

The template contract is a broader design reference. The first runtime record is defined in `apps/web/src/lib/build-plan.ts`; see `implementation.md` for that integration. These templates do not replace `apps/web/src/lib/contracts.ts` until runtime integration and validation are implemented.
