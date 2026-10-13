import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { DocumentationPage } from "../components/docs-page";
import { documentation } from "../lib/documentation";

export const Route = createFileRoute("/docs/")({ component: DocumentationOverview });

function DocumentationOverview() {
  const navigate = useNavigate();
  useEffect(() => {
    const slug = window.location.hash.slice(1);
    // Preserve links to sections of the previous single-page reference.
    if (slug && documentation.some((page) => page.slug === slug))
      void navigate({ to: "/docs/$", params: { _splat: slug }, replace: true });
  }, [navigate]);
  return <DocumentationPage page={documentation[0]!} />;
}
