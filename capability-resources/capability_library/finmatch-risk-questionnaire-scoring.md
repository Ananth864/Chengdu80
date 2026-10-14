# FinMatch Risk Questionnaire and Scoring

**Developer draft** · Three answer choices per question · Risk profile buckets: Low, Medium, High

## Purpose

Collect a beginner-friendly snapshot of a user’s stated risk willingness and basic ability to absorb losses in the FinMatch application. This demo proposal uses original wording and transparent rules; it is not a validated psychometric instrument or an official suitability assessment.

## Questionnaire questions

Each question has exactly three scored choices. All seven questions must be answered before submission. For the demo, an incomplete attempt is discarded and does not produce a risk profile.

### 1. Comfort with investment fluctuations

**How comfortable are you with the value of an investment moving up and down over time?**

- **Low (1):** I prefer small changes in value, even if potential growth may be lower.
- **Medium (2):** I can accept some ups and downs for potential long-term growth.
- **High (3):** I can accept large ups and downs for potential long-term growth.

### 2. Reaction to a loss

**Imagine you invest RMB 10,000 and its value falls to RMB 8,000 for a time. What would you most likely do?**

- **Low (1):** Sell all or most of it to prevent further losses.
- **Medium (2):** Hold it for now and review the situation before deciding.
- **High (3):** Stay with my plan, or add more if that was already part of my plan.

### 3. Tolerance for a temporary decline

**What temporary fall in the value of your investments could you tolerate without changing your plan?**

- **Low (1):** Up to 5%.
- **Medium (2):** More than 5% and up to 20%.
- **High (3):** More than 20%.

### 4. Risk and growth trade-off

**Which investment trade-off feels closest to you?**

- **Low (1):** Lower ups and downs, even if the potential for growth is more limited.
- **Medium (2):** A balance between ups and downs and potential long-term growth.
- **High (3):** More ups and downs in exchange for the possibility of higher long-term growth.

### 5. When the money may be needed

**When might you need to use the money you are considering investing?**

- **Low (1):** Within 1 year.
- **Medium (2):** In 1 to 3 years.
- **High (3):** More than 3 years from now.

### 6. Emergency savings buffer

**If your income stopped, how long could your savings cover essential expenses?**

- **Low (1):** Less than 1 month.
- **Medium (2):** From 1 month to 6 months.
- **High (3):** More than 6 months.

### 7. Expected one-year portfolio return

**What return do you expect your investment portfolio to achieve over the next year?**

- **Low (1):** Less than 10%.
- **Medium (2):** 10% to 20%.
- **High (3):** More than 20%.

This records the user's stated return expectation for behavioral analysis. It is not a forecast, a promised return, or an indication that the expectation is achievable.

## Demo scoring method

For the demo, use one simple score across all seven answers. Each choice is scored consistently: 1 is the lower response, 2 is the middle response, and 3 is the higher response. This total combines stated willingness, basic capacity indicators, and the user's return expectation; it is not a pure measure of risk appetite or a validated assessment.

### Calculate the total score and bucket

Add the scores for Questions 1–7. The total ranges from 7 to 21.

| Questions 1–7 total | Demo risk profile bucket |
|---:|---|
| 7–11 | Low |
| 12–16 | Medium |
| 17–21 | High |

## Developer output fields

```json
{
  "questionnaire_version": "v0-demo",
  "answers": {"q1": 3, "q2": 2, "q3": 3, "q4": 2, "q5": 1, "q6": 2, "q7": 2},
  "total_score": 15,
  "risk_profile_bucket": "medium"
}
```

## Implementation and validation notes

- Use the bucket as an internal demo profile, not as a promise about returns or a guarantee that an asset is suitable.
- Do not label this result C1–C5 or describe it as an official or validated assessment. The scoring bands are provisional demo rules.
- Require all seven answers. Do not save an incomplete attempt or calculate a partial score; the user starts again if they leave before completing.
- Keep the score and bucket hidden from the user; they are for application logic and later capabilities.
- Localize and test the Simplified Chinese wording, especially the loss scenario and percentage ranges.
- Obtain China-specific legal review before using the questionnaire to personalize, filter, or recommend investment products. The rules that apply depend on the app’s actual service and business relationships.

## Reference material

- [Securities Association of China investor suitability materials](https://www.sac.net.cn/flfg/zlgz/201706/t20170629_14339.html)
- [Grable–Lytton financial risk tolerance scale study](https://doi.org/10.1016/S1057-0810(99)00041-4)
- [China-focused household risk tolerance study](https://www.cfrn.com.cn/uploads/fileupload/7d4982a9801a4ea283221a49caea8970/paper/30f35777ae6c47008b04bbc5d29c3960.pdf)
- [CSRC investor suitability rules](https://www.csrc.gov.cn/csrc/c106256/c1653849/content.shtml)
- [CSRC explanation of the Financial Product Online Marketing Measures](https://www.csrc.gov.cn/csrc/c100028/c7628313/content.shtml)
