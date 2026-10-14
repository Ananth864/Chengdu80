import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { configuredEnvironment, platformRoot } from "./environment";

// Fast local iteration loop: the documented legacy host launcher (Vite dev
// server with hot reload) on its own port, writing to a disposable snapshot of
// the demo workspace. The Docker stack on 3001 stays authoritative; generated
// app builds/executions still require the Docker launcher.
const dataDir = resolve(platformRoot, ".local-fast");
if (!existsSync(dataDir)) {
  cpSync(resolve(platformRoot, ".local"), dataDir, { recursive: true });
  console.log("Snapshotted the demo workspace to .local-fast (disposable; delete anytime).");
}
const child = spawn("bun", ["scripts/dev-local.ts"], {
  cwd: platformRoot,
  env: {
    ...configuredEnvironment(),
    CD80_APP_FORMAT: "legacy",
    CD80_PORT: "3002",
    CD80_DATA_DIR: dataDir,
  },
  stdio: "inherit",
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("exit", (code) => process.exit(code ?? 1));
