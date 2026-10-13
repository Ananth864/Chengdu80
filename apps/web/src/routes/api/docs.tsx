import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  bundleSchema,
  capabilities,
  capabilityContracts,
  protocols,
  specSchema,
} from "../../lib/contracts";
import { protocolInstructions } from "../../lib/samples";
export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          {
            name: "Chengdu80 application contract",
            version: 1,
            sourceBundleSchema: z.toJSONSchema(bundleSchema),
            productSpecSchema: z.toJSONSchema(specSchema),
            capabilities,
            capabilityContracts,
            protocols: protocols.map((p) => ({
              ...p,
              instructions: protocolInstructions(p.defaultSpec),
            })),
            browserSDK:
              "window.cd80.call(capability,input) returns a Promise; cd80.ready() signals rendered UI",
            privacy:
              "Login is deferred in shared-demo mode: all visitors share apps and data. Authenticated mode scopes apps to their owning account. Preview writes are disabled.",
            import:
              "Upload a JSON bundle or the five source files through the workspace. Source-only import is supported; specification-only import is deferred.",
          },
          { headers: { "cache-control": "public, max-age=300" } },
        ),
    },
  },
});
