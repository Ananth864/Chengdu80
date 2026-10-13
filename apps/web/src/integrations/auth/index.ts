import { auth as workosAuth } from "./workos";
import { localAuth } from "./local";
export const auth =
  import.meta.env.VITE_LOCAL_MODE === "1" || import.meta.env.VITE_DEMO_MODE === "1"
    ? localAuth
    : workosAuth;
export type { Viewer } from "./types";
