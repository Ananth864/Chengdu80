import assert from "node:assert/strict";
import {
  financialOperationRequestSchema,
  financialRequestSchema,
  industryResearchRequestSchema,
  priceTargetRequestSchema,
} from "../apps/web/starter/project/src/lib/financial-results";

const identity = { company_id: "600001" };
const schemas = [
  financialRequestSchema,
  industryResearchRequestSchema,
  priceTargetRequestSchema,
  financialOperationRequestSchema,
];

for (const schema of schemas) {
  assert.deepEqual(schema.parse(identity), { ...identity, exchange: "SSE" });
  const request = {
    ...identity,
    exchange: "SSE",
    company_name: "Company",
    industry_label: "Industry",
    as_of_date: "2024-02-29",
  };
  assert.deepEqual(schema.parse(request), request);
  for (const invalid of [
    { company_id: 600001 },
    { company_id: "600001.SH" },
    { exchange: "SZSE" },
    { company_name: "" },
    { industry_label: "" },
    { as_of_date: "2025-02-29" },
    { as_of_date: "2025-04-31" },
    { as_of_date: "1899-12-31" },
    { as_of_date: "20250101" },
    { evidence: {} },
    { financial_year: 2024 },
    { unknown: true },
  ]) {
    assert.equal(
      schema.safeParse({ ...identity, ...invalid }).success,
      false,
      JSON.stringify(invalid),
    );
  }
}

for (const period of ["1m", "6m", "1y", "5y"]) {
  const request = { ...identity, period };
  assert.equal(financialRequestSchema.parse(request).period, period);
  assert.deepEqual(financialOperationRequestSchema.parse(request), { ...request, exchange: "SSE" });
  assert.equal(industryResearchRequestSchema.safeParse(request).success, false);
  assert.equal(priceTargetRequestSchema.safeParse(request).success, false);
}

for (const period of ["19001231", "20241231", "99991231"]) {
  const request = { ...identity, period, years: 5 };
  assert.equal(industryResearchRequestSchema.parse(request).period, period);
  assert.deepEqual(financialOperationRequestSchema.parse(request), { ...request, exchange: "SSE" });
  assert.equal(financialRequestSchema.safeParse(request).success, false);
  assert.equal(priceTargetRequestSchema.safeParse(request).success, false);
}

for (const period of [
  "00001231",
  "18991231",
  "20240229",
  "20241230",
  "2024-12-31",
  "",
  20241231,
  null,
]) {
  for (const schema of schemas) {
    assert.equal(schema.safeParse({ ...identity, period }).success, false, String(period));
  }
}

for (const years of [1, 5]) {
  for (const schema of [financialRequestSchema, industryResearchRequestSchema]) {
    assert.equal(schema.parse({ ...identity, years }).years, years);
  }
  assert.equal(priceTargetRequestSchema.safeParse({ ...identity, years }).success, false);
}
for (const years of [0, 6, 1.5, "5", null]) {
  for (const schema of schemas) {
    assert.equal(schema.safeParse({ ...identity, years }).success, false, String(years));
  }
}

console.log(
  "PASS financial request schemas: capability-specific periods, years, dates and strict transport inputs",
);
