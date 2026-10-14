import { modelConfiguration } from "../apps/web/src/server/model-config";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { configuredEnvironment, platformRoot as root } from "./environment";

const env = configuredEnvironment();
Object.assign(env, {
  CD80_LOCAL_MODE: "1",
  VITE_LOCAL_MODE: "1",
  VITE_CONVEX_URL: "",
  CONVEX_SERVER_URL: "",
});
if (process.platform === "darwin" && env.CD80_APP_FORMAT !== "legacy") {
  const child = spawn("bun", ["scripts/dev-isolated.ts", ...process.argv.slice(2)], {
    cwd: root,
    env,
    stdio: "inherit",
  });
  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));
  await new Promise<void>((resolve) =>
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
      resolve();
    }),
  );
  process.exit(process.exitCode ?? 0);
}
const dataDir = env.CD80_DATA_DIR || resolve(root, ".local");
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
Object.assign(env, {
  CD80_LOCAL_MODE: "1",
  VITE_LOCAL_MODE: "1",
  CD80_DATA_DIR: dataDir,
  GLM_MODEL: env.GLM_MODEL || "GLM-5.3",
});
const port = env.CD80_PORT || "3001";
console.log(`Chengdu80 local prototype · http://127.0.0.1:${port} · Local single-owner mode`);
console.log(
  `Main model: ${modelConfiguration(env).model}. Model key: ${modelConfiguration(env).apiKey ? "configured" : "not configured; sample builder available"}.`,
);
const child = spawn("bunx", ["--no-install", "vp", "dev", "--host", "127.0.0.1", "--port", port], {
  cwd: resolve(root, "apps/web"),
  env,
  stdio: "inherit",
});
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
child.on("exit", (code) => process.exit(code ?? 1));
