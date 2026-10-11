import { defineSchema } from "convex/server";
// @if auth
import { defineTable } from "convex/server";
import { v } from "convex/values";
// @endif

export default defineSchema({
  // @if auth
  users: defineTable({
    authSubject: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    organizationId: v.optional(v.string()),
    role: v.optional(v.string()),
    lastSeenAt: v.number(),
  })
    .index("by_auth_subject", ["authSubject"])
    .index("by_email", ["email"]),
  // @endif
});
