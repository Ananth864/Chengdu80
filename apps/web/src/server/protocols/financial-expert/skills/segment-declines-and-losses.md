# Segment Declines and Losses

## When to Use

Use for the annual-report dashboard's "Declines and losses" area. Follow [agent.md](../agent.md) and the [annual-report metric definitions](annual-report-company-metrics.md).

## Required Numerical Flags

| Flag                                               | Trigger                                                                    | Numerical evidence                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Business category/segment revenue decreased YoY    | Comparable current revenue < prior-year revenue                            | Both revenues and absolute change; percentage growth only with a valid positive base |
| Business category/segment gross margin decreased   | Comparable current gross margin < prior-year margin                        | Both margins and their difference, proposed in percentage points                     |
| Business category/segment gross margin is negative | Valid current gross margin < 0%                                            | Current margin and supporting revenue/cost or explicit margin disclosure             |
| Business category/segment net profit is negative   | Report explicitly discloses that category/segment net profit and it is < 0 | Disclosed net profit, period, units and source                                       |

Equality does not trigger a decline. Zero margin is not a gross loss. Zero net profit is not a net loss. Use full-precision validated values; if only rounded disclosures exist, do not invent precision or claim a change the disclosures cannot establish.

## Procedure

1. Identify whether the disclosure groups revenue by business category, operating segment, product or another dimension. Preserve its label and avoid combining overlapping dimensions as independent totals.
2. Match current/prior disclosures by actual business scope, not name alone. Confirm annual periods, currency, units, accounting definitions and consolidation basis.
3. Check renaming, reorganization, acquisitions and restated comparatives. Use a validated same-basis comparative if available. If not comparable, mark the decline check unavailable; do not infer a decline from unmatched segments.
4. Request the validated data-service differences/flags and retain the source rows and definitions.
5. Display each flag's evidence, period and qualification. State whether the flag is triggered, not triggered on verified data, unavailable, or genuinely not applicable.

Missing disclosure means unavailable/not disclosed, never "no decline" or "no loss". Reserve not applicable for an actually inapplicable measure. A verified non-trigger is not an endorsement of segment quality.

## Calculation and Disclosure Limits

- Revenue percentage growth: (current - prior) / prior * 100 only with positive prior revenue. A comparable absolute decline can still be identified without a valid percentage-growth label.
- Gross margin: use an explicitly disclosed margin or validated matching revenue/cost calculation with positive revenue. Do not infer gross margin from net profit.
- Negative gross margin indicates a gross loss, not necessarily a disclosed segment net loss.
- Net-profit flag: never derive segment net profit by allocating company overhead, interest or tax; never substitute segment operating profit, EBITDA or company-level profit for explicitly disclosed segment net profit.
- Decreased positive margin and negative margin can both trigger for one segment. Do not suppress one or count them as independent segments.
- The percentage-point display and segment-change policy require approval; keep units explicit and never label a margin difference as revenue growth.

## Output Evidence

For each flag retain segment label/dimension, current/prior period where needed, figures, unit, calculation version, comparability status, report/page/table references and missing-data reason. Avoid causal claims unless prepared evidence supports them; attribute management explanations.
