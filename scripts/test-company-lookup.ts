import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  companyMatchLimit,
  companyMatchThreshold,
  isSseATicker,
  normalizeSseATicker,
  rankCompanyMatches,
} from "../apps/web/src/lib/company-table";
import {
  parseStockBasic,
  resetSseCompanyCache,
  sseACompanies,
} from "../apps/web/src/server/providers";

const sample = JSON.parse(
  await readFile(new URL("./fixtures/stock-basic-sample.json", import.meta.url), "utf8"),
);
const companies = parseStockBasic(sample);
assert.equal(companies.length, 11);
assert(companies.some((company) => company.ticker === "600000.SH"));
console.log(
  "PASS stock_basic mapping keeps SSE Class A rows and drops B-shares, SZSE and blank names",
);

assert.equal(isSseATicker("600000.SH"), true);
assert.equal(isSseATicker("601857.SH"), true);
assert.equal(isSseATicker("603288.SH"), true);
assert.equal(isSseATicker("605499.SH"), true);
assert.equal(isSseATicker("688981.SH"), true);
assert.equal(isSseATicker("689009.SH"), true);
assert.equal(isSseATicker("900901.SH"), false);
assert.equal(isSseATicker("000001.SZ"), false);
assert.equal(isSseATicker("600000.SHH"), false);
assert.equal(normalizeSseATicker("600000"), "600000.SH");
assert.equal(normalizeSseATicker("600104.SHH"), "600104.SH");
assert.equal(normalizeSseATicker("600104.shh"), "600104.SH");
assert.equal(normalizeSseATicker("600000.sh"), "600000.SH");
assert.equal(normalizeSseATicker("000001.SZ"), null);
assert.equal(normalizeSseATicker("AAPL"), null);
console.log(
  "PASS SSE Class A allowlist and ticker normalization for legacy, current and bare codes",
);

assert.equal(companyMatchThreshold, 60);
assert.equal(companyMatchLimit, 20);
const byFullName = rankCompanyMatches("上海浦东发展银行股份有限公司", companies);
assert.equal(byFullName.length, 1);
assert.equal(byFullName[0]!.ticker, "600000.SH");
assert.equal(byFullName[0]!.score, 100);
assert.equal(byFullName[0]!.matchedOn, "fullname");
const byName = rankCompanyMatches("浦发银行", companies);
assert.equal(byName.length, 1);
assert.equal(byName[0]!.ticker, "600000.SH");
assert.equal(byName[0]!.matchedOn, "name");
const bySuffix = rankCompanyMatches("浦发银行股份有限公司", companies);
assert.equal(bySuffix.length, 1);
assert.equal(bySuffix[0]!.ticker, "600000.SH");
const byCode = rankCompanyMatches("600000", companies);
assert.equal(byCode.length, 1);
assert.equal(byCode[0]!.ticker, "600000.SH");
assert.equal(byCode[0]!.matchedOn, "ticker");
const byTsCode = rankCompanyMatches("600000.SH", companies);
assert.equal(byTsCode.length, 1);
assert.equal(byTsCode[0]!.ticker, "600000.SH");
const byInitials = rankCompanyMatches("SPDB", companies);
assert.equal(byInitials[0]!.ticker, "600000.SH");
assert.equal(byInitials[0]!.matchedOn, "enname");
assert(byInitials[0]!.score >= 85);
const byLowerInitials = rankCompanyMatches("spdb", companies);
assert.equal(byLowerInitials[0]!.ticker, "600000.SH");
const banks = rankCompanyMatches("银行", companies);
assert.deepEqual(
  banks.map((bank) => bank.ticker),
  ["600000.SH", "600036.SH", "601398.SH", "601988.SH"],
);
assert(banks.every((bank) => bank.matchedOn === "industry" && bank.score === 80));
const moutai = rankCompanyMatches("茅台", companies);
assert.equal(moutai.length, 1);
assert.equal(moutai[0]!.ticker, "600519.SH");
assert.equal(moutai[0]!.matchedOn, "name");
assert.equal(moutai[0]!.score, 72);
const china = rankCompanyMatches("中国", companies);
assert(china.length >= 4);
assert(china.every((match) => match.score === 88));
assert(china.some((match) => match.ticker === "601988.SH"));
for (const generic of ["股份", "有限公司", "集团", "ltd", "company"]) {
  assert.equal(rankCompanyMatches(generic, companies).length, 0, `"${generic}" must not match`);
}
assert.equal(rankCompanyMatches("苹果", companies).length, 0);
console.log(
  "PASS fuzzy lookup: exact, prefix, contains, initials, industry and generic-term rejection",
);

const syntheticBanks = Array.from({ length: 30 }, (_, i) => ({
  ticker: `6001${String(i).padStart(2, "0")}.SH`,
  name: `测试银行${String(i).padStart(2, "0")}`,
  fullname: `测试银行${String(i).padStart(2, "0")}股份有限公司`,
  enname: `Test Bank ${String(i).padStart(2, "0")} Co.,Ltd.`,
  industry: "银行",
}));
const wide = rankCompanyMatches("银行", syntheticBanks);
assert.equal(wide.length, 30);
assert.equal(wide.slice(0, companyMatchLimit).length, 20);
assert.deepEqual(
  wide.slice(0, companyMatchLimit).map((bank) => bank.score),
  Array(20).fill(80),
);
console.log("PASS wide matches stay above the threshold while callers cap the returned list");

assert.throws(() => parseStockBasic({ code: 401, msg: "token check failed" }), /token check/);
assert.throws(
  () => parseStockBasic({ code: 0, data: { fields: ["name"], items: [] } }),
  /missing required fields/,
);
assert.throws(
  () =>
    parseStockBasic({
      code: 0,
      data: {
        fields: ["ts_code", "name", "fullname", "enname", "industry"],
        items: [["900901.SH", "云赛B股", "", "", "信息技术"]],
      },
    }),
  /no usable SSE Class A/,
);
console.log("PASS provider mapping fails closed on rejection, missing fields and empty scope");

const previousToken = process.env.TUSHARE_TOKEN;
const originalFetch = globalThis.fetch;
let networkCalls = 0;
try {
  process.env.TUSHARE_TOKEN = "test-token";
  globalThis.fetch = (async () => {
    networkCalls++;
    return new Response(JSON.stringify(sample));
  }) as typeof fetch;
  resetSseCompanyCache();
  const first = await sseACompanies();
  assert(first.available);
  assert.equal(first.companies.length, 11);
  assert.equal(networkCalls, 1);
  const second = await sseACompanies();
  assert(second.available);
  assert.equal(networkCalls, 1, "the cached table serves repeat lookups without refetching");
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as typeof fetch;
  const stale = await sseACompanies();
  assert(stale.available);
  assert.equal(stale.companies.length, 11, "a failed refresh falls back to the cached table");
  resetSseCompanyCache();
  const failed = await sseACompanies();
  assert(!failed.available);
  assert(failed.reason.includes("network down"));
  process.env.TUSHARE_TOKEN = "";
  resetSseCompanyCache();
  const unconfigured = await sseACompanies();
  assert(!unconfigured.available);
  assert(unconfigured.reason.includes("TUSHARE_TOKEN"));
  process.env.TUSHARE_TOKEN = "test-token";
  let injectedCalls = 0;
  const counting = (async () => {
    injectedCalls++;
    return new Response(JSON.stringify(sample));
  }) as typeof fetch;
  await sseACompanies({ fetch: counting });
  await sseACompanies({ fetch: counting });
  assert.equal(injectedCalls, 2, "an injected fetch bypasses the cache for tests");
} finally {
  if (previousToken === undefined) delete process.env.TUSHARE_TOKEN;
  else process.env.TUSHARE_TOKEN = previousToken;
  globalThis.fetch = originalFetch;
  resetSseCompanyCache();
}
console.log("PASS live table cache, stale fallback, true failure reasons and cache bypass");
