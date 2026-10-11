# web-starter

Bun monorepo: TanStack Start, Tailwind, shadcn/ui, and Vite+, deployed to Cloudflare Workers through Alchemy v2.

<!-- @if template -->

## Pick your stack

The repo ships every option. `bun run init` asks for one per group and deletes the rest (files, deps, env vars, and the matching parts of these docs), then deletes itself.

| Group   | Options                                                                               |
| ------- | ------------------------------------------------------------------------------------- |
| backend | `convex` (default), `drizzle` (Effect v4 + Drizzle, PlanetScale via Hyperdrive), none |
| auth    | `workos` (default), `clerk`, none                                                     |
| ai      | `ai` (TanStack AI chat route), none                                                   |

```bash
bun install
bun run init                    # interactive
bun run init drizzle clerk ai   # or pass options; `core` keeps none
```

Before init, the template runs as the default pick. Code for other options is commented out and gets uncommented by init.

<!-- @endif -->

## Layout

- `apps/web`: TanStack Start app. `alchemy.run.ts` is the Cloudflare stack.
<!-- @if convex -->
- `packages/backend`: Convex functions, schema, and auth config
  <!-- @endif -->
  <!-- @if drizzle -->
- `packages/api`: Effect-native API Worker, Drizzle schema, PlanetScale and Hyperdrive resources
<!-- @endif -->
- `packages/ui`: shadcn/ui primitives and Tailwind tokens
- `packages/env`: client env validation

## Setup

```bash
bun install
cp apps/web/.env.example apps/web/.env
bunx alchemy profile edit   # Cloudflare credentials for dev and deploy
```

Alchemy loads `apps/web/.env`. Every var bound in `apps/web/alchemy.run.ts` must be set.

<!-- @if convex -->

### Convex

```bash
bun run dev:setup
```

Copy `VITE_CONVEX_URL` from `packages/backend/.env.local` into `apps/web/.env`.

<!-- @endif -->
<!-- @if drizzle -->

### Postgres (PlanetScale + Hyperdrive)

Add PlanetScale credentials to your Alchemy profile (`bunx alchemy profile edit`). The first `bun run dev` or `bun run deploy` creates the database, then one branch per stage (`dev_$USER` for dev, `live_$USER` for deploy by default).

Cost: the database is a paid `PS_10` cluster, and every stage adds a branch. Run `bun run destroy` on stages you no longer need.

Edit tables in `packages/api/src/schema.ts`. Alchemy generates migration SQL into `packages/api/migrations` and applies it on the next dev or deploy run.

<!-- @endif -->
<!-- @if workos -->

### WorkOS

Set `WORKOS_*` in `apps/web/.env`. Generate the cookie password with `openssl rand -base64 32`.

In the WorkOS dashboard:

- Redirect URI: `http://localhost:3001/api/auth/callback`
- Sign-in endpoint: `http://localhost:3001/api/auth/sign-in`
- CORS origin: `http://localhost:3001`
<!-- @if convex -->

Set the client ID in Convex for JWT validation:

```bash
cd packages/backend
bunx convex env set WORKOS_CLIENT_ID client_...
```

<!-- @endif -->
<!-- @endif -->
<!-- @if clerk -->

### Clerk

Set `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` in `apps/web/.env`.

In the Clerk dashboard:

- Paths: sign-in `/auth/sign-in`, sign-up `/auth/sign-up`
- Sessions > Customize session token: `{ "email": "{{user.primary_email_address}}", "name": "{{user.full_name}}" }`. The app reads the viewer from these claims.
<!-- @if convex -->
- Enable the Convex integration, then set its issuer in Convex:

```bash
cd packages/backend
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
```

<!-- @endif -->
<!-- @endif -->
<!-- @if ai -->

### AI

Set `OPENAI_API_KEY`. The `/ai` page streams from `/api/ai/chat` through TanStack AI.

<!-- @endif -->

## Run

```bash
bun run dev
```

Open `http://localhost:3001`.

## Scripts

- `bun run dev`: run every dev server
- `bun run dev:web`: run only the web app (`alchemy dev`)
<!-- @if convex -->
- `bun run dev:server`: run only Convex
- `bun run dev:setup`: configure Convex
- `bun run codegen`: regenerate Convex files
<!-- @endif -->
- `bun run check`: format, lint, and type check (`vp check`)
- `bun run fix`: `check` with fixes applied
- `bun run build`: production build
- `bun run deploy`: deploy to Cloudflare
- `bun run destroy`: destroy the stage's Cloudflare resources

## Deploy

```bash
bun run deploy
```

`apps/web/alchemy.run.ts` binds env vars into the Worker at deploy time, so set them in the deploy shell or CI secret store. Alchemy v2 is in beta; expect breaking changes on upgrade.

## Agent notes

Read `AGENTS.md` before making code changes.
