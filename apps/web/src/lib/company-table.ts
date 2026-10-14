import { z } from "zod";

export const companySchema = z.object({
  name: z.string().min(1),
  ticker: z.string().min(1),
  industry: z.string().min(1),
  marketCapRmb: z.number().finite().nonnegative(),
  size: z.enum(["small", "medium", "large"]),
});
export type Company = z.infer<typeof companySchema>;
export function validateCompanies(value: unknown) {
  const companies = z.array(companySchema).min(1).parse(value);
  if (new Set(companies.map((c) => c.ticker.toLowerCase())).size !== companies.length)
    throw new Error("The platform company table contains duplicate tickers.");
  return companies;
}
// Quoted commas/newlines and escaped quotes are supported; invalid quoting fails closed.
function csvRows(contents: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  const input = contents.replace(/^\uFEFF/, "");
  function cell() {
    row.push(field.trim());
    field = "";
    closed = false;
  }
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else field += c;
    } else if (c === "," || c === "\n" || c === "\r") {
      cell();
      if (c !== ",") {
        if (row.some((v) => v.length)) rows.push(row);
        row = [];
        if (c === "\r" && input[i + 1] === "\n") i++;
      }
    } else if (c === '"') {
      if (field.length || closed) throw new Error("Invalid CSV quote.");
      quoted = true;
    } else {
      if (closed) throw new Error("Unexpected characters after a quoted CSV field.");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quote.");
  cell();
  if (row.some((v) => v.length)) rows.push(row);
  return rows;
}
// Settled scope for all live company data and market-data calls: Shanghai Stock
// Exchange Class A listed shares only. 688/689 are STAR Market RMB Class A shares.
export const sseAPrefixes = ["600", "601", "603", "605", "688", "689"] as const;
export type LiveCompany = {
  ticker: string;
  name: string;
  fullname: string;
  enname: string;
  industry: string;
};
export type CompanyLookupInput = {
  ticker: string;
  name: string;
  industry: string;
  fullname?: string;
  enname?: string;
};
export function isSseATicker(tsCode: string) {
  return /^\d{6}\.SH$/.test(tsCode) && sseAPrefixes.some((prefix) => tsCode.startsWith(prefix));
}
// Accept 600104.SHH (legacy Alpha Vantage format), 600000.SH and bare 600000.
export function normalizeSseATicker(symbol: string): string | null {
  const upper = symbol.trim().toUpperCase();
  if (/^\d{6}$/.test(upper)) return `${upper}.SH`;
  if (/^\d{6}\.(SH|SHH)$/.test(upper)) return `${upper.slice(0, 6)}.SH`;
  return null;
}

// Fuzzy company lookup. The tool returns only matches at or above this score,
// so generic words like 股份 drop out instead of flooding the agent context.
export const companyMatchThreshold = 60;
export const companyMatchLimit = 20;
export const companyMatchFields = ["ticker", "name", "fullname", "enname", "industry"] as const;
export type CompanyMatchField = (typeof companyMatchFields)[number];
export type CompanyMatch = {
  ticker: string;
  name: string;
  fullname: string;
  enname: string;
  industry: string;
  score: number;
  matchedOn: CompanyMatchField;
};
const corporateSuffixes = ["股份有限公司", "有限责任公司", "有限公司", "公司"];
const genericTerms = new Set([...corporateSuffixes, "股份", "有限", "上市", "集团"]);
const genericEnglishTerms = new Set([
  "ltd",
  "co",
  "inc",
  "company",
  "corporation",
  "limited",
  "group",
  "holding",
]);
function stripCorporateSuffix(value: string) {
  for (const suffix of corporateSuffixes)
    if (value.length > suffix.length && value.endsWith(suffix))
      return value.slice(0, -suffix.length);
  return value;
}
function bigrams(value: string) {
  const grams = new Set<string>();
  for (let i = 0; i + 1 < value.length; i++) grams.add(value.slice(i, i + 2));
  return grams;
}
function diceScore(query: string, field: string) {
  if (query.length < 2 || field.length < 2) return 0;
  const left = bigrams(query);
  const right = bigrams(field);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const gram of left) if (right.has(gram)) overlap++;
  return (2 * overlap) / (left.size + right.size);
}
function englishInitials(enname: string) {
  return enname
    .split(/[^A-Za-z]+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}
function scoreTicker(query: string, ticker: string): number {
  const normalized = query.trim().toLowerCase().replace(/\s/g, "");
  const bare = ticker.split(".")[0]!.toLowerCase();
  const full = ticker.toLowerCase();
  if (normalized === bare || normalized === full || normalized === full.replace(".", ""))
    return 100;
  if (normalized.length >= 3 && bare.startsWith(normalized)) return 90;
  return 0;
}
function scoreChineseField(query: string, field: string, minContains: number): number {
  const raw = query.trim();
  const comparableQuery = raw.toLowerCase();
  const comparableField = field.trim().toLowerCase();
  const strippedQuery = stripCorporateSuffix(comparableQuery);
  const strippedField = stripCorporateSuffix(comparableField);
  if (!comparableField) return 0;
  if (comparableQuery === comparableField || strippedQuery === strippedField) return 100;
  if (comparableField.startsWith(comparableQuery) && comparableQuery.length >= 2) return 88;
  if (
    comparableQuery.length >= minContains &&
    !genericTerms.has(comparableQuery) &&
    comparableField.includes(comparableQuery)
  )
    return 72;
  // Fuzzy comparison uses suffix-stripped names so shared generic words like
  // 股份有限公司 cannot push unrelated companies above the threshold.
  return diceScore(strippedQuery, strippedField) * 100;
}
function scoreEnglishField(query: string, field: string): number {
  const comparableQuery = query.trim().toLowerCase();
  const comparableField = field.trim().toLowerCase();
  if (!comparableField) return 0;
  if (comparableQuery === comparableField) return 100;
  const initials = englishInitials(field);
  const queryInitials = query
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (queryInitials.length >= 2 && initials === queryInitials) return 95;
  if (queryInitials.length >= 3 && initials.startsWith(queryInitials)) return 85;
  if (
    comparableQuery.length >= 3 &&
    !genericEnglishTerms.has(comparableQuery) &&
    comparableField.includes(comparableQuery)
  )
    return 65;
  return diceScore(comparableQuery, comparableField) * 100;
}
function scoreIndustryField(query: string, field: string): number {
  const comparableQuery = query.trim().toLowerCase();
  const comparableField = field.trim().toLowerCase();
  if (!comparableField) return 0;
  if (comparableQuery === comparableField) return 80;
  if (comparableQuery.length >= 2 && comparableField.includes(comparableQuery)) return 70;
  return diceScore(comparableQuery, comparableField) * 100;
}
function scoreCompany(query: string, company: CompanyLookupInput) {
  const candidates: Array<[CompanyMatchField, number]> = [
    ["ticker", scoreTicker(query, company.ticker)],
    ["name", scoreChineseField(query, company.name, 2)],
    ["fullname", scoreChineseField(query, company.fullname ?? "", 3)],
    ["enname", scoreEnglishField(query, company.enname ?? "")],
    ["industry", scoreIndustryField(query, company.industry)],
  ];
  let best: CompanyMatch | null = null;
  for (const [matchedOn, score] of candidates) {
    if (score > (best?.score ?? 0))
      best = {
        ticker: company.ticker,
        name: company.name,
        fullname: company.fullname ?? "",
        enname: company.enname ?? "",
        industry: company.industry,
        score: Math.round(score),
        matchedOn,
      };
  }
  return best;
}
// Rank every company above the threshold. Callers cap the returned list.
export function rankCompanyMatches(query: string, companies: readonly CompanyLookupInput[]) {
  const ranked = companies
    .map((company) => scoreCompany(query, company))
    .filter((match): match is CompanyMatch => !!match && match.score >= companyMatchThreshold)
    .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
  return ranked;
}
export function importCompanyCsv(contents: string): Company[] {
  const [headers, ...rows] = csvRows(contents);
  if (!headers || new Set(headers).size !== headers.length)
    throw new Error("Missing or duplicate company CSV headers.");
  const required = [
    "Company Name",
    "Ticker Symbol",
    "Industry",
    "A-share Market Capitalisation (RMB)",
    "Size Category",
  ];
  const indices = required.map((header) => headers.indexOf(header));
  if (indices.some((i) => i < 0))
    throw new Error(`Company CSV requires headers: ${required.join("; ")}`);
  const categories: Record<string, Company["size"]> = {
    small: "small",
    "small cap": "small",
    medium: "medium",
    "medium cap": "medium",
    "mid cap": "medium",
    large: "large",
    "large cap": "large",
  };
  return validateCompanies(
    rows.map((row, i) => {
      if (row.length !== headers.length)
        throw new Error(`CSV row ${i + 2} has the wrong field count.`);
      const [name, ticker, industry, cap, category] = indices.map((index) => row[index]!);
      if (!cap || !/^(?:\d+(?:\.\d+)?|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/.test(cap))
        throw new Error(`CSV row ${i + 2} has invalid RMB capitalization.`);
      return companySchema.parse({
        name,
        ticker,
        industry,
        marketCapRmb: Number(cap.replaceAll(",", "")),
        size: categories[category!.toLowerCase().replaceAll("-", " ")],
      });
    }),
  );
}
