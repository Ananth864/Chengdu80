import { modelConfiguration } from "./model-config";
import { z } from "zod";
import {
  bundleSchema,
  protocols,
  specSchema,
  type Application,
  type AppBundle,
  type ProductSpec,
  type Release,
} from "../lib/contracts";
import { calculate, defaultData, fixtureMeta } from "../lib/finance";
import { sampleBundle } from "../lib/samples";
import { auth } from "../integrations/auth";
import { clarify, explain, generate, planCapabilities } from "./models";
import { validateCapabilityPlan, parseCapabilityMarkdown } from "@web-starter/capabilities";
import { runCapabilityPlan, publicCapabilityResult } from "@web-starter/capabilities/runtime";
import { assertCapabilityArtifact, makeCapabilityRelease } from "./capability-release";
import { assertFeasible, assessDesign } from "./feasibility";
import {
  requirementsSchema,
  initialRequirements,
  designKey,
  workflowGraph,
  capabilityRequirements,
  type Requirements,
} from "../lib/planning";
import type { RegisteredPlugin } from "../lib/plugins";
import { listPlugins } from "./plugins";
import { assetUniverse, prices } from "./providers";
import { event, findApp, listApps, saveApp, mutateApp, type Access } from "./repository";
import { execute, sourceHash, verify } from "./runtime";
import { demoMode, demoOwnerId, localMode, settings } from "./settings";
import { verifyApplication, applicationDataHash } from "./browser-verification";

const text = z.string().trim().min(1).max(4000);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("plan-capabilities"), appId: z.string() }),
  z.object({ action: z.literal("simulate-capabilities"), appId: z.string() }),
  z.object({
    action: z.literal("save-capability-plan"),
    appId: z.string(),
    markdown: z.string().max(1000000),
  }),
  z.object({
    action: z.literal("save-design"),
    appId: z.string(),
    spec: specSchema,
    requirements: requirementsSchema,
  }),
  z.object({
    action: z.literal("confirm-design"),
    appId: z.string(),
    designKey: z.string().max(30000),
  }),
  z.object({ action: z.literal("assess-design"), appId: z.string() }),
  z.object({ action: z.literal("clarify"), prompt: text }),
  z.object({ action: z.literal("create-workspace"), prompt: z.string().trim().min(1).max(12000) }),
  z.object({
    action: z.literal("browser-log"),
    appId: z.string(),
    releaseId: z.string(),
    level: z.literal("error"),
    message: z.string().max(2000),
  }),
  z.object({ action: z.literal("create"), spec: specSchema, mode: z.enum(["sample", "model"]) }),
  z.object({ action: z.literal("seed") }),
  z.object({
    action: z.literal("import"),
    bundle: bundleSchema,
    spec: specSchema.optional(),
    appId: z.string().optional(),
  }),
  z.object({
    action: z.literal("update"),
    appId: z.string(),
    request: text,
    mode: z.enum(["sample", "model"]),
  }),
  z.object({
    action: z.literal("accept"),
    appId: z.string(),
    releaseId: z.string(),
    artifactHash: z.string().optional(),
  }),
  z.object({ action: z.literal("discard"), appId: z.string(), releaseId: z.string() }),
  z.object({ action: z.literal("reverify"), appId: z.string(), releaseId: z.string() }),
  z.object({
    action: z.literal("rpc"),
    appId: z.string(),
    releaseId: z.string(),
    capability: z.string(),
    input: z.unknown(),
  }),
  z.object({
    action: z.literal("test-provider"),
    provider: z.enum(["fixtures", "alpha-demo", "tushare"]),
  }),
  z.object({
    action: z.literal("load-prices"),
    appId: z.string(),
    provider: z.enum(["fixtures", "alpha-demo", "tushare"]),
  }),
]);
export async function accessFor(request: Request): Promise<Access> {
  if (await localMode()) {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname))
      throw new Error("Local prototype is restricted to loopback");
    return { ownerId: "local-prototype-owner", accessToken: null };
  }
  if (await demoMode()) return { ownerId: demoOwnerId, accessToken: null };
  const session = await auth.getSession();
  if (!session.viewer || !session.accessToken) throw new Error("Authentication required");
  return { ownerId: session.viewer.id, accessToken: session.accessToken };
}
export async function snapshot(access: Access) {
  const config = await settings();
  return {
    apps: await listApps(access),
    protocols,
    status: {
      local: await localMode(),
      demo: await demoMode(),
      model: modelConfiguration(config).model,
      modelProvider: modelConfiguration(config).provider,
      modelConfigured: !!modelConfiguration(config).apiKey,
      tushareConfigured: !!config.TUSHARE_TOKEN,
      hostedDatabaseConfigured: !!config.VITE_CONVEX_URL,
      runtime: "Miniflare workerd sandbox",
    },
  };
}
export async function makeRelease(
  spec: ProductSpec,
  bundle: AppBundle,
  origin: Release["origin"],
  notes: string,
  design?: { requirements: Requirements; plugins: RegisteredPlugin[] },
): Promise<Release> {
  if (design?.requirements.capabilityPlan) return makeCapabilityRelease(spec, design.requirements);
  assertFeasible(spec);
  const requirements = design?.requirements ?? {
    ...initialRequirements(),
    dataSource: origin === "sample" ? ("fixtures" as const) : ("user" as const),
    analysisPeriod: spec.protocol === "strategy" ? "Provided chronological price series" : "",
  };
  const report = await assessDesign(spec, requirements, design?.plugins ?? []);
  if (report.outcome !== "pass")
    throw new Error(
      `Feasibility requires revision: ${report.checks
        .filter((check) => check.status !== "supported")
        .map((check) => check.reason)
        .join("; ")}`,
    );
  return {
    id: crypto.randomUUID(),
    bundle,
    spec,
    verification: await verify(bundle, spec),
    createdAt: new Date().toISOString(),
    origin,
    notes,
    requirements,
    feasibility: report,
    workflow: workflowGraph(spec, requirements, bundle),
  };
}
function newApp(access: Access, spec: ProductSpec): Application {
  return {
    id: crypto.randomUUID(),
    ownerId: access.ownerId,
    name: spec.name,
    spec,
    revision: 0,
    current: null,
    preview: null,
    data: { inputs: defaultData(spec.protocol), _provenance: fixtureMeta },
    history: [],
    events: [],
    createdAt: new Date().toISOString(),
  };
}
// Verified source becomes active atomically; failed builds preserve the working release.
export async function applyRelease(app: Application, release: Release, access?: Access) {
  if (!release.capabilityArtifact && capabilityMode(app))
    throw new Error("Capability-backed designs cannot be replaced by legacy source releases.");
  if (release.capabilityArtifact) {
    await assertCapabilityArtifact(release, false);
    if (!release.simulationPassed) {
      app.preview = release;
      return false;
    }
    const ready = validateCapabilityPlan(
      release.capabilityArtifact.plan,
      capabilityRequirements(release.spec, release.requirements!),
    ).productionReady;
    if (
      !ready ||
      release.capabilityArtifact.simulation ||
      release.approval?.artifactHash !== release.capabilityArtifact.artifactHash ||
      release.approval.ownerId !== app.ownerId
    ) {
      app.preview = release;
      return false;
    }
  }
  assertFeasible(release.spec);
  if (!release.verification.passed) {
    app.preview = release;
    return false;
  }
  if (release.verification.sourceHash !== (await sourceHash(release.bundle)))
    throw new Error("Source changed after verification.");
  const dataHash = applicationDataHash(app.data);
  const context = { ...app, enabledPlugins: [...(app.enabledPlugins ?? [])] };
  const checks = await verifyApplication(
    release,
    context,
    access ?? { ownerId: app.ownerId, accessToken: null },
  );
  release.verification.checks = release.verification.checks.filter(
    (check) =>
      ![
        "Saved input compatibility",
        "Browser rendering",
        "Browser interaction and persistence",
        "Application browser verification",
      ].includes(check.name),
  );
  release.verification.checks.push(...checks);
  release.verification.passed = release.verification.checks.every((check) => check.passed);
  if (!release.verification.passed) {
    app.preview = release;
    return false;
  }
  release.verification.application = {
    dataHash,
    checkedAt: new Date().toISOString(),
    environment: "chromium-isolated-fixtures",
  };
  if (app.current) app.history = [app.current, ...app.history].slice(0, 2);
  else if (app.spec.protocol !== release.spec.protocol) {
    app.data.inputs = defaultData(release.spec.protocol);
    app.data._provenance = fixtureMeta;
  }
  app.current = release;
  app.preview = null;
  app.spec = release.spec;
  app.name = release.spec.name;
  app.workspace = release.bundle;
  app.workspaceSpec = release.spec;
  app.requirements = release.requirements ?? initialRequirements();
  app.feasibility = release.feasibility;
  app.workflow = release.workflow ?? workflowGraph(release.spec, app.requirements, release.bundle);
  if (app.confirmedDesign !== designKey(release.spec, app.requirements))
    app.confirmedDesign = undefined;
  return true;
}
function capabilityMode(app: Application) {
  return !!(
    app.capabilityMode ||
    app.requirements?.capabilityPlan ||
    app.current?.capabilityArtifact ||
    app.preview?.capabilityArtifact ||
    app.history.some((release) => release.capabilityArtifact)
  );
}
async function build(
  spec: ProductSpec,
  mode: "model" | "sample",
  request: string,
  previous?: Release,
) {
  assertFeasible(spec);
  if (mode === "sample")
    return makeRelease(
      spec,
      sampleBundle(spec),
      "sample",
      "Deterministic example builder. No model generation was used.",
    );
  let release = await makeRelease(spec, await generate(spec, request, previous), "model", request);
  if (!release.verification.passed)
    release = await makeRelease(
      spec,
      await generate(
        spec,
        request,
        release,
        JSON.stringify(release.verification.checks.filter((c) => !c.passed)),
      ),
      "model",
      request + " · one automatic repair attempt",
    );
  return release;
}
export async function dispatch(access: Access, raw: unknown) {
  const req = requestSchema.parse(raw);
  if (req.action === "create-workspace") {
    const app = newApp(access, {
      ...protocols[0]!.defaultSpec,
      name: "New chat",
      purpose: req.prompt.length >= 10 ? req.prompt.slice(0, 4000) : `Conversation: ${req.prompt}`,
    });
    app.chatTitle = "New chat";
    app.conversation = [];
    const scaffold = sampleBundle(app.spec);
    scaffold.files["index.html"] = '<main id="app"></main>';
    scaffold.files["app.js"] = "cd80.ready();";
    scaffold.files["style.css"] = "";
    app.workspace = scaffold;
    app.workspaceSpec = app.spec;
    app.requirements = {
      ...initialRequirements(),
      missingInputs: ["Review the interpreted purpose, inputs, outputs and data source."],
    };
    app.workflow = workflowGraph(app.spec, app.requirements);
    const saved = await saveApp(access, app, null);
    const { generateChatTitle } = await import("./chat-title");
    void generateChatTitle(req.prompt)
      .then(async (title) => {
        await mutateApp(access, saved.id, (current) => {
          current.chatTitle = title;
        });
      })
      .catch(() => {});
    return saved;
  }
  if (req.action === "clarify") {
    const gate = assertFeasible(req.prompt);
    const config = await settings();
    const spec = modelConfiguration(config).apiKey
      ? await clarify(req.prompt)
      : (await import("../lib/contracts")).getSuggestedSpec(req.prompt);
    assertFeasible(spec);
    return {
      spec,
      generatedBy: modelConfiguration(config).apiKey ? "model" : "sample",
      feasibility: gate,
    };
  }
  if (req.action === "test-provider") {
    const result = await prices({ symbol: "600104.SHH", provider: req.provider });
    return { meta: result.meta, count: result.prices.length, latest: result.prices.at(-1) };
  }
  if (req.action === "seed") {
    const existing = await listApps(access);
    const created: Application[] = [];
    for (const p of protocols) {
      if (existing.some((a) => a.current?.origin === "sample" && a.spec.protocol === p.id))
        continue;
      const app = newApp(access, p.defaultSpec);
      const release = await build(app.spec, "sample", "Install example");
      await applyRelease(app, release, access);
      event(app, "Installed a labelled example application.");
      created.push(await saveApp(access, app, null));
    }
    return created;
  }
  if (req.action === "create") {
    assertFeasible(req.spec);
    const app = newApp(access, req.spec);
    const active = await applyRelease(
      app,
      await build(app.spec, req.mode, "Build the product specification"),
      access,
    );
    event(
      app,
      active
        ? "Generated and activated the verified application."
        : "Generation failed verification.",
    );
    return saveApp(access, app, null);
  }
  if (req.action === "import") {
    const spec = req.spec ?? {
      ...protocols.find((p) => p.id === req.bundle.manifest.protocol)!.defaultSpec,
      name: req.bundle.manifest.name,
    };
    const app = req.appId ? await findApp(access, req.appId) : newApp(access, spec);
    if (capabilityMode(app))
      throw new Error(
        "Capability-backed designs cannot be replaced by legacy source imports. Review a revised capability plan instead.",
      );
    if (
      app.agentTurn?.status === "running" &&
      Date.now() - Date.parse(app.agentTurn.startedAt) < 300000
    )
      throw new Error("Stop the active agent turn before importing source.");
    if (req.appId && spec.protocol !== app.spec.protocol)
      throw new Error(
        "Changing an existing app's protocol requires a new app to protect its data.",
      );
    const active = await applyRelease(
      app,
      await makeRelease(spec, req.bundle, "import", "Imported application source"),
      access,
    );
    event(
      app,
      active
        ? "Imported and activated verified source."
        : "Imported source failed verification; working app retained.",
    );
    return saveApp(access, app, req.appId ? app.revision : null);
  }
  const app = await findApp(access, req.appId);
  if (
    req.action === "plan-capabilities" ||
    req.action === "save-capability-plan" ||
    req.action === "simulate-capabilities"
  ) {
    if (
      app.agentTurn?.status === "running" &&
      Date.now() - Date.parse(app.agentTurn.startedAt) < 300000
    )
      throw new Error("Stop the active agent turn before reviewing capabilities.");
    const spec = app.workspaceSpec ?? app.spec;
    const requirements = app.requirements ?? initialRequirements();
    if (req.action === "simulate-capabilities") {
      const release = await makeCapabilityRelease(spec, requirements);
      await applyRelease(app, release);
      event(app, "Created a contract-tested mock simulation. Production activation is blocked.");
    } else {
      const expected = capabilityRequirements(spec, requirements);
      const plan =
        req.action === "plan-capabilities"
          ? await planCapabilities(expected)
          : parseCapabilityMarkdown(req.markdown).plan;
      const validation = validateCapabilityPlan(plan, expected);
      if (!validation.valid)
        throw new Error(validation.issues.map((issue) => issue.message).join("; "));
      app.requirements = { ...requirements, capabilityPlan: plan };
      app.capabilityMode = true;
      app.confirmedDesign = undefined;
      app.feasibility = await assessDesign(spec, app.requirements, await listPlugins(access));
      app.workflow = workflowGraph(spec, app.requirements);
      event(app, "Recorded pinned capability steps and explicit partial coverage/gaps.");
    }
    return saveApp(access, app, app.revision);
  }
  if (
    req.action === "save-design" ||
    req.action === "confirm-design" ||
    req.action === "assess-design"
  ) {
    if (
      app.agentTurn?.status === "running" &&
      Date.now() - Date.parse(app.agentTurn.startedAt) < 300000
    )
      throw new Error("Stop the active agent turn before reviewing the design.");
    const spec = req.action === "save-design" ? req.spec : (app.workspaceSpec ?? app.spec);
    const requirements =
      req.action === "save-design" ? req.requirements : (app.requirements ?? initialRequirements());
    if (app.current && spec.protocol !== app.spec.protocol)
      throw new Error("An active app's calculation protocol cannot change.");
    const report = await assessDesign(spec, requirements, await listPlugins(access));
    if (req.action === "confirm-design") {
      if (req.designKey !== designKey(spec, requirements))
        throw new Error("Design changed. Refresh before confirming.");
      if (report.outcome !== "pass")
        throw new Error("Resolve feasibility issues before confirming the design.");
      app.confirmedDesign = req.designKey;
    } else if (req.action === "save-design") app.confirmedDesign = undefined;
    app.workspaceSpec = spec;
    app.requirements = requirements;
    app.feasibility = report;
    app.workflow = workflowGraph(spec, requirements);
    event(
      app,
      req.action === "confirm-design"
        ? "User confirmed application requirements."
        : "Reviewed draft requirements and feasibility.",
    );
    return saveApp(access, app, app.revision);
  }
  if (req.action === "browser-log") {
    if (![app.current?.id, app.preview?.id].includes(req.releaseId))
      throw new Error("Unknown release");
    await mutateApp(access, app.id, (current) => {
      current.browserEvents = [
        { releaseId: req.releaseId, at: new Date().toISOString(), message: req.message },
        ...(current.browserEvents ?? []),
      ].slice(0, 20);
    });
    return { recorded: true };
  }
  if (req.action === "reverify") {
    if (app.preview?.id !== req.releaseId) throw new Error("Preview changed. Refresh first.");
    if (app.preview.capabilityArtifact) {
      await assertCapabilityArtifact(app.preview);
      throw new Error(
        "Mock capabilities cannot be promoted by source re-verification. Rebuild the simulation instead.",
      );
    }
    app.preview.verification = await verify(app.preview.bundle, app.preview.spec);
    const active = await applyRelease(app, app.preview, access);
    event(
      app,
      active
        ? "Verified source activated."
        : "Source still fails verification; working app retained.",
    );
    return saveApp(access, app, app.revision);
  }
  if (req.action === "load-prices") {
    if (app.spec.protocol !== "strategy" || !app.current)
      throw new Error("Build a strategy app before loading a price series.");
    if (req.provider === "alpha-demo" && !(await localMode()))
      throw new Error(
        "The public demo provider is restricted to local technical tests. Configure a licensed hosted provider instead.",
      );
    const result = await prices({ symbol: "600104.SHH", provider: req.provider });
    const rows = result.prices.slice(-252);
    const inputs = {
      ...(app.data.inputs as any),
      prices: rows.map((r: any) => r.close),
      feeBps: (app.data.inputs as any)?.feeBps ?? 10,
    };
    await execute(app.current.bundle, inputs);
    app.data.inputs = inputs;
    app.data._provenance = {
      ...result.meta,
      coverage: `${rows[0]!.date} to ${rows.at(-1)!.date}`,
      symbol: result.symbol,
      observations: rows.length,
    };
    event(app, `Loaded ${rows.length} daily closes from ${result.meta.provider}.`);
    return saveApp(access, app, app.revision);
  }
  if (req.action === "update") {
    if (capabilityMode(app))
      throw new Error(
        "Revise the pinned capability plan and rebuild its preview instead of generating financial logic.",
      );
    assertFeasible(req.request);
    const spec = {
      ...app.spec,
      constraints: [...app.spec.constraints, `Change: ${req.request}`].slice(-20),
    };
    const active = await applyRelease(
      app,
      await build(spec, req.mode, req.request, app.current ?? app.preview ?? undefined),
      access,
    );
    event(
      app,
      active
        ? "Applied verified changes. Shared data retained."
        : "Update failed verification; working app and data retained.",
    );
    return saveApp(access, app, app.revision);
  }
  if (req.action === "accept") {
    const release = app.preview;
    if (release?.capabilityArtifact) {
      await assertCapabilityArtifact(release);
      if (
        !validateCapabilityPlan(release.capabilityArtifact.plan).productionReady ||
        release.capabilityArtifact.simulation
      )
        throw new Error(
          "Mock or unverified financial capabilities cannot be approved for production.",
        );
      if (req.artifactHash !== release.capabilityArtifact.artifactHash)
        throw new Error("Artifact changed. Refresh before approval.");
      release.approval = {
        artifactHash: req.artifactHash,
        ownerId: access.ownerId,
        approvedAt: new Date().toISOString(),
      };
    }
    if (
      !release ||
      release.id !== req.releaseId ||
      !release.verification.passed ||
      release.verification.sourceHash !== (await sourceHash(release.bundle))
    )
      throw new Error("A verified, unchanged preview is required before accepting a release.");
    await applyRelease(app, release, access);
    event(app, "Activated verified source. Shared data retained.");
    return saveApp(access, app, app.revision);
  }
  if (req.action === "discard") {
    if (app.preview?.id !== req.releaseId) throw new Error("Preview changed. Refresh first.");
    app.preview = null;
    event(app, "Discarded the preview. The accepted release is unchanged.");
    return saveApp(access, app, app.revision);
  }
  const release = [app.current, app.preview].find((r) => r?.id === req.releaseId);
  if (release?.capabilityArtifact) {
    await assertCapabilityArtifact(release);
    if (req.capability !== "capability.flow")
      throw new Error("Capability simulations may call only their pinned registered flow");
    const input = z.strictObject({ inputs: z.record(z.string(), z.unknown()) }).parse(req.input);
    if (JSON.stringify(input).length > 150000)
      throw new Error("Capability input exceeds size limit");
    return publicCapabilityResult(
      release.capabilityArtifact.plan,
      await runCapabilityPlan(release.capabilityArtifact.plan, input.inputs),
    );
  }
  if (
    !release?.verification.passed ||
    !release.bundle.manifest.permissions.includes(req.capability as any)
  )
    throw new Error("Verified release and declared capability permission required");
  if (JSON.stringify(req.input ?? null).length > 150000)
    throw new Error("Capability input exceeds size limit");
  if (req.capability === "plugin.call") {
    const input = z
      .object({
        pluginId: z.string(),
        operationId: z.string(),
        parameters: z.record(z.string(), z.unknown()).default({}),
      })
      .parse(req.input);
    if (!app.enabledPlugins?.includes(input.pluginId))
      throw new Error("Plugin is not enabled for this app");
    return (await import("./plugins")).callPlugin(
      access,
      input.pluginId,
      input.operationId,
      input.parameters,
      { appId: app.id, releaseId: release.id },
    );
  }
  if (req.capability === "finance.calculate") return execute(release.bundle, req.input);
  if (req.capability === "finance.portfolio") return calculate("portfolio", req.input);
  if (req.capability === "finance.screen") return calculate("screening", req.input);
  if (req.capability === "finance.backtest") return calculate("strategy", req.input);
  if (req.capability === "market.assets") return assetUniverse();
  if (req.capability === "market.prices") {
    const input = z
      .object({ provider: z.enum(["fixtures", "tushare"]).default("fixtures"), symbol: z.string() })
      .parse(req.input);
    return prices(input);
  }
  if (req.capability === "storage.read") {
    const { key } = z.object({ key: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/) }).parse(req.input);
    return app.data[key] ?? null;
  }
  if (req.capability === "storage.write") {
    if (app.current?.id !== release.id)
      throw new Error("Only the active verified release can change shared data.");
    const { key, value } = z
      .object({ key: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/), value: z.unknown() })
      .parse(req.input);
    if (key.startsWith("_")) throw new Error("Reserved platform metadata key");
    if (key === "inputs") await execute(release.bundle, value);
    if (JSON.stringify({ ...app.data, [key]: value }).length > 150000)
      throw new Error("Shared data exceeds prototype size limit");
    app.data[key] = value;
    if (key === "inputs")
      app.data._provenance = {
        provider: "User-entered inputs",
        synthetic: false,
        currency: "CNY",
        warning: "Inputs were edited by the account owner and have not been independently sourced.",
      };
    event(app, `Updated shared data: ${key}`);
    await saveApp(access, app, app.revision);
    return { saved: true };
  }
  if (req.capability === "ai.explain") {
    const input = z.object({ question: text, result: z.unknown() }).parse(req.input);
    return explain(input.question, {
      result: await execute(release.bundle, app.data.inputs),
      protocol: app.spec.protocol,
      provenance: app.data._provenance ?? fixtureMeta,
    });
  }
  throw new Error("Unsupported capability");
}
