import { createServerFn } from "@tanstack/react-start";
import { authkitMiddleware, getAuth } from "@workos/authkit-tanstack-react-start";
import {
  AuthKitProvider,
  // @if convex
  useAccessToken,
  useAuth,
  // @endif
} from "@workos/authkit-tanstack-react-start/client";
// @if convex
import { useCallback, useMemo } from "react";
// @endif

import type { AuthIntegration } from "./types";

const getSession = createServerFn().handler(async () => {
  const session = await getAuth();
  if (!session.user) return { viewer: null, accessToken: null };

  const { id, email, firstName, lastName } = session.user;
  return {
    viewer: { id, email, name: [firstName, lastName].filter(Boolean).join(" ") || null },
    accessToken: session.accessToken,
  };
});

// Annotated (not `satisfies`): start.ts reads `auth.middleware`, and createServerFn types
// read the start instance, so inference here would be circular.
export const auth: AuthIntegration = {
  label: "WorkOS AuthKit",
  middleware: [authkitMiddleware()],
  Provider: AuthKitProvider,
  getSession,
  signInHref: (returnTo) =>
    returnTo
      ? `/api/auth/sign-in?returnPathname=${encodeURIComponent(returnTo)}`
      : "/api/auth/sign-in",
  signUpHref: "/api/auth/sign-up",
  signOutHref: "/sign-out",
  // @if convex
  useConvexAuth,
  // @endif
};

// @if convex
// Adapts AuthKit's session to the shape ConvexProviderWithAuth expects.
function useConvexAuth() {
  const { loading, user } = useAuth();
  const { getAccessToken, refresh } = useAccessToken();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!user) return null;
      return (forceRefreshToken ? await refresh() : await getAccessToken()) ?? null;
    },
    [user, refresh, getAccessToken],
  );

  return useMemo(
    () => ({ isLoading: loading, isAuthenticated: !!user, fetchAccessToken }),
    [loading, user, fetchAccessToken],
  );
}
// @endif
