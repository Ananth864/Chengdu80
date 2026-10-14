# Capability protocol template

Status: template. Owner: TODO. Capability ID: TODO. Protocol version: TODO.

## Mandatory builder implementation rules

- Base every build on [adityamiskin/web-starter](https://github.com/adityamiskin/web-starter), using the existing project adaptation and its pinned versions.
- Use TanStack Start for application routing/server integration and shadcn components from `@web-starter/ui/components/*`. Reuse the starter component library and Base UI conventions before writing custom controls.
- Reuse the installed AI SDK/integration for model calls, chat and streaming. The starter currently uses TanStack AI; do not assume Vercel AI SDK is installed or replace the integration merely because another SDK exists.
- Inspect existing components, hooks, adapters and capability modules first. Add custom code only for a concrete requirement that those modules cannot satisfy; record the gap and reason in the build result. Do not recreate routing, chat transport, standard UI primitives or financial modules unnecessarily.
- Apply the default theme unless the submitted contract explicitly specifies a theme override. Put overrides in central theme tokens rather than scattered component styles. Record the resolved theme and version in the build result.
- Validate starter/library reuse and resolved theme against the contract before approving a preview. An expert protocol can define financial behavior but cannot silently replace these implementation requirements.

## Purpose and request boundaries

Supported user goals: TODO.
Internal or user-facing behavior: TODO.
Unsupported requests and supported alternatives: TODO.

## Inputs and dependencies

Required fields, types, units and allowed values: TODO.
Company identity and industry source: TODO.
Other required capabilities and output references: TODO.
Missing or ambiguous input behavior: TODO.
Company requests must resolve to a valid entry in the supplied company table; ask for disambiguation when required.

## Fixed outputs and reusable implementation

Output fields, types, units, dates and evidence: TODO.
Starter module/component IDs: TODO.
Invariant calculations or rules: TODO.
Allowed request-specific variations: TODO.
Forbidden variations: TODO.

## Expert procedure

Clarification questions and stopping condition: TODO.
The user specification review shows outcomes and the proposed user journey in plain language. Technical details belong in the builder contract.
Analysis steps and evidence standards: TODO.
Calculation conventions, reporting windows and corporate-action basis: TODO.
Missing, stale, conflicting and inapplicable data behavior: TODO.
Approved explanations and English/Simplified Chinese wording: TODO.

## Data and readiness

Official provider: Tushare (platform-held token). Exact api_name/fields: TODO.
Do not select providers other than Tushare as production defaults; clearly label fixtures.
Freshness and coverage requirements: TODO.
Dependencies pending: TODO.
Readiness: template / fixture / live-ready.
A fixture-ready protocol does not establish live readiness.

## Acceptance examples

Include input, expected structured output and evidence for an ordinary case, missing data, conflicting data, unsupported request and boundary case. Provide reviewed numerical expectations where calculations apply.

## Approval and change history

Expert reviewer/date: TODO.
Change summary and compatibility impact: TODO.
Breaking changes require a new version; existing submitted builds retain their pinned version.
