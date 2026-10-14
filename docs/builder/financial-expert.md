# Financial Expert Instructions

The platform builder loads `apps/web/src/server/protocols/financial-expert/agent.md`
on every conversation turn. Its eight linked skills are bundled server-side and
available through the `read_financial_skill` tool. Skill IDs match filenames
without `skills/` or `.md`; the model loads relevant skills using the agent's
routing table. No Desktop directory or external filesystem access is needed at
runtime, including in Docker deployments.

These documents were imported from `/Users/menilating/Desktop/cd80`. They are
versioned copies, not a live filesystem link. To update the guidance, edit the
bundled Markdown files. When adding a skill, register its raw import in
`apps/web/src/server/financial-expert.ts` and update the agent routing table.
Build records hash the agent instructions and the entire available skill set,
including skills that were not loaded, to identify the guidance version.

The integration notes in `financial-expert.ts` distinguish software-building
tasks from financial chatbot answers. Referenced contracts, proposed formulas,
and topic lists do not make financial capabilities or reviewed evidence
available. Independent feasibility checks, protected financial modules,
permissions, and Linux isolation remain enforced by code. Importing the skills
does not implement the financial products or data integrations they describe.

The skill tool is read-only and accepts only registered IDs. Documents are not
injected into the independent feasibility classifier or title generation.

Verification: `bun run test:build-policy` covers skill loading and provenance;
`bun run test:agent` checks the actual builder transport and tool result with a
local model fixture, not live inference.
