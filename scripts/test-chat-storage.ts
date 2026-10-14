import assert from "node:assert/strict";
import * as platform from "../packages/backend/convex/platform";
import { protocols } from "../apps/web/src/lib/contracts";
import { sampleBundle } from "../apps/web/src/lib/samples";

// Exercise the actual Convex handlers without deployment credentials or user data.
type Row = Record<string, any>;
const tables = new Map<string, Row[]>();
let sequence = 0;
const db = {
  query(table: string) {
    const filters: [string, unknown][] = [];
    const rows = () =>
      (tables.get(table) ?? []).filter((row) =>
        filters.every(([key, value]) => row[key] === value),
      );
    const chain = {
      withIndex(_index: string, select: (q: any) => unknown) {
        const q = {
          eq(key: string, value: unknown) {
            filters.push([key, value]);
            return q;
          },
        };
        select(q);
        return chain;
      },
      async collect() {
        return rows().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      },
      async unique() {
        const found = rows();
        assert(found.length <= 1);
        return found[0] ?? null;
      },
    };
    return chain;
  },
  async insert(table: string, value: Row) {
    const row = { ...structuredClone(value), _id: `${table}:${++sequence}` };
    tables.set(table, [...(tables.get(table) ?? []), row]);
    return row._id;
  },
  async patch(id: string, value: Row) {
    const row = [...tables.values()].flat().find((row) => row._id === id);
    assert(row);
    Object.assign(row, structuredClone(value));
  },
  async delete(id: string) {
    for (const [name, rows] of tables)
      tables.set(
        name,
        rows.filter((row) => row._id !== id),
      );
  },
};
const owner = "shared-prototype-owner";
const ctx = {
  db,
  auth: {
    async getUserIdentity() {
      return null;
    },
  },
};
async function invoke(fn: unknown, args: unknown) {
  return (fn as { _handler: (ctx: unknown, args: unknown) => Promise<any> })._handler(ctx, args);
}
process.env.CD80_DEMO_MODE = "1";
process.env.PLATFORM_INTERNAL_KEY = "fixture-internal-key-32-characters";
const app = {
  id: crypto.randomUUID(),
  ownerId: owner,
  revision: 0,
  name: "Scoped fixture",
  spec: protocols[0]!.defaultSpec,
  current: {
    id: "accepted",
    verification: { passed: true },
    bundle: sampleBundle(protocols[0]!.defaultSpec),
  },
  preview: null,
  history: [],
  events: [],
  data: { _companyCards: { watchlist: ["DEMO001"] } },
  buildRecords: [{ id: "approved-contract", provider: "tushare" }],
  conversation: [
    {
      id: "user-1",
      role: "user",
      parts: [{ type: "text", content: "Keep the industry choice from our earlier discussion." }],
    },
  ],
  agentTurn: { id: "user-1", status: "running", startedAt: new Date().toISOString() },
};
const stored = await invoke(platform.commit, { app, ownerId: owner, expectedRevision: null });
assert.deepEqual(stored.conversation, app.conversation);
const payload = tables.get("apps")![0]!.payload;
assert(!("conversation" in payload));
assert(!("agentTurn" in payload));
assert.deepEqual(payload.buildRecords, app.buildRecords);
assert.deepEqual(payload.data, app.data);
const messages = [
  ...app.conversation,
  { id: "assistant-1", role: "assistant", parts: [{ type: "text", content: "x".repeat(200000) }] },
];
await assert.rejects(
  invoke(platform.checkpointMessages, {
    appId: app.id,
    turnId: "user-1",
    messagesJson: JSON.stringify(messages),
    serverKey: "wrong",
  }),
  /Trusted platform server/,
);
await invoke(platform.checkpointMessages, {
  appId: app.id,
  turnId: "user-1",
  messagesJson: JSON.stringify(messages),
  serverKey: process.env.PLATFORM_INTERNAL_KEY,
});
assert.equal(
  tables.get("apps")![0]!.revision,
  1,
  "Text checkpoints do not race with app revisions",
);
assert.deepEqual(await invoke(platform.studioMessages, { appId: app.id }), messages);
await assert.rejects(
  invoke(platform.eraseChat, { appId: app.id, ownerId: owner, expectedRevision: 1 }),
  /running|Stop/i,
);
const { conversation: _conversation, ...metadata } = stored;
metadata.agentTurn = { ...metadata.agentTurn, status: "complete" };
await invoke(platform.commit, { app: metadata, ownerId: owner, expectedRevision: 1 });
assert.deepEqual(
  await invoke(platform.studioMessages, { appId: app.id }),
  messages,
  "Metadata saves preserve normalized history",
);
await assert.rejects(
  invoke(platform.eraseChat, { appId: app.id, ownerId: "another-owner", expectedRevision: 2 }),
  /access denied/,
);
await assert.rejects(
  invoke(platform.eraseChat, { appId: app.id, ownerId: owner, expectedRevision: 1 }),
  /Application changed/,
);
await assert.rejects(
  invoke(platform.deleteChat, {
    appId: app.id,
    expectedRevision: 2,
    demo: true,
    serverKey: "wrong",
  }),
  /Trusted platform server/,
);
const erased = await invoke(platform.eraseChat, {
  appId: app.id,
  ownerId: owner,
  expectedRevision: 2,
});
assert(erased.retainedBuild);
assert.equal(tables.get("messages")!.length, 0);
assert.equal(tables.get("threads")!.length, 0);
const retained = tables.get("apps")![0]!.payload;
assert.equal(retained.current.id, "accepted");
assert.deepEqual(retained.data, app.data);
assert.deepEqual(
  retained.buildRecords,
  [],
  "Conversation-only build attempts are cleared; accepted release remains",
);
await invoke(platform.commit, { app: retained, ownerId: owner, expectedRevision: 3 });
assert.equal(tables.get("threads")!.length, 0, "Saving app data does not resurrect a deleted chat");
for (const name of ["createWorkspace", "sendMessage", "renameThread", "stopTurn", "deleteThread"])
  assert(!(name in platform), `${name} must not expose a direct demo write`);
console.log(
  "PASS normalized message persistence, protected checkpoints, metadata preservation, revision/ownership checks and chat-only deletion",
);
