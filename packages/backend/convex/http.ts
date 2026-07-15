import { createDodoWebhookHandler } from "@dodopayments/convex";
import { httpRouter } from "convex/server";

const http = httpRouter();

http.route({
  path: "/dodo/webhook",
  method: "POST",
  handler: createDodoWebhookHandler({
    onPaymentSucceeded: async (_ctx, payload) => {
      console.log("Dodo payment succeeded", payload.data);
    },
    onSubscriptionActive: async (_ctx, payload) => {
      console.log("Dodo subscription active", payload.data);
    },
  }),
});

export default http;
