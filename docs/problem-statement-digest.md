# Problem statement digest

Reviewed 13 October 2026. This records what the supplied source images say. It does not select a product scope or architecture. OCR supported the review; the challenge requirements, restrictions, milestone times, scoring weights, template instructions, data categories, and token conditions below were checked against the images visually. No applicable `AGENTS.md` was present in the workspace or its parent directories.

## Source coverage

All source paths below are relative to the workspace's `Context/` directory. Printed page numbers take precedence over filename suffixes.

| Source                          | Contents                                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Chengdu_Brief.jpg`             | Challenge brief, printed page 1                                                                       |
| `Chengdu_brief_2.jpg`           | Challenge and tasks A/B, printed page 2                                                               |
| `Chengdu_Brief_3.jpg`           | Platform expectations, printed page 3                                                                 |
| `Chengdu_Brief_4.jpg`           | Data rules, printed page 4                                                                            |
| `Chengdu_Brief_5.jpg`           | Development environment and security, printed page 5                                                  |
| `Chengdu_Brief_6.jpg`           | Surprise Task, printed page 6                                                                         |
| `Chengdu_Brief_7.jpg`           | Milestones and submission locks, printed page 7                                                       |
| `Chengdu_Brief_8.jpg`           | Final four hours, review day, defenses, printed page 8                                                |
| `Chengdu_Brief_9.jpg`           | Evaluation weights and Stage 1 scoring, printed page 9                                                |
| `Chengdu_Brief_10.jpg`          | What judges seek, **printed page 11**                                                                 |
| `Chengdu_Brief_11.jpg`          | Photograph of the platform capability proposal template; final sentence continues beyond visible text |
| `Image_20261012110236_7_1.jpg`  | Financial Data Resource Guide, printed page 1                                                         |
| `Image_20261012110238_8_1.jpg`  | Data catalog overview, printed page 2                                                                 |
| `Image_20261012110239_9_1.jpg`  | Data categories, printed page 3                                                                       |
| `Image_20261012110241_10_1.jpg` | Equity tables, printed page 4                                                                         |
| `Image_20261012110242_11_1.jpg` | Company financials and governance tables, printed page 5                                              |
| `Image_20261012110244_12_1.jpg` | ETF and fund tables, printed page 6                                                                   |
| `Image_20261012110246_13_1.jpg` | Convertible bonds, yield curves, indices, macroeconomics, printed page 7                              |
| `Image_20261012110247_14_1.jpg` | Spot metals and market topics, printed page 8                                                         |
| `Image_20261012110249_15_1.jpg` | Tushare token overview and installation, printed page 9                                               |
| `Image_20261012110251_16_1.jpg` | Token configuration and API discovery, printed page 10                                                |
| `Image_20261012110253_17_1.jpg` | Retrieval examples, printed page 11                                                                   |
| `Image_20261012110254_18_1.jpg` | Saving results and HTTP API, printed page 12                                                          |
| `Image_20261012110300_19_1.jpg` | Retrieval limits and official resources, printed page 13                                              |
| `Image_20261012120850_36_1.jpg` | Photograph of the `Dataset Overview` workbook description sheet                                       |

The supplied challenge images do not include printed page 10. Detailed Stage 2 and Stage 3 scoring, if present there, cannot be inferred. The actual `Dataset Overview.xlsx`, underlying data, full submission templates, and reference interface guide are not included in `Context/`.

## Required outcome and audience

The central requirement is a working AI-native financial application platform that lets users beyond the original team turn financial ideas into working, reusable applications. It should keep producing new financial applications. The brief does not prescribe a narrower commercial customer segment. Sources: brief pages 1 and 2.

Task A requires a working host platform. It packages financial application functions, tools, and data as reusable function APIs and data APIs, with clear developer documentation. Given a user's idea, that documentation, and the APIs, an LLM should be able to generate a compatible, plugin-like application that can be rapidly deployed and run on the platform. Qwen is the competition model. Source: brief page 2.

Task B requires **three distinct flagship financial applications**. Each must be compatible with the platform, integrated and deployed through it, and usable by ordinary users or developers. Unrelated stand-alone programs do not qualify. Source: brief page 2.

Application code may be generated inside or outside the platform, including through LLM-based Vibe Coding. The assessment focuses on compatibility, integration, deployment, operation, and delivery. The platform must directly deploy, host, and run applications created with a third-party LLM, and support new applications beyond those prepared in advance. Sources: brief pages 2 and 3.

The documentation must allow a third-party LLM to create a compatible application without relying on undocumented prompts, hidden developer knowledge, or tricks only the original team knows. Sources: brief pages 3 and 5.

## Development and security rules

Qwen is the official AI development environment. The organizer provides the official programming environment and approved Qwen APP/API access. Teams must not use other LLM-powered coding tools or AI models for software development during the competition. Other LLMs may be used for brainstorming. Different IDEs and code editing or management tools are allowed; the restriction concerns the underlying generative model. Source: brief page 5.

Official evaluation primarily uses the organizer-approved Qwen APP or APIs. Broad compatibility with other generative models is encouraged and may be explained or demonstrated as an extension. This does not remove the competition development restriction. Source: brief page 5.

Do not hard-code API keys or secrets into plugin or application source. Keep user credentials isolated, outside ordinary logs and public packages. Source: brief page 5.

The source images do not prescribe Cloudflare, a particular hosting provider, a particular database, a plugin file format, an iframe model, or an internal code-generation interface. They also do not specify a cloud region or mainland deployment requirement.

## Data rules

Teams may use organizer-provided data and legally accessible public or open data and APIs. Teams must obtain required registrations, keys, permissions, and licenses and follow provider terms. Data selection should support the platform and applications. Sources: brief page 4.

Expensive or exclusive data does not earn innovation credit by itself. Judges assess what the platform and applications produce with data. The financial data guide suggests data categories and access paths. A platform ecosystem or reference interface guide, if provided, is illustrative rather than a required architecture or UI. Source: brief page 4.

The guide says the core datasets were released directly to participating teams. Additional important datasets require the provided Tushare API token. It describes 37 tables and 856 fields. The earliest stated date across the catalog is December 1951, the latest October 2026; this does **not** mean every table spans that range. Sources: data guide pages 1 and 2.

| Category                                 | Tables | Stated uses                                                                                                                               |
| ---------------------------------------- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Stock reference data, trading, valuation |      7 | Security identification, calendar alignment, backtesting, price adjustment, valuation screening, factor research, industry classification |
| Listed company financials and governance |      9 | Financial statements, company quality, governance, shareholder behavior, announcement events                                              |
| ETFs and publicly offered funds          |      7 | Product identification, market and size tracking, NAV analysis, look-through holdings                                                     |
| Convertible bonds and yield curves       |      5 | Pricing, conversion terms, redemption risk, risk-free yield curves                                                                        |
| Indices and macroeconomics               |      3 | Benchmarks, inflation, interest rates, macroeconomic modeling                                                                             |
| Spot precious metals                     |      1 | Shanghai Gold Exchange spot prices, activity, open interest                                                                               |
| Market trading and issuance topics       |      5 | Margin trading, Dragon and Tiger List disclosures, IPO schedules, limit-up and limit-down events                                          |

Source: data guide page 3. These are available categories, not a requirement to use every category or expose all tables.

The photographed workbook description says tables 1 through 32 come from Tushare and tables 33 through 37 from Southern Finance Omnimedia Corp. Tushare source URLs appear in row 3 of corresponding worksheets. The workbook supplies date ranges and detailed field information. Source: `Image_20261012120850_36_1.jpg`.

### Coverage examples that matter for product promises

The catalog contains historical snapshots with unequal coverage. These statements are catalog descriptions, not validation of actual rows.

- Stock daily prices and valuation data cover July 2024 through September 2026. The supplied trading calendar ends December 2025. Stock basic data ends August 2026. Source: data guide page 4.
- Income statements cover March 2024 through August 2026. Balance sheets cover August through September 2026. Cash-flow statements and financial indicators cover July 2024 through September 2026. Management information is dated August 2024. Pledge statistics cover January 2015 through August 2017. Announcement metadata covers July 2024 through October 2026 and includes title and source-document link, rather than an explicit promise of full text. Source: data guide page 5.
- Fund portfolios cover July 2024 through August 2026. ETF shares and size cover July 2024 through October 2026. ETF benchmark metadata ends December 2025. Source: data guide page 6.
- Convertible-bond conversion-price changes cover November 1992 through September 2014; convertible-bond daily data covers July 2024 through September 2026. Source: data guide page 7.
- Margin data covers July 2025 through July 2026. Limit-down data is September 2026 only. Source: data guide page 8.

These dates are reasons to check overlap, announcement timing, and freshness before committing to a product. The source does not guarantee live prices, point-in-time correctness, complete documents, or consistent coverage across tables.

### Tushare access conditions

Each team receives a unique token, with competition data/API permissions, valid until the competition deadline. The organizer provides a token, not a Tushare account or login. Keep it secure; do not publish it or share it with other teams. Source: data guide page 9.

The guide supports both the Python SDK and HTTP API. It recommends the Python SDK for most teams. It recommends reading `TUSHARE_TOKEN` from an environment variable rather than writing the real token in code. Local Tushare token storage is permitted only on a trusted team-controlled device, not a shared or public device. Sources: data guide pages 9 and 10.

Before retrieval, confirm the API name, input parameters, output fields, date coverage, update frequency, per-request row limit, and request-frequency limit in the official API documentation. Date parameters normally use `YYYYMMDD`. Sources: data guide pages 10 and 11.

Downloaded results may be saved as CSV or Excel. The guide recommends including API name and date range in filenames for verification. It gives `http://api.tushare.pro` as the documented HTTP POST endpoint and describes response fields `code`, `msg`, `data.fields`, and `data.items`. This digest records the printed endpoint without verifying current provider behavior. Source: data guide page 12.

Full data permission does not remove row limits or frequency limits. Split requests by date or security code, request necessary fields, and use delays/retries where needed. Source: data guide page 13.

## Submission locks and deliverables

The build lasts 80 hours. Submissions may be revised until their deadlines and then lock. Sources: brief pages 1 and 7.

| Deadline in source        | Lock                                         | What locks                                                    |
| ------------------------- | -------------------------------------------- | ------------------------------------------------------------- |
| Day 1, 23:59:59           | Milestone 1, platform capability lock        | Declared core platform capabilities                           |
| Day 2, 23:59:59           | Milestone 2, three flagship application lock | Core product definitions and user value                       |
| Four hours before the end | Milestone 3, final system lock               | Source code and final system version                          |
| Hour 80                   | Presentation lock                            | Two final presentations, technical defense and business pitch |

Source: brief page 7. Hour 76 for the final system lock is arithmetic derived from the 80-hour total and final four-hour preparation period. Calendar dates, event start time, and exact portal closing behavior are not given in these images. The photographed proposal template describes Milestone 1 as Day 1, 24:00, while the milestone table says 23:59:59. Treat the table's earlier instant as the safe deadline until the portal confirms otherwise.

Milestone 1 locks the capability commitments rather than implementation choices. Milestone 2 locks the three products rather than algorithms or internal designs. Implementations may improve, but teams may not replace or materially alter locked commitments. Source: brief page 7.

Milestones 1 and 2 are published to all teams after their deadlines. Submitted source code and presentations are not released to other teams by the submission process. All proposals must use the official Markdown templates and upload through the portal; Word proposals are not required. Source: brief page 7.

The photographed platform capability template has team and platform fields, followed by four sections:

1. Platform Vision, objectives and distinguishing features.
2. User Experience, how a user turns an idea into a working application and the user journey.
3. Platform Capabilities, capabilities supporting application creation and delivery.
4. Development Commitment, specific verifiable capabilities, each with a team-assigned ID such as `C01` or `C02`.

The template prescribes no fixed capability list or number. Each row must state the capability and what users can do clearly enough to verify delivery. Teams should reuse those IDs in `Final_Report.md` completion reporting. Source: `Chengdu_Brief_11.jpg`. The sentence after that point is incomplete in the photograph; the lock rule is independently complete on brief page 7.

After final code lock, the last four hours are for the two separate presentations. Source code cannot be modified. Both PPT files lock at hour 80. Source: brief page 8.

The next day is a team rest day and organizer engineering review day. Engineers test the locked system and run the Surprise Task. Teams may answer setup questions if asked, but cannot submit functional code changes. On defense day, technical defense is in the morning and investment pitch in the afternoon. Source: brief page 8.

## Evaluation

Technical credibility and financial innovation are equally weighted overall. Source: brief page 9.

| Stage                                       | Overall weight | Format                                               |
| ------------------------------------------- | -------------: | ---------------------------------------------------- |
| Engineering verification and Surprise Task  |            25% | Independent review during rest/review day            |
| Platform architecture and technical defense |            25% | 20 minutes, 10-minute presentation and 10-minute Q&A |
| Investment and commercial value pitch       |            50% | 30 minutes, 15-minute presentation and 15-minute Q&A |

Engineers examine locked source and system, check the platform and three applications, follow the submitted development/user guide where relevant, and conduct the Surprise Task. Source: brief page 9.

| Stage 1 dimension                   | Points within Stage 1 |
| ----------------------------------- | --------------------: |
| System execution                    |                    25 |
| Platform functional completeness    |                    25 |
| Platform-based application delivery |                    20 |
| Surprise Task                       |                    30 |
| Total                               |                   100 |

Source: brief page 9. Defense order is decided by lot at the venue entrance by team captains. Detailed Stage 2 and Stage 3 dimensions are not supplied in the available images.

### Surprise Task

The organizer introduces an unexpected financial application requirement in natural language during engineering evaluation. It may involve financial data or capabilities available through the team's platform. The task is not disclosed in advance. The competition does not prescribe where or how the application is developed. Source: brief page 6.

Engineers check that the new application meets declared integration requirements, integrates and deploys through the platform, runs, and is accessible and usable by intended users. Prepared demonstrations alone do not establish general platform capability. The test uses the locked final system. Source: brief page 6.

### Evidence judges want

The brief asks what new financial capability becomes possible when AI, data, and an extensible platform work together. It favors an engine for financial innovation over counts of features, agents, APIs, or expensive data. Source: brief printed page 11, file `Chengdu_Brief_10.jpg`.

The following do not win by themselves: many simple plugins, complex multi-agent architecture without clear user value, polished slides without platform evidence, a chatbot presented as an application ecosystem, or a system that works only on the team's own machine. Same source.

## Unresolved source questions

These are gaps or tensions in the supplied material, not additional rules.

- Printed challenge page 10 is absent. Detailed technical-defense and business-pitch scoring remains unknown.
- Calendar start/end dates and portal deadlines are absent. Do not convert relative Day 1/Day 2/hour deadlines into calendar times without the event schedule.
- The guide says the Tushare token expires at the competition deadline, while engineers review the next day. Review-day token access, permitted data snapshots, and any extended credentials need confirmation.
- The brief requires new application creation in the Surprise Task after system lock, while forbidding functional code changes to the locked system. It appears to distinguish creating/deploying a plugin with the locked platform from modifying the platform itself, but that boundary and any limitations should be confirmed with the organizer.
- The official evaluation model is described as the approved Qwen APP or APIs. Exact access, tooling, quotas, deployment environment, and how engineers supply credentials are not stated here.
- The photographed template references Appendix A.1 and `Final_Report.md`; full appendix, final-report template, source packaging requirements, and exact guide filenames are not visible.
- The guide describes available data rather than establishing successful data access. No actual dataset or token was tested in this review.
- The supplied brief makes no claim that Cloudflare deployment, custom domains, runtime APIs, or credentials will work on the event's mainland China network. That requires separate network and deployment evidence.

## Implications for the design interview

The brief leaves product identity, exact user segment, the distinct value of each flagship application, commitment breadth, and integration/deployment contract to the team. The capability commitments and three product definitions are the decisions that become hard to change at the milestone locks. Internal algorithms, database layout, hosting implementation, and UI component details can remain flexible within those commitments. This follows the explicit lock rules; it is not a selection of those details.
