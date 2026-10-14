import {
  capabilityDefinitions,
  validateCapabilityPlan,
  SIMULATION_WARNING,
  canonicalCapabilityJson,
  capabilityContractExamples,
  capabilityContractSchemas,
  getCapabilityPorts,
  finmatchQuestionnaire,
  finmatchIndustries,
  type CapabilityContractId,
} from "@web-starter/capabilities";
import {
  generateCapabilityTypeScript,
  capabilityImplementationSources,
} from "@web-starter/capabilities/runtime";
import { bundleSchema, type ProductSpec, type Release } from "../lib/contracts";
import {
  capabilityRequirements,
  workflowGraph,
  UNVERIFIED_WARNING,
  type Requirements,
} from "../lib/planning";
import { sourceHash, inspectSource } from "./runtime";
import { compileCapabilityProgram } from "./capability-compiler";
import { verifyApplication } from "./browser-verification";
import type { Application } from "../lib/contracts";

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

export async function assertCapabilityArtifact(release: Release, requireRunnable = true) {
  const artifact = release.capabilityArtifact;
  if (!artifact || !release.requirements)
    throw new Error("Saved capability artifact and requirements required");
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
  if (requireRunnable && !release.simulationPassed) {
    const failures = release.verification.checks.filter(
      (check) => !check.passed && check.name !== "Production financial verification",
    );
    throw new Error(
      `Capability preview failed checks: ${failures.map((check) => `${check.name}: ${check.detail}`).join("; ") || "Preview execution checks have not passed"}`,
    );
  }
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
  const definitions = plan.steps.map((step) =>
    capabilityDefinitions.find(
      (entry) => entry.id === step.capabilityId && entry.version === step.version,
    )!,
  );
  const simulation = definitions.some((definition) => definition.status === "mock");
  const actual = definitions.some((definition) => definition.status !== "mock");
  const warning = actual ? UNVERIFIED_WARNING : SIMULATION_WARNING;
  const defaults: Record<string, unknown> = {};
  const externalContracts = new Map<string, CapabilityContractId>();
  for (const binding of [
    ...plan.steps.flatMap((step, index) =>
      Object.keys(getCapabilityPorts(definitions[index]!, "inputs") ?? {}).flatMap((name) =>
        step.inputs[name] ? [step.inputs[name]!] : [],
      ),
    ),
    ...Object.values(plan.outputs),
  ]) {
    if (binding.kind !== "input") continue;
    const contract = binding.contract as CapabilityContractId;
    const schema = capabilityContractSchemas[contract];
    if (!schema) throw new Error(`No example schema for external input ${binding.name}`);
    externalContracts.set(binding.name, contract);
    const example =
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
                : binding.contract === "simulation.text@1" ||
                    binding.contract === "simulation.industry@1"
                  ? "Prototype input"
                  : capabilityContractExamples[contract];
    defaults[binding.name] = schema.parse(example);
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
  const submissions = [...externalContracts]
    .filter(([, contract]) => contract === "finmatch.questionnaire-submission@v0-demo")
    .map(([name], index) => ({ name, id: `finmatch-${index}` }));
  if (actual) {
    const industries = [...externalContracts]
      .filter(([, contract]) => contract === "finmatch.industry-selection@1")
      .map(([name], index) => ({ name, id: `industry-${index}` }));
    const privateContracts = new Set(["finmatch.risk-result@v0-demo", "finmatch.mapping-result@1"]);
    const otherDefaults = Object.fromEntries(
      [...externalContracts]
        .filter(
          ([, contract]) =>
            contract !== "finmatch.questionnaire-submission@v0-demo" &&
            contract !== "finmatch.industry-selection@1" &&
            !privateContracts.has(contract),
        )
        .map(([name]) => [name, defaults[name]]),
    );
    // Explicit internal handoff fixtures are never rendered as editable user answers.
    const privateDefaults = Object.fromEntries(
      [...externalContracts]
        .filter(([, contract]) => privateContracts.has(contract))
        .map(([name]) => [name, defaults[name]]),
    );
    const literalQuestionnaire = plan.steps.some((step, index) =>
      Object.entries(getCapabilityPorts(definitions[index]!, "inputs") ?? {}).some(
        ([name, contract]) =>
          contract === "finmatch.questionnaire-submission@v0-demo" &&
          step.inputs[name]?.kind === "literal",
      ),
    );
    bundle.files["index.html"] =
      '<main><h1>Unverified capability preview</h1><p id="warning"></p><div id="finmatch"><div id="questionnaires"></div><div id="industries"></div></div><div id="other-inputs"><label for="inputs">Other operator inputs (JSON)</label>' +
      ([...externalContracts.values()].some(
        (contract) =>
          contract === "finmatch.mapping-policy-request@1" ||
          contract === "finmatch.mapping-policy@1",
      )
        ? "<p>Legacy industry mapping requires a separate operator-supplied policy. The configured company-size rule does not require this input.</p>"
        : "") +
      '<textarea id="inputs" rows="9" autocomplete="off"></textarea></div><button id="run" type="button">Run preview</button><pre id="result" aria-live="polite"></pre></main>';
    bundle.files["app.js"] = `
const warning=document.getElementById('warning');warning.textContent=${JSON.stringify(warning)};
const submissions=${JSON.stringify(submissions)};
const industries=${JSON.stringify(industries)};
const questions=${JSON.stringify(finmatchQuestionnaire.map(({ id, question, choices }) => ({ id, question, choices: choices.map(({ text }) => text) })))};
const industryChoices=${JSON.stringify(finmatchIndustries.map((value) => ({ value, label: value === "fmcg" ? "FMCG" : value.charAt(0).toUpperCase() + value.slice(1) })))};
const input=document.getElementById('inputs');input.value=JSON.stringify(${JSON.stringify(otherDefaults)},null,2);
document.getElementById('other-inputs').hidden=${Object.keys(otherDefaults).length === 0};
const result=document.getElementById('result');const button=document.getElementById('run');
const form=document.getElementById('finmatch');
function questionnaire(entry){const section=document.createElement('section');const heading=document.createElement('h2');heading.textContent=entry?entry.name:'Questionnaire contract';section.append(heading);for(const question of questions){const field=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=question.question;field.append(legend);question.choices.forEach((text,index)=>{const label=document.createElement('label');if(entry){const radio=document.createElement('input');radio.type='radio';radio.name=entry.id+'-'+question.id;radio.id=entry.id+'-'+question.id+'-'+(index+1);radio.value=String(index+1);radio.autocomplete='off';label.htmlFor=radio.id;label.append(radio)}label.append(document.createTextNode(text));field.append(label)});section.append(field)}document.getElementById('questionnaires').append(section)}
submissions.forEach(questionnaire);if(${literalQuestionnaire}&&!submissions.length)questionnaire(null);
for(const entry of industries){const field=document.createElement('fieldset');const legend=document.createElement('legend');legend.textContent=entry.name;field.append(legend);industryChoices.forEach((choice,index)=>{const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.name=entry.id;checkbox.id=entry.id+'-'+index;checkbox.value=choice.value;checkbox.autocomplete='off';label.htmlFor=checkbox.id;label.append(checkbox,document.createTextNode(choice.label));field.append(label)});document.getElementById('industries').append(field)}
function complete(){return submissions.every(entry=>questions.length===7&&questions.every(question=>form.querySelector('input[name="'+entry.id+'-'+question.id+'"]:checked')))}
function update(){button.disabled=!complete()}
form.addEventListener('change',update);
let generation=0;
function clear(){generation++;for(const control of form.querySelectorAll('input'))control.checked=false;result.textContent='';update()}
window.addEventListener('pagehide',clear);window.addEventListener('pageshow',clear);clear();
async function run(){if(!complete())return;const current=generation;try{const inputs=Object.assign(Object.create(null),${JSON.stringify(privateDefaults)},JSON.parse(input.value));for(const entry of submissions){const answers=Object.create(null);for(const question of questions)answers[question.id]=Number(form.querySelector('input[name="'+entry.id+'-'+question.id+'"]:checked').value);inputs[entry.name]={questionnaire_version:'v0-demo',answers}}for(const entry of industries)inputs[entry.name]=Array.from(form.querySelectorAll('input[name="'+entry.id+'"]:checked'),control=>control.value);const output=await cd80.call('capability.flow',{inputs});if(current===generation)result.textContent=JSON.stringify(output,null,2)}catch(e){if(current===generation)result.textContent='Preview could not run. Check the operator inputs.'}}
button.addEventListener('click',run);cd80.ready();if(!submissions.length)await run();
`;
    bundle.files["style.css"] +=
      "fieldset{margin:16px 0;padding:16px;min-width:0}fieldset label{display:block;margin:12px 0}fieldset input{margin-right:8px}button:disabled{opacity:.5;cursor:not-allowed}";
  }
  const program = compileCapabilityProgram(plan);
  bundle.manifest.browserTests = [
    ...(actual
      ? submissions.flatMap((entry) =>
          finmatchQuestionnaire.map((question) => ({
            action: "click" as const,
            selector: `#${entry.id}-${question.id}-1`,
          })),
        )
      : []),
    { action: "click", selector: "#run" },
    { action: "assert-text", selector: "#warning", value: warning },
  ];
  await program.run(defaults);
  const checks = inspectSource(bundle, spec).filter(
    (check) => check.name !== "Required capabilities",
  );
  checks.push({
    name: "Capability contracts and composition",
    passed: true,
    detail:
      "Exact pinned registry calls; input and output schemas checked against contract fixtures, separate from live user submissions.",
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
    detail: actual
      ? "Mock or unverified financial capabilities cannot pass production verification. Defined contracts and passing preview tests do not establish financial validation."
      : "Mock/unknown financial capabilities cannot pass production verification. Simulation results are arbitrary fixtures.",
  });
  const release: Release = {
    id: crypto.randomUUID(),
    spec,
    bundle,
    origin: "model",
    notes: actual
      ? "Contract-tested unverified capability preview; no production activation."
      : "Contract-tested capability simulation; no production activation.",
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
      simulation,
    },
  };
  release.capabilityArtifact!.artifactHash = await capabilityArtifactHash(release);
  const browserChecks = await verifyApplication(release, {
    id: "capability-verification",
    ownerId: "verification",
    spec,
    current: null,
    data: { inputs: defaults },
    name: spec.name,
    revision: 0,
    preview: null,
    history: [],
    events: [],
    createdAt: new Date().toISOString(),
  } as Application);
  release.verification.checks.push(...browserChecks);
  release.simulationPassed = simulationPassed && browserChecks.every((check) => check.passed);
  return release;
}
