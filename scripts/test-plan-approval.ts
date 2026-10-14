import assert from "node:assert/strict";
import { planMatchesApproval } from "../apps/web/src/server/build-policy";
import { buildPlanSchema, type BuildPlan } from "../apps/web/src/lib/build-plan";

const base = {
  requirements: "Build an industry research app using the supported capability",
  capabilities: ["market-research", "company-cards"],
  companyQueries: ["600000.SH", "000001.SZ"],
  mode: "live",
  themeOverride: null,
};
const approved: BuildPlan = buildPlanSchema.parse(base);
const declared = (overrides: Partial<BuildPlan>) =>
  buildPlanSchema.parse({ ...base, ...overrides }) as BuildPlan;

// Approval is asked once per plan: cosmetic re-emission differences proceed
// under the recorded approval.
assert.equal(planMatchesApproval(approved, declared({})), undefined, "identical plan proceeds");
assert.equal(
  planMatchesApproval(approved, declared({ capabilities: ["company-cards", "market-research"] })),
  undefined,
  "reordered capabilities proceed",
);
assert.equal(
  planMatchesApproval(approved, declared({ companyQueries: ["000001.SZ", "600000.SH"] })),
  undefined,
  "reordered company queries proceed",
);
assert.equal(
  planMatchesApproval(
    approved,
    declared({
      requirements: "Build an industry research application using the supported capability set",
    }),
  ),
  undefined,
  "minor requirements rewording proceeds",
);
assert.equal(
  planMatchesApproval(
    buildPlanSchema.parse({ ...base, requirements: "构建一个使用支持能力的行业研究应用" }),
    buildPlanSchema.parse({
      ...base,
      requirements: "构建一个使用支持能力的行业研究应用程序",
    }),
  ),
  undefined,
  "minor Chinese requirements rewording proceeds",
);
assert.equal(
  planMatchesApproval(
    approved,
    declared({
      capabilities: ["market-research", "company-cards", "risk-industry-matching"],
    }),
  ),
  undefined,
  "explicitly declaring an approved dependency proceeds",
);

// Material changes still require a newly approved proposal.
assert.equal(
  planMatchesApproval(approved, { ...approved, mode: "fixture" as never }),
  "mode",
  "changed mode re-asks",
);
assert.equal(
  planMatchesApproval(approved, declared({ capabilities: ["market-research"] })),
  "capabilities",
  "dropped capability re-asks",
);
assert.equal(
  planMatchesApproval(approved, declared({ companyQueries: ["600000.SH"] })),
  "companyQueries",
  "dropped company re-asks",
);
assert.equal(
  planMatchesApproval(approved, declared({ themeOverride: "Use a dark theme" })),
  "themeOverride",
  "changed theme re-asks",
);
assert.equal(
  planMatchesApproval(approved, declared({ cardMetrics: ["pe", "ps"] })),
  "cardMetrics",
  "added metric selection re-asks",
);
assert.equal(
  planMatchesApproval(
    approved,
    declared({ requirements: "A different historical industry research requirement" }),
  ),
  "requirements",
  "substantively rewritten requirements re-ask",
);
assert.equal(
  planMatchesApproval(approved, declared({ requirements: "构建一个预订管理系统" })),
  "requirements",
  "replaced-language requirements re-ask",
);

console.log("plan approval tolerance: all assertions passed");
