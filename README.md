# Chengdu80 prototype

A financial application studio using the selected [web-starter](https://github.com/adityamiskin/web-starter): Bun, TanStack Start, React, Tailwind 4, shadcn, Convex, WorkOS, TanStack AI, and Cloudflare through Alchemy 2.

The prototype is deployed at [Chengdu80 studio](https://chengdu80-web-live-ananthacharya-mb7epyiddt4jehqm.chengdu80-1610dcd1.workers.dev). It supports specification review, financial examples, source-code import, isolated calculations, shared app data, and reviewed updates. Login is deferred: all visitors share the same demo workspace. The labelled example builder does not generate arbitrary custom changes.

## Run locally

```bash
bun install --frozen-lockfile
bun run dev:local
```

Open http://127.0.0.1:3001. Local mode has one demo owner and persists apps in `.local/apps.json`. The server binds to loopback; this is not hosted authentication.

The launcher reads `apps/web/.env`, `platform/.env`, then the workspace `../.env`. Non-empty workspace values take precedence. Secrets stay server-side.

```bash
bun run setup:env      # Creates ../.env only when absent, with local secrets
bun run credentials    # Reports variable names, never values
```

Set `GLM_API_KEY` in `../.env` and restart for live specification creation, source generation, iterative changes, and app explanations. `GLM_MODEL=GLM-5.3` and `GLM_BASE_URL=https://ai.gitee.com/v1` select the current Gitee AI provider. TanStack AI uses compatible Chat Completions with reasoning enabled and schema-validated JSON. Set `MODEL_PROVIDER=openai` to use the optional OpenAI Responses fallback.

For Node 24+ using an HTTP proxy, set `NODE_USE_ENV_PROXY=1`, `HTTPS_PROXY`, `HTTP_PROXY`, and `NO_PROXY=127.0.0.1,localhost` before starting. Use your proxy's current URL. These affect this process, not system settings. Connectivity failures are reported in the UI.

## Try the product

1. Enter an English financial question, prepare its specification, and edit the scope before confirming.
2. Build with the model or labelled example builder. Review the app and Checks tab; accept the release.
3. Edit shared inputs from the accepted app. Preview storage is read-only.
4. Request a change. The accepted release keeps running while its update is checked. Accepting retains shared data.
5. Import a compatible bundle from `examples/` or another coding tool. Choose New application for a separate app; import while an app is selected for an update.
6. For an accepted Strategy app, open Connections and load real daily prices. Local mode uses the narrow Alpha Vantage public demo for `600104.SHH`; hosted mode uses configured Tushare. Source, dates and limits accompany the data.

Portfolio, screening and strategy protocols are provisional feasibility examples. Final application categories remain open. Additional compatible apps can be imported and run.

## Source and runtime

Public docs: `/docs` and `/api/docs`. A bundle contains a manifest and exactly `index.html`, `app.js`, `calculations.js`, `style.css`; alternatively select these files plus `cd80.json` together. Limit: 250 KB. Arbitrary server frameworks, package installation and remote resources are outside this prototype's import format.

Browser apps run in opaque-origin iframes with restrictive CSP and a permission-checked `cd80.call()` bridge. `calculations.js` exports `analyze(input)` and runs in a separate workerd isolate locally, or Worker Loader when hosted, without secrets or network access. Hosted CPU is configured at 50 ms; local execution has a 3-second disposal timeout. Hosted tests confirmed denied egress, CPU-limit rejection and recovery. App sources, releases and shared data are in Convex; Alchemy uses a Durable Object for deployment state.

Releases require syntax, contract, permission, credential-pattern, numerical fixture, boundary, and applicable invalid-input checks. SHA-256 binds checks to exact source. Passing establishes the tested protocol contract, not certification of every additional calculation or the full specification. Review custom logic and rendered previews.

Nine capabilities cover normalized market data, reusable financial functions, custom calculations, shared storage and managed AI. New providers require adapters. `_provenance` is reserved; edited inputs are labelled user-entered. AI explanations use server-recomputed saved inputs.

## Verification

```bash
bun run test:prototype       # 12 financial, sandbox, hash and persistence checks
bun run test:flow            # 13 HTTP lifecycle checks on temporary data
bun run test:model-contract  # 3 mock Responses transport checks, not live inference
bun run test:glm-contract    # 10 mock GLM format/recovery/deadline checks
bun run test:query-stream    # 2 query-stream hydration regressions
bun run check
bun run build
bun run codegen             # Requires configured Convex deployment
bun run deploy:backend      # Loads workspace credentials; development deployments only
bun scripts/test-hosted.ts https://your-worker.workers.dev # 15 live checks; creates/updates one test app
```

Lifecycle tests do not modify workspace apps. `bun run examples` regenerates bundles, split source, schemas and protocol instructions. `examples/imported-risk-desk.cd80.json` demonstrates a fourth app with custom imported browser code.

## Hosted setup

See [credentials and hosting](docs/credentials-and-hosting.md), [implementation status](docs/implementation-status.md), and [assumptions](docs/assumptions.md). Use `bun run dev:hosted` or `bun run deploy:hosted` to load workspace credentials and remove local flags.

Hosted launchers default to a shared demo without login. Set `CD80_DEMO_MODE=1` and matching `PLATFORM_INTERNAL_KEY` in Convex, then generate bindings before deployment. All visitors share apps and data. WorkOS is deferred; the authenticated path remains available when demo mode is explicitly disabled. Dynamic Workers requires a paid Cloudflare account; Alchemy state bootstrap needs additional resource permissions.

The Convex development backend and Cloudflare application are deployed. Fifteen live hosted checks passed for numerical calculations, import, acceptance, updates, persistence, version separation, denied egress, CPU limits and recovery. The portfolio app rendered in the hosted browser. Storage-order hashing and returned-error handling bugs were fixed with regression checks. Live Gitee GLM clarification, explanations, source import, fresh generation and a built-in revision succeeded. The fresh model preview passes all eleven checks and is ready for review; the earlier model revision has been accepted. The latest source-generation trial timed out, so generation reliability remains unresolved. Broader requests and the model apps' rendered UI require further evaluation. Tushare remains unverified. This is a pre-competition prototype using the user's selected GLM-5.3 through Gitee AI. The competition's Qwen development requirement still applies during the competition.

The supplied token and Workers upgrade were sufficient. Deployment from China used the existing HTTP proxy. No GitLab connection or additional Cloudflare credentials are required for the deployed prototype.

## Layout

- `apps/web/src/components`: studio and isolated app frame
- `apps/web/src/lib`: contracts, protocols, calculations and examples
- `apps/web/src/server`: generation, providers, verification, runtime and persistence
- `packages/backend/convex`: hosted account-owned storage
- `apps/web/alchemy.run.ts`: Cloudflare stack and Worker Loader
- `scripts`: launchers, credential checks, exports and verification
- `patches`: persisted TanStack query-stream fix; `bun run test:query-stream` checks closed-stream hydration. GLM malformed JSON gets one format recovery within its existing deadline, checked by `bun run test:glm-contract`.
