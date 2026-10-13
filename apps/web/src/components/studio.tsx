import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  FileCode2,
  FolderOpen,
  Layers,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@web-starter/ui/components/alert";
import { Button } from "@web-starter/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@web-starter/ui/components/card";
import { Input } from "@web-starter/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@web-starter/ui/components/select";
import { Separator } from "@web-starter/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@web-starter/ui/components/tabs";
import { Textarea } from "@web-starter/ui/components/textarea";
import { cn } from "@web-starter/ui/lib/utils";
import { api, download } from "../lib/client";
import {
  bundleSchema,
  protocolFor,
  protocols,
  type Application,
  type ProductSpec,
  type Release,
} from "../lib/contracts";
import { AppFrame } from "./app-frame";

type Snapshot = {
  apps: Application[];
  status: {
    local: boolean;
    demo: boolean;
    model: string;
    modelConfigured: boolean;
    tushareConfigured: boolean;
    runtime: string;
  };
};
type Tab = "preview" | "checks" | "source" | "spec" | "data";

export function Studio() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState<ProductSpec | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("preview");
  const [showPreview, setShowPreview] = useState(true);
  const [mode, setMode] = useState<"sample" | "model">("sample");
  const [sourceFile, setSourceFile] = useState("app.js");
  const [imported, setImported] = useState<any>(null);
  const [providerResult, setProviderResult] = useState<any>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const app = snapshot?.apps.find((a) => a.id === selected) ?? null;
  const release =
    app && (showPreview ? (app.preview ?? app.current) : (app.current ?? app.preview));

  async function refresh() {
    const data = await api<Snapshot>();
    setSnapshot(data);
    return data;
  }
  useEffect(() => {
    let mounted = true;
    api<Snapshot>()
      .then((data) => {
        if (!mounted) return;
        setSnapshot(data);
        setMode(data.status.modelConfigured ? "model" : "sample");
        const id = new URLSearchParams(window.location.hash.slice(1)).get("app");
        if (id && data.apps.some((a) => a.id === id)) setSelected(id);
      })
      .catch((e) => mounted && setError(e.message));
    return () => {
      mounted = false;
    };
  }, []);
  function select(id: string | null) {
    setSelected(id);
    setDraft(null);
    setImported(null);
    setPrompt("");
    setError("");
    setTab("preview");
    setShowPreview(true);
    window.history.replaceState(null, "", id ? `/#app=${id}` : "/");
  }
  async function run(label: string, task: () => Promise<any>) {
    if (busy) return;
    setBusy(label);
    setError("");
    try {
      return await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy("");
    }
  }
  async function suggest() {
    if (!prompt.trim()) return;
    await run("Preparing a product specification…", async () => {
      const result = await api({ action: "clarify", prompt });
      setDraft(result.spec);
    });
  }
  async function create() {
    if (!draft) return;
    await run(
      mode === "model"
        ? "Generating source and running verification…"
        : "Building the example and running verification…",
      async () => {
        const next = await api<Application>({ action: "create", spec: draft, mode });
        await refresh();
        select(next.id);
        setTab(next.preview?.verification.passed ? "preview" : "checks");
      },
    );
  }
  async function update() {
    if (!app || !prompt.trim()) return;
    await run("Building an update preview and checking calculations…", async () => {
      const next = await api<Application>({
        action: "update",
        appId: app.id,
        request: prompt,
        mode,
      });
      await refresh();
      setShowPreview(true);
      setPrompt("");
      setTab(next.preview?.verification.passed ? "preview" : "checks");
    });
  }
  async function importFiles(files: FileList | null) {
    if (!files?.length) return;
    await run("Reading application source…", async () => {
      if (
        Array.from(files).some((f) => f.size > 200000) ||
        Array.from(files).reduce((n, f) => n + f.size, 0) > 250000
      )
        throw new Error("Source upload exceeds 250 KB.");
      let bundle;
      if (files.length === 1 && files[0].name.endsWith(".json"))
        bundle = JSON.parse(await files[0].text());
      else {
        const entries = await Promise.all(
          Array.from(files).map(async (f) => [f.name, await f.text()] as const),
        );
        const map = Object.fromEntries(entries);
        if (!map["cd80.json"])
          throw new Error(
            "Select cd80.json, index.html, app.js, calculations.js, and style.css together.",
          );
        bundle = {
          manifest: JSON.parse(map["cd80.json"]),
          files: Object.fromEntries(entries.filter(([name]) => name !== "cd80.json")),
        };
      }
      setImported(bundleSchema.parse(bundle));
      setDraft(null);
    });
    if (file.current) file.current.value = "";
  }
  async function confirmImport() {
    if (!imported) return;
    await run("Verifying imported application source…", async () => {
      const next = await api<Application>({ action: "import", bundle: imported, appId: app?.id });
      await refresh();
      select(next.id);
      setTab(next.preview?.verification.passed ? "preview" : "checks");
    });
  }

  return (
    <main className="grid min-h-[calc(100vh-56px)] grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)]">
      <aside className="flex flex-row items-center gap-2 overflow-x-auto border-b bg-card p-3 md:min-h-[calc(100vh-56px)] md:flex-col md:items-stretch md:gap-0 md:border-r md:border-b-0 md:p-5">
        <div className="mb-4 hidden items-center justify-between px-1 text-[10px] font-bold tracking-wide text-muted-foreground md:flex">
          <span>YOUR WORKSPACE</span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Create new app"
            onClick={() => select(null)}
            disabled={!!busy}
          >
            <Plus />
          </Button>
        </div>
        <Button
          className="w-auto shrink-0 justify-center md:w-full"
          onClick={() => select(null)}
          disabled={!!busy}
        >
          <Plus /> <span className="hidden sm:inline">New application</span>
        </Button>
        <div className="flex flex-1 gap-1.5 overflow-x-auto md:mt-6 md:mb-6 md:flex-col md:overflow-visible">
          {snapshot?.apps.map((a) => (
            <button
              key={a.id}
              onClick={() => select(a.id)}
              disabled={!!busy}
              className={cn(
                "flex w-40 shrink-0 items-center gap-2.5 rounded-md border border-transparent px-2.5 py-2.5 text-left text-muted-foreground transition-colors hover:bg-muted md:w-full",
                a.id === selected && "border-primary/20 bg-primary/10 text-primary",
              )}
            >
              <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-accent text-accent-foreground">
                <Layers size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-xs font-semibold">{a.name}</strong>
                <small className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                  {a.preview
                    ? a.preview.verification.passed
                      ? "Preview ready"
                      : "Checks need attention"
                    : "Accepted release"}
                </small>
              </span>
              <ChevronRight size={13} className="hidden shrink-0 md:block" />
            </button>
          ))}
          {snapshot && !snapshot.apps.length && (
            <p className="hidden p-2 text-xs leading-relaxed text-muted-foreground md:block">
              Your applications will appear here. Start with an idea or import source.
            </p>
          )}
        </div>
        <div className="hidden items-start gap-2.5 border-t pt-4 text-[11px] leading-relaxed text-muted-foreground md:flex">
          <LockKeyhole size={14} className="mt-0.5 shrink-0" />
          <span>
            {snapshot?.status.local
              ? "Local workspace"
              : snapshot?.status.demo
                ? "Shared demo workspace"
                : "Private to your account"}
            <br />
            <small className="text-[10px]">Shared data within each app</small>
          </span>
        </div>
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="mt-2 flex shrink-0 items-center gap-2 rounded-md border bg-background px-2.5 py-2.5 text-[11px] text-muted-foreground md:mt-3"
        >
          <span
            className={cn(
              "size-1.5 shrink-0 rounded-full bg-amber-500",
              snapshot?.status.modelConfigured && "bg-emerald-500",
            )}
          />
          <span className="hidden sm:inline">
            {snapshot?.status.modelConfigured ? snapshot.status.model : "Connections"}
          </span>
          <ChevronRight size={12} className="ml-auto hidden md:block" />
        </button>
      </aside>

      <section className="min-w-0 p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground">
              Your financial workspace
            </p>
            <h1 className="text-xl font-semibold tracking-tight">
              {app ? app.name : "A little clarity for your finances."}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {app?.current && (
              <a
                href={`/app/${app.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ArrowUpRight size={15} /> Open app
              </a>
            )}
            <Button variant="outline" onClick={() => file.current?.click()} disabled={!!busy}>
              <Upload /> Import source
            </Button>
            {release && (
              <Button
                variant="outline"
                onClick={() =>
                  download(
                    `${app!.name.replaceAll(/[^a-zA-Z0-9]/g, "-")}.cd80.json`,
                    JSON.stringify(release.bundle, null, 2),
                  )
                }
              >
                <Code2 /> Export source
              </Button>
            )}
          </div>
        </div>
        <input
          ref={file}
          type="file"
          accept=".json,.html,.js,.css"
          multiple
          hidden
          onChange={(e) => void importFiles(e.target.files)}
        />
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription className="flex items-center gap-2">
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError("")}
                aria-label="Dismiss error"
                className="shrink-0 text-destructive"
              >
                <X size={14} />
              </button>
            </AlertDescription>
          </Alert>
        )}
        {busy && (
          <Alert className="mb-4 border-primary/20 bg-primary/5">
            <AlertDescription className="flex items-center gap-2 text-foreground">
              <Loader2 className="size-3.5 shrink-0 animate-spin" />
              {busy}
            </AlertDescription>
          </Alert>
        )}
        {settingsOpen && (
          <Card className="mb-5">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Settings2 size={16} /> Connections
              </CardTitle>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close connections"
                onClick={() => setSettingsOpen(false)}
              >
                <X />
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {snapshot?.status.local
                  ? "Local mode stores this workspace on this computer. Login is deferred for the prototype."
                  : snapshot?.status.demo
                    ? "This demo has no login. All visitors share its apps and data, stored in Convex."
                    : "Hosted account mode uses WorkOS identity and Convex storage."}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border bg-muted/40 p-3.5">
                  <span className="block text-[10px] text-muted-foreground">Main model</span>
                  <strong className="my-1.5 block text-xs font-semibold">
                    {snapshot?.status.model}
                  </strong>
                  <small className="block text-[10px] leading-relaxed text-muted-foreground">
                    {snapshot?.status.modelConfigured
                      ? "Key configured; request testing required"
                      : "Add the model key and endpoint to .env, then restart"}
                  </small>
                </div>
                <div className="rounded-md border bg-muted/40 p-3.5">
                  <span className="block text-[10px] text-muted-foreground">
                    Application runtime
                  </span>
                  <strong className="my-1.5 block text-xs font-semibold">
                    {snapshot?.status.runtime}
                  </strong>
                  <small className="block text-[10px] leading-relaxed text-muted-foreground">
                    Numerical code executes in a separate Worker
                  </small>
                </div>
                <div className="rounded-md border bg-muted/40 p-3.5">
                  <span className="block text-[10px] text-muted-foreground">Financial data</span>
                  <strong className="my-1.5 block text-xs font-semibold">
                    {snapshot?.status.tushareConfigured
                      ? "Tushare + fixtures"
                      : "Synthetic fixtures"}
                  </strong>
                  <small className="block text-[10px] leading-relaxed text-muted-foreground">
                    Real test endpoint available on demand
                  </small>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {app?.current && app.spec.protocol === "strategy" && (
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    onClick={() =>
                      void run("Loading daily closing prices into this app…", async () => {
                        await api({
                          action: "load-prices",
                          appId: app.id,
                          provider: snapshot?.status.local ? "alpha-demo" : "tushare",
                        });
                        await refresh();
                        setShowPreview(false);
                      })
                    }
                  >
                    Load real prices into this app
                  </Button>
                )}
                <Button
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    void run("Checking the real financial test API…", async () =>
                      setProviderResult(
                        await api({ action: "test-provider", provider: "alpha-demo" }),
                      ),
                    )
                  }
                >
                  Test real financial API
                </Button>
                <Button
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => void run("Refreshing connections…", refresh)}
                >
                  <RefreshCw /> Refresh
                </Button>
              </div>
              {providerResult && (
                <pre className="max-w-full overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-[11px] text-muted-foreground">
                  {JSON.stringify(providerResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        )}
        {app ? (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="min-h-[650px] overflow-hidden py-0">
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  setTab(v as Tab);
                  if (v === "data") void refresh();
                }}
              >
                <div className="flex items-center justify-between gap-3 border-b px-3">
                  <TabsList variant="line" className="h-auto gap-4 bg-transparent p-0">
                    {(["preview", "checks", "source", "spec", "data"] as Tab[]).map((t) => (
                      <TabsTrigger
                        key={t}
                        value={t}
                        className="h-auto rounded-none border-0 px-0 py-3.5 text-[11px] text-muted-foreground after:bottom-0 data-active:bg-transparent data-active:text-primary"
                      >
                        {t === "checks"
                          ? `Checks ${release?.verification.checks.filter((c) => c.passed).length ?? 0}/${release?.verification.checks.length ?? 0}`
                          : t[0].toUpperCase() + t.slice(1)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {app.preview && app.current && (
                    <Select
                      value={showPreview ? "preview" : "current"}
                      onValueChange={(v) => setShowPreview(v === "preview")}
                    >
                      <SelectTrigger size="sm" aria-label="Displayed version">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preview">Update preview</SelectItem>
                        <SelectItem value="current">Accepted release</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {app.preview && showPreview && (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2.5 border-b px-3 py-3 text-[11px]",
                      app.preview.verification.passed
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-red-50 text-red-800",
                    )}
                  >
                    <ShieldCheck size={16} className="shrink-0" />
                    <span className="min-w-[140px] flex-1">
                      {app.preview.verification.passed
                        ? "Verified preview. Review the app before accepting."
                        : "Verification failed. This preview cannot go live."}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() =>
                        void run("Running release checks…", async () => {
                          await api({
                            action: "reverify",
                            appId: app.id,
                            releaseId: app.preview!.id,
                          });
                          await refresh();
                        })
                      }
                    >
                      Re-run checks
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!!busy}
                      onClick={() =>
                        void run("Discarding preview…", async () => {
                          await api({
                            action: "discard",
                            appId: app.id,
                            releaseId: app.preview!.id,
                          });
                          await refresh();
                        })
                      }
                    >
                      Discard
                    </Button>
                    <Button
                      size="sm"
                      disabled={!!busy || !app.preview.verification.passed}
                      onClick={() =>
                        void run("Accepting verified release…", async () => {
                          await api({
                            action: "accept",
                            appId: app.id,
                            releaseId: app.preview!.id,
                          });
                          await refresh();
                          setShowPreview(false);
                        })
                      }
                    >
                      <Check /> Use this version
                    </Button>
                  </div>
                )}
                {!release ? (
                  <PanelEmpty
                    icon={<FolderOpen />}
                    title="No release yet"
                    description="Request a new build or import application source."
                  />
                ) : (
                  <>
                    <TabsContent value="preview" className="mt-0">
                      {release.verification.passed ? (
                        <AppFrame app={app} release={release} />
                      ) : (
                        <PanelEmpty
                          icon={<ShieldCheck />}
                          title="Review the failed checks"
                          description="Application execution is disabled until mandatory verification passes."
                        >
                          <Button variant="outline" onClick={() => setTab("checks")}>
                            View checks
                          </Button>
                        </PanelEmpty>
                      )}
                    </TabsContent>
                    <TabsContent value="checks" className="mt-0 p-6">
                      <Checks release={release} />
                    </TabsContent>
                    <TabsContent value="source" className="mt-0 p-6">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <Select
                          value={sourceFile}
                          onValueChange={(v) => setSourceFile(v ?? "app.js")}
                        >
                          <SelectTrigger aria-label="Source file">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(release.bundle.files).map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            download(
                              sourceFile,
                              release.bundle.files[sourceFile as keyof typeof release.bundle.files],
                              "text/plain",
                            )
                          }
                        >
                          Download file
                        </Button>
                      </div>
                      <pre className="max-h-[560px] max-w-full overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                        {release.bundle.files[sourceFile as keyof typeof release.bundle.files]}
                      </pre>
                    </TabsContent>
                    <TabsContent value="spec" className="mt-0 p-6">
                      <SpecView spec={release.spec} />
                    </TabsContent>
                    <TabsContent value="data" className="mt-0 p-6">
                      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                        Shared application data. Edit it inside the accepted app. Updates retain
                        this data.
                      </p>
                      <pre className="max-w-full overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-[11px] text-muted-foreground">
                        {JSON.stringify(app.data, null, 2)}
                      </pre>
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </Card>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={16} /> Continue building
              </h2>
              <p className="my-3.5 text-xs leading-relaxed text-muted-foreground">
                Describe a change. The accepted app keeps running while you review its next version.
              </p>
              <ModeSelect
                mode={mode}
                setMode={setMode}
                connected={!!snapshot?.status.modelConfigured}
              />
              <div className="my-6 space-y-5">
                <ConversationItem avatar="C80" title="Product specification confirmed">
                  <p>{app.spec.purpose}</p>
                  <small>{protocolFor(app.spec.protocol).name} protocol · version 1</small>
                </ConversationItem>
                {app.preview && (
                  <ConversationItem
                    avatar={<ShieldCheck size={14} />}
                    title={
                      app.preview.verification.passed
                        ? "Preview passed its checks"
                        : "Preview needs corrections"
                    }
                  >
                    <p>{app.preview.notes}</p>
                    <small>
                      {app.preview.origin === "sample"
                        ? "Example builder. No model call."
                        : app.preview.origin === "import"
                          ? "Imported source code"
                          : snapshot?.status.model}
                    </small>
                  </ConversationItem>
                )}
              </div>
              <div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Add a concentration warning above 35% and a clearer position table"
                  aria-label="Application change request"
                  className="min-h-[110px] text-xs"
                />
                <Button
                  disabled={!!busy || !prompt.trim()}
                  onClick={() => void update()}
                  className="mt-2.5 w-full"
                >
                  <Sparkles /> Preview my changes
                </Button>
                {mode === "sample" && (
                  <small className="mt-2.5 block text-[10px] leading-relaxed text-muted-foreground">
                    Sample mode rebuilds the example with your request recorded. Connect the model
                    for custom code changes.
                  </small>
                )}
              </div>
              <Separator className="my-6" />
              <span className="text-[9px] font-bold tracking-wide text-muted-foreground">
                EXPLANATORY PLAN
              </span>
              {protocolFor(app.spec.protocol).workflow.map((step, i) => (
                <div
                  key={step}
                  className="my-4 flex items-center gap-2.5 text-xs text-muted-foreground"
                >
                  <span className="grid size-5.5 shrink-0 place-items-center rounded-sm border text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                  {step}
                </div>
              ))}
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                The builder chooses the implementation under the approved specification and
                protocol.
              </p>
              <details className="mt-5 text-[10px] text-muted-foreground">
                <summary className="cursor-pointer">Activity</summary>
                {app.events.map((e, i) => (
                  <p key={i} className="border-t pt-2.5 leading-relaxed">
                    <time className="text-muted-foreground/80">
                      {new Date(e.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>{" "}
                    {e.message}
                  </p>
                ))}
              </details>
            </Card>
          </div>
        ) : draft || imported ? null : (
          <div className="mx-auto mt-6 max-w-3xl md:mt-10">
            <div className="mb-8 text-center">
              <span className="mb-5 inline-grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Layers size={26} />
              </span>
              <h2 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                What would you like to understand?
              </h2>
              <p className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground">
                Tell us what you want to explore. We'll help you plan an app, then build a preview
                for you to try. No coding needed.
              </p>
            </div>
            <ol
              aria-label="How it works"
              className="mb-6 grid grid-cols-4 gap-2 text-center text-xs text-muted-foreground sm:text-sm"
            >
              {["Describe", "Review", "Build", "Use"].map((step, i) => (
                <li key={step} className="flex items-center justify-center gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full border bg-card text-xs text-primary">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            {snapshot && !snapshot.status.modelConfigured && (
              <Alert className="mb-5 border-primary/20 bg-accent" role="status">
                <AlertDescription className="text-sm text-accent-foreground">
                  You can try ready-made examples now. Custom app building needs an AI connection
                  set up by the person managing this workspace.
                </AlertDescription>
              </Alert>
            )}
            <Card className="gap-4 p-5 sm:p-6">
              <label htmlFor="new-app-request" className="text-sm font-medium">
                What would you like your app to help with?
              </label>
              <Textarea
                id="new-app-request"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="For example: Help me see how my investments are doing and whether I have too much in one stock."
                aria-label="New application request"
                className="min-h-[130px] resize-y bg-card p-3"
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <span className="text-xs text-muted-foreground">
                  {snapshot?.status.demo
                    ? "Shared demo"
                    : snapshot?.status.local
                      ? "Local workspace"
                      : snapshot
                        ? "Account workspace"
                        : "Loading workspace..."}
                </span>
                <Button disabled={!!busy || !prompt.trim()} onClick={() => void suggest()}>
                  Review my plan <ArrowUpRight />
                </Button>
              </div>
            </Card>
            <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>Or start with an example</span>
              <Button
                size="sm"
                variant="ghost"
                disabled={!!busy || !snapshot}
                onClick={() =>
                  void run("Installing and verifying the three example applications…", async () => {
                    const added = await api<Application[]>({ action: "seed" });
                    const next = await refresh();
                    select(added[0]?.id ?? next.apps[0]?.id);
                  })
                }
              >
                Try all examples <Plus />
              </Button>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-3">
              {protocols.map((p, i) => (
                <Card key={p.id} className="gap-3 p-5">
                  <span className="font-mono text-[10px] text-muted-foreground">0{i + 1}</span>
                  <h3 className="text-base font-semibold tracking-tight">{p.defaultSpec.name}</h3>
                  <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                    {p.description}
                  </p>
                  <Button
                    variant="outline"
                    disabled={!!busy}
                    aria-label={`Start with ${p.defaultSpec.name}`}
                    onClick={() => {
                      setDraft({ ...p.defaultSpec });
                      setImported(null);
                    }}
                  >
                    Try this example <ArrowUpRight />
                  </Button>
                </Card>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck size={16} className="shrink-0 text-primary/60" />
              <span>
                Calculation checks run before you can use an app. Always review the preview.
              </span>
              <a
                href="/docs"
                className="ml-auto flex items-center gap-1 text-primary hover:underline"
              >
                View the app contract <ChevronRight size={12} />
              </a>
            </div>
          </div>
        )}
        {draft && (
          <Card className="my-6 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="mb-1.5 block text-[9px] font-bold tracking-wide text-muted-foreground">
                  BEFORE WE BUILD
                </span>
                <h2 className="text-xl font-semibold">Review your app's plan</h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close specification"
                onClick={() => setDraft(null)}
              >
                <X />
              </Button>
            </div>
            <p className="my-4 text-sm leading-relaxed text-muted-foreground">
              Does this match what you had in mind? You can edit the details before we build your
              preview.
            </p>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm text-muted-foreground lg:col-span-2">
                Name
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-2 text-xs text-muted-foreground">
                Application type
                <Select
                  value={draft.protocol}
                  onValueChange={(v) => {
                    const p = protocolFor(v as any);
                    setDraft({ ...p.defaultSpec, name: draft.name, purpose: draft.purpose });
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {protocols.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="col-span-full flex flex-col gap-2 text-xs text-muted-foreground">
                Purpose
                <Textarea
                  value={draft.purpose}
                  onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                  className="min-h-[100px] text-xs"
                />
              </label>
              {(["inputs", "outputs", "constraints"] as const).map((key) => (
                <label key={key} className="flex flex-col gap-2 text-xs text-muted-foreground">
                  {key[0].toUpperCase() + key.slice(1)}
                  <Textarea
                    value={draft[key].join("\n")}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value.split("\n") })}
                    className="min-h-[100px] text-xs"
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-5 border-t pt-5">
              <div className="min-w-[260px]">
                <ModeSelect
                  mode={mode}
                  setMode={setMode}
                  connected={!!snapshot?.status.modelConfigured}
                />
              </div>
              <Button disabled={!!busy} onClick={() => void create()}>
                Build my preview <ChevronRight />
              </Button>
            </div>
          </Card>
        )}
        {imported && (
          <Card className="my-6 p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <FileCode2 size={18} /> Import {imported.manifest.name}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close import"
                onClick={() => setImported(null)}
              >
                <X />
              </Button>
            </div>
            <p className="my-4 text-xs leading-relaxed text-muted-foreground">
              {app
                ? `This will create an update preview for ${app.name}.`
                : "This will create a new application preview in this workspace."}{" "}
              The source is already written. The platform checks and runs it.
            </p>
            <dl className="my-5 grid grid-cols-[140px_1fr] gap-3.5 text-xs">
              <dt className="text-muted-foreground">Protocol</dt>
              <dd className="text-foreground">{imported.manifest.protocol}</dd>
              <dt className="text-muted-foreground">Source files</dt>
              <dd className="break-words text-foreground">
                {Object.keys(imported.files).join(", ")}
              </dd>
              <dt className="text-muted-foreground">Requested capabilities</dt>
              <dd className="break-words text-foreground">
                {imported.manifest.permissions.join(", ")}
              </dd>
            </dl>
            <Button disabled={!!busy} onClick={() => void confirmImport()}>
              Verify and open imported app <ShieldCheck />
            </Button>
          </Card>
        )}
      </section>
    </main>
  );
}

function PanelEmpty({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center text-muted-foreground">
      <span className="mb-4 [&_svg]:size-7">{icon}</span>
      <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
      <p className="my-2.5 max-w-xs text-xs text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}

function ConversationItem({
  avatar,
  title,
  children,
}: {
  avatar: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-accent text-[8px] text-accent-foreground">
        {avatar}
      </span>
      <div className="min-w-0 flex-1 [&_p]:my-1.5 [&_p]:text-xs [&_p]:leading-relaxed [&_p]:text-muted-foreground [&_small]:text-[9px] [&_small]:text-muted-foreground/80">
        <strong className="text-xs font-semibold">{title}</strong>
        {children}
      </div>
    </div>
  );
}

function ModeSelect({
  mode,
  setMode,
  connected,
}: {
  mode: "sample" | "model";
  setMode: (m: "sample" | "model") => void;
  connected: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
      Builder
      <Select value={mode} onValueChange={(v) => setMode(v as any)}>
        <SelectTrigger size="sm" aria-label="Builder mode" className="flex-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="model" disabled={!connected}>
            AI model{connected ? "" : " · key required"}
          </SelectItem>
          <SelectItem value="sample">Example builder · no AI</SelectItem>
        </SelectContent>
      </Select>
    </label>
  );
}

function Checks({ release }: { release: Release }) {
  return (
    <div>
      <div className="mb-7 flex items-start gap-3.5 text-primary">
        <ShieldCheck size={25} className="shrink-0" />
        <div>
          <h2 className="mb-1.5 text-[17px] font-semibold text-foreground">
            {release.verification.passed ? "Mandatory checks passed" : "Release blocked"}
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Fixtures validate the protocol contract. Review additional custom logic and the rendered
            app before acceptance.
          </p>
        </div>
      </div>
      {release.verification.checks.map((c, i) => (
        <div key={i} className="flex items-start gap-3.5 border-t py-4">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full",
              c.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
            )}
          >
            {c.passed ? <Check size={15} /> : <X size={15} />}
          </span>
          <div>
            <strong className="text-xs font-semibold">{c.name}</strong>
            <p className="mt-1.5 text-[10px] leading-relaxed break-words text-muted-foreground">
              {c.detail}
            </p>
          </div>
        </div>
      ))}
      <p className="mt-6 font-mono text-[9px] leading-relaxed break-words text-muted-foreground">
        SHA-256 {release.verification.sourceHash}
        <br />
        Checked {new Date(release.verification.checkedAt).toLocaleString()}
      </p>
    </div>
  );
}

function SpecView({ spec }: { spec: ProductSpec }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{spec.name}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => download("product-spec.json", JSON.stringify(spec, null, 2))}
        >
          Export specification
        </Button>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{spec.purpose}</p>
      {(["inputs", "outputs", "constraints"] as const).map((key) => (
        <section key={key} className="my-6">
          <h3 className="text-xs font-semibold text-foreground">
            {key[0].toUpperCase() + key.slice(1)}
          </h3>
          <ul className="list-disc pl-5">
            {spec[key].map((v, i) => (
              <li key={i} className="py-1 text-xs leading-loose text-muted-foreground">
                {v}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section className="my-6">
        <h3 className="text-xs font-semibold text-foreground">
          {protocolFor(spec.protocol).name} protocol rules
        </h3>
        <ul className="list-disc pl-5">
          {protocolFor(spec.protocol).rules.map((r) => (
            <li key={r} className="py-1 text-xs leading-loose text-muted-foreground">
              {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
