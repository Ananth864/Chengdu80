import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppFrame } from "../components/app-frame";
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
    <main className="standalone-app">
      {error ? (
        <p role="alert">{error}</p>
      ) : app?.current ? (
        <AppFrame app={app} release={app.current} />
      ) : (
        <p>Opening private application…</p>
      )}
    </main>
  );
}
