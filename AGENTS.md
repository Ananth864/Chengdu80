# AGENTS.md

## Stack

This repo is a Bun-first Better-T-Stack monorepo customized for:

- TanStack Start in `apps/web`
- Convex backend in `packages/backend/convex`
- WorkOS AuthKit for auth
- Cloudflare Workers deployment through Alchemy in `packages/infra`
- Tailwind CSS v4 and shadcn/ui primitives in `packages/ui`
- Oxlint and Oxfmt for checks
- Optional TanStack AI route in `apps/web/src/routes/api/ai/chat.tsx`

## Required Rules

- Use Bun commands. Prefer `bun install`, `bun run dev`, `bun run build`, and `bun run check`.
- Do not introduce another backend, auth provider, deployment target, formatter, or linter.
- Keep Convex functions inside `packages/backend/convex`.
- Import Convex APIs from `@web-starter/backend/convex/_generated/api`.
- Run `bun run codegen` after adding or renaming Convex functions.
- Use WorkOS server helpers from `@workos/authkit-tanstack-react-start`.
- Do not put WorkOS API keys or cookie passwords in public `VITE_` variables.
- Use shadcn primitives from `@web-starter/ui/components/*` before adding custom UI.
- This shadcn setup uses Base UI. Use exported class helpers like `buttonVariants` for link-styled buttons instead of Radix `asChild`.
- Keep deployment on Cloudflare through Alchemy. Do not add Vercel, Netlify, or Docker deployment unless the product direction changes.

## Environment

Local web env lives in `apps/web/.env`; examples are in `apps/web/.env.example`.

Required for local app runtime:

- `VITE_CONVEX_URL`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_REDIRECT_URI`
- `WORKOS_COOKIE_PASSWORD`

Required in Convex deployment:

- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`

Required only for the AI demo route:

- `OPENAI_API_KEY`

## Auth Notes

WorkOS middleware is configured in `apps/web/src/start.ts`. It must stay in Start request middleware, not TanStack Router config.

Auth routes:

- `/api/auth/sign-in`
- `/api/auth/sign-up`
- `/api/auth/callback`
- `/sign-out`

Protected pages should use `getAuth()` in route loaders and redirect unauthenticated users to `/api/auth/sign-in?returnPathname=...`.

## Convex Notes

Convex validates WorkOS JWTs through `packages/backend/convex/auth.config.ts`.

Use `ctx.auth.getUserIdentity()` in Convex functions. Prefer explicit auth checks over trusting client state.

## Payments

Billing uses Dodo Payments through the Convex component:

- Dodo Payments Convex component: `@dodopayments/convex`
- `packages/backend/convex/convex.config.ts` installs the Dodo Payments component.
- `packages/backend/convex/dodo.ts` configures the Dodo client.
- `packages/backend/convex/billing.ts` exposes `createCheckout` and `createCustomerPortal` actions.
- `packages/backend/convex/http.ts` exposes the `/dodo/webhook` Convex HTTP route.
- Save the real Dodo customer ID with `billingCustomers.saveDodoCustomerId` before using the customer portal.

Do not add another billing abstraction unless replacing Dodo Payments is explicitly requested.

## Verification

Before handing off meaningful changes, run:

```bash
bun run codegen
bun run check-types
bun run check
```

Run `bun run build` when touching routing, auth, deployment, or Vite config.
