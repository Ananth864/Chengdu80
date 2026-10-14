import assert from "node:assert/strict";
import type { Application } from "../apps/web/src/lib/contracts";
type UIMessage = NonNullable<Application["conversation"]>[number];
import { compactTranscript } from "../apps/web/src/server/agent";

// Discussion turns plus later build/tool traffic must not erase earlier discussion.
const messages: UIMessage[] = Array.from({ length: 8 }, (_, i) => [
  {
    id: `user-${i}`,
    role: "user" as const,
    parts: [
      {
        type: "text" as const,
        content: `${i === 0 ? "Keep my earlier industry preference" : "Discussion"} ${"u".repeat(8000)}`,
      },
    ],
  },
  {
    id: `assistant-${i}`,
    role: "assistant" as const,
    parts: [{ type: "text" as const, content: `Discussion response ${"a".repeat(16000)}` }],
  },
]).flat();
assert(JSON.stringify(messages).length > 180000);
const persisted = compactTranscript(messages, true);
assert.deepEqual(
  persisted.map((message) => message.id),
  messages.map((message) => message.id),
  "Conversation compaction must not delete discussion turns when a later build grows the transcript",
);
assert.equal(
  persisted[0]!.parts[0]!.type === "text" && persisted[0]!.parts[0]!.content,
  messages[0]!.parts[0]!.type === "text" && messages[0]!.parts[0]!.content,
);
assert.deepEqual(persisted, messages, "Preserve every user and assistant text part verbatim");
const toolHistory: UIMessage[] = [
  {
    id: "tools",
    role: "assistant",
    parts: [
      {
        type: "tool-call",
        id: "interrupted",
        name: "write_file",
        arguments: '{"path":"index.html"',
        state: "input-streaming",
      },
      { type: "tool-result", toolCallId: "large", content: "x".repeat(11000), state: "complete" },
      { type: "text", content: "Keep the discussion after tools too." },
    ],
  },
];
const tools = compactTranscript(toolHistory, true)[0]!.parts;
assert(
  tools[0]!.type === "tool-call" && tools[0]!.state === "error" && tools[0]!.arguments === "{}",
);
assert(
  tools[1]!.type === "tool-result" &&
    typeof tools[1]!.content === "string" &&
    tools[1]!.content.length < 10000,
);
assert.deepEqual(tools[2], toolHistory[0]!.parts[2]);
console.log("PASS earlier non-build conversations survive later build transcript growth");

import { eraseConversation } from "../packages/backend/convex/lib/chat_state";
const built = {
  current: { verification: { passed: true }, id: "release" },
  conversation: messages,
  turns: [{ status: "complete" }],
  chatTitle: "My discussion",
  data: { watchlist: ["DEMO001"] },
  buildRecords: [{}],
};
const erased = eraseConversation(built)!;
assert.deepEqual(erased.conversation, []);
assert.equal(erased.current.id, "release");
assert.deepEqual(erased.data, built.data);
assert.equal(erased.chatTitle, undefined);
assert.deepEqual(built.conversation, messages, "Do not mutate caller state");
assert.equal(eraseConversation({ ...built, current: null }), null);
assert.throws(() =>
  eraseConversation({
    ...built,
    agentTurn: { status: "running", startedAt: new Date().toISOString() },
  }),
);
console.log(
  "PASS deleting chat preserves completed apps/data, removes unbuilt workspaces and rejects active replies",
);
