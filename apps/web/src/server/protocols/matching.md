# Risk industry matching and company cards protocol v1

Risk assessment and industry preference are separate inputs, offered with matching rather than as standalone products. Questionnaire and scoring remain pending. Do not invent a risk score or change it based on swipes.

Intersect chosen industries with the fixed mapping: low risk to large cap, medium risk to medium cap, high risk to small cap. Use the platform company table's size category; size alone does not guarantee investment safety.

Show up to five randomly selected company cards per China calendar day. Preserve the daily batch across reloads. Exclude watchlisted and previously answered companies until the eligible pool is exhausted; then offer revisiting dismissed companies. Show fewer cards when fewer qualify. Yes adds to the watchlist; no dismisses. Brokerage integration is roadmap only.

Each card represents one company. Metric menu: P/E, P/S, dividend yield, revenue growth, ROE, interest coverage. Defaults: P/E, dividend yield, ROE, interest coverage. Explicit selections replace defaults. Keep unavailable selected metrics with reasons. Detailed calculation and industry-benchmark rules need expert validation.

Company research detail is optional and requires market research. Matching may alternatively include the historical/target package without research. All builds serve the real Shanghai Stock Exchange Class A table (identity plus daily_basic market-cap sizing); per-metric financial values, questionnaires and expert assessment remain pending.

The platform provides company-capabilities-v1. Reuse its matching, daily selection and decision APIs. Questionnaire scoring remains pending; apps label the real SSE source. Never write module data via storage.write. Selected metric values are unavailable until approved fields and definitions are wired.
