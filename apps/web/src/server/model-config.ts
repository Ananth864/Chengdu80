import type { Settings } from "./settings";

// Credentials stay server-side. GLM is the user-selected prototype provider.
export function modelConfiguration(config: Settings) {
  const provider = config.MODEL_PROVIDER || "glm";
  if (provider !== "glm" && provider !== "openai") throw new Error("Unsupported MODEL_PROVIDER");
  return provider === "glm"
    ? {
        provider,
        model: config.GLM_MODEL || "GLM-5.3",
        apiKey: config.GLM_API_KEY,
        baseURL: config.GLM_BASE_URL || "https://ai.gitee.com/v1",
      }
    : {
        provider,
        model: config.OPENAI_MODEL || "gpt-6-luna",
        apiKey: config.OPENAI_API_KEY,
        baseURL: config.OPENAI_BASE_URL || "https://api.openai.com/v1",
      };
}
