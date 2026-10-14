import { appProjectTemplateFiles } from "./app-project-template";
import type { AppBundle, ProductSpec } from "./contracts";
import type { BuildRecord } from "./build-plan";
import { legacyFinancialSdkSource } from "./legacy-financial-sdk";
import { riskFinancialSdkSource } from "./risk-financial-sdk";
import { legacyFinancialModulesSource } from "./legacy-financial-modules";
import { discoveryStarterSnapshot } from "./discovery-starter-snapshot";
import { preAnalysisStarterSnapshot } from "./pre-analysis-starter-snapshot";
import { preAnalysisDiscoveryComponentSource } from "./pre-analysis-discovery-component";

export const financialStarterVersion = "financial-react-v1";
export const buildContextPath = "src/lib/build-context.ts";
export function buildContextSource(record: BuildRecord, name: string) {
  return `// Platform-owned contract context.\nexport const buildContext = ${JSON.stringify({ name, capabilities: record.resolvedCapabilities, companies: record.companyIds, theme: record.theme, provider: record.provider })} as const;\n`;
}
export function approvedPermissions(record: BuildRecord, project: boolean) {
  const permissions: AppBundle["manifest"]["permissions"] = ["storage.read", "storage.write"];
  if (!project) permissions.push("finance.calculate");
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
  const historicalStarter =
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
  for (const [name, source] of Object.entries(protectedProjectFiles()))
    if (
      bundle.files[name] !== source &&
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
  if (
    !record?.plan.themeOverride &&
    bundle.files["src/app.css"] !== appProjectTemplateFiles["src/app.css"]
  )
    throw new Error("Use the default starter theme unless the contract specifies an override.");
}
