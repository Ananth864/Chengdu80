# Annual-Report Company Metrics

## When to Use

Use for the added company-level annual-report dashboard. Follow [agent.md](../agent.md). This scope is separate from the [original investment dashboard](investment-dashboard-metrics.md).

The six metrics are confirmed. Defaults, selection behaviour, monetary display precision and specific annual-report source conventions are not yet approved. Do not borrow the original dashboard's defaults. Formulas below other than the user-specified liabilities-to-assets ratio are proposed implementation definitions or source requirements, not newly approved product decisions.

## Common Rules

- Use the selected annual report and its explicitly identified fiscal year, release date and revision. Do not silently mix full-year, interim, TTM, parent-only and consolidated figures.
- Prefer consistently scoped consolidated company figures when supported, but confirm the intended accounting scope before release.
- Revenue/profit are full-year flows; cash/assets/liabilities are reporting-date balances. Label the distinction.
- Preserve report currency and scale, or use a documented conversion consistently. Do not assume RMB for every report.
- A missing figure is unavailable, not zero. Retain its card and explain the missing field or conflict.
- Monetary amounts are meaningful company figures, not size-neutral cross-company rankings. Use own history and obligations for cash context, not raw industry cash medians.
- Each card needs a definition, value/date/unit, practical implication, qualifications and traceable source/page or table reference. Metric-specific industry requirements for this added dashboard remain unresolved.

## Revenue

- Definition: reported annual revenue under an identified accounting scope. Confirm the selected revenue line before implementation; do not substitute other income, cash receipts or orders.
- Inputs: annual revenue, fiscal-year dates, scope, currency, units and report reference.
- Explanation draft requiring review: Revenue measures sales or operating income recognized under the report's accounting rules; it is not necessarily cash collected or profit.
- Context: own comparable history; use the comparison skill for approved YoY growth. Acquisitions, scope changes and accounting changes need disclosed qualifications.
- Unavailable: missing/ambiguous revenue line, inconsistent units/scope or unresolved revisions. A verified zero or loss elsewhere does not imply revenue is missing.

## Gross Profit Margin

- Proposed formula: (revenue - corresponding cost of sales) / revenue * 100, or an explicitly disclosed margin validated to the same definition.
- Inputs: matching revenue/cost scope and period, or disclosed margin with its definition. Do not combine company-wide revenue with segment-only costs.
- Explanation draft requiring review: Gross margin is the share of revenue remaining after the corresponding direct cost of sales, before other expenses.
- Negative margin with positive revenue indicates a gross loss; margin increases do not establish higher net profit or cash generation.
- Unavailable: nonpositive revenue, absent/mismatched cost data or an unsuitable business model. Do not apply a generic industrial-company margin to banks/insurers without an approved method.
- Industry/own-history comparison is useful only with matching definitions. Segment margins belong in the separate segment skill.

## Weighted-Average Return on Equity

- Use the report's disclosed weighted-average ROE or a validated source with the same documented definition. Retain method, profit scope, period and source.
- Confirm whether the selected figure uses attributable net profit or a version excluding nonrecurring items. Do not silently interchange them.
- Do not derive this by dividing profit by simple beginning/end average equity. That is a different method used in the original investment-dashboard proposal.
- Explanation draft requiring review: Weighted-average ROE relates the reported profit measure to equity weighted over the reporting period under the disclosed method.
- Context: own history and method-matched peers, with leverage, small equity and one-off profit qualifications. Negative profit and invalid equity require explicit explanation.
- Unavailable: no verified reported figure, unresolved profit scope or incomparable definitions. Do not replace a missing reported figure with a derived estimate. Nonpositive equity prevents the usual profitability interpretation; retain any reported figure only with a clear source qualification, not a normal high/low assessment.

## Cash and Monetary Funds

- Use the annual report's defined cash and monetary funds balance at year-end. Retain the underlying line and note definitions.
- Do not silently replace monetary funds with cash and cash equivalents; their accounting coverage can differ.
- Identify restricted funds and the nature of restrictions where disclosed. Store amount/date/source separately from the total.
- If restrictions are not disclosed, state "Restricted-fund information not disclosed or not verified"; do not assume none exist.
- Do not label total monetary funds as freely available cash. Do not calculate an unrestricted balance unless all required restrictions and their scope are verified.
- Explanation draft requiring review: Monetary funds show a reported balance of cash-related resources; restrictions may limit their use to meet obligations.
- Compare own history and disclosed debt/commitments, not raw cash totals across differently sized companies.
- Unavailable: missing total or unresolved classification/conflict. Missing restriction detail need not suppress a valid total, but must remain visible as a limitation.

## Net Profit Attributable to Shareholders

- Use the explicitly reported annual profit attributable to the specified shareholder group; confirm whether this means shareholders of the parent/ordinary shareholders for the source in use.
- Do not substitute total consolidated profit including noncontrolling interests, adjusted profit or profit excluding nonrecurring items without approval and clear labeling.
- Explanation draft requiring review: Attributable net profit is the year's accounting profit allocated to the specified shareholders, rather than cash generated.
- Negative attributable profit indicates a loss at this scope. Qualify supported one-offs and distinguish earnings from cash.
- Unavailable: missing attribution breakdown, ambiguous scope or unresolved records.
- Own history is primary; raw profit size is not a size-neutral quality comparison.

## Liabilities-to-Assets Ratio

- Confirmed formula: total liabilities / total assets * 100.
- Inputs: total liabilities and total assets at the same reporting date, with identical scope, currency and units.
- This is not borrowings-to-assets or debt-to-equity. Do not substitute interest-bearing debt for total liabilities.
- Explanation draft requiring review: The ratio shows the proportion of reported assets represented by liabilities; it is not a direct measure of cash available for repayment.
- Higher generally indicates more liabilities relative to assets, not automatically worse quality or inability to pay. Consider liability composition, maturity, asset quality and sector.
- Unavailable: zero/negative total assets, negative or unreliable total liabilities, scope mismatch or unresolved records. A verified zero liability balance can produce 0%.
- A ratio above 100% can be valid with negative equity; flag that context rather than clamping the value.
