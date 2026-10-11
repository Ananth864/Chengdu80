// @if drizzle
// import { useQuery } from "@tanstack/react-query";
//
// import { api } from "../integrations/api";
// import { StatusCard } from "./status-card";
//
// export function BackendStatus() {
//   const { data, error, isLoading } = useQuery(api.health.queryOptions());
//
//   return (
//     <StatusCard
//       title="API"
//       description={
//         isLoading
//           ? "Checking database"
//           : data === "ok"
//             ? "Postgres connected via Hyperdrive"
//             : error?._tag === "DatabaseUnavailable"
//               ? "Database unavailable"
//               : "API unreachable"
//       }
//       state={data === "ok" ? "ready" : isLoading ? "loading" : "error"}
//     />
//   );
// }
// @endif
