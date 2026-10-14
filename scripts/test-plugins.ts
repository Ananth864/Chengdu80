/// <reference lib="dom" />
// Run after bun run build. Exercises the built Node registration API and server-side
// plugin execution against an isolated HTTP provider, without external API calls.
// --direct checks server policy without a build or the HTTP registration adapter.
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callPlugin, listPlugins, registerPlugin } from "../apps/web/src/server/plugins";
import type { RegisteredPlugin } from "../apps/web/src/lib/plugins";
import { saveApp } from "../apps/web/src/server/repository";
import { protocols, type Application } from "../apps/web/src/lib/contracts";
import { sampleBundle } from "../apps/web/src/lib/samples";

const base = "http://127.0.0.1:3006";
const direct = process.argv.includes("--direct");
const dataDir = await mkdtemp(join(tmpdir(), "cd80-plugins-"));
const credential = "plugin-test-secret";
const results: string[] = [];
let observedCredential = "";
let operationRequests = 0;
let server: ChildProcess | undefined;
let log = "";
const fixture = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  response.setHeader("content-type", "application/json");
  if (url.pathname === "/schema") response.end(JSON.stringify(document));
  else if (url.pathname === "/redirect") {
    response.statusCode = 302;
    response.setHeader("location", "http://127.0.0.1:9/private");
    response.end();
  } else if (["/v1/weather", "/v1/public"].includes(url.pathname)) {
    operationRequests++;
    const key = request.headers["x-api-key"];
    observedCredential = typeof key === "string" ? key : "";
    response.end(
      JSON.stringify({
        city: url.searchParams.get("city"),
        temperature: 21,
        echo: observedCredential,
      }),
    );
  } else {
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "Unknown fixture operation" }));
  }
});
await new Promise<void>((resolve) => fixture.listen(0, "127.0.0.1", resolve));
const fixtureOrigin = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
const document = {
  openapi: "3.0.3",
  info: { title: "Weather fixture", version: "1" },
  servers: [{ url: fixtureOrigin + "/v1/" }],
  components: { securitySchemes: { key: { type: "apiKey", in: "header", name: "x-api-key" } } },
  security: [{ key: [] }],
  paths: {
    "/weather": {
      get: {
        operationId: "getWeather",
        parameters: [{ name: "city", in: "query", required: true, schema: { type: "string" } }],
      },
      post: { operationId: "updateWeather" },
    },
    "/public": { get: { operationId: "publicWeather", security: [] } },
  },
};
const config = {
  PATH: process.env.PATH ?? "",
  HOST: "127.0.0.1",
  PORT: "3006",
  CD80_LOCAL_MODE: "1",
  CD80_DATA_DIR: dataDir,
  CD80_PLUGIN_TEST_ORIGIN: fixtureOrigin,
  CD80_PLUGIN_TEST_KEY: credential,
  CD80_PLUGIN_CREDENTIAL_BINDINGS: JSON.stringify([
    {
      credentialEnv: "CD80_PLUGIN_TEST_KEY",
      ownerId: "local-prototype-owner",
      baseUrl: fixtureOrigin + "/v1",
    },
  ]),
  MODEL_PROVIDER: "openai",
  OPENAI_API_KEY: "",
  GLM_API_KEY: "",
};
const previous = new Map(Object.keys(config).map((key) => [key, process.env[key]]));
Object.assign(process.env, config);
const access = { ownerId: "local-prototype-owner", accessToken: null };
const spec = protocols[0]!.defaultSpec;
const workspace = sampleBundle(spec);
workspace.manifest.permissions.push("plugin.call");
const app: Application = {
  id: "plugin-test-app",
  ownerId: access.ownerId,
  revision: 0,
  name: spec.name,
  spec,
  workspace,
  current: null,
  preview: null,
  history: [],
  data: {},
  events: [],
  createdAt: new Date().toISOString(),
  enabledPlugins: [],
};
const invoke = (
  owner: typeof access,
  pluginId: string,
  operationId: string,
  parameters: Record<string, unknown>,
) => callPlugin(owner, pluginId, operationId, parameters, { appId: app.id });
async function start() {
  if (direct) return;
  server = spawn("node", ["apps/web/server/node-entry.mjs"], {
    env: config,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk: Buffer) => {
    log += chunk.toString();
  });
  server.stderr?.on("data", (chunk: Buffer) => {
    log += chunk.toString();
  });
  server.on("error", (error) => {
    log += error.message;
  });
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error("Isolated Node server exited before readiness");
    try {
      if ((await fetch(base + "/api/plugins")).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Isolated Node server did not become ready");
}
async function stop() {
  const child = server;
  server = undefined;
  if (!child?.pid || child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}
async function register(body: unknown, origin = base) {
  if (direct) {
    try {
      const plugin = await registerPlugin(access, body as Parameters<typeof registerPlugin>[1]);
      return Response.json({ plugin });
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Registration failed" },
        { status: 400 },
      );
    }
  }
  return fetch(base + "/api/plugins", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function registry() {
  if (direct) return { plugins: await listPlugins(access) };
  const response = await fetch(base + "/api/plugins");
  assert.equal(response.status, 200);
  return (await response.json()) as { plugins: RegisteredPlugin[] };
}
try {
  await start();
  const response = await register({
    name: "Weather",
    document: JSON.stringify(document),
    credentialEnv: "CD80_PLUGIN_TEST_KEY",
  });
  assert.equal(response.status, 200, await response.clone().text());
  const registered = (await response.json()) as { plugin: RegisteredPlugin };
  const plugin = registered.plugin;
  app.enabledPlugins = [plugin.id];
  await saveApp(access, app, null);
  assert.equal(plugin.operations[0]?.operationId, "getWeather");
  const metadata = await registry();
  assert.equal(metadata.plugins.length, 1);
  assert(!JSON.stringify(metadata).includes(credential));
  assert(!JSON.stringify(metadata).includes("CD80_PLUGIN_TEST_KEY"));
  results.push(`${direct ? "Direct" : "HTTP"} registration and sanitized owned registry metadata`);

  const weather = await invoke(access, plugin.id, "getWeather", { city: "London" });
  assert.equal(observedCredential, credential);
  assert.deepEqual(weather, { city: "London", temperature: 21, echo: "[redacted]" });
  results.push(
    "Registered operation fetches provider data with server credentials and redacts echoed secrets",
  );

  await assert.rejects(invoke(access, plugin.id, "getWeather", {}), /Missing plugin parameter/);
  await assert.rejects(
    invoke(access, plugin.id, "getWeather", { city: "London", arbitrary: true }),
    /Unknown plugin parameter/,
  );
  await assert.rejects(invoke(access, plugin.id, "unknown", { city: "London" }), /not found/);
  await assert.rejects(
    invoke({ ownerId: "another-owner", accessToken: null }, plugin.id, "getWeather", {
      city: "London",
    }),
    /not found|access denied/,
  );
  results.push("Required parameters, registered operation boundaries, and owner access enforced");

  const input = {
    name: "Bound weather",
    document: JSON.stringify(document),
    credentialEnv: "CD80_PLUGIN_TEST_KEY",
  };
  await assert.rejects(registerPlugin({ ...access, ownerId: "another-owner" }, input), /not bound/);
  await assert.rejects(
    registerPlugin(access, {
      ...input,
      document: JSON.stringify({ ...document, servers: [{ url: fixtureOrigin + "/other" }] }),
    }),
    /not bound/,
  );
  await assert.rejects(
    registerPlugin(access, {
      ...input,
      document: JSON.stringify({
        ...document,
        security: [],
        paths: { "/public": document.paths["/public"] },
      }),
    }),
    /requires an authenticated/,
  );
  const requestsBefore = operationRequests;
  await assert.rejects(
    invoke(access, plugin.id, "updateWeather", {}),
    /explicit approval.*not supported/,
  );
  assert.equal(operationRequests, requestsBefore);
  for (const binding of [
    { ownerId: "another-owner", baseUrl: fixtureOrigin + "/v1" },
    { ownerId: access.ownerId, baseUrl: fixtureOrigin + "/other" },
  ]) {
    process.env.CD80_PLUGIN_CREDENTIAL_BINDINGS = JSON.stringify([
      { credentialEnv: "CD80_PLUGIN_TEST_KEY", ...binding },
    ]);
    await assert.rejects(invoke(access, plugin.id, "getWeather", { city: "London" }), /not bound/);
  }
  delete process.env.CD80_PLUGIN_CREDENTIAL_BINDINGS;
  await assert.rejects(invoke(access, plugin.id, "getWeather", { city: "London" }), /not bound/);
  process.env.CD80_PLUGIN_CREDENTIAL_BINDINGS = "invalid JSON";
  await assert.rejects(
    invoke(access, plugin.id, "getWeather", { city: "London" }),
    /Invalid server/,
  );
  assert.equal(operationRequests, requestsBefore);
  process.env.CD80_PLUGIN_CREDENTIAL_BINDINGS = "[]";
  await assert.rejects(invoke(access, plugin.id, "getWeather", { city: "London" }), /not bound/);
  await assert.rejects(registerPlugin(access, input), /not bound/);
  assert.equal(operationRequests, requestsBefore);
  assert.deepEqual(await invoke(access, plugin.id, "publicWeather", {}), {
    city: null,
    temperature: 21,
    echo: "",
  });
  assert.equal(observedCredential, "");
  process.env.CD80_PLUGIN_CREDENTIAL_BINDINGS = config.CD80_PLUGIN_CREDENTIAL_BINDINGS;
  results.push(
    "Credential owner/destination binding, fail-closed registration, call-time revocation, public operation isolation, and POST refusal before network",
  );

  app.enabledPlugins = [];
  await saveApp(access, app, app.revision);
  await assert.rejects(invoke(access, plugin.id, "getWeather", { city: "London" }), /not enabled/);
  app.enabledPlugins = [plugin.id];
  workspace.manifest.permissions = workspace.manifest.permissions.filter(
    (permission) => permission !== "plugin.call",
  );
  await saveApp(access, app, app.revision);
  await assert.rejects(
    invoke(access, plugin.id, "getWeather", { city: "London" }),
    /not permitted/,
  );
  workspace.manifest.permissions.push("plugin.call");
  await saveApp(access, app, app.revision);
  await assert.rejects(
    callPlugin(
      access,
      plugin.id,
      "getWeather",
      { city: "London" },
      { appId: app.id, releaseId: "missing" },
    ),
    /current verified release/,
  );
  results.push(
    "Application enabled-plugin and workspace permission checks; unknown browser releases denied",
  );
  app.current = {
    id: "plugin-release",
    bundle: structuredClone(workspace),
    spec,
    verification: { passed: true, checks: [], checkedAt: app.createdAt, sourceHash: "fixture" },
    createdAt: app.createdAt,
    origin: "sample",
    notes: "Plugin policy fixture",
  };
  await saveApp(access, app, app.revision);
  const releaseOptions = { appId: app.id, releaseId: app.current.id };
  await callPlugin(access, plugin.id, "getWeather", { city: "London" }, releaseOptions);
  app.current.bundle.manifest.permissions = [];
  await saveApp(access, app, app.revision);
  await assert.rejects(
    callPlugin(access, plugin.id, "getWeather", { city: "London" }, releaseOptions),
    /not permitted/,
  );
  app.current.bundle.manifest.permissions = ["plugin.call"];
  app.current.verification.passed = false;
  await saveApp(access, app, app.revision);
  await assert.rejects(
    callPlugin(access, plugin.id, "getWeather", { city: "London" }, releaseOptions),
    /current verified release/,
  );
  results.push("Browser calls use current verified release permissions, not workspace permissions");

  // Exercise old persisted auth operations and corrupted paths without registering new plugins.
  const storedPath = join(dataDir, "plugins.json");
  const originalStored = await readFile(storedPath, "utf8");
  const stored = JSON.parse(originalStored);
  delete stored[0].operations[0].authenticated;
  await writeFile(storedPath, JSON.stringify(stored));
  await invoke(access, plugin.id, "getWeather", { city: "London" });
  assert.equal(observedCredential, credential);
  stored[0].operations[0].path = "/../weather";
  await writeFile(storedPath, JSON.stringify(stored));
  const beforeEscape = operationRequests;
  await assert.rejects(
    invoke(access, plugin.id, "getWeather", { city: "London" }),
    /escapes the approved/,
  );
  assert.equal(operationRequests, beforeEscape);
  await writeFile(storedPath, originalStored);
  results.push(
    "Legacy stored auth defaults conservatively; constructed URL cannot escape approved base path",
  );

  if (!direct)
    assert.equal(
      (
        await register(
          {
            name: "Cross origin",
            document: JSON.stringify(document),
            credentialEnv: "CD80_PLUGIN_TEST_KEY",
          },
          "https://example.invalid",
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await register({
        name: "Private URL",
        document: JSON.stringify({ ...document, servers: [{ url: "https://127.0.0.1/private" }] }),
        credentialEnv: "CD80_PLUGIN_TEST_KEY",
      })
    ).status,
    400,
  );
  assert.equal(
    (await register({ name: "Private schema", schemaUrl: "https://127.0.0.1/schema" })).status,
    400,
  );
  assert.equal(
    (
      await register({
        name: "External ref",
        document: JSON.stringify({
          ...document,
          paths: { "/weather": { $ref: "https://example.invalid/path" } },
        }),
        credentialEnv: "CD80_PLUGIN_TEST_KEY",
      })
    ).status,
    400,
  );
  assert.equal(
    (await register({ name: "Redirect", schemaUrl: fixtureOrigin + "/redirect" })).status,
    400,
  );
  assert.equal(
    (
      await register({
        name: "Unrelated credential",
        document: JSON.stringify(document),
        credentialEnv: "OPENAI_API_KEY",
      })
    ).status,
    400,
  );
  assert.equal((await registry()).plugins.length, 1);
  results.push(
    `${direct ? "" : "Cross-origin registration, "}private networks, external refs, redirects, and unrelated system keys rejected`,
  );

  const fromUrl = await register({
    name: "Weather URL",
    schemaUrl: fixtureOrigin + "/schema",
    credentialEnv: "CD80_PLUGIN_TEST_KEY",
  });
  assert.equal(fromUrl.status, 200);
  await stop();
  await start();
  assert.equal((await registry()).plugins.length, 2);
  assert.deepEqual(await invoke(access, plugin.id, "getWeather", { city: "Paris" }), {
    city: "Paris",
    temperature: 21,
    echo: "[redacted]",
  });
  results.push(
    `Schema URL registration and registry persistence${direct ? "" : " across Node server restart"}`,
  );

  await mkdir(".local/plugin-tests", { recursive: true });
  await writeFile(".local/plugin-tests/results.json", JSON.stringify({ results }, null, 2));
  console.log(`Plugin integration: ${results.length} flows passed`);
} catch (error) {
  // Isolated server has no real credentials; still redact the fixture credential in diagnostics.
  console.error(log.replaceAll(credential, "[redacted]").slice(-4000));
  throw error;
} finally {
  await stop();
  await new Promise<void>((resolve) => fixture.close(() => resolve()));
  await rm(dataDir, { recursive: true, force: true });
  for (const [key, value] of previous) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
