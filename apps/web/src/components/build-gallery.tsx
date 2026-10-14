import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, Search, Plus } from "lucide-react";
import { Button, buttonVariants } from "@web-starter/ui/components/button";
import { Card, CardContent } from "@web-starter/ui/components/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@web-starter/ui/components/input-group";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
  EmptyMedia,
} from "@web-starter/ui/components/empty";
import type { Application, Release } from "../lib/contracts";

function BuildThumbnail({ release, name }: { release: Release; name: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / 1000));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  // Static layout thumbnail: no JavaScript, requests, forms, RPC or data writes.
  const html =
    release.verification.thumbnail?.html ??
    release.bundle.files["index.html"] ??
    "<p>Layout preview unavailable</p>";
  const css = release.verification.thumbnail?.css ?? release.bundle.files["style.css"] ?? "";
  const document = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><style>${css.replace(/<\/style/gi, "<\\/style")}</style></head><body>${html}</body></html>`;
  return (
    <div
      ref={container}
      className="build-thumbnail relative aspect-[16/10] overflow-hidden bg-white"
    >
      <iframe
        title={`${name} layout thumbnail`}
        tabIndex={-1}
        loading="lazy"
        sandbox=""
        referrerPolicy="no-referrer"
        srcDoc={document}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-[625px] w-[1000px] origin-top-left border-0"
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}
export function BuildGallery({
  apps,
  busy,
  select,
  newChat,
}: {
  apps: Application[];
  busy: boolean;
  select: (id: string) => void;
  newChat: () => void;
}) {
  const [search, setSearch] = useState("");
  const built = apps.filter((app) => app.current?.verification.passed);
  const visible = built
    .filter((app) =>
      `${app.chatTitle ?? app.name} ${app.current?.buildRecord?.plan.requirements ?? app.spec.purpose}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.current!.createdAt.localeCompare(a.current!.createdAt));
  return (
    <main aria-label="Built applications" className="build-library min-h-0 flex-1 overflow-y-auto">
      <div className="library-inner">
        <div className="library-heading">
          <div>
            <h2 className="studio-display">
              Built apps
              <span aria-hidden="true" className="library-count">
                {built.length}
              </span>
            </h2>
            <p>Open an app or continue in its chat.</p>
          </div>
          <Button className="library-create" disabled={busy} onClick={newChat}>
            <Plus />
            New chat
          </Button>
        </div>
        <div className="library-toolbar">
          <span className="library-section-label">
            {search ? "Search results" : "All applications"}
          </span>
          <InputGroup className="library-search">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search built apps"
              placeholder="Find an app"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>
        </div>
        {visible.length ? (
          <div className="library-grid">
            {visible.map((app) => {
              // One display name everywhere: the chat title the user knows,
              // falling back to the spec name for seeded examples.
              const displayName = app.chatTitle ?? app.name;
              return (
                <Card key={app.id} className="gallery-card">
                  <div className="build-cover">
                    <div className="build-cover-label">
                      <span>{buildCategory(app)}</span>
                      <span className="build-data-status">
                        {app.current!.buildRecord
                          ? "Live · Shanghai Stock Exchange"
                          : "Earlier build"}
                      </span>
                    </div>
                    <div className="build-screen relative">
                      <BuildThumbnail release={app.current!} name={displayName} />
                      <Button
                        variant="ghost"
                        aria-label={`Select build ${displayName}`}
                        disabled={busy}
                        onClick={() => select(app.id)}
                        className="build-select absolute inset-0 h-full w-full cursor-pointer rounded-none hover:bg-primary/5 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-primary disabled:cursor-wait"
                      />
                    </div>
                    <div className="build-cover-caption">
                      <span>Layout preview</span>
                      <span>Ready to open</span>
                    </div>
                  </div>
                  <CardContent className="build-details">
                    <div className="build-title-row">
                      <Button
                        variant="link"
                        disabled={busy}
                        onClick={() => select(app.id)}
                        className="build-title"
                      >
                        {displayName}
                      </Button>
                      <a
                        className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                        href={`/app/${app.id}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${displayName}`}
                        title="Open app"
                      >
                        <ArrowUpRight />
                      </a>
                    </div>
                    <p className="line-clamp-2">
                      {app.current!.buildRecord?.plan.requirements ?? app.spec.purpose}
                    </p>
                    <div className="build-footer">
                      <span>Built {buildDate(app.current!.createdAt)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => select(app.id)}
                      >
                        Open in studio
                        <ArrowRight />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Empty className="library-empty">
            <EmptyMedia className="library-empty-mark" aria-hidden="true">
              80<span>／</span>
            </EmptyMedia>
            <div>
              <EmptyHeader className="max-w-none items-start text-left">
                <EmptyTitle>
                  <h3>{built.length ? "No matching apps" : "No apps built yet"}</h3>
                </EmptyTitle>
                <EmptyDescription>
                  {built.length
                    ? "Try another name or clear your search."
                    : "Describe what you want to research or explore. Your finished apps will be saved here."}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent className="items-start">
                {built.length ? (
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button disabled={busy} onClick={newChat}>
                    Start a chat
                    <ArrowRight />
                  </Button>
                )}
              </EmptyContent>
            </div>
          </Empty>
        )}
      </div>
    </main>
  );
}
function buildDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
function buildCategory(app: Application) {
  const selected = app.current?.buildRecord?.resolvedCapabilities;
  if (selected) {
    const labels = [
      selected.includes("company-cards") && "Company discovery",
      selected.includes("market-research") && "Research",
      selected.includes("historical-analysis") && "Historical analysis",
      !selected.includes("company-cards") &&
        selected.includes("risk-industry-matching") &&
        "Risk & industry matching",
    ].filter(Boolean);
    return labels.join(" + ");
  }
  return {
    portfolio: "Portfolio analysis",
    screening: "Company screening",
    strategy: "Historical comparison",
  }[app.spec.protocol];
}
