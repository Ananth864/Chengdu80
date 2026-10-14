# FinMatch Risk to Industry Mapping Capability

**Status:** Capability contract draft; industry mapping policy must be supplied and approved before production use  
**Application:** FinMatch / Tinder Investment Discovery  
**Purpose:** Convert a completed FinMatch risk-questionnaire result into risk-aligned industry suggestions, while keeping those suggestions distinct from the user's own industry choices.

## 1. Capability summary

This capability accepts the completed risk result from the FinMatch risk-questionnaire capability, applies an explicit mapping policy, and returns the industries associated with the resulting risk profile. If the user also provided industry preferences, the capability can compare the mapped industries with those preferences and report the overlap and differences.

The capability does not calculate the questionnaire score, infer a user's preferences, decide that an industry is inherently suitable for every person in a risk bucket, select companies, or make investment recommendations. Its output is a mapping result for downstream application logic and user review.

**Critical policy dependency:** The source materials define the score buckets and the six supported industries, but do not define an industry mapping for low, medium, or high risk. An implementing LLM must receive a product-approved mapping policy as input or configuration. It must not make up the mapping. If no policy is available, return `mapping_not_configured` and no mapped industries.

## 2. Source-defined values

### Risk questionnaire result

The upstream questionnaire capability returns:

- `questionnaire_version`: currently `v0-demo`.
- `answers`: the seven completed answers, `q1` through `q7`, each an integer from 1 to 3.
- `total_score`: sum of all seven answers, from 7 through 21.
- `risk_profile_bucket`: `low`, `medium`, or `high`.

For `v0-demo`, the bucket boundaries are:

| Total score | Risk profile bucket |
|---:|---|
| 7–11 | `low` |
| 12–16 | `medium` |
| 17–21 | `high` |

Treat `risk_profile_bucket` as the upstream capability's calculated result. Validate that the score is an integer in range and that it agrees with the bucket for the given questionnaire version. Do not recalculate from partial answers or accept inconsistent score/bucket pairs.

### Supported industries

Use these canonical identifiers exactly:

- `technology`
- `finance`
- `agriculture`
- `manufacturing`
- `fmcg`
- `energy`

The UI may localize display labels, but data exchange uses these identifiers.

### User-selected industry preferences

The preference capture capability returns:

```json
{
  "selection_mode": "selected",
  "selected_industries": ["technology", "energy"]
}
```

When the user selected none, it returns:

```json
{
  "selection_mode": "balanced_coverage",
  "selected_industries": []
}
```

`balanced_coverage` means a downstream company recommendation step should cover all six industries. It is not equivalent to the user explicitly selecting all six industries.

## 3. Capability inputs

### Required input: risk result

```json
{
  "questionnaire_version": "v0-demo",
  "total_score": 15,
  "risk_profile_bucket": "medium"
}
```

The full upstream object may include `answers`; they may be passed through as provenance, but the mapping logic only needs the validated questionnaire version, score, and bucket.

### Required policy: industry mapping configuration

Provide a versioned mapping policy that assigns one or more canonical industry identifiers to each risk bucket. Policy is configuration, not something the LLM should derive from general beliefs about sectors.

```json
{
  "mapping_policy": {
    "policy_id": "finmatch-risk-industry-v1",
    "policy_version": "1.0.0",
    "questionnaire_versions": ["v0-demo"],
    "bucket_to_industries": {
      "low": ["<approved-industry-id>"],
      "medium": ["<approved-industry-id>"],
      "high": ["<approved-industry-id>"]
    }
  }
}
```

Replace every placeholder with one or more values from the supported industry list before using the policy. Empty mappings should only be allowed if the product explicitly defines that behavior. The policy owner must define whether the mapping means eligible industries, suggested industries, or another precise downstream action; this capability treats them as **risk-aligned suggestions**.

### Optional input: user's industry preference

```json
{
  "industry_preference": {
    "selection_mode": "selected",
    "selected_industries": ["technology", "energy"]
  }
}
```

If omitted, return the risk-aligned suggestions without comparing against a user selection. If present, validate it against the preference contract and report its relationship to the mapped suggestions.

### Combined request example

```json
{
  "risk_result": {
    "questionnaire_version": "v0-demo",
    "total_score": 15,
    "risk_profile_bucket": "medium"
  },
  "industry_preference": {
    "selection_mode": "selected",
    "selected_industries": ["technology", "energy"]
  },
  "mapping_policy": {
    "policy_id": "finmatch-risk-industry-v1",
    "policy_version": "1.0.0",
    "questionnaire_versions": ["v0-demo"],
    "bucket_to_industries": {
      "low": ["<approved-industry-id>"],
      "medium": ["<approved-industry-id>"],
      "high": ["<approved-industry-id>"]
    }
  }
}
```

## 4. Required behavior

1. Validate the risk result. Require a supported `questionnaire_version`, an integer `total_score` from 7 to 21, and a known bucket. For `v0-demo`, confirm the bucket matches the documented score bands.
2. Validate the policy. Require a policy ID and version, coverage for the input questionnaire version, mappings for all three buckets, and only supported industry identifiers. Do not fill missing mappings from model knowledge.
3. Select the list in `bucket_to_industries` for the validated `risk_profile_bucket`. Preserve the policy's configured order and remove duplicate identifiers or reject duplicates according to implementation convention; duplicates must never create duplicate output suggestions.
4. If an `industry_preference` was supplied, validate `selection_mode` and `selected_industries`:
   - `selected` requires a non-empty list of supported identifiers.
   - `balanced_coverage` requires an empty list.
   - Reject contradictory or invalid combinations. Do not silently reinterpret invalid input.
5. Keep risk-aligned suggestions separate from user-selected preferences. Never overwrite, relabel, or persist a suggestion as though the user selected it.
6. When `selection_mode` is `selected`, report the intersection and the user-selected industries not present in the risk-aligned suggestions. Do not silently remove the latter from the user's preference. The product must decide how downstream recommendation logic handles the difference; this capability only reports it.
7. When `selection_mode` is `balanced_coverage`, preserve that mode. Return the mapped suggestions separately; do not convert balanced coverage into explicit user selections or assume it is an opt-in to filter to the mapped list.
8. Do not show or explain a financial suitability conclusion. The UI may present the mapped industries as suggestions for the user to review, subject to product approval and applicable review.
9. Do not select stocks, funds, or gold products; rank or recommend companies; fetch market data; or take brokerage actions.

### Deterministic execution algorithm

An implementing LLM or service must follow this sequence and must not substitute its own sector-risk assumptions:

1. Read the `risk_result` and verify `questionnaire_version`, `total_score`, and `risk_profile_bucket` are present and mutually consistent under the scoring rules for that questionnaire version.
2. Read the approved `mapping_policy`. Verify its version and questionnaire coverage, and verify that it defines a list of supported industry IDs for each risk bucket.
3. Look up `risk_result.risk_profile_bucket` in `mapping_policy.bucket_to_industries`. Copy that configured list, preserving its order and removing duplicates.
4. If `industry_preference` is present, validate it using the preference capability's contract. For `selected`, compute `overlap_industries` as the intersection and `selected_outside_mapping` as the user's selected industries minus the mapped list. Preserve the user's input order in both result lists.
5. Return the validated risk fields, policy provenance, mapped industries, and optional preference comparison. If validation or configuration fails, return a non-success status and an empty `risk_aligned_industries` list.

The mapping policy is the only authority for the bucket-to-industry relationship. Do not use industry stereotypes, general financial knowledge, or the user's preference list to fill in a missing policy.

## 5. Output contract

### Successful mapping with selected user preferences

```json
{
  "mapping_status": "mapped",
  "mapping_policy_id": "finmatch-risk-industry-v1",
  "mapping_policy_version": "1.0.0",
  "questionnaire_version": "v0-demo",
  "total_score": 15,
  "risk_profile_bucket": "medium",
  "risk_aligned_industries": ["<mapped-industry-id>"],
  "industry_preference_comparison": {
    "selection_mode": "selected",
    "user_selected_industries": ["technology", "energy"],
    "overlap_industries": [],
    "selected_outside_mapping": ["technology", "energy"]
  }
}
```

The placeholder above is illustrative only. Production output must contain actual identifiers from the approved policy.

### Successful mapping with balanced coverage

```json
{
  "mapping_status": "mapped",
  "mapping_policy_id": "finmatch-risk-industry-v1",
  "mapping_policy_version": "1.0.0",
  "questionnaire_version": "v0-demo",
  "total_score": 15,
  "risk_profile_bucket": "medium",
  "risk_aligned_industries": ["<mapped-industry-id>"],
  "industry_preference_comparison": {
    "selection_mode": "balanced_coverage",
    "user_selected_industries": [],
    "overlap_industries": [],
    "selected_outside_mapping": []
  }
}
```

### Mapping unavailable

If the policy is missing, incomplete, unsupported for the questionnaire version, or invalid, return a structured non-success result and do not emit a guessed industry list:

```json
{
  "mapping_status": "mapping_not_configured",
  "error_code": "MAPPING_POLICY_MISSING",
  "message": "No approved industry mapping policy is configured for this questionnaire version.",
  "questionnaire_version": "v0-demo",
  "total_score": 15,
  "risk_profile_bucket": "medium",
  "risk_aligned_industries": []
}
```

Use a suitable `error_code` such as `INVALID_RISK_RESULT`, `UNSUPPORTED_QUESTIONNAIRE_VERSION`, `INVALID_MAPPING_POLICY`, or `INVALID_INDUSTRY_PREFERENCE` for other validation failures. Error messages should state what needs correction without supplying a fabricated mapping.

## 6. Field meanings

| Field | Meaning |
|---|---|
| `mapping_status` | `mapped` when a valid policy was applied; otherwise a non-success status such as `mapping_not_configured` or `invalid_input`. |
| `mapping_policy_id` | Identifier of the approved mapping policy used. Present on successful mapping. |
| `mapping_policy_version` | Version of that policy, for reproducibility. Present on successful mapping. |
| `questionnaire_version` | Version of the questionnaire/scoring scheme that produced the score. |
| `total_score` | Validated upstream total score. |
| `risk_profile_bucket` | Validated upstream bucket (`low`, `medium`, or `high`). |
| `risk_aligned_industries` | Ordered industry suggestions obtained directly from the selected policy bucket. |
| `industry_preference_comparison` | Optional comparison to the user's independently captured preference. |
| `user_selected_industries` | The user's explicit choices, copied without being changed. Empty for `balanced_coverage`. |
| `overlap_industries` | Industries present in both explicit selections and the policy mapping. |
| `selected_outside_mapping` | Explicit user selections absent from the policy mapping; these remain user preferences and are not automatically rejected. |
| `error_code` | Stable machine-readable reason a mapping could not be produced. |
| `message` | Human-readable validation or configuration detail. |

### Status and error values

`mapping_status` has these values:

- `mapped`: the risk input and mapping policy were valid and the configured mapping was applied.
- `mapping_not_configured`: there is no applicable approved policy, including a missing policy or a policy that does not cover the questionnaire version.
- `invalid_input`: the risk result, policy structure, or supplied preference is malformed or inconsistent.

Use a stable `error_code` with these recommended values: `MAPPING_POLICY_MISSING`, `UNSUPPORTED_QUESTIONNAIRE_VERSION`, `INVALID_MAPPING_POLICY`, `INVALID_RISK_RESULT`, or `INVALID_INDUSTRY_PREFERENCE`. A success response omits `error_code` and `message`. A failure response includes them and returns no risk-aligned industries. If no preference was supplied, omit `industry_preference_comparison`; do not manufacture a `balanced_coverage` choice.

## 7. Error and edge-case rules

- Missing or partial questionnaire answers must be rejected upstream; this capability does not calculate partial scores.
- A `total_score` and `risk_profile_bucket` that disagree must be rejected, not reconciled by guessing which field is correct.
- Unknown questionnaire versions require a policy that explicitly supports them. Never apply `v0-demo` bands or mappings to a different questionnaire version implicitly.
- Missing, incomplete, or invalid mappings produce no mapped industries.
- Unsupported industry identifiers in the policy or preference input are validation errors.
- A score exactly on a band boundary follows the source ranges: 11 is `low`, 12 is `medium`, 16 is `medium`, and 17 is `high` for `v0-demo`.
- An empty selected-industry list is only valid with `selection_mode: "balanced_coverage"`; it is not the same as missing preference input.
- An explicit industry choice outside the risk mapping is surfaced in `selected_outside_mapping`; this capability does not erase or override it.

## 8. Downstream use

Pass `risk_aligned_industries` and `industry_preference_comparison` to the later recommendation capability alongside the original `industry_preference`, the risk result, and the supplied company data. The recommendation capability must have its own documented rule for whether suggestions filter candidates, affect ranking, or are only displayed. Do not assume that rule here.

Keep the following concepts as separate fields throughout the workflow:

- questionnaire risk result (`total_score`, `risk_profile_bucket`)
- policy-derived suggestion (`risk_aligned_industries`)
- user's explicit industry preference (`industry_preference`)
- industry assigned to each company (`company.industry`)

## 9. Policy approval and constraints

The mapping table is a product decision and must be reviewed before the capability is used to personalize or filter investment options. Sector labels alone do not establish the risk of an individual company or product. Company-level risk can vary substantially within an industry, so this output must not be described as a guarantee of suitability or safety.

The source questionnaire is a provisional demo scoring proposal, not a validated psychometric instrument or official suitability assessment. It combines stated willingness, basic capacity indicators, and stated return expectations. Preserve that limitation in downstream user-facing claims and complete the China-specific legal review identified by the source materials before using the questionnaire to personalize, filter, or recommend investment products.

## 10. Source documents

This contract reconciles the following project materials:

- `finmatch-risk-questionnaire-capability-io.md` — input validation, score output, and demo score bands.
- `finmatch-risk-questionnaire-scoring.md` — seven questionnaire answers, score meaning, and provisional status.
- `finmatch-industry-preference-capability.md` — canonical industry IDs and `selected` / `balanced_coverage` semantics.
- `Flagship Applications Revised.docx` — FinMatch / Tinder Investment Discovery intent to use risk comfort and industry preferences to narrow investment choices.
- `Milestone1-Platform.md` — platform capability contracts and compatibility expectations.
