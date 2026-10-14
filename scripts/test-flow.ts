import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { protocols } from "../apps/web/src/lib/contracts";
import { sampleBundle } from "../apps/web/src/lib/samples";
import { configuredEnvironment } from "./environment";

const startupTimeout = Number(
  process.env.CD80_FLOW_STARTUP_TIMEOUT_MS ?? (process.platform === "darwin" ? 240_000 : 20_000),
);
assert(
  Number.isInteger(startupTimeout) && startupTimeout > 0 && startupTimeout <= 300_000,
  "CD80_FLOW_STARTUP_TIMEOUT_MS must be an integer between 1 and 300000",
);
const sensitiveValues = [...Object.entries(process.env), ...Object.entries(configuredEnvironment())]
  .filter(
    ([key, value]) =>
      value && /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH|COOKIE|PROXY|URL/i.test(key),
  )
  .map(([, value]) => value!)
  .sort((a, b) => b.length - a.length);
function sanitize(text: string) {
  for (const value of sensitiveValues) text = text.replaceAll(value, "[REDACTED]");
  return (
    text
      // eslint-disable-next-line no-control-regex -- Strip terminal escape sequences from Docker output.
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
      .replace(/\b(Bearer|Basic)\s+[^\s"']+/gi, "$1 [REDACTED]")
      .replace(/\b[A-Z][A-Z0-9_]*\s*=\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/g, (assignment) =>
        assignment.replace(/=.*/, "=[REDACTED]"),
      )
      .replace(/https?:\/\/[^\s"'<>]+/gi, (url) => {
        try {
          const parsed = new URL(url);
          return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search ? "?[REDACTED]" : ""}`;
        } catch {
          return "[REDACTED URL]";
        }
      })
  );
}
const dir = await mkdtemp(join(tmpdir(), "chengdu80-flow-"));
const containerName = `chengdu80-flow-${process.pid}-${Date.now()}`;
const port = "3011",
  endpoint = `http://127.0.0.1:${port}/api/platform`;
const server = spawn("bun", ["run", "dev:local"], {
  env: {
    ...process.env,
    CD80_PORT: port,
    CD80_DATA_DIR: dir,
    CD80_ISOLATED_CONTAINER_NAME: containerName,
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let diagnostics = "";
for (const stream of [server.stdout!, server.stderr!]) {
  let pending = "";
  let truncated = false;
  stream.setEncoding("utf8");
  const record = (line: string) => {
    diagnostics = (diagnostics + sanitize(line) + "\n").slice(-16_000);
  };
  stream.on("data", (chunk: string) => {
    // Sanitize complete lines so credentials split across chunks cannot escape redaction.
    for (const [index, part] of chunk.split("\n").entries()) {
      if (index > 0) {
        record(truncated ? "[oversized diagnostic line omitted]" : pending);
        pending = "";
        truncated = false;
      }
      if (!truncated) pending += part;
      if (pending.length > 16_000) {
        pending = "";
        truncated = true;
      }
    }
  });
  stream.on("end", () => {
    if (pending || truncated) record(truncated ? "[oversized diagnostic line omitted]" : pending);
  });
}
let serverFailure: string | undefined;
server.on("error", (error) => (serverFailure = sanitize(error.message)));
const serverExited = new Promise<void>((resolve) => {
  server.on("close", (code, signal) => {
    serverFailure ??= `Launcher exited (status ${code}, signal ${signal})`;
    resolve();
  });
});
let passed = 0;
async function request(body?: unknown, ok = true, timeout = 10_000): Promise<any> {
  const r = await fetch(endpoint, {
    signal: AbortSignal.timeout(timeout),
    ...(body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await r.json();
  assert.equal(r.ok, ok, JSON.stringify(data).slice(0, 1000));
  return data;
}
function pass(name: string) {
  passed++;
  console.log("PASS " + name);
}
try {
  let ready = false;
  const deadline = Date.now() + startupTimeout;
  while (Date.now() < deadline && !serverFailure) {
    try {
      await request(undefined, true, Math.max(1, Math.min(1000, deadline - Date.now())));
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, Math.max(0, Math.min(250, deadline - Date.now()))));
    }
  }
  assert.ok(
    ready,
    `Test server failed to start within ${startupTimeout}ms${serverFailure ? `: ${serverFailure}` : ""}\nRecent sanitized launcher output:\n${diagnostics || "(no output)"}`,
  );
  const before = await request();
  const spec = { ...protocols[0]!.defaultSpec, name: "Bypass test" };
  const bundle = sampleBundle(spec);
  const attempts = [
    { action: "create", spec, mode: "sample" },
    { action: "seed" },
    { action: "import", spec, bundle },
    { action: "update", appId: "missing", request: "Build an unrelated app", mode: "model" },
    { action: "clarify", prompt: "Build an unrelated app" },
    { action: "test-provider", provider: "tushare" },
    { action: "load-prices", appId: "missing", provider: "alpha-demo" },
    { action: "reverify", appId: "missing", releaseId: "missing" },
  ];
  for (let round = 0; round < 3; round++) {
    for (const attempt of attempts) {
      const rejected = await request(attempt, false);
      assert(rejected.error.includes("internal capability contract"));
    }
  }
  const after = await request();
  assert.deepEqual(after.apps, before.apps);
  pass("Repeated legacy API calls cannot bypass the capability contract or activate a release");
  const result = await request({ action: "accept", appId: "missing", releaseId: "missing" }, false);
  assert(result.error.includes("not found") || result.error.includes("denied"));
  assert(!result.error.includes("internal capability contract"));
  pass("Explicit Preview approval remains available but rejects missing applications");
  const unknown = await request({ action: "build-anything" }, false);
  assert(unknown.error);
  pass("Unknown platform actions fail closed");
  const workspace = await request({
    action: "create-workspace",
    prompt: "Build a demo matching app with five daily company cards",
  });
  assert.deepEqual(workspace.spec.inputs, []);
  assert.deepEqual(workspace.spec.outputs, []);
  const designed = await request({
    action: "save-design",
    appId: workspace.id,
    requirements: {
      analysisPeriod: "Past year",
      assumptions: ["Live SSE Class A data only"],
      missingInputs: [],
      questions: [{ id: "q1", question: "Which industries matter to you?", answer: "" }],
    },
  });
  assert.equal(designed.requirements.questions[0]!.question, "Which industries matter to you?");
  assert.equal(designed.requirements.questions[0]!.answer, "");
  pass("Requirements persist through save-design for the pre-build review");
  const protocolChange = await request(
    {
      action: "save-design",
      appId: workspace.id,
      spec: { ...designed.spec, protocol: "strategy" },
      requirements: { analysisPeriod: "", assumptions: [], missingInputs: [], questions: [] },
    },
    false,
  );
  assert(protocolChange.error.toLowerCase().includes("protocol"));
  pass("save-design rejects changing the app's calculation protocol");
  console.log(
    `${passed} scoped API flow checks passed, including ${attempts.length * 3} bypass attempts.`,
  );
} finally {
  const signalGroup = (signal: NodeJS.Signals) => {
    if (!server.pid) return;
    try {
      process.kill(-server.pid, signal);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    }
  };
  signalGroup("SIGTERM");
  // Stop the uniquely named container even if its attached Docker client already exited.
  if (process.platform === "darwin") {
    const stop = spawn("docker", ["stop", "--time", "5", containerName], {
      stdio: "ignore",
      timeout: 10_000,
    });
    await new Promise<void>((resolve) => {
      stop.on("error", () => resolve());
      stop.on("close", () => resolve());
    });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    serverExited,
    new Promise<void>((resolve) => (timer = setTimeout(resolve, 7000))),
  ]);
  clearTimeout(timer);
  signalGroup("SIGKILL");
  await rm(dir, { recursive: true, force: true });
}
