import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cd80 } from "@/lib/cd80";
import { buildContext } from "@/lib/build-context";
import { Badge } from "@/components/ui/badge";
import { CompanyDiscovery } from "@/components/company-discovery";
import { RiskQuestionnaire } from "@/components/risk-questionnaire";
import { IndustryPreference } from "@/components/industry-preference";
import { completedRiskProfileSchema, type RiskProfileCompleted } from "@/lib/risk-profile";
import { normalizedIndustryPreferenceSchema } from "@/lib/company-discovery";
import { FinancialAnalysis } from "@/components/financial-analysis";

export function FinancialModules() {
  const capabilities: readonly string[] = buildContext.capabilities;
  return (
    <section
      data-financial-module-version="financial-react-v1"
      className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10"
    >
      {capabilities.includes("risk-industry-matching") && (
        <DiscoveryWorkflow enableWatchlist={capabilities.includes("company-cards")} />
      )}
      {capabilities.includes("risk-assessment") &&
        !capabilities.includes("risk-industry-matching") && <RiskQuestionnaire />}
      {capabilities.includes("industry-preference") &&
        !capabilities.includes("risk-industry-matching") && <IndustryPreference />}
      {buildContext.companies.map((companyId) => (
        <section key={companyId} className="space-y-6" aria-label={`Company analysis ${companyId}`}>
          {capabilities.includes("historical-analysis") && (
            <FinancialAnalysis capability="historical-analysis" companyId={companyId} />
          )}
          {capabilities.includes("market-research") && (
            <FinancialAnalysis capability="industry-research" companyId={companyId} />
          )}
          {capabilities.includes("price-target") && (
            <FinancialAnalysis capability="price-target" companyId={companyId} />
          )}
        </section>
      ))}
    </section>
  );
}

function DiscoveryWorkflow({ enableWatchlist }: { enableWatchlist: boolean }) {
  const [completed, setCompleted] = useState<RiskProfileCompleted | null>(null);
  const risk = useQuery({
    queryKey: ["cd80", "storage", "risk-profile"],
    queryFn: () => cd80.storage.read("risk-profile", completedRiskProfileSchema),
    retry: false,
  });
  const preference = useQuery({
    queryKey: ["cd80", "storage", "industry-preference"],
    queryFn: () => cd80.storage.read("industry-preference", normalizedIndustryPreferenceSchema),
    retry: false,
  });
  const riskResult = completed ?? risk.data;
  return (
    <section className="space-y-6" aria-label="Discovery workflow">
      <RiskQuestionnaire onCompleted={setCompleted} />
      <IndustryPreference />
      {risk.isError || preference.isError ? (
        <p role="alert">
          Completed questionnaire or normalized industry preferences could not be loaded.
        </p>
      ) : riskResult && preference.data ? (
        <CompanyDiscovery
          riskResult={riskResult}
          industryPreference={preference.data}
          enableWatchlist={enableWatchlist}
          key={JSON.stringify([riskResult.answers, preference.data])}
        />
      ) : (
        <p role="status">
          Discovery requires a completed questionnaire and saved normalized industry preferences.
          Save your questionnaire and industry preferences to start discovery.
        </p>
      )}
    </section>
  );
}

export function FinancialDemo() {
  return (
    <main>
      <header className="mx-auto max-w-5xl space-y-3 px-6 pt-10">
        <Badge variant="secondary">Synthetic demo</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{buildContext.name}</h1>
        <p className="text-muted-foreground">Live data and expert assessments are unavailable.</p>
      </header>
      <FinancialModules />
    </main>
  );
}
