import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

// The TanStack Start app as a Worker plus static assets. Each `env` entry becomes a
// Worker binding: `Config` values are read from `.env` (or the shell) at deploy time.
export class Website extends Cloudflare.Website.Vite<Website>()("Web", {
  env: {
    CD80_DEMO_MODE: Config.String("CD80_DEMO_MODE").pipe(Config.withDefault("0")),
    VITE_DEMO_MODE: Config.String("VITE_DEMO_MODE").pipe(Config.withDefault("0")),
    VITE_CONVEX_URL: Config.String("VITE_CONVEX_URL"),
    WORKOS_CLIENT_ID: Config.String("WORKOS_CLIENT_ID").pipe(Config.withDefault("")),
    WORKOS_API_KEY: Config.Redacted("WORKOS_API_KEY").pipe(Config.withDefault("")),
    WORKOS_REDIRECT_URI: Config.String("WORKOS_REDIRECT_URI").pipe(Config.withDefault("")),
    WORKOS_COOKIE_PASSWORD: Config.Redacted("WORKOS_COOKIE_PASSWORD").pipe(Config.withDefault("")),
    MODEL_PROVIDER: Config.String("MODEL_PROVIDER").pipe(Config.withDefault("glm")),
    GLM_API_KEY: Config.Redacted("GLM_API_KEY").pipe(Config.withDefault("")),
    GLM_MODEL: Config.String("GLM_MODEL").pipe(Config.withDefault("GLM-5.3")),
    GLM_BASE_URL: Config.String("GLM_BASE_URL").pipe(Config.withDefault("https://ai.gitee.com/v1")),
    OPENAI_API_KEY: Config.Redacted("OPENAI_API_KEY").pipe(Config.withDefault("")),
    OPENAI_MODEL: Config.String("OPENAI_MODEL").pipe(Config.withDefault("gpt-6-luna")),
    OPENAI_BASE_URL: Config.String("OPENAI_BASE_URL").pipe(
      Config.withDefault("https://api.openai.com/v1"),
    ),
    PLATFORM_INTERNAL_KEY: Config.Redacted("PLATFORM_INTERNAL_KEY"),
    TUSHARE_TOKEN: Config.Redacted("TUSHARE_TOKEN").pipe(Config.withDefault("")),
    APP_LOADER: Cloudflare.WorkerLoader("APP_LOADER"),
  },
}) {}

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "chengdu80",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const website = yield* Website;
    return { url: website.url.as<string>() };
  }),
);
