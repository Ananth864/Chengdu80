import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { buttonVariants } from "@web-starter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@web-starter/ui/components/card";
import { Textarea } from "@web-starter/ui/components/textarea";
import { cn } from "@web-starter/ui/lib/utils";
import { getAuth } from "@workos/authkit-tanstack-react-start";
import { useState } from "react";

export const Route = createFileRoute("/ai")({
  loader: async ({ location }) => {
    const { user } = await getAuth();

    if (!user) {
      throw redirect({
        href: `/api/auth/sign-in?returnPathname=${encodeURIComponent(location.pathname)}`,
      });
    }

    return { user };
  },
  component: AiPage,
});

function AiPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, isLoading, error, stop } = useChat({
    connection: fetchServerSentEvents("/api/ai/chat"),
  });

  const submit = () => {
    const message = input.trim();

    if (!message || isLoading) {
      return;
    }

    sendMessage(message);
    setInput("");
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">TanStack AI</h1>
        <p className="text-sm text-muted-foreground">
          Authenticated streaming chat route using TanStack AI and the OpenAI adapter.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chat</CardTitle>
          <CardDescription>
            Set `OPENAI_API_KEY` before using this in development or production.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex min-h-64 flex-col gap-3 rounded-sm border p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask how the starter is wired together.
              </p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{message.role}</span>
                  <div className="text-muted-foreground">
                    {message.parts.map((part, index) =>
                      part.type === "text" ? <span key={index}>{part.content}</span> : null,
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

          <div className="flex flex-col gap-2">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask a question..."
              disabled={isLoading}
            />
            <div className="flex justify-end gap-2">
              {isLoading ? (
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "outline" }))}
                  onClick={stop}
                >
                  Stop
                </button>
              ) : null}
              <button
                type="button"
                className={cn(buttonVariants())}
                onClick={submit}
                disabled={isLoading}
              >
                Send
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
