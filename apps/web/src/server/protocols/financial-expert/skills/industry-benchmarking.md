# Industry Benchmarking

## When to Use

Use for industry-relative company analysis. Follow [agent.md](../agent.md). The handoff's benchmark procedure and priorities are proposed implementation rules, not universal finance cutoffs. Provider, classification level and minimum eligible count remain undecided.

## Procedure

1. Use one validated industry classification and resolve the selected company's narrow industry group. Do not infer membership from a shared keyword.
2. Include Mainland A-share companies in that group; exclude the selected company from its own benchmark. Keep individual peer names off the ordinary dashboard.
3. For each metric, retain only valid values using the same definition, accounting scope and reporting windows. Price-based metrics require a common accepted price date. Match currency/units wherever relevant.
4. Calculate the median of the eligible values: sort, take the middle value for an odd count, or average the two middle values for an even count. Use full precision before display rounding.
5. Show industry name, median, eligible count, dates and exclusions. Counts can differ by metric; do not reuse one denominator across all cards.
6. If the group is too small under the approved threshold or is unreliable, show unavailable with a reason. Do not silently broaden the group, invent a threshold, reuse another industry or use superseded values.

If classification or minimum-count policy is unapproved, flag the release blocker. Do not claim the benchmark passed an undefined eligibility policy.

## Original Investment Metrics

| Metric            | Benchmark priority                                  | Eligibility and additional context                                                                                                       |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| P/E               | Required for relative valuation assessment          | Positive valid trailing P/E only; own history, earnings quality, growth and risk                                                         |
| P/S               | Required for relative valuation assessment          | Matching trailing-sales basis, valid positive revenue; margins, growth and own history                                                   |
| Dividend yield    | Recommended supporting context                      | Matching trailing dividend basis; include verified zero payers, show payer share where supported; own history, payout, cash and specials |
| Revenue growth    | Required for industry-relative growth claims        | Matching reporting periods and valid bases; own YoY trend, profit, cash and acquisition effects                                          |
| ROE               | Required for industry-relative profitability claims | Matching method, scope and periods, valid equity; own history, debt and small-equity caveat                                              |
| Interest coverage | Recommended supporting context                      | Matching EBIT/gross-interest basis and sector suitability; own trend, below-1x condition and negative-EBIT warning                       |

"Required" means attempt a valid benchmark before calling a figure high/low/strong/weak relative to industry. It does not mean suppress a valid company figure when no benchmark can be produced.

## Added Annual-Report and Other Topics

- Gross margins, returns, growth and normalized liability/liquidity ratios may use industry context when definitions and business models match. Exact benchmark requirements for the added annual-report dashboard remain unapproved.
- Weighted-average ROE must not be pooled with the original TTM/simple-average-equity calculation. Source-specific methods require validation for comparability.
- Raw revenue, attributable profit, monetary funds, operating/free cash flow, inventory and receivables are not size-neutral quality benchmarks. Prioritize own history and obligations; normalized days/ratios require an approved common definition.
- Liabilities-to-assets is not debt-to-equity or debt-to-assets; match the exact numerator/denominator and sector context.
- Forecast-based ratios need consistent forecast source/date/horizon. Never invent forecast values to fill a peer set.
- Avoid treating materially different accounting methods or business models as equivalent, including financial and nonfinancial businesses.

## Unavailable or Misleading Comparisons

Keep a valid company result and explanation. Display "Industry comparison unavailable" plus the specific reason. Do not generate a benchmark, imply an official target, or label the result good/bad relative to industry without evidence.

Explain losses before a relative label involving negative benchmarks. An above-median value is not necessarily economically healthy. No tolerance for "similar to industry" has been agreed; do not invent one or use rounded equality as proof of similarity.

## Benchmark Evidence

Retain classification provider/version/level, industry identifier, universe and exclusion policy, accepted dates, each metric's definition, eligible/excluded counts and reasons, source references and calculation version. Internal peer evidence may support auditability without exposing competitor names on the dashboard.
