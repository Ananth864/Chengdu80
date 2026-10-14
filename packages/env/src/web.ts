import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const convexUrlSchema = (exampleHost: string) =>
  z.url().refine((url) => new URL(url).hostname !== exampleHost, {
    message: `Replace the ${exampleHost} placeholder before running the app`,
  });

const runtimeEnv = (import.meta as any).env ?? {};
export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    VITE_CONVEX_URL: convexUrlSchema("example.convex.cloud").optional(),
  },
  runtimeEnv: {
    ...runtimeEnv,
    VITE_CONVEX_URL: runtimeEnv.VITE_LOCAL_MODE === "1" ? undefined : runtimeEnv.VITE_CONVEX_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
