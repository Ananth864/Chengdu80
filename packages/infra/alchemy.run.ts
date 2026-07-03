import alchemy from "alchemy";
import { TanStackStart } from "alchemy/cloudflare";
import { config } from "dotenv";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

const app = await alchemy("web-starter");

export const web = await TanStackStart("web", {
  cwd: "../../apps/web",
  bindings: {
    VITE_CONVEX_URL: alchemy.env.VITE_CONVEX_URL!,
    WORKOS_CLIENT_ID: alchemy.env.WORKOS_CLIENT_ID!,
    WORKOS_API_KEY: alchemy.secret(process.env.WORKOS_API_KEY),
    WORKOS_REDIRECT_URI: alchemy.env.WORKOS_REDIRECT_URI!,
    WORKOS_COOKIE_PASSWORD: alchemy.secret(process.env.WORKOS_COOKIE_PASSWORD),
    OPENAI_API_KEY: alchemy.secret(process.env.OPENAI_API_KEY),
  },
});

console.log(`Web    -> ${web.url}`);

await app.finalize();
