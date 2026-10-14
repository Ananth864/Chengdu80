# PR compatibility review

14 October 2026. Review of the open PRs in `menyting-nus/chengdu-80` against the financial requirements implemented locally after `7685d8c`.

Neither PR should merge unchanged into the financial implementation. Both contain useful infrastructure; integrate it into the guarded financial builder rather than replacing that builder with the proposals.

## Reviewed versions

| PR                                                                                                           | Pinned head                                | Decision                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#3 — Use Convex for reactive chats and thread lifecycle](https://github.com/menyting-nus/chengdu-80/pull/3) | `9375503f1f035676512ac12b8f4289c4eb5ab236` | Adapt persistence and subscriptions first. Fix demo authorization and chat deletion; preserve financial records, gates and gallery.                                               |
| [#4 — Build apps as isolated TanStack Start projects](https://github.com/menyting-nus/chengdu-80/pull/4)     | `b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3` | Adopt its React/shadcn starter and isolation infrastructure after integrating #3. Replace the financial SDK, retain contract enforcement and strengthen independent verification. |

Both target `feature/self-hosted-stack` at `7685d8c7f37d2a4c4bc95c48e074d54c6aead44d`, despite the earlier conversational reference to main. PR #4 includes all three commits from #3; do not apply that persistence work twice.

The local committed head is `b8d6cf8`. Most financial restrictions and newer UX changes are still uncommitted or untracked, so the current working copy was the compatibility target. GitHub reports both PRs CLEAN against their older base, with no reported status checks or submitted reviews. That does not establish compatibility with our local financial work.

## Standards

1. **[P1] Public demo mutations bypass the trusted server.** In PR #3, `studioOwner()` grants unauthenticated callers the shared demo identity when `CD80_DEMO_MODE=1`. The new create/send/rename/stop/delete mutations use that identity without requiring `PLATFORM_INTERNAL_KEY`; #4 inherits them. A caller with the public Convex URL can mutate or delete the shared demo directly. Current `AGENTS.md:32` requires server-key-protected demo actions. Keep authenticated account mutations, but route demo mutations through the trusted server boundary. [Owner fallback](https://github.com/menyting-nus/chengdu-80/blob/9375503f1f035676512ac12b8f4289c4eb5ab236/packages/backend/convex/platform.ts#L98), [public deletion](https://github.com/menyting-nus/chengdu-80/blob/9375503f1f035676512ac12b8f4289c4eb5ab236/packages/backend/convex/platform.ts#L245).

2. **[P1] Generated applications choose their own verification commands.** PR #4 runs editable `package.json` scripts via `bun run build && bun run check`, then checks only for a server file and client directory. Scripts can create empty outputs and return success without compilation or meaningful checks. The verifier reports this as passed. Required checks must use platform-owned commands/configuration and independently validate artifacts and capability behavior. [Build runner](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/server/app-workspaces.ts#L490), [verifier](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/server/runtime.ts#L59).

3. **[P2] The new runner requires a Linux development environment.** PR #4 requires `bwrap`, `prlimit` and Linux namespaces for builds/previews. It correctly fails closed, but cannot replace our native Mac runner directly. Supply a Linux runner for local development and validate the actual Docker deployment's namespace permissions. Docker availability alone is insufficient. [Sandbox launch](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/server/app-workspaces.ts#L287).

Standards: 3 findings; worst issues are the demo authorization bypass and builder-controlled verification, both P1. No additional blocking style heuristic was identified.

## Spec

These are conflicts with requirements added after the proposals' shared baseline, rather than claims that the original infrastructure work was wrong.

1. **[P1] Deleting a chat deletes its completed application and data.** PR #3's `deleteThread` deletes messages, thread and the application row unconditionally; #4 inherits this. Our `implementation.md:21` explicitly retains completed apps/data in Built apps. Adapt deletion to clear discussion, retain completed releases/data, check revisions and reject running turns. An unfinished workspace may be removed. [Deletion](https://github.com/menyting-nus/chengdu-80/blob/9375503f1f035676512ac12b8f4289c4eb5ab236/packages/backend/convex/platform.ts#L245).

2. **[P1] Both agents lack our per-turn financial feasibility gates.** Write/edit/Bash/deploy paths use lifecycle checks without the current `prepare_build` contract. PR #4 explicitly supports general websites, arbitrary permission selection and generic plugin tools. Our `implementation.md:12–15` requires an independent intent check, feasible versioned record, exact dependency closure and authorization on every modifying turn. Port lifecycle/workspace changes into the current guarded agent. [PR #4 writes](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/server/agent.ts#L333), [permissions](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/server/agent.ts#L455), [instructions](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/server/agent.ts#L545).

3. **[P1] PR #4 exposes the superseded financial API.** Its SDK/RPC allows Tushare, portfolio/screening/backtests, plugins and explanations; it lacks our fixed company matching/cards API. Keep Wind as the official production target, enforce history plus sourced targets, and expose contract-approved platform modules for matching/cards/watchlists. Generic storage cannot overwrite their state. Approved evidence must gate generated-app explanations. [SDK](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/starter/project/src/lib/cd80.ts#L85), [RPC](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/server/platform.ts#L352).

4. **[P1] PR #4 verification/preview omit financial checks and the fixture notice.** The verifier checks old protocol identity, source shape, credentials and compilation, without our build-record/module validation. The new preview frame omits the platform-owned synthetic notice required by `implementation.md:16`. Bind activation and runtime permissions to the feasible record, selected modules and verified source hash; retain the notice outside generated source. [Verifier](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/server/runtime.ts#L24), [preview](https://github.com/menyting-nus/chengdu-80/blob/b6b5cce79dc4667f3ad2e5b05742da0f0a991fa3/apps/web/src/components/app-frame.tsx#L128).

Spec: 4 findings; worst issue is loss of repeated-turn feasibility enforcement, P1.

## What to reuse

| Part                           | Reuse                                                                                                         | Required adaptation                                                                                                                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #3 normalized threads/messages | Separate message persistence and reactive subscriptions; trusted streaming checkpoints; migration structure   | Preserve financial metadata and complete discussion. Keep model context compaction from silently dropping earlier requirements. Separate recent chats from retained built apps.                                     |
| #3 chat lifecycle              | Queued turn persistence, revision-aware saves, cross-tab updates                                              | Restore trusted demo authorization; preserve completed apps on chat deletion; maintain ownership, cancellation, revision and restart guards.                                                                        |
| #4 starter source              | Real TanStack Start/React/Tailwind/shadcn components, pinned libraries and library reference tooling          | Apply the contract's default theme/override, approved capability SDK and fixed financial UI modules. Do not port general-app permission instructions.                                                               |
| #4 isolation and preview       | Private workspaces, restricted namespaces, stripped environment, signed owner/release-scoped preview sessions | Linux runner and deployment validation; contract authorization before commands and source changes; platform-owned verification; financial restrictions on runtime RPCs and generated server routes.                 |
| #4 app metadata                | App-specific metadata and standalone publication structure                                                    | Respect release/contract readiness, fixture labeling and the existing gallery/navigation. Adapt existing gallery thumbnails to React artifacts; its static HTML thumbnail path cannot simply assume the new format. |

The React starter addresses a genuine pending requirement: generated apps must use actual shadcn components rather than recreate controls. It does not supply our agreed risk assessment, research, sourced targets or expert-approved metrics by itself. Decimal.js and charts are useful dependencies, not authorization to invent financial methods.

## Integration order

1. Commit the current financial implementation and UX work as the explicit integration baseline after its required checks. Create the integration branch from that baseline, not from `7685d8c`.
2. Integrate #3 persistence first. Preserve the current financial agent/tool gates and chat/gallery shell. Add migration coverage for build records, accepted releases, saved module state and pre-build conversations. Fix demo writes and chat-only deletion before accepting this layer.
3. Bring across #4 starter files, installed library references and typed React component infrastructure. Replace its finance SDK with the approved platform APIs; keep company identity/data configuration internal. Do not unblock old create/import/provider/plugin routes.
4. Integrate isolated framework builds and previews with a supported Linux runner. Guard Bash/file changes with the same current-turn contract, keep protected financial modules and checks platform-owned, and bind release activation/RPC authorization to the verified record and artifact.
5. Rebase/update #4 against the adapted persistence baseline. Preserve gallery, full discussion, deletion semantics and current visual direction instead of wholesale replacement with the proposal's studio UI.

Accept passing scoped builds automatically; keep the working link until a valid update passes. Do not reintroduce mandatory technical submission/review screens. The initial integrated flow may remain explicitly synthetic: this review does not require implementing unavailable Wind credentials, the actual internal CSV, news/target sources or expert content before merging infrastructure.

## Required acceptance checks

- Repeated unsupported requests, misleading capability labels, blocked-to-feasible transitions and stale/tampered records cannot obtain write/Bash/deploy/RPC access.
- Direct retired API routes and unapproved plugins/providers remain blocked; generated server functions cannot access platform secrets or create an alternate privileged data path.
- Unknown/ambiguous companies, missing live dependencies and unsupported combinations fail feasibility. Synthetic fixtures require explicit demo intent and a platform-owned notice. End users are never asked to supply the team table or Wind configuration.
- Low/medium/high risk maps to large/medium/small companies within selected industries. At most five stable randomized cards appear per China day; reload/concurrency cannot create extra cards. Yes adds to the watchlist; fixed metric IDs and missing values remain enforced by platform modules.
- Long non-build discussions, partial responses and restarts retain conversation context. Deleting chats preserves completed app/data; ownership, expected revision and active-turn checks are enforced. Reactive updates do not re-create deleted chats or lose retained builds.
- The React app actually uses starter/shadcn components, respects the recorded theme and does not replace fixed financial logic. A forged build/check script or invalid artifact fails platform verification.
- Successful builds activate; failed/cancelled/out-of-scope changes retain the accepted release/data. Linux/container tests verify host filesystem, network, environment, preview authorization and runtime isolation.
- Regenerate Convex bindings and run check/build plus applicable flow, agent/browser, prototype, model, conversation, build-policy and company-capability tests on the integrated version. Author-reported tests on the unadapted proposals are not evidence for this integrated version.

## Verification performed for this review

- Retrieved live PR metadata, diffs and review lists. Pinned both heads and base. GitHub exposes no status checks or submitted reviews for these heads.
- Reconstructed proposal source from the exact base plus each diff in isolated directories. The resulting Git tree hashes exactly match GitHub: #3 `b7f43b4a42bb9eea1e732a138c071e56c247ed58`; #4 `979c1a9858c1c44adc044590c8f04a22adcc8747`.
- Simulated three-way merges against a snapshot of current tracked and untracked, non-ignored source in a separate temporary repository. #3 has six conflicting files: agent-chat, conversation-navigation, studio, server agent, repository and package.json. #4 has twelve: those six plus app-frame, docs-content, server platform and the agent/flow/prototype test scripts. No current branch/index/source was reset or merged.
- Ran the existing current-copy build-policy, company-capability and conversation suites: all passed. These establish the requirements to preserve; they do not validate either PR.
- Exercised PR #4's `inspectSource()` with a fixture containing fake build/check scripts: all three preflight checks passed. The fake commands were not executed. The later runner's existence-only output check was inspected in source; a full Linux activation exploit was not executed.
- Separate Standards and Spec subagents reviewed the proposals. No deployments, real model calls, real chat deletions, GitHub comments or merges were performed. Full PR build/browser/Docker suites were not run; native macOS lacks the new Linux sandbox runner.

Merge simulation evidence is under `.local/pr-review/merge-analysis.json` and `pr3-merge-tree.txt` / `pr4-merge-tree.txt` (ignored local review artifacts).

Standards: 3 findings, worst P1 authorization/verification. Spec: 4 findings, worst P1 feasibility enforcement. Neither PR is ready unchanged; adapted persistence should precede the guarded React starter integration.
