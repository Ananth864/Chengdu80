import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { importCompanyCsv, sseAPrefixes } from "../apps/web/src/lib/company-table";
import rawSource from "../apps/web/src/server/data/sse-a-universe.csv?raw";
import {
  suppliedCompanyUniverse,
  suppliedCompanyUniverseVersion,
} from "../apps/web/src/server/company-universe";

const source = await readFile(
  new URL("../apps/web/src/server/data/sse-a-universe.csv", import.meta.url),
  "utf8",
);
const parsed = importCompanyCsv(source);
const companies = suppliedCompanyUniverse();
assert.equal(parsed.length, 2319);
assert.equal(companies.length, parsed.length);
assert.equal(new Set(companies.map((company) => company.ticker)).size, companies.length);
// Hash the complete imported source; Bun's raw loader strips the file's UTF-8 BOM.
assert.equal(suppliedCompanyUniverseVersion, createHash("sha256").update(rawSource).digest("hex"));
assert.match(suppliedCompanyUniverseVersion, /^[a-f0-9]{64}$/);
assert.notEqual(
  suppliedCompanyUniverseVersion,
  createHash("sha256").update(`${rawSource}\n`).digest("hex"),
);

const sizes = { large: "Large cap", medium: "Mid cap", small: "Small cap" } as const;
for (const [index, company] of companies.entries()) {
  const original = parsed[index]!;
  assert.match(company.ticker, /^\d{6}$/);
  assert(sseAPrefixes.some((prefix) => company.ticker.startsWith(prefix)));
  assert.deepEqual(company, {
    exchange: "SSE",
    ticker: original.ticker,
    name: original.name,
    industry: original.industry,
    market_cap_rmb: original.marketCapRmb,
    size_category: sizes[original.size],
  });
}

// Exact CSV taxonomy, including industries excluded later by discovery.
const supportedCounts = {
  制造业: 1517,
  "信息传输、软件和信息技术服务业": 159,
  "电力、热力、燃气及水生产和供应业": 87,
  金融业: 85,
  批发和零售业: 83,
};
for (const [industry, count] of Object.entries(supportedCounts))
  assert.equal(companies.filter((company) => company.industry === industry).length, count);
assert.equal(new Set(companies.map((company) => company.industry)).size, 18);
assert.equal(companies.filter((company) => !(company.industry in supportedCounts)).length, 388);
for (const [size, count] of Object.entries({ "Large cap": 545, "Mid cap": 981, "Small cap": 793 }))
  assert.equal(companies.filter((company) => company.size_category === size).length, count);

// Categories are source data, not market-cap thresholds; quoting uses the shared parser.
const header =
  "Company Name,Ticker Symbol,Industry,A-share Market Capitalisation (RMB),Size Category\n";
const fixture = `${header}"Quoted, company\nname",600000,Industry,1,Large cap\nOther,600004,Industry,999999999999,Small cap\n`;
const fixtureCompanies = importCompanyCsv(fixture);
assert.equal(fixtureCompanies.length, 2);
assert.equal(fixtureCompanies[0]!.name, "Quoted, company\nname");
assert.equal(fixtureCompanies[0]!.size, "large");
assert.equal(fixtureCompanies[1]!.size, "small");
assert.throws(() => importCompanyCsv(`${fixture}Duplicate,600000,Industry,1,Mid cap\n`));
assert.throws(() => importCompanyCsv(`${fixture}Broken,600006,Industry,invalid,Mid cap\n`));
assert.throws(() => importCompanyCsv(`${fixture}Broken,600006,Industry,1,Unknown\n`));
assert.throws(() => importCompanyCsv(`${fixture}Broken,600006,Industry\n`));
assert.throws(() => importCompanyCsv(`${fixture}"Unclosed,600006,Industry,1,Mid cap\n`));
assert.deepEqual(suppliedCompanyUniverse(), companies);

console.log(
  "PASS supplied universe: 2319 records, five supported industry counts, all 18 industries retained, six-digit SSE tickers, source sizes, full-source SHA256 and fail-closed CSV parsing",
);
