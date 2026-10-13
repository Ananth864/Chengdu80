import { Link, useRouteContext } from "@tanstack/react-router";
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
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className="mr-3 font-medium">
            <span className="brand-mark">C80</span> Chengdu80
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
            <span className="local-label">Local prototype · Single owner</span>
          ) : import.meta.env.VITE_DEMO_MODE === "1" ? (
            <span className="local-label">Shared demo · No login</span>
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
