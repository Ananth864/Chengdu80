import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { protocols, bundleSchema } from "../apps/web/src/lib/contracts";
import { calculate } from "../apps/web/src/lib/finance";
import { sampleBundle } from "../apps/web/src/lib/samples";
import {
  disposeRuntimes,
  execute,
  inspectSource,
  sourceHash,
  verify,
} from "../apps/web/src/server/runtime";
import { event, findApp, listApps, saveApp } from "../apps/web/src/server/repository";
import { ConvexHttpClient } from "convex/browser";
import { convexToJson } from "convex/values";

process.env.CD80_LOCAL_MODE = "1";
const dir = await mkdtemp(join(tmpdir(), "chengdu80-tests-"));
process.env.CD80_DATA_DIR = dir;
let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  await test("Hosted chat persistence converts Dates and omits undefined before Convex transport", async () => {
    const keys = ["CD80_LOCAL_MODE", "CD80_DEMO_MODE", "VITE_CONVEX_URL", "PLATFORM_INTERNAL_KEY"];
    const previous = keys.map((key) => process.env[key]);
    const descriptor = Object.getOwnPropertyDescriptor(ConvexHttpClient.prototype, "action")!;
    let checked = false;
    try {
      process.env.CD80_LOCAL_MODE = "0";
      process.env.CD80_DEMO_MODE = "1";
      process.env.VITE_CONVEX_URL = "http://127.0.0.1:3210";
      process.env.PLATFORM_INTERNAL_KEY = "fixture-internal-key-not-a-real-secret";
      ConvexHttpClient.prototype.action = (async (_function: unknown, args: any) => {
        assert.doesNotThrow(() => convexToJson(args));
        assert.equal(args.app.conversation[0].createdAt, "2026-10-13T16:46:39.698Z");
        assert(!("optional" in args.app));
        checked = true;
        return { ...args.app, revision: 2 };
      }) as typeof ConvexHttpClient.prototype.action;
      const saved = await saveApp(
        { ownerId: "shared-prototype-owner", accessToken: null },
        {
          id: "date-regression",
          ownerId: "shared-prototype-owner",
          revision: 1,
          optional: undefined,
          conversation: [
            {
              id: "message",
              role: "user",
              parts: [{ type: "text", content: "Discuss reports" }],
              createdAt: new Date("2026-10-13T16:46:39.698Z"),
            },
          ],
        } as any,
        1,
      );
      assert(checked);
      assert.equal(saved.revision, 2);
    } finally {
      Object.defineProperty(ConvexHttpClient.prototype, "action", descriptor);
      keys.forEach((key, index) => {
        if (previous[index] === undefined) delete process.env[key];
        else process.env[key] = previous[index];
      });
    }
  });
  await test("Release hashes survive storage key ordering and detect changed source", async () => {
    const original = sampleBundle(protocols[0]!.defaultSpec);
    const stored = {
      files: {
        "app.js": original.files["app.js"],
        "style.css": original.files["style.css"],
        "calculations.js": original.files["calculations.js"],
        "index.html": original.files["index.html"],
      },
      manifest: {
        browserTests: original.manifest.browserTests,
        permissions: original.manifest.permissions,
        protocol: original.manifest.protocol,
        name: original.manifest.name,
        schemaVersion: original.manifest.schemaVersion,
      },
    };
    assert.deepEqual(stored, original);
    assert.equal(await sourceHash(stored), await sourceHash(original));
    const changed = structuredClone(original);
    changed.files["app.js"] += "\n// changed source";
    assert.notEqual(await sourceHash(changed), await sourceHash(original));
  });
  for (const p of protocols)
    await test(`${p.id}: independent numerical fixtures in Cloudflare workerd`, async () => {
      const report = await verify(sampleBundle(p.defaultSpec), p.defaultSpec);
      assert.equal(report.passed, true, JSON.stringify(report.checks.filter((c) => !c.passed)));
      const actual = calculate(p.id, p.fixture.input);
      for (const [key, value] of Object.entries(p.fixture.expected))
        if (typeof value === "number") assert.ok(Math.abs((actual[key] as number) - value) < 1e-6);
        else assert.deepEqual(actual[key], value);
    });
  await test("Wrong financial logic blocks release", async () => {
    const b = sampleBundle(protocols[0]!.defaultSpec);
    b.files["calculations.js"] = b.files["calculations.js"].replace(
      "profit=totalValue-cash-invested",
      "profit=totalValue-cash-invested+1",
    );
    assert.equal((await verify(b, protocols[0]!.defaultSpec)).passed, false);
  });
  await test("Source imports reject path traversal and unrecognized files", () => {
    const b = sampleBundle(protocols[0]!.defaultSpec);
    assert.equal(
      bundleSchema.safeParse({ ...b, files: { ...b.files, "../secret.env": "oops" } }).success,
      false,
    );
  });
  await test("Executable HTML, secret strings, and missing permissions fail closed", () => {
    for (const mutate of [
      (b: any) => (b.files["index.html"] += '<img onerror="alert(1)">'),
      (b: any) => (b.files["app.js"] += 'const api_key="sk-123456789012345678901234567890";'),
      (b: any) => (b.manifest.permissions = []),
    ]) {
      const b = sampleBundle(protocols[0]!.defaultSpec);
      mutate(b);
      assert.ok(inspectSource(b, protocols[0]!.defaultSpec).some((c) => !c.passed));
    }
  });
  await test("Worker has no outbound network access", async () => {
    const b = sampleBundle(protocols[0]!.defaultSpec);
    b.files["calculations.js"] =
      "export async function analyze(){const r=await fetch('https://example.com');return {status:r.status};}";
    assert.deepEqual(await execute(b, {}), { status: 403 });
  });
  await test("A generated error result rejects the calculation instead of becoming successful data", async () => {
    const b = sampleBundle(protocols[0]!.defaultSpec);
    b.files["calculations.js"] =
      "export function analyze(){return {error:'Invalid financial input'};}";
    await assert.rejects(execute(b, {}), /Invalid financial input/);
  });
  await test("Non-finite financial results are rejected by both calculation paths", async () => {
    const b = sampleBundle(protocols[0]!.defaultSpec);
    b.files["calculations.js"] = "export function analyze(){return {value:Infinity};}";
    await assert.rejects(execute(b, {}), /non-finite/);
    assert.throws(
      () =>
        calculate("portfolio", {
          holdings: [{ symbol: "AAA", units: 1e308, price: 1e308, cost: 1 }],
          cash: 0,
        }),
      /numerical range/,
    );
    assert.throws(
      () => calculate("strategy", { prices: [Number.MIN_VALUE, 1e308], feeBps: 0 }),
      /numerical range/,
    );
  });
  await test("Infinite calculation times out and cannot execute on the host", async () => {
    const b = sampleBundle(protocols[0]!.defaultSpec);
    b.files["calculations.js"] = "export function analyze(){while(true){} }";
    const start = Date.now();
    await assert.rejects(execute(b, {}), /3 second/);
    assert.ok(Date.now() - start < 10000);
  });
  await test("Account ownership, durable storage, and optimistic updates", async () => {
    const owner = { ownerId: "test-owner", accessToken: null };
    const app: any = {
      id: "test-app",
      ownerId: owner.ownerId,
      revision: 0,
      data: { inputs: { cash: 10 } },
      events: [],
    };
    await saveApp(owner, app, null);
    assert.equal((await listApps(owner)).length, 1);
    assert.equal((await listApps({ ownerId: "another-owner", accessToken: null })).length, 0);
    await assert.rejects(findApp({ ownerId: "another-owner", accessToken: null }, app.id));
    const next = await findApp(owner, app.id);
    event(next, "Test update");
    await saveApp(owner, next, next.revision);
    await assert.rejects(saveApp(owner, app, 1), /changed/);
    assert.deepEqual((await findApp(owner, app.id)).data, { inputs: { cash: 10 } });
  });
  console.log(`${passed} meaningful prototype checks passed.`);
} finally {
  await disposeRuntimes();
  await rm(dir, { recursive: true, force: true });
}
