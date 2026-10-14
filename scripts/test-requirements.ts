import assert from "node:assert/strict";
import {
  initialRequirements,
  draftSpecSchema,
  specSchema,
  requirementsSchema,
  type Application,
  type ProductSpec,
} from "../apps/web/src/lib/contracts";
import { applicationWorkflow, workflowGraph } from "../apps/web/src/lib/planning";
import type { BuildRecord } from "../apps/web/src/lib/build-plan";
import { sampleBundle } from "../apps/web/src/lib/samples";
import {
  capabilityCatalog,
  capabilityDefinitions,
  parseCapabilityCatalog,
  businessCapabilities,
} from "../apps/web/src/lib/capability-catalog";

assert.equal(capabilityCatalog.library_id, "shared-financial-capabilities");
assert.equal(capabilityCatalog.version, "2.0.0");
assert.equal(businessCapabilities.length, 8);
assert.deepEqual(parseCapabilityCatalog(capabilityCatalog), capabilityCatalog);
assert.ok(
  capabilityCatalog.capabilities.find((entry) => entry.id === "risk-profile")
    ?.questionnaire_definition,
);
assert.ok(
  capabilityCatalog.capabilities.find((entry) => entry.id === "market-data-provider")
    ?.verified_endpoints,
);
assert.ok(!capabilityCatalog.capabilities.some((entry) => entry.id === "grounded-chatbot"));
for (const id of businessCapabilities)
  for (const related of capabilityDefinitions[id].relatedCatalogIds)
    assert.ok(capabilityCatalog.capabilities.some((entry) => entry.id === related));
assert.throws(() =>
  parseCapabilityCatalog({
    ...capabilityCatalog,
    capabilities: capabilityCatalog.capabilities.filter((entry) => entry.id !== "result-store"),
  }),
);
assert.throws(() =>
  parseCapabilityCatalog({
    ...capabilityCatalog,
    capabilities: capabilityCatalog.capabilities.map(() => capabilityCatalog.capabilities[0]),
  }),
);
assert.throws(() =>
  parseCapabilityCatalog({
    ...capabilityCatalog,
    capabilities: capabilityCatalog.capabilities.map((entry, index) =>
      index ? entry : { ...entry, depends_on: ["missing-capability"] },
    ),
  }),
);
assert.throws(() =>
  parseCapabilityCatalog({
    ...capabilityCatalog,
    capabilities: capabilityCatalog.capabilities.map((entry, index) =>
      index ? entry : { ...entry, depends_on: [entry.id] },
    ),
  }),
);

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
  outputDetails: {
    "Daily company cards": "Up to five eligible companies per China day.",
    Watchlist: "Companies explicitly saved by the user.",
  },
  constraints: ["No recommendations"],
};
const unconfigured = { ...spec, inputs: [], outputs: [], constraints: [] };
assert.ok(draftSpecSchema.safeParse(unconfigured).success);
assert.ok(!specSchema.safeParse(unconfigured).success, "Incomplete drafts still cannot deploy");
assert.ok(
  !draftSpecSchema.safeParse({ ...unconfigured, outputs: Array(13).fill("Output") }).success,
);

// Draft graph: no record yet, so data flows conceptually to the output.
const draft = workflowGraph(spec, undefined, undefined);
assert.equal(draft.basis, "draft");
assert.deepEqual(
  draft.edges,
  spec.outputs.map((_, index) => ({
    from: "data",
    to: `output-${index}`,
    label: "Conceptual input",
  })),
  "draft graph connects inputs to each specified output",
);
assert.deepEqual(
  draft.nodes.filter((node) => node.kind === "output").map((node) => node.label),
  spec.outputs,
);
assert.deepEqual(
  draft.nodes.filter((node) => node.kind === "output").map((node) => node.detail),
  spec.outputs.map((output) => spec.outputDetails?.[output]),
);
assert.ok(!draft.nodes.some((node) => node.kind === "output" && node.detail === spec.purpose));
assert.equal(
  workflowGraph({ ...spec, outputs: [] }, undefined, undefined).nodes.find(
    (node) => node.kind === "output",
  )?.label,
  "No outputs specified yet",
);
assert.ok(
  !workflowGraph({ ...spec, name: "New chat" }, undefined, undefined).nodes.some(
    (node) => node.label === "New chat",
  ),
);

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
  ["Risk/industry matching", "Daily company cards"],
);
assert.ok(
  graph.nodes
    .find((node) => node.id === "company-cards")
    ?.detail.includes("Risk appetite assessment, Industry preference"),
);
for (const capability of graph.nodes.filter((node) => node.kind === "capability")) {
  assert.ok(graph.edges.some((edge) => edge.from === "data" && edge.to === capability.id));
  for (const [index] of spec.outputs.entries())
    assert.ok(
      graph.edges.some((edge) => edge.from === capability.id && edge.to === `output-${index}`),
    );
}
assert.ok(graph.nodes.some((node) => node.id === "companies" && node.kind === "data"));

const blocked: BuildRecord = {
  ...record,
  readiness: "blocked",
  plan: { ...record.plan, capabilities: ["market-research"] },
  resolvedCapabilities: ["market-research", "news"],
};
const app: Application = {
  id: "app-1",
  ownerId: "owner",
  revision: 1,
  name: "New chat",
  spec,
  current: null,
  preview: null,
  data: {},
  history: [],
  events: [],
  createdAt: record.createdAt,
  workspaceSpec: { ...spec, outputs: ["Unbuilt research report"] },
  buildRecords: [blocked],
};
assert.equal(applicationWorkflow(app).basis, "draft");
assert.ok(!applicationWorkflow(app).nodes.some((node) => node.kind === "capability"));
app.current = {
  id: "release-1",
  spec,
  buildRecord: record,
  bundle: sampleBundle(spec),
  verification: { passed: true, checks: [], checkedAt: record.createdAt, sourceHash: "hash" },
  createdAt: record.createdAt,
  origin: "model",
  notes: "",
};
const active = applicationWorkflow(app);
assert.equal(active.basis, "active-release");
assert.ok(!active.nodes.some((node) => node.id === "market-research"));
assert.deepEqual(
  active.nodes.filter((node) => node.kind === "output").map((node) => node.label),
  spec.outputs,
);

console.log("requirements and workflow graph checks passed");
