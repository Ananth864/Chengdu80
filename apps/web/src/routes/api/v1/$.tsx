// @if drizzle
// import { createFileRoute } from "@tanstack/react-router";
//
// import { forwardToApi } from "../../../integrations/api.server";
//
// // Public face of the API Worker, which has no URL of its own: every `/api/v1/*` request
// // (typed client calls, plain REST, `openapi.json`, and the `docs` page) is forwarded to
// // it over the service binding.
// export const Route = createFileRoute("/api/v1/$")({
//   server: {
//     handlers: {
//       ANY: ({ request }) => forwardToApi(request),
//     },
//   },
// });
// @endif
