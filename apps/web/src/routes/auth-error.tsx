import { createFileRoute } from "@tanstack/react-router";
import { buttonVariants } from "@web-starter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@web-starter/ui/components/card";
import { cn } from "@web-starter/ui/lib/utils";

export const Route = createFileRoute("/auth-error")({
  component: AuthErrorPage,
});

function AuthErrorPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl items-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Authentication failed</CardTitle>
          <CardDescription>
            WorkOS could not complete the sign-in request. Check the redirect URI, sign-in endpoint,
            and cookie password in your environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/api/auth/sign-in" className={cn(buttonVariants())}>
            Try again
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
