import { DocsPage, DocsTitle, DocsDescription, DocsBody } from "fumadocs-ui/layouts/docs/page";
import { documentation } from "../lib/documentation";
import {
  OverviewContent,
  SourceContent,
  SdkContent,
  CapabilitiesContent,
  ProtocolsContent,
  VerificationContent,
  PrivacyContent,
} from "./docs-content";

export const documentationContent = {
  "": OverviewContent,
  source: SourceContent,
  sdk: SdkContent,
  capabilities: CapabilitiesContent,
  protocols: ProtocolsContent,
  verification: VerificationContent,
  privacy: PrivacyContent,
};

export function DocumentationPage({ page }: { page: (typeof documentation)[number] }) {
  const Content = documentationContent[page.slug as keyof typeof documentationContent];
  return (
    <DocsPage toc={page.toc}>
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <DocsBody>
        <Content />
      </DocsBody>
    </DocsPage>
  );
}
