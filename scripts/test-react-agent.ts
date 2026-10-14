/// <reference lib="dom" />
// macOS browser + Linux platform + local Responses fixture. No real credentials or user data.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { protocols, type Application } from "../apps/web/src/lib/contracts";

let sequence = 0;
const spec = {
  ...protocols[0]!.defaultSpec,
  name: "React company cards",
  purpose: "A synthetic company-card demo using fixed platform modules",
};
const plan = {
  requirements: spec.purpose,
  capabilities: ["company-cards"],
  companyQueries: [],
  mode: "fixture",
  themeOverride: null,
};
const fixture = createServer(async (request, response) => {
  try {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    assert.equal(request.headers.authorization, "Bearer react-fixture-key");
    const properties = body.text?.format?.schema?.properties ?? {};
    const last = body.input.map((item: { role?: string }) => item.role).lastIndexOf("user");
    const current = body.input.slice(last);
    const prompt = JSON.stringify(current[0]?.content);
    const calls = current.filter(
      (item: { type?: string }) => item.type === "function_call_output",
    ).length;
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
    else if (
      prompt.includes("Build the synthetic") ||
      prompt.includes("broken change") ||
      prompt.includes("booking application")
    ) {
      const broken = prompt.includes("broken change");
      const unsupported = prompt.includes("booking application");
      const steps = [
        { name: "prepare_build", arguments: plan },
        ...(!broken && !unsupported
          ? [
              { name: "set_specification", arguments: spec },
              { name: "read_starter_reference", arguments: {} },
            ]
          : []),
        {
          name: "write_file",
          arguments: {
            path: "src/App.tsx",
            content: broken
              ? "export default function App() { return <Broken"
              : 'export default function App() { return <p data-testid="custom-presentation">Contract-bound presentation</p>; }\n',
          },
        },
        ...(!broken && !unsupported
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
          arguments: { summary: broken ? "Intentional invalid source" : "Synthetic company cards" },
        },
      ];
      tool = steps[calls];
      text = broken
        ? "The broken update was rejected. Your accepted app is unchanged."
        : unsupported
          ? "The booking request was blocked."
          : "The synthetic company-card app is ready.";
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
  await send(
    "Discuss this before building. Codename Copper Finch.",
    "I remember the discussion before building. Codename Copper Finch.",
  );
  assert.equal((await snapshot()).apps[0]?.current, null);
  await send(
    "Build the synthetic daily company-card demo.",
    "The synthetic company-card app is ready.",
  );
  const built = (await snapshot()).apps[0]!;
  assert(built.current?.verification.passed, JSON.stringify(built.preview?.verification.checks));
  assert.equal(built.current.bundle.manifest.schemaVersion, 3);
  assert(built.current.buildRecord?.resolvedCapabilities.includes("company-cards"));
  const frame = page.frameLocator('iframe[title="React company cards application"]');
  await frame.getByRole("button", { name: "Show today's companies" }).click({ timeout: 120000 });
  await frame.getByRole("button", { name: /Yes, watch/ }).click();
  await frame.getByText("Added to watchlist", { exact: true }).waitFor();
  await frame.getByText("Contract-bound presentation", { exact: true }).waitFor();
  const acceptedId = built.current.id;
  const before = (await snapshot()).apps[0]!;
  assert(before.data._companyCards);
  console.log(
    "PASS React agent scopes, assembles, builds and activates the fixed shadcn company-card app; Yes saves watchlist",
  );
  await page.reload();
  await frame.getByText("Added to watchlist", { exact: true }).waitFor({ timeout: 120000 });
  await page
    .getByText("Discuss this before building. Codename Copper Finch.", { exact: true })
    .waitFor();
  console.log(
    "PASS fixed financial modules and non-build discussion persist across browser reload",
  );
  await send(
    "Stage a broken change to the synthetic company-card demo.",
    "The broken update was rejected. Your accepted app is unchanged.",
  );
  assert.equal((await snapshot()).apps[0]!.current?.id, acceptedId);
  for (let i = 0; i < 3; i++)
    await send(`Build a booking application. Attempt ${i}.`, "The booking request was blocked.");
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
  assert((await thumbnail.getAttribute("srcdoc"))?.includes("Synthetic demo"));
  await mkdir(".local/agent-tests", { recursive: true });
  await page.screenshot({ path: ".local/agent-tests/react-gallery.png", fullPage: true });
  await gallery.getByRole("button", { name: "Select build React company cards" }).click();
  await frame.getByText("Added to watchlist", { exact: true }).waitFor({ timeout: 120000 });
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
  await frame.getByText("Added to watchlist", { exact: true }).waitFor({ timeout: 120000 });
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
