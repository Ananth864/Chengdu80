import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IndustryPreference } from "../../apps/web/starter/project/src/components/industry-preference";
import { normalizedIndustryPreferenceSchema } from "../../apps/web/starter/project/src/lib/company-discovery";
import { runIndustryPreference } from "../../apps/web/starter/project/src/lib/industry-preference";

const state = {
  storage: new Map(Object.entries(structuredClone(window.__industryPreferenceSeed ?? {}))),
  calls: [],
  completions: [],
  resultMode: "valid",
  failStorage: false,
};
window.industryPreferenceTest = state;
window.cd80 = {
  ready() {},
  async call(capability, input) {
    state.calls.push({ capability, input: structuredClone(input) });
    switch (capability) {
      case "storage.read":
        return structuredClone(state.storage.get(input.key) ?? null);
      case "finance.industry-preferences": {
        if (state.resultMode === "transport-error") throw new Error("Test transport unavailable");
        if (state.resultMode === "rejected") return runIndustryPreference({});
        const result = runIndustryPreference(input);
        return state.resultMode === "invalid"
          ? { ...result, industry_preference: { selection_mode: "selected" } }
          : result;
      }
      case "storage.write": {
        const preference = normalizedIndustryPreferenceSchema.parse(input.value);
        if (state.failStorage) throw new Error("Test storage unavailable");
        state.storage.set(input.key, structuredClone(preference));
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
    createElement(IndustryPreference, { onCompleted: (result) => state.completions.push(result) }),
  ),
);
