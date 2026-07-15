# web-starter

Bun-first production starter generated from Better-T-Stack and customized for TanStack Start, Convex, WorkOS AuthKit, Cloudflare/Alchemy, Tailwind, shadcn/ui, Oxlint/Oxfmt, and TanStack AI.

## Stack

- `apps/web`: TanStack Start app deployed to Cloudflare Workers
- `packages/backend`: Convex functions, schema, and WorkOS JWT auth config
- `packages/infra`: Alchemy deployment for Cloudflare
- `packages/ui`: shared shadcn/ui primitives and Tailwind tokens
- `packages/env`: client environment validation

## Setup

Install dependencies:

```bash
bun install
```

Create the Convex project and generate Convex env:

```bash
bun run dev:setup
```

Copy `packages/backend/.env.local` values into `apps/web/.env`, then set:

```bash
WORKOS_CLIENT_ID=client_...
WORKOS_API_KEY=sk_test_...
WORKOS_REDIRECT_URI=http://localhost:3001/api/auth/callback
WORKOS_COOKIE_PASSWORD=<32+ chars>
OPENAI_API_KEY=sk_... # only needed for /ai
```

Generate a cookie password:

```bash
openssl rand -base64 32
```

Set WorkOS vars in Convex:

```bash
cd packages/backend
bunx convex env set WORKOS_CLIENT_ID client_...
bunx convex env set WORKOS_API_KEY sk_test_...
```

In WorkOS dashboard redirects, configure:

- Redirect URI: `http://localhost:3001/api/auth/callback`
- Sign-in endpoint: `http://localhost:3001/api/auth/sign-in`
- CORS origin: `http://localhost:3001`

Run locally:

```bash
bun run dev
```

Open `http://localhost:3001`.

## Scripts

- `bun run dev`: run web and Convex dev servers
- `bun run dev:web`: run only TanStack Start
- `bun run dev:server`: run only Convex
- `bun run dev:setup`: configure Convex
- `bun run codegen`: regenerate Convex generated files
- `bun run check-types`: TypeScript checks
- `bun run check`: Oxlint and Oxfmt
- `bun run build`: production build
- `bun run deploy`: deploy web to Cloudflare through Alchemy
- `bun run destroy`: destroy Alchemy-managed Cloudflare resources

## Auth

WorkOS middleware lives in `apps/web/src/start.ts`. Auth routes are:

- `/api/auth/sign-in`
- `/api/auth/sign-up`
- `/api/auth/callback`
- `/sign-out`

Convex validates WorkOS JWTs in `packages/backend/convex/auth.config.ts`.

## AI

The `/ai` page and `/api/ai/chat` route use TanStack AI with the OpenAI adapter. Remove `@tanstack/ai`, `@tanstack/ai-openai`, `@tanstack/ai-react`, and those routes if the product does not need AI.

## Payments

Billing uses Dodo Payments through the Convex component. See `docs/payments.md` for provider details.

Set Convex environment variables:

```bash
cd packages/backend
bunx convex env set DODO_PAYMENTS_API_KEY ...
bunx convex env set DODO_PAYMENTS_ENVIRONMENT test_mode
bunx convex env set DODO_PAYMENTS_WEBHOOK_SECRET ...
```

Billing functions live in `packages/backend/convex/billing.ts`; webhook handling lives in `packages/backend/convex/http.ts`.

## Deploy

Alchemy deploys the TanStack Start app to Cloudflare Workers:

```bash
bun run deploy
```

`packages/infra/alchemy.run.ts` binds WorkOS and AI secrets into the Worker. For production, set the same environment variables in the deploy shell or CI secret store before running deploy.

## Agent Notes

Read `AGENTS.md` before making code changes. It captures the project constraints and required verification flow.
