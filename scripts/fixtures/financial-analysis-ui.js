import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FinancialAnalysis } from "../../apps/web/starter/project/src/components/financial-analysis";

const state = { calls: [], results: window.financialAnalysisSeed.results };
window.financialAnalysisTest = state;
window.cd80 = {
  ready() {},
  async call(capability, input) {
    state.calls.push({ capability, input: structuredClone(input) });
    if (!capability.startsWith("finance.")) throw new Error("Unexpected non-financial call");
    const key = capability.slice("finance.".length);
    if (window.financialAnalysisSeed.fail === key) throw new Error("Fixture permission denied");
    return structuredClone(state.results[key]);
  },
};
createRoot(document.getElementById("root")).render(
  createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    createElement(
      "main",
      { style: { maxWidth: "100%", minWidth: 0 } },
      ...["historical-analysis", "industry-research", "price-target"].map((capability) =>
        createElement(FinancialAnalysis, {
          key: capability,
          capability,
          companyId: window.financialAnalysisSeed.companyId ?? "600000.SH",
        }),
      ),
    ),
  ),
);
