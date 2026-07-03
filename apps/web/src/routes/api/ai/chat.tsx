import { chat, toServerSentEventsResponse } from "@tanstack/ai";
import { openaiText } from "@tanstack/ai-openai";
import { createFileRoute } from "@tanstack/react-router";
import { getAuth } from "@workos/authkit-tanstack-react-start";

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { user } = await getAuth();

        if (!user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!process.env.OPENAI_API_KEY) {
          return Response.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
        }

        const { messages } = await request.json();

        return toServerSentEventsResponse(
          chat({
            adapter: openaiText("gpt-4.1-mini"),
            systemPrompts: [
              "You are the assistant inside a production SaaS starter. Be concise and practical.",
            ],
            messages,
          }),
        );
      },
    },
  },
});
