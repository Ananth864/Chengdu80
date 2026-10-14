import { writeFile, mkdir, rm, lstat } from "node:fs/promises";
import path from "node:path";
import {
  prepareProject,
  runWorkspaceCommand,
  readProjectFiles,
  releaseWorkspace,
  type AppWorkspace,
} from "./app-workspaces";
import { isProjectFile } from "../lib/project-files";
import { appProjectTemplateFiles } from "../lib/app-project-template";
import {
  approvedPermissions,
  buildContextPath,
  buildContextSource,
  protectedProjectFiles,
  inspectProjectProtection,
} from "../lib/financial-starter";
import {
  chat,
  EventType,
  maxIterations,
  StreamProcessor,
  toolDefinition,
  type StreamChunk,
  type UIMessage,
} from "@tanstack/ai";
import { Bash } from "just-bash";
import { z } from "zod";
import {
  bundleSchema,
  specSchema,
  requirementsSchema,
  protocolFor,
  capabilityContracts,
  type AppBundle,
  type ProductSpec,
} from "../lib/contracts";
import { findApp, saveApp, mutateApp, checkpointMessages, type Access } from "./repository";
import { applyRelease, makeRelease } from "./platform";
import { modelAdapter, modelOptions } from "./models";
import { buildPlanSchema, type BuildRecord } from "../lib/build-plan";
import {
  agentProtocols,
  frontendDesign,
  managedCompanies,
  prepareBuild,
  requireBuild,
  selectedProtocols,
  validateScopedBundle,
} from "./build-policy";
import { companyMatchLimit, companyMatchThreshold, rankCompanyMatches } from "../lib/company-table";
import { defaultData } from "../lib/finance";
import { localMode, settings } from "./settings";

const filePath = z
  .string()
  .max(240)
  .refine(
    (name) => name === "cd80.json" || isProjectFile(name),
    "Use a safe relative source path.",
  );
// Survive Vite module reloads while an existing stream is still running.
const host = globalThis as typeof globalThis & {
  __chengduAgentRuntime?: { id: string; activeTurns: Set<string> };
};
const agentRuntime = (host.__chengduAgentRuntime ??= {
  id: crypto.randomUUID(),
  activeTurns: new Set<string>(),
});
const activeTurns = agentRuntime.activeTurns;
function scaffoldInstructions(spec: ProductSpec) {
  return `Preserve the existing pure calculations.js scaffold and this numerical verification fixture: ${JSON.stringify(protocolFor(spec.protocol).fixture)}. It is transitional transport, not a financial capability offered by this app. Do not add financial logic to it. Only the internal build record defines the requested business scope.`;
}
const scopedTransportContracts = Object.fromEntries(
  Object.entries(capabilityContracts).filter(([id]) =>
    [
      "finance.calculate",
      "finance.match-companies",
      "finance.company-cards",
      "storage.read",
      "storage.write",
    ].includes(id),
  ),
);

function fileContents(bundle: AppBundle): Record<string, string> {
  return { "cd80.json": JSON.stringify(bundle.manifest, null, 2), ...bundle.files };
}
function fileBundle(files: Record<string, string>) {
  return bundleSchema.parse({
    manifest: JSON.parse(files["cd80.json"]),
    files: Object.fromEntries(Object.entries(files).filter(([name]) => name !== "cd80.json")),
  });
}
export async function safeAgentError(error: unknown) {
  let message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "The agent could not complete this request.";
  for (const [name, value] of Object.entries(await settings()))
    if (value && /KEY|TOKEN|SECRET|PASSWORD/.test(name))
      message = message.replaceAll(value, "[redacted]");
  return message.replace(/sk-[a-zA-Z0-9_-]{8,}/g, "[redacted]").slice(0, 2000);
}

// Keep complete turn structure but omit old file bodies from the model's transcript.
// The workspace is authoritative and can always be inspected with read_file.
export function compactTranscript(messages: UIMessage[], settled = false): UIMessage[] {
  const results = new Set(
    messages.flatMap((message) =>
      message.parts.filter((part) => part.type === "tool-result").map((part) => part.toolCallId),
    ),
  );
  function toolValue<T>(value: T): T | string {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    return text && text.length > 10000
      ? "[Large previous tool output omitted. Inspect the current workspace with read_file or use the saved build record.]"
      : value;
  }
  const compact = messages.map((message) => ({
    ...message,
    parts: message.parts.map((part) => {
      if (part.type === "tool-result") return { ...part, content: toolValue(part.content) };
      if (part.type !== "tool-call") return part;
      if (settled && part.output === undefined && !results.has(part.id)) {
        return {
          ...part,
          arguments: ["awaiting-input", "input-streaming"].includes(part.state)
            ? "{}"
            : part.arguments,
          state: "error" as const,
          output: {
            error:
              "Tool interrupted before its result was confirmed. Inspect the workspace before retrying.",
          },
        };
      }
      let args: unknown;
      try {
        args = JSON.parse(part.arguments);
      } catch {
        return part;
      }
      if (
        args &&
        typeof args === "object" &&
        "content" in args &&
        typeof args.content === "string" &&
        args.content.length > 2000
      )
        args = {
          ...args,
          content: "[File body omitted from history. Use read_file to inspect current source.]",
        };
      return {
        ...part,
        arguments: JSON.stringify(args),
        output: toolValue(part.output),
      };
    }),
  }));
  return compact;
}

export async function startAgentTurn(
  access: Access,
  appId: string,
  user: { id: string; content: string },
  requestSignal: AbortSignal,
) {
  const turnKey = `${access.ownerId}:${appId}`;
  if (activeTurns.has(turnKey)) throw new Error("This conversation is already replying.");
  activeTurns.add(turnKey);
  const controller = new AbortController();
  const abort = () => controller.abort();
  requestSignal.addEventListener("abort", abort, { once: true });
  if (requestSignal.aborted) abort();
  const deadline = setTimeout(() => {
    abort();
    activeTurns.delete(turnKey);
  }, 240000);
  let processor!: StreamProcessor;
  let persisted = false;
  let project: AppWorkspace | undefined;
  try {
    const singleOwnerLocal = await localMode();
    const app = await mutateApp(access, appId, (latest) => {
      if (latest.agentTurn?.status === "running") {
        const interruptedLocal = singleOwnerLocal && latest.agentTurn.runtimeId !== agentRuntime.id;
        if (!interruptedLocal && Date.now() - Date.parse(latest.agentTurn.startedAt) < 300000)
          throw new Error("This conversation is already replying.");
        const previousId = latest.agentTurn.id;
        latest.conversation = compactTranscript(latest.conversation ?? [], true);
        latest.turns = (latest.turns ?? []).map((turn) =>
          turn.id === previousId
            ? { ...turn, status: "stopped", completedAt: new Date().toISOString() }
            : turn,
        );
      }
      if (latest.conversation?.some((message) => message.id === user.id))
        throw new Error("This message has already been submitted.");
      processor = new StreamProcessor({ initialMessages: latest.conversation ?? [] });
      processor.addUserMessage(user.content, user.id);
      latest.conversation = compactTranscript(processor.getMessages());
      latest.agentTurn = {
        id: user.id,
        runtimeId: agentRuntime.id,
        startedAt: new Date().toISOString(),
        status: "running",
      };
      latest.turns = [...(latest.turns ?? []), latest.agentTurn].slice(-40);
      delete latest.chatDeletedAt;
    });
    persisted = true;
    const workspace = app.workspace ?? app.current?.bundle ?? app.preview?.bundle;
    if (!workspace) throw new Error("Workspace is missing.");
    const files = fileContents(workspace);
    const protectedCalculations = files["calculations.js"];
    const projectFormat = workspace.manifest.schemaVersion === 3;
    const shell = new Bash({
      cwd: "/app",
      files: Object.fromEntries(
        Object.entries(files).map(([path, value]) => [`/app/${path}`, value]),
      ),
      executionLimits: { maxCommandCount: 200, maxLoopIterations: 1000, maxCallDepth: 20 },
    });
    let spec = app.workspaceSpec ?? app.spec;
    let buildRecord: BuildRecord | undefined;
    const prior =
      app.current?.buildRecord ??
      [...(app.buildRecords ?? [])].reverse().find((record) => record.readiness !== "blocked");
    const fixtureAuthorized =
      prior?.plan.mode === "fixture" ||
      (app.conversation ?? []).some(
        (message) =>
          message.role === "user" &&
          message.parts.some(
            (part) =>
              part.type === "text" && /fixture|synthetic|demo|演示|模拟|示例/i.test(part.content),
          ),
      );
    const selected = prior ? selectedProtocols(prior.resolvedCapabilities) : [];
    async function requirePlan() {
      controller.signal.throwIfAborted();
      const record = requireBuild(buildRecord, user.id);
      const latest = await findApp(access, appId);
      if (
        latest.agentTurn?.id !== user.id ||
        latest.agentTurn.status !== "running" ||
        latest.buildRecords?.at(-1)?.hash !== record.hash
      )
        throw new Error("This financial build turn is no longer active.");
      return record;
    }
    function writable(name: string) {
      filePath.parse(name);
      if (
        projectFormat &&
        (name === "cd80.json" ||
          name === buildContextPath ||
          name in protectedProjectFiles() ||
          name === "src/routeTree.gen.ts" ||
          (name === "src/app.css" && !buildRecord?.plan.themeOverride))
      )
        throw new Error(
          "Reuse the platform-owned starter, financial SDK and contract context unchanged.",
        );
    }
    async function getProject() {
      await requirePlan();
      project ??= await prepareProject(fileBundle(files), {
        scope: `agent:${access.ownerId}:${appId}:${user.id}`,
        pin: true,
      });
      return project;
    }
    async function writeProjectSource(name: string, content?: string) {
      const workspace = await getProject();
      let current = workspace.directory;
      for (const segment of name.split("/")) {
        current = path.join(current, segment);
        try {
          if ((await lstat(current)).isSymbolicLink())
            throw new Error("Source paths cannot follow symlinks.");
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
        }
      }
      if (content === undefined) await rm(current, { force: true });
      else {
        await mkdir(path.dirname(current), { recursive: true });
        await writeFile(current, content);
      }
    }

    async function checkpoint() {
      controller.signal.throwIfAborted();
      await requirePlan();
      if (projectFormat) inspectProjectProtection(fileBundle(files), buildRecord);
      if (!projectFormat && files["calculations.js"] !== protectedCalculations)
        throw new Error(
          "Reuse the platform calculation scaffold; financial modules are maintained by the platform team.",
        );
      await mutateApp(access, appId, (latest) => {
        controller.signal.throwIfAborted();
        if (latest.agentTurn?.id !== user.id || latest.agentTurn.status !== "running")
          throw new Error("This financial build turn is no longer active.");
        latest.workspace = fileBundle(files);
        latest.conversation = compactTranscript(processor.getMessages());
      });
    }
    const tools = [
      toolDefinition({
        name: "lookup_companies",
        description:
          "Fuzzy-search companies by ticker, name, full registered name, English name or industry. Live mode covers Shanghai Stock Exchange Class A listed companies only, through the platform-managed Tushare token; fixture mode covers the synthetic DEMO001/DEMO002/DEMO003 table. Returns scored matches only.",
        inputSchema: z.object({ mode: z.enum(["fixture", "live"]), query: z.string().max(100) }),
      }).server(async ({ mode, query }) => {
        const table = await managedCompanies(mode);
        if (!table.available)
          return {
            available: false,
            synthetic: mode === "fixture",
            reason: table.reason,
            companies: [],
          };
        const ranked = rankCompanyMatches(query, table.companies);
        return {
          version: table.version,
          ...(table.synthetic ? {} : { asOf: table.asOf }),
          available: true,
          synthetic: table.synthetic,
          threshold: companyMatchThreshold,
          totalMatched: ranked.length,
          companies: ranked.slice(0, companyMatchLimit),
        };
      }),
      toolDefinition({
        name: "prepare_build",
        description:
          "Validate requested capabilities and dependencies, resolve company-table identity, pin protocol versions and save an internal build record. Required before each build/edit turn. No user-facing submission screen. You determine request feasibility against the builder protocol before declaring a plan; the platform independently validates capabilities, company identity and data readiness, and returns blockers instead of building unsupported requests.",
        inputSchema: buildPlanSchema,
      }).server(async (plan) => {
        buildRecord = undefined;
        if (plan.mode === "fixture" && !fixtureAuthorized)
          throw new Error(
            "Ask whether the user wants a clearly labeled synthetic demo. Live data must not silently become fixtures.",
          );
        const record = await prepareBuild(
          plan,
          user.id,
          ((await findApp(access, appId)).buildRecords?.at(-1)?.revision ?? 0) + 1,
        );
        await mutateApp(access, appId, (latest) => {
          controller.signal.throwIfAborted();
          if (latest.agentTurn?.id !== user.id || latest.agentTurn.status !== "running")
            throw new Error("This financial build turn is no longer active.");
          latest.buildRecords = [...(latest.buildRecords ?? []), record].slice(-40);
          if (record.readiness === "blocked")
            latest.rejectedBuildTurns = [
              ...new Set([...(latest.rejectedBuildTurns ?? []), user.id]),
            ];
        });
        buildRecord = record;
        if (projectFormat && record.readiness !== "blocked") {
          const manifest = JSON.parse(files["cd80.json"]);
          files["cd80.json"] = JSON.stringify({
            ...manifest,
            permissions: approvedPermissions(record, true),
          });
          files[buildContextPath] = buildContextSource(record, manifest.name);
          if (project) {
            await releaseWorkspace(project);
            project = undefined;
          }
          await checkpoint();
        }
        return {
          record,
          protocols: selectedProtocols(record.resolvedCapabilities),
          ...(record.readiness !== "blocked"
            ? { designGuidance: frontendDesign }
            : {
                designNotice:
                  "The frontend design protocol loads with an approved build record, not a blocked one.",
              }),
          ...(record.readiness === "live"
            ? {
                liveNotice:
                  "Live build: market data comes from the platform's verified Tushare feed (SSE Class A daily data). Sections the feed does not cover must display as unavailable (暂无数据), never estimates. No buy/sell recommendations.",
              }
            : {
                fixtureNotice:
                  "Synthetic demo: approved React/shadcn starter and fixed company modules; live financial outputs remain unavailable.",
              }),
        };
      }),
      toolDefinition({
        name: "record_requirements",
        description:
          "Record the draft requirements for the user's Requirements review: clarification questions with the user's actual answers, assumptions, missing inputs and the analysis period. Ask material questions in chat first; record only answers the user actually gave, never invented or assumed ones. The user reviews, answers and edits these in the Requirements tab.",
        inputSchema: requirementsSchema,
      }).server(async (requirements) => {
        await mutateApp(access, appId, (latest) => {
          controller.signal.throwIfAborted();
          if (latest.agentTurn?.id !== user.id || latest.agentTurn.status !== "running")
            throw new Error("This financial build turn is no longer active.");
          latest.requirements = requirements;
        });
        return {
          saved: true,
          openQuestions: requirements.questions.filter((question) => !question.answer.trim())
            .length,
        };
      }),
      toolDefinition({
        name: "read_starter_reference",
        description:
          "Read the exact platform starter SDK, toolkit guide or installed shadcn sources.",
        inputSchema: z.object({ target: z.enum(["sdk", "toolkit", "components", "package"]) }),
      }).server(({ target }) => ({
        source:
          target === "sdk"
            ? appProjectTemplateFiles["src/lib/cd80.ts"]
            : target === "toolkit"
              ? appProjectTemplateFiles["README.md"]
              : target === "package"
                ? appProjectTemplateFiles["package.json"]
                : Object.fromEntries(
                    Object.entries(appProjectTemplateFiles).filter(([name]) =>
                      name.startsWith("src/components/ui/"),
                    ),
                  ),
      })),
      toolDefinition({
        name: "get_browser_logs",
        description:
          "Read reported runtime errors from the rendered current preview. An empty log alone does not prove the site was rendered; ask the user if no browser is viewing it.",
        inputSchema: z.object({}),
      }).server(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        const latest = await findApp(access, appId);
        return {
          releaseId: latest.current?.id,
          errors: (latest.browserEvents ?? []).filter(
            (event) => event.releaseId === latest.current?.id,
          ),
        };
      }),
      toolDefinition({
        name: "read_app_data",
        description:
          "Read the current app data and provenance. Use actual saved data when answering questions about the site.",
        inputSchema: z.object({}),
      }).server(async () => (await findApp(access, appId)).data),
      toolDefinition({
        name: "list_files",
        description: "List the actual app workspace files and identify its source format.",
        inputSchema: z.object({}),
      }).server(() => Object.keys(files)),
      toolDefinition({
        name: "read_file",
        description: "Read current source in the app workspace.",
        inputSchema: z.object({ path: filePath }),
      }).server(({ path }) => ({ path, content: files[path] })),
      toolDefinition({
        name: "write_file",
        description:
          "Write a complete source file. Changes are staged until deploy_preview verifies and activates them.",
        inputSchema: z.object({ path: filePath, content: z.string().max(60000) }),
      }).server(async ({ path, content }) => {
        await requirePlan();
        writable(path);
        const previous = files[path];
        files[path] = content;
        try {
          fileBundle(files);
          await checkpoint();
          if (projectFormat) await writeProjectSource(path, content);
          else await shell.fs.writeFile(`/app/${path}`, content);
        } catch (error) {
          if (previous === undefined) delete files[path];
          else files[path] = previous;
          if (projectFormat && project) await writeProjectSource(path, previous);
          throw error;
        }
        return { path, written: content.length };
      }),
      toolDefinition({
        name: "edit_file",
        description:
          "Replace one exact occurrence of text in a workspace file. Read the file first. Fails on zero or multiple matches.",
        inputSchema: z.object({
          path: filePath,
          oldText: z.string().min(1),
          newText: z.string().max(60000),
        }),
      }).server(async ({ path, oldText, newText }) => {
        await requirePlan();
        writable(path);
        if (files[path] === undefined || files[path].split(oldText).length !== 2)
          throw new Error("Expected exactly one matching occurrence.");
        const previous = files[path];
        files[path] = previous.replace(oldText, newText);
        try {
          fileBundle(files);
          await checkpoint();
          if (projectFormat) await writeProjectSource(path, files[path]);
          else await shell.fs.writeFile(`/app/${path}`, files[path]);
        } catch (error) {
          if (previous === undefined) delete files[path];
          else files[path] = previous;
          if (projectFormat && project) await writeProjectSource(path, previous);
          throw error;
        }
        return { path, edited: true };
      }),
      toolDefinition({
        name: "bash",
        description:
          "After feasibility approval, run Bash inside the isolated React project; legacy apps use a bounded virtual shell. No host secrets, outbound network or package installation. Protected starter/financial/configuration changes are rejected and rolled back.",
        inputSchema: z.object({ command: z.string().min(1).max(8000) }),
      }).server(async ({ command }) => {
        await requirePlan();
        const previous = { ...files };
        const result = projectFormat
          ? await runWorkspaceCommand(await getProject(), command, { signal: controller.signal })
          : await shell.exec(command, { signal: controller.signal });
        try {
          if (projectFormat) {
            const staged = await readProjectFiles(await getProject());
            if ("cd80.json" in staged) throw new Error("The platform owns capability permissions.");
            for (const name of Object.keys(files)) if (name !== "cd80.json") delete files[name];
            Object.assign(files, staged);
          } else
            for (const name of Object.keys(files))
              files[name] = await shell.fs.readFile(`/app/${name}`);
          fileBundle(files);
          await checkpoint();
        } catch (error) {
          for (const name of Object.keys(files)) delete files[name];
          Object.assign(files, previous);
          if (project) {
            await releaseWorkspace(project);
            project = undefined;
          }
          if (!projectFormat)
            for (const name of Object.keys(previous))
              await shell.fs.writeFile(`/app/${name}`, previous[name]);
          throw error;
        }
        return {
          stdout: result.stdout.slice(0, 16000),
          stderr: result.stderr.slice(0, 4000),
          exitCode: result.exitCode,
        };
      }),
      toolDefinition({
        name: "set_specification",
        description:
          "Set the site name, purpose and supported calculation protocol. Requires prepare_build earlier in the same turn; a specification change is a modifying turn like any other. Keep the existing protocol when editing an active app.",
        inputSchema: specSchema,
      }).server(async (next) => {
        await requirePlan();
        if (next.protocol !== app.spec.protocol)
          throw new Error(
            "Retain the current transport scaffold. Business capabilities belong in prepare_build.",
          );
        await mutateApp(access, appId, (latest) => {
          controller.signal.throwIfAborted();
          if (latest.current && latest.spec.protocol !== next.protocol)
            throw new Error("An active app's calculation protocol cannot change.");
          if (!latest.current && latest.spec.protocol !== next.protocol)
            latest.data.inputs = defaultData(next.protocol);
          latest.workspaceSpec = next;
          if (!latest.current) {
            latest.spec = next;
            latest.name = next.name;
          }
        });
        spec = next;
        const manifest = JSON.parse(files["cd80.json"]);
        files["cd80.json"] = JSON.stringify({ ...manifest, name: next.name });
        if (projectFormat)
          files[buildContextPath] = buildContextSource(await requirePlan(), next.name);
        if (project) {
          await releaseWorkspace(project);
          project = undefined;
        }
        await checkpoint();
        return { configured: true, name: next.name, contract: scaffoldInstructions(next) };
      }),
      toolDefinition({
        name: "deploy_preview",
        description:
          "Verify the staged source and activate it automatically if every check passes. On failure, fix the reported checks and retry. The working site and saved data remain unchanged on failure.",
        inputSchema: z.object({ summary: z.string().min(1).max(500) }),
      }).server(async ({ summary }) => {
        const record = await requirePlan();
        const bundle = fileBundle(files);
        validateScopedBundle(bundle, record);
        const release = await makeRelease(
          { ...spec, name: bundle.manifest.name },
          bundle,
          "model",
          summary,
          record,
          controller.signal,
        );
        release.buildRecord = { ...record, artifactHash: release.verification.sourceHash };
        await requirePlan();
        let activated = false;
        await mutateApp(access, appId, async (latest) => {
          controller.signal.throwIfAborted();
          if (latest.agentTurn?.id !== user.id || latest.agentTurn.status !== "running")
            throw new Error("This financial build turn is no longer active.");
          activated = await applyRelease(latest, release);
          controller.signal.throwIfAborted();
          latest.workspace = bundle;
        });
        return {
          activated,
          checks: release.verification.checks,
          ...(activated ? { previewUrl: `/#app=${appId}` } : {}),
        };
      }),
    ];
    const adapter = await modelAdapter();
    const options = await modelOptions("low", 16000);
    const stream = chat({
      adapter,
      abortController: controller,
      modelOptions: options,
      tools,
      agentLoopStrategy: maxIterations(18),
      messages: processor.getMessages(),
      systemPrompts: [
        ...Object.values(agentProtocols),
        ...selected,
        `Available financial capability IDs: ${JSON.stringify(Object.keys((await import("./build-policy")).capabilityDependencies))}. Current internal build record: ${JSON.stringify(prior ?? null)}. Current draft requirements for the Requirements tab: ${JSON.stringify(app.requirements ?? null)}.`,
        "Before fixture edits use prepare_build; read its selected protocols and apply the returned frontend design guidance (designGuidance) when writing presentation source. Preserve the Synthetic demo label. New React apps use fixed financial modules in the protected root route. Fixture apps may use storage.read and storage.write. Legacy fixtures also preserve finance.calculate. Matching builds may also use finance.match-companies; company-card builds may also use finance.company-cards. Use these fixed platform modules for matching, daily batches, decisions and watchlists; do not recreate their logic. Metric selection is pinned in prepare_build.cardMetrics, with omitted selection using defaults. Demo risk selection is an explicit synthetic profile, not a completed expert assessment. Market APIs, LLM explanations and plugins are not enabled for this first scoped flow. Keep unsupported financial outputs unavailable. Fixture company table uses synthetic DEMO001/DEMO002/DEMO003 companies. Live companies come from lookup_companies in live mode: Shanghai Stock Exchange Class A listed companies only, scored fuzzy matches. When the user writes a company name, an exact match is not required. If the top match clearly captures the user's intent (high score, one clear winner), state the assumed company and ticker and proceed with that assumption. If several companies match equally, ask the user to choose. If the company does not exist in the list, tell the user the platform currently supports only SSE Class A companies. Live company data uses the platform-managed Tushare token; users never provide API keys.",
        projectFormat
          ? "This app is an actual TanStack Start React/TypeScript checkout with installed libraries and local shadcn Base UI source. Call read_starter_reference to inspect exact SDK types and toolkit imports. The platform renders confirmed financial modules in its protected root. Customize src/App.tsx and presentation components only after prepare_build approves this turn. Package/build configuration, SDK, financial modules and shadcn source are immutable. Use installed shadcn components; do not recreate controls or financial logic. Use the default theme; src/app.css changes require a recorded theme override. No direct provider/LLM/network calls, generic plugins or package installation. Permissions and src/lib/build-context.ts are derived from the contract. Keep missing financial outputs unavailable. deploy_preview uses platform-owned build/type checks and financial render checks in Linux isolation."
          : "Legacy workspace: index.html is a body fragment; app.js is self-contained JavaScript with top-level await; style.css supplies styling; calculations.js exports analyze(input); cd80.json is the manifest. Preserve the source format and pure calculation scaffold. No imports, npm, CDN, fetch or external resources. Call cd80.ready() after rendering; privileged calls use cd80.call(name,input).",
        projectFormat
          ? `Current presentation specification: ${JSON.stringify(spec)}. SDK permissions are derived by the platform from the feasible financial contract.`
          : `Current scaffold specification: ${JSON.stringify(spec)}. Legacy transport contract: ${scaffoldInstructions(spec)}. Transport capability definitions: ${JSON.stringify(scopedTransportContracts)}. Only the fixture permissions above are enabled.`,
      ],
    });
    async function* tracked(): AsyncGenerator<StreamChunk> {
      let status: "complete" | "stopped" | "error" = "complete";
      let finish: StreamChunk | undefined;
      let saveError: unknown;
      let pendingSave: Promise<void> | undefined;
      const saveTimer = setInterval(() => {
        if (pendingSave || saveError) return;
        pendingSave = checkpointMessages(
          access,
          appId,
          user.id,
          compactTranscript(processor.getMessages()),
        )
          .then(() => {})
          .catch((error) => {
            saveError = error;
            controller.abort();
          })
          .finally(() => {
            pendingSave = undefined;
          });
      }, 1000);
      try {
        for await (const chunk of stream) {
          processor.processChunk(chunk);
          if (saveError) throw saveError;
          if (chunk.type === "RUN_ERROR") {
            status = "error";
            yield {
              type: EventType.RUN_ERROR,
              timestamp: Date.now(),
              message: await safeAgentError(chunk.message),
            };
          } else if (chunk.type === "RUN_FINISHED") finish = chunk;
          else yield chunk;
        }
      } catch (error) {
        status = controller.signal.aborted ? "stopped" : "error";
        if (status === "error")
          yield {
            type: EventType.RUN_ERROR,
            timestamp: Date.now(),
            message: await safeAgentError(error),
          };
      } finally {
        clearInterval(saveTimer);
        if (project) {
          await releaseWorkspace(project);
          project = undefined;
        }
        await pendingSave;
        if (controller.signal.aborted) status = "stopped";
        try {
          await mutateApp(access, appId, (latest) => {
            if (latest.agentTurn?.id !== user.id) return;
            latest.conversation = compactTranscript(processor.getMessages(), true);
            const settledTurn = {
              id: user.id,
              startedAt: latest.agentTurn?.startedAt ?? new Date().toISOString(),
              status,
              completedAt: new Date().toISOString(),
            };
            latest.agentTurn = settledTurn;
            latest.turns = (latest.turns ?? []).map((turn) =>
              turn.id === user.id ? settledTurn : turn,
            );
          });
        } finally {
          cleanup();
        }
      }
      if (finish) yield finish;
    }
    function cleanup() {
      clearTimeout(deadline);
      requestSignal.removeEventListener("abort", abort);
      activeTurns.delete(turnKey);
    }
    return tracked();
  } catch (error) {
    clearTimeout(deadline);
    requestSignal.removeEventListener("abort", abort);
    activeTurns.delete(turnKey);
    if (persisted) {
      const latest = await findApp(access, appId);
      if (latest.agentTurn) latest.agentTurn.status = "error";
      await saveApp(access, latest, latest.revision);
    }
    throw error;
  }
}
