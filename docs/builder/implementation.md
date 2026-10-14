# Protocol controlled builder first implementation

14 October 2026. The latest UX agreement supersedes the earlier mandatory submission and deployment-review sequence. PR #3 persistence and PR #4 starter are adapted into the guarded agent rather than merged wholesale.

## Current flow

Describe a financial app → clarify material ambiguity → summarize intent → prepare an internal capability build record → edit source → verify → activate automatically → show the working link. Questions alone do not build. There is no mandatory technical review, submit screen or deployment approval. Failed edits retain the accepted app.

## Implemented

- Versioned Markdown communication, builder and generated-LLM policies plus selected research/history/matching protocols are bundled into server instructions.
- `prepare_build` validates declared business capability IDs, expands package dependencies and resolves requested companies against the platform-managed table. Every modifying turn needs its own feasible build record.
- Records persist requirement summary, capabilities, dependencies, company identity/table version, protocol hashes, official provider, theme and turn/revision. Releases reference the record and verified artifact hash.
- A fresh independent intent check uses the latest request, last feasible goal and previous user discussion as untrusted context. It excludes builder output/tool traffic and blocked requests. Declared capabilities must match its result and dependency closure. Any failed preparation revokes this turn's editing permission. Records are hashed; mutations invalidate them. Repeated refusals do not become a new accepted goal.
- File tools and deployment require the current turn's feasible record. Generic plugin tools are not exposed in this scoped fixture flow. Legacy direct create/update/import/seed/provider endpoints are temporarily blocked until they accept equivalent contracts.
- New apps use the actual React/TanStack Start starter with installed shadcn Base UI source and a default theme. The protected root renders selected financial modules. SDK, modules, router and build configuration are immutable. Permissions and build context come from the feasible contract. Legacy HTML/JS apps retain their existing transport. Both formats require synthetic labels and a platform-owned notice.
- The UI retains conversation/tool activity/preview behavior. Suggestions describe scoped fixture demos. Platform data status replaces end-user data-API setup controls.
- Requirements and Workflow workspace tabs support the pre-build review. The agent records clarification questions, assumptions, missing inputs and the analysis period through record_requirements using only answers the user actually gave; users answer and edit them in the Requirements tab (save-design action) alongside the draft specification, with the latest build record shown as pre-build status. The Workflow tab renders a conceptual data/capability/output graph derived from that record. Neither view gates deployment; prepare_build remains the feasibility gate.
- Fixed company-capabilities-v1 modules implement risk-to-size/industry filtering, stable China-day batches, yes/no decisions, watchlists and explicit metric selection. Their RPC permissions follow the selected contract capabilities. Server-owned data rejects generic writes and daily batches use revision retries for concurrent visits. Risk selection is synthetic; no expert risk scoring or financial values are invented.
- A separate Built apps gallery lists working releases, searches names/purposes, opens their links and returns to chat. Thumbnails show static source layouts with no scripts, API calls or data writes. Dynamic content may appear only in the full preview.
- Convex stores thread metadata and ordered messages separately from app/release data. Read-only subscriptions update the existing studio; all writes still go through server-key-protected functions and the guarded agent. Legacy embedded conversations remain readable and normalize on save. Conversation persistence preserves user and assistant text when tool traffic grows. Bulky file/tool bodies are abbreviated, not whole discussion turns. Plain-text replies checkpoint once per second. A single-owner local restart can resume an interrupted reply immediately; hosted concurrency guards remain in place.
- Chat options include Delete chat with a confirmation dialog. Deletion removes an unfinished workspace; a completed app and its saved data stay in Built apps while its conversation is cleared. Reopening that app starts fresh chat history. Revision and ownership checks protect deletion, and running replies must be stopped first.
- The studio uses neutral light/dark tokens with a restrained plum accent, a Chengdu80 wordmark and larger framed app previews. shadcn primitives supply gallery controls/empty states, menus, dialogs, search and responsive Chat/Preview tabs. Below 1280px, chat and preview have separate full-width panels. Browser Back/Forward restores chat/gallery selection; recent chats sort by activity. Explicit loading/retry states and operation errors are available throughout the shell. Specification shows the confirmed financial build record rather than legacy transport rules.

## Platform managed data

The company table and Tushare configuration belong to the product team. End users do not supply either. Live company identity comes from the platform's Tushare token: `stock_basic` with `exchange: SSE` and `list_status: L`, filtered server-side to Shanghai Stock Exchange Class A share codes (600/601/603/605/688/689 `.SH`). The result is cached in memory for 24 hours and reused for up to 7 days when a refresh fails. Build records pin the table version (`sse-a:<hash>:<fetch date>`). Set `TUSHARE_TOKEN` on the server; no company CSV file is used. The earlier `CD80_COMPANY_TABLE_PATH` file option was removed.

Team CSV import (`importCompanyCsv`) remains a library utility with the same validation: Company Name, Ticker Symbol, Industry, A-share Market Capitalisation (RMB), Size Category; small/medium/large labels; invalid rows and duplicate tickers reject the table. It no longer backs the live lookup.

The explicit synthetic table uses DEMO001, DEMO002 and DEMO003. It is separate from the live company table and is never a live fallback. A fixture build requires the user's demo intent. Tushare is the official data provider; `market.prices` with provider `tushare` loads daily closes for SSE Class A codes only, paged in date ranges to work around the provider's row limit. Scoped live builds stay blocked until the platform token is set and verified; fixtures remain the demo path.

## What this first change does not implement

Live Tushare market-data wiring in scoped builds, historical metric calculations, sourced target prices and approved assessment/research/explanation content remain pending. Fixed company matching, cards and watchlists are implemented. React/shadcn assembly is integrated. Research and historical modules show unavailable outputs until approved inputs arrive. The old numeric scaffold remains compatibility infrastructure for existing releases.

Markdown instructions guide the agent. Schemas and tool gates enforce declared scope, dependency and readiness rules. New React builds reuse protected financial UI and server-owned matching/card rules. Independent checks compile the pinned starter, run type checks and inspect its financial SSR output. These checks do not prove the meaning of arbitrary added presentation code; it can still misrepresent information. Domain acceptance tests and approved data adapters remain necessary.

The generated-application LLM protocol is included for the builder to follow, but no live generated-app LLM tool is enabled yet. Activate only with the approved evidence library and corresponding server-side restrictions.

## Verification

Run `bun run test:conversation` for verbatim discussion persistence and chat deletion semantics. Run `bun run test:company-capabilities` for the fixed company rules. Run `bun run test:build-policy` for dependency, identity, readiness and source-permission gates. Run `VITE_LOCAL_MODE=1 bun run build`, then `bun scripts/test-agent.ts` for the chat/tool/browser flow. If repository Playwright has no downloaded browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an available compatible browser. Transport fixtures never verify live inference or Tushare.

The scoped API flow suite checks repeated attempts through retired endpoints. The prototype suite checks sandbox isolation and numerical fixtures. The agent browser suite exercises the new conversation flow and repeated attempts to mislabel unrelated requests. These are fixture tests, not a guarantee that a live model can never misclassify free-form intent. Reusable capability modules and independent business-output checks remain necessary.

## Runtime and persistence integration

Linux Bubblewrap runs generated build, Bash and preview code with no parent credentials, host filesystem or external network. Generated code cannot replace package scripts to fake verification. Preview URLs bind owner, origin, release and source hash. Every privileged RPC requires an unchanged verified financial contract, including legacy releases. On macOS the whole app launches inside Docker; see `bun run dev:local` in the repository README for operating commands, persistence migration and protected files.
