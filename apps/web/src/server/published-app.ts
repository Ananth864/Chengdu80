import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { accessFor } from "./platform";
import { findApp } from "./repository";

// Publication metadata comes from the owned, active release. The standalone
// page needs only identities and metadata — never the app's source,
// conversation or saved data. Legacy (pre-TanStack) bundles are detected here
// so the page can fall back to its full-application fetch.
export const loadPublishedApp = createServerFn({ method: "POST" })
  .validator(z.object({ appId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const app = await findApp(await accessFor(getRequest()), data.appId);
    if (!app.current) throw new Error("Application not found or access denied");
    const release = app.current;
    const title = release.spec.name;
    const description = release.spec.purpose.slice(0, 300);
    const suppliedIcon = release.bundle.files["public/favicon.svg"];
    const initial = (
      new Intl.Segmenter().segment(title.trim()).containing(0)?.segment ?? "A"
    ).replace(/[<>&"']/g, "");
    const icon =
      suppliedIcon ??
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="black"/><text x="32" y="43" text-anchor="middle" font-family="sans-serif" font-size="36" fill="white">${initial}</text></svg>`;
    return {
      appId: app.id,
      appName: app.name,
      releaseId: release.id,
      schemaVersion: release.bundle.manifest.schemaVersion,
      title,
      description,
      canonical: new URL(`/app/${app.id}`, getRequest().url).href,
      icon: `data:image/svg+xml,${encodeURIComponent(icon)}`,
    };
  });
