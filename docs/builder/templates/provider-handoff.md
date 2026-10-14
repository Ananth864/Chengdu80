# Provider handoff template

Provider: Tushare, selected official provider. Adapter ID: tushare. Owner: TODO. Integration status: pending.
Product: Tushare HTTP API, `POST http://api.tushare.pro` with `{api_name, token, params, fields}`; success responses use `code=0` with `data.fields` and `data.items`.
References: the competition Financial Data Resource Guide and the official Tushare API documentation.
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
Do not mark live-ready based on a table name, marketing statement or untested API inventory entry. The token stays in server configuration; never in app source or client code.
