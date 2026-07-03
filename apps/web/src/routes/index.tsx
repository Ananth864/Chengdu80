import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { api } from "@web-starter/backend/convex/_generated/api";
import { buttonVariants } from "@web-starter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@web-starter/ui/components/card";
import { cn } from "@web-starter/ui/lib/utils";
import { getAuth } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/")({
  loader: async () => {
    const { user } = await getAuth();
    return { user };
  },
  component: HomeComponent,
});

function HomeComponent() {
  const { user } = Route.useLoaderData();
  const healthCheck = useQuery(convexQuery(api.healthCheck.get, {}));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <section className="flex max-w-3xl flex-col gap-5">
        <p className="text-sm font-medium text-muted-foreground">
          TanStack Start + Convex + WorkOS
        </p>
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Production SaaS starter for Cloudflare.
          </h1>
          <p className="max-w-2xl text-base/7 text-muted-foreground">
            Bun monorepo with WorkOS AuthKit, Convex realtime backend, Cloudflare deployment through
            Alchemy, Tailwind, shadcn/ui, Oxlint, Oxfmt, and optional TanStack AI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={user ? "/dashboard" : "/api/auth/sign-up"} className={cn(buttonVariants())}>
            {user ? "Open dashboard" : "Create account"}
          </a>
          <a href="/ai" className={cn(buttonVariants({ variant: "outline" }))}>
            Try AI route
          </a>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusCard
          title="Convex"
          description={
            healthCheck.isLoading
              ? "Checking backend"
              : healthCheck.data === "OK"
                ? "Realtime backend connected"
                : "Backend unavailable"
          }
          state={healthCheck.data === "OK" ? "ready" : healthCheck.isLoading ? "loading" : "error"}
        />
        <StatusCard
          title="Auth"
          description={user ? `Signed in as ${user.email}` : "WorkOS AuthKit routes are ready"}
          state={user ? "ready" : "loading"}
        />
        <StatusCard title="Deploy" description="Cloudflare Workers via Alchemy" state="ready" />
      </div>
    </main>
  );
}

function StatusCard({
  title,
  description,
  state,
}: {
  title: string;
  description: string;
  state: "ready" | "loading" | "error";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={
              state === "ready"
                ? "size-2 rounded-full bg-primary"
                : state === "loading"
                  ? "size-2 rounded-full bg-muted-foreground"
                  : "size-2 rounded-full bg-destructive"
            }
          />
          {state}
        </div>
      </CardContent>
    </Card>
  );
}
