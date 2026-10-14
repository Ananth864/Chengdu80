# FinMatch Risk to Company Size Mapping

## Product Rule

The product owner supplied this rule explicitly. It maps risk to company size,
not to industry. No operator-provided industry mapping table is needed.

| Risk bucket | Company size | Meaning of the original size label |
| ----------- | ------------ | ---------------------------------- |
| high        | small        | low cap/size                       |
| medium      | medium       | medium cap/size                    |
| low         | large        | high cap/size                      |

Capability pin: `CAP-003@0.3.0`. Policy:
`finmatch-risk-company-size@1.0.0`. Supported questionnaire: `v0-demo`.

## Contract

Input is `risk_result`, the completed questionnaire result or validated summary
with questionnaire version, total score and bucket. Any included answers must be
complete and consistent with the score. Optional `industry_preference` is
validated and passed through unchanged; it is never derived from risk.

Output port `mapping_result` contains `mapping_status: mapped`, policy ID and
version, questionnaire version, internal score/bucket, `company_size` as `small`,
`medium`, or `large`, and the preference only if supplied. Malformed/inconsistent
inputs return `invalid_input` with a stable corrective error code. Browser output
must omit scores, buckets, and answers.

## Limits

This is a confirmed product rule, not independent financial validation or a
suitability conclusion. Numeric market-cap thresholds, currency conversion,
valuation dates, and company-size data provenance are not defined. Downstream
logic must receive an explicitly classified company size; it must not guess size
from numeric market capitalization. Company selection, ranking, API calls, and
brokerage actions are not implemented by this capability.

`CAP-003@0.2.0` remains the earlier explicit-policy risk-to-industry capability.
It is retained unchanged for pinned applications; new company-size plans should
select `0.3.0`. The two versions have different output contracts and must not be
interchanged silently. Both remain unverified and blocked from production.
