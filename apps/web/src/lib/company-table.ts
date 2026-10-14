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
