import { appProjectTemplateFiles } from "./app-project-template";
import type { AppBundle, ProductSpec } from "./contracts";
import type { BuildRecord } from "./build-plan";
import { legacyFinancialSdkSource } from "./legacy-financial-sdk";
import { riskFinancialSdkSource } from "./risk-financial-sdk";
import { legacyFinancialModulesSource } from "./legacy-financial-modules";
import { discoveryStarterSnapshot } from "./discovery-starter-snapshot";
import { preAnalysisStarterSnapshot } from "./pre-analysis-starter-snapshot";
import { preAnalysisDiscoveryComponentSource } from "./pre-analysis-discovery-component";
import { capabilityStarterV1Files } from "./capability-starter-v1";
import { mainStarterSnapshot } from "./main-starter-snapshot";

export const financialStarterVersion = "financial-react-v4";
export const buildContextPath = "src/lib/build-context.ts";
// Main shipped v4 before per-capability pins and the supplied-CSV company table.
// Callers must still validate the persisted record hash and exact SDK source.
export function isMainLegacyBuild(record: BuildRecord | undefined) {
  return (
    record?.moduleVersions.starter === financialStarterVersion &&
    !!record.moduleVersions.companies &&
    Object.keys(record.moduleVersions).every((key) => key === "companies" || key === "starter") &&
    record.companyTableVersion.startsWith("sse-a")
  );
}
export function buildContextSource(record: BuildRecord, name: string) {
  const context =
    record.moduleVersions.starter === "financial-react-v1"
      ? {
          name,
          capabilities: record.resolvedCapabilities,
          companies: record.companyIds,
          theme: record.theme,
          provider: record.provider,
        }
      : {
          name,
          mode: record.plan.mode,
          capabilities: record.resolvedCapabilities,
          companies: record.companyIds,
          industries: isMainLegacyBuild(record)
            ? record.companyIndustries
            : (record.companyIndustries ?? []),
          theme: record.theme,
          provider: record.provider,
        };
  return `// Platform-owned contract context.\nexport const buildContext = ${JSON.stringify(context)} as const;\n`;
}
export function approvedPermissions(record: BuildRecord, project: boolean) {
  const permissions: AppBundle["manifest"]["permissions"] = ["storage.read", "storage.write"];
  if (!project) permissions.push("finance.calculate");
  if (project && isMainLegacyBuild(record)) {
    if (record.resolvedCapabilities.includes("market-research"))
      permissions.push("finance.research");
    if (record.resolvedCapabilities.includes("historical-analysis"))
      permissions.push("market.prices");
    if (record.resolvedCapabilities.includes("risk-industry-matching"))
      permissions.push("finance.match-companies");
    if (record.resolvedCapabilities.includes("company-cards"))
      permissions.push("finance.company-cards");
    return permissions;
  }
  if (
    project &&
    ["v1.3.0", "v1.4.0"].includes(record.moduleVersions["industry-preferences"] ?? "") &&
    record.resolvedCapabilities.includes("industry-preference")
  )
    permissions.push("finance.industry-preferences");
  if (
    project &&
    record.moduleVersions["risk-profile"] === "v0-demo" &&
    record.resolvedCapabilities.includes("risk-assessment")
  )
    permissions.push("finance.risk-profile");
  if (record.resolvedCapabilities.includes("risk-industry-matching"))
    permissions.push(
      project && record.moduleVersions["company-discovery"] === "v1.3.0"
        ? "finance.company-discovery.v1-3"
        : project && record.moduleVersions["company-discovery"] === "v2-sessions"
          ? "finance.company-discovery"
          : "finance.match-companies",
    );
  if (
    record.resolvedCapabilities.includes("company-cards") &&
    !(
      project &&
      ["v2-sessions", "v1.3.0"].includes(record.moduleVersions["company-discovery"] ?? "")
    )
  )
    permissions.push("finance.company-cards");
  for (const [business, capability] of [
    ["historical-analysis", "finance.historical-analysis"],
    ["market-research", "finance.industry-research"],
    ["price-target", "finance.price-target"],
  ] as const)
    if (
      project &&
      record.resolvedCapabilities.includes(business) &&
      record.moduleVersions[capability] === "1.2.0"
    )
      permissions.push(capability);
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
  "src/components/financial-analysis.tsx",
  "src/components/company-discovery.tsx",
  "src/components/risk-questionnaire.tsx",
  "src/components/industry-preference.tsx",
  "src/router.tsx",
  "src/routes/__root.tsx",
  "src/routes/index.tsx",
]);
export function protectedProjectFiles(starterVersion = financialStarterVersion) {
  // SDK, build configuration and shadcn primitives belong to the platform.
  // build-context.ts and routeTree.gen.ts are checked separately: the context
  // must match its build record, the route tree is generated.
  return Object.fromEntries(
    Object.entries(
      starterVersion === "financial-react-v1"
        ? { ...appProjectTemplateFiles, ...capabilityStarterV1Files }
        : appProjectTemplateFiles,
    ).filter(
      ([name]) =>
        !agentOwnedProjectFiles.has(name) &&
        name !== buildContextPath &&
        name !== "src/routeTree.gen.ts",
    ),
  );
}
export function inspectProjectProtection(bundle: AppBundle, record?: BuildRecord) {
  if (
    record &&
    !["financial-react-v1", financialStarterVersion].includes(record.moduleVersions.starter ?? "")
  )
    throw new Error("The financial starter version changed. Prepare a new build.");
  const legacySdk =
    bundle.files["src/lib/cd80.ts"] === legacyFinancialSdkSource &&
    !record?.moduleVersions["risk-profile"] &&
    !record?.moduleVersions["industry-preferences"] &&
    !bundle.manifest.permissions.includes("finance.industry-preferences") &&
    !record?.moduleVersions["company-discovery"] &&
    !bundle.manifest.permissions.includes("finance.company-discovery") &&
    !bundle.manifest.permissions.includes("finance.risk-profile");
  const riskSdk =
    bundle.files["src/lib/cd80.ts"] === riskFinancialSdkSource &&
    !record?.moduleVersions["company-discovery"] &&
    !record?.moduleVersions["industry-preferences"] &&
    !bundle.manifest.permissions.includes("finance.industry-preferences") &&
    !bundle.manifest.permissions.includes("finance.company-discovery");
  const discoverySdk =
    bundle.files["src/lib/cd80.ts"] === discoveryStarterSnapshot["src/lib/cd80.ts"] &&
    !record?.moduleVersions["industry-preferences"] &&
    !bundle.manifest.permissions.includes("finance.industry-preferences");
  const preAnalysisSdk =
    bundle.files["src/lib/cd80.ts"] === preAnalysisStarterSnapshot["src/lib/cd80.ts"];
  const mainStarter =
    record &&
    isMainLegacyBuild(record) &&
    bundle.files["src/lib/cd80.ts"] === mainStarterSnapshot["src/lib/cd80.ts"] &&
    bundle.manifest.permissions.every((id) => approvedPermissions(record, true).includes(id));
  const historicalStarter =
    (!record || record.moduleVersions.starter === "financial-react-v1") &&
    (legacySdk || riskSdk || discoverySdk || preAnalysisSdk) &&
    record?.moduleVersions["company-discovery"] !== "v1.3.0" &&
    !["finance.historical-analysis", "finance.industry-research", "finance.price-target"].some(
      (id) => record?.moduleVersions[id],
    ) &&
    !bundle.manifest.permissions.some((id) =>
      [
        "finance.company-discovery.v1-3",
        "finance.historical-analysis",
        "finance.industry-research",
        "finance.price-target",
      ].includes(id),
    );
  for (const [name, source] of Object.entries(
    protectedProjectFiles(record?.moduleVersions.starter),
  ))
    if (
      bundle.files[name] !== source &&
      !(
        mainStarter &&
        ((Object.hasOwn(mainStarterSnapshot, name) &&
          bundle.files[name] === mainStarterSnapshot[name]) ||
          ([
            "src/lib/risk-profile.ts",
            "src/lib/company-discovery.ts",
            "src/lib/discovery-contract.ts",
            "src/lib/financial-results.ts",
            "src/lib/industry-preference.ts",
          ].includes(name) &&
            bundle.files[name] === undefined))
      ) &&
      !(
        historicalStarter &&
        (bundle.files[name] === preAnalysisStarterSnapshot[name] ||
          (name === "src/components/company-discovery.tsx" &&
            bundle.files[name] === preAnalysisDiscoveryComponentSource) ||
          ([
            "src/lib/discovery-contract.ts",
            "src/lib/financial-results.ts",
            "src/components/financial-analysis.tsx",
          ].includes(name) &&
            bundle.files[name] === undefined))
      ) &&
      !(
        historicalStarter &&
        legacySdk &&
        (name === "src/lib/cd80.ts" ||
          ((name === "src/lib/risk-profile.ts" ||
            name === "src/components/risk-questionnaire.tsx") &&
            bundle.files[name] === undefined))
      ) &&
      !(historicalStarter && riskSdk && name === "src/lib/cd80.ts") &&
      !(
        historicalStarter &&
        discoverySdk &&
        bundle.files[name] === discoveryStarterSnapshot[name]
      ) &&
      !(
        historicalStarter &&
        (legacySdk || riskSdk || discoverySdk) &&
        !record?.moduleVersions["industry-preferences"] &&
        !bundle.manifest.permissions.includes("finance.industry-preferences") &&
        (name === "src/lib/industry-preference.ts" ||
          name === "src/components/industry-preference.tsx") &&
        bundle.files[name] === undefined
      ) &&
      !(
        historicalStarter &&
        (legacySdk || riskSdk) &&
        name === "src/components/financial-app.tsx" &&
        bundle.files[name] === legacyFinancialModulesSource
      ) &&
      !(
        historicalStarter &&
        (legacySdk || riskSdk) &&
        (name === "src/lib/company-discovery.ts" ||
          name === "src/components/company-discovery.tsx") &&
        bundle.files[name] === undefined
      )
    )
      throw new Error(`Reuse the platform starter file unchanged: ${name}`);
  if (record && bundle.files[buildContextPath] !== buildContextSource(record, bundle.manifest.name))
    throw new Error("The project context does not match its feasible build record.");
  if (!record && bundle.files[buildContextPath] !== appProjectTemplateFiles[buildContextPath])
    throw new Error("A financial build record is required for generated project context.");
}
