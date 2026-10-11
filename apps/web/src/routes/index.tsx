import { createFileRoute } from "@tanstack/react-router";
// @if auth|ai
import { buttonVariants } from "@web-starter/ui/components/button";
import { cn } from "@web-starter/ui/lib/utils";
// @endif

// @if convex
import { BackendStatus } from "../components/convex-status";
// @endif
// @if drizzle
// import { BackendStatus } from "../components/db-status";
// @endif
import { StatusCard } from "../components/status-card";
// @if auth
import { auth } from "../integrations/auth";
// @endif

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  // @if auth
  const { viewer } = Route.useRouteContext();
  // @endif

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <section className="flex max-w-3xl flex-col gap-5">
        <p className="text-sm font-medium text-muted-foreground">TanStack Start + Cloudflare</p>
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Production SaaS starter for Cloudflare.
          </h1>
          <p className="max-w-2xl text-base/7 text-muted-foreground">
            Bun monorepo with TanStack Start, Tailwind, shadcn/ui, and Vite+, deployed to Cloudflare
            Workers through Alchemy.
          </p>
        </div>
        {/* @if auth|ai */}
        <div className="flex flex-wrap gap-2">
          {/* @if auth */}
          <a href={viewer ? "/dashboard" : auth.signUpHref} className={cn(buttonVariants())}>
            {viewer ? "Open dashboard" : "Create account"}
          </a>
          {/* @endif */}
          {/* @if ai */}
          <a href="/ai" className={cn(buttonVariants({ variant: "outline" }))}>
            Try AI route
          </a>
          {/* @endif */}
        </div>
        {/* @endif */}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {/* @if backend */}
        <BackendStatus />
        {/* @endif */}
        {/* @if auth */}
        <StatusCard
          title="Auth"
          description={viewer ? `Signed in as ${viewer.email}` : `${auth.label} is ready`}
          state={viewer ? "ready" : "loading"}
        />
        {/* @endif */}
        <StatusCard title="Deploy" description="Cloudflare Workers via Alchemy" state="ready" />
      </div>
    </main>
  );
}
