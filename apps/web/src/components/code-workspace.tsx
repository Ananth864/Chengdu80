import {
  FileCssIcon,
  FileHtmlIcon,
  FileJsIcon,
  FileIcon,
  FoldersIcon,
} from "@phosphor-icons/react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@web-starter/ui/components/sidebar";
import { Separator } from "@web-starter/ui/components/separator";
import type { Release } from "../lib/contracts";
import { SourceViewer } from "./source-viewer";

const fileIcons = {
  "app.js": FileJsIcon,
  "calculations.js": FileJsIcon,
  "index.html": FileHtmlIcon,
  "style.css": FileCssIcon,
  "cd80.json": FileIcon,
};

const sourcePaths = ["app.js", "calculations.js", "index.html", "style.css"] as const;
export type SourcePath = (typeof sourcePaths)[number] | "cd80.json";

// VibeSDK's file-explorer/editor composition, using the shared shadcn controls.
// Source format has a flat, fixed file set, so the tree contains no invented folders.
export function CodeWorkspace({
  release,
  activeFile,
  onSelectFile,
}: {
  release: Release;
  activeFile: SourcePath;
  onSelectFile: (path: SourcePath) => void;
}) {
  const content =
    activeFile === "cd80.json"
      ? JSON.stringify(release.bundle.manifest, null, 2)
      : release.bundle.files[activeFile];
  return (
    <section aria-label="Source workspace" className="flex min-h-0 min-w-0 flex-1">
      <aside aria-label="Source files" className="flex w-32 shrink-0 flex-col md:w-56">
        <div className="flex min-h-10 items-center gap-2 px-3 text-sm">
          <FoldersIcon className="size-4" />
          Files
        </div>
        <Separator />
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          <SidebarMenu aria-label="Application files">
            {[...sourcePaths, "cd80.json" as const].map((path) => {
              const Icon = fileIcons[path];
              return (
                <SidebarMenuItem key={path}>
                  <SidebarMenuButton
                    isActive={activeFile === path}
                    aria-current={activeFile === path ? "page" : undefined}
                    onClick={() => onSelectFile(path)}
                    title={path}
                  >
                    <Icon />
                    <span>{path}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </div>
      </aside>
      <Separator orientation="vertical" />
      <SourceViewer path={`${release.id}/${activeFile}`} fileName={activeFile} content={content} />
    </section>
  );
}
