# Financial API portability and test data

Investigated on 13 October 2026. Recommendations below are proposed implementation details, not a locked provider choice. The user has clarified that models are managed by the platform; user model BYOK is out of scope. Financial-data portability is required. VPN/proxy use is acceptable for the prototype.

## Separate inference from financial data

OpenAI compatibility describes a model-inference contract. Chat Completions accepts conversation messages and can return text, streaming chunks and tool calls. Structured output is a separate capability that must be tested on the selected model. [Official OpenAI documentation](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create), [streaming events](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat).

Tushare has a different financial-data protocol. Its HTTP request uses `api_name`, `token`, `params` and `fields`; its response uses `code`, `msg`, and aligned `data.fields`/`data.items` arrays. It requires a registered account and token. [Tushare HTTP contract](https://tushare.pro/document/1?doc_id=40). Enforcing an OpenAI request schema would not make Tushare or another financial provider interchangeable.

Proposed approach: generated apps call a stable, normalized platform financial API. Provider adapters translate provider-specific identifiers, fields, dates, errors, units and coverage into that contract. Start the test adapter with real financial data, then add Tushare. Keep model-provider configuration behind a separate platform inference interface.

## One live Chinese-equity candidate verified

Alpha Vantage's official documentation publishes daily-data demo URLs for Shanghai `600104.SHH` and Shenzhen `000002.SHZ`. [API documentation](https://www.alphavantage.co/documentation/). The Shanghai example was tested without registering an account or supplying a private credential:

`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=600104.SHH&outputsize=full&apikey=demo`

| Measured result       | Evidence                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Time                  | 13 October 2026, 02:52:38 China time                                                                                     |
| HTTP and elapsed time | HTTP 200, 7.878 seconds                                                                                                  |
| Response wrapper      | `Meta Data` and `Time Series (Daily)`                                                                                    |
| Available rows        | 5,068 daily records                                                                                                      |
| Date range            | 2007-01-04 to 2026-10-12                                                                                                 |
| Fields observed       | `1. open`, `2. high`, `3. low`, `4. close`, `5. volume`, all numeric strings                                             |
| Metadata caveat       | Symbol `600104.SHH`, last refreshed `2026-10-12`; metadata timezone reported `US/Eastern` despite the Chinese instrument |

A second official demo request for IBM returned HTTP 200 and 100 daily rows in 4.275 seconds. It establishes another working sample, but adds no Chinese-market coverage evidence. The Shenzhen URL was documented but not requested. These requests used the laptop's existing route; they do not establish proxy-free mainland access. No live dataset was saved or published.

The Shanghai example is suitable for a proposed narrow price-chart, filtering and adapter smoke test. It is not a Tushare-compatible endpoint, a broad market feed, convertible-bond/fund-holdings data, or a replacement for the organizer's 37 released tables. Public demo access does not establish general arbitrary-symbol access or a service guarantee.

Normal Alpha Vantage use needs an API key. Current support documentation lists 25 requests/day for the ordinary free service, with a separate verification route for educational/open-source projects. Do not presume the educational allowance has been granted or apply the ordinary quota to the public demo without confirmation. [Provider support](https://www.alphavantage.co/support/). Documentation marks ordinary `outputsize=full` use as premium; the working public sample does not grant that entitlement for other symbols. [API documentation](https://www.alphavantage.co/documentation/). Its terms grant default personal, noncommercial use and define business/entity use separately; a multiuser or business demonstration must not assume that default license permits distribution. [Provider terms](https://www.alphavantage.co/terms_of_service/). The two published demo requests here only establish read-only sample reachability.

BaoStock was also investigated. Its current official site and former API-doc path returned an HTML application shell, rather than an inspectable financial API contract, and its Python package is not installed. No BaoStock financial request, current quota or data-use permission was verified. It is not recommended over the verified sample for this spike. [Official site](https://www.baostock.com/).

## Proposed normalized price contract

Keep providers out of generated-app code. For example, `prices({ instrumentId, startDate, endDate, adjustment: "unadjusted" })` returns dated OHLCV rows with source and coverage metadata. A provider mapping converts platform instrument `600104.SH` into the Alpha Vantage symbol `600104.SHH`, and later into Tushare `ts_code=600104.SH`.

| Platform field                         | Alpha Vantage daily mapping                                          | Tushare daily mapping                                                         |
| -------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `date`, ISO calendar date              | Date key in `Time Series (Daily)`                                    | `trade_date`, convert `YYYYMMDD`                                              |
| `open`, `high`, `low`, `close`         | Numbered field names; validate decimal strings                       | Same price names; validate values                                             |
| `volume`, `volumeUnit`                 | `5. volume`; verify the Chinese sample's unit before assuming shares | `vol`, documented in lots; verify the instrument's lot size before conversion |
| `turnover`, `turnoverUnit`             | Not present in the tested daily response; return null                | `amount`, documented in thousands of yuan                                     |
| `source`, `sourceSymbol`, `adjustment` | Adapter metadata; tested endpoint is the ordinary daily series       | Adapter metadata; `daily` is unadjusted                                       |

Tushare's [daily documentation](https://tushare.pro/document/2?doc_id=27) defines those units and says suspended trading days are absent. Do not fill missing values with invented zeroes, treat missing days as provider errors, or mix adjusted and unadjusted series. Store market dates as dates; the observed Alpha Vantage `US/Eastern` metadata needs investigation and should not shift a Chinese historical date to a different calendar day. If a unit is unresolved, expose the native unit explicitly and leave the canonical converted value unavailable.

Adapter errors should distinguish authentication/permission failure, rate limit, unsupported coverage, malformed data and upstream failure. A provider may send an informational JSON object with HTTP 200, so HTTP success alone is insufficient. Validate the expected wrapper and rows. The live sample tested here contained the expected data wrapper.

## Test recommendation

Use the real Shanghai demo for the first narrow live smoke test, through the normalized adapter. Make the main automated tests deterministic with clearly labelled synthetic financial fixtures. Include a price rise and fall, a missing/suspended day, missing fundamentals, a corporate-action example, and a provider-limit/error response. Maintain separate Tushare-envelope fixtures to test future `fields`/`items` translation. Synthetic fixtures test logic; they must not be represented as organizer data or actual investment results.

Proposed acceptance for the first live adapter: request the documented sample, parse real rows, report source/coverage, render a price chart, and reject malformed/informational responses. Two apps may consume the same normalized public market data, but private app data remains scoped to its particular app and owning account. Test that unrelated accounts cannot access private data or credentials. Keep all provider credentials server-side. The initial shared test provider and team Tushare connection can be platform-managed; per-account user-supplied financial-provider credentials are a future design option, not an accepted requirement. Changing providers must preserve app code and declared data semantics; missing provider coverage must be explicit.

Root independently repeated the official Shanghai demo request during this session. It returned the expected wrapper and 5,068 rows, from 2007-01-04 through 2026-10-12, with the five OHLCV fields. This corroborates live sample availability and shape; it is not independent verification of market-data accuracy or redistribution permissions. No dataset was saved or published.

Iterative app changes remain required. Test a user-requested edit in preview, obtain approval before replacing the accepted version, and verify existing state survives that approved replacement. Monitoring is deferred and is not a prerequisite for this adapter spike.

## Upstream model BYOK facts, now out of scope

Selected files at VibeSDK commit `9da158d` show a BYOK modal, encrypted vault storage, SDK runtime-key overrides and credential/endpoint coupling. They do not establish working arbitrary-provider onboarding. The [provider controller](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/worker/api/controllers/modelProviders/controller.ts) returns 503 for custom-provider create/update and stored-provider tests; its direct test only calls `/models`. The [BYOK status helper](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/worker/api/controllers/modelConfig/byokHelper.ts) reports every provider's key status as false. The [inference resolver](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/worker/agents/inferutils/core.ts) protects platform keys from user-supplied gateway URLs.

The plan's removal of model-provider/settings/vault paths does not conflict with the clarified platform-managed model decision. No BYOK repair is proposed. For the platform's selected Qwen model, a real integration check still needs Chat Completions, streaming, valid tool-call arguments and schema-valid structured output; a successful `/models` response is insufficient. Financial-data adapter credentials are a separate requirement.
