import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@web-starter/ui/components/alert";
import { Card } from "@web-starter/ui/components/card";
import { buttonVariants } from "@web-starter/ui/components/button";
import { cn } from "@web-starter/ui/lib/utils";
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
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>We couldn't open this application</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-3">
              <Link to="/" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                Back to workspace
              </Link>
            </div>
          </AlertDescription>
        </Alert>
      ) : app?.current ? (
        <Card className="overflow-hidden py-0">
          <AppFrame app={app} release={app.current} frameClassName="h-[85vh]" />
        </Card>
      ) : (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Opening application…
        </div>
      )}
    </main>
  );
}
