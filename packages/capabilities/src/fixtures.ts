import type { CapabilityPlan } from "./plans";

export const b2cPerformancePlan: CapabilityPlan = {
  schemaVersion: 1,
  requirements: [
    {
      id: "search",
      text: "Search China stocks, bonds, funds, and gold.",
      assetTypes: ["stocks", "bonds", "funds", "gold"],
      markets: ["China"],
    },
    {
      id: "holdings",
      text: "Show holdings and portfolio performance.",
      assetTypes: ["stocks", "bonds", "funds", "gold"],
      markets: ["China"],
    },
    {
      id: "peer-pe",
      text: "Explain peer PE comparisons.",
      assetTypes: ["stocks"],
      markets: ["China"],
    },
    {
      id: "benchmark",
      text: "Explain benchmark-relative performance.",
      assetTypes: ["stocks", "bonds", "funds", "gold"],
      markets: ["China"],
    },
    {
      id: "context",
      text: "Explain performance context using company history, news, and market conditions.",
      assetTypes: ["stocks", "bonds", "funds", "gold"],
      markets: ["China"],
    },
    {
      id: "metrics",
      text: "Present key company metrics in a dashboard.",
      assetTypes: ["stocks"],
      markets: ["China"],
    },
  ],
  steps: [
    {
      id: "research",
      capabilityId: "research.market",
      version: "1.0.0",
      inputs: { query: { kind: "input", name: "query", contract: "simulation.text@1" } },
    },
    {
      id: "fixture-metrics",
      capabilityId: "data.stock-price-api",
      version: "1.0.0",
      inputs: { symbol: { kind: "literal", value: "FICTIONAL-NOT-A-TICKER" } },
    },
    {
      id: "dashboard",
      capabilityId: "presentation.metrics-dashboard",
      version: "1.0.0",
      inputs: { metrics: { kind: "step", stepId: "fixture-metrics", output: "metrics" } },
    },
  ],
  outputs: {
    research: { kind: "step", stepId: "research", output: "research" },
    dashboard: { kind: "step", stepId: "dashboard", output: "dashboard" },
  },
  coverage: [
    {
      requirementId: "search",
      status: "unsupported",
      stepIds: [],
      reason:
        "Company metrics research is not asset search; no instrument search or verified China coverage.",
    },
    {
      requirementId: "holdings",
      status: "unsupported",
      stepIds: [],
      reason: "A metrics dashboard does not implement holdings or portfolio performance.",
    },
    {
      requirementId: "peer-pe",
      status: "unsupported",
      stepIds: [],
      reason: "No PE definitions, peer universe, comparable earnings, or explanatory methodology.",
    },
    {
      requirementId: "benchmark",
      status: "unsupported",
      stepIds: [],
      reason: "No benchmark series, return methodology, attribution, or explanations.",
    },
    {
      requirementId: "context",
      status: "partial",
      stepIds: ["research"],
      reason:
        "Only fictional market prose; no verified history, news, causal attribution, or contextual explanation.",
    },
    {
      requirementId: "metrics",
      status: "partial",
      stepIds: ["fixture-metrics", "dashboard"],
      reason:
        "Only arbitrary fixture metrics and a dashboard payload; no verified company data or rendered UI.",
    },
  ],
  gaps: [
    "All product contracts, asset and market support are UNKNOWN.",
    "No live data, holdings storage, peer PE, benchmark calculations, or financial explanations.",
  ],
  questions: [
    "Which licensed sources, instruments, benchmarks, return conventions, and peer methodology are required?",
  ],
  assumptions: ["This plan is scoped exclusively to prototype simulation, not product delivery."],
};
