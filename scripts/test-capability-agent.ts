import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { b2cPerformancePlan, validateCapabilityPlan } from "../packages/capabilities/src";
import { protocols } from "../apps/web/src/lib/contracts";
import { capabilityRequirements, initialRequirements } from "../apps/web/src/lib/planning";
import { sampleBundle } from "../apps/web/src/lib/samples";
import { startAgentTurn } from "../apps/web/src/server/agent";
import { assertCapabilityArtifact } from "../apps/web/src/server/capability-release";
import { findApp, saveApp } from "../apps/web/src/server/repository";
import { disposeRuntimes } from "../apps/web/src/server/runtime";

type ModelRequest = {
  model: string;
  stream: boolean;
  tools: { function: { name: string } }[];
  messages: { role: string; content: string; tool_call_id?: string }[];
};
const requests: ModelRequest[] = [];
const fixtureErrors: unknown[] = [];
let simulate = false;
const answer = "The labelled mock preview is ready, not approved for production.";
const fixture = createServer(async (req, res) => {
  try {
    assert.equal(req.url, "/v1/chat/completions");
    assert.equal(req.headers.authorization, "Bearer capability-agent-fixture");
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw) as ModelRequest;
    requests.push(body);
    assert.equal(body.model, "GLM-5.3");
    assert.equal(body.stream, true);
    const names = body.tools.map((tool) => tool.function.name);
    for (const name of ["write_file", "edit_file", "bash", "deploy_preview"])
      assert(!names.includes(name), `${name} must not be advertised to capability agents`);
    assert(names.includes("get_design"));
    assert(names.includes("simulate_capabilities"));
    const instructions = body.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content)
      .join("\n");
    assert.match(instructions, /call get_design and then simulate_capabilities directly/);
    assert.match(instructions, /do not send the user into an impossible confirmation loop/i);
    assert.match(instructions, /never require passing production feasibility to preview mocks/);
    const results = body.messages.filter((message) => message.role === "tool");
    assert(results.length <= (simulate ? 2 : 1), "Agent must settle without replaying tools");
    if (results.length >= 1) {
      const design = JSON.parse(results[0]!.content);
      assert.equal(design.confirmed, false);
      if (simulate) assert.equal(design.feasibility.outcome, "revise");
    }
    if (results.length === 2) {
      const result = JSON.parse(results[1]!.content);
      assert.equal(result.simulated, true);
      assert.equal(result.productionVerified, false);
      assert(result.checks.some((check: { passed: boolean }) => !check.passed));
    }
    const name = !results.length
      ? "get_design"
      : simulate && results.length === 1
        ? "simulate_capabilities"
        : undefined;
    const base = {
      id: `capability-fixture-${requests.length}`,
      object: "chat.completion.chunk",
      created: 1,
      model: body.model,
    };
    res.writeHead(200, { "content-type": "text/event-stream" });
    const delta = name
      ? {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: `call-${name}`,
              type: "function",
              function: { name, arguments: "{}" },
            },
          ],
        }
      : { role: "assistant", content: simulate ? answer : "Select a pinned plan to simulate." };
    for (const choice of [
      { index: 0, delta, finish_reason: null },
      { index: 0, delta: {}, finish_reason: name ? "tool_calls" : "stop" },
    ])
      res.write(`data: ${JSON.stringify({ ...base, choices: [choice] })}\n\n`);
    res.end("data: [DONE]\n\n");
  } catch (error) {
    fixtureErrors.push(error);
    res.writeHead(500);
    res.end("Capability fixture assertion failed");
  }
});
const dir = await mkdtemp(join(tmpdir(), "cd80-capability-agent-"));
const original = { ...process.env };
const env = {
  CD80_LOCAL_MODE: "1",
  CD80_DATA_DIR: dir,
  MODEL_PROVIDER: "glm",
  GLM_API_KEY: "capability-agent-fixture",
  GLM_MODEL: "GLM-5.3",
  GLM_BASE_URL: "",
};
try {
  await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address();
  assert(address && typeof address !== "string");
  env.GLM_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  Object.assign(process.env, env);
  const access = { ownerId: "local-prototype-owner", accessToken: null };
  const spec = { ...protocols[0]!.defaultSpec, name: "Capability agent fixture" };
  const requirements = { ...initialRequirements(), dataSource: "fixtures" as const };
  const expected = capabilityRequirements(spec, requirements);
  const plan = {
    ...structuredClone(b2cPerformancePlan),
    requirements: expected.map((row) => ({ ...row, assetTypes: [], markets: [] })),
    steps: structuredClone(b2cPerformancePlan.steps.filter((step) => step.id !== "research")),
    outputs: { dashboard: { kind: "step" as const, stepId: "dashboard", output: "dashboard" } },
    coverage: expected.map((row) => ({
      requirementId: row.id,
      status: "partial" as const,
      stepIds: ["dashboard"],
      reason: "Only arbitrary mock metrics; all product contracts and market coverage are UNKNOWN.",
    })),
  };
  const validation = validateCapabilityPlan(plan, expected);
  assert.equal(validation.valid, true);
  assert.equal(validation.executable, true);
  assert.equal(validation.productionReady, false);

  for (const variant of ["mode-only", "plan-only", "mode-and-plan"] as const) {
    simulate = variant !== "mode-only";
    const app = await saveApp(
      access,
      {
        id: crypto.randomUUID(),
        ownerId: access.ownerId,
        revision: 0,
        name: spec.name,
        spec,
        workspaceSpec: spec,
        workspace: sampleBundle(spec),
        capabilityMode: variant !== "plan-only",
        requirements: simulate ? { ...requirements, capabilityPlan: plan } : requirements,
        current: null,
        preview: null,
        data: { note: "Retain saved data" },
        history: [],
        events: [],
        createdAt: new Date().toISOString(),
      },
      null,
    );
    const before = requests.length;
    const stream = await startAgentTurn(
      access,
      app.id,
      { id: crypto.randomUUID(), content: "Build a labelled simulation of the saved plan now." },
      AbortSignal.timeout(30000),
    );
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.deepEqual(fixtureErrors, []);
    assert.deepEqual(
      chunks.filter((chunk) => chunk.type === "RUN_ERROR"),
      [],
    );
    assert(chunks.some((chunk) => chunk.type === "RUN_FINISHED"));
    assert.equal(requests.length - before, simulate ? 3 : 2);
    const saved = await findApp(access, app.id);
    assert.equal(saved.agentTurn?.status, "complete");
    assert(saved.agentTurn.completedAt);
    assert.equal(saved.turns?.at(-1)?.status, "complete");
    assert.equal(saved.current, null, "Mock simulations must never activate");
    assert.deepEqual(saved.data, app.data);
    assert.deepEqual(saved.workspace, app.workspace);
    assert.deepEqual(
      saved.requirements,
      app.requirements,
      "Preserve all partial coverage and gaps",
    );
    assert.equal(saved.confirmedDesign, undefined, "Simulation needs no production confirmation");
    const calls = saved
      .conversation!.flatMap((message) => message.parts)
      .filter((part) => part.type === "tool-call");
    assert.deepEqual(
      calls.map((part) => part.name),
      simulate ? ["get_design", "simulate_capabilities"] : ["get_design"],
    );
    for (const call of calls) {
      assert.equal(call.state, "complete");
      assert(call.output !== undefined, `${call.name} result must persist`);
    }
    if (simulate) {
      assert(saved.preview?.simulationPassed);
      assert.equal(saved.preview.verification.passed, false);
      assert.equal(saved.preview.capabilityArtifact?.simulation, true);
      assert.deepEqual(saved.preview.capabilityArtifact.plan, plan);
      await assertCapabilityArtifact(saved.preview);
      const result = calls[1]!.output as { simulated: boolean; productionVerified: boolean };
      assert.equal(result.simulated, true);
      assert.equal(result.productionVerified, false);
      assert(
        saved.conversation!.some((message) =>
          message.parts.some((part) => part.type === "text" && part.content === answer),
        ),
      );
    } else assert.equal(saved.preview, null);
    console.log(
      `PASS ${variant}: actual agent transport filters legacy tools and persists ${simulate ? "a mock-only preview and tool results" : "capability guidance without a plan"}`,
    );
  }
  console.log(
    "3 capability-agent regressions passed using a local transport fixture, not live inference.",
  );
} finally {
  fixture.closeAllConnections();
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
  await disposeRuntimes();
  for (const key of Object.keys(env)) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
  await rm(dir, { recursive: true, force: true });
}
