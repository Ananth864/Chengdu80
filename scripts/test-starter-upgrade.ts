import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { appProjectTemplateFiles } from "../apps/web/src/lib/app-project-template";
import type { BuildRecord } from "../apps/web/src/lib/build-plan";
import { capabilityStarterV1Files } from "../apps/web/src/lib/capability-starter-v1";
import type { AppBundle, ProductSpec } from "../apps/web/src/lib/contracts";
import {
  approvedPermissions,
  buildContextPath,
  buildContextSource,
  financialStarterVersion,
  protectedProjectFiles,
} from "../apps/web/src/lib/financial-starter";
import { mainStarterSnapshot } from "../apps/web/src/lib/main-starter-snapshot";
import {
  prepareBuild,
  requireBuild,
  validateScopedBundle,
} from "../apps/web/src/server/build-policy";
import { inspectProject } from "../apps/web/src/server/project-runtime";

// Guard the real agent wiring; the object tests below do not simulate a provider turn.
const agent = (
  await readFile(new URL("../apps/web/src/server/agent.ts", import.meta.url), "utf8")
).replace(/\)\s+files\[name\] = source;/g, ") files[name] = source;");
assert.match(
  agent,
  /if \(projectFormat && record\.readiness !== "blocked"\) \{\s*(?:\/\/[^\n]*\n\s*)*for \(const \[name, source\] of Object\.entries\(protectedProjectFiles\(\)\)\) files\[name\] = source;\s*const manifest = JSON\.parse\(files\["cd80\.json"\]\);\s*files\["cd80\.json"\] = JSON\.stringify\(\{\s*\.\.\.manifest,\s*permissions: approvedPermissions\(record, true\),\s*\}\);\s*files\[buildContextPath\] = buildContextSource\(record, manifest\.name\);\s*if \(project\) \{\s*await releaseWorkspace\(project\);\s*project = undefined;\s*\}\s*await checkpoint\(\);/,
  "Approved preparation must upgrade protected files, permissions and context before checkpoint",
);

const spec: ProductSpec = {
  name: "Retained company research",
  purpose: "Display research for a selected supplied-CSV company.",
  protocol: "screening",
  inputs: ["Company ticker"],
  outputs: ["Company research"],
  outputDetails: {
    "Company research": "Approved industry research; unavailable provider fields stay unavailable.",
  },
  constraints: ["Contract inspection fixture only; no generated execution or live-data claim"],
};
const current = await prepareBuild(
  {
    requirements: spec.purpose,
    capabilities: ["market-research"],
    companyQueries: ["600000"],
    mode: "live",
    themeOverride: null,
  },
  "starter-upgrade-turn",
  1,
);
assert.equal(current.readiness, "live");
assert.equal(current.moduleVersions.starter, financialStarterVersion);
requireBuild(current, current.turnId);

for (const version of ["feature-v1", "main-v4", "current-v4"] as const) {
  const retained: BuildRecord = structuredClone(current);
  const files: Record<string, string> = { ...appProjectTemplateFiles };
  if (version === "feature-v1") {
    Object.assign(files, capabilityStarterV1Files);
    retained.moduleVersions.starter = "financial-react-v1";
  } else if (version === "main-v4") {
    Object.assign(files, mainStarterSnapshot);
    for (const name of [
      "src/lib/risk-profile.ts",
      "src/lib/company-discovery.ts",
      "src/lib/discovery-contract.ts",
      "src/lib/financial-results.ts",
      "src/lib/industry-preference.ts",
    ])
      delete files[name];
    retained.moduleVersions = {
      companies: current.moduleVersions.companies!,
      starter: financialStarterVersion,
    };
    retained.companyTableVersion = "sse-a-sized:2026-10-12:upgrade-fixture";
  }
  const { hash: _hash, artifactHash: _artifactHash, ...payload } = retained;
  retained.hash = createHash("sha256")
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
  const bundle: AppBundle = {
    manifest: {
      schemaVersion: 3,
      name: spec.name,
      protocol: spec.protocol,
      permissions: approvedPermissions(retained, true),
    },
    files,
  };
  const presentation: Record<string, string> = {
    "src/App.tsx": "export default function App() { return <main>Retained research</main>; }\n",
    "src/app.css": ":root { --retained-accent: #835a32; }\n",
    "src/styles.css": "main { max-width: 72rem; }\n",
    "src/routes/index.tsx": `${files["src/routes/index.tsx"]}\n// Retained index route.\n`,
    "src/routes/__root.tsx": `${files["src/routes/__root.tsx"]}\n// Retained root route.\n`,
    "src/components/financial-app.tsx":
      "export function FinancialDemo() { return <main>Retained shell</main>; }\n",
    "src/components/retained-notes.tsx": "export function Notes() { return null; }\n",
  };
  Object.assign(files, presentation);
  files[buildContextPath] = buildContextSource(retained, spec.name);
  requireBuild(retained, retained.turnId);
  validateScopedBundle(bundle, retained);
  assert(
    inspectProject(bundle, spec, retained).every((check) => check.passed),
    version,
  );
  if (version !== "current-v4")
    assert.throws(() => validateScopedBundle(bundle, current), /starter|context/);

  // Apply the same platform-owned replacements as prepare_build, not legacy algorithms.
  const generatedRouteTree = files["src/routeTree.gen.ts"];
  for (const [name, source] of Object.entries(protectedProjectFiles())) files[name] = source;
  bundle.manifest.permissions = approvedPermissions(current, true);
  files[buildContextPath] = buildContextSource(current, bundle.manifest.name);
  for (const [name, source] of Object.entries(presentation)) assert.equal(files[name], source);
  assert.equal(files["src/routeTree.gen.ts"], generatedRouteTree);
  for (const [name, source] of Object.entries(protectedProjectFiles()))
    assert.equal(files[name], source, `${version}: ${name}`);
  assert.equal(files[buildContextPath], buildContextSource(current, spec.name));
  assert.deepEqual(bundle.manifest.permissions, approvedPermissions(current, true));
  validateScopedBundle(bundle, current);
  assert(
    inspectProject(bundle, spec, current).every((check) => check.passed),
    version,
  );
  const changed = structuredClone(bundle);
  changed.files["src/lib/cd80.ts"] += "\n// Unauthorized SDK edit.\n";
  assert.throws(() => validateScopedBundle(changed, current), /starter file unchanged/);
  assert(!inspectProject(changed, spec, current).every((check) => check.passed));
  console.log(
    `PASS ${version} protected-source upgrade, retained presentation and SDK mutation rejection`,
  );
}
console.log("PASS agent upgrade/checkpoint source guard; no provider turn or generated execution");
