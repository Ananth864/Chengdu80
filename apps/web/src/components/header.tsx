// @if auth
import { Link, useRouteContext } from "@tanstack/react-router";
// @endif
// @if !auth
// import { Link } from "@tanstack/react-router";
// @endif
// @if auth
import { buttonVariants } from "@web-starter/ui/components/button";
import { cn } from "@web-starter/ui/lib/utils";
// @endif

// @if auth
import { auth } from "../integrations/auth";
// @endif

export default function Header() {
  // @if auth
  const { viewer } = useRouteContext({ from: "__root__" });
  // @endif
  const links = [
    { to: "/", label: "Home" },
    // @if auth
    { to: "/dashboard", label: "Dashboard" },
    // @endif
    // @if ai
    { to: "/ai", label: "AI" },
    // @endif
  ] as const;

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className="mr-3 font-medium">
            Web Starter
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
        {/* @if auth */}
        <div className="flex items-center gap-2">
          {viewer ? (
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
        {/* @endif */}
      </div>
    </header>
  );
}
