// Run inside the Linux test image. Only temporary fixture data and fake credentials are used.
import assert from "node:assert/strict";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareBuild } from "../apps/web/src/server/build-policy";
import {
  buildContextPath,
  buildContextSource,
  approvedPermissions,
} from "../apps/web/src/lib/financial-starter";
import {
  prepareProject,
  releaseWorkspace,
  runWorkspaceCommand,
} from "../apps/web/src/server/app-workspaces";
import { applyRelease, dispatch, makeRelease } from "../apps/web/src/server/platform";
import { saveApp, findApp } from "../apps/web/src/server/repository";
import {
  createPreviewSession,
  resolvePreviewSession,
} from "../apps/web/src/server/preview-session";
import { resetSizedCompanyCache, resetSseCompanyCache } from "../apps/web/src/server/providers";
import type { Application } from "../apps/web/src/lib/contracts";

assert.equal(
  process.platform,
  "linux",
  "Generated Node source must execute inside Linux isolation",
);
process.env.CD80_LOCAL_MODE = "1";
process.env.CD80_SANDBOX_SENTINEL = "fixture-secret-must-stay-outside-project";
// prepare_build verifies the live Tushare feed; stub it with the sample payload.
const tushareSample = JSON.parse(
  await readFile(new URL("./fixtures/stock-basic-sample.json", import.meta.url), "utf8"),
);
process.env.TUSHARE_TOKEN = "test-token";
const originalFetch = globalThis.fetch;
globalThis.fetch = (async () =>
  new Response(JSON.stringify(tushareSample))) as unknown as typeof fetch;
resetSseCompanyCache();
resetSizedCompanyCache();
const directory = process.env.CD80_DATA_DIR;
assert(directory, "Supply an isolated fixture data directory");
await mkdir(directory, { recursive: true });
const access = { ownerId: "local-prototype-owner", accessToken: null };
let app = (await dispatch(access, {
  action: "create-workspace",
  prompt: "Company card demo",
})) as Application;
const spec = {
  ...app.spec,
  name: "React company cards",
  purpose: "A daily company-card app using fixed platform modules",
};
const record = await prepareBuild(
  {
    requirements: spec.purpose,
    capabilities: ["company-cards"],
    companyQueries: [],
    mode: "live",
    themeOverride: null,
  },
  "react-fixture-turn",
  1,
);
globalThis.fetch = originalFetch;
const bundle = app.workspace!;
assert.equal(bundle.manifest.schemaVersion, 3);
bundle.manifest.name = spec.name;
bundle.manifest.permissions = approvedPermissions(record, true);
bundle.files[buildContextPath] = buildContextSource(record, spec.name);
bundle.files["src/App.tsx"] =
  'export default function App() { return <p data-testid="custom-presentation">Contract-bound presentation</p>; }\n';
const outsideFile = join(directory, "parent-only.txt");
await writeFile(outsideFile, "parent fixture secret");
const first = await prepareProject(bundle, { scope: "isolation-a", pin: true });
const second = await prepareProject(bundle, { scope: "isolation-b", pin: true });
try {
  const isolated = await runWorkspaceCommand(
    first,
    `test -z "$CD80_SANDBOX_SENTINEL" && test ! -e '${outsideFile}' && test ! -e '${second.directory}' && test ! -e /repo/scripts/test-financial-project.ts && ! touch node_modules/zod/sandbox-write-probe && /runtime/node -e 'fetch("http://127.0.0.1:3001", {signal:AbortSignal.timeout(1000)}).then(()=>process.exit(3),()=>console.log("isolated"))'`,
  );
  assert.equal(isolated.exitCode, 0, JSON.stringify(isolated));
  assert(isolated.stdout.includes("isolated"));
  assert(!JSON.stringify(isolated).includes(process.env.CD80_SANDBOX_SENTINEL));
  console.log(
    "PASS private filesystem, environment, app separation, read-only dependencies and network namespace",
  );
} finally {
  await releaseWorkspace(first);
  await releaseWorkspace(second);
}
const release = await makeRelease(spec, bundle, "model", "Deterministic React fixture", record);
assert(
  release.verification.passed,
  JSON.stringify(release.verification.checks.filter((c) => !c.passed)),
);
release.buildRecord = { ...record, artifactHash: release.verification.sourceHash };
assert(release.verification.thumbnail?.html.includes("Live · Shanghai Stock Exchange"));
assert(release.verification.thumbnail?.css.includes("--primary"));
app = await findApp(access, app.id);
assert(await applyRelease(app, release));
app.workspace = bundle;
app.buildRecords = [record];
app.conversation = [
  {
    id: "prior-discussion",
    role: "user",
    parts: [{ type: "text", content: "Remember this discussion before building." }],
  },
];
const saved = await saveApp(access, app, app.revision);
console.log("PASS platform-owned build/type checks, fixed financial SSR and gallery thumbnail");
const origin = "http://127.0.0.1:3007";
const session = await createPreviewSession(access, app.id, release.id, "fixture-nonce", origin);
const token = session.url.split("/")[3]!;
assert.equal((await resolvePreviewSession(token, origin)).release.id, release.id);
await assert.rejects(resolvePreviewSession(token, "http://other-origin.invalid"));
await assert.rejects(
  resolvePreviewSession(token.slice(0, -1) + (token.endsWith("x") ? "y" : "x"), origin),
);
await assert.rejects(
  createPreviewSession(
    { ownerId: "other-owner", accessToken: null },
    app.id,
    release.id,
    "x",
    origin,
  ),
);
console.log("PASS signed previews bind owner, origin, release and unchanged financial contract");
async function rpc(input: unknown, capability = "finance.company-cards") {
  return dispatch(access, {
    action: "rpc",
    appId: app.id,
    releaseId: release.id,
    capability,
    input,
  });
}
const batch = (await rpc({ action: "batch", risk: "low", industries: ["Technology"] })) as {
  companies: { ticker: string }[];
};
assert.equal(batch.companies.length, 1);
const ticker = batch.companies[0]!.ticker;
await rpc({ action: "decide", ticker, choice: "yes" });
const watchlist = (await rpc({ action: "watchlist" })) as { companies: { ticker: string }[] };
assert.equal(watchlist.companies[0]!.ticker, ticker);
await assert.rejects(rpc({}, "finance.calculate"), /permission/);
await assert.rejects(rpc({}, "plugin.call"), /permission/);
await assert.rejects(
  rpc({ key: "_companyCards", value: {} }, "storage.write"),
  /reserved|server|protected/i,
);
console.log("PASS scoped company RPC, watchlist persistence and forbidden capability/state writes");
const broken = structuredClone(bundle);
broken.files["src/App.tsx"] = "export default function App() { return <Broken";
const failed = await makeRelease(spec, broken, "model", "Intentional failed update", record);
failed.buildRecord = { ...record, artifactHash: failed.verification.sourceHash };
assert(!failed.verification.passed);
const latest = await findApp(access, saved.id);
assert.equal(await applyRelease(latest, failed), false);
assert.equal(latest.current?.id, release.id);
assert.deepEqual(latest.data, (await findApp(access, saved.id)).data);
console.log(
  "PASS failed project verification retains accepted release, conversation and saved data",
);
console.log(`REACT_FIXTURE_APP=${app.id}`);
