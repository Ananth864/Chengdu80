import assert from "node:assert/strict";
import { createServer } from "node:http";
import { listDemo, saveDemo, list, save } from "../packages/backend/convex/platform";
import { listApps, saveApp } from "../apps/web/src/server/repository";

const previous = { ...process.env };
const serverKey = "demo-test-key-not-a-real-secret-123456789";
const ownerId = "shared-prototype-owner";
let calls = 0;
const ctx = {
  auth: { getUserIdentity: async () => null },
  runQuery: async () => {
    calls++;
    return [];
  },
  runMutation: async (_: unknown, args: any) => {
    calls++;
    return { ...args.app, revision: 1 };
  },
};
let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log("PASS " + name);
}
const read = () => (listDemo as any)._handler(ctx, { serverKey });
try {
  process.env.PLATFORM_INTERNAL_KEY = serverKey;
  delete process.env.CD80_DEMO_MODE;
  await test("Demo reads fail when not explicitly enabled", async () => {
    await assert.rejects(read, /disabled/);
    assert.equal(calls, 0);
  });
  process.env.CD80_DEMO_MODE = "1";
  await test("Anonymous direct database calls need the server-only key", async () => {
    await assert.rejects(() => (listDemo as any)._handler(ctx, { serverKey: "wrong" }), /Trusted/);
    assert.equal(calls, 0);
  });
  await test("Trusted demo reads and writes work without user identity", async () => {
    assert.deepEqual(await read(), []);
    const app = { ownerId, id: "demo-test" };
    const result = await (saveDemo as any)._handler(ctx, {
      app,
      expectedRevision: null,
      serverKey,
    });
    assert.equal(result.ownerId, ownerId);
    assert.equal(result.revision, 1);
  });
  await test("Demo cannot write another account's application", async () => {
    await assert.rejects(
      () =>
        (saveDemo as any)._handler(ctx, {
          app: { ownerId: "another-owner" },
          expectedRevision: null,
          serverKey,
        }),
      /ownership/,
    );
  });
  await test("Existing account routes still require authentication", async () => {
    await assert.rejects(() => (list as any)._handler(ctx, {}), /Authentication/);
    await assert.rejects(
      () =>
        (save as any)._handler(ctx, {
          app: {},
          expectedRevision: null,
          serverKey,
        }),
      /Authentication/,
    );
  });
  const requests: any[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body: any = JSON.parse(Buffer.concat(chunks).toString());
    requests.push(body);
    assert.equal(request.url, "/api/action");
    assert.equal(body.args[0].serverKey, serverKey);
    response.setHeader("content-type", "application/json");
    response.end(
      JSON.stringify({
        status: "success",
        value: body.path === "platform:listDemo" ? [] : body.args[0].app,
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    process.env.CD80_LOCAL_MODE = "0";
    process.env.VITE_CONVEX_URL = `http://127.0.0.1:${address.port}`;
    const access = { ownerId, accessToken: null };
    await test("Hosted repository uses demo Convex actions without JWT", async () => {
      assert.deepEqual(await listApps(access), []);
      const app: any = { ownerId, id: "demo-test" };
      assert.equal((await saveApp(access, app, null)).id, app.id);
      assert.deepEqual(
        requests.map((r) => r.path),
        ["platform:listDemo", "platform:saveDemo"],
      );
    });
    await test("Hosted repository rejects other owners in demo mode", async () => {
      await assert.rejects(() => listApps({ ownerId: "other", accessToken: null }), /workspace/);
    });
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }
  console.log(
    `${passed} no-login checks passed. Convex transport is a local fixture, not remote deployment proof.`,
  );
} finally {
  for (const key of [
    "CD80_LOCAL_MODE",
    "CD80_DEMO_MODE",
    "VITE_CONVEX_URL",
    "PLATFORM_INTERNAL_KEY",
  ])
    if (previous[key] === undefined) delete process.env[key];
    else process.env[key] = previous[key];
}
