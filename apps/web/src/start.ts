import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// @if drizzle
// import { apiSerializationAdapter } from "./integrations/api";
// @endif
// @if auth
import { auth } from "./integrations/auth";
// @endif

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    csrfMiddleware,
    // @if auth
    ...auth.middleware,
    // @endif
  ],
  // @if drizzle
  // serializationAdapters: [apiSerializationAdapter],
  // @endif
}));
