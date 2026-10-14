import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { configuredEnvironment, platformRoot } from "./environment";

// Run the whole platform in Linux on Mac; generated projects still run inside
// the narrower Bubblewrap sandbox. Never execute generated Node code on the host.
const env = configuredEnvironment();
const image = env.CD80_ISOLATED_IMAGE ?? "chengdu80-financial-local";
const port = env.CD80_PORT ?? "3001";
if (!/^\d{2,5}$/.test(port)) throw new Error("Invalid local port");
function run(args: string[], options: { capture?: boolean } = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("docker", args, {
      cwd: platformRoot,
      stdio: options.capture ? "ignore" : "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Docker exited with status ${code}`)),
    );
  });
}
await run(["info"], { capture: true });
const baseImage = env.CD80_DOCKER_BUILD_BASE;
if (!process.argv.includes("--no-build"))
  await run([
    "build",
    ...(baseImage
      ? ["--build-arg", `NODE_IMAGE=${baseImage}`, "--build-arg", `BUN_IMAGE=${baseImage}`]
      : []),
    "--build-arg",
    "VITE_LOCAL_MODE=1",
    "--build-arg",
    "VITE_DEMO_MODE=1",
    "-t",
    image,
    "-f",
    "apps/web/Dockerfile",
    ".",
  ]);
const dataDirectory = resolve(env.CD80_DATA_DIR ?? resolve(platformRoot, ".local"));
await mkdir(dataDirectory, { recursive: true, mode: 0o700 });
const temporary = await mkdtemp(join(platformRoot, ".local/isolated-env-"));
const file = join(temporary, "server.env");
const allowed = Object.entries(env).filter(
  ([key, value]) =>
    value &&
    /^(?:CD80_|GLM_|OPENAI_|TUSHARE_|MODEL_PROVIDER$|PLATFORM_INTERNAL_KEY$|NODE_USE_ENV_PROXY$|HTTPS?_PROXY$|NO_PROXY$)/.test(
      key,
    ),
);
const serverEnv = {
  ...Object.fromEntries(allowed),
  CD80_LOCAL_MODE: "1",
  CD80_DATA_DIR: "/app/.local",
  CD80_PORT: "3001",
  HOST: "0.0.0.0",
};
if (Object.values(serverEnv).some((value) => /[\r\n]/.test(value)))
  throw new Error("Docker environment values cannot contain newlines");
await writeFile(
  file,
  Object.entries(serverEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n"),
  { mode: 0o600 },
);
const name = env.CD80_ISOLATED_CONTAINER_NAME ?? `chengdu80-local-${port}`;
console.log(`Chengdu80 · http://127.0.0.1:${port} · Linux isolated app builds`);
const child = spawn(
  "docker",
  [
    "run",
    "--rm",
    "--init",
    "--name",
    name,
    "--cap-add",
    "SYS_ADMIN",
    "--security-opt",
    "apparmor=unconfined",
    "--security-opt",
    "systempaths=unconfined",
    "--security-opt",
    "seccomp=unconfined",
    "--env-file",
    file,
    "-p",
    `127.0.0.1:${port}:3001`,
    "-v",
    `${dataDirectory}:/app/.local`,
    image,
  ],
  { cwd: platformRoot, stdio: "inherit" },
);
const stop = () => {
  void run(["stop", "--time", "5", name], { capture: true }).catch(() => {});
};
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
try {
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Local isolated platform exited with status ${code}`)),
    );
  });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
