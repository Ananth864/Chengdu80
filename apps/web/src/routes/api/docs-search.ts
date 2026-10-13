import { createFileRoute } from "@tanstack/react-router";
import { createSearchAPI } from "fumadocs-core/search/server";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { documentation, documentationUrl } from "../../lib/documentation";
import { documentationContent } from "../../components/docs-page";

// Index the same React content rendered by the docs, including live contract tables.
const search = createSearchAPI("simple", {
  indexes: () =>
    documentation.map((page) => ({
      title: page.title,
      description: page.description,
      url: documentationUrl(page.slug),
      content: renderToStaticMarkup(
        createElement(documentationContent[page.slug as keyof typeof documentationContent]),
      ).replace(/<[^>]*>/g, " "),
    })),
});

export const Route = createFileRoute("/api/docs-search")({
  server: { handlers: { GET: ({ request }) => search.GET(request) } },
});
