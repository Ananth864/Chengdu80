import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppFrame } from "../components/app-frame";
import { ReactAppFrame } from "../components/react-app-frame";
import { Alert, AlertTitle, AlertDescription } from "@web-starter/ui/components/alert";
import { api } from "../lib/client";
import type { Application } from "../lib/contracts";
import { loadPublishedApp } from "../server/published-app";

export const Route = createFileRoute("/app/$appId")({
  loader: ({ params }) => loadPublishedApp({ data: { appId: params.appId } }),
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: loaderData.title },
            { name: "description", content: loaderData.description },
            { property: "og:title", content: loaderData.title },
            { property: "og:description", content: loaderData.description },
            { property: "og:type", content: "website" },
            { property: "og:url", content: loaderData.canonical },
            { name: "twitter:card", content: "summary" },
            { name: "twitter:title", content: loaderData.title },
            { name: "twitter:description", content: loaderData.description },
          ],
          links: [
            { rel: "canonical", href: loaderData.canonical },
            { rel: "icon", type: "image/svg+xml", href: loaderData.icon },
          ],
        }
      : {},
  component: PublishedApp,
  errorComponent: ({ error }) => (
    <Alert variant="destructive">
      <AlertTitle>Application unavailable</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
    </Alert>
  ),
});

function PublishedApp() {
  const data = Route.useLoaderData();
  const [legacyApp, setLegacyApp] = useState<Application | null>(null);
  const [legacyError, setLegacyError] = useState("");
  useEffect(() => {
    if (data.schemaVersion === 3) return;
    let cancelled = false;
    api()
      .then((snapshot) => {
        if (cancelled) return;
        const found = snapshot.apps.find((a: Application) => a.id === data.appId);
        if (!found?.current) throw new Error("Accepted application not found or access denied");
        setLegacyApp(found);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setLegacyError(e instanceof Error ? e.message : "Application failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, [data.appId, data.schemaVersion]);
  return (
    <main aria-label="Standalone application" className="flex h-svh min-h-0 min-w-0 flex-col">
      {data.schemaVersion === 3 ? (
        <ReactAppFrame
          app={{ id: data.appId, name: data.appName }}
          release={{ id: data.releaseId }}
        />
      ) : legacyError ? (
        <Alert variant="destructive">
          <AlertTitle>Application unavailable</AlertTitle>
          <AlertDescription>{legacyError}</AlertDescription>
        </Alert>
      ) : legacyApp?.current ? (
        <AppFrame app={legacyApp} release={legacyApp.current} />
      ) : (
        <p role="status" className="p-4 text-sm text-muted-foreground">
          Opening application…
        </p>
      )}
    </main>
  );
}
