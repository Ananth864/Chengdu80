import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildRecord } from "../apps/web/src/lib/build-plan";
import { appProjectTemplateFiles } from "../apps/web/src/lib/app-project-template";
import {
  bundleSchema,
  type AppBundle,
  type Application,
  type ProductSpec,
  type Release,
} from "../apps/web/src/lib/contracts";
import {
  approvedPermissions,
  buildContextPath,
  buildContextSource,
  inspectProjectProtection,
  isMainLegacyBuild,
  protectedProjectFiles,
} from "../apps/web/src/lib/financial-starter";
import { mainStarterSnapshot } from "../apps/web/src/lib/main-starter-snapshot";
import {
  prepareBuild,
  requireBuild,
  validateScopedBundle,
} from "../apps/web/src/server/build-policy";
import { dispatch } from "../apps/web/src/server/platform";
import { inspectProject } from "../apps/web/src/server/project-runtime";
import { findApp, saveApp } from "../apps/web/src/server/repository";
import { sourceHash } from "../apps/web/src/server/runtime";

// Read the shipped template as data. Never execute generated source on the host.
const template = execFileSync("git", ["show", "main:apps/web/src/lib/app-project-template.ts"], {
  cwd: new URL("..", import.meta.url),
  encoding: "utf8",
});
const mainFiles: Record<string, string> = JSON.parse(
  template.slice(template.indexOf("= {") + 2, template.lastIndexOf(" as const")),
);
const currentFiles: Record<string, string> = appProjectTemplateFiles;
const featureOnlyFiles = [
  "src/lib/risk-profile.ts",
  "src/lib/company-discovery.ts",
  "src/lib/discovery-contract.ts",
  "src/lib/financial-results.ts",
  "src/lib/industry-preference.ts",
];
assert.deepEqual(
  Object.keys(protectedProjectFiles())
    .filter((name) => !(name in mainFiles))
    .sort(),
  [...featureOnlyFiles].sort(),
);
assert.deepEqual(
  mainStarterSnapshot,
  Object.fromEntries(
    Object.entries(mainFiles).filter(
      ([name, source]) =>
        name === buildContextPath ||
        (name in protectedProjectFiles() && currentFiles[name] !== source),
    ),
  ),
  "Snapshot must contain every changed main protected file and the exact default context",
);

function rehash(record: BuildRecord) {
  const { hash: _hash, artifactHash: _artifactHash, ...payload } = record;
  record.hash = createHash("sha256")
    .update(
      JSON.stringify(payload, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((key) => [key, value[key]]),
            )
          : value,
      ),
    )
    .digest("hex");
  return record;
}
const spec: ProductSpec = {
  name: "Retained main notes",
  purpose: "Read and update saved notes in an existing main release.",
  protocol: "screening",
  inputs: ["Note text"],
  outputs: ["Saved notes"],
  outputDetails: { "Saved notes": "Previously saved app-owned notes; no financial calculations." },
  constraints: ["Compatibility wiring fixture, not a sandbox build or live-data test"],
};
const record = rehash({
  id: crypto.randomUUID(),
  version: 1,
  revision: 1,
  turnId: "persisted-main-turn",
  createdAt: "2026-10-12T12:00:00.000Z",
  hash: "",
  plan: {
    requirements: spec.purpose,
    capabilities: ["market-research", "historical-analysis", "company-cards"],
    companyQueries: ["600000.SH"],
    mode: "live",
    themeOverride: null,
  },
  resolvedCapabilities: [
    "company-cards",
    "historical-analysis",
    "industry-preference",
    "market-research",
    "price-target",
    "risk-assessment",
    "risk-industry-matching",
  ],
  companyIds: ["600000.SH"],
  companyIndustries: ["Banking"],
  companyTableVersion: "sse-a-sized:2026-10-12:fixture-hash",
  protocolHashes: { builder: createHash("sha256").update("historical protocol").digest("hex") },
  provider: "tushare",
  moduleVersions: { companies: "company-capabilities-v1", starter: "financial-react-v4" },
  theme: "starter-default",
  readiness: "live",
  blockers: [],
});
assert(isMainLegacyBuild(record));
assert.equal(requireBuild(record, record.turnId), record);
assert.throws(
  () => requireBuild({ ...record, theme: "tampered" }, record.turnId),
  /record changed/,
);
assert.throws(() => requireBuild(record, "another-turn"), /this turn/);
assert.deepEqual(approvedPermissions(record, true), [
  "storage.read",
  "storage.write",
  "finance.research",
  "market.prices",
  "finance.match-companies",
  "finance.company-cards",
]);
const researchOnly = rehash({ ...record, resolvedCapabilities: ["market-research"] });
assert.deepEqual(approvedPermissions(researchOnly, true), [
  "storage.read",
  "storage.write",
  "finance.research",
]);
const bundle: AppBundle = {
  manifest: {
    schemaVersion: 3,
    name: spec.name,
    protocol: spec.protocol,
    permissions: approvedPermissions(record, true),
  },
  files: { ...mainFiles, [buildContextPath]: buildContextSource(record, spec.name) },
};
validateScopedBundle(bundle, record);
assert.throws(() => inspectProjectProtection(bundle), /starter|record/);
const noIndustries = structuredClone(record);
delete noIndustries.companyIndustries;
rehash(noIndustries);
assert(!buildContextSource(noIndustries, spec.name).includes('"industries"'));
inspectProjectProtection(
  {
    ...bundle,
    files: { ...bundle.files, [buildContextPath]: buildContextSource(noIndustries, spec.name) },
  },
  noIndustries,
);

for (const name of Object.keys(protectedProjectFiles())) {
  const changed = structuredClone(bundle);
  changed.files[name] = `${mainFiles[name] ?? ""}\n// altered protected file`;
  assert.throws(() => validateScopedBundle(changed, record), /starter/);
}
for (const name of ["package.json", "src/components/ui/button.tsx"]) {
  const changed = structuredClone(bundle);
  delete changed.files[name];
  assert.throws(() => inspectProjectProtection(changed, record), /starter/);
}
const notesOnly = structuredClone(bundle);
notesOnly.files["src/components/financial-app.tsx"] =
  "export function FinancialDemo() { return null; }";
notesOnly.files["src/App.tsx"] =
  "export default function App() { return <main>Saved notes</main>; }";
validateScopedBundle(notesOnly, record);
assert.equal(
  notesOnly.files["src/components/financial-app.tsx"],
  "export function FinancialDemo() { return null; }",
);

for (const pin of [
  "risk-profile",
  "industry-preferences",
  "company-discovery",
  "finance.historical-analysis",
  "finance.industry-research",
  "finance.price-target",
  "future-capability",
]) {
  const pinned = rehash({
    ...record,
    moduleVersions: { ...record.moduleVersions, [pin]: "1.2.0" },
  });
  assert(!isMainLegacyBuild(pinned));
  assert(!approvedPermissions(pinned, true).includes("finance.research"));
  assert(!approvedPermissions(pinned, true).includes("market.prices"));
  assert.throws(() => validateScopedBundle(bundle, pinned), /starter|approved/);
}
for (const companyTableVersion of ["supplied-csv-v1", "unavailable", "fixture-v1"]) {
  const changed = rehash({ ...record, companyTableVersion });
  assert(!isMainLegacyBuild(changed));
  assert.throws(() => inspectProjectProtection(bundle, changed), /starter/);
}
for (const permission of [
  "finance.risk-profile",
  "finance.company-discovery.v1-3",
  "finance.industry-preferences",
  "finance.historical-analysis",
  "finance.industry-research",
  "finance.price-target",
  "finance.calculate",
] as const) {
  const changed = structuredClone(bundle);
  changed.manifest.permissions.push(permission);
  assert.throws(() => validateScopedBundle(changed, record), /starter|approved/);
}
const fresh = await prepareBuild(
  {
    requirements: "Display historical prices for the selected supplied-CSV company.",
    capabilities: ["historical-analysis"],
    companyQueries: ["600000"],
    mode: "live",
    themeOverride: null,
  },
  "fresh-main-compatibility-turn",
  1,
);
assert(!isMainLegacyBuild(fresh));
assert(!approvedPermissions(fresh, true).includes("market.prices"));
assert(!approvedPermissions(fresh, true).includes("finance.research"));
assert.throws(() => inspectProjectProtection(bundle, fresh), /starter/);
console.log(
  "PASS main snapshot bytes, protection, permission isolation and persisted record hashes",
);
bundleSchema.parse(bundle);
assert(inspectProject(bundle, spec, record).every((check) => check.passed));
assert(inspectProject(notesOnly, spec, record).every((check) => check.passed));

const previousEnv = {
  CD80_LOCAL_MODE: process.env.CD80_LOCAL_MODE,
  CD80_DATA_DIR: process.env.CD80_DATA_DIR,
};
const dir = await mkdtemp(join(tmpdir(), "main-compatibility-"));
process.env.CD80_LOCAL_MODE = "1";
process.env.CD80_DATA_DIR = dir;
const access = { ownerId: "local-prototype-owner", accessToken: null };
try {
  // Synthetic persisted verification metadata tests gates only, not generated execution.
  const hash = await sourceHash(bundle);
  const release: Release = {
    id: crypto.randomUUID(),
    spec,
    bundle,
    buildRecord: { ...record, artifactHash: hash },
    verification: { passed: true, checks: [], checkedAt: record.createdAt, sourceHash: hash },
    createdAt: record.createdAt,
    origin: "model",
    notes: "Synthetic historical persistence fixture",
  };
  const preview = { ...structuredClone(release), id: crypto.randomUUID() };
  const app: Application = {
    id: crypto.randomUUID(),
    ownerId: access.ownerId,
    name: spec.name,
    spec,
    revision: 0,
    current: release,
    preview,
    history: [],
    events: [],
    data: { sentinel: { retained: "main notes" } },
    createdAt: record.createdAt,
  };
  await saveApp(access, app, null);
  const rpc = (releaseId: string, capability: string, input: unknown) =>
    dispatch(access, { action: "rpc", appId: app.id, releaseId, capability, input });
  for (const saved of [release, preview])
    assert.deepEqual(await rpc(saved.id, "storage.read", { key: "sentinel" }), app.data.sentinel);
  assert.deepEqual(
    (await findApp(access, app.id)).current?.buildRecord?.moduleVersions,
    record.moduleVersions,
  );
  await assert.rejects(rpc(release.id, "finance.industry-research", {}), /declared capability/);
  const changed = await findApp(access, app.id);
  changed.preview!.bundle.files["src/App.tsx"] += "\n// changed after verification";
  await saveApp(access, changed, changed.revision);
  await assert.rejects(
    rpc(preview.id, "storage.read", { key: "sentinel" }),
    /unchanged financial contract/,
  );
  assert.deepEqual(await rpc(release.id, "storage.read", { key: "sentinel" }), app.data.sentinel);
} finally {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
}
console.log(
  "PASS exact main v4 snapshot, persisted hash/source gates, isolated legacy permissions, optional financial UI and active/preview storage reads; no generated execution or financial algorithms restored",
);
