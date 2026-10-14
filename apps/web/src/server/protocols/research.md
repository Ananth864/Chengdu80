# Listed-Company Industry Research

The current market-research scope is historical listed-company industry analysis through the server adapter finance.industry-research and protected FinancialAnalysis within the supplied financial composition. It is not general narrative research, news, national market sizing or industry forecasting. Select this scope only when requested; do not add news as an automatic dependency or invent a new news contract. Separately requested news requires a separately supplied supported contract and executable permission. Discovery and card decisions do not require research or news.

## Inputs and Membership

Resolve the selected SSE A-share company through lookup_companies and validate its six-digit string ticker, exchange, name and exact CSV industry against canonical records and approved company scope. Reject unknown or inconsistent identities rather than guessing. Outside supported coverage, explain the SSE A-share limitation without substituting another provider. Build peers from every unique supplied-universe SSE company sharing that exact industry label, including the selected company where eligible. Apply no market-cap size filter and do not broaden membership using discovery preference categories. Disclose supplied-universe survivorship and classification limitations.

## Annual Evidence

Use Tushare income annual consolidated total_revenue for up to five completed financial years relative to as_of_date. Completed years can still have unpublished statements. Apply the cutoff to publication dates, separately from December financial-year end dates; exclude later publications, quarterly/YTD substitutes, parent-only scopes, incompatible units/currencies and unresolved versions. The protected server handles annual consolidated report types 1/4/5 and publication/version selection; generated apps must not reproduce it. Preserve publication-field choice, reporting scope, documented currency/unit basis, normalization and source records. Neither the endpoint field list alone nor CSV market capitalization is revenue evidence.

For each year, show the server-returned available-universe revenue total, included-company count, total universe count, coverage, exclusions and sources. Missing observations are excluded, not replaced with zero. No eligible observations yields null/unavailable, not an observed zero. Incomplete totals must say partial coverage.

Show matched-cohort YoY growth separately from yearly totals. The protected server intersects comparable companies for each adjacent year pair and computes (sum current-year cohort revenue / sum preceding-year cohort revenue - 1) * 100 only with a positive preceding aggregate. Preserve both years, cohort identities/count, comparable sums, coverage and calculation basis. Cohorts may differ between comparisons; changing-membership annual totals are not a like-for-like growth series. Do not add these algorithms to generated application code.

## Bounded Availability

Live industry retrieval has a maximum budget of 80 shared-query calls per invocation, at most 40 companies, concurrency 2 and a 30-second aggregate deadline. Each company's publication windows and report types can require multiple calls; 80 calls does not mean 80 companies or full industry coverage. Transport retries have separate bounds. An already-started query may complete under its own timeout after the aggregate stops scheduling/waiting. Never bypass the budget or imply durable background completion.

Show queried and unqueried company counts, year-specific included/total counts, matched-cohort coverage, exclusions, budget/deadline limitations and the actual as_of_date explicitly. A successful bounded subset is partial, not whole-industry verification. Keep annual totals and growth statuses independent: available, partial, unavailable or insufficient_data. Preserve retrieved_at and publication dates so later retrieval does not imply that later-published information existed at the cutoff.

The recorded 2026-10-15 Asia/Shanghai live verification covers daily, adj_factor, income and report_rc for one representative company; see docs/tushare-verification.md. It proves representative retrieval, not full industry membership/coverage, annual statement comparability or every downstream result. Actual availability follows server-returned evidence. Tushare is the sole external provider; credentials and all retrieval stay server-owned. Fixture data is explicitly synthetic and never substitutes for requested live data.

## Presentation Limits

Label outputs as historical listed-company statistics for the supplied SSE A-share universe. Render annual revenue with visible yearly coverage and matched-cohort growth as a separate series. Omit national/mainland-China market size, total-industry revenue claims, demand/supply narratives, material-event research, projections, five-year outlooks and industry forecasts entirely, including forecast placeholders. Do not extrapolate or fill gaps from model memory.

Use the supplied current industry-research capability definition when older dashboard guidance conflicts. Metric education, charts, storage and grounded chat remain skills/composition, not new reusable capabilities or permission to modify financial metrics in any scope. Persist permitted records through storage.read/storage.write only, not localStorage, preserving provenance and explicit save failures. Exact Workflow approval, prepare_build, sandbox verification and separate Preview activation remain mandatory.
