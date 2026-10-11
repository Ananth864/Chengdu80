// @if convex
import { ConvexQueryClient } from "@convex-dev/react-query";
// @endif
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
// @if convex
import { env } from "@web-starter/env/web";
// @endif
// @if convex auth
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
// @endif
// @if convex !auth
// import { ConvexProvider, ConvexReactClient } from "convex/react";
// @endif

import Loader from "./components/loader";
// @if auth
import { auth } from "./integrations/auth";
// @endif
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // @if convex
  const convexClient = new ConvexReactClient(env.VITE_CONVEX_URL);
  const convexQueryClient = new ConvexQueryClient(convexClient);
  // @endif

  const queryClient: QueryClient = new QueryClient({
    // @if convex
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
    // @endif
  });
  // @if convex
  convexQueryClient.connect(queryClient);
  // @endif

  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    context: {
      queryClient,
      // @if convex
      convexClient,
      convexQueryClient,
      // @endif
    },
    // Providers wrap inside out: data clients first, auth outermost.
    Wrap: ({ children }) => {
      // @if convex auth
      children = (
        <ConvexProviderWithAuth client={convexClient} useAuth={auth.useConvexAuth}>
          {children}
        </ConvexProviderWithAuth>
      );
      // @endif
      // @if convex !auth
      // children = <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
      // @endif
      // @if auth
      children = <auth.Provider>{children}</auth.Provider>;
      // @endif
      return <>{children}</>;
    },
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
