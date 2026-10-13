import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { configuredEnvironment, platformRoot } from "./environment";

const env = configuredEnvironment();
const task = process.argv[2] || "codegen";
if (!["codegen", "push"].includes(task)) throw new Error("Unknown Convex task");
if (!env.CONVEX_DEPLOY_KEY) throw new Error("Add CONVEX_DEPLOY_KEY to workspace .env");
if (task === "push" && !env.CONVEX_DEPLOY_KEY.startsWith("dev:"))
  throw new Error("Prototype backend push requires a development deploy key");
env.CD80_DEMO_MODE ??= "1";
console.log(
  task === "push" ? "Deploying the Convex development backend…" : "Generating Convex bindings…",
);
const child = spawn(
  "bunx",
  ["--no-install", "convex", ...(task === "push" ? ["dev", "--once"] : ["codegen"])],
  {
    cwd: resolve(platformRoot, "packages/backend"),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk;
});
child.stderr.on("data", (chunk) => {
  output += chunk;
});
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
child.on("exit", (code) => {
  for (const [key, value] of Object.entries(env))
    if (value && /KEY|TOKEN|PASSWORD|SECRET/.test(key))
      output = output.replaceAll(value, "[redacted]");
  console.log(output);
  process.exit(code ?? 1);
});
