import assert from "node:assert/strict";
import {
  discoveryIndustries,
  type DiscoveryCompany,
  type DiscoveryResult,
} from "../apps/web/starter/project/src/lib/company-discovery";
import {
  discoveryContractRequestSchema,
  discoveryContractResultSchema,
  executeDiscoveryContract,
  startDiscoveryContract,
} from "../apps/web/starter/project/src/lib/discovery-contract";
import { scoreRiskProfile } from "../apps/web/starter/project/src/lib/risk-profile";

const ids = Object.keys(discoveryIndustries) as (keyof typeof discoveryIndustries)[];
const all = { selection_mode: "all_supported", selected_industries: [], effective_industries: ids };
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
const risk_result = scoreRiskProfile({
  questionnaire_version: "v0-demo",
  answers: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`q${index + 1}`, 1])),
});
assert.equal(risk_result.status, "completed");
if (risk_result.status !== "completed") throw new Error("Expected completed risk");
const input = { risk_result, industry_preference: all };
const request = { ...input, action: "start" };
const check = (result: DiscoveryResult) => {
  assert.deepEqual(discoveryContractResultSchema.parse(result), result);
  assert.equal(JSON.stringify(result).includes('"watchlist_add"'), false);
  return result;
};
const execute = (raw: unknown, records: unknown[] = companies) =>
  check(executeDiscoveryContract(raw, records));

assert.ok(discoveryContractRequestSchema.safeParse(request).success);
assert.equal(execute(request).status, "ready");
assert.equal(check(startDiscoveryContract(input, companies)).status, "ready");
assert.equal(
  check(startDiscoveryContract({ ...input, action: "advance" }, companies)).status,
  "invalid_input",
);

// Inherit every risk-score mapping and every supported industry subset without reimplementing them.
for (let combination = 0; combination < 3 ** 7; combination++) {
  let remaining = combination;
  const answers = Object.fromEntries(
    Array.from({ length: 7 }, (_, index) => {
      const answer = (remaining % 3) + 1;
      remaining = Math.floor(remaining / 3);
      return [`q${index + 1}`, answer];
    }),
  );
  const risk = scoreRiskProfile({ questionnaire_version: "v0-demo", answers });
  if (risk.status !== "completed") throw new Error("Expected completed risk");
  const target = sizes[risk.total_score <= 11 ? 0 : risk.total_score <= 16 ? 1 : 2];
  for (let mask = 0; mask < 32; mask++) {
    const selected = ids.filter((_, index) => mask & (1 << index));
    const industry_preference = mask
      ? {
          selection_mode: "selected",
          selected_industries: selected,
          effective_industries: selected,
        }
      : all;
    const result = execute({ action: "start", risk_result: risk, industry_preference });
    if (result.status !== "ready") throw new Error("Expected ready discovery");
    assert.ok("target_size_category" in result);
    assert.equal(result.target_size_category, target);
    assert.equal(result.eligible_company_count, mask ? selected.length : 5);
    for (const id of result.ordered_company_ids) {
      const company = companies.find((entry) => `SSE:${entry.ticker}` === id)!;
      assert.equal(company.size_category, target);
      assert.ok(
        (mask ? selected : ids).some((key) => discoveryIndustries[key] === company.industry),
      );
    }
  }
}

for (const raw of [
  null,
  {},
  { ...request, extra: true },
  { ...request, watchlist: [] },
  { ...request, choice: "add" },
  { ...request, choice: "skip" },
  { ...request, risk_result: { ...risk_result, status: "partial" } },
  { ...request, risk_result: { ...risk_result, total_score: 8 } },
  { ...request, risk_result: { ...risk_result, risk_profile_bucket: "high" } },
  { ...request, risk_result: { ...risk_result, questionnaire_version: "unknown" } },
  { ...request, risk_result: { ...risk_result, answers: { q1: 1 } } },
  { ...request, industry_preference: { ...all, extra: true } },
  { ...request, industry_preference: { ...all, effective_industries: ids.slice(1) } },
  { ...request, industry_preference: { ...all, effective_industries: ["unknown"] } },
  ...[null, "SSE:600000", [600000], ["600000"], ["SSE:000001"], ["SZSE:600000"]].map(
    (excluded_company_ids) => ({ ...request, excluded_company_ids }),
  ),
]) {
  assert.equal(discoveryContractRequestSchema.safeParse(raw).success, false);
  assert.equal(execute(raw).status, "invalid_input");
}
for (const bad of [null, {}, [], { ...input, watchlist: [] }])
  assert.equal(check(startDiscoveryContract(bad, companies)).status, "invalid_input");

const base = companies[0]!;
for (const excluded_company_ids of [undefined, [], ["SSE:601999"]])
  assert.equal(execute({ ...request, excluded_company_ids }, [base]).status, "ready");
assert.equal(
  execute({ ...request, excluded_company_ids: [`SSE:${base.ticker}`] }, [base]).status,
  "exhausted",
);
assert.equal(execute(request, []).status, "exhausted");
const filtered = execute(request, [null, { ...base, name: " " }, companies[1]]);
assert.equal(filtered.status, "ready");
if (filtered.status !== "ready") throw new Error("Expected valid catalog survivor");
assert.equal(filtered.catalog_validation.excluded_record_count, 2);
assert.equal(filtered.current_company.ticker, companies[1]!.ticker);

for (let count = 1; count <= 7; count++) {
  const records = Array.from({ length: count }, (_, index) => ({
    ...base,
    ticker: String(601000 + index),
  }));
  const started = execute(request, records);
  if (started.status !== "ready") throw new Error("Expected ready session");
  assert.equal(started.total_rounds, Math.min(count, 5));
  const order = [...started.ordered_company_ids];
  let state = started.session_state;
  for (let round = 0; round < order.length; round++) {
    const advance = { action: "advance", session_state: state, company_id: order[round] };
    assert.ok(discoveryContractRequestSchema.safeParse(advance).success);
    for (const extra of [
      { choice: "add" },
      { choice: "skip" },
      { watchlist: [] },
      { extra: true },
    ]) {
      assert.equal(
        discoveryContractRequestSchema.safeParse({ ...advance, ...extra }).success,
        false,
      );
      assert.equal(execute({ ...advance, ...extra }, records).status, "invalid_input");
    }
    assert.equal(
      execute({ ...advance, company_id: "SSE:601999" }, records).status,
      "invalid_input",
    );
    assert.equal(execute({ ...advance, company_id: "601000" }, records).status, "invalid_input");
    assert.equal(
      execute({ ...advance, session_state: { ...state, extra: true } }, records).status,
      "invalid_input",
    );
    assert.equal(execute(advance, []).status, "invalid_input");
    assert.equal(
      execute(advance, [
        ...records,
        { ...records.find((record) => `SSE:${record.ticker}` === order[round])!, name: "Conflict" },
      ]).status,
      "invalid_input",
    );
    const next = execute(advance, records);
    if (next.status !== "ready" && next.status !== "session_completed")
      throw new Error("Expected neutral transition");
    assert.equal(next.status, round + 1 === order.length ? "session_completed" : "ready");
    state = next.session_state;
    assert.deepEqual(state.ordered_company_ids, order);
    assert.equal(state.round_index, round + 1);
    assert.deepEqual(state.exposed_company_ids, order.slice(0, round + 2));
    if (next.status === "ready") {
      assert.equal(`SSE:${next.current_company.ticker}`, order[round + 1]);
      assert.deepEqual(next.metric_request_company_ids, [order[round + 1]]);
      assert.equal(
        discoveryContractResultSchema.safeParse({
          ...next,
          watchlist_add: { exchange: "SSE", ticker: "601000" },
        }).success,
        false,
      );
    }
    assert.equal(execute({ ...advance, session_state: state }, records).status, "invalid_input");
  }
  // Advancing does not persist exclusions or implement an application watchlist.
  assert.equal(check(startDiscoveryContract(input, records)).status, "ready");
}

console.log(
  "Discovery contract tests passed: optional exclusions, strict neutral requests, all risk/industry mappings, catalog validation, stable progression, and no watchlist actions.",
);
