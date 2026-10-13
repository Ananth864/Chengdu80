import { Link, useRouteContext } from "@tanstack/react-router";
import { Badge } from "@web-starter/ui/components/badge";
import { buttonVariants } from "@web-starter/ui/components/button";
import { cn } from "@web-starter/ui/lib/utils";

import { auth } from "../integrations/auth";

export default function Header() {
  const { viewer } = useRouteContext({ from: "__root__" });
  const links = [
    { to: "/", label: "Workspace" },
    { to: "/docs", label: "Developer docs" },
  ] as const;

  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1 text-sm">
          <Link to="/" className="mr-2 flex items-center gap-2 font-semibold sm:mr-4">
            <span className="grid size-7 place-items-center rounded-sm bg-primary text-[10px] font-bold tracking-wide text-primary-foreground">
              C80
            </span>
            Chengdu80
          </Link>
          {links.map(({ to, label }) => {
            return (
              <Link
                key={to}
                to={to}
                className="rounded-sm px-2 py-1 text-muted-foreground hover:text-foreground [&.active]:text-foreground"
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {import.meta.env.VITE_LOCAL_MODE === "1" ? (
            <Badge variant="secondary">Local prototype · Single owner</Badge>
          ) : import.meta.env.VITE_DEMO_MODE === "1" ? (
            <Badge variant="secondary">Shared demo · No login</Badge>
          ) : viewer ? (
            <a
              href={auth.signOutHref}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Sign out
            </a>
          ) : (
            <>
              <a
                href={auth.signInHref()}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Sign in
              </a>
              <a href={auth.signUpHref} className={cn(buttonVariants({ size: "sm" }))}>
                Sign up
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
