import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { modelAdapter, modelOptions } from "../../../server/models";
import { createFileRoute } from "@tanstack/react-router";

import { auth } from "../../../integrations/auth";

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { viewer } = await auth.getSession();

        if (!viewer) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { messages } = await request.json();

        return toServerSentEventsResponse(
          chat({
            adapter: await modelAdapter(),
            modelOptions: await modelOptions(),
            systemPrompts: [
              "You help explain financial analysis. Be concise. Do not invent figures or offer investment recommendations.",
            ],
            messages,
          }),
        );
      },
    },
  },
});
