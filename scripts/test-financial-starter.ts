import assert from "node:assert/strict";
import { protocols, bundleSchema } from "../apps/web/src/lib/contracts";
import { prepareBuild, validateScopedBundle } from "../apps/web/src/server/build-policy";
import {
  projectStarterBundle,
  approvedPermissions,
  buildContextPath,
  buildContextSource,
  financialStarterVersion,
  protectedProjectFiles,
  inspectProjectProtection,
} from "../apps/web/src/lib/financial-starter";
import { inspectProject } from "../apps/web/src/server/project-runtime";

const spec = { ...protocols[0]!.defaultSpec, name: "Company card demo" };
const record = await prepareBuild(
  {
    requirements: "A daily company-card app on live SSE Class A data",
    capabilities: ["company-cards"],
    companyQueries: [],
    mode: "live",
    themeOverride: null,
  },
  "starter-turn",
  1,
);
const bundle = projectStarterBundle(spec);
bundle.manifest.permissions = approvedPermissions(record, true);
bundle.files[buildContextPath] = buildContextSource(record, spec.name);
bundleSchema.parse(bundle);
validateScopedBundle(bundle, record);
assert(inspectProject(bundle, spec, record).every((check) => check.passed));
assert(!inspectProject(bundle, spec).every((check) => check.passed));
// Platform-owned files (SDK, build config, shadcn primitives, contract context)
// must stay unchanged; everything else is the agent's presentation canvas.
for (const filename of [
  "package.json",
  "vite.config.ts",
  "tsconfig.json",
  "src/lib/cd80.ts",
  "src/lib/risk-profile.ts",
  "src/lib/industry-preference.ts",
  "src/lib/company-discovery.ts",
  "src/lib/discovery-contract.ts",
  "src/lib/financial-results.ts",
  "src/lib/build-context.ts",
  "src/components/ui/button.tsx",
]) {
  const changed = structuredClone(bundle);
  changed.files[filename] =
    filename === "package.json"
      ? JSON.stringify({
          scripts: {
            build: "mkdir -p dist/server dist/client && touch dist/server/server.js",
            check: "true",
          },
        })
      : `${changed.files[filename]}\n// changed by builder`;
  assert.throws(() => validateScopedBundle(changed, record), /starter|context/);
  assert(!inspectProject(changed, spec, record).every((check) => check.passed));
}
for (const filename of [
  "src/components/financial-app.tsx",
  "src/components/financial-analysis.tsx",
  "src/components/company-discovery.tsx",
  "src/components/risk-questionnaire.tsx",
  "src/components/industry-preference.tsx",
  "src/routes/__root.tsx",
  "src/routes/index.tsx",
  "src/App.tsx",
  "src/app.css",
  "src/styles.css",
]) {
  const changed = structuredClone(bundle);
  changed.files[filename] = `${changed.files[filename]}\n/* redesigned by builder */`;
  validateScopedBundle(changed, record);
  assert(inspectProject(changed, spec, record).every((check) => check.passed));
}
for (const permission of [
  "plugin.call",
  "ai.explain",
  "market.prices",
  "finance.backtest",
  "finance.calculate",
] as const) {
  assert.throws(
    () =>
      validateScopedBundle(
        {
          ...bundle,
          manifest: {
            ...bundle.manifest,
            permissions: [...bundle.manifest.permissions, permission],
          },
        },
        record,
      ),
    /approved platform modules/,
  );
}
assert(!bundle.files["src/lib/cd80.ts"]!.includes("tushare"));
assert(!bundle.files["src/lib/cd80.ts"]!.includes("ai.explain"));
assert(bundle.files["src/lib/cd80.ts"]!.includes("async financialAnalysis("));
for (const permission of [
  "finance.historical-analysis",
  "finance.industry-research",
  "finance.price-target",
])
  assert(bundle.files["src/lib/cd80.ts"]!.includes(permission));
assert(!bundle.files["src/lib/cd80.ts"]!.includes("priceHistory"));
assert(!bundle.files["src/lib/cd80.ts"]!.includes('"finance.research"'));
assert(bundle.files["src/routes/__root.tsx"]!.includes("<Outlet"));
assert(!bundle.files["src/routes/__root.tsx"]!.includes("FinancialDemo"));
assert(bundle.files["src/App.tsx"]!.includes("<FinancialDemo"));
assert(
  bundle.files["src/components/financial-app.tsx"]!.includes("Live · Shanghai Stock Exchange"),
);
assert(bundle.files["src/components/financial-app.tsx"]!.includes("export function FinancialDemo"));
assert(!bundle.files["src/components/financial-app.tsx"]!.includes("Synthetic demo"));
assert(bundle.files["src/components/financial-analysis.tsx"]!.includes("@/components/ui/card"));
assert(bundle.files["src/components/financial-app.tsx"]!.includes("FinancialAnalysis"));
assert(
  bundle.files["src/components/financial-app.tsx"]!.includes(
    'data-financial-module-version="financial-react-v4"',
  ),
);
assert.equal(record.plan.mode, "live");
assert.equal(record.moduleVersions.starter, financialStarterVersion);
assert(buildContextSource(record, spec.name).includes('"mode":"live"'));
// A replacement presentation need not retain a FinancialModules marker or fixed shell.
const redesigned = structuredClone(bundle);
redesigned.files["src/components/financial-app.tsx"] =
  "export function FinancialDemo() { return <main>Live · Shanghai Stock Exchange</main>; }";
validateScopedBundle(redesigned, record);
assert(inspectProject(redesigned, spec, record).every((check) => check.passed));

// Persisted v1 protection/context remain pure compatibility checks, not new fixture builds.
const legacyRecord = {
  ...record,
  plan: { ...record.plan, mode: "fixture" as const },
  readiness: "fixture" as const,
  moduleVersions: { ...record.moduleVersions, starter: "financial-react-v1" },
};
const legacyBundle = structuredClone(bundle);
Object.assign(legacyBundle.files, protectedProjectFiles("financial-react-v1"));
legacyBundle.files[buildContextPath] = buildContextSource(legacyRecord, spec.name);
inspectProjectProtection(legacyBundle, legacyRecord);
assert(!legacyBundle.files[buildContextPath]!.includes('"mode"'));
legacyBundle.files["src/lib/financial-results.ts"] += "\n// changed calculation contract";
assert.throws(() => inspectProjectProtection(legacyBundle, legacyRecord), /starter/);
// A themed record stays valid; presentation files no longer need permission to
// differ — the recorded theme is a descriptor, not a styling gate.
const themed = await prepareBuild(
  { ...record.plan, themeOverride: "Use a warm terracotta accent" },
  "theme-turn",
  2,
);
const customized = structuredClone(bundle);
customized.files[buildContextPath] = buildContextSource(themed, spec.name);
customized.files["src/app.css"] = ":root { --primary: #9f4d37; }";
validateScopedBundle(customized, themed);
console.log(
  "PASS React starter, platform-owned SDK/config/shadcn with free presentation redesign, fake-check rejection, market.prices gating and recorded themes",
);
