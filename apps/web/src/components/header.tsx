import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@web-starter/ui/components/button";
import { cn } from "@web-starter/ui/lib/utils";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";

export default function Header() {
  const { user } = useAuth();
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/ai", label: "AI" },
  ] as const;

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/" className="mr-3 font-medium">
            MIS Stack
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
          {user ? (
            <a href="/sign-out" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Sign out
            </a>
          ) : (
            <>
              <a
                href="/api/auth/sign-in"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Sign in
              </a>
              <a href="/api/auth/sign-up" className={cn(buttonVariants({ size: "sm" }))}>
                Sign up
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
