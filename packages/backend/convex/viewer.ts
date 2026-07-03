import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

async function requireIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Not authenticated");
  }

  return identity;
}

function getStringClaim(
  identity: Awaited<ReturnType<QueryCtx["auth"]["getUserIdentity"]>>,
  key: string,
) {
  const value = (identity as unknown as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

export const current = query({
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);

    return {
      subject: identity.subject,
      email: identity.email,
      name: identity.name,
      organizationId:
        getStringClaim(identity, "org_id") ?? getStringClaim(identity, "organizationId"),
      role: getStringClaim(identity, "role"),
    };
  },
});

export const sync = mutation({
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
      .unique();

    const patch = {
      authSubject: identity.subject,
      email: identity.email,
      name: identity.name,
      organizationId:
        getStringClaim(identity, "org_id") ?? getStringClaim(identity, "organizationId"),
      role: getStringClaim(identity, "role"),
      lastSeenAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("users", patch);
  },
});
