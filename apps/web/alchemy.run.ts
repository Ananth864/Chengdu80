// @if drizzle
// import Api from "@web-starter/api/worker";
// @endif
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
// @if drizzle
// import * as Drizzle from "alchemy/Drizzle";
// import * as Planetscale from "alchemy/Planetscale";
// @endif
// @if convex|auth|ai
import * as Config from "effect/Config";
// @endif
import * as Effect from "effect/Effect";
// @if drizzle
// import * as Layer from "effect/Layer";
// @endif

// The TanStack Start app as a Worker plus static assets. Each `env` entry becomes a
// Worker binding: `Config` values are read from `.env` (or the shell) at deploy time.
export class Website extends Cloudflare.Website.Vite<Website>()("Web", {
  env: {
    // @if convex
    VITE_CONVEX_URL: Config.String("VITE_CONVEX_URL"),
    // @endif
    // @if drizzle
    // API: Api,
    // @endif
    // @if workos
    WORKOS_CLIENT_ID: Config.String("WORKOS_CLIENT_ID"),
    WORKOS_API_KEY: Config.Redacted("WORKOS_API_KEY"),
    WORKOS_REDIRECT_URI: Config.String("WORKOS_REDIRECT_URI"),
    WORKOS_COOKIE_PASSWORD: Config.Redacted("WORKOS_COOKIE_PASSWORD"),
    // @endif
    // @if clerk
    // CLERK_PUBLISHABLE_KEY: Config.String("CLERK_PUBLISHABLE_KEY"),
    // CLERK_SECRET_KEY: Config.Redacted("CLERK_SECRET_KEY"),
    // @endif
    // @if ai
    OPENAI_API_KEY: Config.Redacted("OPENAI_API_KEY"),
    // @endif
  },
}) {}

export type WebsiteEnv = Cloudflare.InferEnv<typeof Website>;

export default Alchemy.Stack(
  "web-starter",
  {
    // @if !drizzle
    providers: Cloudflare.providers(),
    // @endif
    // @if drizzle
    // providers: Layer.mergeAll(Cloudflare.providers(), Drizzle.providers(), Planetscale.providers()),
    // @endif
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const website = yield* Website;
    return { url: website.url.as<string>() };
  }),
);
