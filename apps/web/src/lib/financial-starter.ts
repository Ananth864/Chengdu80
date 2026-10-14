import { appProjectTemplateFiles } from "./app-project-template";
import type { AppBundle, ProductSpec } from "./contracts";
import type { BuildRecord } from "./build-plan";

export const financialStarterVersion = "financial-react-v4";
export const buildContextPath = "src/lib/build-context.ts";
export function buildContextSource(record: BuildRecord, name: string) {
  return `// Platform-owned contract context.\nexport const buildContext = ${JSON.stringify({ name, mode: record.plan.mode, capabilities: record.resolvedCapabilities, companies: record.companyIds, industries: record.companyIndustries, theme: record.theme, provider: record.provider })} as const;\n`;
}
export function approvedPermissions(record: BuildRecord, project: boolean) {
  const permissions: AppBundle["manifest"]["permissions"] = ["storage.read", "storage.write"];
  if (!project) permissions.push("finance.calculate");
  if (record.resolvedCapabilities.includes("market-research")) permissions.push("finance.research");
  if (record.resolvedCapabilities.includes("historical-analysis"))
    permissions.push("market.prices");
  if (record.resolvedCapabilities.includes("risk-industry-matching"))
    permissions.push("finance.match-companies");
  if (record.resolvedCapabilities.includes("company-cards"))
    permissions.push("finance.company-cards");
  return permissions;
}
export function projectStarterBundle(spec: ProductSpec): AppBundle {
  return {
    manifest: {
      schemaVersion: 3,
      name: spec.name,
      protocol: spec.protocol,
      permissions: ["storage.read", "storage.write"],
    },
    files: { ...appProjectTemplateFiles },
  };
}
// Everything the builder agent may reshape freely: the whole presentation
// surface, including the financial shell, routes and styling. New files are
// agent-owned by default.
const agentOwnedProjectFiles = new Set([
  "README.md",
  "src/App.tsx",
  "src/app.css",
  "src/styles.css",
  "src/components/capabilities.tsx",
  "src/components/financial-app.tsx",
  "src/router.tsx",
  "src/routes/__root.tsx",
  "src/routes/index.tsx",
]);
export function protectedProjectFiles() {
  // SDK, build configuration and shadcn primitives belong to the platform.
  // build-context.ts and routeTree.gen.ts are checked separately: the context
  // must match its build record, the route tree is generated.
  return Object.fromEntries(
    Object.entries(appProjectTemplateFiles).filter(
      ([name]) =>
        !agentOwnedProjectFiles.has(name) &&
        name !== buildContextPath &&
        name !== "src/routeTree.gen.ts",
    ),
  );
}
export function inspectProjectProtection(bundle: AppBundle, record?: BuildRecord) {
  for (const [name, source] of Object.entries(protectedProjectFiles()))
    if (bundle.files[name] !== source)
      throw new Error(`Reuse the platform starter file unchanged: ${name}`);
  if (record && bundle.files[buildContextPath] !== buildContextSource(record, bundle.manifest.name))
    throw new Error("The project context does not match its feasible build record.");
  if (!record && bundle.files[buildContextPath] !== appProjectTemplateFiles[buildContextPath])
    throw new Error("A financial build record is required for generated project context.");
}
