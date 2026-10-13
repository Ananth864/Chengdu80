import { createFileRoute } from "@tanstack/react-router";
import { accessFor } from "../../server/platform";
import { listPlugins, registerPlugin } from "../../server/plugins";
import { pluginRegistrationSchema } from "../../lib/plugins";
import { settings } from "../../server/settings";

const response = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });
export const Route = createFileRoute("/api/plugins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return response({ plugins: await listPlugins(await accessFor(request)) });
        } catch {
          return response({ error: "Plugin registry access is unavailable" }, 401);
        }
      },
      POST: async ({ request }) => {
        try {
          if (request.headers.get("origin") !== new URL(request.url).origin)
            return response({ error: "Same-origin registration required" }, 403);
          if (!request.headers.get("content-type")?.startsWith("application/json"))
            return response({ error: "JSON content type required" }, 415);
          const text = await request.text();
          if (text.length > 260000) return response({ error: "Plugin document is too large" }, 413);
          return response({
            plugin: await registerPlugin(
              await accessFor(request),
              pluginRegistrationSchema.parse(JSON.parse(text)),
            ),
          });
        } catch (error) {
          let message = error instanceof Error ? error.message : "Registration failed";
          for (const [key, value] of Object.entries(await settings()))
            if (value && /KEY|TOKEN|SECRET|PASSWORD/.test(key))
              message = message.replaceAll(value, "[redacted]");
          return response({ error: message.slice(0, 2000) }, 400);
        }
      },
    },
  },
});
