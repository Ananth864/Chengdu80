import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Code2,
  Plus,
  Settings,
  LayoutGrid,
  MoreHorizontal,
  Moon,
  Pencil,
  Sun,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@web-starter/ui/components/dropdown-menu";
import { Button } from "@web-starter/ui/components/button";
import { Skeleton } from "@web-starter/ui/components/skeleton";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuAction,
  SidebarMenuButton,
  useSidebar,
} from "@web-starter/ui/components/sidebar";
import type { Application } from "../lib/contracts";

export function ConversationNavigation({
  apps,
  selected,
  select,
  busy,
  openSettings,
  openGallery,
  galleryActive,
  requestDelete,
  requestRename,
}: {
  apps: Application[];
  selected: string | null;
  select: (id: string | null) => void;
  busy: boolean;
  openSettings: () => void;
  openGallery: () => void;
  galleryActive: boolean;
  requestDelete: (app: Application) => void;
  requestRename: (app: Application) => void;
}) {
  const { setOpenMobile } = useSidebar();
  function navigate(id: string | null) {
    select(id);
    setOpenMobile(false);
  }
  return (
    <Sidebar collapsible="offcanvas" className="studio-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <a href="/#view=builds" aria-label="Linus — Built apps" className="studio-wordmark">
              <span>Linus</span>
            </a>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="outline"
              className="studio-new-chat w-full"
              disabled={busy}
              onClick={() => navigate(null)}
            >
              <Plus data-icon="inline-start" />
              <span>New chat</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent aria-label="Conversations">
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={galleryActive}
                disabled={busy}
                onClick={() => {
                  openGallery();
                  setOpenMobile(false);
                }}
              >
                <LayoutGrid />
                <span>Built apps</span>
                <span className="ml-auto text-xs opacity-70">
                  {apps.filter((app) => app.current?.verification.passed).length}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Recent conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {apps
                .filter((app) => !app.chatDeletedAt)
                .sort((a, b) =>
                  (b.agentTurn?.startedAt ?? b.createdAt).localeCompare(
                    a.agentTurn?.startedAt ?? a.createdAt,
                  ),
                )
                .map((app) => (
                  <SidebarMenuItem key={app.id}>
                    <SidebarMenuButton
                      isActive={!galleryActive && selected === app.id}
                      disabled={busy}
                      onClick={() => navigate(app.id)}
                      tooltip={app.chatTitle ?? app.name}
                    >
                      <span>{app.chatTitle ?? app.name}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <SidebarMenuAction
                            showOnHover
                            disabled={busy}
                            aria-label={`Chat options for ${app.chatTitle ?? app.name}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => {
                              requestRename(app);
                              setOpenMobile(false);
                            }}
                          >
                            <Pencil />
                            Rename chat
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              requestDelete(app);
                              setOpenMobile(false);
                            }}
                          >
                            <Trash2 />
                            Delete chat
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeToggle />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => {
                openSettings();
                setOpenMobile(false);
              }}
              tooltip="Platform data"
            >
              <Settings />
              <span>Platform data</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<a href="/docs" target="_blank" rel="noreferrer" />}
              tooltip="Developer docs"
            >
              <Code2 />
              <span>Developer docs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

// next-themes resolves the stored theme after hydration; keep the layout stable
// until then so the icon never flashes the wrong mode.
function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = resolvedTheme === "dark";
  if (!mounted)
    return (
      <Skeleton
        data-slot="sidebar-menu-button"
        className="h-9 w-full rounded-md"
        aria-label="Loading theme toggle"
      />
    );
  return (
    <SidebarMenuButton
      tooltip="Toggle theme"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
      <span>{dark ? "Light theme" : "Dark theme"}</span>
    </SidebarMenuButton>
  );
}
