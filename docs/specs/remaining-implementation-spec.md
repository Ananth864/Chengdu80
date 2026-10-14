# Spec: Complete the capability-driven financial platform (post-fixture scope)

## Problem Statement

The platform's conversational builder works end to end for scoped, clearly labeled synthetic demos: a user describes a financial app, the agent clarifies, records requirements, passes the `prepare_build` feasibility gate, generates a React/TanStack application from the protected starter with fixed financial modules, verifies it in the sandbox, and activates it into the Built apps gallery. But every live financial output — real market data, historical analysis, price targets, company-card metrics, expert risk scoring, research content — displays "unavailable". Users cannot get a live app, and the platform team has no clean path to open one: the data provider direction is mid-rename in the working tree (Tushare with a platform-managed token, while the design docs still name Wind), the real company table has never been delivered, and the expert conventions and approved content that gate each capability are not yet wired into versioned platform modules.

## Solution

Finish the transformation from fixture platform to live capability platform, one capability at a time, behind the existing feasibility gates:

1. Land and reconcile the provider decision: Tushare is the official provider, configured only by the platform team via a server-side token; users never supply API keys. Update the builder docs, templates, and protocols that still name Wind.
2. Verify the platform's Tushare token and field coverage, then open a live market-data capability that generated apps reach only through platform-owned modules — never direct provider calls.
3. Load the real company table and let live builds resolve real companies instead of DEMO tickers.
4. Implement the historical-analysis package as a versioned reusable platform module on approved conventions: chart, current price, 52-week and all-time extremes, maximum drawdown, distances, daily change, plus an externally sourced price target with attribution.
5. Fill company-card metric values (P/E, P/S, dividend yield, revenue growth, ROE, interest coverage) from verified provider fields and approved formulas, keeping unavailable metrics visible with reasons.
6. Add the expert risk-appetite questionnaire and scoring, feeding the already-implemented fixed risk-to-size/industry matching.
7. Deliver market research with approved analysis content, including the company-card research detail view.
8. Activate the generated-app LLM tool only within an approved evidence library and server-side restrictions.
9. Close UX gaps: real rendered-release thumbnails in the gallery and English/Simplified Chinese parity for platform and generated apps.

The synthetic fixture flow remains as the labeled fallback; live readiness is a per-capability, per-build-record state that the feasibility gate enforces.

## User Stories

1. As an app user, I want live scoped builds to stop being unconditionally blocked once the platform team has verified the Tushare token and field coverage, so that I can get a working app with real data.
2. As an app user, I want any capability whose data or expert protocols are not yet approved to stay explicitly unavailable with a reason, so that I am never shown fabricated or stale figures.
3. As an app user, I want the synthetic demo clearly labeled whenever I am looking at fixture data, so that I never mistake demo values for live market data.
4. As an app user, I want to request historical analysis for a real company from the supported table, so that I can see its actual price history rather than a synthetic series.
5. As an app user, I want a price chart with selectable supported periods, so that I can inspect the time range I care about.
6. As an app user, I want the current price and the daily change in both amount and percentage, so that I can see today's movement at a glance.
7. As an app user, I want the 52-week high and low plus my distance from each, so that I can judge where the price sits in its yearly range.
8. As an app user, I want all-time high and low computed from genuinely full history, so that one year of data is never presented as all-time extremes.
9. As an app user, I want maximum drawdown over a stated window, so that I can understand historical downside risk.
10. As an app user, I want the price target to come from an approved external source with source name, date, currency and horizon, so that I can trace and trust the number.
11. As an app user, I never want a price target calculated by a prediction model on the platform, so that no locally fabricated forecast is presented as analysis.
12. As an app user, I want each daily company card to show identity plus my selected financial metrics (P/E, P/S, dividend yield, revenue growth, ROE, interest coverage), so that I can screen companies on the numbers I chose.
13. As an app user, I want my explicit metric selection to replace the defaults rather than add to them, so that cards show exactly what I asked for.
14. As an app user, I want a selected metric that lacks verified data to display as unavailable with a reason instead of zero or a substitute, so that missing data is never disguised.
15. As an app user, I want daily batches of five eligible real companies once live data is open, so that the card flow works on the real universe with the same stable-batch and watchlist behavior as the fixture flow.
16. As an app user, I want to answer an expert-authored risk-appetite questionnaire, so that my risk profile comes from a validated assessment rather than a synthetic label.
17. As an app user, I want my risk profile and industry preferences mapped to companies by the fixed low→large, medium→medium, high→small rule, so that matching stays deterministic and explainable.
18. As an app user, I want company-card details to include company-specific research with industry context before I decide, so that my yes/no choice is informed.
19. As an app user, I want standalone industry research when I request it without company context, so that I can explore a sector on its own.
20. As an app user, I want an in-app chatbot that answers only from prepared analysis and approved explanations with no buy/hold/sell call, so that I get consistent, sanctioned answers.
21. As an app user, I want the platform and generated apps fully in English and Simplified Chinese with identical figures and qualifications, so that language choice never changes the data.
22. As an app user, I want gallery thumbnails that show the actual rendered release, so that I can recognize my app before opening it.
23. As a platform operator, I want to configure the Tushare token only on the server, so that credentials never reach users, apps, or the builder.
24. As a platform operator, I want a token and entitlement verification step that reports which required fields the token actually covers, so that I know exactly which capabilities can open before promising them.
25. As a platform operator, I want to load the real company table from a team-controlled file path, so that company identity, industry and size categories come from reviewed data and never from user uploads.
26. As a platform operator, I want ambiguous names to require a ticker choice and unsupported companies to be rejected with alternatives, so that builds never target the wrong identity.
27. As a platform operator, I want live readiness recorded per build record with its blockers, so that I can see why any given build is fixture-only.
28. As a platform operator, I want historical conventions (price basis, drawdown window, distance formulas, target aggregation) pinned as versioned protocol content, so that numbers are reproducible and auditable.
29. As a platform operator, I want metric evidence (units, dates, underlying inputs, calculation version) retained, so that any displayed figure can be traced to its inputs.
30. As a domain expert, I want to supply capability behavior as versioned Markdown protocols with validated structured definitions, so that I can change instructions without rebuilding the surrounding platform.
31. As a domain expert, I want the risk questionnaire, scoring rules, and missing-answer behavior captured in a protocol I own, so that assessment semantics are mine to revise.
32. As a domain expert, I want reviewed fixtures with expected outputs for each capability, so that the implementation can be acceptance-tested against my examples before live data opens.
33. As a teammate, I want the design docs, templates, and code to agree on the official provider, so that I am not building against contradictory guidance.
34. As a teammate, I want the working-tree provider rename committed, so that the repository state is a clean base for the remaining work.
35. As a teammate, I want legacy blocked endpoints to either accept the new contract format or be removed, so that there is one governed path for writes.
36. As an app user, I want failed live-data fetches to surface explicit errors and keep my previous working release intact, so that outages never destroy a working app.

## Implementation Decisions

- Tushare is the official data provider, reversing the earlier Wind selection recorded in the builder handoff docs. The token and entitlements belong to the platform team (server-side settings key `TUSHARE_TOKEN`, already present in the environment); apps and builders never handle credentials. All docs, protocol templates, and the provider-handoff template must be updated from Wind to Tushare as part of landing this.
- Live market data is reached only through platform-owned capability modules exposed via the existing contract-scoped SDK; the existing direct provider transport in the platform's internal API is the integration point, not a pattern generated apps may copy.
- The build record gains a genuine `live` readiness level. A live build is feasible only when: the token is configured and verified, the required provider fields for every requested capability are confirmed covered, the requested companies resolve in the real company table, and no expert-pending convention remains. Until then the existing blocker messages apply. Readiness stays fixture/blocked for everything else.
- Historical analysis and card-metric calculations are implemented once as versioned reusable platform modules (following the company-capabilities-v1 pattern: fixed logic, contract-scoped RPC permissions, server-owned data, revision retries for concurrent batches). The builder composes them; it must not regenerate their logic per app.
- Price targets are fetched from an approved external source with attribution (source, date, currency, horizon) and are never computed locally. Absence of a target renders unavailable.
- All-time extremes require full-history coverage; when coverage is insufficient the field renders unavailable with the coverage reason rather than a partial-history value.
- The risk-appetite questionnaire, scoring, missing-answer behavior, and industry-preference protocol are expert-supplied protocol content driving a fixed scoring module; the current synthetic risk selection remains only in fixture mode.
- The generated-app LLM tool (the application-llm protocol already bundled into instructions) stays disabled until the approved evidence library exists; activation adds server-side restrictions limiting it to that library.
- Gallery thumbnails move from static layout previews to safely captured screenshots of rendered releases, still inside the sandbox with no scripts or data writes at thumbnail time.
- Bilingual support is delivered as central message catalogs for the platform shell and the starter kit, with identical figures and qualifications across languages.
- The uncommitted working-tree changes (provider rename, live-blocker messaging, synthetic-label wording) are committed as the first step; they are the agreed direction and everything else builds on them.
- Legacy direct create/update/import/seed/provider endpoints stay blocked until they accept the same contract flow as the guarded agent, or are removed.

## Testing Decisions

- Good tests assert external behavior at existing seams: feasibility outcomes (allowed/blocked with reasons), module outputs on fixture inputs, persisted conversation semantics, and end-to-end browser flow. They do not assert internal call sequences.
- The primary seam for readiness work is the existing build-policy suite: it already exercises dependency closure, company identity, readiness states and permission gates, and extends naturally to live-readiness transitions.
- The provider adapter gets a recorded-response replay seam: captured Tushare responses (secret-free) drive adapter tests with no live calls, following the existing local-transport-fixture pattern used for model-contract tests. A separate manual smoke script verifies the real token and prints field-coverage findings for the platform team; it is not part of automated suites.
- Capability modules (historical package, card metrics, scoring) follow the company-capabilities suite pattern: deterministic fixtures with expected outputs supplied or reviewed by the domain expert.
- Live-path tests must assert unavailable-with-reason behavior whenever data is missing; no test may assert a fabricated or substituted value.
- End-to-end remains the agent browser suite over a local build; bilingual parity is tested by asserting identical figures across both message catalogs on shared fixtures.
- Documented limitations stay honest: fixtures prove structure, not live inference; live verification is the platform team's manual gate.

## Out of Scope

- App 3 (annual-report extraction and its dashboard) — explicitly undecided.
- Brokerage integration, order execution, or trading of any kind.
- Re-enabling hosted authentication beyond the current demo-mode default (WorkOS stays available when demo mode is explicitly disabled).
- Background monitoring or scheduled jobs; daily batches remain first-visit-created, stable per Asia/Shanghai day.
- Arbitrary plugins, arbitrary market APIs, or direct provider/LLM/network access from generated apps.
- Replacing TanStack AI with another AI SDK.

## Further Notes

- Blocking dependency reality: several items need inputs only humans can supply — the real company CSV, the risk questionnaire, historical/card-metric conventions, the approved research/explanation library, and price-target source approval. Engineering tickets below are sequenced so that provider plumbing, table loading, and doc reconciliation proceed immediately while expert-dependent modules land behind readiness flags.
- The ticket set for this spec is published as GitHub issues on this repository, one tracer-bullet ticket per seam, with blocking edges declared in each ticket body.
