import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { documentationTree } from "../lib/documentation";
import docsCss from "../docs.css?url";

export const Route = createFileRoute("/docs")({
  head: () => ({ links: [{ rel: "stylesheet", href: docsCss }] }),
  component: DocumentationLayout,
});

function DocumentationLayout() {
  return (
    <RootProvider theme={{ enabled: false }} search={{ options: { api: "/api/docs-search" } }}>
      <DocsLayout
        tree={documentationTree}
        nav={{ title: "Linus", url: "/#view=builds" }}
        links={[{ text: "Workspace", url: "/" }]}
      >
        <Outlet />
      </DocsLayout>
    </RootProvider>
  );
}
