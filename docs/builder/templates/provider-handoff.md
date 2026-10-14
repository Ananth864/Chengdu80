# Provider handoff template

Provider: Wind, selected official provider. Adapter ID: wind. Owner: TODO. Integration status: pending.
Product: TODO, confirm Client API versus market-data service and required entitlements.
References: https://www.wind.com.cn/portal/zh/ClientApi/index.html and https://www.wind.com.cn/mobile/WDS/marketdata/zh.html
Capabilities served: TODO.

## Access

Official endpoint and documentation: TODO.
Credential configuration key names: TODO. Do not include secret values.
Entitlement, rate limits, expected latency and caching/display permissions: TODO.

## Coverage and field mapping

Exchange/symbol format and CSV identity mapping: TODO.
Required output field → provider field → type/unit/date → transformation: TODO.
History start/end, adjustment basis and reporting scope: TODO.
Price targets: analyst/source, publication date, horizon, currency, individual/consensus method: TODO.
News: company/industry matching, source/event dates, deduplication: TODO.
Financial metrics: underlying fields and validated definitions: TODO.

## Failures and evidence

Missing/stale/conflicting fields and explicit unavailable reasons: TODO.
Accepted freshness windows: TODO.
Source attribution and evidence retention: TODO.
Fixture sample with expected normalized output: TODO.
Live sample result/date with secrets removed: TODO.

## Approval

Coverage verified by/date: TODO.
Usage permission evidence: TODO.
Open gaps: TODO.
Do not mark live-ready based on a table name, marketing statement or untested API inventory entry.
