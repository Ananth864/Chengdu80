import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import { auth } from "./integrations/auth";

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, ...auth.middleware],
}));
