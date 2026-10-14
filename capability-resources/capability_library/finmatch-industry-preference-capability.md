# FinMatch Industry Preference Capability

**Developer draft** · Application 2: FinMatch · Capability scope: collect and normalize industry preferences

## Purpose

Collect the industries a user wants to see in FinMatch and return them in a stable, machine-readable form. A later recommendation capability can combine these preferences with the user's risk profile and company data. This capability does not calculate risk, select companies, or rank recommendations.

## Functionality for an implementing LLM

Implement this capability as the industry-preference capture and normalization step in the FinMatch flow:

1. Present the six industry choices in the user-facing multiple-choice control using the display labels below. Allow the user to select any combination, including no selections.
2. Receive the selected industry values from the UI. Do not infer preferences from the user's risk answers or free text unless a separate product requirement adds that behavior.
3. Validate every value against the supported industry list. Remove duplicate values or return a validation error; never silently accept an unsupported industry.
4. Normalize the response into the output contract below. If one or more industries were chosen, set `selection_mode` to `selected` and return those values. If none were chosen, set `selection_mode` to `balanced_coverage` and return an empty list.
5. Pass the normalized preference object to the next application capability. Preserve it as a separate field from the risk profile so the downstream capability can apply both inputs independently.

The user-facing result is a confirmed preference selection. This capability does not itself choose or display stock companies. For `balanced_coverage`, the downstream recommendation capability must use the supplied Shanghai Stock Exchange company list to show one company from each of the six industries. For `selected`, the downstream capability should limit its candidate companies to the selected industries, then apply its separately defined risk-based selection rules.

### Functional flow

```text
User selects zero or more industries
              ↓
Validate values and normalize selection
              ↓
Return industry_preference
              ↓
Pass preference to recommendation capability
              ↓
Downstream capability combines it with risk profile and supplied SSE company list
```

## Market scope and company list

The initial market scope is China-listed stocks on the Shanghai Stock Exchange (SSE). FinMatch will use a company list supplied for the application. The list will include companies from all six supported industries. Each listed company will already be marked with exactly one of those industries. The recommendation capability should filter this supplied list using the user's preference output; this capability does not discover, classify, or fetch companies.

The supplied company list is context for the downstream recommendation step, not an input to preference capture. This capability's own input is only the user's selected industry values.

## User input

Show the user a multiple-choice list. Allow any combination of the following options, including selecting none:

| Stored value | Display label |
|---|---|
| `technology` | Technology |
| `finance` | Finance |
| `agriculture` | Agriculture |
| `manufacturing` | Manufacturing |
| `fmcg` | FMCG |
| `energy` | Energy |

The stored values are stable identifiers for data exchange. The display labels can be localized without changing stored preferences.

## Input contract

The UI submits selected values as an array. An empty array is a valid answer and means the user chose no industry preferences.

```json
{
  "selected_industries": ["technology", "energy"]
}
```

Example for no selection:

```json
{
  "selected_industries": []
}
```

### Input validation

- `selected_industries` is required and must be an array.
- Each item must exactly match one of the six stored values above.
- Duplicate values should be removed or rejected during validation; they must not create duplicate preferences.
- An empty array must be accepted and must not be treated as missing input.

If the input field is absent, has the wrong type, or contains an unknown value, return a clear validation error and request a valid selection. Do not reinterpret invalid input as the valid no-selection case.

## Output contract

Return a normalized preference object. Store the chosen industry values in `selected_industries`; this is the canonical preference record for downstream capabilities. Also return `selection_mode` so downstream logic can distinguish an explicit selection from the user's choice to receive broad coverage.

```json
{
  "industry_preference": {
    "selection_mode": "selected",
    "selected_industries": ["technology", "energy"]
  }
}
```

If the user selects none, return:

```json
{
  "industry_preference": {
    "selection_mode": "balanced_coverage",
    "selected_industries": []
  }
}
```

`balanced_coverage` means the downstream company recommendation capability should show one company from each of the six industries. The supplied company list is expected to contain companies from every industry. This behavior is represented as a mode rather than storing all six industries as user preferences: it preserves the difference between choosing no preference and explicitly selecting every industry.

## Passing preferences to risk-aware recommendations

Keep industry preference and risk profile as separate fields. The risk questionnaire capability already returns a `risk_profile_bucket` such as `low`, `medium`, or `high`; a later recommendation capability can consume that value alongside `industry_preference` and the company's single assigned industry.

For example, a downstream request could contain:

```json
{
  "risk_profile_bucket": "medium",
  "industry_preference": {
    "selection_mode": "selected",
    "selected_industries": ["technology", "energy"]
  }
}
```

This creates a clear join between the user's risk bucket and the industry attached to each company without duplicating or mixing the two preference records. The rules for how risk affects company selection belong to the separate recommendation capability.

## Company industry assumption

Each supplied SSE company record is assigned exactly one industry from the same six-value list. The company list must use the stored values, not free-text variants, so industry filtering and display remain consistent.

## Out of scope

- Risk questionnaire, risk scoring, or suitability assessment.
- Company selection, ranking, or recommendation explanations from the supplied list.
- Fetching or classifying SSE-listed companies.
- The logic for choosing which company to show from each industry.
- Brokerage actions or portfolio changes.
