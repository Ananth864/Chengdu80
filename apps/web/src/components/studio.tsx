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
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@web-starter/ui/components/button";
import { Input } from "@web-starter/ui/components/input";
import { Textarea } from "@web-starter/ui/components/textarea";
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
    <main className="studio-shell">
      <aside className="library">
        <div className="library-heading">
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
        <Button className="new-app" onClick={() => select(null)} disabled={!!busy}>
          <Plus /> New application
        </Button>
        <div className="library-list">
          {snapshot?.apps.map((a) => (
            <button
              key={a.id}
              className={`app-nav ${a.id === selected ? "selected" : ""}`}
              onClick={() => select(a.id)}
              disabled={!!busy}
            >
              <span className="app-nav-icon">
                <Layers size={16} />
              </span>
              <span>
                <strong>{a.name}</strong>
                <small>
                  {a.preview
                    ? a.preview.verification.passed
                      ? "Preview ready"
                      : "Checks need attention"
                    : "Accepted release"}
                </small>
              </span>
              <ChevronRight size={13} />
            </button>
          ))}
          {snapshot && !snapshot.apps.length && (
            <p className="empty-library">
              Your applications will appear here. Start with an idea or import source.
            </p>
          )}
        </div>
        <div className="library-bottom">
          <LockKeyhole size={14} />
          <span>
            {snapshot?.status.local
              ? "Local workspace"
              : snapshot?.status.demo
                ? "Shared demo workspace"
                : "Private to your account"}
            <br />
            <small>Shared data within each app</small>
          </span>
        </div>
        <button className="settings-link" onClick={() => setSettingsOpen(!settingsOpen)}>
          <span className={`status-dot ${snapshot?.status.modelConfigured ? "green" : ""}`} />
          {snapshot?.status.modelConfigured ? snapshot.status.model : "Connections"}
          <ChevronRight size={12} />
        </button>
      </aside>
      <section className="work-area">
        <div className="workspace-top">
          <div>
            <p className="eyebrow">FINANCIAL APPLICATION STUDIO</p>
            <h1>{app ? app.name : "From a financial question to a working app."}</h1>
          </div>
          <div className="workspace-actions">
            {app?.current && (
              <a className="doc-link" href={`/app/${app.id}`} target="_blank" rel="noreferrer">
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
          <div className="notice error" role="alert">
            {error}
            <button onClick={() => setError("")} aria-label="Dismiss error">
              <X size={14} />
            </button>
          </div>
        )}
        {busy && (
          <div className="notice progress" role="status">
            <Loader2 className="spin" size={15} />
            {busy}
          </div>
        )}
        {settingsOpen && (
          <section className="connections">
            <div className="section-label">
              <h2>Connections</h2>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Close connections"
                onClick={() => setSettingsOpen(false)}
              >
                <X />
              </Button>
            </div>
            <p>
              {snapshot?.status.local
                ? "Local mode stores this workspace on this computer. Login is deferred for the prototype."
                : snapshot?.status.demo
                  ? "This demo has no login. All visitors share its apps and data, stored in Convex."
                  : "Hosted account mode uses WorkOS identity and Convex storage."}
            </p>
            <div className="connection-grid">
              <div>
                <span>Main model</span>
                <strong>{snapshot?.status.model}</strong>
                <small>
                  {snapshot?.status.modelConfigured
                    ? "Key configured; request testing required"
                    : "Add the model key and endpoint to .env, then restart"}
                </small>
              </div>
              <div>
                <span>Application runtime</span>
                <strong>{snapshot?.status.runtime}</strong>
                <small>Numerical code executes in a separate Worker</small>
              </div>
              <div>
                <span>Financial data</span>
                <strong>
                  {snapshot?.status.tushareConfigured ? "Tushare + fixtures" : "Synthetic fixtures"}
                </strong>
                <small>Real test endpoint available on demand</small>
              </div>
            </div>
            <div className="connection-buttons">
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
            {providerResult && <pre>{JSON.stringify(providerResult, null, 2)}</pre>}
          </section>
        )}
        {app ? (
          <div className="editor-layout">
            <div className="app-panel">
              <div className="app-toolbar">
                <div className="tab-list" role="tablist" aria-label="Application details">
                  {(["preview", "checks", "source", "spec", "data"] as Tab[]).map((t) => (
                    <button
                      key={t}
                      role="tab"
                      aria-selected={tab === t}
                      className={tab === t ? "active" : ""}
                      onClick={() => {
                        setTab(t);
                        if (t === "data") void refresh();
                      }}
                    >
                      {t === "checks"
                        ? `Checks ${release?.verification.checks.filter((c) => c.passed).length ?? 0}/${release?.verification.checks.length ?? 0}`
                        : t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
                {app.preview && app.current && (
                  <select
                    aria-label="Displayed version"
                    value={showPreview ? "preview" : "current"}
                    onChange={(e) => setShowPreview(e.target.value === "preview")}
                  >
                    <option value="preview">Update preview</option>
                    <option value="current">Accepted release</option>
                  </select>
                )}
              </div>
              {app.preview && showPreview && (
                <div
                  className={`release-bar ${app.preview.verification.passed ? "verified" : "failed"}`}
                >
                  <ShieldCheck size={16} />
                  <span>
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
                        await api({ action: "discard", appId: app.id, releaseId: app.preview!.id });
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
                        await api({ action: "accept", appId: app.id, releaseId: app.preview!.id });
                        await refresh();
                        setShowPreview(false);
                      })
                    }
                  >
                    <Check /> Accept release
                  </Button>
                </div>
              )}
              {!release ? (
                <div className="panel-empty">
                  <FolderOpen />
                  <h2>No release yet</h2>
                  <p>Request a new build or import application source.</p>
                </div>
              ) : tab === "preview" ? (
                release.verification.passed ? (
                  <AppFrame app={app} release={release} />
                ) : (
                  <div className="panel-empty">
                    <ShieldCheck />
                    <h2>Review the failed checks</h2>
                    <p>Application execution is disabled until mandatory verification passes.</p>
                    <Button variant="outline" onClick={() => setTab("checks")}>
                      View checks
                    </Button>
                  </div>
                )
              ) : tab === "checks" ? (
                <Checks release={release} />
              ) : tab === "source" ? (
                <div className="source-view">
                  <div className="source-tools">
                    <select
                      aria-label="Source file"
                      value={sourceFile}
                      onChange={(e) => setSourceFile(e.target.value)}
                    >
                      {Object.keys(release.bundle.files).map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
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
                  <pre>{release.bundle.files[sourceFile as keyof typeof release.bundle.files]}</pre>
                </div>
              ) : tab === "spec" ? (
                <SpecView spec={release.spec} />
              ) : (
                <div className="source-view">
                  <p>
                    Shared application data. Edit it inside the accepted app. Updates retain this
                    data.
                  </p>
                  <pre>{JSON.stringify(app.data, null, 2)}</pre>
                </div>
              )}
            </div>
            <aside className="builder-panel">
              <div className="section-label">
                <h2>
                  <Sparkles size={16} /> Continue building
                </h2>
              </div>
              <p>
                Describe a change. The accepted app keeps running while you review its next version.
              </p>
              <ModeSelect
                mode={mode}
                setMode={setMode}
                connected={!!snapshot?.status.modelConfigured}
              />
              <div className="conversation">
                <div className="conversation-item">
                  <span className="conversation-avatar">C80</span>
                  <div>
                    <strong>Product specification confirmed</strong>
                    <p>{app.spec.purpose}</p>
                    <small>{protocolFor(app.spec.protocol).name} protocol · version 1</small>
                  </div>
                </div>
                {app.preview && (
                  <div className="conversation-item">
                    <span className="conversation-avatar">
                      <ShieldCheck size={14} />
                    </span>
                    <div>
                      <strong>
                        {app.preview.verification.passed
                          ? "Preview passed its checks"
                          : "Preview needs corrections"}
                      </strong>
                      <p>{app.preview.notes}</p>
                      <small>
                        {app.preview.origin === "sample"
                          ? "Example builder. No model call."
                          : app.preview.origin === "import"
                            ? "Imported source code"
                            : snapshot?.status.model}
                      </small>
                    </div>
                  </div>
                )}
              </div>
              <div className="change-input">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Add a concentration warning above 35% and a clearer position table"
                  aria-label="Application change request"
                />
                <Button disabled={!!busy || !prompt.trim()} onClick={() => void update()}>
                  <Sparkles /> Build update preview
                </Button>
                {mode === "sample" && (
                  <small>
                    Sample mode rebuilds the example with your request recorded. Connect the model
                    for custom code changes.
                  </small>
                )}
              </div>
              <div className="workflow">
                <span className="eyebrow">EXPLANATORY PLAN</span>
                {protocolFor(app.spec.protocol).workflow.map((step, i) => (
                  <div key={step}>
                    <span>{i + 1}</span>
                    {step}
                  </div>
                ))}
                <p>
                  The builder chooses the implementation under the approved specification and
                  protocol.
                </p>
              </div>
              <details className="activity">
                <summary>Activity</summary>
                {app.events.map((e, i) => (
                  <p key={i}>
                    <time>
                      {new Date(e.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>{" "}
                    {e.message}
                  </p>
                ))}
              </details>
            </aside>
          </div>
        ) : (
          <div className="welcome">
            <div className="welcome-heading">
              <span className="hero-symbol">
                <Layers size={26} />
              </span>
              <h2>What would you like to understand?</h2>
              <p>
                Explain your financial question. Review the specification, then let the builder
                create the application.
              </p>
            </div>
            <div className="idea-box">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Build a portfolio analysis app that shows my holdings, return, and concentration risk…"
                aria-label="New application request"
              />
              <div className="idea-actions">
                <span>
                  English requests ·{" "}
                  {snapshot?.status.demo
                    ? "Shared demo"
                    : snapshot?.status.local
                      ? "Local workspace"
                      : "Private by default"}
                </span>
                <Button disabled={!!busy || !prompt.trim()} onClick={() => void suggest()}>
                  Prepare specification <ArrowUpRight />
                </Button>
              </div>
            </div>
            <div className="starter-heading">
              <span>START WITH AN EXAMPLE</span>
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
                Install all examples <Plus />
              </Button>
            </div>
            <div className="example-grid">
              {protocols.map((p, i) => (
                <button
                  key={p.id}
                  className="example-card"
                  disabled={!!busy}
                  onClick={() => {
                    setDraft({ ...p.defaultSpec });
                    setImported(null);
                  }}
                >
                  <span className="example-number">0{i + 1}</span>
                  <h3>{p.defaultSpec.name}</h3>
                  <p>{p.description}</p>
                  <div>
                    {p.name}
                    <ArrowUpRight size={14} />
                  </div>
                </button>
              ))}
            </div>
            <div className="welcome-foot">
              <ShieldCheck size={16} />
              <span>Every release passes numerical checks. Source imports use the same gate.</span>
              <a href="/docs">
                View the app contract <ChevronRight size={12} />
              </a>
            </div>
          </div>
        )}
        {draft && (
          <section className="review-panel">
            <div className="section-label">
              <div>
                <span className="eyebrow">BEFORE WE BUILD</span>
                <h2>Confirm the product specification</h2>
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
            <p>
              Review the scope and edit it here. The protocol supplies calculation rules and
              verification fixtures.
            </p>
            <div className="spec-fields">
              <label>
                Name
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                Application type
                <select
                  value={draft.protocol}
                  onChange={(e) => {
                    const p = protocolFor(e.target.value as any);
                    setDraft({ ...p.defaultSpec, name: draft.name, purpose: draft.purpose });
                  }}
                >
                  {protocols.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Purpose
                <Textarea
                  value={draft.purpose}
                  onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                />
              </label>
              {(["inputs", "outputs", "constraints"] as const).map((key) => (
                <label key={key}>
                  {key[0].toUpperCase() + key.slice(1)}
                  <Textarea
                    value={draft[key].join("\n")}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value.split("\n") })}
                  />
                </label>
              ))}
            </div>
            <div className="review-actions">
              <ModeSelect
                mode={mode}
                setMode={setMode}
                connected={!!snapshot?.status.modelConfigured}
              />
              <Button disabled={!!busy} onClick={() => void create()}>
                Confirm specification and build <ChevronRight />
              </Button>
            </div>
          </section>
        )}
        {imported && (
          <section className="review-panel">
            <div className="section-label">
              <h2>
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
            <p>
              {app
                ? `This will create an update preview for ${app.name}.`
                : "This will create a new application preview in this workspace."}{" "}
              The source is already written. The platform checks and runs it.
            </p>
            <dl>
              <dt>Protocol</dt>
              <dd>{imported.manifest.protocol}</dd>
              <dt>Source files</dt>
              <dd>{Object.keys(imported.files).join(", ")}</dd>
              <dt>Requested capabilities</dt>
              <dd>{imported.manifest.permissions.join(", ")}</dd>
            </dl>
            <Button disabled={!!busy} onClick={() => void confirmImport()}>
              Verify and open imported app <ShieldCheck />
            </Button>
          </section>
        )}
      </section>
    </main>
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
    <label className="mode-select">
      Builder
      <select
        aria-label="Builder mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as any)}
      >
        <option value="model" disabled={!connected}>
          AI model{connected ? "" : " · key required"}
        </option>
        <option value="sample">Example builder · no AI</option>
      </select>
    </label>
  );
}
function Checks({ release }: { release: Release }) {
  return (
    <div className="checks-view">
      <div className="checks-heading">
        <ShieldCheck size={25} />
        <div>
          <h2>{release.verification.passed ? "Mandatory checks passed" : "Release blocked"}</h2>
          <p>
            Fixtures validate the protocol contract. Review additional custom logic and the rendered
            app before acceptance.
          </p>
        </div>
      </div>
      {release.verification.checks.map((c, i) => (
        <div key={i} className={`check-row ${c.passed ? "pass" : "fail"}`}>
          <span>{c.passed ? <Check size={15} /> : <X size={15} />}</span>
          <div>
            <strong>{c.name}</strong>
            <p>{c.detail}</p>
          </div>
        </div>
      ))}
      <p className="hash">
        SHA-256 {release.verification.sourceHash}
        <br />
        Checked {new Date(release.verification.checkedAt).toLocaleString()}
      </p>
    </div>
  );
}
function SpecView({ spec }: { spec: ProductSpec }) {
  return (
    <div className="spec-view">
      <div className="section-label">
        <h2>{spec.name}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => download("product-spec.json", JSON.stringify(spec, null, 2))}
        >
          Export specification
        </Button>
      </div>
      <p>{spec.purpose}</p>
      {(["inputs", "outputs", "constraints"] as const).map((key) => (
        <section key={key}>
          <h3>{key[0].toUpperCase() + key.slice(1)}</h3>
          <ul>
            {spec[key].map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      ))}
      <section>
        <h3>{protocolFor(spec.protocol).name} protocol rules</h3>
        <ul>
          {protocolFor(spec.protocol).rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
