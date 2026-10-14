import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppFrame } from "../components/app-frame";
import { ReactAppFrame } from "../components/react-app-frame";
import { Alert, AlertTitle, AlertDescription } from "@web-starter/ui/components/alert";
import { Skeleton } from "@web-starter/ui/components/skeleton";
import { Spinner } from "@web-starter/ui/components/spinner";
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
        // Branded skeleton: the sandboxed frame can take seconds before its
        // first paint, so the route keeps a stable app-shaped placeholder.
        <div
          role="status"
          aria-label={`Opening ${data.appName}`}
          className="flex min-h-0 flex-1 flex-col gap-5 p-6"
        >
          <div className="flex min-w-0 items-center justify-between gap-4">
            <span className="studio-display truncate text-lg font-medium">{data.appName}</span>
            <Spinner className="size-4 shrink-0 text-muted-foreground" />
          </div>
          <Skeleton className="h-10 w-full shrink-0" />
          <div className="grid min-h-0 flex-1 gap-5 sm:grid-cols-3">
            <Skeleton className="hidden sm:block" />
            <Skeleton className="sm:col-span-2" />
          </div>
          <span className="text-sm text-muted-foreground">Opening application…</span>
        </div>
      )}
    </main>
  );
}
