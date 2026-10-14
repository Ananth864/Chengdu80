# Requirements, Feasibility and Workflow Visualization

The Studio exposes Requirements and Workflow before an application has a release.
Requirements persist with the application and include the draft specification,
data-source selection, analysis period, assumptions, missing inputs, clarification
questions and answers, and selected registered plugin operations.

Users edit and save the draft, resolve recorded questions and missing inputs,
review the feasibility report, and confirm the exact saved design. Changed
specifications or requirements invalidate confirmation. The agent can ask
questions and record answers but cannot confirm on the user's behalf. Agent
deployment requires confirmation and a fresh passing feasibility assessment.
Existing imported applications need design confirmation before agent deployment.
Explicit source imports and labelled examples retain their direct verified-release
flow; they are not implicitly human-confirmed designs.

The deterministic assessment reports pass, revise, or reject with reasons and
supported alternatives. It checks scope, unanswered/missing requirements,
historical analysis period, selected source availability, registered read-only
plugin operations, live/predictive limitations, and requested AI explanation
configuration. A configured data provider is not proof of licensing, entitlement,
date coverage, freshness, truth or suitable financial fields. These remain stated
limitations and require runtime/data acceptance checks. The assessment is not a
success probability or a replacement for source, calculation or browser tests.

Workflow metadata is persisted with drafts and releases. The three-column graph
shows data, capabilities, and outputs, with inspectable nodes and labelled
conceptual relationships. Draft capabilities are suggestions; release capabilities
come from manifest permissions. Neither declared permissions nor edges prove
that the generated source uses a capability or executes it in that order. This
is user-facing explanation, not an executable graph, trace, drag-and-drop editor
or background orchestrator.
