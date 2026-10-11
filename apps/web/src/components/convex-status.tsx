// @if convex
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "@web-starter/backend/convex/_generated/api";

import { StatusCard } from "./status-card";

export function BackendStatus() {
  const { data, isLoading } = useQuery(convexQuery(api.healthCheck.get, {}));
  const ok = data === "OK";

  return (
    <StatusCard
      title="Convex"
      description={
        isLoading ? "Checking backend" : ok ? "Realtime backend connected" : "Backend unavailable"
      }
      state={ok ? "ready" : isLoading ? "loading" : "error"}
    />
  );
}
// @endif
