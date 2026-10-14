import { appProjectTemplateFiles } from "./app-project-template";
import type { AppBundle, ProductSpec } from "./contracts";
import type { BuildRecord } from "./build-plan";

export const financialStarterVersion = "financial-react-v3";
export const buildContextPath = "src/lib/build-context.ts";
export function buildContextSource(record: BuildRecord, name: string) {
  return `// Platform-owned contract context.\nexport const buildContext = ${JSON.stringify({ name, mode: record.plan.mode, capabilities: record.resolvedCapabilities, companies: record.companyIds, industries: record.companyIndustries, theme: record.theme, provider: record.provider })} as const;\n`;
}
export function approvedPermissions(record: BuildRecord, project: boolean) {
  const permissions: AppBundle["manifest"]["permissions"] = ["storage.read", "storage.write"];
  if (!project) permissions.push("finance.calculate");
  if (record.resolvedCapabilities.includes("market-research")) permissions.push("finance.research");
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
export function protectedProjectFiles() {
  // Build tools, SDK, approved financial UI, router and shadcn primitives belong to the platform.
  return Object.fromEntries(
    Object.entries(appProjectTemplateFiles).filter(
      ([name]) =>
        name !== "src/App.tsx" &&
        name !== "src/app.css" &&
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
  if (
    !record?.plan.themeOverride &&
    bundle.files["src/app.css"] !== appProjectTemplateFiles["src/app.css"]
  )
    throw new Error("Use the default starter theme unless the contract specifies an override.");
}
