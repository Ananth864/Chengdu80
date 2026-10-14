# AGENTS.md

## Stack

Bun monorepo:

- TanStack Start in `apps/web`, built as a standalone Node server and deployed via Docker/docker-compose (`apps/web/Dockerfile`, `docker-compose.yml`) — no Cloudflare/Alchemy
- Tailwind CSS v4 and shadcn/ui primitives in `packages/ui`
- Vite+ (`vp`) for dev, build, lint, format, type checks, and task running. Lint and format config lives in the root `vite.config.ts`
- Convex backend in `packages/backend/convex` (Convex Cloud or a self-hosted Convex backend container, see `docker-compose.yml`)
- WorkOS AuthKit for auth (bypassed entirely in demo mode; see Auth Notes)
- TanStack AI chat route in `apps/web/src/routes/api/ai/chat.tsx`

## Required Rules

- Use Bun commands: `bun install`, `bun run dev`, `bun run build`, `bun run check`.
- Do not introduce another backend, auth provider, formatter, or linter.
- Use shadcn primitives from `@web-starter/ui/components/*` before adding custom UI.
- This shadcn setup uses Base UI. Use exported class helpers like `buttonVariants` for link-styled buttons instead of Radix `asChild`.
- Deployment target is a self-hosted Node server (Docker/docker-compose, e.g. Coolify or k3s); no Cloudflare/Alchemy dependency remains.
- Read configuration via `settings()` in `apps/web/src/server/settings.ts` (plain `process.env`), not provider-specific bindings.
- Do not put secrets in public `VITE_` variables.
- Keep Convex functions in `packages/backend/convex` and import APIs from `@web-starter/backend/convex/_generated/api`.
- Run `bun run codegen` after adding or renaming Convex functions.
- New generated apps use `apps/web/starter/project`. Keep financial SDK, calculation/schema libraries, shadcn source and build configuration protected. Presentation components, routes and styles are builder-owned; they must use the approved SDK rather than reimplement financial algorithms. New plans are live-only; fixture records are retained only for historical-release compatibility and isolated tests. Regenerate `app-project-template.ts` with `bun run starter:sync` after starter changes.
- Generated Node/Bash/SSR code must run only in the Linux Bubblewrap sandbox. On macOS use the Docker launcher; never add a host execution fallback.
- Retain per-turn capability, dependency, company and permission checks and server-key-protected writes. The builder assesses semantic feasibility; there is no separate intent-classifier model. Require prior-turn proposals and explicit Preview activation. Markdown policies do not replace executable gates.
- Keep the existing gallery, retained discussion, chat-only deletion and studio UI.

## Specification Integrity

- Scaffold and sample metadata are not user requirements. New conversations must start with unconfigured inputs and outputs, not portfolio sample fields. A transport protocol does not imply that its sample product fits the user's goal.
- Before deploying a new application, record an application-specific specification through `set_specification`: name, purpose, actual inputs, requested outputs and constraints. Map only the financial capabilities needed by the request; preserve independent feasibility and activation gates.
- Give each output its own `outputDetails` entry keyed by its label, describing content, source requirements and availability limitations. Never reuse the original prompt or overall purpose as every output's description. Do not invent details, metrics or features merely to populate the workflow.
- Keep workflow metadata aligned with the displayed release: active release specification and build record belong together; blocked attempts must not replace the active workflow. Draft outputs describe intended behavior, not verified execution or live-data availability.
- Test new-workspace defaults, missing-specification deployment rejection, app-specific output labels and distinct output details. Include a non-portfolio request to catch inherited portfolio metadata. Local model fixtures prove wiring and enforcement, not live-model semantic correctness.
- Root `AGENTS.md` instructs repository coding agents, not the application LLM. Mirror relevant generation rules in `apps/web/src/server/protocols/builder.md` and the dashboard skill; keep tool descriptions and executable validation consistent. Markdown alone is not enforcement.
- Building requires explicit Workflow-stage approval recorded server-side for the exact proposal. A later chat reply alone is not approval. Changed plan fields require new approval; Preview activation remains a separate user action.
- UI and CLI workflow approval use the same server action and automatically start one bounded builder turn. Preserve approval receipt deduplication, persisted progress and separate Preview activation; do not require a second chat message or claim durable crash recovery for the in-process task.

## Environment

Local env lives in `apps/web/.env` (examples in `apps/web/.env.example`). `settings()` reads env vars directly from `process.env` at runtime — no provider-specific binding layer.

Prototype launchers also read `platform/.env` and the workspace `../.env`, with non-empty workspace values taking precedence. Never print secret values. `setup:env` only creates a missing workspace file. Use `dev:hosted` / `deploy:hosted` to load workspace credentials and build/run the self-hosted `docker-compose.yml` stack.

`dev:local` uses an explicit single-owner loopback demo and a file persistence adapter. It is not another production backend or authentication provider. Self-hosted mode continues using Convex (Convex Cloud, or the self-hosted Convex backend container in `docker-compose.yml`). The user explicitly deferred login on 2026-10-13: self-hosted launchers default to `CD80_DEMO_MODE=1` and `VITE_DEMO_MODE=1`, using a shared demo workspace and server-key-protected Convex actions. WorkOS remains available when demo mode is explicitly disabled. Do not claim account privacy in demo mode. Do not claim cloud isolation based on local tests or ship `VITE_LOCAL_MODE=1` as the authenticated product.

Convex deployment env is set with `bunx convex env set` from `packages/backend`; see `packages/backend/.env.example`.

## Auth Notes

The active provider implements `AuthIntegration` (`apps/web/src/integrations/auth/types.ts`). Use `auth` from `apps/web/src/integrations/auth` instead of provider SDKs in shared code. Its middleware is registered in `apps/web/src/start.ts`, and must stay in Start request middleware.

Protected pages read `context.viewer` in `beforeLoad` and redirect to `auth.signInHref(location.pathname)` when it is null (see `routes/dashboard.tsx`).

WorkOS routes: `/api/auth/sign-in`, `/api/auth/sign-up`, `/api/auth/callback`, `/sign-out`.

Convex validates auth JWTs in `packages/backend/convex/auth.config.ts`. Use `ctx.auth.getUserIdentity()` in Convex functions and prefer explicit auth checks over client state.

## Verification

Before handing off meaningful changes, run:

```bash
bun run codegen
bun run check
```

Run `bun run build` when touching routing, auth, deployment, or Vite config.

Run the relevant `test:prototype`, `test:flow`, and `test:model-contract` scripts after meaningful changes to runtime, release lifecycle or model wiring. The model contract suite uses a local transport fixture and does not prove live inference. If Convex codegen needs missing deployment credentials, record that exact limitation instead of claiming it passed.
