import assert from "node:assert/strict";
import {
  discoveryIndustries,
  normalizedIndustryPreferenceSchema,
} from "../apps/web/starter/project/src/lib/company-discovery";
import {
  capturePreferences,
  filterCompanies,
  industryPreferenceInputSchema,
  industryPreferenceRequestSchema,
  industryPreferenceResultSchema,
  runIndustryPreference,
  supportedIndustries,
} from "../apps/web/starter/project/src/lib/industry-preference";

assert.deepEqual(supportedIndustries, [
  { id: "manufacturing", label: "Manufacturing", csv_value: "制造业" },
  {
    id: "information_software_it",
    label: "Information transmission, software and IT services",
    csv_value: "信息传输、软件和信息技术服务业",
  },
  {
    id: "utilities",
    label: "Electricity, heat, gas and water production and supply",
    csv_value: "电力、热力、燃气及水生产和供应业",
  },
  { id: "financial_services", label: "Financial services", csv_value: "金融业" },
  { id: "wholesale_retail", label: "Wholesale and retail", csv_value: "批发和零售业" },
]);
assert.deepEqual(
  Object.fromEntries(supportedIndustries.map(({ id, csv_value }) => [id, csv_value])),
  discoveryIndustries,
);
const ids = supportedIndustries.map(({ id }) => id);
const companies = [
  ...supportedIndustries.map(({ id, csv_value }, index) => ({
    id,
    industry: csv_value,
    arbitrary: { index, retained: true },
    extra: [index],
  })),
  { id: "unsupported", industry: "采矿业", arbitrary: { index: 5, retained: true }, extra: [5] },
];
const original = structuredClone(companies);

for (let mask = 0; mask < 32; mask++) {
  const selected = ids.filter((_, index) => mask & (1 << index));
  const input = { selected_industries: selected };
  assert.deepEqual(industryPreferenceInputSchema.parse(input), input);
  const result = capturePreferences(input);
  assert.equal(result.status, "completed");
  if (result.status !== "completed") throw new Error("Expected completed preference");
  assert.deepEqual(result.industry_preference, {
    selection_mode: mask ? "selected" : "all_supported",
    selected_industries: selected,
    effective_industries: mask ? selected : ids,
  });
  assert.deepEqual(industryPreferenceResultSchema.parse(result), result);
  assert.deepEqual(
    normalizedIndustryPreferenceSchema.parse(result.industry_preference),
    result.industry_preference,
  );
  const request = { operation: "capture_preferences", ...input };
  assert.deepEqual(industryPreferenceRequestSchema.parse(request), request);
  assert.deepEqual(runIndustryPreference(request), result);
  assert.deepEqual(input.selected_industries, selected);

  // Translate effective IDs, including all_supported, rather than using an empty label filter.
  const labels = result.industry_preference.effective_industries.map(
    (id) => discoveryIndustries[id],
  );
  const expected = companies.filter((company) =>
    (mask ? selected : ids).some((id) => discoveryIndustries[id] === company.industry),
  );
  assert.deepEqual(filterCompanies(companies, labels), expected);
  const filtered = runIndustryPreference({
    operation: "filter_companies",
    companies,
    industry_labels: labels,
  });
  assert.deepEqual(filtered, { status: "completed", companies: expected });
  assert.deepEqual(industryPreferenceResultSchema.parse(filtered), filtered);
  assert.equal(
    expected.some((company) => company.id === "unsupported"),
    false,
  );
}

const reversed = [...ids].reverse();
const duplicateInput = { selected_industries: [...reversed, ...ids, reversed[0]] };
assert.ok(industryPreferenceInputSchema.safeParse(duplicateInput).success);
const deduped = capturePreferences(duplicateInput);
assert.deepEqual(deduped, {
  status: "completed",
  industry_preference: {
    selection_mode: "selected",
    selected_industries: reversed,
    effective_industries: reversed,
  },
});
assert.deepEqual(
  runIndustryPreference({ operation: "capture_preferences", ...duplicateInput }),
  deduped,
);
assert.equal(duplicateInput.selected_industries.length, 11);

const invalidCaptures: unknown[] = [
  undefined,
  null,
  {},
  [],
  "manufacturing",
  { selected_industries: undefined },
  { selected_industries: null },
  { selected_industries: "manufacturing" },
  { selected_industries: {} },
  { selected_industries: [], risk_result: {} },
  { selected_industries: [], companies: [] },
  { answers: { q1: 1 } },
  ...[
    "technology",
    "finance",
    "agriculture",
    "fmcg",
    "energy",
    "unknown",
    "Manufacturing",
    discoveryIndustries.manufacturing,
    " manufacturing",
    "manufacturing ",
    "",
    1,
    false,
    null,
    undefined,
    {},
    [],
  ].map((value) => ({ selected_industries: ["manufacturing", value] })),
];
for (const input of invalidCaptures) {
  assert.equal(industryPreferenceInputSchema.safeParse(input).success, false);
  const result = capturePreferences(input);
  assert.equal(result.status, "invalid_input");
  assert.deepEqual(Object.keys(result).sort(), ["error_code", "message", "status"]);
  assert.deepEqual(industryPreferenceResultSchema.parse(result), result);
  if (input && typeof input === "object" && !Array.isArray(input))
    assert.equal(
      runIndustryPreference({ ...input, operation: "capture_preferences" }).status,
      "invalid_input",
    );
}

assert.deepEqual(filterCompanies(companies, []), companies);
assert.deepEqual(filterCompanies([], []), []);
assert.deepEqual(filterCompanies(companies, ["missing"]), []);
assert.deepEqual(filterCompanies(companies, ["制造"]), []);
assert.deepEqual(filterCompanies(companies, ["Manufacturing"]), []);
assert.deepEqual(filterCompanies(companies, ["制造业 "]), []);
assert.deepEqual(filterCompanies(companies, ["制造业", "制造业"]), [companies[0]]);
const repeated = [companies[4], companies[0], companies[4], companies[1]];
assert.deepEqual(filterCompanies(repeated, ["制造业", "批发和零售业"]), repeated.slice(0, 3));
assert.deepEqual(
  runIndustryPreference({
    operation: "filter_companies",
    companies,
    industry_labels: [],
  }),
  { status: "completed", companies },
);

const invalidRecords: unknown[] = [
  undefined,
  null,
  {},
  "catalog",
  [null],
  [[]],
  [{}],
  [{ industry: "" }],
  [{ industry: 1 }],
  [{ industry: null }],
  [companies[0], { industry: false }],
];
for (const records of invalidRecords) {
  for (const labels of [[], ["missing"]]) assert.throws(() => filterCompanies(records, labels));
  assert.equal(
    runIndustryPreference({
      operation: "filter_companies",
      companies: records,
      industry_labels: [],
    }).status,
    "invalid_input",
  );
}
for (const labels of [undefined, null, {}, "制造业", [""], [1], [null], ["制造业", false]]) {
  assert.throws(() => filterCompanies(companies, labels));
  assert.throws(() => filterCompanies([], labels));
  assert.equal(
    runIndustryPreference({
      operation: "filter_companies",
      companies,
      industry_labels: labels,
    }).status,
    "invalid_input",
  );
}
for (const raw of [
  undefined,
  null,
  {},
  { selected_industries: [] },
  { operation: "unknown", selected_industries: [] },
  { operation: "capture_preferences" },
  { operation: "filter_companies", companies },
  { operation: "filter_companies", industry_labels: [] },
  { operation: "filter_companies", companies, industry_labels: [], risk_result: {} },
]) {
  assert.equal(industryPreferenceRequestSchema.safeParse(raw).success, false);
  const result = runIndustryPreference(raw);
  assert.equal(result.status, "invalid_input");
  assert.deepEqual(Object.keys(result).sort(), ["error_code", "message", "status"]);
  assert.deepEqual(industryPreferenceResultSchema.parse(result), result);
}

const all = capturePreferences({ selected_industries: [] });
assert.equal(all.status, "completed");
if (all.status !== "completed") throw new Error("Expected completed preference");
for (const preference of [
  { ...all.industry_preference, effective_industries: [...ids, "energy"] },
  { ...all.industry_preference, effective_industries: ids.slice(1) },
  { ...all.industry_preference, effective_industries: [ids[0], ...ids.slice(0, 4)] },
  { ...all.industry_preference, selected_industries: [ids[0]] },
  { selection_mode: "selected", selected_industries: [], effective_industries: [] },
  { selection_mode: "selected", selected_industries: [ids[0]], effective_industries: ids },
]) {
  assert.equal(normalizedIndustryPreferenceSchema.safeParse(preference).success, false);
  assert.equal(
    industryPreferenceResultSchema.safeParse({
      status: "completed",
      industry_preference: preference,
    }).success,
    false,
  );
}
assert.equal(
  industryPreferenceResultSchema.safeParse({
    status: "invalid_input",
    error_code: "INVALID_INPUT",
    message: "Invalid",
    industry_preference: all.industry_preference,
  }).success,
  false,
);
assert.deepEqual(companies, original);
console.log(
  "Industry preference tests passed: 32 subsets, normalization, exact filtering and operation validation.",
);
