import assert from "node:assert/strict";
import {
  initialRequirements,
  requirementsSchema,
  type ProductSpec,
} from "../apps/web/src/lib/contracts";
import { workflowGraph } from "../apps/web/src/lib/planning";
import type { BuildRecord } from "../apps/web/src/lib/build-plan";

// Requirements schema: the pre-build review contract.
const valid = requirementsSchema.parse({
  analysisPeriod: "Past 3 years",
  assumptions: ["Prices are CNY"],
  missingInputs: ["Confirmed risk questionnaire"],
  questions: [
    { id: "q1", question: "Which industries matter to you?", answer: "" },
    { id: "q2", question: "Daily or weekly review?", answer: "Daily" },
  ],
});
assert.equal(valid.questions.length, 2);
assert.equal(valid.questions[0]!.answer, "");
assert.throws(
  () =>
    requirementsSchema.parse({
      ...initialRequirements(),
      questions: [
        { id: "dup", question: "A?", answer: "" },
        { id: "dup", question: "B?", answer: "" },
      ],
    }),
  /unique/i,
);
assert.throws(() =>
  requirementsSchema.parse({ ...initialRequirements(), assumptions: ["", "   "] }),
);
assert.deepEqual(initialRequirements(), {
  analysisPeriod: "",
  assumptions: [],
  missingInputs: [],
  questions: [],
});

const spec: ProductSpec = {
  name: "Industry matcher",
  purpose: "Match risk appetite to company sizes inside chosen industries.",
  protocol: "screening",
  inputs: ["Risk profile", "Industries"],
  outputs: ["Daily company cards", "Watchlist"],
  constraints: ["No recommendations"],
};

// Draft graph: no record yet, so data flows conceptually to the output.
const draft = workflowGraph(spec, undefined, undefined);
assert.equal(draft.basis, "draft");
assert.deepEqual(
  draft.edges,
  [{ from: "data", to: "output", label: "provides the information" }],
  "draft graph keeps one conceptual edge",
);
assert.ok(draft.nodes.some((node) => node.kind === "output" && node.label === spec.name));

// Record graph: capabilities and resolved companies become inspectable nodes.
const record = {
  id: "record-1",
  version: 1 as const,
  revision: 1,
  turnId: "turn-1",
  createdAt: new Date().toISOString(),
  hash: "hash",
  plan: {
    requirements: "Demo matching app",
    capabilities: ["risk-industry-matching", "company-cards"],
    companyQueries: ["Demo Technology Large"],
    mode: "live" as const,
    themeOverride: null,
  },
  resolvedCapabilities: [
    "risk-assessment",
    "industry-preference",
    "risk-industry-matching",
    "company-cards",
  ],
  companyIds: ["DEMO001"],
  companyIndustries: ["Technology"],
  companyTableVersion: "synthetic-companies-v1",
  protocolHashes: {},
  provider: "tushare" as const,
  moduleVersions: {},
  theme: "starter-default",
  readiness: "live" as const,
  blockers: [],
} satisfies BuildRecord;
const graph = workflowGraph(spec, initialRequirements(), record);
assert.equal(graph.basis, "build-record");
assert.ok(graph.nodes.some((node) => node.id === "companies" && node.inputs === "DEMO001"));
assert.deepEqual(
  graph.nodes.filter((node) => node.kind === "capability").map((node) => node.label),
  [
    "Risk appetite assessment",
    "Industry preference",
    "Risk/industry matching",
    "Daily company cards",
  ],
);
for (const capability of graph.nodes.filter((node) => node.kind === "capability")) {
  assert.ok(graph.edges.some((edge) => edge.from === "data" && edge.to === capability.id));
  assert.ok(graph.edges.some((edge) => edge.from === capability.id && edge.to === "output"));
}
assert.ok(graph.nodes.some((node) => node.id === "companies" && node.kind === "data"));

console.log("requirements and workflow graph checks passed");
