import assert from "node:assert/strict";
import { protocols, bundleSchema } from "../apps/web/src/lib/contracts";
import { prepareBuild, validateScopedBundle } from "../apps/web/src/server/build-policy";
import {
  projectStarterBundle,
  approvedPermissions,
  buildContextPath,
  buildContextSource,
} from "../apps/web/src/lib/financial-starter";
import { inspectProject } from "../apps/web/src/server/project-runtime";

const spec = { ...protocols[0]!.defaultSpec, name: "Company card demo" };
const record = await prepareBuild(
  {
    requirements: "A synthetic daily company-card demo",
    capabilities: ["company-cards"],
    companyQueries: [],
    mode: "fixture",
    themeOverride: null,
  },
  "fixture-turn",
  1,
);
const bundle = projectStarterBundle(spec);
bundle.manifest.permissions = approvedPermissions(record, true);
bundle.files[buildContextPath] = buildContextSource(record, spec.name);
bundleSchema.parse(bundle);
validateScopedBundle(bundle, record);
assert(inspectProject(bundle, spec, record).every((check) => check.passed));
assert(!inspectProject(bundle, spec).every((check) => check.passed));
for (const filename of [
  "package.json",
  "vite.config.ts",
  "tsconfig.json",
  "src/lib/cd80.ts",
  "src/lib/build-context.ts",
  "src/components/financial-app.tsx",
  "src/components/ui/button.tsx",
  "src/routes/__root.tsx",
  "src/app.css",
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
  assert.throws(() => validateScopedBundle(changed, record), /starter|context|theme/);
  assert(!inspectProject(changed, spec, record).every((check) => check.passed));
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
assert(bundle.files["src/routes/__root.tsx"]!.includes("<FinancialDemo"));
assert(bundle.files["src/components/financial-app.tsx"]!.includes("Synthetic demo"));
assert(bundle.files["src/components/financial-app.tsx"]!.includes("@/components/ui/card"));
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
  "PASS React starter, fixed SDK/modules/shadcn/configuration, fake-check rejection, financial permissions and contract-controlled theme overrides",
);
