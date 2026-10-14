# Investment Dashboard Metrics

## When to Use

Use for the original investment dashboard's six company-share metrics. Follow [agent.md](../agent.md) for evidence, freshness, approved-answer boundaries and display rules. Calculation conventions below are proposed handoff methods requiring source validation.

This dashboard is separate from the added annual-report company dashboard. Do not replace these metrics with that dashboard's six metrics.

## Menu and Selection

| Group                | Selectable metrics       | Default             |
| -------------------- | ------------------------ | ------------------- |
| Valuation            | P/E, P/S, dividend yield | P/E, dividend yield |
| Business performance | Revenue growth, ROE      | ROE                 |
| Financial health     | Interest coverage        | Interest coverage   |

- No selection: show P/E, dividend yield, ROE and interest coverage.
- An explicit selection replaces defaults; show exactly the selected metrics in their groups.
- Reset to default restores the four default metrics. Treat an empty confirmed selection as defaults unless a separate empty-dashboard option is approved.
- If a selected metric is unavailable, retain its card with the reason. Do not substitute another metric or an old value.
- Other financial topics remain outside this selector. Supporting chart/headline components do not add financial cards.
- Prepare all permitted chatbot topics independently of the selected cards.

## P/E

- Formula: latest accepted share price / EPS for the latest four reported quarters. Use trailing, not forecast, earnings.
- Inputs: company code, price/date, trailing EPS and reporting dates. Validate provider P/E TTM definition and dates before reuse.
- Match share bases. Do not combine total company market value with A-share EPS.
- Approved basic explanation: "P/E shows how much investors pay for each unit of the company's annual earnings."
- Approved practical-impact wording: "A lower P/E than the industry benchmark means a lower price relative to earnings. It can also reflect weaker growth expectations or greater risk. Check growth, profitability and cash generation before interpreting the difference."
- Interpretation: above/below a valid industry median, with "context needed". Higher can reflect growth expectations not yet achieved. Lower is not automatically good.
- Unavailable: zero/negative trailing earnings: "P/E is not meaningful because trailing earnings are zero or negative." Missing earnings or unresolved conflicts also prevent calculation.
- Benchmark: required before relative valuation assessment; exclude nonpositive/invalid trailing P/E. Prepare own valuation history, earnings quality, growth and risk.

## P/S

- Formula: company market value on the accepted price date / revenue for the latest four reported quarters.
- Inputs: market value/date, trailing revenue and reporting dates. Match currency/units and validate total market value across multiple share classes.
- Approved basic explanation: "P/S shows how much investors pay for each unit of the company's annual sales."
- Approved practical-impact wording: "A lower P/S than the industry benchmark means a lower price relative to sales. Sales do not necessarily produce profit. Check operating margins and profitability alongside this figure."
- Interpretation: above/below industry with context needed, not automatically good/bad. P/S may give context during losses but cannot establish investment value alone.
- Unavailable: zero, negative, missing or unreliable trailing revenue; exclude invalid benchmark values.
- Benchmark: required for relative valuation assessment, with the same trailing basis. Prepare margins, growth and own history.

## Dividend Yield

- Formula: gross cash dividends per share with ex-dividend dates in the last 12 months / latest accepted share price * 100. Label "trailing dividend yield".
- Inputs: complete dividend records, ex-dividend dates, per-share amounts, corporate actions and accepted price/date. Adjust historical per-share dividends to the current share basis after splits or similar actions.
- Use gross dividends before personal tax. Identify special dividends separately where supported.
- Approved basic explanation: "Dividend yield shows the cash dividends paid over the last year relative to today's share price."
- Approved practical-impact wording: "A higher yield means more past dividend income relative to the current price. It does not promise future income. A falling share price can raise the yield, and the company may change or stop dividends."
- Date qualification: the proposed calculation uses ex-dividend dates, which can differ from payment dates. Preserve the handoff wording above as supplied, but disclose the ex-dividend basis and do not claim an included dividend has already been paid without evidence. Align the explanation with that basis during explanation-library review before release.
- Unavailable: incomplete/missing dividend records. Show 0% only when complete records establish no cash dividend in the window. Do not substitute an announced future dividend.
- Benchmark: recommended supporting context; use the same trailing basis, include verified zero-dividend companies and show share of dividend payers where supported.
- Prepare dividend history, payout, cash support and specials. Yield alone does not establish dividend safety.

## Revenue Growth

- Formula: (current reported revenue - matching prior-year revenue) / prior-year revenue * 100.
- Use the latest comparable published period; label quarter, half-year, nine months or full year. Match cumulative periods; never compare nine-month revenue with one quarter.
- Inputs: current/prior revenue, period dates and disclosure dates.
- Approved basic explanation: "Revenue growth shows how much the company's sales increased or decreased compared with the same period a year earlier."
- Approved practical-impact wording: "Growth above the industry benchmark generally suggests faster sales expansion. It is more useful when profit and cash generation also improve. Acquisitions and one-off changes can affect the result."
- Interpretation: above industry means stronger sales growth on this measure; below means slower growth, not overall company quality or an investment decision.
- Unavailable: nonpositive prior-year revenue, mismatched periods or unreliable data. Do not generate a normal percentage-growth label from a nonpositive base.
- Benchmark: required for industry-relative growth claims, with matching windows. Prepare own YoY history, profit, cash and supported acquisition effects.

## ROE: Investment Dashboard Method

- Proposed formula: TTM net profit attributable to ordinary shareholders / average attributable equity at the beginning and end of that 12-month period * 100.
- Inputs: four quarters of attributable profit and equity at both boundary dates; match accounting scope.
- This is not the added annual-report dashboard's reported weighted-average ROE. Do not mix the methods across companies, years or a benchmark. A validated alternative must be labeled and used consistently.
- Approved basic explanation: "ROE shows how much profit the company generates relative to shareholders' accounting investment in the business."
- Approved practical-impact wording: "ROE above the industry benchmark generally suggests stronger profitability relative to equity. Heavy borrowing or unusually small equity can also raise ROE. Check debt and the stability of profits."
- Interpretation: higher relative profitability on this measure, qualified for leverage/small equity. Negative profit with valid positive equity gives negative ROE and indicates a loss.
- Unavailable: either equity boundary or average equity zero/negative, missing boundary data or unresolved financial records. Do not give the usual ROE interpretation with invalid equity.
- Benchmark: required for industry-relative profitability claims; match definitions/windows. Prepare own history, debt and small-equity context.

## Interest Coverage

- Formula: TTM EBIT / gross interest expense for the same period. Display in `x`.
- Inputs: documented EBIT or a validated derivation, gross interest expense and dates. Net finance expense is not a substitute for gross interest expense.
- Approved basic explanation: "Interest coverage shows how comfortably the company's earnings cover the interest cost of its borrowing."
- Approved practical-impact wording: "Higher coverage generally gives the company more room to pay interest. Coverage below 1x means earnings before interest and tax were lower than interest expense. This indicates pressure on this measure, but does not by itself establish inability to pay."
- Interpretation: show own trend and the 1x condition. Negative EBIT with positive interest expense requires a warning, not a routine cushion interpretation.
- Unavailable: zero interest expense: "No interest expense reported; coverage cannot be calculated." Never show infinity. Negative, missing or inconsistent expense prevents calculation.
- Banks/insurers: not applicable unless a sector-specific method is approved.
- Benchmark: recommended supporting context. Above/below generally describes a larger/smaller earnings cushion, but the industry's weakness does not remove a below-1x warning.

## Assembly Checks

Resolve identity, validate accepted inputs, request data-service calculations, attempt required/recommended benchmarks, then attach value, explanation, specific implication, caveat and evidence to every selected card. Missing benchmarks do not remove valid company figures or authorize unsupported relative labels.
