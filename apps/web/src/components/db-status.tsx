// @if drizzle
// import { useQuery } from "@tanstack/react-query";
// import { createServerFn } from "@tanstack/react-start";
// import type Api from "@web-starter/api/worker";
// import { toRpcAsync } from "alchemy/Cloudflare/Bridge";
// import * as cf from "cloudflare:workers";
//
// import { StatusCard } from "./status-card";
//
// // Calls the API Worker over its service binding. `cf.env` is read per call because
// // TanStack Start's dev server evaluates modules outside a Worker request.
// const getHealth = createServerFn().handler(() => toRpcAsync<Api>(cf.env.API).health());
//
// export function BackendStatus() {
//   const { data, isLoading } = useQuery({ queryKey: ["api", "health"], queryFn: () => getHealth() });
//   const ok = data === "ok";
//
//   return (
//     <StatusCard
//       title="API"
//       description={
//         isLoading ? "Checking database" : ok ? "Postgres connected via Hyperdrive" : "Database unavailable"
//       }
//       state={ok ? "ready" : isLoading ? "loading" : "error"}
//     />
//   );
// }
// @endif
