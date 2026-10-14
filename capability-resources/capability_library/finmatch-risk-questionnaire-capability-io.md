# FinMatch Risk Questionnaire Capability: Input and Output

**Status:** Demo scoring draft; uses question content from `finmatch-risk-questionnaire-scoring.md`  
**Capability:** Collect questionnaire answers, validate them, calculate the provisional risk profile, and return a machine-readable result.

## Scope

This capability collects the seven questionnaire answers and applies the simplified demo scoring defined in this file. It does not select, rank, or recommend investments, and the resulting bucket is an internal demo profile rather than an official suitability assessment.

## Capability brief for another LLM

Use this section as the standalone explanation of the capability:

> In the FinMatch application, present the user with the seven risk-questionnaire questions and their three choices as defined in `finmatch-risk-questionnaire-scoring.md`. Each question is single-select: the user must tick exactly one choice (Low=1, Medium=2, or High=3). Require an answer to all seven questions before accepting submission. Do not save a partial attempt; if the user exits before completing, they must start again. For a complete submission, preserve all seven numeric answers and add them to create one `total_score` from 7 to 21. Map 7–11 to `low`, 12–16 to `medium`, and 17–21 to `high`, and return that category as `risk_profile_bucket`. This is a simplified demo risk profile that combines stated willingness, basic capacity indicators, and stated return expectations; it is not a pure measure of risk appetite. Return the application-facing scoring object described below. Do not show the score or bucket to the user, explain the result to the user, map the result to industries, or generate investment suggestions in this capability. A separate later capability will use the risk profile with industry information; another capability will produce recommendations.

### Required source material

The exact question wording and answer labels are defined in `finmatch-risk-questionnaire-scoring.md`. The implementation or LLM building the UI must use those seven questions and three choices as written, subject to the separate localization work described in the source. This file defines the capability behavior and data exchange; it does not duplicate the questionnaire copy.

### User flow and behavior

1. Show all seven questions with their three answer choices.
2. Let the user select exactly one choice per question.
3. Do not allow submission until all seven questions have an answer.
4. If the user exits before completing all questions, discard the attempt. Do not persist partial answers or produce a score; the user starts from the beginning next time.
5. On complete submission, validate the answers, calculate the fields below, and return the application-facing result.
6. Do not show the score, bucket, or scoring explanation in the user interface. They are for application logic and later capabilities.

## Input contract

The UI presents each question as a single-select (tick-one) question. The user must select exactly one answer for each of the seven questions before submitting. Each answer is the selected score: `1` (Low), `2` (Medium), or `3` (High). The source question wording and choice labels are in `finmatch-risk-questionnaire-scoring.md`.

```json
{
  "questionnaire_version": "v0-demo",
  "answers": {
    "q1": 3,
    "q2": 2,
    "q3": 3,
    "q4": 2,
    "q5": 1,
    "q6": 2,
    "q7": 2
  }
}
```

### Validation and completion

- `questionnaire_version` must identify the demo questionnaire and scoring version (`v0-demo`).
- `answers` is an object with question keys `q1` through `q7`.
- A provided answer must be an integer from `1` to `3`.
- All seven answers are required to submit the questionnaire. Do not save partial answers; if the user leaves before completing it, they start again next time.
- Reject a submission that is missing one or more answers. Do not calculate or return a partial score or risk bucket.
- Reject unknown question keys and out-of-range or non-integer values.

## Output contract: complete submission

For a complete submission, calculate `total_score` by summing q1 through q7. Its range is 7–21. Map 7–11 to `low`, 12–16 to `medium`, and 17–21 to `high`; return this as `risk_profile_bucket`.

```json
{
  "questionnaire_version": "v0-demo",
  "answers": {"q1": 3, "q2": 2, "q3": 3, "q4": 2, "q5": 1, "q6": 2, "q7": 2},
  "total_score": 15,
  "risk_profile_bucket": "medium"
}
```

This output is application-facing scoring data. It does not include a timestamp or user-facing explanation. A later capability can use `risk_profile_bucket` with industry data and another capability can generate recommendations.

### Output field meanings

- `questionnaire_version`: identifies which question and scoring configuration produced the result.
- `answers`: the seven submitted numeric choices, keyed by question ID. Keep these for downstream application logic and traceability.
- `total_score`: sum of the seven answers; range 7–21.
- `risk_profile_bucket`: demo category derived from `total_score`; this is the primary field for the later industry-mapping capability.

### Scoring rules in implementation order

1. Sum all seven answer values to calculate `total_score` (minimum 7, maximum 21).
2. Map 7–11 to `low`, 12–16 to `medium`, and 17–21 to `high`.
3. Return the mapped category as `risk_profile_bucket`.

These bands are simple provisional cutoffs for a demo, not validated thresholds.

### Downstream handoff

Pass `risk_profile_bucket` as its own field to the later industry-mapping capability. Keep it separate from industry preferences and company industry data. This capability does not decide which industries correspond to a risk bucket. The subsequent recommendation capability consumes the mapped data and applies its own recommendation rules. Do not invent those mappings or recommendations here.

## Relationship to the source scoring draft

This capability uses the seven question prompts and answer choices from the source Markdown. For the demo, it uses one total score across all seven answers and the simple bands above. The total combines stated willingness, basic capacity indicators, and return expectations; it is not a pure risk-appetite measure or a validated assessment.

## Source constraints carried forward

- The questionnaire and scoring bands are provisional and are not a validated psychometric instrument or official suitability assessment.
- Require one selected answer for each question before submission. Do not save incomplete attempts or calculate a partial bucket.
- This demo score combines willingness and basic capacity indicators; do not describe it as a pure risk-appetite measure or a validated assessment.
- China-specific legal review is required before using the questionnaire to personalize, filter, or recommend investment products.
