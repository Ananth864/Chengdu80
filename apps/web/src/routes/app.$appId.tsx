import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppFrame } from "../components/app-frame";
import { Alert, AlertTitle, AlertDescription } from "@web-starter/ui/components/alert";
import { api } from "../lib/client";
import type { Application } from "../lib/contracts";
export const Route = createFileRoute("/app/$appId")({ component: PublishedApp });
function PublishedApp() {
  const { appId } = Route.useParams();
  const [app, setApp] = useState<Application | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api()
      .then((s) => {
        const found = s.apps.find((a: Application) => a.id === appId);
        if (!found?.current) throw new Error("Accepted application not found or access denied");
        setApp(found);
      })
      .catch((e) => setError(e.message));
  }, [appId]);
  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Application unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : app?.current ? (
        <AppFrame app={app} release={app.current} />
      ) : (
        <p>Opening application…</p>
      )}
    </main>
  );
}
