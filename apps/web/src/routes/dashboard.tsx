import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { api } from "@web-starter/backend/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@web-starter/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@web-starter/ui/components/empty";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { Authenticated, Unauthenticated } from "convex/react";

export const Route = createFileRoute("/dashboard")({
  loader: async ({ location }) => {
    const { user } = await getAuth();

    if (!user) {
      throw redirect({
        href: `/api/auth/sign-in?returnPathname=${encodeURIComponent(location.pathname)}`,
      });
    }

    return { user };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useLoaderData();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>
      </div>

      <Authenticated>
        <DashboardContent />
      </Authenticated>
      <Unauthenticated>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Convex auth is loading</EmptyTitle>
            <EmptyDescription>
              WorkOS is signed in, but Convex has not received a valid access token yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Unauthenticated>
    </main>
  );
}

function DashboardContent() {
  const { data, isLoading } = useQuery(convexQuery(api.viewer.current, {}));

  if (isLoading || !data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Loading profile</EmptyTitle>
          <EmptyDescription>Convex is validating the WorkOS access token.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Viewer</CardTitle>
          <CardDescription>Validated by Convex from the WorkOS JWT.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          <span>{data.email}</span>
          <span className="text-muted-foreground">{data.subject}</span>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Ready for multi-tenant SaaS flows.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {data.organizationId ?? (
            <span className="text-muted-foreground">No active organization</span>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Role</CardTitle>
          <CardDescription>WorkOS role and permission claims.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {data.role ?? <span className="text-muted-foreground">No role claim</span>}
        </CardContent>
      </Card>
    </div>
  );
}
