import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { protocols } from "../apps/web/src/lib/contracts";
import { sampleBundle } from "../apps/web/src/lib/samples";

const dir = await mkdtemp(join(tmpdir(), "chengdu80-flow-"));
const port = "3011",
  endpoint = `http://127.0.0.1:${port}/api/platform`;
const server = spawn("bun", ["run", "dev:local"], {
  env: { ...process.env, CD80_PORT: port, CD80_DATA_DIR: dir },
  stdio: "ignore",
  detached: true,
});
let passed = 0;
async function request(body?: unknown, ok = true): Promise<any> {
  const r = await fetch(
    endpoint,
    body
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
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
  for (let i = 0; i < 80; i++) {
    try {
      await request();
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  assert.ok(ready, "Test server failed to start");
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
    { action: "accept", appId: "missing", releaseId: "missing" },
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
  const unknown = await request({ action: "build-anything" }, false);
  assert(unknown.error);
  pass("Unknown platform actions fail closed");
  console.log(`${passed} scoped API flow checks passed, including 27 bypass attempts.`);
} finally {
  if (server.pid) process.kill(-server.pid, "SIGTERM");
  await new Promise((r) => setTimeout(r, 500));
  await rm(dir, { recursive: true, force: true });
}
