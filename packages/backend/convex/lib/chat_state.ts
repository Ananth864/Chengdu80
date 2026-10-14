// Shared by local and hosted persistence. Deleting a chat must not delete its completed app.
type ChatState = {
  current?: { verification?: { passed?: boolean } } | null;
  agentTurn?: { status: string; startedAt: string };
  conversation?: unknown[];
  turns?: unknown[];
  buildRecords?: unknown[];
  rejectedBuildTurns?: string[];
  buildProposal?: unknown;
  chatTitle?: string;
  chatDeletedAt?: string;
};
export function eraseConversation<T extends ChatState>(app: T, now = new Date()): T | null {
  if (
    app.agentTurn?.status === "running" &&
    now.getTime() - Date.parse(app.agentTurn.startedAt) < 300000
  )
    throw new Error("Stop the active reply before deleting this chat.");
  if (!app.current?.verification?.passed) return null;
  const next = { ...app };
  next.conversation = [];
  next.turns = [];
  next.buildRecords = [];
  delete next.rejectedBuildTurns;
  next.chatDeletedAt = now.toISOString();
  delete next.agentTurn;
  delete next.chatTitle;
  return next;
}
