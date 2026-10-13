import { spawn } from "node:child_process";
import { configuredEnvironment, platformRoot } from "./environment";
const env = configuredEnvironment();
delete env.CD80_LOCAL_MODE;
delete env.VITE_LOCAL_MODE;
env.CD80_DEMO_MODE ??= "1";
env.VITE_DEMO_MODE = env.CD80_DEMO_MODE;
const identityKeys =
  env.CD80_DEMO_MODE === "1"
    ? []
    : ["WORKOS_CLIENT_ID", "WORKOS_API_KEY", "WORKOS_REDIRECT_URI", "WORKOS_COOKIE_PASSWORD"];
const missing = ["VITE_CONVEX_URL", ...identityKeys, "PLATFORM_INTERNAL_KEY"].filter(
  (key) => !env[key],
);
if (missing.length) throw new Error("Hosted configuration is incomplete: " + missing.join(", "));
console.log(
  env.CD80_DEMO_MODE === "1"
    ? "Hosted shared demo: login deferred; apps and data are shared by all visitors."
    : "Hosted account mode: WorkOS required.",
);
const task = process.argv[2] === "dev" ? "dev" : "deploy";
const child = spawn(
  "bunx",
  ["--no-install", "vp", "run", "--filter", "web", task, ...(task === "deploy" ? ["--yes"] : [])],
  {
    cwd: platformRoot,
    env,
    stdio: "inherit",
  },
);
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
child.on("exit", (code) => process.exit(code ?? 1));
