/// <reference lib="dom" />
// Run after VITE_LOCAL_MODE=1 bun run build. No model inference or hosted data is used.
// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an installed Chrome instead of Playwright Chromium.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import {
  b2cPerformancePlan,
  exportCapabilityMarkdown,
  SIMULATION_WARNING,
  type CapabilityPlan,
} from "../packages/capabilities/src";
import { protocols, type Application } from "../apps/web/src/lib/contracts";
import { capabilityRequirements, initialRequirements } from "../apps/web/src/lib/planning";
import { sampleBundle } from "../apps/web/src/lib/samples";
import { makeRelease } from "../apps/web/src/server/platform";
import { saveApp } from "../apps/web/src/server/repository";
import { disposeRuntimes } from "../apps/web/src/server/runtime";

const dataDir = await mkdtemp(join(tmpdir(), "cd80-capability-ui-"));
const base = "http://127.0.0.1:3012";
const config = {
  PATH: process.env.PATH ?? "",
  HOST: "127.0.0.1",
  PORT: "3012",
  CD80_LOCAL_MODE: "1",
  VITE_LOCAL_MODE: "1",
  CD80_DATA_DIR: dataDir,
  MODEL_PROVIDER: "openai",
  OPENAI_API_KEY: "",
  GLM_API_KEY: "",
};
const previous = new Map(Object.keys(config).map((key) => [key, process.env[key]]));
Object.assign(process.env, config);
const results: string[] = [];
const errors: string[] = [];
const actions: string[] = [];
let browser: Browser | undefined;
let server: ChildProcess | undefined;
let serverError = "";
async function snapshot(id: string) {
  const response = await fetch(base + "/api/platform");
  assert(response.ok, "Local platform snapshot must be available");
  const state = (await response.json()) as { apps: Application[]; status: { local: boolean } };
  assert.equal(state.status.local, true, "Test must not use hosted persistence");
  const app = state.apps.find((item) => item.id === id);
  assert(app);
  return app;
}

try {
  const spec = { ...protocols[0]!.defaultSpec, name: "Capability browser fixture" };
  const requirements = { ...initialRequirements(), dataSource: "fixtures" as const };
  const expected = capabilityRequirements(spec, requirements);
  const plan: CapabilityPlan = {
    ...structuredClone(b2cPerformancePlan),
    requirements: expected.map((row) => ({ ...row, assetTypes: ["stocks"], markets: ["China"] })),
    steps: structuredClone(b2cPerformancePlan.steps.filter((step) => step.id !== "research")),
    outputs: { dashboard: { kind: "step", stepId: "dashboard", output: "dashboard" } },
    coverage: expected.map((row) => ({
      requirementId: row.id,
      status: "partial",
      stepIds: ["dashboard"],
      reason: "Only an arbitrary fixture dashboard; product contracts and coverage are UNKNOWN.",
    })),
  };
  const current = await makeRelease(spec, sampleBundle(spec), "sample", "Existing verified app");
  assert.equal(current.verification.passed, true);
  const access = { ownerId: "local-prototype-owner", accessToken: null };
  const seeded = await saveApp(
    access,
    {
      id: crypto.randomUUID(),
      ownerId: access.ownerId,
      revision: 0,
      name: spec.name,
      spec,
      workspaceSpec: spec,
      workspace: current.bundle,
      current,
      preview: null,
      requirements,
      data: { inputs: protocols[0]!.fixture.input, note: "Preserve existing app data" },
      history: [],
      events: [],
      createdAt: new Date().toISOString(),
    },
    null,
  );
  await disposeRuntimes();
  server = spawn("node", ["apps/web/server/node-entry.mjs"], {
    env: config,
    stdio: "ignore",
  });
  server.on("error", (error) => {
    serverError = error.message;
  });
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (serverError || server.exitCode !== null)
      throw new Error(serverError || "Isolated Node server exited before readiness");
    try {
      const response = await fetch(base + "/api/platform");
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, "Isolated Node server did not become ready; build in local mode first");
  await snapshot(seeded.id);
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url() === base + "/api/platform" && request.method() === "POST") {
      const body = request.postDataJSON() as { action?: string };
      if (body.action) actions.push(body.action);
    }
  });
  page.setDefaultTimeout(15000);
  await page.goto(base + "/#app=" + seeded.id);
  await page.locator('iframe[aria-busy="false"]').waitFor();
  await page.getByRole("tab", { name: "Requirements", exact: true }).click();
  const markdown = page.getByRole("textbox", { name: "Capability Markdown", exact: true });
  await markdown.waitFor();
  assert.equal(actions.includes("plan-capabilities"), false);
  assert.equal(actions.includes("simulate-capabilities"), false);
  await markdown.fill("Invalid Markdown");
  assert.equal(
    await page.getByRole("button", { name: "Save capability Markdown", exact: true }).isDisabled(),
    true,
  );
  await markdown.fill(exportCapabilityMarkdown(plan, "Explicit browser simulation fixture."));
  await page.getByText("Parsed Markdown preview (2 steps)", { exact: true }).click();
  assert(
    (await page.getByRole("tabpanel", { name: "Requirements", exact: true }).innerText()).includes(
      "fixture-metrics",
    ),
  );
  assert.equal(
    await page.getByRole("button", { name: "Plan capabilities", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(spec.name + " edited");
  assert.equal(
    await page.getByRole("button", { name: "Save capability Markdown", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(spec.name);
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown", exact: true }).click();
  const download = await exported;
  assert.equal(download.suggestedFilename(), "capability-plan.md");
  const downloadPath = await download.path();
  assert(downloadPath);
  assert.equal(
    await readFile(downloadPath, "utf8"),
    exportCapabilityMarkdown(plan, "Explicit browser simulation fixture."),
  );
  const saved = page.waitForResponse(
    (response) =>
      response.url() === base + "/api/platform" &&
      response.request().postDataJSON()?.action === "save-capability-plan",
  );
  await page.getByRole("button", { name: "Save capability Markdown", exact: true }).click();
  assert.equal((await saved).status(), 200);
  await page.getByRole("heading", { name: "Selected definitions", exact: true }).waitFor();
  const requirementsText = await page
    .getByRole("tabpanel", { name: "Requirements", exact: true })
    .innerText();
  for (const text of [
    "Stock Price API: mock",
    "Metrics Dashboard: mock",
    "UNKNOWN",
    "Requirement coverage",
    "partial",
    "Gaps",
  ])
    assert(requirementsText.includes(text), "Missing requirement detail: " + text);
  assert.deepEqual((await snapshot(seeded.id)).requirements?.capabilityPlan, plan);
  results.push(
    "Local Markdown parse/export, dirty-form gates, explicit save, mock statuses and UNKNOWN coverage",
  );

  await page.getByRole("textbox", { name: "Name", exact: true }).fill(spec.name + " edited");
  assert.equal(
    await page.getByRole("button", { name: "Simulate capabilities", exact: true }).isDisabled(),
    true,
  );
  assert.equal(
    await page.getByRole("button", { name: "Plan capabilities", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(spec.name);
  await page.getByRole("tab", { name: "Workflow", exact: true }).click();
  const edgeText = await page.locator('section[aria-label="Workflow edges"]').innerText();
  assert(edgeText.includes("metrics -> metrics"));
  assert(edgeText.includes("dashboard -> dashboard"));
  assert(edgeText.includes("Literal: symbol"));
  assert(
    (await page.getByRole("tabpanel", { name: "Workflow", exact: true }).innerText()).includes(
      "validated capability bindings",
    ),
  );
  const graph = (await snapshot(seeded.id)).workflow;
  assert.deepEqual(graph?.edges, [
    { from: "literal:fixture-metrics:symbol", to: "fixture-metrics", label: "symbol" },
    { from: "fixture-metrics", to: "dashboard", label: "metrics -> metrics" },
    { from: "dashboard", to: "output:dashboard", label: "dashboard -> dashboard" },
  ]);
  results.push(
    "Saved Workflow displays actual literal, step-port and output bindings, not executed traces",
  );

  await page.getByRole("tab", { name: "Requirements", exact: true }).click();
  const simulated = page.waitForResponse(
    (response) =>
      response.url() === base + "/api/platform" &&
      response.request().postDataJSON()?.action === "simulate-capabilities",
  );
  await page.getByRole("button", { name: "Simulate capabilities", exact: true }).click();
  assert.equal((await simulated).status(), 200);
  await page.getByText("Simulation result only", { exact: true }).waitFor();
  await page.getByText("Unverified release: production blocked", { exact: true }).waitFor();
  assert(
    (await page.getByRole("tabpanel", { name: "Preview", exact: true }).innerText()).includes(
      SIMULATION_WARNING,
    ),
  );
  const frame = page.frameLocator("iframe");
  await frame.locator("#result").filter({ hasText: "Prototype fixture dashboard" }).waitFor();
  const result = JSON.parse(await frame.locator("#result").innerText());
  assert.equal(result.outputs.dashboard.fixtureValue, 7);
  assert.equal(result.outputs.dashboard.warning, SIMULATION_WARNING);
  const rerun = page.waitForResponse(
    (response) =>
      response.url() === base + "/api/platform" &&
      response.request().postDataJSON()?.action === "rpc",
  );
  await frame.getByRole("button", { name: "Run simulation", exact: true }).click();
  assert.equal((await rerun).status(), 200);
  assert(actions.includes("rpc"));
  const after = await snapshot(seeded.id);
  assert.equal(after.preview?.simulationPassed, true);
  assert.equal(after.preview?.verification.passed, false);
  assert.equal(after.current?.id, current.id);
  assert.deepEqual(after.data, seeded.data);
  assert(actions.includes("save-capability-plan") && actions.includes("simulate-capabilities"));
  assert.equal(actions.includes("plan-capabilities"), false, "No automatic model planner calls");
  results.push(
    "Explicit simulation runs server capability.flow, renders mock fixture, warns outside iframe and retains active app/data",
  );

  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Release checks", exact: true }).click();
  await page.getByText("Generated TypeScript (review only)", { exact: true }).click();
  assert((await page.getByRole("dialog").locator("pre").innerText()).includes("fixture-metrics"));
  assert.equal(
    await page.getByRole("button", { name: "Approve capability release", exact: true }).count(),
    0,
  );
  await page.keyboard.press("Escape");
  results.push(
    "Generated TypeScript review is visible and mock production approval is unavailable",
  );

  await mkdir(".local/capability-ui", { recursive: true });
  await page.screenshot({ path: ".local/capability-ui/desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["Preview", "Requirements", "Workflow"]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.getByRole("tabpanel", { name: tab, exact: true }).waitFor();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `${tab} must not overflow mobile viewport`,
    );
    await page.screenshot({
      path: `.local/capability-ui/mobile-${tab.toLowerCase()}.png`,
      fullPage: true,
    });
  }
  results.push(
    "390px mobile Preview, Requirements and Workflow have no document horizontal overflow",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    ".local/capability-ui/results.json",
    JSON.stringify({ results, errors, actions }, null, 2),
  );
  console.log(results.map((result) => "PASS " + result).join("\n"));
} finally {
  await browser?.close();
  if (server?.pid && server.exitCode === null) {
    const exited = new Promise((resolve) => server!.once("exit", resolve));
    server.kill("SIGTERM");
    await exited;
  }
  await disposeRuntimes();
  await rm(dataDir, { recursive: true, force: true });
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
