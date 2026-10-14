import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { protocols, bundleSchema } from "../apps/web/src/lib/contracts";
import { prepareBuild, validateScopedBundle } from "../apps/web/src/server/build-policy";
import {
  projectStarterBundle,
  approvedPermissions,
  buildContextPath,
  buildContextSource,
} from "../apps/web/src/lib/financial-starter";
import { inspectProject } from "../apps/web/src/server/project-runtime";
import { resetSizedCompanyCache, resetSseCompanyCache } from "../apps/web/src/server/providers";

// prepare_build verifies the live Tushare feed; stub it with the sample payload.
const tushareSample = JSON.parse(
  await readFile(new URL("./fixtures/stock-basic-sample.json", import.meta.url), "utf8"),
);
const originalFetch = globalThis.fetch;
process.env.TUSHARE_TOKEN = "test-token";
globalThis.fetch = (async () =>
  new Response(JSON.stringify(tushareSample))) as unknown as typeof fetch;
resetSseCompanyCache();
resetSizedCompanyCache();

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
assert(bundle.files["src/lib/cd80.ts"]!.includes("priceHistory"));
assert(bundle.files["src/routes/__root.tsx"]!.includes("<FinancialDemo"));
assert(
  bundle.files["src/components/financial-app.tsx"]!.includes("Live · Shanghai Stock Exchange"),
);
assert(bundle.files["src/components/financial-app.tsx"]!.includes("export function FinancialDemo"));
assert(bundle.files["src/components/financial-app.tsx"]!.includes("@/components/ui/card"));
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
globalThis.fetch = originalFetch;
console.log(
  "PASS React starter, platform-owned SDK/config/shadcn with free presentation redesign, fake-check rejection, market.prices gating and recorded themes",
);
