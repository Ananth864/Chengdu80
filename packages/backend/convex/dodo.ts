import { DodoPayments, type DodoPaymentsClientConfig } from "@dodopayments/convex";

import { components, internal } from "./_generated/api";

export const dodo = new DodoPayments(components.dodopayments, {
  identify: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      return null;
    }

    const customer = await ctx.runQuery(internal.billingCustomers.getByAuthSubject, {
      authSubject: identity.subject,
    });

    if (!customer?.dodoCustomerId) {
      return null;
    }

    return {
      dodoCustomerId: customer.dodoCustomerId,
    };
  },
  apiKey: process.env.DODO_PAYMENTS_API_KEY ?? "",
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode") as "test_mode" | "live_mode",
} satisfies DodoPaymentsClientConfig);

export const { checkout, customerPortal } = dodo.api();
