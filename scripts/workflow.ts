type Turn = { id: string; status: "running" | "complete" | "stopped" | "error" };
type Application = {
  id: string;
  name: string;
  chatTitle?: string;
  buildProposal?: { id: string; approvedAt?: string; summary: string };
  workflowApproval?: { proposalId: string; turnId: string; approvedAt: string };
  agentTurn?: Turn;
  turns?: Turn[];
  preview?: { id: string; verification: { passed: boolean } } | null;
};

const help = `Usage:
  bun scripts/workflow.ts list [--url URL]
  bun scripts/workflow.ts approve --app ID --proposal UUID [--url URL] [--wait]

Options:
  --url URL       Server origin or /api/platform URL (default: http://127.0.0.1:3012)
  --app ID        Application ID from list
  --proposal UUID Exact workflow proposal ID reviewed for approval
  --wait         Poll the approval receipt's turn until it settles (up to 11 minutes)
  -h, --help     Show this help

HTTP is allowed only on loopback; other hosts require HTTPS.
CD80_SESSION_COOKIE optionally supplies an account Cookie header; it is never printed.
Approval starts the server's background agent. This CLI does not execute builds
or activate releases. Preview ready does not mean live.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(help);
    return;
  }
  const command = args.shift();
  if (command !== "list" && command !== "approve")
    throw new Error("Unknown command. Use list or approve; see --help.");
  const options = new Map<string, string>();
  let wait = false;
  while (args.length) {
    const option = args.shift()!;
    if (option === "--wait") {
      if (wait) throw new Error("Duplicate --wait option.");
      wait = true;
    } else if (["--url", "--app", "--proposal"].includes(option)) {
      if (options.has(option)) throw new Error(`Duplicate ${option} option.`);
      const value = args.shift();
      if (!value?.trim() || value.startsWith("--"))
        throw new Error(`Missing value for ${option}; see --help.`);
      options.set(option, value);
    } else {
      throw new Error("Unknown option or positional argument; see --help.");
    }
  }
  if (command === "list" && (wait || options.has("--app") || options.has("--proposal")))
    throw new Error("list accepts only --url; see --help.");
  const appId = options.get("--app");
  const proposalId = options.get("--proposal");
  if (command === "approve") {
    if (!appId || !proposalId)
      throw new Error("approve requires --app and --proposal; see --help.");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proposalId))
      throw new Error("--proposal must be a UUID from list.");
  }

  let url: URL;
  try {
    url = new URL(options.get("--url") ?? "http://127.0.0.1:3012");
  } catch {
    throw new Error("--url must be an absolute HTTP or HTTPS URL.");
  }
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "[::1]" ||
    /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw new Error("--url requires HTTPS unless the host is loopback.");
  if (url.username || url.password || url.search || url.hash)
    throw new Error("--url must not contain credentials, query parameters, or a fragment.");
  if (!["/", "/api/platform", "/api/platform/"].includes(url.pathname))
    throw new Error("--url must be a server origin or the /api/platform route.");
  url.pathname = "/api/platform";

  const headers = new Headers({ accept: "application/json" });
  const cookie = process.env.CD80_SESSION_COOKIE;
  if (cookie) {
    try {
      headers.set("cookie", cookie);
    } catch {
      throw new Error("CD80_SESSION_COOKIE is not a valid header value.");
    }
  }
  async function request(body?: { action: string; appId: string; proposalId: string }) {
    const requestHeaders = new Headers(headers);
    if (body) requestHeaders.set("content-type", "application/json");
    let response: Response;
    try {
      response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new Error(
        "Platform request failed or timed out. Check --url and server availability. " +
          (body ? "Approval may have been recorded; run list before retrying." : ""),
      );
    }
    if (!response.ok) {
      const guidance =
        response.status === 401 || response.status === 403
          ? "Check account access and CD80_SESSION_COOKIE."
          : response.status >= 300 && response.status < 400
            ? "Redirects are not followed. Use the final platform URL and an account cookie if required."
            : body
              ? "Run list and review the latest proposal; it may be changed, already approved, or busy."
              : "Check the platform URL and server configuration.";
      throw new Error(`Platform returned HTTP ${response.status}. ${guidance}`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error("Platform did not return JSON. Check that --url points to /api/platform.");
    }
  }
  async function list(): Promise<Application[]> {
    const snapshot = await request();
    if (!Array.isArray(snapshot?.apps))
      throw new Error("Invalid platform response: expected an apps array.");
    return snapshot.apps;
  }

  if (command === "list") {
    const apps = await list();
    console.log(
      JSON.stringify(
        apps.map((app) => ({
          id: app.id,
          title: app.chatTitle || app.name,
          buildProposal: app.buildProposal
            ? {
                id: app.buildProposal.id,
                approvedAt: app.buildProposal.approvedAt ?? null,
                summary: app.buildProposal.summary,
              }
            : null,
          turn: app.agentTurn ? { id: app.agentTurn.id, status: app.agentTurn.status } : null,
        })),
        null,
        2,
      ),
    );
    return;
  }

  const approved: Application = await request({
    action: "approve-workflow",
    appId: appId!,
    proposalId: proposalId!,
  });
  const receipt = approved.workflowApproval;
  if (
    approved.id !== appId ||
    !receipt ||
    receipt.proposalId !== proposalId ||
    !receipt.turnId ||
    !receipt.approvedAt
  )
    throw new Error(
      "Approval response has no matching workflowApproval receipt. " +
        "Approval may have been recorded; run list before retrying. Server support is required.",
    );
  console.log(JSON.stringify({ appId, workflowApproval: receipt }, null, 2));
  console.log("Approval recorded; the server starts the background agent automatically.");
  if (!wait) return;

  const deadline = Date.now() + 11 * 60 * 1000;
  let app = approved;
  while (true) {
    const turn =
      app.agentTurn?.id === receipt.turnId
        ? app.agentTurn
        : app.turns?.find((entry) => entry.id === receipt.turnId);
    if (turn && ["complete", "stopped", "error"].includes(turn.status)) {
      console.log(
        JSON.stringify(
          {
            appId,
            turnId: receipt.turnId,
            status: turn.status,
            previewReady: !!app.preview?.verification.passed,
          },
          null,
          2,
        ),
      );
      console.log(
        "Preview ready is not live. Review and explicitly activate Preview in the studio.",
      );
      if (turn.status !== "complete") process.exitCode = 1;
      return;
    }
    if (Date.now() >= deadline)
      throw new Error(
        "Timed out waiting for the approval receipt's turn. Check the studio; do not reapprove. " +
          "The server has no durable crash recovery.",
      );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const apps = await list();
    const latest = apps.find((entry) => entry.id === appId);
    if (!latest) throw new Error("Approved application is no longer accessible. Check the studio.");
    app = latest;
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Workflow command failed.";
    const cookie = process.env.CD80_SESSION_COOKIE;
    console.error(`Error: ${cookie ? message.replaceAll(cookie, "[redacted]") : message}`);
    process.exitCode = 1;
  });
}
