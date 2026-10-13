import { spawn } from "node:child_process";
import { configuredEnvironment, platformRoot } from "./environment";
const env = configuredEnvironment();
const task = process.argv[2] === "dev" ? "dev" : "deploy";
if (task === "deploy") {
  env.VITE_CONVEX_URL = process.env.VITE_CONVEX_URL || "http://127.0.0.1:3210";
}
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
if (missing.length)
  throw new Error("Self-hosted configuration is incomplete: " + missing.join(", "));
console.log(
  env.CD80_DEMO_MODE === "1"
    ? "Self-hosted shared demo: login deferred; apps and data are shared by all visitors."
    : "Self-hosted account mode: WorkOS required.",
);
// `dev` runs the Node build directly for a quick self-hosted smoke test;
// `deploy` builds and (re)starts the docker-compose stack (app + self-hosted Convex).
const child =
  task === "dev"
    ? spawn("bunx", ["--no-install", "vp", "run", "--filter", "web", "dev"], {
        cwd: platformRoot,
        env,
        stdio: "inherit",
      })
    : spawn("docker", ["compose", "--env-file", ".env.selfhost", "up", "-d", "--build"], {
        cwd: platformRoot,
        env,
        stdio: "inherit",
      });
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
child.on("exit", (code) => process.exit(code ?? 1));
