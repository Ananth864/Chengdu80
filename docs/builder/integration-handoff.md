# Persistence and React builder integration

14 October 2026. PR #3 and #4 are adopted selectively. Their unrestricted agent and obsolete financial API examples are excluded.

## Builder contract

The existing agent receives communication.md, builder.md, application-llm.md and selected capability protocols as system instructions. prepare_build creates the hashed, versioned record. Instructions explain behavior; server schemas, independent intent classification, write/Bash/deploy gates and runtime checks enforce declared scope. No skill can replace these gates.

New workspaces contain the actual apps/web/starter/project files. The builder reads read_starter_reference and may edit src/App.tsx or add presentation components. The platform protects the SDK, financial modules, shadcn source, router and package/Vite/TypeScript configuration. Permissions and src/lib/build-context.ts come from the record. The default theme is mandatory unless that record specifies an override. After changing platform starter source, run bun run starter:sync and bun run fix.

Confirmed matching, daily cards and watchlists use fixed server rules. Historical metrics, sourced targets, research/news and expert assessment procedures remain unavailable. All demos are synthetic. Wind and the company table are internal product inputs. Generated-app research and LLM calls remain disabled.

## Persistence

Convex threads hold chat metadata; messages hold ordered message payloads. App documents retain releases, financial records, saved data and workspace source. Read-only subscriptions feed the current studio. The existing server agent performs writes through server-key-protected endpoints. The public lifecycle mutations from PR #3 were deliberately excluded.

Old embedded conversations remain readable and migrate on the next save. After deploying the schema/functions, the server-key-protected migrateChatStorage action can eagerly migrate the shared demo in batches. It never erases saved apps. Account conversations normalize on save. Back up the database before an operational migration. This integration has not run migration against existing user data.

Periodic message checkpoints retain active-turn guards. Deleting chat requires ownership, current revision and a stopped reply. A completed app, accepted contract, watchlist and gallery entry survive. Discussion and unsuccessful workspace attempts are removed. An unfinished app is deleted. Deleted chats cannot reappear merely because their app receives a data write.

## Run locally

On macOS, bun run dev:local now launches the whole app inside Docker because generated TanStack code requires Linux namespaces. Docker must be running. Native Linux uses the same Bubblewrap runtime. Use bun run dev:isolated --no-build to reuse a built local image. CD80_PORT changes the loopback port. Existing local data stays in .local or CD80_DATA_DIR.

The outer Docker container needs SYS_ADMIN and unconfined seccomp, AppArmor and system paths to allow nested namespaces. The inner generated-code sandbox drops all capabilities, clears the environment and mounts only the project and read-only dependencies. It has a private network and bounded time, output, CPU, file size, processes and address space. Node uses a 512 MB heap and disables WebAssembly trap-handler reservations so Vite+ fits the address-space limit. Deployments that disallow nested namespaces need a separate Linux build service rather than running generated code directly in the platform process.

The local image defaults to chengdu80-financial-local. CD80_ISOLATED_IMAGE overrides it. CD80_DOCKER_BUILD_BASE is a development-only override for a compatible Node/Bun image when the normal registry is unavailable. Credentials are passed through a temporary private environment file, never through public VITE values or generated code.

Existing HTML/JS accepted apps retain their renderer. CD80_APP_FORMAT=legacy exists for compatibility tests only. New apps default to the React starter. Old releases without financial records can retain a static layout but cannot access privileged capabilities.

## Verification

Run bun run codegen, bun run check and VITE_LOCAL_MODE=1 bun run build. Run test:chat-storage, test:conversation, test:build-policy, test:company-capabilities and test:financial-starter. Run the existing test:prototype, test:flow, test:model-contract and agent fixture suites.

scripts/test-financial-project.ts runs inside the Linux test image with an isolated CD80_DATA_DIR. It verifies real sandbox boundaries, platform-owned compilation/type checks, SSR, signed previews, company RPC/watchlists and failed-update retention. Browser checks use synthetic fixtures and a local model transport; they do not verify live inference or Wind access.

## Remaining product inputs

- The actual company CSV and Wind product, license, fields and credentials.
- Expert risk questionnaire/scoring and confirmed financial metric definitions.
- Approved research/news and target-price sources, procedures and explanation library.
- Domain acceptance cases and production runtime capacity/isolation review.

The gallery, retained conversations, chat deletion and current studio UI stay in place. Automatic activation and working links follow passing verification. There is no new mandatory submission or technical approval screen.
