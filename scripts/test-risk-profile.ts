import assert from "node:assert/strict";
import {
  completedRiskProfileSchema,
  riskProfileInputSchema,
  riskProfileResultSchema,
  riskQuestionnaireDefinition,
  scoreRiskProfile,
  type RiskProfileInput,
} from "../apps/web/starter/project/src/lib/risk-profile";

const catalog = await Bun.file(
  new URL("../apps/web/src/lib/capability.json", import.meta.url),
).json();
const capability = catalog.capabilities.find(
  (entry: { id: string }) => entry.id === "risk-profile",
);
assert.deepEqual(riskQuestionnaireDefinition, capability.questionnaire_definition);

const example: RiskProfileInput = {
  questionnaire_version: "v0-demo",
  answers: { q1: 3, q2: 2, q3: 3, q4: 2, q5: 1, q6: 2, q7: 2 },
};
assert.deepEqual(scoreRiskProfile(example), capability.output_example);
const ids = riskQuestionnaireDefinition.questions.map((question) => question.id);
const thresholds = new Set<number>();
for (let combination = 0; combination < 3 ** 7; combination++) {
  let remaining = combination;
  const values = ids.map(() => {
    const answer = (remaining % 3) + 1;
    remaining = Math.floor(remaining / 3);
    return answer;
  });
  const input = {
    questionnaire_version: "v0-demo",
    answers: Object.fromEntries(ids.map((id, index) => [id, values[index]])),
  };
  const result = scoreRiskProfile(input);
  assert.equal(result.status, "completed");
  if (result.status !== "completed") throw new Error("Expected completed result");
  const sum = values.reduce((total, answer) => total + answer, 0);
  assert.deepEqual(result, {
    status: "completed",
    ...input,
    total_score: sum,
    risk_profile_bucket: sum < 12 ? "low" : sum < 17 ? "medium" : "high",
  });
  assert.deepEqual(completedRiskProfileSchema.parse(result), result);
  assert.deepEqual(riskProfileResultSchema.parse(result), result);
  if ([11, 12, 16, 17].includes(sum)) thresholds.add(sum);
  for (const tampered of [
    { ...result, total_score: sum === 21 ? 20 : sum + 1 },
    { ...result, risk_profile_bucket: result.risk_profile_bucket === "low" ? "high" : "low" },
    { ...result, answers: { ...result.answers, q1: result.answers.q1 === 3 ? 2 : 3 } },
  ]) {
    assert.equal(completedRiskProfileSchema.safeParse(tampered).success, false);
    assert.equal(riskProfileResultSchema.safeParse(tampered).success, false);
  }
}
assert.deepEqual(
  [...thresholds].sort((a, b) => a - b),
  [11, 12, 16, 17],
);

const invalidValues: unknown[] = [
  undefined,
  null,
  true,
  false,
  "1",
  "2",
  "3",
  "",
  0,
  4,
  -1,
  1.5,
  NaN,
  Infinity,
  -Infinity,
  [],
  {},
  [1],
  1n,
  Symbol("answer"),
  () => 1,
];
const invalidInputs: unknown[] = [
  ...invalidValues,
  1,
  2,
  3,
  {},
  { answers: example.answers },
  { questionnaire_version: "v0-demo" },
  { ...example, extra: true },
  { ...example, answers: { ...example.answers, q8: 1 } },
];
for (const version of [...invalidValues, "v1", "v0", "V0-DEMO"]) {
  invalidInputs.push({ ...example, questionnaire_version: version });
}
for (const answers of invalidValues) invalidInputs.push({ ...example, answers });
for (const id of ids) {
  const missing: Partial<RiskProfileInput["answers"]> = { ...example.answers };
  delete missing[id];
  invalidInputs.push({ ...example, answers: missing });
  for (const value of invalidValues)
    invalidInputs.push({ ...example, answers: { ...example.answers, [id]: value } });
}
for (const input of invalidInputs) {
  assert.equal(riskProfileInputSchema.safeParse(input).success, false);
  const result = scoreRiskProfile(input);
  assert.equal(result.status, "invalid_input");
  assert.deepEqual(Object.keys(result).sort(), ["error_code", "message", "status"]);
  assert.equal(riskProfileResultSchema.safeParse(result).success, true);
}

const completed = scoreRiskProfile(example);
if (completed.status !== "completed") throw new Error("Expected completed example");
for (const key of Object.keys(completed)) {
  const missing = { ...completed } as Record<string, unknown>;
  delete missing[key];
  assert.equal(completedRiskProfileSchema.safeParse(missing).success, false);
  assert.equal(riskProfileResultSchema.safeParse(missing).success, false);
}
for (const invalid of [
  null,
  {},
  true,
  [],
  { ...completed, timestamp: "2026-10-15" },
  { ...completed, questionnaire_version: "v1" },
  { ...completed, status: "invalid_input" },
  { ...completed, total_score: "15" },
  { ...completed, total_score: 15.5 },
  { ...completed, total_score: 6 },
  { ...completed, total_score: 22 },
  { ...completed, risk_profile_bucket: "Medium" },
  { ...completed, answers: { ...example.answers, q8: 1 } },
  { status: "invalid_input", error_code: "INVALID_INPUT", message: "Invalid", total_score: 15 },
  {
    status: "invalid_input",
    error_code: "INVALID_INPUT",
    message: "Invalid",
    risk_profile_bucket: "medium",
  },
  { status: "invalid_input", error_code: "", message: "Invalid" },
  { status: "invalid_input", error_code: "INVALID_INPUT" },
]) {
  assert.equal(completedRiskProfileSchema.safeParse(invalid).success, false);
  assert.equal(riskProfileResultSchema.safeParse(invalid).success, false);
}

const source = await Bun.file(
  new URL("../apps/web/starter/project/src/components/risk-questionnaire.tsx", import.meta.url),
).text();
assert.match(source, /useState<Partial<RiskProfileInput\["answers"\]>>\(\{\}\)/);
assert.doesNotMatch(
  source,
  /localStorage|sessionStorage|useEffect|total_score|risk_profile_bucket|JSON\.stringify|scoreRiskProfile/,
);
assert.equal(source.match(/cd80\.storage\.write\(/g)?.length, 1);
assert.match(source, /cd80\.storage\.read\(storageKey, completedRiskProfileSchema\)/);
assert.match(source, /const storageKey = "risk-profile"/);
assert.match(
  source,
  /completedRiskProfileSchema\.parse\(result\);\s*await cd80\.storage\.write\(storageKey, completed\)/,
);
assert.match(source, /if \(result\.status !== "completed"\) throw/);
assert.match(source, /cd80\.finance\.riskProfile\(input\)/);
assert.match(source, /onChange=\{\(\) =>\s*setAnswers\(\(current\) => \(\{/);
assert.match(source, /type="radio"\s*name=\{question\.id\}\s*value=\{choice\.label\}/);
assert.match(source, /<FieldSet key=\{question\.id\} disabled=\{submit\.isPending\}>/);
assert.match(source, /disabled=\{!input\.success \|\| submit\.isPending\}/);
assert.match(
  source,
  /disabled=\{submit\.isPending\}\s*onClick=\{\(\) => \{\s*setAnswers\(\{\}\);\s*submit\.reset\(\);\s*setRetaking\(false\);/,
);
assert.match(source, /Questionnaire completed\./);
assert.match(source, /onCompleted\?\.\(result\)/);
assert.doesNotMatch(
  source,
  /\{(?:result|completed|stored\.data|submit\.data)(?:\.|\})|\{choice\.score\}/,
);

console.log(
  `Risk profile tests passed: 2187 combinations, all thresholds, ${invalidInputs.length} invalid inputs, tampered results, exact catalog wording, and UI source guards.`,
);
