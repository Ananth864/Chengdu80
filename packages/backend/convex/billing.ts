import type { CheckoutSessionPayload } from "@dodopayments/convex";
import { v } from "convex/values";

import { action } from "./_generated/server";
import { checkout, customerPortal } from "./dodo";

export const createCheckout = action({
  args: {
    payload: v.any(),
  },
  handler: async (ctx, { payload }) => {
    return await checkout(ctx, {
      payload: payload as CheckoutSessionPayload,
    });
  },
});

export const createCustomerPortal = action({
  args: {
    send_email: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await customerPortal(ctx, args);
  },
});
