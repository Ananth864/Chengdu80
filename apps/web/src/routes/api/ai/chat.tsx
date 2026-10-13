import { toServerSentEventsResponse } from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { accessFor } from "../../../server/platform";
import { startAgentTurn, safeAgentError } from "../../../server/agent";

const requestSchema = z.object({
  appId: z.string().uuid(),
  messages: z.array(z.unknown()).min(1).max(200),
});
const userSchema = z.object({
  id: z.string().min(1).max(100),
  role: z.literal("user"),
  parts: z.array(z.object({ type: z.literal("text"), content: z.string() })).min(1),
});
export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const origin = request.headers.get("origin");
          if (origin && origin !== new URL(request.url).origin)
            return Response.json(
              { error: "Cross-origin requests are not allowed" },
              { status: 403 },
            );
          if (!request.headers.get("content-type")?.startsWith("application/json"))
            return Response.json({ error: "JSON content type required" }, { status: 415 });
          const raw = await request.text();
          if (raw.length > 500000)
            return Response.json({ error: "Conversation is too large" }, { status: 413 });
          const body = requestSchema.parse(JSON.parse(raw));
          const last = userSchema.parse(body.messages.at(-1));
          const content = z
            .string()
            .trim()
            .min(1)
            .max(12000)
            .parse(last.parts.map((part) => part.content).join("\n"));
          return toServerSentEventsResponse(
            await startAgentTurn(
              await accessFor(request),
              body.appId,
              { id: last.id, content },
              request.signal,
            ),
          );
        } catch (error) {
          return Response.json({ error: await safeAgentError(error) }, { status: 400 });
        }
      },
    },
  },
});
