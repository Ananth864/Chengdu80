// @if convex
import type { ConvexQueryClient } from "@convex-dev/react-query";
// @endif
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Toaster } from "@web-starter/ui/components/sonner";
// @if convex
import type { ConvexReactClient } from "convex/react";
// @endif

import Header from "../components/header";
// @if auth
import { auth } from "../integrations/auth";
// @endif

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
  // @if convex
  convexClient: ConvexReactClient;
  convexQueryClient: ConvexQueryClient;
  // @endif
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  // @if auth
  // Every route reads the signed-in viewer from context; null when signed out.
  // @if convex
  beforeLoad: async ({ context }) => {
    // @endif
    // @if !convex
    // beforeLoad: async () => {
    // @endif
    const session = await auth.getSession();
    // @if convex

    // SSR Convex queries run as the signed-in user.
    if (session.accessToken) {
      context.convexQueryClient.serverHttpClient?.setAuth(session.accessToken);
    }
    // @endif

    return { viewer: session.viewer };
  },
  // @endif
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Web Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="grid min-h-svh grid-rows-[auto_1fr]">
          <Header />
          <Outlet />
        </div>
        <Toaster richColors />
        <TanStackRouterDevtools position="bottom-left" />
        <Scripts />
      </body>
    </html>
  );
}
