# General Dashboard Generation

## When to Use

Use to generate, compose or update the general financial dashboard layout and its configured sections. Follow [agent.md](../agent.md) for product boundaries, evidence, freshness, interpretation and bilingual parity. This skill governs presentation and composition, not financial metric definitions or new product scope.

## Inputs and Scope

- Use the selected asset/company, requested dashboard profile, user metric selections, configured capabilities and validated prepared results.
- For annual-report views, use normalized report datasets with explicit fiscal periods, accounting scope, sources and optional validated comparison datasets.
- Resolve company identities and validate any configured stock universe and industry taxonomy. An SSE-only application profile may retain that restriction; general dashboard composition must not hardcode it for all profiles.
- Supported asset-specific profiles require approved definitions and datasets. General composition does not authorize company ratios for other asset types.
- Industry-only research or news without a selected company requires a separate approved input contract.

## Metric and Analysis Routing

| Dashboard content                                        | Definition source                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Original investment metric cards, defaults and selection | [Investment dashboard metrics](investment-dashboard-metrics.md)                       |
| Six annual-report company metrics                        | [Annual-report company metrics](annual-report-company-metrics.md)                     |
| Declines and losses area                                 | [Segment declines and losses](segment-declines-and-losses.md)                         |
| Two or more selected companies                           | [Cross-company comparison](cross-company-comparison.md)                               |
| Industry medians and eligibility                         | [Industry benchmarking](industry-benchmarking.md)                                     |
| Performance history, headlines and industry context      | [Headlines and supporting analysis](headlines-supporting-analysis.md)                 |
| Optional stored-data chatbot                             | [Database-grounded chatbot](database-grounded-chatbot.md) and [agent.md](../agent.md) |

Keep the two six-metric dashboards separate. Do not infer annual-report defaults from investment-dashboard defaults or add roadmap metrics to a selector. Metric calculations belong to validated data services, not the presentation layer.

## Composition Procedure

Record the application-specific specification before deploying a new app. Inputs and outputs must reflect the requested profile, not inherited sample metadata or the transport protocol. A single-company research view must not acquire holdings totals, portfolio returns or concentration unless explicitly requested. Define each output's own content, source requirements and availability limitations in set_specification.outputDetails, keyed by the exact output label. Never copy the overall prompt into every output detail. Do not add unrelated capabilities or fabricate details to fill empty sections; ask for clarification where needed. Specification outputs are intended deliverables, not evidence of implemented integrations or populated data.

1. Identify the requested profile and selected asset, companies or annual report. Ask for clarification when the profile or identity is ambiguous.
2. Load the corresponding metric/analysis skills and configured results. Apply the approved selection rules exactly.
3. Compose identity, selected metric cards and supported chart, context, headline, source and chatbot sections as configured. Include segment flags and company-comparison sections only for their applicable profiles.
4. Preserve independent availability, freshness and provenance for each section and field. A failed section must not hide unrelated successful results.
5. Provide accessible explanations and evidence details, with layouts usable on desktop and mobile and identical financial content in English and Simplified Chinese.
6. Verify the resulting sections against their source records and the checks below. Report missing integration or data requirements explicitly.

## Composition Integration

For projects using the supplied shared-dashboard contract, retain capability identifier `dashboard` and contract version `1.1.0`. The supplied metadata describes a reference implementation; verify its presence and behaviour before claiming it is implemented in the target project.

The reference path is `library/browser/dashboard.js`, relative to the target project. Where that contract is in use, expose these entry points:

```javascript
SharedDashboard.register(composition_id, composer);
SharedDashboard.compose(composition_id, input);
```

Keep composition independent of a hardcoded company universe. Library consumers choose enabled capabilities through app configuration. Do not add bundle-choice UI unless required by the selected profile.

If integrating with an existing application such as ExampleStockApp, preserve its established `dashboard.run(company, bundle)` API and existing services unless a change is explicitly required. These example APIs are integration details, not prerequisites for every generated dashboard.

Where available, use `result-store` for stored results, `metric-education` for metric education, and `financial-visualizations` for chart rendering. Reuse existing shared behaviours rather than duplicating them. Do not assume these modules exist merely because this skill names them.

Optional financial integrations include `industry-research`, `company-industry-news`, `historical-analysis`, `price-target`, and `report-metrics`. Treat them as available only when configured and supported by supplied data. Database-grounded chat is an application component guided by its linked skill, not a financial capability; implement its requested interface and permitted handlers rather than rejecting it because the old catalog ID was removed.

## Independent Availability and Provenance

Display each capability's status, as-of and retrieved times, sources, and limitations. A failed, stale, or unavailable section must not hide successful results from other capabilities.

Do not mark a capability active or populated when its provider is unconfigured, coverage is unverified, or required data is unavailable. Show clear empty chart states until the necessary datasets are available.

Display validated extraction results without inventing an additional per-result approval step. Required source validation and explanation-library review still apply. Keep ambiguous or unsupported fields unavailable with reasons. Never guess their values or block unrelated valid fields. Missing data must not appear as zero.

## Metric Explanations and Charts

Every displayed metric needs an accessible explanation covering its meaning, usefulness and limitations, available through hover, keyboard focus and tap/click. Include value, unit, dates, practical implication and evidence details. Provide an industry comparison only where appropriate and valid; otherwise show the unavailable reason or relevant company trend/obligations. Do not force raw monetary amounts into industry medians or invent universal standards.

- Render sourced price history as a line chart.
- Render revenue and profit as grouped bars only when dated, consistently defined financial records are available.
- Visually distinguish industry history from forecasts and provide sources for both.
- Display forecasts only when separately permitted by the selected profile and supported by prepared evidence; distinguish them from observed results.
- Label axes, units, periods and chart basis. Provide readable empty/error states and accessible alternatives; do not fabricate observations to complete a chart.

## Financial-Report Composition

Use the six metrics defined in the [annual-report company skill](annual-report-company-metrics.md), with explicit monetary units and dates. Obtain comparison eligibility, ratio and change formulas from the linked skills and approved data contracts. Dataset fields must not silently override those definitions.

Preserve source provenance and independent field availability. Compose an executive view containing supported metrics, peer gaps, changes, segment flags, and source availability. Do not fill missing definitions, formulas, or data with assumptions.

## Expected Output

Deliver dashboard sections for configured capabilities with independent statuses, freshness, and provenance; accessible metric explanations; and supported visualizations. Include the financial-report executive composition when that profile is selected.

If a chatbot interface is enabled, scope its answers to stored dashboard records.

## Verification

- Compare specification inputs, output labels and each output's details with the actual requested profile. Check that unrelated scaffold/sample fields are absent and that selecting different outputs does not merely repeat the overall prompt. Keep active-release metadata separate from later draft or blocked attempts.
- Check profile separation, original investment defaults, exact explicit selections and retained unavailable cards.
- Confirm every section has its own status, dates, source references and limitations; provider failure must not erase other valid results.
- Confirm annual-report periods, restricted-fund caveats, ROE method labels, segment disclosure limits and comparison units survive composition.
- Test empty, stale, conflicting and partially populated datasets without invented values or silent substitutions.
- Check desktop/mobile layout, keyboard and touch access to explanations, chart labels and bilingual financial parity.
- Confirm optional modules are actually configured and that chatbot retrieval enforces user authorization and the approved evidence boundary.
- Report unimplemented integrations and unresolved product decisions; document presence alone is not implementation verification.
