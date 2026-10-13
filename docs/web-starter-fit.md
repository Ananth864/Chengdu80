# Selected starter fit

Reviewed 13 October 2026. The user selected [adityamiskin/web-starter](https://github.com/adityamiskin/web-starter) as the base and allowed necessary additions. This review inspected upstream commit `fde7b8351c8179adf47a5d30efb72313430a87ba` in an unchanged temporary clone. It authored no product software and ran no authenticated external services or deployment.

The root agent separately cloned the same commit into `platform/`, ran the documented initializer with `convex workos ai`, and reported successful build and format/lint/type checks. See [starter-baseline.md](starter-baseline.md) for that execution evidence. The default selection means the alternative Drizzle/PlanetScale and Clerk branches described upstream are not part of the selected stack.

## Conclusion

The selected starter is a suitable base for the platform's web UI, identity integration, metadata backend, and streamed AI conversation. The application builder, imported-source path, verification pipeline, private app authorization, per-app storage contract, and generated-app runtime are additions. Passing its existing build does not demonstrate those platform capabilities.

Keep this starter as the host application. Treat any VibeSDK code as a reference or separately integrated component for generation/workspace/runtime functions. The older proposal to make a VibeSDK fork the base is superseded by the user's starter selection.

## Exact selected stack

| Part                      | Selected baseline and evidence                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Workspace/package manager | Bun monorepo, `bun@1.3.13`, `apps/*` and `packages/*`; root `package.json`                                                    |
| UI/application            | React `^19.2.7`, TanStack Start `^1.167.41`, React Router `^1.168.22`, React Query `^5.104.1`; root and web package manifests |
| Styling                   | Tailwind CSS `^4.3.1`, shared shadcn/ui primitives using Base UI; `packages/ui`, `AGENTS.md`                                  |
| Backend                   | Convex `^1.42.0`, functions/schema/auth configuration in `packages/backend/convex`                                            |
| Identity                  | WorkOS AuthKit TanStack React Start `^0.11.0`, request middleware, routes, session access, JWT bridge to Convex               |
| AI                        | TanStack AI `^0.39.1`, AI React `^0.16.3`, OpenAI adapter `^0.15.10`; authenticated SSE chat route                            |
| Deployment                | TanStack Start Worker plus static assets on Cloudflare through Alchemy `2.0.0-beta.81`; `apps/web/alchemy.run.ts`             |
| Tooling                   | TypeScript `^6`, Vite+ `1.0.0-rc.1`, Vite alias to its core package; root scripts/config                                      |

These are manifest constraints at the inspected commit. Exact resolved dependency versions come from its lockfile. [Pinned root manifest](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/package.json), [web manifest](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/package.json).

## Reusable baseline

The starter supplies file routes, SSR/router/query integration, shared UI components, protected dashboard and AI pages, WorkOS sign-in/sign-up/callback/sign-out, Convex identity queries and user synchronization, environment validation, and a Cloudflare web deployment definition. These are practical building blocks for the product shell. [Pinned source tree](https://github.com/adityamiskin/web-starter/tree/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/src).

It has an `AuthIntegration` interface, so shared code can use `auth` without directly coupling every route to WorkOS. The session returned to web code includes viewer ID, email, name, and access token. Convex independently validates the token rather than relying only on client state. [Auth types](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/src/integrations/auth/types.ts), [WorkOS integration](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/src/integrations/auth/workos.tsx), [Convex auth configuration](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/packages/backend/convex/auth.config.ts).

The AI page already streams messages and offers a stop control. This is conversation UI, not a code builder. Its endpoint accepts messages and supplies a general SaaS-assistant prompt. It has no file tools, source workspace, verifier, preview, application persistence, or publish action. [AI page](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/src/routes/ai.tsx), [chat route](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/src/routes/api/ai/chat.tsx).

## Fit against decisions recorded in the interview

| Requirement                                              | Existing support                                                  | Addition required                                                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Guided type/protocol with free code generation           | TypeScript, routes, UI components, schema tools                   | Explicit app contract, typed financial APIs, prompts/docs, workspace/file tools and a generation loop                                 |
| Internal builder and external source imports             | Authenticated chat UI and host app                                | Both inputs produce the same source workspace and pass the same checks; no accepting a URL as a substitute for hosted source          |
| Platform supplies models                                 | Server-side AI key binding                                        | Approved Qwen/model endpoint configuration and server-side policy; no user model BYOK is needed for the accepted scope                |
| Shared data within each app                              | Convex database infrastructure                                    | App-owned data records or app storage and consistent app identity across sessions/users within that account                           |
| Apps private to individual/business account              | Authenticated viewer, optional organization/role claims in Convex | Account model, membership checks, app ownership and access checks on source, previews, data, builds and runtime requests              |
| Mandatory verification, including custom financial logic | Format/lint/type/build checks for host code                       | Source/contract/security checks, runtime checks, financial fixtures or independent comparison, recorded evidence and failure messages |
| Iterative app changes                                    | UI conversation and database baseline                             | Versioned source, preview revision, repeat verification, user acceptance, preserved app data and controlled activation                |
| Existing app remains until update passes and is accepted | No revision lifecycle                                             | Separate candidate revision, active revision pointer and data-compatible promotion/rollback policy                                    |
| Provider portability for financial data                  | No financial data adapters                                        | Canonical schema and capability interfaces, provider adapters, coverage/freshness/provenance/error mapping                            |
| Monitoring deferred                                      | No product monitoring pipeline                                    | Keep build/verification diagnostics needed for delivery; continuous app monitoring remains outside the current commitment             |
| VPN/proxy acceptable                                     | No network guarantee                                              | Authenticated WorkOS/Convex/model and deployed runtime checks over the accepted access path                                           |

This table identifies work required by the user's decisions. It does not claim those additions already exist.

## Identity is present; app privacy is not implemented

The Convex schema has only a `users` table. Its fields include `authSubject`, optional email/name/organization ID/role, and `lastSeenAt`. The `viewer.current` query and `viewer.sync` mutation require `ctx.auth.getUserIdentity()`. Synchronization finds the user by their authenticated subject. [Schema](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/packages/backend/convex/schema.ts), [viewer functions](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/packages/backend/convex/viewer.ts).

Organization and role claims appear on the dashboard, but the repository does not have account memberships, application ownership, app-scoped queries, or policy enforcement for generated apps. The text saying it is ready for multi-tenant flows describes a starting point. A claim on a user record cannot by itself enforce app privacy.

The host page check and Convex authentication check are both useful. Generated-app requests still need authorization at the serving endpoint. A secret or unguessable preview URL is not an account membership check. The runtime must receive only app-scoped data capabilities and must not receive the platform's administrative credentials.

The alternative Drizzle branch demonstrates a private API Worker behind a service binding, overwriting `x-viewer-id` from the authenticated session. It also has a sample `getUser` endpoint without authentication middleware. This is evidence about the unselected option, not a security finding against the selected Convex app. Do not copy sample endpoint exposure into private financial data APIs. [Alternative API contract](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/packages/api/src/contract.ts), [forwarder](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/src/integrations/api.server.ts).

## The model adapter can support the required direction

The current chat route hard-codes `openaiText("gpt-4.1-mini")` and checks `OPENAI_API_KEY`. It offers no model/base URL settings. Those defaults do not satisfy the competition's Qwen requirement.

I inspected the published npm source for `@tanstack/ai-openai` version `0.15.10`, the lower version in the starter's dependency constraint. Its ordinary `openaiText` adapter delegates to OpenAI's **Responses API**. Changing the model name and base URL alone therefore does not establish compatibility with an endpoint that implements only Chat Completions.

The same package exports `openaiCompatible` and `openaiCompatibleText`. They accept an arbitrary model string, explicit `baseURL` and `apiKey`, and default to the Chat Completions API. They can optionally select Responses. This supplies an existing adapter path to investigate for the platform-managed approved Qwen endpoint; adding a separate AI library is not inherently necessary. Evidence: `src/adapters/text.ts`, `src/compatible/index.ts`, and `src/compatible/adapter.ts` in the [published 0.15.10 package](https://www.npmjs.com/package/@tanstack/ai-openai/v/0.15.10).

Endpoint compatibility, streaming events, tool calls, error handling, and approved model identity remain runtime checks. The generic compatible adapter is code support, not proof that a particular Qwen account or competition gateway works.

## Generated applications need a separate runtime boundary

The starter deploys one ordinary TanStack Start web application as a Cloudflare Worker with static assets. It does not dynamically load uploaded source or create isolated app executions. Its Vite build is the host app build. Executing generated source in the host's trusted server process or giving it the host's Convex/model credentials would bypass the required privacy boundary. [Deployment definition](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/alchemy.run.ts).

The needed extension has four parts: source/workspace storage, a reproducible build/import contract, an isolated generated-app runtime with explicit capabilities, and authorized routing to each accepted revision. Custom financial calculations must run inside that constrained environment and pass verification. Both internal generation and imported source must use it.

Cloudflare is already the deployment target for the selected host. A separate generated-app execution component on Cloudflare can fit that choice without replacing the host starter. The exact Worker Loader/Dynamic Worker, Durable Object/SQLite, asset routing and outbound-access design still needs a working deployment proof and account entitlement checks. See [cloudflare-china-feasibility.md](cloudflare-china-feasibility.md) for current network evidence and its limits.

## VibeSDK reference value

The [pinned ThinkAgent](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/worker/agents/think/ThinkAgent.ts) illustrates a bounded model/tool loop, workspace file operations, commit and deploy tools, and browser-console capture. It takes model name, API key and base URL through configuration and uses Chat Completions. Its workspace points to a companion SpaceDO. Those are useful reference patterns for the additions above.

The [pinned setup guide](https://raw.githubusercontent.com/cloudflare/vibesdk/9da158d/docs/setup.md) describes SpaceDO, a Worker Loader binding, and Dynamic Workers for previews. Its wider production/setup flow also creates Cloudflare resources and assumes several paid services. Reusing an isolated runtime/workspace component could avoid rebuilding that machinery, but extraction and integration remain work. Do not run its broad setup merely to add one component to this starter.

Its existing frontend, authentication, gallery and user model are not required as replacements for the user-selected host. Its default models and provider configuration are not the competition's approved Qwen configuration. Browser console capture can support runtime verification; it does not validate custom financial logic. These are possible references or components, not a decision to import the whole platform.

## Bootstrap, runtime and source constraints

- `bun run init` is a one-shot destructive selector for the template checkout. It removes unused files/dependencies/env/docs, deletes its own scripts, installs dependencies, and formats files. Root has already used it for the selected defaults. [Initializer](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/scripts/init.ts).
- Alchemy reads required bindings from `apps/web/.env` or deployment environment. The default web stack binds the Convex URL, WorkOS credentials/cookie password/redirect URI, and model key. API keys use redacted config, while client `VITE_` values are public. Keep generated apps away from those host credentials.
- Convex setup and WorkOS setup are external configuration, not satisfied by a host build. Convex needs the WorkOS client ID for JWT validation. Auth callback/sign-in URLs and CORS origin must match the deployed host. The cookie password must be generated securely. [Environment example](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/.env.example).
- The client environment validator rejects the placeholder Convex hostname. `SKIP_ENV_VALIDATION` exists, but bypassing validation is not evidence of a usable backend. [Validator](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/packages/env/src/web.ts).
- The CSRF middleware explicitly filters to `serverFn` handlers. New upload/import/publish routes need their own origin/session/authorization review. The existing chat route validates a session but does not show input size/rate limits or schema validation. [Start middleware](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/src/start.ts), [chat route](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/apps/web/src/routes/api/ai/chat.tsx).
- Alchemy is pinned to a beta and Vite+ to a release candidate. Preserve the verified lockfile; upgrading during the build needs a reason and another baseline check.
- The upstream `AGENTS.md` says to retain Cloudflare/Alchemy, Bun, the selected backend/auth/tooling, and shared UI primitives; secrets must not enter `VITE_` variables. It requires codegen/check and build for routing/auth/deployment/config changes. User-authorized necessary additions can extend generated-app capabilities without replacing these base choices. [Agent instructions](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/AGENTS.md).

## License evidence

No root `LICENSE` file or root license declaration was present in the inspected tree. `packages/backend/package.json` alone declares `ISC`. That is insufficient evidence of an explicit license covering the complete starter. The public GitHub repository does not establish the full reuse terms by itself. Confirm the author's intended repository license and any organizer attribution requirements before final distribution. This is a source gap, not a conclusion that reuse is forbidden. [Backend manifest](https://github.com/adityamiskin/web-starter/blob/fde7b8351c8179adf47a5d30efb72313430a87ba/packages/backend/package.json).

## Remaining proof

Baseline build/check has passed according to the root agent. Still unproven: deployed WorkOS login, Convex queries with valid JWTs, private app ownership enforcement, approved Qwen streaming/tools, source import/build/preview, isolated runtime and per-app data, rejection of invalid financial logic, and accepting an update while preserving the active application and its data. Use the accepted VPN/proxy path for these checks. Public home-page reachability and an unauthenticated market-data demo do not establish this chain.
