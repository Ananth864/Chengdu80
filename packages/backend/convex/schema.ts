import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
  billingCustomers: defineTable({
    authSubject: v.string(),
    dodoCustomerId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_auth_subject", ["authSubject"])
    .index("by_dodo_customer_id", ["dodoCustomerId"]),
});
