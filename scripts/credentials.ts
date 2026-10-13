import { modelConfiguration } from "../apps/web/src/server/model-config";
import { configuredEnvironment } from "./environment";
const env = configuredEnvironment();
for (const [purpose, keys] of Object.entries({
  "Live local AI":
    modelConfiguration(env).provider === "glm"
      ? ["GLM_API_KEY", "GLM_BASE_URL"]
      : ["OPENAI_API_KEY"],
  "Hosted database": ["VITE_CONVEX_URL", "CONVEX_DEPLOYMENT"],
  ...(env.CD80_DEMO_MODE === "0"
    ? {
        "Hosted identity": [
          "WORKOS_CLIENT_ID",
          "WORKOS_API_KEY",
          "WORKOS_REDIRECT_URI",
          "WORKOS_COOKIE_PASSWORD",
        ],
      }
    : {}),
  "Trusted persistence": ["PLATFORM_INTERNAL_KEY"],
  "Optional Tushare": ["TUSHARE_TOKEN"],
})) {
  const missing = keys.filter((key) => !env[key]);
  console.log(
    `${purpose}: ${missing.length ? "missing " + missing.join(", ") : "configured (not live-verified)"}`,
  );
}
console.log(`Model: ${modelConfiguration(env).model}. Credential values are never printed.`);

if (env.CD80_DEMO_MODE !== "0")
  console.log(
    "Hosted mode: shared demo; WorkOS credentials deferred. Set CD80_DEMO_MODE=1 in Convex too.",
  );
