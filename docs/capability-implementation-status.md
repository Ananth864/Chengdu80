# Capability Implementation Status

Reviewed against the current worktree on 2026-10-15. This is an implementation inventory, not a release certification or a claim that all live summaries work.

## Source And Versions

The supplied source artifact is `~/Downloads/capability-library-demo-v1.3.json`. Despite its filename, its declared library version is **1.9.0**. The platform adaptation is `apps/web/src/lib/capability.json`, also library **1.9.0**, with six canonical contracts. `apps/web/src/lib/capability-catalog.ts` validates that catalog and maps it to persisted business/runtime IDs. Filename suffixes, library versions, individual contract versions and pinned runtime module versions are different identifiers.

All seven documents in `~/Downloads/capabilities` were compared with the latest JSON and current implementation:

| Source document                          | Contract or supporting material             | Version and reconciliation                                                                                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `market-research-capability.md`          | `industry-research`                         | Cites library 1.8.0, contract 1.2.0. Historical-only listed-company revenue semantics remain relevant; its legacy browser implementation/pending note does not describe the current TypeScript adapter.                                                                                         |
| `historical-analysis-capability.md`      | `historical-analysis`                       | Cites library 1.8.0, contract 1.2.0. Raw metrics, adjusted drawdown and bounded actual coverage remain relevant; its unverified-implementation header is not current platform evidence.                                                                                                         |
| `price-target-capability.md`             | `price-target`                              | Cites library 1.8.0, contract 1.2.0. Evidence-gated brokerage semantics remain relevant; distinguish its draft status from implemented code and the separately recorded transport verification.                                                                                                 |
| `risk-questionnaire-capability-io.md`    | `risk-profile`                              | Alignment section cites library 1.3.0, contract 1.0.0; defines `v0-demo` validation and internal results. Browser-storage instructions are replaced by the platform storage adaptation.                                                                                                         |
| `risk-questionnaire-scoring.md`          | `risk-profile` question wording and scoring | Alignment section cites library 1.3.0, contract 1.0.0. Seven questions, equal weights and inclusive score bands remain the source rules; this is supporting material, not a seventh capability.                                                                                                 |
| `industry-preference-capability.md`      | `industry-preferences`                      | Cites library 1.8.0, contract 1.3.0. Latest JSON uses contract 1.4.0 with independent `capture_preferences` and `filter_companies`; browser persistence and discovery-add-on wording are earlier architecture.                                                                                  |
| `risk-to-industry-mapping-capability.md` | `company-discovery`                         | Cites library 1.8.0 and describes an add-on under `industry-preferences`. Latest JSON lists standalone canonical `company-discovery` 1.3.0, depending on both `risk-profile` and `industry-preferences`. Its optional exclusions and app-owned actions agree with the neutral current contract. |

These are source revisions, not seven independent executable capabilities. Where the Markdown and latest JSON differ, use the latest JSON for financial contract semantics, with the repository's explicit platform integration and security adaptations. Downloaded `library/browser/*.js` references and their pending labels are not platform implementation paths or proof of availability. The supplied JSON itself retains legacy browser paths/storage instructions and pending implementation labels; the repository adaptation records the React/TypeScript implementations instead.

## Operation Inventory

Every row is marked `implemented_demo_contract` in the repository catalog. That means protected implementation code exists, not that every required source observation or evidence configuration is available.

| Canonical ID           | Contract | Operations and behavior                                                                                                                                                                                                                                                                                                                                                           | Build/runtime mapping                                                                                                                          |
| ---------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `risk-profile`         | 1.0.0    | Validate exactly `q1` through `q7`, integer answers 1-3, questionnaire `v0-demo`; sum equally weighted answers; 7-11 low, 12-16 medium, 17-21 high. Invalid input has no score/bucket. Score and bucket remain hidden.                                                                                                                                                            | Business `risk-assessment`; bridge `finance.risk-profile`; pinned questionnaire module `v0-demo`.                                              |
| `industry-preferences` | 1.4.0    | Independent `capture_preferences` and `filter_companies`. Capture deduplicates canonical IDs in first-occurrence order; explicit empty selection means all five supported industries, not every source industry. Exact-label filtering preserves order/duplicates; explicit empty label filter preserves all input records. Neither operation requires risk scoring or discovery. | Business `industry-preference`; bridge `finance.industry-preferences`; new prepared module `v1.4.0`, with existing `v1.3.0` releases retained. |
| `company-discovery`    | 1.3.0    | Neutral `start` and `advance`; completed risk and normalized preferences required. Low/medium/high select assigned CSV Large/Mid/Small cap, independently intersected with exact industry labels. Shuffle once, at most five distinct companies, one per round; explicit invalid/exhausted/completed states and validation report.                                                | Business `risk-industry-matching`, optionally `company-cards`; current bridge `finance.company-discovery.v1-3`, module `v1.3.0`.               |
| `historical-analysis`  | 1.2.0    | Independent price analysis; chart choices `1m`, `6m`, `1y`, `5y`; raw latest-close, prior-session daily change, high/low and distances; adjusted selected-period maximum drawdown. At most five years, never all-time.                                                                                                                                                            | Business `historical-analysis`; bridge/module `finance.historical-analysis` / `1.2.0`.                                                         |
| `industry-research`    | 1.2.0    | Exact CSV-industry supplied-SSE peer universe, no size filter; up to five completed annual consolidated revenue periods; annual available-universe totals separate from pairwise matched-cohort YoY growth, with exclusions and coverage.                                                                                                                                         | Business `market-research`; bridge/module `finance.industry-research` / `1.2.0`.                                                               |
| `price-target`         | 1.2.0    | Inclusive 90-day report window; deduplicate forecast rows and select latest report per brokerage; evidence-mapped rating distribution/mode and separate verified-horizon target-midpoint groups. Internal raw-quote retrieval does not require historical-analysis UI scope.                                                                                                      | Business `price-target`; bridge/module `finance.price-target` / `1.2.0`.                                                                       |

The five preference IDs are `manufacturing`, `information_software_it`, `utilities`, `financial_services` and `wholesale_retail`, mapped to exact CSV labels by the protected taxonomy. Selecting none does not promise equal industry representation. Random discovery is not financial ranking, suitability assessment or a return forecast.

The current discovery contract accepts optional `excluded_company_ids` using `SSE:<six-digit ticker>` identities; absent means no app exclusions. Prior exposure alone does not permanently exclude a company. The consuming app chooses card actions and any optional watchlist from its approved requirements. Discovery does not implement a mandatory watchlist, Add/Skip policy, daily batch or metric calculation. Existing `finance.company-discovery` / `v2-sessions` and older daily-batch releases retain pinned behavior until an approved upgrade; they are not the neutral 1.3.0 API.

## Implementation Paths

Paths in the following table are repository-relative. Generated starter import aliases such as `@/components/risk-questionnaire` resolve inside `apps/web/starter/project/src`.

| Contract               | Protected UI and algorithms                                                                                                                                                                                                                                                                             | SDK method and server dispatch                                                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `risk-profile`         | `apps/web/starter/project/src/components/risk-questionnaire.tsx` exports `RiskQuestionnaire`; `apps/web/starter/project/src/lib/risk-profile.ts` exports `scoreRiskProfile` and validation schemas.                                                                                                     | `cd80.finance.riskProfile(...)` calls `finance.risk-profile`; `apps/web/src/server/platform.ts` dispatches to the protected scorer.                                                                                                                                        |
| `industry-preferences` | `apps/web/starter/project/src/components/industry-preference.tsx` exports `IndustryPreference`; `apps/web/starter/project/src/lib/industry-preference.ts` implements `capturePreferences`, `filterCompanies` and `runIndustryPreference`.                                                               | `cd80.finance.industryPreferences({ operation, ... })` calls `finance.industry-preferences`; `apps/web/src/server/platform.ts` dispatches to `runIndustryPreference`.                                                                                                      |
| `company-discovery`    | `apps/web/starter/project/src/components/company-discovery.tsx` exports `CompanyDiscovery`; `apps/web/starter/project/src/lib/discovery-contract.ts` implements the neutral `executeDiscoveryContract` adapter over validated session logic in `apps/web/starter/project/src/lib/company-discovery.ts`. | `cd80.finance.companyDiscoveryContract(...)` calls `finance.company-discovery.v1-3`; `apps/web/src/server/platform.ts` supplies canonical records to `executeDiscoveryContract`. The unversioned `companyDiscovery(...)` method is the separate pinned legacy session API. |
| `historical-analysis`  | `apps/web/starter/project/src/components/financial-analysis.tsx` exports `FinancialAnalysis`; `apps/web/starter/project/src/lib/financial-results.ts` defines request/result validation.                                                                                                                | `cd80.finance.financialAnalysis("historical-analysis", input)` calls `finance.historical-analysis`; `apps/web/src/server/platform.ts` dispatches to `apps/web/src/server/historical-analysis.ts`, using `apps/web/src/server/tushare.ts`.                                  |
| `industry-research`    | The same protected `FinancialAnalysis` component and `financial-results.ts` schemas render annual totals, matched growth, sources, coverage and unavailable states.                                                                                                                                     | `cd80.finance.financialAnalysis("industry-research", input)` calls `finance.industry-research`; `apps/web/src/server/platform.ts` wraps the result from `apps/web/src/server/industry-research.ts`, using `apps/web/src/server/tushare.ts`.                                |
| `price-target`         | The same protected `FinancialAnalysis` component and `financial-results.ts` schemas render rating and target sections independently, with evidence and limitations.                                                                                                                                     | `cd80.finance.financialAnalysis("price-target", input)` calls `finance.price-target`; `apps/web/src/server/platform.ts` wraps the result from `apps/web/src/server/price-target.ts`, using `apps/web/src/server/tushare.ts`.                                               |

Shared integration points:

- `apps/web/starter/project/src/components/financial-app.tsx`: `FinancialModules` composes requested modules and company scopes; it does not enable the entire catalog by default. `CompanyDiscovery` defaults `enableWatchlist` to false; optional saving is outside the neutral financial operation.
- `apps/web/starter/project/src/lib/cd80.ts`: validated SDK calls to `window.cd80.call`, including `cd80.storage.read` and `cd80.storage.write`. `apps/web/src/server/preview-session.ts` supplies the nonce-bearing parent/preview bridge.
- `apps/web/src/server/company-universe.ts`: canonical supplied SSE records and source hash, parsed from `apps/web/src/server/data/sse-a-universe.csv` using `apps/web/src/lib/company-table.ts`. Preserve ticker strings and assigned size categories; do not invent thresholds or substitute market cap for revenue.
- `apps/web/src/lib/app-project-template.ts`: embedded starter snapshot. `apps/web/src/lib/financial-starter.ts` defines protected project files, approved permissions and pinned-release compatibility. Starter regeneration uses `bun run starter:sync`; it is not part of this documentation-only change.
- `apps/web/src/lib/contracts.ts` and `apps/web/src/server/build-policy.ts`: executable permission contracts, scoped build checks and version pinning. `apps/web/src/server/platform.ts` checks verified unchanged release hashes, manifest permissions and scoped records before dispatch.

### Persistence And Gates

Completed validated risk results use app-storage key `risk-profile`; explicitly saved completed normalized preferences use `industry-preference`. The optional starter saved-company list uses `discovery-watchlist` only when enabled. All persistence goes through permission-checked platform `storage.read` / `storage.write`, not direct `localStorage` or other browser persistence. Report a save only after its write succeeds. Partial questionnaire answers, preference drafts and active discovery sessions remain in memory; exit/refresh discards unfinished state.

This deliberately adapts the downloaded browser-storage instructions. App-scoped storage does not imply account privacy: shared demo mode is a shared workspace, not authenticated multi-user isolation. Tokens never belong in browser storage, app records or public `VITE_` variables.

Require an application-specific specification, exact-proposal server-recorded Workflow approval, per-turn capability/dependency/company/permission checks, server-key-protected writes and separate explicit Preview activation. Changed plan fields require new approval. Generated Node/Bash/SSR execution stays in the Linux Bubblewrap sandbox, using the Docker launcher on macOS without a host fallback. Catalog text and skills do not grant executable permissions.

## Implementation Versus Availability

### Recorded Live Evidence

[`docs/tushare-verification.md`](tushare-verification.md) records authenticated retrieval for representative company `600000.SH` at 2026-10-14T18:38:59Z through 18:39:00Z, corresponding to 2026-10-15 Asia/Shanghai. The recent inclusive window was 20260718-20261015; income used announcement dates 20211015-20261015 with report type 1.

| Endpoint     | Recorded transport status | Rows | Evidence boundary                                                                                                                                                           |
| ------------ | ------------------------- | ---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `daily`      | `available`               |   57 | Seven requested fields present/non-null. Representative raw daily retrieval, not an intraday or same-day-close guarantee.                                                   |
| `adj_factor` | `available`               |   57 | Three requested fields present/non-null. Representative factor retrieval, not complete five-year joins for every company.                                                   |
| `income`     | `available`               |   28 | Nine requested fields present/non-null. Includes quarterly/YTD observations and possible revisions, not 28 distinct annual statements or verified monetary comparability.   |
| `report_rc`  | `available`               |   59 | Nine requested fields present; `max_price` missing in 48 rows, `min_price` missing in 36, `quarter` missing in one. No verified brokerage rating mapping or target horizon. |

This verifies four-endpoint transport access at the recorded instant, not all downstream summaries, full-universe coverage, current credentials/permissions, live multipage research retrieval or every generated application flow. No new authenticated retrieval is asserted by this inventory. The shared transport uses Tushare only, server-side `settings()` configuration, HTTPS without redirects, a 15-minute cache, bounded requests/timeouts/retries and explicit missing-credential, permission, rate-limit, empty, partial and error states.

### Source Availability Limits

- **Historical analysis:** raw latest-close is not an intraday quote. Daily change uses documented provider `pre_close` when available; otherwise only immediately consecutive calendar-day observations establish the comparison. Unverified gaps produce an explicit unavailable reason, not a multi-session return labeled daily. The inclusive 52-week window is 364 calendar days ending on the latest quote date. Shorter coverage is partial; available-period extremes are never all-time. Adjusted drawdown requires valid ticker/date factor joins and one common reference: `adjusted_close_t = raw_close_t * factor_t / factor_reference`. Missing/invalid required factors leave drawdown null with a reason while supported raw metrics remain displayable. Optional financial statement visualizations require their own sourced annual observations.
- **Industry monetary evidence:** the documented `income` output field list does not establish currency or monetary units. The aggregation requires explicit observation metadata or trusted server-owned `IndustryMonetaryEvidence` containing `currency: "CNY"`, `unit: "yuan"` and a source reference. Missing evidence produces `unverified_currency_units`; a successful transport response does not authorize assuming CNY/yuan. The current platform dispatch supplies no monetary evidence configuration, so ordinary live industry aggregates remain unavailable/null by default until trusted evidence is configured. UI currency labels are not source verification.
- **Industry scope and budget:** all exact-industry peers remain the denominator, with no size filter, but each invocation is bounded to at most **40 companies and 80 shared-query calls**, concurrency 2 and a 30-second aggregate deadline. Publication windows and report types 1/4/5 consume multiple calls per company, so actual company coverage can be much lower. Shared transport retries have separate bounds. Preserve queried/unqueried counts, annual/cohort exclusions, partial/unavailable statuses and budget reasons; do not promise full-industry retrieval or durable background completion. Annual totals and matched-cohort growth remain separate, missing is not zero, and unresolved statement versions/publication dates are excluded. This is historical supplied-universe listed-company revenue, not national market size, demand/supply research or an industry forecast.
- **Brokerage evidence:** `apps/web/src/server/price-target.ts` validates server-owned `BrokerageEvidence`: source references, institution aliases, versioned brokerage-specific rating mappings and report-specific CNY/share-basis/horizon evidence. `emptyBrokerageEvidence` has empty sources, brokerages and targets; current platform dispatch supplies no replacement. Mapped ratings and comparable target summaries therefore remain unavailable by default, even when research transport succeeds. Generated requests cannot inject evidence or quotes; mapping cannot be guessed from translation, report age or `quarter`.
- **Brokerage aggregation:** preserve original opinions and exclusions. Counts are brokerages, not unique analysts. Select one latest distinct report per brokerage within the inclusive 90-day window; do not backfill an older target or arbitrarily order conflicting same-date opinions. The normalized summary is the unique modal category, positive ties are Mixed, and zero mapped opinions is unavailable. Each target needs two positive ordered bounds, compatible CNY per-share basis and verified horizon/reference evidence. Keep horizon groups separate; require at least three eligible brokerages per group for the equal-weight average of their range midpoints and a compatible dated raw close for implied percentage difference. Rating and target availability are independent; no local forecast or guaranteed return is implied.

## Catalog Boundaries

News retrieval and annual-report extraction/comparison are excluded from the supplied six-capability catalog. A retained legacy `news` business ID is unavailable for new retrieval and grants no permission. Financial metrics/peer medians, metric education, visualization, dashboard orchestration, result-storage provenance and grounded stored-data chat are skill/composition responsibilities, not additional reusable catalog IDs.

Removing former catalog entries neither automatically implements those features nor authorizes generated replacement algorithms. Requested dashboards may compose existing protected operations and permitted presentation; unsupported metrics or missing source/definition/benchmark evidence stay unavailable. Skills cannot create a news/report integration, unrestricted financial synthesis, personalized suitability, trading or monitoring capability. An optional app-owned watchlist is ordinary approved app behavior, not a hidden dependency of preference capture or discovery.

Relevant guidance is in `apps/web/src/server/protocols/builder.md` and `apps/web/src/server/protocols/financial-expert/skills/general-dashboard-generation.md`, with companion metric and database-grounded-chatbot skills. Consult the current JSON, executable contracts and prepared records for versions and authority rather than treating older prose or sample compositions as requirements.

## Verification Commands

Run from the repository root. The focused fixture commands below were observed passing during this inventory; they prove local contract/arithmetic/wiring behavior, not live financial completeness or end-to-end generated-app operation:

```bash
bun run test:risk-profile
bun run test:industry-preference
bun run test:historical-analysis
bun run test:industry-research
bun run test:price-target
bun run test:financial-capabilities-integration
```

Additional discovery, persistence, permission and static-browser checks are separate commands. Listing a command here is not a pass claim:

```bash
bun run test:company-universe
bun run test:company-discovery
bun run test:discovery-contract
bun run test:risk-profile-integration
bun run test:industry-preference-integration
bun run test:company-discovery-integration
bun run test:risk-questionnaire-ui
bun run test:industry-preference-ui
bun run test:company-discovery-ui
bun run test:financial-analysis-ui
bun run test:build-policy
bun run test:financial-starter
bun run test:tushare
```

The browser fixture suites render protected components with injected service results; they are not authenticated provider or generated SSR/build evidence. `docs/tushare-verification.md` separately records the transport fixture and live evidence. To reproduce read-only authenticated transport verification with existing server credentials, without printing tokens:

```bash
bun run verify:financial-data
```

Repository-wide, generated-app and release-flow verification remains separate. Use the Linux/Docker execution boundary for generated code; do not substitute host execution to bypass a slow build. The explicit 300-second flow startup limit is available for Docker startup and dependency installation:

```bash
bun run codegen
bun run check
bun run build
bun run test:prototype
CD80_FLOW_STARTUP_TIMEOUT_MS=300000 bun run test:flow
bun run test:model-contract
```

Final verification: capability unit tests, protected-component browser tests, permission/persistence integration tests, Convex codegen, production builds, prototype tests and local model-contract tests passed. Root formatting/lint/type checks passed after formatting generated declarations. The full flow suite remains unverified: the macOS Docker launcher reached dependency installation during its image build but did not start its server within the explicit 300-second startup deadline. No host-execution fallback was introduced. A Docker dependency-install startup timeout is not evidence that the financial contracts or full release flow passed or failed. Model-contract transport fixtures prove local wiring/enforcement, not live-model semantic correctness.
