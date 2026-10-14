import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { env } from "@web-starter/env/web";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";

import Loader from "./components/loader";
import { auth } from "./integrations/auth";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const convexClient =
    import.meta.env.VITE_LOCAL_MODE !== "1" && env.VITE_CONVEX_URL
      ? new ConvexReactClient(env.VITE_CONVEX_URL)
      : null;
  const convexQueryClient = convexClient ? new ConvexQueryClient(convexClient) : null;

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient?.hashFn(),
        queryFn: convexQueryClient?.queryFn(),
      },
    },
  });
  convexQueryClient?.connect(queryClient);

  const router = createTanStackRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <div>Not Found</div>,
    context: {
      queryClient,
      convexClient,
      convexQueryClient,
    },
    // Providers wrap inside out: data clients first, auth outermost.
    Wrap: ({ children }) => {
      if (convexClient)
        children = (
          <ConvexProviderWithAuth client={convexClient} useAuth={auth.useConvexAuth}>
            {children}
          </ConvexProviderWithAuth>
        );
      children = <auth.Provider>{children}</auth.Provider>;
      return <>{children}</>;
    },
  });

  if (convexClient) setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
