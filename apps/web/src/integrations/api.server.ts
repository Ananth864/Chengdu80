// @if drizzle
// @if auth
// import { viewerHeader } from "@web-starter/api/contract";
// @endif
// import * as cf from "cloudflare:workers";
//
// @if auth
// import { auth } from "./auth";
//
// @endif
// // Sends a request to the API Worker over the `API` service binding. Server only.
// // `cf.env` is read per request because TanStack Start's dev server evaluates modules
// // outside a Worker request.
// @if auth
// // The viewer header is replaced with the session's: the API trusts it, so it must
// // never come from the caller.
// export async function forwardToApi(request: Request): Promise<Response> {
//   const forwarded = new Request(request);
//   forwarded.headers.delete(viewerHeader);
//   const { viewer } = await auth.getSession();
//   if (viewer) forwarded.headers.set(viewerHeader, viewer.id);
//   return cf.env.API.fetch(forwarded);
// }
// @endif
// @if !auth
// export async function forwardToApi(request: Request): Promise<Response> {
//   return cf.env.API.fetch(request);
// }
// @endif
// @endif
