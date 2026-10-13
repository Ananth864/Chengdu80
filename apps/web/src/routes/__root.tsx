import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { Toaster } from "@web-starter/ui/components/sonner";
import type { ConvexReactClient } from "convex/react";

import Header from "../components/header";
import { auth } from "../integrations/auth";

import appCss from "../index.css?url";

export interface RouterAppContext {
  queryClient: QueryClient;
  convexClient: ConvexReactClient | null;
  convexQueryClient: ConvexQueryClient | null;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  // Every route reads the signed-in viewer from context; null when signed out.
  beforeLoad: async ({ context }) => {
    const session = await auth.getSession();

    // SSR Convex queries run as the signed-in user.
    if (session.accessToken) {
      context.convexQueryClient?.serverHttpClient?.setAuth(session.accessToken);
    }

    return { viewer: session.viewer };
  },
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
        title: "Chengdu80 · Financial app studio",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
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
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="frame-src 'self'; object-src 'none'; base-uri 'self'"
        />
        <HeadContent />
      </head>
      <body>
        <div className="grid min-h-svh min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr]">
          <Header />
          <Outlet />
        </div>
        <Toaster richColors />
        <Scripts />
      </body>
    </html>
  );
}
