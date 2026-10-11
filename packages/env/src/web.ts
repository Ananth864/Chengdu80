import { createEnv } from "@t3-oss/env-core";
// @if convex
import { z } from "zod";
// @endif

// @if convex
const convexUrlSchema = (exampleHost: string) =>
  z.url().refine((url) => new URL(url).hostname !== exampleHost, {
    message: `Replace the ${exampleHost} placeholder before running the app`,
  });
// @endif

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    // @if convex
    VITE_CONVEX_URL: convexUrlSchema("example.convex.cloud"),
    // @endif
  },
  runtimeEnv: (import.meta as any).env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
