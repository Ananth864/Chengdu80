import { useRouter } from "@tanstack/react-router";
import { StudioSubscriptions } from "../lib/use-studio-data";
import { BuildGallery } from "./build-gallery";
import { AgentChat } from "./agent-chat";
import { ConversationNavigation } from "./conversation-navigation";
import { WorkflowView } from "./design-review";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Eye,
  MoreHorizontal,
  Maximize,
  Minimize,
  Workflow,
  RefreshCw,
  ShieldCheck,
  LayoutGrid,
  PanelRightClose,
  PanelRightOpen,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@web-starter/ui/components/button";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@web-starter/ui/components/dropdown-menu";
import { cn } from "@web-starter/ui/lib/utils";
import { Alert, AlertAction, AlertTitle, AlertDescription } from "@web-starter/ui/components/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@web-starter/ui/components/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@web-starter/ui/components/table";
import { SidebarProvider, SidebarTrigger } from "@web-starter/ui/components/sidebar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@web-starter/ui/components/dialog";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@web-starter/ui/components/empty";
import { Separator } from "@web-starter/ui/components/separator";
import { Skeleton } from "@web-starter/ui/components/skeleton";

import { api, download } from "../lib/client";
import {
  bundleSchema,
  protocolFor,
  type AppBundle,
  type Application,
  type Release,
} from "../lib/contracts";
import { disclaimerText } from "../lib/disclaimer";
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
type Tab = "preview" | "workflow";
const workspaceTabs = [
  { value: "preview", label: "Preview", Icon: Eye },
  { value: "workflow", label: "How it works", Icon: Workflow },
] as const;
export function Studio() {
  const convexConfigured = !!useRouter().options.context.convexClient;
  const [subscribedApps, setSubscribedApps] = useState<Application[]>();
  const [subscribedMessages, setSubscribedMessages] = useState<{
    appId: string;
    messages: NonNullable<Application["conversation"]>;
  }>();
  const receiveMessages = useCallback(
    (appId: string, messages: NonNullable<Application["conversation"]>) =>
      setSubscribedMessages({ appId, messages }),
    [],
  );
  const [view, setView] = useState<"studio" | "builds">("studio");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("preview");
  const [mobilePane, setMobilePane] = useState<"chat" | "preview">("chat");
  const [review, setReview] = useState<"checks" | "spec" | null>(null);
  const [imported, setImported] = useState<AppBundle | null>(null);
  const [deletingChat, setDeletingChat] = useState<Application | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatKey, setChatKey] = useState("new");
  const [agentBusy, setAgentBusy] = useState(false);
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const workspace = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const syncFullscreen = () => setFullscreen(document.fullscreenElement === workspace.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await workspace.current?.requestFullscreen();
    } catch {
      setError("Fullscreen could not open.");
    }
  }
  const reactive = convexConfigured && !!snapshot && !snapshot.status.local;
  const applications = reactive && subscribedApps ? subscribedApps : (snapshot?.apps ?? []);
  const selectedApp = applications.find((a) => a.id === selected) ?? null;
  const app =
    selectedApp && reactive && subscribedMessages?.appId === selected
      ? { ...selectedApp, conversation: subscribedMessages.messages }
      : selectedApp;
  const messagesReady = !reactive || !selected || subscribedMessages?.appId === selected;
  const release = app && (app.preview ?? app.current);
  const pendingPreview = app ? (app.preview?.id !== app.current?.id ? app.preview : null) : null;
  const proposal = app?.buildProposal;
  // Mirrors the workflow card's own approvable check so the bar button never
  // offers an approval the workflow view cannot complete.
  const workflowNeedsReview =
    !!proposal &&
    !proposal.approvedAt &&
    !!proposal.id &&
    !!proposal.specification &&
    !!proposal.plan;
  const lastReleaseId = useRef<string | null>(null);
  useEffect(() => {
    const id = release?.id ?? null;
    // Anything new lands in the preview panel — a staged preview, an
    // activation, a fresh build — so open the panel and the preview tab
    // whenever its content changes.
    if (id && id !== lastReleaseId.current) {
      lastReleaseId.current = id;
      setPreviewCollapsed(false);
      setTab("preview");
      setMobilePane("preview");
    }
  }, [release?.id]);
  const lastProposal = useRef<{ appId: string | null; proposalId: string | null }>({
    appId: null,
    proposalId: null,
  });
  useEffect(() => {
    const appId = app?.id ?? null;
    const proposalId = app?.buildProposal?.id ?? null;
    const seen = lastProposal.current;
    // Selecting an app seeds from its pending proposal so opening an old chat
    // never yanks the tab; a proposal arriving during the session opens the
    // workflow view for review, mirroring the preview switch above.
    if (appId !== seen.appId) {
      lastProposal.current = { appId, proposalId };
      return;
    }
    if (proposalId && proposalId !== seen.proposalId && !app?.buildProposal?.approvedAt) {
      lastProposal.current = { appId, proposalId };
      setTab("workflow");
      setMobilePane("preview");
    }
  }, [app?.id, app?.buildProposal]);
  const refreshVersion = useRef(0);
  async function refresh() {
    const version = ++refreshVersion.current;
    const data = await api<Snapshot>();
    if (version === refreshVersion.current) setSnapshot(data);
    return data;
  }
  useEffect(() => {
    let mounted = true;
    api<Snapshot>()
      .then((data) => {
        if (!mounted) return;
        setSnapshot(data);
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (params.get("view") === "builds") setView("builds");
        const id = params.get("app");
        if (id && data.apps.some((a) => a.id === id)) {
          setSelected(id);
          setChatKey(id);
        }
      })
      .catch((e) => mounted && setError(e.message));
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (reactive || !app) return;
    const timer = setInterval(() => {
      void refresh().catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [app?.id, reactive]);
  useEffect(() => {
    if (reactive || !app || app.chatTitle !== "New chat") return;
    let stopped = false;
    let attempts = 0;
    const timer = setInterval(() => {
      if (++attempts > 20) {
        clearInterval(timer);
        return;
      }
      void api<Snapshot>().then((data) => {
        if (!stopped) setSnapshot(data);
      });
    }, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [app?.id, app?.chatTitle, reactive]);
  useEffect(() => {
    function restoreNavigation() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const id = params.get("app");
      const selectedId = id && snapshot?.apps.some((app) => app.id === id) ? id : null;
      setView(params.get("view") === "builds" ? "builds" : "studio");
      setSelected(selectedId);
      setChatKey(selectedId ?? crypto.randomUUID());
      setImported(null);
      setReview(null);
      setTab("preview");
      setMobilePane("chat");
    }
    window.addEventListener("popstate", restoreNavigation);
    window.addEventListener("hashchange", restoreNavigation);
    return () => {
      window.removeEventListener("popstate", restoreNavigation);
      window.removeEventListener("hashchange", restoreNavigation);
    };
  }, [snapshot]);
  function openGallery() {
    setView("builds");
    window.history.pushState(null, "", "/#view=builds");
  }
  function select(id: string | null, pane: "chat" | "preview" = "chat") {
    setView("studio");
    setSelected(id);
    setImported(null);
    setError("");
    setChatKey(id ?? crypto.randomUUID());
    setTab("preview");
    setMobilePane(pane);
    if (pane === "preview") setPreviewCollapsed(false);
    setReview(null);
    window.history.pushState(null, "", id ? `/#app=${id}` : "/");
  }
  async function run<T>(label: string, task: () => Promise<T>) {
    if (busy || agentBusy) return;
    setBusy(label);
    setError("");
    try {
      return await task();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Operation failed";
      setError(message);
    } finally {
      setBusy("");
    }
  }
  async function confirmDeleteChat() {
    if (!deletingChat) return;
    const target = deletingChat;
    const result = await run("Deleting chat…", async () => {
      const result = await api<{ deleted: boolean; retainedBuild: boolean }>({
        action: "delete-chat",
        appId: target.id,
        expectedRevision: target.revision,
      });
      setSnapshot((current) =>
        current
          ? {
              ...current,
              apps: result.retainedBuild
                ? current.apps.map((app) =>
                    app.id === target.id
                      ? {
                          ...app,
                          conversation: [],
                          turns: [],
                          buildRecords: [],
                          agentTurn: undefined,
                          chatTitle: undefined,
                          chatDeletedAt: new Date().toISOString(),
                        }
                      : app,
                  )
                : current.apps.filter((app) => app.id !== target.id),
            }
          : current,
      );
      setDeletingChat(null);
      if (selected === target.id) select(null);
      await refresh();
      return result;
    });
    if (!result) {
      try {
        const updated = await refresh();
        setDeletingChat(updated.apps.find((app) => app.id === target.id) ?? null);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not refresh the conversation.");
      }
    }
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
    });
    if (file.current) file.current.value = "";
  }
  async function approveWorkflow(proposalId: string) {
    if (!app) return;
    await run("Approving workflow...", async () => {
      await api<Application>({ action: "approve-workflow", appId: app.id, proposalId });
      await refresh();
    });
  }
  async function confirmImport() {
    if (!imported) return;
    await run("Verifying imported application source…", async () => {
      const next = await api<Application>({ action: "import", bundle: imported, appId: app?.id });
      await refresh();
      select(next.id);
      setTab("preview");
    });
  }
  return (
    <SidebarProvider
      className="studio-shell h-svh min-h-0 overflow-hidden"
      style={{ "--sidebar-width": "15rem" } as React.CSSProperties}
    >
      {reactive && (
        <StudioSubscriptions
          selected={selected}
          demo={snapshot.status.demo}
          onApps={setSubscribedApps}
          onMessages={receiveMessages}
        />
      )}
      <ConversationNavigation
        apps={applications}
        selected={selected}
        select={select}
        busy={!!busy || agentBusy}
        openSettings={() => setSettingsOpen(true)}
        openGallery={openGallery}
        galleryActive={view === "builds"}
        requestDelete={setDeletingChat}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="studio-topbar flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger />
            <h1
              className={cn(
                "studio-display truncate font-medium",
                view === "builds" && "library-breadcrumb",
              )}
            >
              {view === "builds" ? "Applications" : (app?.chatTitle ?? app?.name ?? "New chat")}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {view === "studio" && (
              <Button
                variant="outline"
                size="sm"
                className="hidden xl:inline-flex"
                aria-label={previewCollapsed ? "Show preview panel" : "Hide preview panel"}
                aria-pressed={previewCollapsed}
                onClick={() => setPreviewCollapsed((value) => !value)}
              >
                {previewCollapsed ? <PanelRightOpen /> : <PanelRightClose />}
                Preview
              </Button>
            )}
            {view === "studio" && (
              <Button
                variant="outline"
                size="sm"
                disabled={!!busy || agentBusy}
                onClick={openGallery}
              >
                <LayoutGrid />
                Built apps
              </Button>
            )}
            {view === "studio" && release && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  download(
                    `${app!.name.replaceAll(/[^a-zA-Z0-9]/g, "-")}.cd80.json`,
                    JSON.stringify(release.bundle, null, 2),
                  )
                }
              >
                Export source
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" aria-label="More actions" />}
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  {release && (
                    <>
                      <DropdownMenuItem onClick={() => setReview("checks")}>
                        Release checks
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setReview("spec")}>
                        Specification
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                    Platform data
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <Separator />
        {error && (
          <Alert variant="destructive" className="self-center w-[calc(100%-2rem)]">
            <AlertTitle>Operation failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X />
              </Button>
            </AlertAction>
          </Alert>
        )}
        {!snapshot ? (
          <section
            aria-label="Loading workspace"
            aria-busy={!error}
            className="flex flex-1 flex-col gap-4 p-8"
          >
            {error ? (
              <Button
                className="self-start"
                disabled={!!busy}
                onClick={() => void run("Loading workspace…", refresh)}
              >
                Retry loading workspace
              </Button>
            ) : (
              <>
                <span role="status">Loading your workspace…</span>
                <Skeleton className="h-8 w-60" />
                <Skeleton className="h-60 w-full" />
              </>
            )}
          </section>
        ) : view === "builds" ? (
          <BuildGallery
            apps={applications}
            busy={!!busy || agentBusy}
            select={(id) => select(id, "preview")}
            newChat={() => select(null)}
          />
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:flex-row">
            <Tabs
              value={mobilePane}
              onValueChange={(value) => setMobilePane(value as "chat" | "preview")}
              className="shrink-0 px-4 py-2 xl:hidden"
            >
              <TabsList className="min-h-12 w-full">
                <TabsTrigger
                  value="chat"
                  id="studio-chat-tab"
                  aria-controls="studio-chat-panel"
                  className="min-h-11 flex-1"
                >
                  Chat
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  id="studio-preview-tab"
                  aria-controls="studio-preview-panel"
                  className="min-h-11 flex-1"
                >
                  Preview
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <aside
              id="studio-chat-panel"
              role="tabpanel"
              aria-labelledby="studio-chat-tab"
              aria-label="Application chat"
              className={cn(
                "min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden p-4 xl:flex",
                mobilePane === "chat" ? "flex" : "hidden",
                previewCollapsed ? "xl:w-auto xl:flex-1" : "xl:w-120 xl:flex-none 2xl:w-144",
              )}
            >
              <AgentChat
                reactive={reactive}
                key={chatKey}
                app={app}
                connected={!!snapshot?.status.modelConfigured}
                disabled={
                  !!busy || !messagesReady || (!agentBusy && app?.agentTurn?.status === "running")
                }
                modelName={snapshot?.status.model ?? "AI"}
                onBusyChange={setAgentBusy}
                onWorkspaceCreated={(next) => {
                  setSnapshot((current) =>
                    current ? { ...current, apps: [...current.apps, next] } : current,
                  );
                  setSelected(next.id);
                  window.history.replaceState(null, "", `/#app=${next.id}`);
                }}
                onFinish={async () => {
                  await refresh();
                }}
              />
            </aside>
            <Separator
              orientation="vertical"
              className={cn("hidden", !previewCollapsed && "xl:block")}
            />
            <div
              id="studio-preview-panel"
              role="tabpanel"
              aria-labelledby="studio-preview-tab"
              className={cn(
                "min-h-0 min-w-0 flex-1 flex-col overflow-hidden xl:flex",
                mobilePane === "preview" ? "flex" : "hidden",
                previewCollapsed && "xl:hidden",
              )}
            >
              <main
                ref={workspace}
                aria-label="Application workspace"
                className={cn(
                  "flex min-h-0 min-w-0 flex-1 flex-col [&:fullscreen]:h-svh [&:fullscreen]:bg-background",
                  app && !imported && tab !== "workflow"
                    ? "overflow-hidden"
                    : "overflow-y-auto",
                )}
              >
                <input
                  ref={file}
                  type="file"
                  accept=".json,.html,.js,.css"
                  multiple
                  hidden
                  onChange={(e) => void importFiles(e.target.files)}
                />
                {imported ? (
                  <section className="flex flex-col gap-5 p-4">
                    <h2>Import {imported.manifest.name}</h2>
                    <p className="text-sm">
                      {app ? `Apply imported source to ${app.name}.` : "Create a new application."}
                    </p>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell>Protocol</TableCell>
                          <TableCell>{imported.manifest.protocol}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Files</TableCell>
                          <TableCell>{Object.keys(imported.files).join(", ")}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Capabilities</TableCell>
                          <TableCell className="whitespace-normal">
                            {imported.manifest.permissions.join(", ")}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!!busy} onClick={() => void confirmImport()}>
                        <ShieldCheck data-icon="inline-start" />
                        Verify imported app
                      </Button>
                      <Button variant="ghost" disabled={!!busy} onClick={() => setImported(null)}>
                        Cancel
                      </Button>
                    </div>
                  </section>
                ) : app ? (
                  <Tabs
                    value={tab}
                    onValueChange={(value) => {
                      if (isTab(value)) {
                        setTab(value);
                        if (value !== "preview") void run("Refreshing workspace…", refresh);
                      }
                    }}
                    className="min-h-0 min-w-0 flex-1 gap-0"
                  >
                    <div className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-3 items-center gap-2 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <TabsList aria-label="Workspace views">
                          {workspaceTabs.map(({ value, label, Icon }) => (
                            <TabsTrigger value={value} key={value} aria-label={label} title={label}>
                              <Icon />
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        {workflowNeedsReview && proposal && (
                          <Button
                            size="sm"
                            className="studio-approve-throb"
                            aria-label="Approve workflow"
                            disabled={!!busy || agentBusy || app.agentTurn?.status === "running"}
                            onClick={() => void approveWorkflow(proposal.id)}
                          >
                            <ShieldCheck data-icon="inline-start" />
                            <span className="hidden sm:inline">Approve workflow</span>
                          </Button>
                        )}
                      </div>
                      <div className="flex min-w-0 items-center justify-center gap-2">
                        <span className="truncate text-sm font-mono" title={app.name}>
                          {app.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Refresh ${tab}`}
                          title={`Refresh ${tab}`}
                          disabled={!!busy || (tab === "preview" && !release?.verification.passed)}
                          onClick={() => {
                            if (tab === "preview") setPreviewRevision((revision) => revision + 1);
                            else void run("Refreshing workspace…", refresh);
                          }}
                        >
                          <RefreshCw />
                        </Button>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                          title={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                          onClick={() => void toggleFullscreen()}
                        >
                          {fullscreen ? <Minimize /> : <Maximize />}
                        </Button>
                        {app.current && (
                          <a
                            href={`/app/${app.id}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open app"
                            title="Open app"
                            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                          >
                            <ArrowUpRight />
                          </a>
                        )}
                      </div>
                    </div>
                    <Separator />
                    <TabsContent value="preview" className="flex min-h-0 flex-col">
                      {pendingPreview && (
                        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-accent px-4 py-2 text-xs text-accent-foreground">
                          <ShieldCheck className="size-4" />
                          <span className="min-w-0 flex-1">
                            {pendingPreview.verification.passed
                              ? "Pending approval — review the preview, then activate it to go live."
                              : "Verification failed. This preview cannot go live."}
                          </span>
                          {pendingPreview.verification.passed && (
                            <Button
                              size="sm"
                              disabled={!!busy || agentBusy}
                              onClick={() =>
                                void run("Activating release…", async () => {
                                  if (!pendingPreview) return;
                                  await api({
                                    action: "accept",
                                    appId: app!.id,
                                    releaseId: pendingPreview.id,
                                  });
                                  await refresh();
                                })
                              }
                            >
                              {busy === "Activating release…"
                                ? "Activating…"
                                : "Approve & activate"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!!busy || agentBusy}
                            onClick={() =>
                              void run("Discarding preview…", async () => {
                                if (!pendingPreview) return;
                                await api({
                                  action: "discard",
                                  appId: app!.id,
                                  releaseId: pendingPreview.id,
                                });
                                await refresh();
                              })
                            }
                          >
                            Discard
                          </Button>
                        </div>
                      )}
                      {release?.verification.passed ? (
                        <AppFrame
                          key={`${release.id}:${previewRevision}`}
                          app={app}
                          release={release}
                        />
                      ) : (
                        <Empty>
                          <EmptyHeader>
                            <EmptyMedia variant="icon">
                              <ShieldCheck />
                            </EmptyMedia>
                            <EmptyTitle>
                              {release ? "Review the failed checks" : "No release yet"}
                            </EmptyTitle>
                            <EmptyDescription>
                              {release
                                ? "Execution is disabled until verification passes."
                                : "Describe a supported financial app in the conversation."}
                            </EmptyDescription>
                          </EmptyHeader>
                          <EmptyContent>
                            {release && (
                              <Button variant="outline" onClick={() => setReview("checks")}>
                                View checks
                              </Button>
                            )}
                            <p className="text-sm text-muted-foreground">{disclaimerText()}</p>
                          </EmptyContent>
                        </Empty>
                      )}
                    </TabsContent>
                    <TabsContent value="workflow" className="flex min-h-0 flex-col overflow-y-auto">
                      <WorkflowView
                        app={app}
                        disabled={!!busy || agentBusy}
                        onApprove={approveWorkflow}
                      />
                    </TabsContent>
                  </Tabs>
                ) : (
                  <Empty className="flex-1">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <LayoutGrid className="text-primary" />
                      </EmptyMedia>
                      <EmptyTitle className="studio-display">App preview</EmptyTitle>
                      <EmptyDescription>
                        Your preview appears here when the build is ready.
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <p className="text-sm text-muted-foreground">{disclaimerText()}</p>
                    </EmptyContent>
                  </Empty>
                )}
              </main>
            </div>
          </div>
        )}
      </div>
      <Dialog
        open={deletingChat !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeletingChat(null);
        }}
      >
        <DialogContent showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>Delete this chat?</DialogTitle>
            <DialogDescription>
              {deletingChat?.current?.verification.passed
                ? `The conversation for "${deletingChat.chatTitle ?? deletingChat.name}" will be deleted. Its completed app and saved data will remain in Built apps.`
                : `The conversation "${deletingChat?.chatTitle ?? deletingChat?.name}" and its unfinished workspace will be deleted.`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={!!busy} onClick={() => setDeletingChat(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!!busy || agentBusy}
              onClick={() => void confirmDeleteChat()}
            >
              {busy === "Deleting chat…" ? "Deleting…" : "Delete chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={review !== null}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
      >
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{review === "checks" ? "Release checks" : "Specification"}</DialogTitle>
            <DialogDescription>{app?.name}</DialogDescription>
          </DialogHeader>
          {release &&
            (review === "checks" ? (
              <Checks release={app?.preview ?? release} />
            ) : (
              <SpecView release={release} />
            ))}
        </DialogContent>
      </Dialog>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Platform data</DialogTitle>
            <DialogDescription>
              {snapshot?.status.local
                ? "Single-owner workspace stored on this computer."
                : snapshot?.status.demo
                  ? "All visitors share this demo workspace and its Convex data."
                  : "Account mode uses WorkOS identity and Convex storage."}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Connection</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Model</TableCell>
                <TableCell className="whitespace-normal">
                  {snapshot?.status.model} ·{" "}
                  {snapshot?.status.modelConfigured ? "Key configured" : "Key required"}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Runtime</TableCell>
                <TableCell className="whitespace-normal">{snapshot?.status.runtime}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Market data</TableCell>
                <TableCell>
                  {snapshot?.status.tushareConfigured
                    ? "Tushare token configured · live daily prices"
                    : "Tushare token not set · live data unavailable"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground">
            The platform team manages the company table and the Tushare token. You do not need to
            upload company data or provide API keys.
          </p>
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={() => void run("Refreshing platform status…", refresh)}
          >
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
          {busy && <p role="status">{busy}</p>}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Connection failed</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function isTab(value: unknown): value is Tab {
  return value === "preview" || value === "workflow";
}

function Checks({ release }: { release: Release }) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <Alert variant={release.verification.passed ? "default" : "destructive"}>
        <ShieldCheck />
        <AlertTitle>
          {release.verification.passed ? "Mandatory checks passed" : "Release blocked"}
        </AlertTitle>
        <AlertDescription>
          Passing checks stage a preview for your review. Activation requires your separate approval
          in Preview; failed changes leave the working app in place. Fixture tests do not prove live
          data availability.
        </AlertDescription>
      </Alert>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Result</TableHead>
            <TableHead>Check</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {release.verification.checks.map((check, index) => (
            <TableRow key={index}>
              <TableCell>{check.passed ? "Pass" : "Fail"}</TableCell>
              <TableCell className="whitespace-normal">{check.name}</TableCell>
              <TableCell className="whitespace-normal">{check.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="break-all text-xs text-muted-foreground">
        SHA-256 {release.verification.sourceHash}
        <br />
        Checked {new Date(release.verification.checkedAt).toLocaleString()}
      </p>
    </section>
  );
}

function SpecView({ release }: { release: Release }) {
  const spec = release.spec;
  const record = release.buildRecord;
  if (record)
    return (
      <section className="flex flex-col gap-4">
        <p>{record.plan.requirements}</p>
        <section>
          <h2 className="mb-2 font-medium">Included capabilities</h2>
          <ul className="ml-4 list-disc">
            {record.resolvedCapabilities.map((capability) => (
              <li key={capability}>{capability.replaceAll("-", " ")}</li>
            ))}
          </ul>
        </section>
        <p>Uses the platform's configured market data.</p>
        <p>Theme: {record.theme}</p>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => download("build-contract.json", JSON.stringify(record, null, 2))}
        >
          Export build contract
        </Button>
      </section>
    );
  const protocol = protocolFor(spec.protocol);
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2>{spec.name}</h2>
        <Button
          variant="outline"
          onClick={() => download("product-spec.json", JSON.stringify(spec, null, 2))}
        >
          Export specification
        </Button>
      </div>
      <p>{spec.purpose}</p>
      {(["inputs", "outputs", "constraints"] as const).map((key) => (
        <section key={key} className="flex flex-col gap-2">
          <h3>{key[0].toUpperCase() + key.slice(1)}</h3>
          <ul className="ml-4 list-disc">
            {spec[key].map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </section>
      ))}
      <section className="flex flex-col gap-2">
        <h3>{protocol.name} protocol rules</h3>
        <ul className="ml-4 list-disc">
          {protocol.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
    </section>
  );
}
