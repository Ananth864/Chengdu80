# Tushare Transport Verification

## Scope

Only the server adapter and its standalone test/verification scripts are implemented here. The three families are historical prices (daily plus adjustment factors), financial statements (income), and brokerage research (report_rc). This is not verification of downstream financial metrics, company-universe membership, rating mappings, statement-version selection, or target horizons.

Read constraints: `~/Downloads/capabilities/historical-analysis-capability.md`, `market-research-capability.md`, and `price-target-capability.md`, plus root `AGENTS.md`.

## Official Evidence

Official pages fetched during implementation on 2026-10-15:

| Evidence                                                            | Verified semantics                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [HTTP protocol](https://tushare.pro/document/1?doc_id=130)          | POST JSON `api_name`, `token`, `params`, comma-separated `fields`; response `code`, `msg`, `data.fields`, `data.items`. Documentation identifies code 2002 as a permission issue; adapter also recognizes -2002 and classifies rate-limit messages before generic permission codes. Documentation's HTTP example is not used: transport is fixed HTTPS only.                                                                                                                                                                                                                             |
| [Daily](https://tushare.pro/document/2?doc_id=27)                   | Unadjusted A-share daily OHLC; no suspended-session observations; maximum 6000 rows/request. Date windows are documented, not offset pagination. `pre_close` is an ex-right reference, and provider `pct_chg` uses it; it is not necessarily the previous observed raw closing price. Volume is lots, amount is thousands of Yuan.                                                                                                                                                                                                                                                       |
| [Adjustment factors](https://tushare.pro/document/2?doc_id=28)      | `ts_code`, `trade_date`, `adj_factor`; dated single-company range; 2000-point permission threshold, higher-frequency access at 5000+. This page does not specify a row cap; 6000 is a conservative adapter saturation guard.                                                                                                                                                                                                                                                                                                                                                             |
| [Adjusted-price formula](https://tushare.pro/document/2?doc_id=146) | Explicit multiplicative forward-adjustment formula: daily close times daily factor divided by latest factor. Backward adjustment multiplies by daily factor. Reference is the requested end-date factor; documentation describes dividend reinvestment. Consumers must join valid positive factors to every required ticker/date and use one common observed reference date: `adjusted_close_t = raw_close_t * factor_t / factor_reference`. Never fill missing factors or calculate adjusted drawdown from raw prices.                                                                  |
| [Income](https://tushare.pro/document/2?doc_id=33)                  | Single-company endpoint, 2000-point threshold; `total_revenue`, `n_income` (including minority interests), `n_income_attr_p` (parent-attributable), `ann_date`, `f_ann_date` (actual publication date), `end_date` (financial period), `report_type`, `update_flag`. Query `start_date`/`end_date` bound announcement dates, not financial years. Type 1 = latest consolidated (default); 4 = adjusted consolidated prior-year comparable published this year; 5 = retained pre-adjustment consolidated version. Types 2/3 are single-quarter and 6+ parent scopes, not interchangeable. |
| [Research](https://tushare.pro/document/2?doc_id=292)               | Maximum 3000 rows, pagination/looping explicitly supported. Fields include `org_name`, `author_name`, `report_date`, `report_title`, `quarter`, `rating`, `max_price`, `min_price`. Trial: 2000 points, 10 requests/day; formal: 8000 points, 100000/day; 10000+ no total limit. Forecast operating revenue/profits are ten-thousand Yuan, EPS Yuan. `quarter` is a financial forecast period, NOT a target horizon. `create_time` is provider update time, not a verified report publication timestamp.                                                                                 |

The research endpoint page permits pagination but does not enumerate `offset`/`limit` in its input table. The implementation uses server-side `params.offset`/`params.limit`, not post-download slicing. Saturation/cycle fixtures validate the wiring, not live multi-page provider behavior.

Income monetary amounts are retained in source Yuan with no multiplication or division; EPS fields are per-share, not statement totals. The current income page does not explicitly label monetary units/currency in its output table. Therefore its field list alone is not sufficient evidence of CNY comparability: consumers must verify currency and units against the originating company statements before aggregating. No unit/currency is fabricated in the transport result.

## Transport Contract

Exports: `TushareRow`, `TushareResult`, `TushareQuery`, `createTushareQuery`, `queryTushare`. The factory accepts optional `token`, `fetch`, `now`, `signal`. The singleton reads `TUSHARE_TOKEN` through `settings()` on every query, so credential rotation changes cache identity without restarting. No secret values, provider messages, exceptions, raw responses, or raw records are logged by the adapter or verification script.

Requests require one six-digit `.SH` ticker and valid bounded dates. This is syntax validation only; callers must first validate the actual SSE A-share identity against the supplied universe. Daily/factor and income announcement windows cannot exceed five calendar years. Research windows cannot exceed 90 calendar days inclusive. Income defaults to `report_type=1`; explicit types 4/5 are allowed for documented revision-aware callers. Annual consumers must select completed December financial periods and enforce publication cutoffs using `f_ann_date`, with an explicit policy for missing publication dates and unresolved versions.

Daily windows for one company over at most five years yield roughly 1250 sessions, safely below 6000. Income uses a conservative 100-row saturation guard over a single-company five-year announcement range, not undocumented offset pagination. A cap returns `partial`; callers must narrow date windows rather than assume completeness. Research requests use limit 3000 and offsets 0, 3000, ... until a short page, with at most 20 HTTP attempts including retries. Exact repeated rows are deduplicated only for research transport cycle protection; forecast-quarter/report/brokerage semantic deduplication belongs to consumers. A no-progress page, cap, changing fields, budget exhaustion, or later-page failure cannot return complete data.

Timeouts: 10 seconds per HTTP attempt including JSON decode, 30 seconds per query, caller cancellation propagated. Redirects use `redirect: error`; there is no HTTP downgrade or fallback provider. One immediate read-only retry is permitted for HTTP 502/503/504 within the same budget; no automatic retries for permission errors, throttling, malformed payloads, or ambiguous network errors.

Cache: 15 minutes from completed retrieval, factory-local bounded map of 64 entries, at most 10000 rows per cached result. Keys include SHA-256 token digest, endpoint, sorted parameters, and requested fields. Expired entries are pruned, results cloned on insertion/retrieval. Only complete available/empty results are cached. Raw credentials are never cache keys or persisted. Factories do not share cached data.

Payloads require nonempty unique field identifiers and exactly matching row widths; cells must be strings, finite numbers, or null. Nulls, zeros, and strings are preserved without coercion. Missing requested fields return `partial`, even on an empty page; malformed tables return `error`, never `no_results`. `available` means transport success, not valid metric inputs or current/live-market availability. Callers still validate required cells, ticker/date joins, numeric domains, actual coverage, annual scope, publication cutoffs, and licensing.

Status vocabulary: `available`, `partial`, `no_results`, `missing_credentials`, `permission_denied`, `rate_limited`, `error`. Limitations are fixed safe reason codes; partial-page failures retain prior validated rows. Provider messages are inspected solely to classify errors and never echoed.

## Reproduction

```bash
bun scripts/test-tushare.ts
bun scripts/verify-financial-data.ts
bun run check
```

The live read-only script uses existing `configuredEnvironment()` precedence, one representative SSE ticker `600000.SH`, the 90-day inclusive window ending at the current Asia/Shanghai as-of date, and up to five years of income announcement dates with type 1. Only these three families are queried. It prints timestamps, statuses, row counts, requested-field presence/non-null/null counts, and sanitized limitations, never raw records or credential names/values. Requests are sequential, bounded per endpoint. Empty results are source-unavailable-for-window, not permission evidence; latest calendar dates may be weekends, holidays, unpublished periods, or precede the provider's scheduled update. It does not request a live intraday quote.

## Recorded Results

Live read-only run started at **2026-10-14T18:38:59.152Z**, corresponding to **2026-10-15 Asia/Shanghai**. As-of date: 2026-10-15. Representative company: `600000.SH`. Recent inclusive window: 20260718 through 20261015. Income announcement window: 20211015 through 20261015, `report_type=1`.

| Endpoint   | Status    | Rows | Retrieved at (UTC)       | Requested-field completeness                                                                                                                  |
| ---------- | --------- | ---: | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| daily      | available |   57 | 2026-10-14T18:38:59.679Z | All 7 fields present and non-null in all 57 rows                                                                                              |
| adj_factor | available |   57 | 2026-10-14T18:38:59.780Z | All 3 fields present and non-null in all 57 rows                                                                                              |
| income     | available |   28 | 2026-10-14T18:38:59.891Z | All 9 fields present and non-null in all 28 rows                                                                                              |
| report_rc  | available |   59 | 2026-10-14T18:39:00.005Z | All 9 fields present; 6 fields non-null in all rows; quarter 58 non-null/1 null; max_price 11 non-null/48 null; min_price 23 non-null/36 null |

All returned transport limitations were empty. This verifies account access and representative field population at that instant, not every SSE company or complete calendar-day coverage. The run occurred before that Shanghai day's market close; no claim of a same-day quote is made. Income rows include quarterly/YTD observations and possible revisions, not 28 distinct annual statements. Research target bounds have substantial missingness; no target-horizon evidence or brokerage-specific rating mapping was verified. Live research results fit one page, so live multi-page behavior remains unverified.

`bun scripts/test-tushare.ts`: passed all 9 fixture groups, including an actual 10-second stalled-fetch timeout, cache rotation/expiry/eviction, malformed/empty distinctions, null preservation, sanitized errors, request-field forwarding, pagination cycles and 20-request saturation. Fixtures are not financial observations.

Initial `bun run check` stopped at formatting, listing these new files plus unrelated concurrent files. Only the four owned files are formatted here. Codegen is intentionally not run as explicitly requested; no generated files are edited.

After formatting the owned files, `bun run check` remains blocked by formatting in `packages/backend/convex/_generated/api.d.ts` and `packages/backend/convex/_generated/dataModel.d.ts`, outside this task's ownership. Targeted lint/type checking is run separately for the three owned TypeScript files.

Final verification: all 9 fixture groups pass again; `bunx vp lint apps/web/src/server/tushare.ts scripts/test-tushare.ts scripts/verify-financial-data.ts` passes (repository type-aware/type-check lint configuration), and targeted `vp fmt --check` passes for all four owned files. The final full `bun run check` attempt instead reports formatting in concurrently edited `apps/web/src/server/industry-research.ts`; no out-of-scope file is changed to resolve it.

## Failure Cache Regression Review

Follow-up verification uses injected fetch fixtures only, with no provider calls or codegen. The adapter already caches only completed successful/empty results, so no production change was needed. The suite now passes 10 fixture groups.

Same-key, same-token, unchanged-clock failure-then-success tests cover permission denial, throttling, HTTP failures (including exhausted transient retry), rejected requests, malformed payload/table/JSON, thrown transport errors, missing requested fields, and timeout. Research cycle detection, 20-attempt saturation, later-page permission failure, and changed page fields each retain partial rows, then restart at offset zero on the same-key retry. Daily, adjustment-factor, and income row caps also retry successfully. Every recovery asserts fresh rows and empty limitations; a third identical query asserts no additional fetch, proving that recovery success is cached while the preceding failure/partial is not.

Security fixtures assert exact safe failure envelopes and absence of the injected credential even when echoed in provider messages, error data, malformed cells, HTTP bodies/status text, invalid JSON, or thrown errors. String-valued provider codes (including `"0"`, `"-2002"`, and a credential-valued code) are malformed payloads, not coerced successes or echoed errors. Timeout exceptions carrying the credential are also sanitized.

Follow-up `bun scripts/test-tushare.ts` and targeted type-aware lint pass. Full `bun run check` remains blocked by out-of-scope formatting in `apps/web/starter/project/src/lib/cd80.ts`, `packages/backend/convex/_generated/api.d.ts`, and `packages/backend/convex/_generated/dataModel.d.ts`. The previously recorded four-endpoint live verification remains unchanged and was not rerun.
