# AGENTS.md

## Stack

Bun monorepo:

- TanStack Start in `apps/web`, deployed to Cloudflare Workers through Alchemy v2 (`apps/web/alchemy.run.ts`)
- Tailwind CSS v4 and shadcn/ui primitives in `packages/ui`
- Vite+ (`vp`) for dev, build, lint, format, type checks, and task running. Lint and format config lives in the root `vite.config.ts`
<!-- @if convex -->
- Convex backend in `packages/backend/convex`
  <!-- @endif -->
  <!-- @if drizzle -->
- Effect v4 API Worker with Drizzle on PlanetScale Postgres via Hyperdrive in `packages/api`
  <!-- @endif -->
  <!-- @if workos -->
- WorkOS AuthKit for auth
  <!-- @endif -->
  <!-- @if clerk -->
- Clerk for auth
  <!-- @endif -->
  <!-- @if ai -->
- TanStack AI chat route in `apps/web/src/routes/api/ai/chat.tsx`
<!-- @endif -->

<!-- @if template -->

## Template

Run `bun run init` to pick options (see `README.md`). Until then the repo holds every option: code for non-default options is commented out under `// @if <option>` markers, and `scripts/options.ts` lists each option's files and deps. When changing shared files, keep code for every option behind its marker.

<!-- @endif -->

## Required Rules

- Use Bun commands: `bun install`, `bun run dev`, `bun run build`, `bun run check`.
- Do not introduce another backend, auth provider, deployment target, formatter, or linter.
- Use shadcn primitives from `@web-starter/ui/components/*` before adding custom UI.
- This shadcn setup uses Base UI. Use exported class helpers like `buttonVariants` for link-styled buttons instead of Radix `asChild`.
- Keep deployment on Cloudflare through Alchemy.
- Worker bindings are declared in `apps/web/alchemy.run.ts`. Read them with `import { env } from "cloudflare:workers"` inside request handlers, not at module scope.
- Do not put secrets in public `VITE_` variables.
<!-- @if convex -->
- Keep Convex functions in `packages/backend/convex` and import APIs from `@web-starter/backend/convex/_generated/api`.
- Run `bun run codegen` after adding or renaming Convex functions.
  <!-- @endif -->
  <!-- @if drizzle -->
- Write app logic in `packages/api/src` as Effects that yield services like `Db` (`src/db.ts`), never platform APIs. `src/worker.ts` is the only Cloudflare-aware runtime code: it provides the implementations and exposes logic as RPC methods. New dependencies (storage, queues) follow the same shape: a `Context.Service` plus an implementation provided in the worker.
- The API contract is `packages/api/src/rpc.ts`: Effect RPC procedures whose payloads, results, and errors are schemas. Add a procedure there, implement it in `src/app.ts`, then call it from components with `apiQuery` / `apiMutation` (`apps/web/src/integrations/api.ts`). Errors stay typed end to end; map driver errors to contract errors in handlers.
- Edit tables in `packages/api/src/schema.ts`. Do not hand-write migrations; Alchemy generates them into `packages/api/migrations`.
  <!-- @if auth -->
- Protect a procedure with `.middleware(RequireViewer)` in `rpc.ts`, then yield `CurrentViewer` in its handler. The viewer comes from a header that `apps/web/src/routes/api/rpc.tsx` sets from the session; the API Worker has no public URL, so never expose it directly.
    <!-- @endif -->
  <!-- @endif -->

## Environment

Local env lives in `apps/web/.env` (examples in `apps/web/.env.example`). Alchemy loads it and binds each var listed in `alchemy.run.ts`.

<!-- @if convex -->

Convex deployment env is set with `bunx convex env set` from `packages/backend`; see `packages/backend/.env.example`.

<!-- @endif -->

<!-- @if auth -->

## Auth Notes

The active provider implements `AuthIntegration` (`apps/web/src/integrations/auth/types.ts`). Use `auth` from `apps/web/src/integrations/auth` instead of provider SDKs in shared code. Its middleware is registered in `apps/web/src/start.ts`, and must stay in Start request middleware.

Protected pages read `context.viewer` in `beforeLoad` and redirect to `auth.signInHref(location.pathname)` when it is null (see `routes/dashboard.tsx`).

<!-- @if workos -->

WorkOS routes: `/api/auth/sign-in`, `/api/auth/sign-up`, `/api/auth/callback`, `/sign-out`.

<!-- @endif -->
<!-- @if clerk -->

Clerk routes: `/auth/sign-in`, `/auth/sign-up`, `/auth/sign-out`. The viewer comes from custom session token claims (`email`, `name`).

<!-- @endif -->
<!-- @if convex -->

Convex validates auth JWTs in `packages/backend/convex/auth.config.ts`. Use `ctx.auth.getUserIdentity()` in Convex functions and prefer explicit auth checks over client state.

<!-- @endif -->

<!-- @endif -->

## Verification

Before handing off meaningful changes, run:

```bash
<!-- @if convex -->
bun run codegen
<!-- @endif -->
bun run check
```

Run `bun run build` when touching routing, auth, deployment, or Vite config.
