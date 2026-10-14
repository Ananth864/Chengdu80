---
name: dashboard-composition
description: Compose or update app-configured financial dashboards using registered composition adapters, with independent capability statuses, accessible metric explanations, sourced charts, and financial-report compositions. Use for shared dashboard integration in compositions such as a stock-analysis dashboard or an annual-report executive dashboard.
metadata:
  skill-role: dashboard-composition
  contract-version: "1.2.0"
  implementation-status: platform_adapters_available_with_evidence_limits
---

# Dashboard Composition and Display

This is a composition skill, not a capability-library entry. It coordinates only the reusable capabilities selected by the application's approved specification. The supplied current definitions for historical-analysis, industry-research and price-target govern those analytic scopes when older dashboard/reference guidance conflicts. They do not authorize financial metric modifications in any scope.

Compose app-configured capability records into accessible dashboards through registered composition adapters. For example, preserve an existing stock-analysis dashboard’s bundle API.

## Inputs and scope

- For an example stock-analysis profile, use one or more validated SSE A-share stocks from the supplied CSV and results from configured analysis capabilities.
- For financial-report composition, use normalized financial-report datasets, optional peer datasets, and an app-selected composition profile.
- Require a validated stock universe and exact industry taxonomy for stock-selected bundles.
- Support app-configured financial dashboard subjects; an example stock-analysis profile can remain scoped to SSE A-shares.
- Current industry research requires a validated selected SSE company to establish its exact CSV industry; it returns historical supplied-universe listed-company statistics, not general industry narratives. News requires a separately supplied supported contract; do not invent one or add news automatically as a research dependency.
- Risk assessment and preference capture are independent scopes, not mandatory dashboard inputs. Only explicitly enabled discovery requires both completed risk and normalized preferences. Missing input remains missing, not an inferred default.

## Composition integration

New prepared CSV-backed discovery uses protected CompanyDiscovery and finance.company-discovery.v1-3 with the neutral company-discovery v1.3 contract, an optional industry-preferences add-on rather than a mandatory standalone capability. It requires completed validated risk_result and consistent normalized industry_preference, maps low/medium/high only to assigned Large cap/Mid cap/Small cap, and independently filters exact supported industries. Never calculate new size thresholds or widen filters. Shuffle once per memory-only session, with at most five distinct companies and one company per round; refresh abandons session state. Optional excluded_company_ids contains app-owned canonical exchange+ticker exclusions; absent means none. Prior exposure alone does not exclude a company from later sessions. The app chooses actions and any optional saved-company list from its approved requirements; do not impose Add/Skip, a watchlist, persistence keys or a mandatory feature. Metrics are separate and must not block advancement. Preserve existing v2-sessions finance.company-discovery SDK/render and Add/Skip/watchlist behavior until an approved upgrade; existing daily-batch releases likewise keep their legacy SDK until upgraded.

Preference capture is implemented independently through protected IndustryPreference from @/components/industry-preference and finance.industry-preferences contract v1.3.0. Risk assessment uses protected RiskQuestionnaire and finance.risk-profile independently of preferences/discovery. Persist only completed validated inputs and any requested app-owned list through the permission-checked platform storage bridge; no localStorage. Do not fabricate missing preferences, risk results or financial observations.

The three current analytic scopes have server adapters finance.historical-analysis, finance.industry-research and finance.price-target, presented by protected FinancialAnalysis through the supplied FinancialModules composition. They are not globally pending. Select only requested scopes and preserve each returned availability, source, basis, coverage, as_of_date, retrieved_at and limitation independently. Generated apps cannot call providers or recreate retrieval, formulas, rating mappings, financial algorithms or protected components.

Use the reference implementation at `library/browser/dashboard.js`, resolved relative to the target project.

Expose these shared entry points:

```javascript
SharedDashboard.register(composition_id, composer);
SharedDashboard.compose(composition_id, input);
```

Keep composition independent of a hardcoded company universe. Library consumers choose enabled capabilities through app configuration. For example, a stock-analysis dashboard invokes its configured analysis capabilities and exposes no bundle-choice UI.

For example, preserve an existing `dashboard.run(company, bundle)` entry point while updating its services to the current contracts. An annual-report executive dashboard uses the registered financial-report composition.

The six investment metrics, metric education, financial visualization, result storage and grounded chat are skill/composition responsibilities, not reusable financial capability IDs. For requested investment metrics, read [Investment dashboard metrics](investment-dashboard-metrics.md). Skill ownership means composition and presentation through protected SDK/server modules, not implementation of formulas or metric modifications in generated code in any scope. Missing definitions, observations or benchmark evidence remain unavailable. Removing catalog entries neither removes permitted presentation functionality nor authorizes replacement algorithms.

Current analytic integrations are `industry-research`, `historical-analysis`, and `price-target`. Optional news and financial-report integrations require separately supplied supported contracts and prepared permissions; this skill does not create new capability IDs or contracts for them. Do not add a news dependency, six-metric dependency or report dashboard simply to populate a workflow. For requested stored-data conversation, use the companion skill `SKILL_DUMBChatbot.md`.

## Independent availability and provenance

Display each capability's status, as-of and retrieved times, sources, and limitations. A failed, stale, or unavailable section must not hide successful results from other capabilities.

Do not mark a capability populated when required evidence is unavailable. The recorded 2026-10-15 Asia/Shanghai live run verified Tushare daily, adj_factor, income and report_rc retrieval for one representative company; see docs/tushare-verification.md. It does not verify all-company coverage, complete trading history, same-day/intraday quotes, normalized brokerage rating mappings or target horizons. Tushare is the sole external financial provider; tokens, access and evidence configuration stay server-owned. Distinguish missing credentials, permission denial, partial data, empty results and errors. Show clear empty chart states until their required data is available, without hiding unrelated valid results.

Historical charts support 1 month, 6 months, 1 year and 5 years, with at most five years retrieved. Raw daily highs/lows establish the inclusive 364-day range ending on the latest quote date and the available-period range, never all-time extremes. Show actual coverage and partial states. Raw latest close/daily change are not intraday quotes. Adjusted drawdown uses the selected period and valid ticker/date adjustment factors under the documented common-reference formula; missing factors leave drawdown unavailable while raw metrics can display. Preserve returned bases and definitions rather than recalculating them in generated code.

Industry research uses the selected company's exact CSV industry across the supplied SSE universe with no size filter, up to five completed annual consolidated total_revenue periods published by as_of_date. Show available-universe annual totals separately from pairwise matched-cohort growth, including included/total counts, exclusions and changing cohort membership. Missing observations are not zero. Retrieval is bounded per invocation to at most 80 shared-query calls, at most 40 companies, concurrency 2 and a 30-second aggregate deadline; publication windows/report types require multiple calls per company, so this is not an 80-company guarantee. Show queried/unqueried counts, year/cohort coverage, as_of_date and budget/deadline limitations explicitly. Partial retrieval is not full-industry verification; do not promise durable background completion.

Brokerage summaries use the inclusive 90-day report window ending on as_of_date, deduplicated reports and at most one latest contribution per evidence-backed brokerage, without older-report backfill. Normalized ratings require versioned brokerage-specific server-owned mapping evidence. Preserve originals, exclusions and counts in Strong Sell, Sell, Hold, Buy, Strong Buy order. Most common brokerage rating is the unique mode, Mixed for a positive tie and unavailable for zero mapped opinions; majority requires more than half. Do not infer mappings from translations or average rating scores.

Targets require both positive ordered CNY bounds, compatible share basis and verified server-owned horizon/reference evidence. Neither report_rc quarter nor report age proves horizon. Keep horizon groups and fixed-date versus report-date-duration conventions separate. Average brokerage target midpoint is the protected server's equally weighted mean of one midpoint per eligible brokerage, displayed only with at least three eligible brokerages per group. Below three, aggregate and implied difference remain null with insufficient_brokerage_coverage; independently validated individual targets may display. Implied difference requires a compatible dated raw close and is not a promised return. Successful retrieval may still leave mapped ratings or target groups unavailable; apps cannot supply or fabricate evidence. Keep rating and target availability independent.

Automatically display supported extraction results without a human-approval step. Keep ambiguous or unsupported fields unavailable with reasons. Never guess their values or block unrelated valid fields.

## Metric explanations and charts

Every displayed metric needs an accessible click explanation covering its meaning, usefulness, and a valid industry comparison. State when no universal benchmark exists; do not invent industry standards.

- Render sourced price history as a line chart with actual coverage and raw/adjusted basis; never show all-time labels or imply gap-free history without evidence.
- Render revenue and profit as grouped bars only when dated, consistently defined financial records are available.
- In this demo, render only sourced historical listed-company industry revenue and separately computed matched-cohort growth, with visible coverage; omit industry forecasts, extrapolations and national market-size claims.
- Present brokerage target midpoint groups separately by verified horizon; a duration is not an exact date. Use a future chart marker only for a verified explicit target date on a compatible price basis.

## Financial-report composition

Only compose financial-report metrics when a separate supported contract, protected implementation, approved scope and sourced datasets are supplied. This skill does not supply a report-metrics capability or authorize implementing six report/investment-metric algorithms. Preserve explicit monetary units and dates and obtain definitions and peer eligibility from that contract; absent support remains unavailable rather than a newly generated contract.

Preserve source provenance and independent field availability. Compose an executive view containing supported metrics, peer gaps, changes, segment flags, and source availability. Do not fill missing definitions, formulas, or data with assumptions.

## Dashboard-owned result storage

Store permitted configured outputs and protected-server-calculated metrics through the app-scoped platform storage bridge, storage.read/storage.write, never browser localStorage. Keep source observations separate from calculations and preserve identities, schema versions, provider/source records, reporting and publication dates, as_of/retrieval times, units, coverage, statuses and limitations. Follow licensed retention/display rights, retain permitted versioned snapshots, and migrate compatible schemas or explicitly invalidate obsolete ones. Do not reinterpret legacy all_time/price_target records as revised outputs. Preserve original ratings, mapping eligibility, target evidence and calculated provenance separately. Never store tokens or secrets. Storage failures must not be reported as successful saves.

Render refreshes and chatbot retrieval from the same authorized traceable records. Distinguish stale snapshots, missing records and unavailable source data. Demo mode is a shared workspace, not a claim of account privacy or production multi-user isolation. Reference storage guidance does not replace permission checks.

## Expected output

Deliver dashboard sections for configured capabilities with independent statuses, freshness, and provenance; accessible metric explanations; and supported visualizations. Include the financial-report executive composition when that profile is selected.

If a chatbot interface is enabled, scope its answers to stored dashboard records.

## Composition examples

- Stock-analysis dashboard: compose historical listed-company industry revenue, historical prices, and sourced brokerage summaries; display each section’s availability and sources independently.
- Annual-report executive dashboard: compose supported report metrics, year-over-year changes, evidence links, and consistently defined financial charts.
- Dashboard with a stored-data chatbot: answer questions from authorized stored dashboard records and explain missing or stale evidence.

## Platform Integration

These platform rules govern integration where the reference guidance above differs from the executable platform contracts.

- This is skill composition, not a financial capability. The reference `library/browser/dashboard.js`, `SharedDashboard.register`, `SharedDashboard.compose`, and `dashboard.run(company, bundle)` APIs describe reference integrations, not platform prerequisites or runtime capability registration. Do not require or invent them when composing a platform application.
- Load `investment-dashboard-metrics` through read_financial_skill for investment metrics. Use `industry-benchmarking`, `headlines-supporting-analysis`, and `capability.json` only where their definitions are compatible with the requested composition. Otherwise disclose missing definitions, contracts, or data rather than inventing replacements or claiming a reference contract is implemented.
- Load the companion `SKILL_DUMBChatbot.md` through `read_financial_skill` using `database-grounded-chatbot`. It guides an application component, not a separately registered financial capability.
- Do not use browser `localStorage`, including where supplied reference documents mention browser persistence. Use the permission-checked platform storage bridge through `storage.read` and `storage.write`, preserving authorization, provenance, and explicit failure states. Never store secrets or tokens.
- Metric retrieval and calculations remain in protected financial SDK/server modules. Dashboard ownership means composition and presentation, not permission to recreate calculations, formulas, or protected implementations in generated application code.
- First record an application-specific workflow proposal through `propose_build`, including the application's name, purpose, actual inputs, requested outputs, and constraints. After exact Workflow approval, call `set_specification` with that approved specification unchanged. Give each output its own `outputDetails` entry keyed by its exact label, describing its content, source requirements, and availability limitations. Do not inherit portfolio defaults, invent requirements, or repeat the overall purpose for every output. Draft outputs describe intended behavior, not verified execution or live-data availability; blocked attempts must not replace active-release metadata.
- Building requires prior explicit Workflow-stage UI or CLI approval recorded server-side for the exact proposal. Changed plan fields require new approval; a later chat reply is not approval. UI and CLI approval use the same server action and automatically start one bounded builder turn, preserving approval receipt deduplication and persisted progress without requiring a second chat message. Preview activation remains a separate explicit user action. Follow executable capability, dependency, company, permission, build, and activation gates; automatic display of supported extraction results does not bypass them or imply durable crash recovery.
- Compose the generated application in a single `App.tsx` using protected `FinancialModules`, selected protected `FinancialAnalysis` scopes and the existing starter. Do not create a second root or starter, replace protected modules, install providers or add generated financial algorithms. Generated Node/Bash/SSR code runs only in the Linux Bubblewrap sandbox, through the Docker launcher on macOS, never a host fallback. Preserve the current gallery, retained discussion, chat-only deletion and studio UI.
- Preserve the current protected `RiskQuestionnaire` from `@/components/risk-questionnaire` and its independent `finance.risk-profile` bridge. It validates exactly q1 through q7 `v0-demo` integer answers 1-3 and returns a provisional internal profile; invalid/incomplete input returns no score/bucket. Keep score and bucket hidden, discard partial attempts on exit or refresh, and store only completed validated results under `risk-profile` through the platform storage bridge. Do not recreate scoring, default missing risk, infer preferences or require discovery as a dependency.
- For approved and prepared industry-preference scope, compose protected `IndustryPreference` from `@/components/industry-preference`. Executable `finance.industry-preferences` and storage permissions are derived by the platform from the prepared record, not granted by this skill. Contract `v1.3.0` supports `capture_preferences` and exact-label `filter_companies`; capture has no capability dependencies and needs no risk result, questionnaire, company catalog or market data. Accept only the five canonical IDs `manufacturing`, `information_software_it`, `utilities`, `financial_services` and `wholesale_retail`, deduplicating selections in first-occurrence order. An explicitly submitted empty `selected_industries` array means `selection_mode=all_supported` with all five effective IDs; absent or invalid input is invalid. Explicitly selecting all five remains `selection_mode=selected`. After successful capture, store only the validated completed normalized `industry_preference` under `industry-preference` through platform storage, and report a save only after storage succeeds. Never save drafts or infer preferences from questionnaire answers. Filtering matches exact labels from the protected five-industry CSV taxonomy and preserves input record order and duplicates; an explicit empty `industry_labels` array retains all records. Do not translate, fuzzy-match or widen labels, recreate protected normalization, or promise equal industry representation. Discovery still applies the independent risk-based size filter; preference capture does not authorize market metrics.
- This skill update is not implementation evidence. The three analytic server adapters and recorded four-endpoint retrieval are current platform support, not evidence that every mapping, horizon, company, observation or application flow is available. Follow executable prepared scopes and server-returned statuses rather than stale reference pending claims or blanket readiness claims.
