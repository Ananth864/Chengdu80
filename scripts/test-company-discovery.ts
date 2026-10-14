import assert from "node:assert/strict";
import {
  advanceDiscoverySession,
  companyDiscoveryInputSchema,
  createDiscoverySession,
  discoveryCompanySchema,
  discoveryIndustries,
  discoveryResultSchema,
  discoverySessionSchema,
  normalizedIndustryPreferenceSchema,
  type DiscoveryCompany,
} from "../apps/web/starter/project/src/lib/company-discovery";
import { scoreRiskProfile } from "../apps/web/starter/project/src/lib/risk-profile";

const capabilityCatalog = await Bun.file(
  new URL("../apps/web/src/lib/capability.json", import.meta.url),
).json();
const industries = capabilityCatalog.capabilities.find(
  (entry: { id: string }) => entry.id === "industry-preferences",
).supported_industries;
assert.deepEqual(
  discoveryIndustries,
  Object.fromEntries(
    industries.map((entry: { id: string; csv_value: string }) => [entry.id, entry.csv_value]),
  ),
);
const ids = Object.keys(discoveryIndustries) as (keyof typeof discoveryIndustries)[];
const all = { selection_mode: "all_supported", selected_industries: [], effective_industries: ids };
const selected = (values: typeof ids) => ({
  selection_mode: "selected",
  selected_industries: values,
  effective_industries: values,
});
const sizes = ["Large cap", "Mid cap", "Small cap"] as const;
const companies: DiscoveryCompany[] = sizes.flatMap((size_category, sizeIndex) =>
  ids.map((id, index) => ({
    exchange: "SSE",
    ticker: String(600000 + sizeIndex * 10 + index),
    name: `Fixture ${sizeIndex}-${index}`,
    industry: discoveryIndustries[id],
    market_cap_rmb: 0,
    size_category,
  })),
);
const risk = (answer: number) =>
  scoreRiskProfile({
    questionnaire_version: "v0-demo",
    answers: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`q${index + 1}`, answer])),
  });
const input = { risk_result: risk(1), industry_preference: all, watchlist: [] as string[] };
const options = { random: () => 0.999, sessionId: "fixture" };
const create = (raw: unknown = input, records: unknown = companies) => {
  const result = createDiscoverySession(raw, records, options);
  assert.deepEqual(discoveryResultSchema.parse(result), result);
  return result;
};

// Every answer combination, crossed with every nonempty industry subset and the empty selection.
for (let combination = 0; combination < 3 ** 7; combination++) {
  let remaining = combination;
  const answers = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => {
      const value = (remaining % 3) + 1;
      remaining = Math.floor(remaining / 3);
      return [`q${index + 1}`, value];
    }),
  );
  const completed = scoreRiskProfile({ questionnaire_version: "v0-demo", answers });
  assert.equal(completed.status, "completed");
  if (completed.status !== "completed") throw new Error("Expected completed risk");
  const target = sizes[completed.total_score <= 11 ? 0 : completed.total_score <= 16 ? 1 : 2];
  for (let mask = 0; mask < 32; mask++) {
    const chosen = ids.filter((_, index) => mask & (1 << index));
    const preference = mask ? selected(chosen) : all;
    const result = create({ ...input, risk_result: completed, industry_preference: preference });
    assert.equal(result.status, "ready");
    if (result.status !== "ready") throw new Error("Expected ready");
    assert.equal(result.target_size_category, target);
    assert.equal(result.eligible_company_count, mask ? chosen.length : 5);
    assert.equal(result.current_round, 1);
    assert.equal(result.session_state.round_index, 0);
    assert.deepEqual(result.session_state.exposed_company_ids, [result.ordered_company_ids[0]]);
    assert.equal(result.current_company.size_category, target);
    for (const id of result.ordered_company_ids) {
      const company = companies.find((entry) => `SSE:${entry.ticker}` === id)!;
      assert.equal(company.size_category, target);
      assert.ok(
        (mask ? chosen : ids).some(
          (industry) => discoveryIndustries[industry] === company.industry,
        ),
      );
    }
    assert.equal("companies" in result, false);
    assert.equal(Array.isArray(result.current_company), false);
  }
}

for (const preference of [
  null,
  {},
  { ...all, extra: true },
  { ...all, selection_mode: "selected" },
  { ...all, selected_industries: [ids[0]] },
  { ...all, effective_industries: ids.slice(1) },
  { ...all, effective_industries: [...ids.slice(1), ids[1]] },
  selected([]),
  selected([ids[0]!, ids[0]!]),
  { ...all, effective_industries: ["unknown"] },
  { ...selected([ids[0]!]), effective_industries: ids },
  { ...selected([ids[0]!, ids[1]!]), effective_industries: [ids[1], ids[0]] },
]) {
  assert.equal(normalizedIndustryPreferenceSchema.safeParse(preference).success, false);
  assert.equal(create({ ...input, industry_preference: preference }).status, "invalid_input");
}
assert.ok(
  normalizedIndustryPreferenceSchema.safeParse({ ...all, effective_industries: [...ids].reverse() })
    .success,
);
const completed = risk(1);
if (completed.status !== "completed") throw new Error("Expected completed");
for (const raw of [
  null,
  {},
  { ...input, extra: true },
  { ...input, watchlist: ["600000"] },
  { ...input, watchlist: ["SSE:000001"] },
  { ...input, watchlist: [600000] },
  ...[
    { ...completed, total_score: 8 },
    { ...completed, risk_profile_bucket: "high" },
    { ...completed, questionnaire_version: "v1" },
    { ...completed, status: "partial" },
    { ...completed, answers: { ...completed.answers, q1: 2 } },
    { ...completed, answers: { q1: 1 } },
  ].map((risk_result) => ({ ...input, risk_result })),
]) {
  assert.equal(companyDiscoveryInputSchema.safeParse(raw).success, false);
  const result = create(raw);
  assert.equal(result.status, "invalid_input");
  assert.deepEqual(Object.keys(result).sort(), ["error_code", "message", "status"]);
}
for (const records of [null, {}, "catalog"])
  assert.equal(create(input, records).status, "invalid_input");

const base = companies[0]!;
const invalidRecords: unknown[] = [
  null,
  {},
  { ...base, exchange: "SZSE" },
  { ...base, ticker: 600000 },
  { ...base, ticker: "000001" },
  { ...base, ticker: "60000" },
  { ...base, name: " " },
  { ...base, industry: "Manufacturing" },
  { ...base, industry: "采矿业" },
  { ...base, size_category: "large" },
  { ...base, size_category: undefined },
  { ...base, market_cap_rmb: -1 },
  { ...base, market_cap_rmb: Infinity },
  { ...base, market_cap_rmb: NaN },
  { ...base, market_cap_rmb: "1" },
];
for (const record of invalidRecords)
  assert.equal(discoveryCompanySchema.safeParse(record).success, false);
for (const prefix of ["600", "601", "603", "605", "688", "689"])
  assert.ok(discoveryCompanySchema.safeParse({ ...base, ticker: `${prefix}001` }).success);
const excluded = create(input, [...invalidRecords, companies[1]]);
assert.equal(excluded.status, "ready");
if (excluded.status !== "ready") throw new Error("Expected valid record to survive");
assert.equal(excluded.catalog_validation.excluded_record_count, invalidRecords.length);
assert.deepEqual(
  excluded.catalog_validation.errors.map((entry) => entry.record_index),
  invalidRecords.map((_, index) => index),
);
assert.equal(excluded.current_company.ticker, companies[1]!.ticker);
for (const conflict of [
  { ...base, name: "Conflicting" },
  { ...base, market_cap_rmb: 1 },
  { ...base, industry: "unsupported" },
]) {
  const result = create(input, [base, { ...base }, conflict, companies[1]]);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("Expected unaffected company");
  assert.equal(result.catalog_validation.excluded_record_count, 3);
  assert.ok(result.catalog_validation.errors.every((entry) => /Conflicting/.test(entry.reason)));
  assert.deepEqual(result.ordered_company_ids, [`SSE:${companies[1]!.ticker}`]);
}
const dedup = create(input, [base, { ...base }]);
assert.equal(dedup.status, "ready");
if (dedup.status !== "ready") throw new Error("Expected dedup ready");
assert.equal(dedup.eligible_company_count, 1);
assert.equal(dedup.catalog_validation.excluded_record_count, 1);
for (let count = 0; count <= 7; count++) {
  const pool = Array.from({ length: count }, (_, index) => ({
    ...base,
    ticker: String(601000 + index),
  }));
  let randomCalls = 0;
  const result = createDiscoverySession(input, pool, {
    sessionId: "pool",
    random: () => {
      randomCalls++;
      return 0;
    },
  });
  assert.ok(discoveryResultSchema.safeParse(result).success);
  assert.equal(randomCalls, Math.max(0, count - 1));
  if (!count) {
    assert.equal(result.status, "exhausted");
    continue;
  }
  if (result.status !== "ready") throw new Error("Expected pool ready");
  assert.equal(result.total_rounds, Math.min(count, 5));
  assert.equal(result.eligible_company_count, count);
  assert.equal(result.ordered_company_ids[0], `SSE:${pool[count === 1 ? 0 : 1]!.ticker}`);
  let state = result.session_state;
  const seen = new Set<string>();
  let additions = 0;
  for (let round = 0; round < result.total_rounds; round++) {
    const id = state.ordered_company_ids[state.round_index]!;
    assert.equal(seen.has(id), false);
    seen.add(id);
    const choice = round % 2 ? "skip" : "add";
    const advanced = advanceDiscoverySession(state, id, choice, pool);
    assert.deepEqual(discoveryResultSchema.parse(advanced), advanced);
    assert.notEqual(advanced.status, "invalid_input");
    if (advanced.status === "invalid_input") throw new Error("Expected transition");
    if (choice === "add") {
      assert.deepEqual(advanced.watchlist_add, { exchange: "SSE", ticker: id.slice(4) });
      additions++;
    } else assert.equal("watchlist_add" in advanced, false);
    state = advanced.session_state;
    assert.equal(advanceDiscoverySession(state, id, choice, pool).status, "invalid_input");
    assert.equal(
      advanced.status,
      round + 1 === result.total_rounds ? "session_completed" : "ready",
    );
    if (advanced.status === "ready")
      assert.equal(advanced.current_company.ticker, state.ordered_company_ids[round + 1]!.slice(4));
  }
  assert.equal(additions, Math.ceil(result.total_rounds / 2));
  assert.equal(state.round_index, result.total_rounds);
  assert.deepEqual(state.exposed_company_ids, state.ordered_company_ids);
  assert.equal(randomCalls, Math.max(0, count - 1));
}

const ready = create();
if (ready.status !== "ready") throw new Error("Expected ready");
const state = ready.session_state;
for (const bad of [
  { ...state, round_index: -1 },
  { ...state, round_index: 0.5 },
  { ...state, round_index: 6 },
  { ...state, ordered_company_ids: [] },
  { ...state, ordered_company_ids: [...state.ordered_company_ids, "SSE:601999"] },
  { ...state, ordered_company_ids: [state.ordered_company_ids[0], state.ordered_company_ids[0]] },
  { ...state, exposed_company_ids: [] },
  { ...state, exposed_company_ids: state.ordered_company_ids },
  { ...state, exposed_company_ids: [state.ordered_company_ids[1]] },
  { ...state, extra: true },
]) {
  assert.equal(discoverySessionSchema.safeParse(bad).success, false);
  assert.equal(
    advanceDiscoverySession(bad, state.ordered_company_ids[0]!, "add", companies).status,
    "invalid_input",
  );
}
for (const bad of [
  { ...ready, current_round: 2 },
  { ...ready, total_rounds: 4 },
  { ...ready, session_id: "other" },
  { ...ready, metric_request_company_ids: [state.ordered_company_ids[1]] },
  { ...ready, metric_request_company_ids: state.ordered_company_ids },
  { ...ready, current_company: companies[1] },
  { ...ready, target_size_category: "Small cap" },
  { ...ready, eligible_company_count: 4 },
  { ...ready, companies },
])
  assert.equal(discoveryResultSchema.safeParse(bad).success, false);
assert.equal(
  advanceDiscoverySession(state, state.ordered_company_ids[1]!, "add", companies).status,
  "invalid_input",
);
assert.equal(
  advanceDiscoverySession(state, state.ordered_company_ids[0]!, "add", []).status,
  "invalid_input",
);
assert.equal(
  advanceDiscoverySession(state, state.ordered_company_ids[0]!, "add", [
    ...companies,
    { ...base, name: "Conflict" },
  ]).status,
  "invalid_input",
);

assert.equal(
  create({ ...input, industry_preference: selected(["utilities"]) }, [base]).status,
  "exhausted",
);
assert.equal(create({ ...input, risk_result: risk(3) }, [base]).status, "exhausted");
assert.equal(create(input, []).status, "exhausted");
const one = create(input, [base]);
if (one.status !== "ready") throw new Error("Expected single company");
assert.equal(
  advanceDiscoverySession(one.session_state, `SSE:${base.ticker}`, "skip", [base]).status,
  "session_completed",
);
assert.equal(create(input, [base]).status, "ready"); // Skips are not a persistent blacklist.
const saved = { ...input, watchlist: [`SSE:${base.ticker}`] };
assert.equal(create(saved, [base]).status, "exhausted");
assert.equal(create({ ...saved, watchlist: [] }, [base]).status, "ready");
for (const random of [() => NaN, () => Infinity, () => -0.1, () => 1])
  assert.equal(createDiscoverySession(input, companies, { random }).status, "invalid_input");
assert.equal(createDiscoverySession(input, companies, { sessionId: " " }).status, "invalid_input");
assert.ok(discoveryResultSchema.safeParse(createDiscoverySession(input, companies)).success);
assert.ok(
  discoveryResultSchema.safeParse(
    createDiscoverySession(input, companies, { sessionId: " fixture " }),
  ).success,
);
console.log(
  "Company discovery tests passed: 2187 risk combinations x 32 industry filters, strict upstream contracts, catalog exclusions/conflicts/deduplication, pool sizes, one shuffle, round actions, replay rejection, and later-session eligibility.",
);
