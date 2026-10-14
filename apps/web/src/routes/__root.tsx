import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@web-starter/ui/components/sonner";
import { TooltipProvider } from "@web-starter/ui/components/tooltip";
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
        title: "Linus · Financial app studio",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="frame-src 'self'; object-src 'none'; base-uri 'self'"
        />
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <TooltipProvider delay={300}>
            <div className="flex min-h-svh min-w-0 flex-col">
              <Header />
              <Outlet />
            </div>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}
