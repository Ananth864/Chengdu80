import type { ProductSpec } from "../lib/contracts";
import type { Requirements, FeasibilityReport } from "../lib/planning";
import type { RegisteredPlugin } from "../lib/plugins";
import { settings } from "./settings";
import { modelConfiguration } from "./model-config";
import { validateCapabilityPlan } from "@web-starter/capabilities";
import { capabilityRequirements } from "../lib/planning";

export async function assessDesign(
  spec: ProductSpec,
  requirements: Requirements,
  plugins: RegisteredPlugin[],
): Promise<FeasibilityReport> {
  const config = await settings();
  const scope = feasibility({
    ...spec,
    constraints: [
      ...spec.constraints,
      ...requirements.assumptions,
      ...requirements.questions.map((question) => question.answer),
    ],
  });
  const checks: FeasibilityReport["checks"] = [
    {
      area: "Scope",
      status: scope.allowed ? "supported" : "unavailable",
      reason: scope.reason,
      alternative: scope.allowed
        ? undefined
        : "Use on-demand analysis without trading, background jobs or notifications.",
    },
  ];
  if (requirements.capabilityPlan) {
    const validation = validateCapabilityPlan(
      requirements.capabilityPlan,
      capabilityRequirements(spec, requirements),
    );
    checks.push({
      area: "Capability plan",
      status: validation.productionReady ? "supported" : "conditional",
      reason:
        validation.issues.map((issue) => issue.message).join("; ") ||
        "Financial verification and release approval required.",
      alternative: validation.executable
        ? "Review only as a labelled simulation; production activation is blocked."
        : "Resolve invalid bindings and requirement coverage before simulation.",
    });
  }
  const missing = [
    ...requirements.missingInputs,
    ...requirements.questions
      .filter((question) => !question.answer)
      .map((question) => question.question),
  ];
  if (spec.protocol === "strategy" && !requirements.analysisPeriod)
    missing.push("Choose an analysis period for historical comparison.");
  checks.push({
    area: "Requirements",
    status: missing.length ? "conditional" : "supported",
    reason: missing.length
      ? missing.join("; ")
      : "All recorded required inputs and questions are resolved.",
    alternative: missing.length
      ? "Answer the targeted questions and resolve missing inputs before confirming."
      : undefined,
  });
  let dataReason =
    "User inputs must provide the selected protocol fields; they are not independently sourced.";
  let dataStatus: "supported" | "conditional" = "supported";
  if (requirements.dataSource === "fixtures")
    dataReason =
      "Synthetic protocol fixtures are available for demonstrations, not real-market conclusions.";
  if (requirements.dataSource === "tushare") {
    dataStatus = config.TUSHARE_TOKEN && spec.protocol === "strategy" ? "supported" : "conditional";
    dataReason = !config.TUSHARE_TOKEN
      ? "TUSHARE_TOKEN is missing."
      : spec.protocol !== "strategy"
        ? "The built-in Tushare connector only supplies daily closes, not holdings or fundamentals."
        : "Daily unadjusted closes are configured; token entitlements, requested date coverage and corporate actions remain unverified.";
  }
  if (requirements.dataSource === "plugins") {
    dataStatus = requirements.pluginOperations.length ? "supported" : "conditional";
    dataReason = requirements.pluginOperations.length
      ? "Selected operations are checked below; data truth, field fitness and freshness remain unverified."
      : "Choose at least one registered plugin operation.";
  }
  checks.push({
    area: "Data",
    status: dataStatus,
    reason: dataReason,
    alternative:
      dataStatus === "conditional"
        ? "Configure a supported source, select a registered operation, or explicitly use user inputs/synthetic fixtures."
        : undefined,
  });
  for (const selected of requirements.pluginOperations) {
    const plugin = plugins.find((entry) => entry.id === selected.pluginId);
    const operation = plugin?.operations.find(
      (entry) => entry.operationId === selected.operationId,
    );
    const supported = operation && ["GET", "HEAD"].includes(operation.method);
    checks.push({
      area: `Integration: ${selected.operationId}`,
      status: supported ? "supported" : "conditional",
      reason: supported
        ? `Registered read-only operation at ${plugin!.baseUrl}. Credential bindings are rechecked on invocation.`
        : "Operation is missing or requires an unsupported write/destructive action.",
      alternative: supported
        ? undefined
        : "Register/select a GET or HEAD operation; action approval is not implemented.",
    });
  }
  const text = [spec.purpose, ...spec.inputs, ...spec.outputs].join(" ");
  if (
    /predict(?:ive|ion)?|forecast|实时|预测|live quotes|real[ -]time prices|streaming prices/i.test(
      text,
    )
  )
    checks.push({
      area: "Financial method",
      status: "conditional",
      reason: "Live quote streaming and predictive-model assurance are not implemented.",
      alternative:
        "Revise to historical or user-entered analysis and clearly state its limitations.",
    });
  if (/ai[ -]expla|model explanation/i.test(text) && !modelConfiguration(config).apiKey)
    checks.push({
      area: "AI explanation",
      status: "conditional",
      reason: "An explanation is requested but no model key is configured.",
      alternative: "Configure a model or remove AI explanation from the scope.",
    });
  checks.push({
    area: "Runtime",
    status: "supported",
    reason:
      "Self-contained browser UI, bounded isolated calculations and permission-checked on-demand calls are supported. No unrestricted packages or background orchestration.",
  });
  return {
    outcome: checks.some((check) => check.status === "unavailable")
      ? "reject"
      : checks.some((check) => check.status === "conditional")
        ? "revise"
        : "pass",
    checkedAt: new Date().toISOString(),
    checks,
    limitations:
      "A deterministic readiness assessment, not a success probability, source-credibility certification or test result. Provider access/coverage and generated application behavior still require runtime verification.",
  };
}

// Scope checks are shared by every builder/import path, not delegated to the model.
export function feasibility(input: string | ProductSpec) {
  const fields =
    typeof input === "string"
      ? [input]
      : [input.name, input.purpose, ...input.inputs, ...input.outputs, ...input.constraints];
  const unsupported =
    /\b(execute trades?|place orders?|brokerage|real[ .-]time ticks?|background monitor(?:ing)?|send (?:emails?|wechat)|automatically (?:buy|sell))\b/i;
  const prohibited = new RegExp(
    String.raw`\b(?:no|never|do not|don't|without)\s+${unsupported.source}`,
    "gi",
  );
  const allowed = fields.every((field) =>
    field.split(/[;\n]/).every((clause) => {
      // Explicit prohibitions describe guardrails, not requested capabilities.
      const requirement = clause.replace(prohibited, "");
      return !unsupported.test(requirement);
    }),
  );
  return {
    allowed,
    reason: allowed
      ? "Scope checks passed. Source and calculation verification are still required; this is not a complete feasibility assessment."
      : "This prototype supports analysis, shared data, and on-demand AI. Trading execution, background monitoring, and notifications are outside its available capabilities.",
  };
}

export function assertFeasible(input: string | ProductSpec) {
  const result = feasibility(input);
  if (!result.allowed) throw new Error(result.reason);
  return result;
}
