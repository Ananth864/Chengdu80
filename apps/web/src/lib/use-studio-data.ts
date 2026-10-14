import { useEffect } from "react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@web-starter/backend/convex/_generated/api";
import type { Application } from "./contracts";

// Only reads are public in the explicitly shared demo. Every write stays server-key protected.
export function StudioSubscriptions({
  selected,
  demo,
  onApps,
  onMessages,
}: {
  selected: string | null;
  demo: boolean;
  onApps: (apps: Application[]) => void;
  onMessages: (appId: string, messages: NonNullable<Application["conversation"]>) => void;
}) {
  const auth = useConvexAuth();
  const enabled = demo || (!auth.isLoading && auth.isAuthenticated);
  const apps = useQuery(api.platform.studioApps, enabled ? {} : "skip");
  const messages = useQuery(
    api.platform.studioMessages,
    enabled && selected ? { appId: selected } : "skip",
  );
  useEffect(() => {
    if (apps !== undefined) onApps(apps);
  }, [apps, onApps]);
  useEffect(() => {
    if (selected && messages !== undefined) onMessages(selected, messages);
  }, [selected, messages, onMessages]);
  return null;
}
