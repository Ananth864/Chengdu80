# Workflow Approval CLI

The CLI records approval of an exact, previously proposed workflow through the existing platform API. Review the specification, requested outputs, constraints, and proposal summary in the studio before approving. A changed proposal requires fresh review and approval; a later chat reply alone is not approval.

```bash
bun scripts/workflow.ts --help
bun scripts/workflow.ts list
bun scripts/workflow.ts list --url https://platform.example.com
bun scripts/workflow.ts approve --app APP_ID --proposal PROPOSAL_UUID
bun scripts/workflow.ts approve --app APP_ID --proposal PROPOSAL_UUID --url https://platform.example.com --wait
```

`--url` defaults to `http://127.0.0.1:3012`. Supply a server origin or its `/api/platform` URL. Other paths, embedded credentials, query parameters, and fragments are rejected. Plain HTTP is permitted only for loopback hosts (`localhost`, IPv4 `127.0.0.0/8`, or `::1`); non-loopback hosts require HTTPS. Redirects are not followed, so account cookies are not forwarded to another destination.

## Requests And Output

`list` sends `GET /api/platform`, reads the snapshot's `apps` array, and prints only application IDs, titles, pending `buildProposal.id`, `approvedAt` (null before approval), proposal summaries, and the current agent turn's ID and status. It does not dump application source, data, platform configuration, or internal keys.

`approve` sends the following JSON to `POST /api/platform`:

```json
{
  "action": "approve-workflow",
  "appId": "APP_ID",
  "proposalId": "PROPOSAL_UUID"
}
```

The response must be the updated Application containing a matching receipt:

```json
{
  "workflowApproval": {
    "proposalId": "PROPOSAL_UUID",
    "turnId": "BACKGROUND_TURN_ID",
    "approvedAt": "ISO_TIMESTAMP"
  }
}
```

The server records approval and automatically starts the background agent. The CLI prints the receipt, not the complete Application. A missing or mismatched receipt is an error, even if approval may already have been recorded. Inspect `list` and the studio before retrying an ambiguous or failed POST; the CLI does not automatically retry approvals.

With `--wait`, the CLI polls GET every two seconds and follows only the receipt's `turnId`, using `agentTurn` or the retained `turns` entry. It waits at most five minutes and prints the settled status (`complete`, `stopped`, or `error`) plus `previewReady`, based on the application's verified preview at that moment. A preview may predate this turn; `complete` alone does not prove a new preview was produced. A stopped/error turn, timeout, invalid arguments, or request failure exits nonzero. Individual requests time out after 15 seconds.

Preview ready is **not live**. Review the preview and explicitly activate it in the studio. The CLI never activates a release, bypasses feasibility checks, or grants capabilities or permissions.

## Account Access

For account-authenticated deployments, supply an existing session Cookie header through the optional `CD80_SESSION_COOKIE` environment variable. It is sent only to the selected platform endpoint and is never printed. Treat it as a credential: keep it out of command history, logs, and committed files. No model, provider, backend, or server-write keys are needed or read by this CLI; it does not read `.env` files itself. Demo mode remains a shared workspace, not a private account.

HTTP error output contains status and guidance rather than raw server responses, which could include internal information. If authentication fails, check the cookie and account access; if approval is rejected, refresh the proposal and ensure the active reply has finished.

## Execution Boundary

This is a request-bound CLI client, not a build executor or worker. Approval and execution belong to the server; the CLI only sends requests and optionally observes status. Closing the CLI does not cancel an already accepted server turn. Server-side capability, dependency, company, permission, exact-proposal approval, and Preview activation gates remain authoritative.

The approval-triggered builder has a ten-minute server lifetime; ordinary discussion remains bounded to four minutes, and successful build preparation grants a ten-minute build window. Execution depends on the server process remaining alive. There is no durable crash recovery or persistent job queue: a server crash/restart can leave a turn unsettled, and `--wait` cannot resume execution. Deadline failures retain saved source and explicitly report that a preview exists only if staging completed. Inspect the studio after a timeout or restart rather than assuming completion or blindly repeating approval.

The server must implement the approval receipt and automatic background continuation contract above. This CLI does not add that behavior to older servers and deliberately reports an absent receipt rather than starting execution itself.
