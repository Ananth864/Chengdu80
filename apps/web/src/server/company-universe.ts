import { createHash } from "node:crypto";
import { importCompanyCsv, sseAPrefixes } from "../lib/company-table";
import source from "./data/sse-a-universe.csv?raw";

export type SuppliedCompany = {
  exchange: "SSE";
  ticker: string;
  name: string;
  industry: string;
  market_cap_rmb: number;
  size_category: "Large cap" | "Mid cap" | "Small cap";
};

export const suppliedCompanyUniverseVersion = createHash("sha256").update(source).digest("hex");

export function suppliedCompanyUniverse(): SuppliedCompany[] {
  const sizes = { large: "Large cap", medium: "Mid cap", small: "Small cap" } as const;
  return importCompanyCsv(source).map((company) => {
    if (
      !/^\d{6}$/.test(company.ticker) ||
      !sseAPrefixes.some((prefix) => company.ticker.startsWith(prefix))
    )
      throw new Error(`Invalid supplied SSE A-share ticker: ${company.ticker}`);
    return {
      exchange: "SSE",
      ticker: company.ticker,
      name: company.name,
      industry: company.industry,
      market_cap_rmb: company.marketCapRmb,
      size_category: sizes[company.size],
    };
  });
}
