# FinMatch Documented Capabilities

## Confirmed Company-Size Rule

`CAP-003@0.3.0` implements the product owner's explicit rule: high risk maps to
small company size, medium to medium, and low to large. Its built-in policy is
`finmatch-risk-company-size@1.0.0`; it does not require a supplied industry policy.
Optional industry preferences are preserved independently. Numeric market-cap
thresholds and actual company classification/selection remain unspecified.
The earlier `CAP-003@0.2.0` industry contract below remains pinned and unchanged.

The five Markdown resources are implemented as three registered capabilities and
one application-interaction helper. The risk scoring and risk IO documents define
one capability, not two competing scoring implementations. The product-decision
document defines interaction rules, not investment selection or ranking logic.

## Registered Implementations

| Pin             | Implementation                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `CAP-001@0.2.0` | Six exact industry identifiers, ordered deduplication, selected or balanced coverage, no inferred preferences or company selection.       |
| `CAP-002@0.2.0` | Seven required integer answers, exact question/choice copy, sum 7-21, low 7-11, medium 12-16, high 17-21.                                 |
| `CAP-003@0.2.0` | Validated risk handoff, explicit versioned policy, ordered mapping, optional independent preference comparison, stable structured errors. |

All are **unverified** developer-draft implementations. Determinism and passing
tests do not establish financial suitability or independent verification. The
earlier nine arbitrary mock implementations remain pinned to their original IDs
and versions; existing applications are not silently migrated.

`packages/capabilities/src/finmatch.ts` contains typed contracts, exact questionnaire
copy, immutable registry metadata, pure scoring/normalization/mapping functions,
and safe test examples. No handler calls an LLM, API, clock, database, or random
number generator. Complete submitted answers are returned internally by scoring;
there is no timestamp or explanation. Partial submissions fail without persistence.

Mapping does not invent a sector-risk relationship. Missing/null policy returns
`mapping_not_configured` with no industries. Inapplicable policies and malformed
inputs return the documented non-success statuses. Policy identity/version and
structural validity do not prove approval. No approved policy is provided here.

CAP-003 owns structured validation errors through bounded JSON request contracts.
Explicit directional contract relationships let strict CAP-001/CAP-002 outputs
compose with these request ports, without structural guessing or weakening the
upstream producer contracts. The risk input remains a required plan binding;
policy and preference bindings may be omitted.

## Planner And Preview

The planner receives registered executable ports, JSON schemas, constraints,
source references, and questionnaire copy. It is instructed to prefer these
documented implementations for matching FinMatch requirements rather than the
older nine-answer risk mock. Unsupported company selection, ranking, metrics API,
and product-policy requirements remain gaps.

Compiled TypeScript delegates to the same schema-checked registry runner used by
preview RPC. The preview renders all seven single-select questions with exact
labels, requires completion before execution, provides the six multiple-select
industry choices, and clears transient controls on exit/reload. No partial answers
are written to application data.

CAP-002's scoring output remains available to trusted downstream composition, but
browser-facing RPC strips the private output port, aliases, nested scores, buckets,
and answer payloads. This is presentation suppression, not secrecy of the scoring
method or a claim of tenant isolation. Operator source review still exposes the
documented rules and synthetic test fixtures. Production gates continue to reject
all three unverified capabilities.

## Recommendation Round Helper

`packages/capabilities/src/finmatch-round.ts` implements reproducible, seeded
shuffling, one forward-only round, stocks-only options, an empty-pool notice,
and Yes-only save events with caller-supplied timestamps plus recommendation
references/snapshots and versions where supplied. No/partial progress is not a
persistence event. There is no undo operation.

Integration decisions are explicit: the caller supplies at most five already
selected options, a seed, and non-null bounded opaque metrics from Application 1.
Larger pools are rejected instead of inventing selection rules. The helper never
fetches metrics, infers freshness, ranks investments, or persists anything. Actual
card rendering and storage-adapter wiring remain application integration work.

## Source Fidelity

`capability-resources/capability-library.json` originally contained three adjacent
JSON objects. It is normalized into one valid version-0.2 catalog without changing
the source Markdown. Its short questionnaire output list is reconciled with the
more detailed authoritative IO contract: complete answers and total score remain
internal output fields alongside questionnaire version and bucket.

`scripts/test-capability-resources.ts` checks catalog/source links, exact seven
questions and 21 choices, canonical industries, documented boundary scores, and
no-policy behavior. Changing documentation requires deliberate code/version and
test updates, not runtime LLM regeneration of financial logic.

## Verification

`bun run test:capabilities` includes pure contracts and all 2,187 questionnaire
combinations, mapping failures/composition, seeded rounds, source-drift checks,
TypeScript compilation, mock lifecycle guards, agent routing, and FinMatch browser
and RPC checks. Browser tests need Playwright Chromium or an explicitly configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Before production use: supply a product-approved mapping policy, resolve the
Application 1 endpoint/metric/freshness contract and company eligibility rules,
complete questionnaire localization/psychometric/legal review, and independently
verify implementations. No investment recommendations or production deployment
are created by this change.
