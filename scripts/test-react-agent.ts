/// <reference lib="dom" />
// macOS browser + Linux platform + local Responses fixture. No real credentials or user data.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import type { Application, ProductSpec } from "../apps/web/src/lib/contracts";
import { importCompanyCsv } from "../apps/web/src/lib/company-table";

let sequence = 0;
const spec: ProductSpec = {
  protocol: "portfolio",
  name: "React company cards",
  purpose: "Review supplied-CSV companies and explicitly save canonical company IDs",
  inputs: ["Completed risk questionnaire", "Normalized industry preference"],
  outputs: ["Current discovery company", "Saved company IDs"],
  outputDetails: {
    "Current discovery company":
      "One matching supplied-CSV SSE company; live financial metrics are unavailable.",
    "Saved company IDs": "Canonical CSV company IDs persisted only by explicit app storage writes.",
  },
  constraints: ["Use supplied-CSV company identities; do not invent live financial metrics."],
};
const plan = {
  requirements: spec.purpose,
  capabilities: ["company-cards"],
  companyQueries: [],
  mode: "live",
  themeOverride: null,
};
const approvalMessage = "Workflow approved. Continue building the approved workflow now.";
const buildSummary = "Build company discovery with an explicitly enabled saved watchlist.";
const brokenSummary = "Test a broken company discovery presentation update.";
const toolOutputs: string[] = [];
const presentation = `import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cd80 } from "@/lib/cd80";
import { CompanyDiscovery } from "@/components/company-discovery";
import { RiskQuestionnaire } from "@/components/risk-questionnaire";
import { IndustryPreference } from "@/components/industry-preference";
import { completedRiskProfileSchema, type RiskProfileCompleted } from "@/lib/risk-profile";
import { normalizedIndustryPreferenceSchema } from "@/lib/company-discovery";
export default function App() {
  const [completed, setCompleted] = useState<RiskProfileCompleted | null>(null);
  const risk = useQuery({ queryKey: ["cd80", "storage", "risk-profile"], queryFn: () => cd80.storage.read("risk-profile", completedRiskProfileSchema), retry: false });
  const preference = useQuery({ queryKey: ["cd80", "storage", "industry-preference"], queryFn: () => cd80.storage.read("industry-preference", normalizedIndustryPreferenceSchema), retry: false });
  const riskResult = completed ?? risk.data;
  return <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
    <p>Live · Shanghai Stock Exchange</p><h1>React company cards</h1>
    <RiskQuestionnaire onCompleted={setCompleted} /><IndustryPreference />
    {riskResult && preference.data && <CompanyDiscovery riskResult={riskResult} industryPreference={preference.data} enableWatchlist />}
    <p data-testid="custom-presentation">Contract-bound presentation</p>
  </main>;
}
`;
const fixture = createServer(async (request, response) => {
  try {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    assert.equal(request.url, "/v1/responses");
    const body = JSON.parse(raw);
    assert.equal(request.headers.authorization, "Bearer react-fixture-key");
    const properties = body.text?.format?.schema?.properties ?? {};
    const last = body.input.map((item: { role?: string }) => item.role).lastIndexOf("user");
    const current = body.input.slice(last);
    const prompt = JSON.stringify(current[0]?.content);
    const calls = current.filter(
      (item: { type?: string }) => item.type === "function_call_output",
    ).length;
    for (const item of current)
      if (item.type === "function_call_output") toolOutputs.push(String(item.output));
    const approvalContext = JSON.stringify({
      instructions: body.instructions,
      messages: body.input.filter(
        (item: { role?: string }) => item.role === "system" || item.role === "developer",
      ),
    });
    let text = "I remember the discussion before building. Codename Copper Finch.";
    let tool;
    if (properties.title) text = JSON.stringify({ title: "React company cards" });
    else if (properties.supported)
      text = JSON.stringify({
        supported: !prompt.includes("booking application"),
        requiresLive: false,
        companyQueries: [],
        requiredCapabilities: ["company-cards"],
        reason: "Only the company-card demo is supported.",
      });
    else if (prompt.includes("booking application")) {
      tool = [
        {
          name: "propose_build",
          arguments: {
            ...plan,
            specification: spec,
            summary: "Attempt unsupported booking bypass",
          },
        },
        { name: "prepare_build", arguments: plan },
        {
          name: "write_file",
          arguments: {
            path: "src/App.tsx",
            content:
              "export default function App() { return <main>booking application bypass</main>; }",
          },
        },
        {
          name: "deploy_preview",
          arguments: { summary: "Attempt unsupported booking deployment" },
        },
      ][calls];
      text = "The booking request was blocked.";
    } else if (
      prompt.includes("Prepare without a proposal") ||
      prompt.includes("Prepare an unapproved workflow")
    ) {
      if (!calls) tool = { name: "prepare_build", arguments: plan };
      text = "Workflow approval is required before building.";
    } else if (
      prompt.includes("Build the supplied-CSV company discovery app.") ||
      prompt.includes("broken change")
    ) {
      const broken = prompt.includes("broken change");
      if (!calls)
        tool = {
          name: "propose_build",
          arguments: {
            ...plan,
            specification: spec,
            summary: broken ? brokenSummary : buildSummary,
          },
        };
      text = broken
        ? "Please review the broken presentation update in Workflow before building."
        : "Please review the company discovery and saved watchlist workflow before building.";
    } else if (prompt.includes(approvalMessage)) {
      const broken = approvalContext.includes(brokenSummary);
      assert(
        broken || approvalContext.includes(buildSummary),
        "Automatic turn needs the approved proposal context",
      );
      const steps = [
        { name: "prepare_build", arguments: plan },
        { name: "set_specification", arguments: spec },
        { name: "read_starter_reference", arguments: {} },
        {
          name: "write_file",
          arguments: {
            path: "src/App.tsx",
            content: broken ? "export default function App() { return <Broken" : presentation,
          },
        },
        ...(!broken
          ? [
              {
                name: "bash",
                arguments: {
                  command: "echo contract-fixture; test -f src/components/financial-app.tsx",
                },
              },
            ]
          : []),
        {
          name: "deploy_preview",
          arguments: { summary: broken ? "Intentional invalid source" : "Company cards module" },
        },
      ];
      tool = steps[calls];
      text = broken
        ? "The broken update was rejected. Your accepted app is unchanged."
        : "The company-card preview is ready for activation.";
    }
    const id = `fixture_${++sequence}`;
    const item = tool
      ? {
          id,
          type: "function_call",
          call_id: id,
          name: tool.name,
          arguments: JSON.stringify(tool.arguments),
          status: "completed",
        }
      : {
          id,
          type: "message",
          role: "assistant",
          status: "completed",
          content: [{ type: "output_text", text, annotations: [] }],
        };
    const result = {
      id: `resp_${id}`,
      object: "response",
      status: "completed",
      model: body.model,
      output: [item],
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    };
    if (!body.stream) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(result));
      return;
    }
    response.writeHead(200, { "content-type": "text/event-stream" });
    const events = [
      { type: "response.created", response: { ...result, status: "in_progress", output: [] } },
      {
        type: "response.output_item.added",
        output_index: 0,
        item: { ...item, status: "in_progress", ...(tool ? { arguments: "" } : { content: [] }) },
      },
      ...(tool
        ? [
            {
              type: "response.function_call_arguments.delta",
              item_id: id,
              output_index: 0,
              delta: JSON.stringify(tool.arguments),
            },
            {
              type: "response.function_call_arguments.done",
              item_id: id,
              output_index: 0,
              arguments: JSON.stringify(tool.arguments),
            },
          ]
        : [
            {
              type: "response.output_text.delta",
              item_id: id,
              output_index: 0,
              content_index: 0,
              delta: text,
            },
          ]),
      { type: "response.output_item.done", output_index: 0, item },
      { type: "response.completed", response: result },
    ];
    for (const event of events)
      response.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    response.end();
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});
await new Promise<void>((resolve) => fixture.listen(0, "0.0.0.0", resolve));
const address = fixture.address();
assert(address && typeof address !== "string");
const directory = await mkdtemp(join(tmpdir(), "cd80-react-browser-"));
const name = "cd80-react-browser-fixture";
const base = "http://127.0.0.1:3017";
const docker = spawn(
  "docker",
  [
    "run",
    "--rm",
    "--name",
    name,
    "--cap-add",
    "SYS_ADMIN",
    "--security-opt",
    "apparmor=unconfined",
    "--security-opt",
    "systempaths=unconfined",
    "--security-opt",
    "seccomp=unconfined",
    "--entrypoint",
    "node",
    "-p",
    "127.0.0.1:3017:3017",
    "-v",
    `${directory}:/fixture`,
    "-e",
    "CD80_LOCAL_MODE=1",
    "-e",
    "CD80_DEMO_MODE=1",
    "-e",
    "CD80_DATA_DIR=/fixture",
    "-e",
    "HOST=0.0.0.0",
    "-e",
    "PORT=3017",
    "-e",
    "MODEL_PROVIDER=openai",
    "-e",
    "OPENAI_MODEL=gpt-6-luna",
    "-e",
    "OPENAI_API_KEY=react-fixture-key",
    "-e",
    `OPENAI_BASE_URL=http://host.lima.internal:${address.port}/v1`,
    process.env.CD80_PROJECT_TEST_IMAGE ?? "chengdu80-financial-tests",
    "apps/web/server/node-entry.mjs",
  ],
  { stdio: "ignore" },
);
let browser;
async function snapshot(): Promise<{ apps: Application[] }> {
  return (await fetch(`${base}/api/platform`)).json();
}
try {
  let ready = false;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(`${base}/api/platform`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(ready, "Linux fixture platform did not start");
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/api/ai/chat") && !response.ok())
      void response
        .text()
        .then((body) =>
          console.error("Chat fixture error", response.status(), body.slice(0, 1200)),
        );
  });
  await page.goto(base);
  const composer = page.getByRole("textbox", { name: "Message the AI" });
  async function send(text: string, answer: string) {
    await composer.fill(text);
    await composer.press("Enter");
    await page.getByText(answer, { exact: true }).last().waitFor({ timeout: 90000 });
    await page.getByRole("button", { name: "Stop generation" }).waitFor({ state: "hidden" });
  }
  async function action(body: Record<string, unknown>, expectedStatus = 200) {
    const response = await fetch(`${base}/api/platform`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    assert.equal(response.status, expectedStatus, text);
    return expectedStatus === 200 ? (JSON.parse(text) as Application) : undefined;
  }
  async function approveWorkflow(answer: string) {
    const proposed = (await snapshot()).apps[0]!;
    assert(proposed.buildProposal);
    const proposal = proposed.buildProposal;
    assert.equal(proposal.approvedAt, undefined);
    assert.deepEqual(proposal.plan, plan);
    assert.deepEqual(proposal.specification, spec);
    await page.getByRole("tab", { name: "How it works", exact: true }).click();
    const nodes = page.getByRole("region", { name: "Workflow nodes by kind", exact: true });
    for (const output of spec.outputs) {
      await nodes.getByRole("button", { name: output, exact: true }).click();
      await page.getByText(spec.outputDetails![output]!, { exact: true }).waitFor();
    }
    const response = page.waitForResponse(
      (candidate) =>
        candidate.url() === `${base}/api/platform` &&
        candidate.request().method() === "POST" &&
        candidate.request().postDataJSON()?.action === "approve-workflow",
    );
    await page.getByRole("button", { name: "Approve workflow", exact: true }).click();
    const result = await response;
    assert(result.ok());
    const approved = (await result.json()) as Application;
    const turnId = `workflow-${proposal.id}`;
    assert(approved.workflowApproval?.approvedAt);
    assert.equal(approved.workflowApproval.proposalId, proposal.id);
    assert.equal(approved.workflowApproval.turnId, turnId);
    assert.equal(
      approved.current?.id,
      proposed.current?.id,
      "Workflow approval cannot activate a release",
    );
    assert.notEqual(turnId, proposal.turnId, "Preparation must occur after the proposal turn");
    const duplicate = await action({
      action: "approve-workflow",
      appId: proposed.id,
      proposalId: proposal.id,
    });
    assert.deepEqual(duplicate?.workflowApproval, approved.workflowApproval);
    let completed: Application | undefined;
    for (let attempt = 0; attempt < 1200; attempt++) {
      const app = (await snapshot()).apps[0]!;
      const run = app.turns?.find((candidate) => candidate.id === turnId);
      if (run && run.status !== "running") {
        assert.equal(run.status, "complete", "Automatic builder turn must complete");
        assert(run.completedAt);
        const messages = app.conversation?.filter((message) => message.id === turnId);
        assert.equal(messages?.length, 1, "Approval creates exactly one automatic user message");
        assert.deepEqual(messages?.[0]?.parts, [{ type: "text", content: approvalMessage }]);
        assert.equal(app.turns?.filter((candidate) => candidate.id === turnId).length, 1);
        assert.equal(
          app.current?.id,
          proposed.current?.id,
          "Automatic building only stages a preview",
        );
        assert.equal(app.preview?.buildRecord?.turnId, turnId);
        completed = app;
        break;
      }
      await page.waitForTimeout(100);
    }
    assert(completed, "Automatic workflow builder turn did not complete");
    await page.getByText(answer, { exact: true }).last().waitFor({ timeout: 90000 });
    await page.getByRole("button", { name: "Stop generation" }).waitFor({ state: "hidden" });
    return completed;
  }
  await send(
    "Discuss this before building. Codename Copper Finch.",
    "I remember the discussion before building. Codename Copper Finch.",
  );
  const discussed = (await snapshot()).apps[0]!;
  assert.equal(discussed.current, null);
  assert.deepEqual(discussed.spec.inputs, []);
  assert.deepEqual(discussed.spec.outputs, []);
  await send("Prepare without a proposal.", "Workflow approval is required before building.");
  assert(
    toolOutputs.some((output) => output.includes("Call propose_build and end the turn first")),
  );
  assert.equal((await snapshot()).apps[0]!.buildRecords?.length ?? 0, 0);
  await send(
    "Build the supplied-CSV company discovery app.",
    "Please review the company discovery and saved watchlist workflow before building.",
  );
  const proposed = (await snapshot()).apps[0]!;
  assert(proposed.buildProposal);
  assert.equal(proposed.current, null);
  assert.equal(proposed.preview, null);
  assert.equal(proposed.buildRecords?.length ?? 0, 0);
  assert.deepEqual(proposed.spec, discussed.spec);
  await action(
    { action: "approve-workflow", appId: proposed.id, proposalId: crypto.randomUUID() },
    400,
  );
  await send("Prepare an unapproved workflow.", "Workflow approval is required before building.");
  assert(
    toolOutputs.some((output) =>
      output.includes("Approve the proposed workflow in the Workflow tab"),
    ),
  );
  const unapproved = (await snapshot()).apps[0]!;
  assert.deepEqual(unapproved.buildProposal, proposed.buildProposal);
  assert.deepEqual(unapproved.workspace, proposed.workspace);
  assert.equal(unapproved.buildRecords?.length ?? 0, 0);
  const staged = await approveWorkflow("The company-card preview is ready for activation.");
  assert.equal(staged.current, null);
  assert(staged.preview?.verification.passed, JSON.stringify(staged.preview?.verification.checks));
  assert.deepEqual(staged.preview.spec, spec);
  assert.equal(staged.buildProposal, undefined);
  assert.deepEqual(staged.data, discussed.data);
  await action({ action: "accept", appId: staged.id, releaseId: crypto.randomUUID() }, 400);
  assert.equal((await snapshot()).apps[0]!.current, null);
  await page.getByRole("tab", { name: "Preview", exact: true }).click();
  const activationResponse = page.waitForResponse(
    (response) =>
      response.url() === `${base}/api/platform` &&
      response.request().method() === "POST" &&
      response.request().postDataJSON()?.action === "accept",
  );
  await page.getByRole("button", { name: "Approve & activate", exact: true }).click();
  assert((await activationResponse).ok());
  await page
    .getByRole("button", { name: "Approve & activate", exact: true })
    .waitFor({ state: "hidden" });
  const built = (await snapshot()).apps[0]!;
  assert(built.current?.verification.passed);
  assert.equal(built.current.id, staged.preview.id);
  assert.equal(built.preview, null);
  assert.equal(built.current.bundle.manifest.schemaVersion, 3);
  assert(built.current.buildRecord?.resolvedCapabilities.includes("company-cards"));
  const frame = page.frameLocator('iframe[title="React company cards application"]');
  assert.equal(built.current.buildRecord?.moduleVersions.starter, "financial-react-v4");
  assert.equal(built.current.buildRecord?.moduleVersions["company-discovery"], "v1.3.0");
  for (let question = 1; question <= 7; question++) {
    await frame.locator(`input[name="q${question}"]`).first().check();
  }
  await frame.getByRole("button", { name: "Complete questionnaire", exact: true }).click();
  await frame.getByText("Questionnaire completed.", { exact: true }).waitFor();
  await frame.getByRole("checkbox").first().check();
  await frame.getByRole("button", { name: "Save industry preferences", exact: true }).click();
  await frame.getByText("Industry preferences saved.", { exact: true }).waitFor();
  const discovery = frame.getByRole("region", { name: "Company discovery", exact: true });
  await discovery
    .getByRole("button", { name: "Start discovery", exact: true })
    .click({ timeout: 120000 });
  const csv = importCompanyCsv(
    await readFile(
      new URL("../apps/web/src/server/data/sse-a-universe.csv", import.meta.url),
      "utf8",
    ),
  );
  const card = discovery.locator('[data-slot="card"]');
  await card.waitFor();
  const identity = (await card.innerText()).match(/SSE:(\d{6})/);
  assert(identity, "Discovery must display a canonical SSE identity");
  const company = csv.find((entry) => entry.ticker === identity[1]);
  assert(company, "The displayed company must belong to the supplied CSV");
  assert.equal(await card.locator('[data-slot="card-title"]').innerText(), company.name);
  await discovery.getByRole("button", { name: "Add to watchlist", exact: true }).click();
  await discovery.getByRole("listitem").first().waitFor();
  await frame.getByText("Contract-bound presentation", { exact: true }).waitFor();
  const acceptedId = built.current.id;
  const before = (await snapshot()).apps[0]!;
  assert(Array.isArray(before.data["discovery-watchlist"]));
  assert.equal(before.data["discovery-watchlist"].length, 1);
  assert.equal(before.data["discovery-watchlist"][0], `SSE:${company.ticker}`);
  assert.equal(before.data._companyCards, undefined);
  console.log(
    "PASS React agent scopes, assembles, builds and activates the editable v4 app; explicit Add saves canonical IDs",
  );
  await page.reload();
  await discovery.getByRole("listitem").first().waitFor({ timeout: 120000 });
  await page
    .getByText("Discuss this before building. Codename Copper Finch.", { exact: true })
    .waitFor();
  console.log("PASS saved company IDs and non-build discussion persist across browser reload");
  await send(
    "Stage a broken change to the company-card demo.",
    "Please review the broken presentation update in Workflow before building.",
  );
  assert.equal((await snapshot()).apps[0]!.current?.id, acceptedId);
  const failed = await approveWorkflow(
    "The broken update was rejected. Your accepted app is unchanged.",
  );
  assert.equal(failed.current?.id, acceptedId);
  assert(
    failed.preview && !failed.preview.verification.passed,
    "Approved invalid source must fail verification",
  );
  assert.equal(
    failed.preview.bundle.files["src/App.tsx"],
    "export default function App() { return <Broken",
  );
  assert.deepEqual(failed.current?.spec, built.current.spec);
  assert.deepEqual(failed.data, before.data);
  await action({ action: "accept", appId: failed.id, releaseId: failed.preview.id }, 400);
  assert.equal((await snapshot()).apps[0]!.current?.id, acceptedId);
  await action({ action: "discard", appId: failed.id, releaseId: failed.preview.id });
  const discarded = (await snapshot()).apps[0]!;
  assert.equal(discarded.preview, null);
  assert.equal(discarded.current?.id, acceptedId);
  await page.reload();
  const beforeBypasses = (await snapshot()).apps[0]!;
  for (let i = 0; i < 3; i++) {
    const outputStart = toolOutputs.length;
    await send(`Build a booking application. Attempt ${i}.`, "The booking request was blocked.");
    const outputs = toolOutputs.slice(outputStart);
    assert(
      outputs.some((output) => output.includes("proposal was created in this turn")),
      "Same-turn preparation must be rejected",
    );
    assert(
      outputs.some((output) => output.includes("Call prepare_build for this turn")),
      "Writes and deployment need this turn's feasible build record",
    );
    const blocked = (await snapshot()).apps[0]!;
    assert.equal(blocked.current?.id, acceptedId);
    assert.equal(blocked.preview, null);
    assert.deepEqual(blocked.workspace, beforeBypasses.workspace);
    assert.deepEqual(blocked.buildRecords, beforeBypasses.buildRecords);
    assert.deepEqual(blocked.spec, built.spec);
    assert.deepEqual(blocked.data, before.data);
    assert(!blocked.workspace?.files["src/App.tsx"]?.includes("booking application bypass"));
  }
  const after = (await snapshot()).apps[0]!;
  assert.equal(after.current?.id, acceptedId);
  assert.deepEqual(after.data, before.data);
  console.log(
    "PASS failed React builds and repeated unsupported iterations retain accepted release and data",
  );
  await page.getByRole("button", { name: "Built apps", exact: true }).first().click();
  const gallery = page.getByRole("main", { name: "Built applications" });
  await gallery.getByRole("button", { name: "Select build React company cards" }).waitFor();
  const thumbnail = gallery.locator('iframe[title="React company cards layout thumbnail"]');
  assert.equal(await thumbnail.getAttribute("sandbox"), "");
  assert((await thumbnail.getAttribute("srcdoc"))?.includes("Live · Shanghai Stock Exchange"));
  await mkdir(".local/agent-tests", { recursive: true });
  await page.screenshot({ path: ".local/agent-tests/react-gallery.png", fullPage: true });
  await gallery.getByRole("button", { name: "Select build React company cards" }).click();
  await discovery.getByRole("listitem").first().waitFor({ timeout: 120000 });
  await page.screenshot({ path: ".local/agent-tests/react-studio.png", fullPage: true });
  await page
    .getByRole("button", { name: "Chat options for React company cards", exact: true })
    .first()
    .click();
  await page.getByRole("menuitem", { name: "Delete chat", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Delete this chat?" })
    .getByRole("button", { name: "Delete chat", exact: true })
    .click();
  const deleted = (await snapshot()).apps[0]!;
  assert(deleted.chatDeletedAt);
  assert.equal(deleted.current?.id, acceptedId);
  assert.deepEqual(deleted.data, before.data);
  await page.getByRole("button", { name: "Built apps", exact: true }).first().click();
  await gallery.getByRole("button", { name: "Select build React company cards" }).click();
  await discovery.getByRole("listitem").first().waitFor({ timeout: 120000 });
  assert.deepEqual(errors, []);
  console.log(
    "PASS existing gallery, inert React thumbnails, chat deletion and retained accepted app/watchlist",
  );
} finally {
  await browser?.close();
  await promisify(execFile)("docker", ["stop", "--time", "3", name]).catch(() => {});
  docker.kill();
  fixture.closeAllConnections();
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
}
