import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { platformRoot } from "./environment";

// Flips MODEL_PROVIDER in the workspace .env, which the launchers load with
// top precedence. Values for both providers can stay in the file; only the
// selection line changes. Never touches or prints other values.
const provider = process.argv[2];
if (provider !== "glm" && provider !== "openai") {
  console.error("Usage: bun scripts/set-provider.ts <glm|openai>");
  process.exit(1);
}
const destination = resolve(platformRoot, "../.env");
if (!existsSync(destination)) {
  writeFileSync(destination, `MODEL_PROVIDER=${provider}\n`, { mode: 0o600 });
} else {
  const content = readFileSync(destination, "utf8");
  const updated = /^MODEL_PROVIDER=.*$/m.test(content)
    ? content.replace(/^MODEL_PROVIDER=.*$/m, `MODEL_PROVIDER=${provider}`)
    : `${content.replace(/\n*$/, "\n")}MODEL_PROVIDER=${provider}\n`;
  writeFileSync(destination, updated);
}
console.log(
  `MODEL_PROVIDER=${provider} set in the workspace .env.` +
    (provider === "openai"
      ? " OPENAI_API_KEY must be set and api.openai.com reachable from this network."
      : " GLM_API_KEY, GLM_MODEL and GLM_BASE_URL must be set."),
);
console.log("Start or restart with: bun run dev:local (or bun run dev:glm / dev:openai).");
