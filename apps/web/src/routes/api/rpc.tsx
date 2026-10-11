// @if drizzle
// import { createFileRoute } from "@tanstack/react-router";
// @if auth
// import { viewerHeader } from "@web-starter/api/rpc";
// @endif
// import * as cf from "cloudflare:workers";
//
// @if auth
// import { auth } from "../../integrations/auth";
//
// @endif
// // Forwards typed RPC calls (`integrations/api.ts`) to the API Worker over its service
// // binding; the API Worker has no public URL. `cf.env` is read per request because
// // TanStack Start's dev server evaluates modules outside a Worker request.
// export const Route = createFileRoute("/api/rpc")({
//   server: {
//     handlers: {
// @if auth
//       POST: async ({ request }) => {
//         // The API trusts this header, so it only ever comes from the session.
//         const forwarded = new Request(request);
//         forwarded.headers.delete(viewerHeader);
//         const { viewer } = await auth.getSession();
//         if (viewer) forwarded.headers.set(viewerHeader, viewer.id);
//         return cf.env.API.fetch(forwarded);
//       },
// @endif
// @if !auth
//       POST: ({ request }) => cf.env.API.fetch(request),
// @endif
//     },
//   },
// });
// @endif
