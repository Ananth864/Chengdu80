// Standalone Node server entry for the self-hosted/Docker deployment.
// Serves the built client assets from dist/client and falls back to the
// TanStack Start SSR fetch handler built to dist/server/server.js.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serve } from "srvx";
import { serveStatic } from "srvx/static";

const here = dirname(fileURLToPath(import.meta.url));
const clientDir = join(here, "..", "dist", "client");
const { default: ssrHandler } = await import(join(here, "..", "dist", "server", "server.js"));

const staticMiddleware = serveStatic({ dir: clientDir });

await serve({
  port: process.env.PORT || process.env.CD80_PORT || 3001,
  hostname: process.env.HOST,
  fetch: (request) => staticMiddleware(request, () => ssrHandler.fetch(request)),
}).ready();
