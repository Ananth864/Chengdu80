# Starter baseline

Historical baseline before custom product work. Current delivery evidence is in `implementation-status.md`.

The user selected `adityamiskin/web-starter` as the base. The checkout is at `../platform`, cloned at commit `fde7b8351c8179adf47a5d30efb72313430a87ba` on 13 October 2026.

## Configuration

The documented `bun run init convex workos ai` command selects the default Convex backend, WorkOS AuthKit and TanStack AI chat. TanStack Start, React, Tailwind, shadcn/ui, Vite+ and Cloudflare deployment through Alchemy remain in use. Inactive Drizzle/PlanetScale and Clerk options were removed by the starter's own initializer.

## Checks

- `bun install --frozen-lockfile` completed successfully before initialization.
- The untouched template's `bun run check` failed formatting checks for the two template documentation files.
- The documented initializer completed, reinstalled the selected dependencies and formatted the starter.
- The first post-init `bun run check` failed because `routeTree.gen` had not yet been generated. The other route errors followed from that missing generated type source.
- `bun run build` completed successfully, producing client/server bundles and generating the route tree. It reported a client chunk-size advisory, not a failed build.
- Post-build `bun run check`: passed after route generation.

## Limits

At this baseline, no deployment, provisioning, login or model call was performed, and no custom features or credentials were added. Subsequent implementation uses gpt-6-luna, source import, a workerd sandbox and financial adapters; see the current status document for what was actually tested.

Generated Convex bindings came with the starter. Subsequent app-storage functions were authored. Codegen was attempted and stopped because no deployment was configured; account-backed generation and tests remain required.
