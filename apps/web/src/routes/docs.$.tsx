import { createFileRoute, notFound } from "@tanstack/react-router";
import { DocumentationPage } from "../components/docs-page";
import { documentation } from "../lib/documentation";

export const Route = createFileRoute("/docs/$")({
  beforeLoad: ({ params }) => {
    const page = documentation.find((page) => page.slug === params._splat);
    if (!page) throw notFound();
    return { page };
  },
  head: ({ match }) => ({ meta: [{ title: `${match.context.page.title} · Linus docs` }] }),
  component: DocumentationTopic,
});

function DocumentationTopic() {
  const { page } = Route.useRouteContext();
  return <DocumentationPage page={page} />;
}
