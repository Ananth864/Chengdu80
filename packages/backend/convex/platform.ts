import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const rows = await ctx.db
      .query("apps")
      .withIndex("by_owner", (q) => q.eq("ownerId", identity.subject))
      .collect();
    return rows.map((r) => r.payload);
  },
});
export const save = action({
  args: { app: v.any(), expectedRevision: v.union(v.number(), v.null()), serverKey: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Authentication required");
    const expected = process.env.PLATFORM_INTERNAL_KEY;
    if (!expected || expected.length < 32 || args.serverKey !== expected)
      throw new Error("Trusted platform server required");
    if (args.app.ownerId !== identity.subject || JSON.stringify(args.app).length > 700000)
      throw new Error("Invalid app ownership or size");
    return ctx.runMutation(internal.platform.commit, {
      app: args.app,
      expectedRevision: args.expectedRevision,
      ownerId: identity.subject,
    });
  },
});
export const commit = internalMutation({
  args: { app: v.any(), expectedRevision: v.union(v.number(), v.null()), ownerId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("apps")
      .withIndex("by_app", (q) => q.eq("appId", args.app.id))
      .unique();
    if (row && row.ownerId !== args.ownerId) throw new Error("Access denied");
    if (args.expectedRevision === null ? row : !row || row.revision !== args.expectedRevision)
      throw new Error("Application changed. Refresh and try again.");
    const revision = (args.expectedRevision ?? 0) + 1;
    const payload = { ...args.app, revision };
    if (row) await ctx.db.patch(row._id, { payload, revision });
    else
      await ctx.db.insert("apps", { appId: payload.id, ownerId: args.ownerId, revision, payload });
    return payload;
  },
});

// Only the platform server can access the explicitly enabled shared demo workspace.
const demoOwnerId = "shared-prototype-owner";
function requireDemo(serverKey: string) {
  const expected = process.env.PLATFORM_INTERNAL_KEY;
  if (process.env.CD80_DEMO_MODE !== "1") throw new Error("Shared demo mode is disabled");
  if (!expected || expected.length < 32 || serverKey !== expected)
    throw new Error("Trusted platform server required");
}
export const listDemo = action({
  args: { serverKey: v.string() },
  handler: async (ctx, args): Promise<any> => {
    requireDemo(args.serverKey);
    return ctx.runQuery(internal.platform.demoRows, {});
  },
});
export const demoRows = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("apps")
      .withIndex("by_owner", (q) => q.eq("ownerId", demoOwnerId))
      .collect();
    return rows.map((r) => r.payload);
  },
});
export const saveDemo = action({
  args: { app: v.any(), expectedRevision: v.union(v.number(), v.null()), serverKey: v.string() },
  handler: async (ctx, args): Promise<any> => {
    requireDemo(args.serverKey);
    if (args.app.ownerId !== demoOwnerId || JSON.stringify(args.app).length > 700000)
      throw new Error("Invalid demo ownership or size");
    return ctx.runMutation(internal.platform.commit, {
      app: args.app,
      expectedRevision: args.expectedRevision,
      ownerId: demoOwnerId,
    });
  },
});

// Registry writes are system actions, never model tools. Payloads contain credential names only.
export const plugins = action({
  args: { serverKey: v.string(), demo: v.boolean(), payload: v.optional(v.string()) },
  handler: async (ctx, args): Promise<string[]> => {
    const expected = process.env.PLATFORM_INTERNAL_KEY;
    if (!expected || expected.length < 32 || args.serverKey !== expected)
      throw new Error("Trusted platform server required");
    let ownerId: string;
    if (args.demo) {
      requireDemo(args.serverKey);
      ownerId = demoOwnerId;
    } else {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Authentication required");
      ownerId = identity.subject;
    }
    if (args.payload) {
      if (args.payload.length > 300000) throw new Error("Plugin is too large");
      const payload: unknown = JSON.parse(args.payload);
      if (
        !payload ||
        typeof payload !== "object" ||
        !("ownerId" in payload) ||
        payload.ownerId !== ownerId ||
        !("id" in payload) ||
        typeof payload.id !== "string"
      )
        throw new Error("Invalid plugin ownership");
      await ctx.runMutation(internal.platform.commitPlugin, {
        ownerId,
        pluginId: payload.id,
        payload: args.payload,
      });
    }
    return ctx.runQuery(internal.platform.pluginRows, { ownerId });
  },
});
export const pluginRows = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, { ownerId }) => {
    const rows = await ctx.db
      .query("plugins")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .collect();
    return rows.map((row) => row.payload);
  },
});
export const commitPlugin = internalMutation({
  args: { ownerId: v.string(), pluginId: v.string(), payload: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("plugins")
      .withIndex("by_plugin", (q) => q.eq("pluginId", args.pluginId))
      .unique();
    if (existing) throw new Error("Plugin already exists");
    await ctx.db.insert("plugins", args);
  },
});
