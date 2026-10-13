# Prototype implementation status

13 October 2026. Source: `platform/`, based on the selected web-starter commit `fde7b8351c8179adf47a5d30efb72313430a87ba`.

Live studio: [Chengdu80](https://chengdu80-web-live-ananthacharya-mb7epyiddt4jehqm.chengdu80-1610dcd1.workers.dev). The user deferred authentication; all visitors share apps and data. Local launch remains `bun run dev:local` at http://127.0.0.1:3001.

## Implemented and checked

- English request, editable specification, confirmation, preview, mandatory checks and acceptance.
- Portfolio valuation/concentration, fundamental screening and historical return/drawdown/fee comparison. These are provisional examples, not final product categories.
- Compatible source imports, source/specification inspection and exports, developer documentation, protocol instructions, schemas and financial API contracts.
- Shared per-app inputs, read-only previews, optimistic revisions, an accepted release retained during updates and data continuity after acceptance.
- Browser UI in an opaque-origin iframe with CSP restrictions. Custom calculations execute separately in workerd locally and Cloudflare Dynamic Workers when hosted; they receive no model/provider secrets or direct network capability.
- Live Convex development storage at `giddy-chicken-826`, with server-key protection in shared-demo mode. Tests rejected untrusted keys, another owner, duplicate creates and unauthenticated account queries.
- Live Worker Loader calculations for portfolio, screening, strategy and the fourth imported app. Current and preview sources execute independently. Hosted egress is denied; an infinite calculation returned `Worker exceeded CPU time limit.`, then a normal request succeeded. Configured CPU budget: 50 ms; observed request round trip: 2,960 ms, including transport.
- Source import, verification, acceptance, an update while retaining the current release, persistence across requests and input preservation all passed on the hosted product.
- Hosted portfolio UI rendered 112,260 CNY total value, 7,540.8 profit, 8.7% return and 38.21% concentration, with synthetic data labelled. Screenshot: `screenshots/hosted-portfolio.jpg`.
- Real Alpha Vantage history was tested locally and saved in Strategy: 252 daily rows for 600104.SHH, 2025-09-16 through 2026-10-12. The hosted copy retains that dataset. Hosted loading of the public demo is restricted; Tushare requires a licensed token and remains unverified.
- Gitee GLM-5.3 returned valid product specifications and explanations in local and hosted calls. A hosted explanation used server-recomputed saved inputs rather than a caller-supplied fake result.

## Verification evidence

| Check                                                              | Result                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Runtime, finance, storage and source hashes                        | 12 checks passed                                                         |
| Local HTTP release lifecycle                                       | 13 checks passed                                                         |
| GLM transport, response wrappers, format recovery and cancellation | 10 fixture checks passed; distinct from live inference                   |
| Query-stream hydration                                             | 2 regressions passed, covering empty and populated streams               |
| Optional OpenAI Responses transport                                | 3 fixture checks passed                                                  |
| Shared-demo transport/backend guards                               | 7 checks passed in the earlier implementation run                        |
| Convex deployment and codegen                                      | Passed against the development deployment                                |
| Hosted lifecycle and runtime                                       | 15 live checks passed                                                    |
| Formatting, lint and TypeScript                                    | Passed                                                                   |
| Production client/server build                                     | Passed, with a client chunk-size advisory                                |
| Browser                                                            | Earlier local import/update/mobile/CSP checks; hosted portfolio rendered |

Live hosted checks are in `platform/scripts/test-hosted.ts`. Machine-readable evidence is in ignored `platform/.local/hosted-evidence.json`. The script uses a dedicated synthetic verification app, `b9a0e591-da9b-4b26-8f4b-4aa64eb753d4`; it does not replace prepared examples. Numerical fixtures are in `platform/apps/web/src/lib/contracts.ts`.

A real hosted acceptance failure exposed Convex's object-key normalization: order-sensitive hashing rejected an unchanged stored preview. Canonical SHA-256 now preserves exact source strings and array order while normalizing object keys. A regression reproduced the failure before the fix, then passed. Fresh verification and acceptance passed remotely. Old pending previews are reverified rather than exempted from the acceptance gate.

## Remaining model gate

A full hosted source-generation request with maximum reasoning did not finish within its 660-second caller deadline. A separate non-streaming diagnostic ended with a socket reset. Low-reasoning hosted generation returned in 121 seconds but failed because Gitee wrapped JSON in a Markdown fence despite JSON mode; a direct SDK call reproduced that wrapper failure. The parser now accepts only a complete JSON fence and still rejects surrounding prose and schema violations, with regression checks. Source generation requests low reasoning with a 12,288-token budget and a 180-second per-call deadline, with transport cancellation and no automatic transport retry.

The next real build returned a schema-valid, self-contained model bundle in 210 seconds, including its one automatic repair. Ten of eleven checks passed; its numerical fixture failed because the generated code treated per-unit cost as the total position cost. Acceptance remained blocked. The protocol and exported contract now explicitly define cost and price per unit and invested cost as units multiplied by cost. A follow-up hosted repair hit another JSON response error; wrapper handling now also accepts compact closing fences while rejecting invalid JSON and outside prose.

A direct GLM SDK repair returned complete valid source in 93 seconds. That actual model-produced bundle was imported without manual source edits into the hosted app `0412cda9-afa0-4eaf-9b3e-4fdaa96ed38b`. All eleven checks passed, acceptance succeeded, and its Cloudflare calculation returned 500 total value, 20 profit, 5% return and 48% concentration. This proves source import of a real externally prepared model app, not just a deterministic fixture. Its accepted release has `origin: import`.

A normal edit through the built-in model builder then succeeded in 85 seconds, changed the main heading to `Portfolio Review Desk` and passed all eleven release checks. The accepted source and shared data remained available while the new preview was persisted. The model preview is deliberately left for review and acceptance in the studio; it has `origin: model`. No expected financial values were relaxed.

A fresh build from the clarified specification produced `GLM Fresh Portfolio` in 205 seconds including one automatic repair, app ID `47af8117-1a48-456d-88e3-6f609c3bc5c9`. Its math passed, but the invalid-input check exposed a runtime contract mismatch: the source returned `{error:string}`, while the wrapper only recognized thrown exceptions. The wrapper now treats both as failed calculations and limits error messages. This strengthens rejection and prevents invalid error results from being saved as successful input data. Runtime cache IDs include a version so updated trusted entry code cannot reuse old isolates. A regression failed before the fix and passed afterward.

Reverification on Cloudflare preserved the original model source, preview ID, hash and data. All eleven checks passed; the fixture returned total value 500, profit 20, return 5% and concentration 48%. Negative units returned HTTP 400. The fresh model preview remains ready for user review and acceptance. This proves one fresh generation and one built-in revision; it does not establish every possible request or all specification semantics.

The labelled sample builder creates working examples and records change requests; it does not implement arbitrary requested changes. Actual GLM source, a fresh build and a built-in revision now pass hosted checks. Native browser control became unresponsive after the portfolio test, so the model apps' rendered UI still needs manual review; no successful visual model-app test is claimed. The studio offers Re-run checks for an unchanged preview, preserving its source and origin. Wrong calculations and stale preview IDs still fail.

## Reported UI errors, 13 October

The reported screenshot showed malformed/incomplete model JSON, a query-stream `mutations` TypeError and a missing favicon. The model response body from that specific failure was not captured, so malformed syntax and truncation cannot be distinguished. A transport fixture reproduces the same rejection. GLM structured requests now allow one format recovery within the original 180-second deadline. Both responses must pass strict JSON parsing and schema validation; source still passes the existing release gate. Repeated malformed responses and surrounding prose remain rejected. This is a bounded recovery, not a guarantee of provider reliability.

The installed `@tanstack/router-ssr-query-core@1.169.1` client reader hydrated an undefined value before checking whether its stream had closed. The regression reproduced the reported error with an empty stream. A persisted Bun dependency patch checks closure before hydration in source and both published module formats. Empty and populated streams now pass. `/favicon.svg` is linked and served successfully.

The fixes deployed successfully. A comparison of all seven apps before and after deployment confirmed unchanged release IDs, revisions and data hashes. At that point GLM Portfolio Desk already had the model revision accepted by the user. All 15 hosted checks subsequently passed on the separate verification app, along with local runtime/lifecycle checks, model contract suites, codegen, lint/types and production build. A fresh real GLM source trial hit the 180-second deadline; successful live source generation after this fix is not claimed. Native browser inspection timed out, so no fresh browser-console verification is claimed.

## Deployment and credentials

The user supplied the Gitee, Convex and Cloudflare credentials and confirmed the Workers upgrade. The saved public Cloudflare account ID was corrected after API checks proved it did not match the account the token could access. Secrets were unchanged and never printed. The account token was verified with the account-scoped endpoint; the personal-token endpoint is not valid proof for this token type.

Alchemy deployed the state service, Secrets Store and complete application, including `APP_LOADER`. Optional Bun/Node platform peers are pinned to 4.0.2 to match Effect. Deployment from China used the existing HTTP proxy at port 3213 through process environment variables; system settings were unchanged. No GitLab integration or additional Cloudflare credentials are needed. Generated-app calculations use Dynamic Workers, app data and source use Convex, and Alchemy's Durable Object holds deployment state.

## Scope limits

Import supports self-contained HTML/CSS/browser JavaScript plus a pure calculation module, up to 250 KB; it does not build arbitrary npm/server frameworks. The explanatory plan is protocol-derived and feasibility checks are limited. Release fixtures establish tested protocol correctness, not every custom calculation or complete semantic specification compliance. Browser rendering is reviewed manually, outside the automatic release gate.

Monitoring, trading, teams, public sharing, multi-turn requirements interviews and authenticated account privacy are deferred. Final categories and the competition dataset are still open. The competition's Qwen development requirement is separate from the pre-competition GLM choice. Delivery of every proposal commitment is not claimed.

## Preserved examples

Local IDs: Portfolio `66e30f1b-98cc-4660-b5e4-59945bd3cc54`; screening `5425e545-4ba2-4527-a88e-06726f88c8fe`; Strategy `adbad0ae-75da-402d-8c2b-c4a9ab9c5c97`; imported app `908df993-ab89-4118-94ca-109934060044`. Hosted copies use `demo-` followed by the local ID. Local copies and their data were preserved. Seeding skips existing hosted apps. Original proposal files, photographs and the supplied HTML plan were not modified.
