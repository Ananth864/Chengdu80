/// <reference lib="dom" />
// Local dispatch/repository and real Chrome only; no model calls or production approval.
// PLAYWRIGHT_CHROMIUM_EXECUTABLE is inherited from the calling shell.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
import ts from "typescript";
import { z } from "zod";
import {
  capabilityDefinitions,
  exportCapabilityMarkdown,
  finmatchQuestionnaire,
  finmatchContractSchemas,
  validateCapabilityPlan,
  type CapabilityContractValues,
  type CapabilityPlan,
} from "../packages/capabilities/src";
import {
  generateCapabilityTypeScript,
  publicCapabilityResult,
  runCapabilityPlan,
  UNVERIFIED_CAPABILITY_WARNING,
} from "../packages/capabilities/src/runtime";
import { protocols, type Application } from "../apps/web/src/lib/contracts";
import { capabilityRequirements, initialRequirements } from "../apps/web/src/lib/planning";
import { previewDocument } from "../apps/web/src/lib/preview-document";
import { sampleBundle } from "../apps/web/src/lib/samples";
import { verifyApplication } from "../apps/web/src/server/browser-verification";
import { compileCapabilityProgram } from "../apps/web/src/server/capability-compiler";
import { assertCapabilityArtifact } from "../apps/web/src/server/capability-release";
import { dispatch } from "../apps/web/src/server/platform";
import { findApp, saveApp } from "../apps/web/src/server/repository";
import { disposeRuntimes } from "../apps/web/src/server/runtime";

// Match JSON persistence, including the runtime's null-prototype records.
function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
function assertPublic(value: unknown) {
  assert.doesNotMatch(JSON.stringify(value), /"(?:answers|total_score|risk_profile_bucket)"\s*:/);
}
const dir = await mkdtemp(join(tmpdir(), "cd80-finmatch-flow-"));
const env = { CD80_LOCAL_MODE: "1", CD80_DATA_DIR: dir };
const previous = new Map(Object.keys(env).map((key) => [key, process.env[key]]));
Object.assign(process.env, env);
const access = { ownerId: "local-prototype-owner", accessToken: null };
const submission: CapabilityContractValues["finmatch.questionnaire-submission@v0-demo"] = {
  questionnaire_version: "v0-demo",
  answers: { q1: 2, q2: 2, q3: 2, q4: 2, q5: 2, q6: 2, q7: 3 },
};
const selections: CapabilityContractValues["finmatch.industry-selection@1"] = [
  "technology",
  "energy",
  "technology",
];
const inputs = { selections, questionnaire: submission };
const preference = {
  selection_mode: "selected",
  selected_industries: ["technology", "energy"],
};
let browser: Browser | undefined;
let passed = 0;
function pass(name: string) {
  passed++;
  console.log("PASS " + name);
}

async function checkBrowser(app: Application) {
  const release = app.preview!;
  const before = copy(await findApp(access, app.id));
  const context = await browser!.newContext({ serviceWorkers: "block" });
  try {
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors: string[] = [];
    const responses: unknown[] = [];
    const requests: unknown[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.exposeFunction(
      "finmatchRpc",
      async (message: { capability: string; input: unknown }) => {
        requests.push(copy(message.input));
        const result = await dispatch(access, {
          action: "rpc",
          appId: app.id,
          releaseId: release.id,
          capability: message.capability,
          input: message.input,
        });
        assertPublic(result);
        responses.push(copy(result));
        return result;
      },
    );
    const nonce = crypto.randomUUID().replaceAll("-", "");
    await page.setContent('<iframe id="candidate" sandbox="allow-scripts"></iframe>');
    await page.evaluate((token) => {
      const state = { ready: false, errors: [] as string[] };
      (window as any).finmatchState = state;
      window.addEventListener("message", async (event) => {
        const frame = document.getElementById("candidate") as HTMLIFrameElement;
        const message = event.data;
        if (
          event.source !== frame.contentWindow ||
          event.origin !== "null" ||
          message?.channel !== "cd80" ||
          message.nonce !== token
        )
          return;
        if (message.log) {
          state.errors.push(String(message.log.message));
          return;
        }
        if (message.ready) {
          state.ready = true;
          return;
        }
        try {
          const result = await (window as any).finmatchRpc(message);
          frame.contentWindow!.postMessage(
            { channel: "cd80-result", nonce: token, id: message.id, result },
            "*",
          );
        } catch (error) {
          state.errors.push(String(error));
          frame.contentWindow!.postMessage(
            { channel: "cd80-result", nonce: token, id: message.id, error: String(error) },
            "*",
          );
        }
      });
    }, nonce);
    const html = previewDocument(release.bundle, nonce);
    await page.evaluate((document) => {
      (window.document.getElementById("candidate") as HTMLIFrameElement).srcdoc = document;
    }, html);
    await page.waitForFunction(() => (window as any).finmatchState.ready);
    const frame = page.frameLocator("#candidate");
    assert.equal(await frame.locator("#run").isDisabled(), true);
    assert.equal(await frame.locator('input[type="radio"]:checked').count(), 0);
    assert.equal(await frame.locator("#result").innerText(), "");
    assert.equal(await frame.locator("#other-inputs").isVisible(), false);
    assert.equal(await frame.locator("#questionnaires fieldset").count(), 7);
    for (const [index, question] of finmatchQuestionnaire.entries()) {
      const field = frame.locator("#questionnaires fieldset").nth(index);
      assert.equal(await field.locator("legend").innerText(), question.question);
      assert.deepEqual(
        await field.locator("label").allTextContents(),
        question.choices.map(({ text }) => text),
      );
      assert(!/\b(?:Low|Medium|High)\s*[:(]/.test(await field.innerText()));
      assert.equal(await field.locator('input[type="radio"]').count(), 3);
      if (index < 6)
        await frame
          .locator(`#finmatch-0-${question.id}-${submission.answers[question.id]}`)
          .check();
    }
    assert.equal(
      await frame.locator("#run").isDisabled(),
      true,
      "Partial questionnaire cannot run",
    );
    assert.equal(requests.length, 0);
    assert.deepEqual(await findApp(access, app.id), before);
    await frame.locator("#finmatch-0-q7-3").check();
    await frame.locator('input[type="checkbox"][value="technology"]').check();
    await frame.locator('input[type="checkbox"][value="energy"]').check();
    assert.equal(await frame.locator("#run").isDisabled(), false);
    await frame.locator("#run").click();
    await frame.locator("#result").filter({ hasText: "risk_aligned_industries" }).waitFor();
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0], {
      inputs: { selections: ["technology", "energy"], questionnaire: submission },
    });
    const rendered = JSON.parse(await frame.locator("#result").innerText());
    assert.deepEqual(rendered, responses[0]);
    const renderedOutputs = z
      .object({ outputs: z.record(z.string(), z.unknown()) })
      .parse(rendered).outputs;
    assert.deepEqual(renderedOutputs.preferences, preference);
    assertPublic(rendered);
    assert.doesNotMatch(
      await frame.locator("body").innerText(),
      /total_score|risk_profile_bucket|riskAlias/,
    );
    await page.evaluate((document) => {
      (window as any).finmatchState.ready = false;
      (window.document.getElementById("candidate") as HTMLIFrameElement).srcdoc = document;
    }, html);
    await page.waitForFunction(() => (window as any).finmatchState.ready);
    assert.equal(await frame.locator("input:checked").count(), 0);
    assert.equal(await frame.locator("#result").innerText(), "");
    assert.equal(await frame.locator("#run").isDisabled(), true);
    assert.equal(requests.length, 1, "Reload must not resubmit answers");
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => (window as any).finmatchState.errors), []);
    assert.deepEqual(await findApp(access, app.id), before, "Browser submissions must not persist");
  } finally {
    await context.close();
  }
}

try {
  const spec = {
    ...copy(protocols.find(({ id }) => id === "portfolio")!.defaultSpec),
    name: "FinMatch local flow fixture",
    purpose:
      "Seven-answer v0-demo risk questionnaire, industry preferences and explicit-policy mapping; unverified developer draft only.",
  };
  const requirements = initialRequirements();
  assert.deepEqual(requirements.missingInputs, []);
  const expected = capabilityRequirements(spec, requirements);
  const docs = capabilityDefinitions
    .filter(({ id }) => /^CAP-00[123]$/.test(id))
    .flatMap(({ sourceDocuments }) => sourceDocuments ?? []);
  assert(docs.length > 0);
  const plan: CapabilityPlan = {
    schemaVersion: 1,
    requirements: expected.map((row) => ({ ...row, assetTypes: ["stocks"], markets: ["China"] })),
    steps: [
      {
        id: "prefs",
        capabilityId: "CAP-001",
        version: "0.2.0",
        inputs: {
          selected_industries: {
            kind: "input",
            name: "selections",
            contract: "finmatch.industry-selection@1",
          },
        },
      },
      {
        id: "risk",
        capabilityId: "CAP-002",
        version: "0.2.0",
        inputs: {
          submission: {
            kind: "input",
            name: "questionnaire",
            contract: "finmatch.questionnaire-submission@v0-demo",
          },
        },
      },
      {
        id: "mapping",
        capabilityId: "CAP-003",
        version: "0.2.0",
        inputs: {
          risk_result: { kind: "step", stepId: "risk", output: "risk_result" },
          industry_preference: { kind: "step", stepId: "prefs", output: "industry_preference" },
        },
      },
    ],
    outputs: {
      preferences: { kind: "step", stepId: "prefs", output: "industry_preference" },
      mapping: { kind: "step", stepId: "mapping", output: "mapping_result" },
    },
    coverage: expected.map((row) => ({
      requirementId: row.id,
      status: "partial",
      stepIds: ["prefs", "risk", "mapping"],
      reason: `Documented developer-draft contracts only (${docs.join(", ")}); validated suitability, approved mapping and production portfolio delivery are unsupported.`,
    })),
    gaps: [
      "No approved mapping policy or validated suitability assessment; production delivery is unsupported.",
    ],
    questions: [],
    assumptions: [
      "Any explicitly supplied mapping policy is a test-only fixture, not product approval.",
    ],
  };
  const validation = validateCapabilityPlan(plan, expected);
  assert.equal(validation.valid, true);
  assert.equal(validation.executable, true);
  assert.equal(validation.productionReady, false);
  let app: Application = await saveApp(
    access,
    {
      id: crypto.randomUUID(),
      ownerId: access.ownerId,
      revision: 0,
      name: spec.name,
      spec,
      workspaceSpec: spec,
      workspace: sampleBundle(spec),
      current: null,
      preview: null,
      requirements,
      data: {
        inputs: copy(protocols[0]!.fixture.input),
        note: "Safe existing data, not questionnaire answers",
      },
      history: [],
      events: [],
      createdAt: new Date().toISOString(),
    },
    null,
  );
  const initialData = copy(app.data);
  const markdown = exportCapabilityMarkdown(plan, "Documented, unverified local FinMatch draft.");
  await dispatch(access, { action: "save-capability-plan", appId: app.id, markdown });
  app = await findApp(access, app.id);
  assert.deepEqual(app.requirements!.capabilityPlan, plan);
  assert.deepEqual(capabilityRequirements(app.workspaceSpec!, app.requirements!), expected);
  assert.equal(app.workflow!.basis, "capability-plan");
  for (const edge of [
    { from: "input:selections", to: "prefs", label: "selected_industries" },
    { from: "input:questionnaire", to: "risk", label: "submission" },
    { from: "risk", to: "mapping", label: "risk_result -> risk_result" },
    { from: "prefs", to: "mapping", label: "industry_preference -> industry_preference" },
  ])
    assert(app.workflow!.edges.some((actual) => JSON.stringify(actual) === JSON.stringify(edge)));
  assert.equal(app.feasibility!.outcome, "revise");
  pass(
    "Markdown dispatch persists exact expected requirements, three pinned capabilities and actual workflow bindings",
  );

  const rpc = (input: unknown) =>
    dispatch(access, {
      action: "rpc",
      appId: app.id,
      releaseId: app.preview!.id,
      capability: "capability.flow",
      input,
    });
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
  });
  for (const variant of ["default", "private-alias-and-test-policy"] as const) {
    const selected = copy(plan);
    if (variant !== "default") {
      selected.outputs.riskAlias = { kind: "step", stepId: "risk", output: "risk_result" };
      selected.outputs.nested = {
        kind: "literal",
        value: {
          rows: [
            { total_score: 15, risk_profile_bucket: "medium", answers: { q1: 2 }, visible: "kept" },
          ],
        },
      };
      selected.steps[2]!.inputs.mapping_policy = {
        kind: "literal",
        value: {
          policy_id: "test-only-not-product-approved",
          policy_version: "1",
          questionnaire_versions: ["v0-demo"],
          bucket_to_industries: {
            low: ["finance"],
            medium: ["energy", "energy", "manufacturing", "energy"],
            high: ["technology"],
          },
        },
      };
      assert.equal(validateCapabilityPlan(selected, expected).executable, true);
      await dispatch(access, {
        action: "save-capability-plan",
        appId: app.id,
        markdown: exportCapabilityMarkdown(selected),
      });
    }
    await dispatch(access, { action: "simulate-capabilities", appId: app.id });
    app = await findApp(access, app.id);
    const preview = app.preview!;
    assert.equal(app.current, null);
    assert.deepEqual(app.data, initialData);
    assert.equal(preview.capabilityArtifact!.simulation, false);
    assert.equal(preview.simulationPassed, true, JSON.stringify(preview.verification.checks));
    assert.equal(preview.verification.passed, false);
    for (const name of [
      "Generated TypeScript compilation and execution",
      "Browser rendering",
      "Browser interaction and persistence",
    ])
      assert(
        preview.verification.checks.some((check) => check.name === name && check.passed),
        name,
      );
    assert(
      preview.verification.checks.some(
        (check) => check.name === "Production financial verification" && !check.passed,
      ),
    );
    await assertCapabilityArtifact(preview);
    const raw = await runCapabilityPlan(selected, inputs);
    const riskResult = z
      .strictObject({
        risk_result: finmatchContractSchemas["finmatch.risk-result@v0-demo"],
      })
      .parse(raw.results.risk).risk_result;
    assert.deepEqual(riskResult, { ...submission, total_score: 15, risk_profile_bucket: "medium" });
    assert.deepEqual(raw.provenance, {
      simulated: false,
      unverified: true,
      warning: UNVERIFIED_CAPABILITY_WARNING,
    });
    assert.deepEqual(raw.outputs.preferences, preference);
    const result = await rpc({ inputs });
    assert.deepEqual(copy(result), copy(publicCapabilityResult(selected, raw)));
    assertPublic(result);
    assert.deepEqual(result.results.risk, {});
    assert.equal(Object.hasOwn(result.outputs, "riskAlias"), false);
    if (variant === "default") {
      assert.deepEqual(Object.keys(result.outputs).sort(), ["mapping", "preferences"]);
      assert.equal((result.outputs.mapping as any).mapping_status, "mapping_not_configured");
      assert.equal((result.outputs.mapping as any).error_code, "MAPPING_POLICY_MISSING");
      assert.deepEqual((result.outputs.mapping as any).risk_aligned_industries, []);
    } else {
      const mapping = raw.outputs.mapping as CapabilityContractValues["finmatch.mapping-result@1"];
      assert.equal(mapping.mapping_status, "mapped");
      assert.equal(mapping.total_score, 15);
      assert.equal(mapping.risk_profile_bucket, "medium");
      assert.deepEqual(mapping.risk_aligned_industries, ["energy", "manufacturing"]);
      if (mapping.mapping_status !== "mapped") throw new Error("Test policy did not map");
      assert.deepEqual(mapping.industry_preference_comparison, {
        selection_mode: "selected",
        user_selected_industries: ["technology", "energy"],
        overlap_industries: ["energy"],
        selected_outside_mapping: ["technology"],
      });
      assert.deepEqual(result.outputs.nested, { rows: [{ visible: "kept" }] });
      assert.deepEqual(raw.outputs.riskAlias, riskResult);
    }
    const compiled = compileCapabilityProgram(selected);
    assert.equal(compiled.typescript, preview.capabilityArtifact!.typescript);
    assert.equal(compiled.typescript, generateCapabilityTypeScript(selected));
    assert(
      compiled.typescript.includes(
        '"questionnaire": CapabilityContractValues["finmatch.questionnaire-submission@v0-demo"]',
      ),
    );
    assert(!compiled.typescript.includes("SimulationContractValues"));
    assert.deepEqual(copy(await compiled.run(inputs)), copy(raw));
    // Independently type-check the exact artifact against real package exports, not virtual contract stubs.
    const root = fileURLToPath(new URL("../packages/capabilities/", import.meta.url));
    const virtual = join(root, "generated-finmatch-flow.ts");
    const options: ts.CompilerOptions = {
      strict: true,
      noUncheckedIndexedAccess: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      paths: {
        "@web-starter/capabilities": [join(root, "src/index.ts")],
        "@web-starter/capabilities/runtime": [join(root, "src/runtime.ts")],
      },
    };
    const host = ts.createCompilerHost(options);
    const getSourceFile = host.getSourceFile.bind(host);
    host.getSourceFile = (path, languageVersion, onError, createNew) =>
      path === virtual
        ? ts.createSourceFile(path, compiled.typescript, languageVersion, true)
        : getSourceFile(path, languageVersion, onError, createNew);
    assert.deepEqual(
      ts
        .getPreEmitDiagnostics(ts.createProgram([virtual], options, host))
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
      [],
    );
    pass(
      `${variant}: actual non-simulated preview, real-package TypeScript compilation and recursively redacted RPC`,
    );

    const before = copy(await findApp(access, app.id));
    for (const input of [
      {},
      { inputs: { ...inputs, unknown: true } },
      { inputs: { ...inputs, selections: ["unknown"] } },
      {
        inputs: {
          ...inputs,
          questionnaire: { questionnaire_version: "v0-demo", answers: { q1: 2 } },
        },
      },
      {
        inputs: {
          ...inputs,
          questionnaire: { ...submission, answers: { ...submission.answers, q7: 4 } },
        },
      },
      { inputs, extra: true },
    ]) {
      await assert.rejects(rpc(input), /Invalid|Unrecognized|Too big/);
      assert.deepEqual(await findApp(access, app.id), before);
    }
    for (const action of ["accept", "reverify"]) {
      await assert.rejects(
        dispatch(access, {
          action,
          appId: app.id,
          releaseId: preview.id,
          artifactHash: preview.capabilityArtifact!.artifactHash,
        }),
        /Mock|mock|unverified/,
      );
      assert.deepEqual(await findApp(access, app.id), before);
    }
    await checkBrowser(app);
    pass(
      `${variant}: partial/invalid inputs and production promotion rejected; exact browser copy, no risk UI or persistence, reload clears answers`,
    );
  }
  const broken = copy(app.preview!);
  broken.bundle.files["app.js"] = "throw new Error('FinMatch browser failure fixture');";
  const before = copy(await findApp(access, app.id));
  const checks = await verifyApplication(broken, app);
  assert(
    checks.some((check) => check.name === "Application browser verification" && !check.passed),
  );
  assert.deepEqual(await findApp(access, app.id), before);
  pass("Actual Chrome release gate fails closed on broken preview code without repository writes");
  const previousExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = "/missing/finmatch-verifier-browser";
  try {
    const failed = await dispatch(access, { action: "simulate-capabilities", appId: app.id });
    assert.equal(failed.preview.simulationPassed, false);
    assert.equal(failed.current, null);
    assert(
      failed.preview.verification.checks.some(
        (check: { name: string; passed: boolean }) =>
          check.name === "Application browser verification" && !check.passed,
      ),
    );
    const savedFailure = await findApp(access, app.id);
    assert.equal(savedFailure.preview!.id, failed.preview.id);
    await assert.rejects(
      dispatch(access, {
        action: "rpc",
        appId: app.id,
        releaseId: failed.preview.id,
        capability: "capability.flow",
        input: { inputs },
      }),
      /Capability preview failed checks: Application browser verification/,
    );
    assert.deepEqual(savedFailure.data, initialData);
  } finally {
    if (previousExecutable === undefined) delete process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    else process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = previousExecutable;
  }
  pass(
    "Missing verifier browser persists diagnostic checks and blocks execution with the actual cause",
  );
  console.log(
    `${passed} FinMatch local flow checks passed. No live model calls, validated suitability, approved product mapping, hosted isolation or production readiness is asserted.`,
  );
} finally {
  await browser?.close();
  await disposeRuntimes();
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
}
