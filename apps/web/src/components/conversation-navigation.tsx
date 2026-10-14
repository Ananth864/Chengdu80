import { Code2, Plus, Settings, LayoutGrid, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@web-starter/ui/components/dropdown-menu";
import { Button } from "@web-starter/ui/components/button";
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
}: {
  apps: Application[];
  selected: string | null;
  select: (id: string | null) => void;
  busy: boolean;
  openSettings: () => void;
  openGallery: () => void;
  galleryActive: boolean;
  requestDelete: (app: Application) => void;
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
            <a href="/" aria-label="Chengdu80 home" className="studio-wordmark">
              <span>Chengdu</span>
              <span className="studio-wordmark-number">
                80
                <span className="studio-wordmark-dot" />
              </span>
            </a>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="outline"
              className="studio-new-chat w-full justify-between"
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
            <SidebarMenuButton render={<a href="/docs" />} tooltip="Developer docs">
              <Code2 />
              <span>Developer docs</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
