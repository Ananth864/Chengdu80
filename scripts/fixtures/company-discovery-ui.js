import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CompanyDiscovery } from "../../apps/web/starter/project/src/components/company-discovery";
import { discoveryIndustries } from "../../apps/web/starter/project/src/lib/company-discovery";
import { executeDiscoveryContract } from "../../apps/web/starter/project/src/lib/discovery-contract";
import {
  completedRiskProfileSchema,
  scoreRiskProfile,
} from "../../apps/web/starter/project/src/lib/risk-profile";

const state = {
  storage: structuredClone(window.companyDiscoverySeed ?? {}),
  calls: [],
  results: [],
  companies: Array.from({ length: 6 }, (_, index) => ({
    exchange: "SSE",
    ticker: String(600000 + index),
    name: `Supplied company ${index + 1}`,
    industry: discoveryIndustries.manufacturing,
    market_cap_rmb: 100_000_000_000,
    size_category: "Large cap",
  })),
  randomCalls: 0,
  sessions: 0,
  failRpc: false,
  failStorage: false,
  failRead: false,
  holdWrite: false,
  releaseWrite: null,
};
window.companyDiscoveryTest = state;
window.cd80 = {
  ready() {},
  async call(capability, input) {
    state.calls.push({ capability, input: structuredClone(input) });
    switch (capability) {
      case "storage.read":
        if (state.failRead) throw new Error("Test storage read unavailable");
        return structuredClone(state.storage[input.key] ?? null);
      case "storage.write":
        if (state.holdWrite) {
          await new Promise((resolve) => {
            state.releaseWrite = resolve;
          });
          state.releaseWrite = null;
        }
        if (state.failStorage) throw new Error("Test storage write unavailable");
        state.storage[input.key] = structuredClone(input.value);
        return null;
      case "finance.company-discovery.v1-3": {
        if (state.failRpc) throw new Error("Test discovery RPC unavailable");
        const originalRandom = Math.random;
        Math.random = () => {
          state.randomCalls++;
          return 0.999;
        };
        let result;
        try {
          result = executeDiscoveryContract(input, state.companies);
        } finally {
          Math.random = originalRandom;
        }
        if (input.action === "start") state.sessions++;
        state.results.push(structuredClone(result));
        return result;
      }
      default:
        throw new Error(`Unexpected capability: ${capability}`);
    }
  },
};

const riskResult = completedRiskProfileSchema.parse(
  scoreRiskProfile({
    questionnaire_version: "v0-demo",
    answers: { q1: 1, q2: 1, q3: 1, q4: 1, q5: 1, q6: 1, q7: 1 },
  }),
);
createRoot(document.getElementById("root")).render(
  createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    createElement(CompanyDiscovery, {
      ...(new URLSearchParams(window.location.search).has("default")
        ? {}
        : { enableWatchlist: true }),
      riskResult,
      industryPreference: {
        selection_mode: "selected",
        selected_industries: ["manufacturing"],
        effective_industries: ["manufacturing"],
      },
    }),
  ),
);
