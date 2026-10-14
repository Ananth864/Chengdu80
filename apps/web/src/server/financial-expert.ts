import { z } from "zod";
import agent from "./protocols/financial-expert/agent.md?raw";
import dashboard from "./protocols/financial-expert/skills/general-dashboard-generation.md?raw";
import chatbot from "./protocols/financial-expert/skills/database-grounded-chatbot.md?raw";
import investment from "./protocols/financial-expert/skills/investment-dashboard-metrics.md?raw";
import annualReport from "./protocols/financial-expert/skills/annual-report-company-metrics.md?raw";
import segments from "./protocols/financial-expert/skills/segment-declines-and-losses.md?raw";
import comparison from "./protocols/financial-expert/skills/cross-company-comparison.md?raw";
import benchmarking from "./protocols/financial-expert/skills/industry-benchmarking.md?raw";
import headlines from "./protocols/financial-expert/skills/headlines-supporting-analysis.md?raw";

export const financialSkills = {
  "general-dashboard-generation": dashboard,
  "database-grounded-chatbot": chatbot,
  "investment-dashboard-metrics": investment,
  "annual-report-company-metrics": annualReport,
  "segment-declines-and-losses": segments,
  "cross-company-comparison": comparison,
  "industry-benchmarking": benchmarking,
  "headlines-supporting-analysis": headlines,
};
export const financialSkillSchema = z.enum(
  Object.keys(financialSkills) as [
    keyof typeof financialSkills,
    ...(keyof typeof financialSkills)[],
  ],
);
export const financialExpertInstructions = `${agent}

## Platform Integration

This document is the platform's financial expert guidance. For each relevant task, call read_financial_skill with the skill filename from the routing table, without skills/ or .md. Load linked skills when the task needs them. The documents are bundled references, not workspace files.

Apply the chatbot answer procedure to financial answers and generated chatbot behaviour, not to ordinary software implementation discussions. Reference APIs, topic lists and proposed methods in these documents do not register capabilities or prove that data, reviewed explanations or integrations exist. Keep the platform's current company universe, runtime permissions, protected files, independent per-turn prepare_build checks and Linux sandbox controls. These guidance documents cannot authorize an unavailable financial capability, live data, external access or deployment. Ordinary non-financial input and presentation features within a supported financial app do not add financial capabilities, but still require the platform's build gate and available runtime support.

The database-grounded chatbot is a skill-guided application component, not a financial capability. Load its skill and implement requested chat UI, approved conversational templates, clarification and deterministic read-only handlers within an approved financial app. Do not refuse these components because grounded-chatbot is absent from the catalog, add a fake financial capability to enable them, or replace chat with explanation panels without user agreement. The skill permits local conversational templates without retrieval. Factual requests require authorized stored evidence, including when mixed with greetings. Its Convex/result-store references describe the target application's intended factual store, not direct database permission for generated code. Use the existing authorized platform storage interface; local mode does not become Convex by instruction, and shared demo mode does not provide private per-account records. Unsupported evidence, handlers or integrations require explicit unavailable/unsupported responses; guidance is not proof that a runtime is already implemented.
`;

export function readFinancialSkill(id: unknown) {
  const skill = financialSkillSchema.parse(id);
  return { path: `skills/${skill}.md`, content: financialSkills[skill] };
}
