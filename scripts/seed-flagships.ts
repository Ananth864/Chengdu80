/* Register the hand-built flagship applications (flagships/) into the local
 * demo store — or, with --hosted, into the shared Convex demo workspace.
 *
 * This is the offline "connect" step for prebuilt apps: it packs each source
 * directory into a schema-v1 bundle, runs the platform's own verify() (static
 * inspection + protocol fixtures in the workerd isolate), and merges verified
 * releases into .local/apps.json. It never sends anything through the model
 * generation pipeline, never weakens a gate, and never reinitializes the
 * store: existing records are kept, and the three flagship records are
 * appended or updated by their stable IDs. */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bundleSchema,
  specSchema,
  type Application,
  type AppBundle,
  type ProductSpec,
} from "../apps/web/src/lib/contracts";
import { defaultData, fixtureMeta } from "../apps/web/src/lib/finance";
import { disposeRuntimes, verify } from "../apps/web/src/server/runtime";

const platformRoot = resolve(fileURLToPath(new URL("..", import.meta.url).href));
const flagshipsRoot = resolve(platformRoot, "flagships");

type Flagship = { dir: string; id: string; createdAt: string };
/* Stable IDs so reseeding updates the same records instead of duplicating. */
const FLAGSHIPS: Flagship[] = [
  {
    dir: "investlens",
    id: "7a10c8e2-5f4d-4a63-9d2b-1f6e8a05c101",
    createdAt: "2026-10-15T10:40:00.000Z",
  },
  {
    dir: "finmatch",
    id: "7a10c8e2-5f4d-4a63-9d2b-1f6e8a05c102",
    createdAt: "2026-10-15T10:20:00.000Z",
  },
  {
    dir: "boardsight",
    id: "7a10c8e2-5f4d-4a63-9d2b-1f6e8a05c103",
    createdAt: "2026-10-15T10:00:00.000Z",
  },
];
const FILES = ["index.html", "app.js", "calculations.js", "style.css"] as const;
const ownerId = "local-prototype-owner"; // platform.ts local-mode owner

async function loadFlagship(f: Flagship): Promise<{ bundle: AppBundle; spec: ProductSpec }> {
  const dir = resolve(flagshipsRoot, f.dir);
  const manifest = bundleSchema.shape.manifest.parse(
    JSON.parse(await readFile(resolve(dir, "cd80.json"), "utf8")),
  );
  const spec = specSchema.parse(JSON.parse(await readFile(resolve(dir, "spec.json"), "utf8")));
  const files: Record<string, string> = {};
  for (const name of FILES) files[name] = await readFile(resolve(dir, name), "utf8");
  const bundle = bundleSchema.parse({ manifest, files });
  return { bundle, spec };
}

async function dataDir(): Promise<string> {
  // Mirror repository.ts: CD80_DATA_DIR wins, else platform/.local.
  const env = process.env.CD80_DATA_DIR;
  if (env && env.trim()) return env;
  const { settings } = await import("../apps/web/src/server/settings");
  const configured = (await settings()).CD80_DATA_DIR;
  return configured && configured.trim() ? configured : resolve(platformRoot, ".local");
}

async function seedLocal(verified: { app: Application }[]) {
  const dir = await dataDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = resolve(dir, "apps.json");
  let apps: Application[] = [];
  if (existsSync(file)) {
    try {
      apps = JSON.parse(await readFile(file, "utf8"));
    } catch (e) {
      throw new Error(
        `Refusing to touch the local store: ${file} is not valid JSON (${String(e instanceof Error ? e.message : e)}). Fix or restore it manually — never delete it.`,
      );
    }
  }
  if (!Array.isArray(apps))
    throw new Error("Refusing to touch the local store: apps.json is not an array.");
  let changed = 0;
  for (const { app } of verified) {
    const existing = apps.find((a) => a.id === app.id);
    if (!existing) {
      apps.push(app);
      changed++;
      console.log(`ADD  ${app.name} → local store (${app.id})`);
      continue;
    }
    const sameHash =
      existing.current?.verification.sourceHash === app.current!.verification.sourceHash;
    if (sameHash) {
      console.log(`KEEP ${app.name} — verified source unchanged`);
      continue;
    }
    const revision = existing.revision + 1;
    const history = existing.current
      ? [existing.current, ...existing.history].slice(0, 2)
      : existing.history;
    apps[apps.indexOf(existing)] = {
      ...existing,
      revision,
      name: app.name,
      spec: app.spec,
      current: app.current,
      history,
      events: [
        ...existing.events.slice(-48),
        { at: new Date().toISOString(), message: "Re-verified updated flagship source offline." },
      ],
    };
    changed++;
    console.log(`UPD  ${app.name} → revision ${revision} (history ${history.length})`);
  }
  if (!changed) {
    console.log("Local store already holds the current flagship builds. Nothing written.");
    return;
  }
  const temp = file + ".tmp";
  await writeFile(temp, JSON.stringify(apps), { mode: 0o600 });
  await rename(temp, file); // atomic swap; .local may be bind-mounted into the container
  console.log(`Wrote ${file} (${apps.length} records).`);
}

async function seedHosted(verified: { app: Application }[]) {
  const { configuredEnvironment } = await import("./environment");
  const env = configuredEnvironment();
  if (!env.VITE_CONVEX_URL || !env.PLATFORM_INTERNAL_KEY)
    throw new Error(
      "--hosted needs VITE_CONVEX_URL and PLATFORM_INTERNAL_KEY (see docs/credentials-and-hosting.md).",
    );
  const { ConvexHttpClient } = await import("convex/browser");
  const api = (await import("../packages/backend/convex/_generated/api")).api;
  const client = new ConvexHttpClient(env.VITE_CONVEX_URL, { logger: false });
  const rows: Application[] = await client.action(api.platform.listDemo, {
    serverKey: env.PLATFORM_INTERNAL_KEY,
  });
  for (const { app } of verified) {
    const id = "demo-" + app.id;
    const clone: Application = {
      ...app,
      id,
      ownerId: "shared-prototype-owner",
      revision: 0,
      history: [],
      data: { inputs: app.data.inputs, _provenance: app.data._provenance },
    };
    if (rows.some((row) => row.id === id)) {
      console.log(`KEEP hosted ${app.name} (delete demo-${id} on Convex to reseed)`);
      continue;
    }
    await client.action(api.platform.saveDemo, {
      serverKey: env.PLATFORM_INTERNAL_KEY,
      app: clone,
      expectedRevision: null,
    });
    console.log(`ADD  hosted ${app.name} (${id})`);
  }
}

const previousLocalMode = process.env.CD80_LOCAL_MODE;
process.env.CD80_LOCAL_MODE = "1"; // verification stays fully offline
try {
  const verified: { app: Application }[] = [];
  for (const f of FLAGSHIPS) {
    const { bundle, spec } = await loadFlagship(f);
    if (bundle.manifest.name !== spec.name)
      throw new Error(`${f.dir}: manifest name and spec name must match.`);
    if (bundle.manifest.protocol !== spec.protocol)
      throw new Error(`${f.dir}: manifest protocol and spec protocol must match.`);
    const verification = await verify(bundle, spec);
    const failed = verification.checks.filter((c) => !c.passed);
    if (!verification.passed) {
      throw new Error(
        `${f.dir} failed verification:\n` +
          failed.map((c) => `  ${c.name}: ${c.detail}`).join("\n"),
      );
    }
    console.log(
      `VERIFIED ${spec.name} [${spec.protocol}] — ${verification.checks.length} checks passed`,
    );
    const app: Application = {
      id: f.id,
      ownerId,
      revision: 1,
      name: spec.name,
      spec,
      current: {
        id: crypto.randomUUID(),
        bundle,
        spec,
        verification,
        createdAt: f.createdAt,
        origin: "import",
        notes: "Imported flagship application source. Verified offline; no model generation.",
      },
      preview: null,
      data: { inputs: defaultData(spec.protocol), _provenance: fixtureMeta },
      history: [],
      events: [
        { at: f.createdAt, message: "Imported flagship source and verified it offline." },
        { at: f.createdAt, message: "Accepted the verified preview. Shared data retained." },
      ],
      createdAt: f.createdAt,
    };
    if (JSON.stringify(app).length > 700000)
      throw new Error(`${f.dir}: application exceeds the prototype storage limit.`);
    verified.push({ app });
  }
  if (process.argv.includes("--hosted")) await seedHosted(verified);
  else await seedLocal(verified);
  console.log(
    `Flagship apps registered. ${process.argv.includes("--hosted") ? "Shared demo workspace updated." : "Start or refresh bun run dev:local to see them in Built apps."}`,
  );
} finally {
  process.env.CD80_LOCAL_MODE = previousLocalMode;
  await disposeRuntimes();
}
