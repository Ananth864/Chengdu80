import { ClerkProvider } from "@clerk/tanstack-react-start";
// @if convex
import { useAuth } from "@clerk/tanstack-react-start";
// @endif
import { auth as getAuth, clerkMiddleware } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
// @if convex
import { useCallback, useMemo } from "react";
// @endif

import type { AuthIntegration } from "./types";

// Custom session token claims, set in Clerk Dashboard > Sessions > Customize session token:
// { "email": "{{user.primary_email_address}}", "name": "{{user.full_name}}" }
// Reading them from the token avoids a Clerk API call on every request.
declare global {
  interface CustomJwtSessionClaims {
    email?: string;
    name?: string;
  }
}

const getSession = createServerFn().handler(async () => {
  const session = await getAuth();
  if (!session.isAuthenticated) return { viewer: null, accessToken: null };

  const { email, name } = session.sessionClaims;
  return {
    viewer: { id: session.userId, email: email ?? null, name: name || null },
    accessToken: await session.getToken(),
  };
});

// Annotated (not `satisfies`): start.ts reads `auth.middleware`, and createServerFn types
// read the start instance, so inference here would be circular.
export const auth: AuthIntegration = {
  label: "Clerk",
  middleware: [clerkMiddleware()],
  Provider: ClerkProvider,
  getSession,
  signInHref: (returnTo) =>
    returnTo ? `/auth/sign-in?redirect_url=${encodeURIComponent(returnTo)}` : "/auth/sign-in",
  signUpHref: "/auth/sign-up",
  signOutHref: "/auth/sign-out",
  // @if convex
  useConvexAuth,
  // @endif
};

// @if convex
// Adapts Clerk's session to the shape ConvexProviderWithAuth expects. Assumes Clerk's
// Convex integration is enabled, so the default session token is valid for Convex.
function useConvexAuth() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) =>
      getToken({ skipCache: forceRefreshToken }),
    [getToken],
  );

  return useMemo(
    () => ({ isLoading: !isLoaded, isAuthenticated: !!isSignedIn, fetchAccessToken }),
    [isLoaded, isSignedIn, fetchAccessToken],
  );
}
// @endif
