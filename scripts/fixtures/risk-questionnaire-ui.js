import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RiskQuestionnaire } from "../../apps/web/starter/project/src/components/risk-questionnaire";
import {
  completedRiskProfileSchema,
  scoreRiskProfile,
} from "../../apps/web/starter/project/src/lib/risk-profile";

const state = {
  storage: new Map(),
  calls: [],
  completions: [],
  resultMode: "valid",
  failStorage: false,
};
window.riskQuestionnaireTest = state;
window.cd80 = {
  ready() {},
  async call(capability, input) {
    state.calls.push({ capability, input: structuredClone(input) });
    switch (capability) {
      case "storage.read": {
        const { key } = input;
        return structuredClone(state.storage.get(key) ?? null);
      }
      case "finance.risk-profile": {
        if (state.resultMode === "rejected") return scoreRiskProfile({});
        const result = scoreRiskProfile(input);
        return state.resultMode === "invalid" ? { ...result, total_score: 999 } : result;
      }
      case "storage.write": {
        const { key, value } = input;
        const completed = completedRiskProfileSchema.parse(value);
        if (state.failStorage) throw new Error("Test storage unavailable");
        state.storage.set(key, structuredClone(completed));
        return null;
      }
      default:
        throw new Error(`Unexpected capability: ${capability}`);
    }
  },
};

createRoot(document.getElementById("root")).render(
  createElement(
    QueryClientProvider,
    { client: new QueryClient() },
    createElement(RiskQuestionnaire, { onCompleted: (result) => state.completions.push(result) }),
  ),
);
