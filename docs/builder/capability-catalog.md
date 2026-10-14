# Capability Catalog

`apps/web/src/lib/capability.json` is the supplied
`shared-financial-capabilities` v2.0.0 catalog, imported from
`~/Downloads/shared-financial-capabilities.json` without changing its requirements.

The builder receives the full catalog and assesses semantic feasibility. Upstream
removed the separate intent-classifier model; server-side capability, dependency,
identity, permission and release checks remain executable.
It describes desired contracts, inputs, outputs, specifications, dependencies,
configuration, implementation status and provenance. Catalog verification claims
are supplied evidence, not newly verified platform readiness.

`capability-catalog.ts` validates core fields, unique IDs and required/optional
dependency references. Contract-specific fields such as questionnaire definitions,
benchmark configuration and provider contracts are preserved in the builder prompt.
Historical `legacy_id_maps` are preserved as reference only; they do not register
removed capabilities such as `grounded-chatbot`.

## Runtime Boundaries

The supplied v2 catalog changes architecture and financial behavior. Importing it
does not implement these changes. The runtime registry in `capability-catalog.ts`
retains the existing eight build IDs, including those stored in existing releases.
Each registry entry names related v2 contracts and explicitly describes missing
implementation. Related IDs are not aliases: v2 questionnaire scoring, five-industry
CSV taxonomy and session-based discovery differ from current protected modules.

Current dependency expansion, protocol selection and workflow labels use the runtime
registry. The builder receives that registry alongside the catalog and must not
claim that catalog-only capabilities, bridges or server adapters are executable.
Catalog IDs are not automatically added to `prepare_build` or runtime permissions.

The supplied four-file-bundle instructions conflict with this repository's protected
React starter. Platform instructions take precedence. Generated applications may
not change protected financial algorithms or implement privileged server adapters.
New contracts require deliberate platform implementation, permissions and tests.
Live activation and additional bridges are not enabled by JSON text.

The merged upstream code permits live preparation after company lookup and stages
verified previews for explicit user activation. This is not proof that financial
adapters work: protected starter labels and financial output availability remain
separate limitations. Builds require a prior-turn proposal; previews do not activate
automatically.

## Updating

Replace the JSON with a revised catalog using the supplied structure. The loader
preserves additional contract fields and fails on malformed core fields or dangling
dependency references. Rebuild and relaunch Docker to apply changes; this is bundled
configuration, not a runtime file watcher. Never put secrets in the catalog because
workflow code also imports it into the client bundle.

Build records hash the full catalog plus integration boundaries in their protocol
provenance. Existing per-turn checks, server permissions, company validation,
protected source, fixture labels and sandbox controls remain in force.

Verification: `bun run test:requirements`, `bun run test:build-policy`,
`bun run test:agent`, `bun run test:model-contract`, `bun run build`, and
`bun run check`. Local model fixtures prove transport, not live model judgment.
