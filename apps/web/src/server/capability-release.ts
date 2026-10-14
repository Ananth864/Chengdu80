import {
  capabilityDefinitions,
  validateCapabilityPlan,
  SIMULATION_WARNING,
  canonicalCapabilityJson,
} from "@web-starter/capabilities";
import {
  generateCapabilityTypeScript,
  capabilityImplementationSources,
} from "@web-starter/capabilities/runtime";
import { bundleSchema, type ProductSpec, type Release } from "../lib/contracts";
import { capabilityRequirements, workflowGraph, type Requirements } from "../lib/planning";
import { sourceHash, inspectSource } from "./runtime";
import { compileCapabilityProgram } from "./capability-compiler";

export async function capabilityArtifactHash(release: Release) {
  const artifact = release.capabilityArtifact;
  if (!artifact) throw new Error("Capability artifact required");
  return sourceHash({
    ...release.bundle,
    files: {
      ...release.bundle.files,
      "calculations.js": canonicalCapabilityJson({
        policy: "capability-simulation-v1",
        source: release.bundle.files["calculations.js"],
        spec: release.spec,
        requirements: release.requirements,
        plan: artifact.plan,
        typescript: artifact.typescript,
        simulation: artifact.simulation,
        implementations: artifact.plan.steps.map((step) => ({
          id: step.capabilityId,
          version: step.version,
          definition: capabilityDefinitions.find(
            (entry) => entry.id === step.capabilityId && entry.version === step.version,
          ),
          source: capabilityImplementationSources(step.capabilityId, step.version),
        })),
      }),
    },
  });
}

export async function assertCapabilityArtifact(release: Release) {
  const artifact = release.capabilityArtifact;
  if (!artifact || !release.requirements || !release.simulationPassed)
    throw new Error("Contract-tested capability preview required");
  const validation = validateCapabilityPlan(
    artifact.plan,
    capabilityRequirements(release.spec, release.requirements),
  );
  if (
    !validation.executable ||
    artifact.typescript !== generateCapabilityTypeScript(artifact.plan) ||
    artifact.artifactHash !== (await capabilityArtifactHash(release)) ||
    release.verification.sourceHash !== (await sourceHash(release.bundle))
  )
    throw new Error("Capability artifact changed or no longer resolves; rebuild and review");
}

export async function makeCapabilityRelease(
  spec: ProductSpec,
  requirements: Requirements,
): Promise<Release> {
  const plan = requirements.capabilityPlan;
  if (!plan) throw new Error("Select a capability plan first");
  const validation = validateCapabilityPlan(plan, capabilityRequirements(spec, requirements));
  if (!validation.executable)
    throw new Error(validation.issues.map((issue) => issue.message).join("; "));
  const defaults: Record<string, unknown> = {};
  for (const binding of [
    ...plan.steps.flatMap((step) => Object.values(step.inputs)),
    ...Object.values(plan.outputs),
  ]) {
    if (binding.kind !== "input") continue;
    defaults[binding.name] =
      binding.contract === "simulation.nine-answers@1"
        ? Array(9).fill("UNKNOWN")
        : binding.contract === "simulation.metrics@1"
          ? { fixtureValue: 7, unit: "arbitrary-fixture-units" }
          : binding.contract === "simulation.risk@1"
            ? "simulated-low"
            : binding.contract === "simulation.items@1"
              ? []
              : binding.contract === "simulation.dashboard@1"
                ? { title: "Fixture", fixtureValue: 7, warning: SIMULATION_WARNING }
                : "Prototype input";
  }
  // The browser controls only presentation and inputs; financial handlers stay trusted.
  const bundle = bundleSchema.parse({
    manifest: { schemaVersion: 1, name: spec.name, protocol: spec.protocol, permissions: [] },
    files: {
      "index.html":
        '<main><h1>Capability simulation</h1><p id="warning"></p><label for="inputs">Prototype inputs (JSON)</label><textarea id="inputs" rows="9"></textarea><button id="run" type="button">Run simulation</button><pre id="result" aria-live="polite"></pre></main>',
      "app.js": `const warning=document.getElementById('warning');warning.textContent=${JSON.stringify(SIMULATION_WARNING)};const input=document.getElementById('inputs');input.value=JSON.stringify(${JSON.stringify(defaults)},null,2);const result=document.getElementById('result');async function run(){try{result.textContent=JSON.stringify(await cd80.call('capability.flow',{inputs:JSON.parse(input.value)}),null,2)}catch(e){result.textContent=String(e.message||e)}}document.getElementById('run').addEventListener('click',run);cd80.ready();await run();`,
      "calculations.js":
        "export function analyze(){throw new Error('Use the registered capability flow, not generated financial logic');}",
      "style.css":
        "body{font:16px system-ui;margin:0;padding:24px;background:#f5f5f4;color:#292524}main{max-width:900px;margin:auto}textarea,pre{box-sizing:border-box;width:100%;overflow:auto;padding:12px}button{padding:12px;margin:12px 0}#warning{padding:12px;border:2px solid #a16207}pre{white-space:pre-wrap;overflow-wrap:anywhere}",
    },
  });
  const program = compileCapabilityProgram(plan);
  await program.run(defaults);
  const checks = inspectSource(bundle, spec).filter(
    (check) => check.name !== "Required capabilities",
  );
  checks.push({
    name: "Capability contracts and composition",
    passed: true,
    detail:
      "Exact pinned registry calls; input and output schemas checked against prototype inputs.",
  });
  checks.push({
    name: "Generated TypeScript compilation and execution",
    passed: true,
    detail:
      "Exact deterministic wrapper strictly type-checked and executed with only the registered runtime import.",
  });
  const simulationPassed = checks.every((check) => check.passed);
  checks.push({
    name: "Production financial verification",
    passed: false,
    detail:
      "Mock/unknown financial capabilities cannot pass production verification. Simulation results are arbitrary fixtures.",
  });
  const release: Release = {
    id: crypto.randomUUID(),
    spec,
    bundle,
    origin: "model",
    notes: "Contract-tested capability simulation; no production activation.",
    createdAt: new Date().toISOString(),
    requirements,
    workflow: workflowGraph(spec, requirements),
    simulationPassed,
    verification: {
      passed: false,
      checks,
      checkedAt: new Date().toISOString(),
      sourceHash: await sourceHash(bundle),
    },
    capabilityArtifact: {
      plan,
      typescript: program.typescript,
      artifactHash: "",
      simulation: true,
    },
  };
  release.capabilityArtifact!.artifactHash = await capabilityArtifactHash(release);
  return release;
}
