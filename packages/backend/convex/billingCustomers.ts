import { v } from "convex/values";

import { internalQuery, mutation } from "./_generated/server";

export const getByAuthSubject = internalQuery({
  args: {
    authSubject: v.string(),
  },
  handler: async (ctx, { authSubject }) => {
    return await ctx.db
      .query("billingCustomers")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", authSubject))
      .unique();
  },
});

export const saveDodoCustomerId = mutation({
  args: {
    dodoCustomerId: v.string(),
  },
  handler: async (ctx, { dodoCustomerId }) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("billingCustomers")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
      .unique();

    const patch = {
      authSubject: identity.subject,
      dodoCustomerId,
      email: identity.email,
      name: identity.name,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("billingCustomers", patch);
  },
});
