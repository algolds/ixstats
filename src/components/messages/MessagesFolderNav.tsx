"use client";

import {
  Inbox,
  User,
  Globe,
  MessageCircle,
  Users,
  Bell,
  Settings,
  PanelLeftOpen,
  PanelLeftClose,
  Volume2,
  Eye,
  Rows3,
} from "lucide-react";
import { cn } from "~/lib/utils";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import type { MessageFolder, MessageFolderConfig } from "~/types/messages";

export interface MessagesSettings {
  notificationSounds: boolean;
  showReadReceipts: boolean;
  compactMode: boolean;
}

export const DEFAULT_MESSAGES_SETTINGS: MessagesSettings = {
  notificationSounds: true,
  showReadReceipts: true,
  compactMode: false,
};

export const MESSAGE_FOLDERS: MessageFolderConfig[] = [
  {
    id: "inbox",
    icon: Inbox,
    title: "Inbox",
    description: "All unread messages",
    gradient: "text-blue-500",
    activeGlow: "bg-blue-500/10 border-blue-500/40",
    emptyTitle: "All caught up",
    emptyDescription: "No unread messages across any system.",
  },
  {
    id: "personal",
    icon: User,
    title: "Personal",
    description: "Direct messages",
    gradient: "text-emerald-500",
    activeGlow: "bg-emerald-500/10 border-emerald-500/40",
    emptyTitle: "No conversations yet",
    emptyDescription: "Start a conversation with another user.",
  },
  {
    id: "diplomatic",
    icon: Globe,
    title: "Diplomatic",
    description: "Country-to-country channels",
    gradient: "text-amber-500",
    activeGlow: "bg-amber-500/10 border-amber-500/40",
    emptyTitle: "No diplomatic channels",
    emptyDescription: "Diplomatic messages between countries appear here.",
  },
  {
    id: "discussions",
    icon: MessageCircle,
    title: "Discussions",
    description: "Wiki alerts & forum PMs",
    gradient: "text-purple-500",
    activeGlow: "bg-purple-500/10 border-purple-500/40",
    emptyTitle: "No discussions",
    emptyDescription: "Wiki notifications and forum private messages will appear here.",
  },
  {
    id: "groups",
    icon: Users,
    title: "Groups",
    description: "ThinkTank group chats",
    gradient: "text-indigo-500",
    activeGlow: "bg-indigo-500/10 border-indigo-500/40",
    emptyTitle: "No group chats",
    emptyDescription: "Join or create a ThinkTank to start group messaging.",
  },
  {
    id: "system",
    icon: Bell,
    title: "System",
    description: "Notifications & alerts",
    gradient: "text-rose-500",
    activeGlow: "bg-rose-500/10 border-rose-500/40",
    emptyTitle: "No system messages",
    emptyDescription: "Platform notifications and alerts appear here.",
  },
];

export function getFolderFromPathname(pathname: string): MessageFolder {
  const cleaned = pathname.replace(/^\/projects\/ixstats/, "");
  if (cleaned.startsWith("/messages/personal")) return "personal";
  if (cleaned.startsWith("/messages/diplomatic")) return "diplomatic";
  if (cleaned.startsWith("/messages/discussions")) return "discussions";
  if (cleaned.startsWith("/messages/groups")) return "groups";
  if (cleaned.startsWith("/messages/system")) return "system";
  return "inbox";
}

interface MessagesFolderNavProps {
  activeFolder: MessageFolder;
  onNavigate: (folder: MessageFolder) => void;
  unreadCounts?: Record<MessageFolder, number>;
  expanded: boolean;
  onToggleExpanded: () => void;
  settings?: MessagesSettings;
  onSettingsChange?: (settings: MessagesSettings) => void;
}

export function MessagesFolderNav({
  activeFolder,
  onNavigate,
  unreadCounts,
  expanded,
  onToggleExpanded,
  settings = DEFAULT_MESSAGES_SETTINGS,
  onSettingsChange,
}: MessagesFolderNavProps) {
  const toggleSetting = (key: keyof MessagesSettings) => {
    onSettingsChange?.({ ...settings, [key]: !settings[key] });
  };

  return (
    <nav className="flex h-full flex-col justify-between">
      <div className="flex flex-col gap-0.5 p-1.5">
        {MESSAGE_FOLDERS.map((folder) => {
          const isActive = folder.id === activeFolder;
          const Icon = folder.icon;
          const count = unreadCounts?.[folder.id] ?? 0;

          return (
            <button
              key={folder.id}
              onClick={() => onNavigate(folder.id)}
              className={cn(
                "group/tip relative flex items-center gap-3 rounded-lg transition-all duration-200 outline-none",
                expanded ? "px-3 py-2" : "justify-center p-2",
                isActive
                  ? cn("border", folder.activeGlow)
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-transparent"
              )}
              aria-label={folder.title}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Left accent bar (collapsed mode) */}
              {!expanded && isActive && (
                <div
                  className={cn(
                    "absolute top-1/2 -left-[5px] h-5 w-[3px] -translate-y-1/2 rounded-full",
                    folder.gradient.replace("text-", "bg-")
                  )}
                />
              )}

              <div className="relative shrink-0">
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] transition-all duration-150",
                    isActive ? folder.gradient : "group-hover/tip:scale-110"
                  )}
                />

                {/* Unread badge */}
                {count > 0 && !expanded && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </div>

              {/* Label (expanded mode) */}
              {expanded && (
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-left text-sm",
                    isActive ? "text-foreground font-semibold" : "font-medium"
                  )}
                >
                  {folder.title}
                </span>
              )}

              {/* Unread count (expanded mode) */}
              {expanded && count > 0 && (
                <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}

              {/* Tooltip (collapsed mode only) */}
              {!expanded && (
                <span className="pointer-events-none absolute left-full z-50 ml-3 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 bg-[#f8fafc] text-[#0f172a] dark:bg-[#1e293b] dark:text-[#f1f5f9]">
                  {folder.title}
                  {count > 0 && ` (${count})`}
                  <span className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-[#f8fafc] dark:border-r-[#1e293b]" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom: settings + expand toggle */}
      <div className="flex flex-col gap-0.5 p-1.5">
        {/* Settings popover */}
        <Popover>
          <PopoverTrigger
            className={cn(
              "group/tip text-muted-foreground hover:bg-muted/60 hover:text-foreground relative flex items-center gap-3 rounded-lg transition-colors",
              expanded ? "px-3 py-2" : "justify-center p-2"
            )}
            aria-label="Settings"
          >
            <Settings className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover/tip:scale-110" />
            {expanded && <span className="min-w-0 truncate text-sm font-medium">Settings</span>}
            {!expanded && (
              <span className="pointer-events-none absolute left-full z-50 ml-3 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 bg-[#f8fafc] text-[#0f172a] dark:bg-[#1e293b] dark:text-[#f1f5f9]">
                Settings
                <span className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-[#f8fafc] dark:border-r-[#1e293b]" />
              </span>
            )}
          </PopoverTrigger>
          <PopoverContent side="right" align="end" className="w-64">
            <PopoverHeader>
              <PopoverTitle>Message Settings</PopoverTitle>
              <PopoverDescription>Customize your messaging experience.</PopoverDescription>
            </PopoverHeader>
            <div className="mt-4 flex flex-col gap-3">
              <label className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-sm">Notification sounds</span>
                </div>
                <Switch
                  checked={settings.notificationSounds}
                  onCheckedChange={() => toggleSetting("notificationSounds")}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Eye className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-sm">Read receipts</span>
                </div>
                <Switch
                  checked={settings.showReadReceipts}
                  onCheckedChange={() => toggleSetting("showReadReceipts")}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Rows3 className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="text-sm">Compact mode</span>
                </div>
                <Switch
                  checked={settings.compactMode}
                  onCheckedChange={() => toggleSetting("compactMode")}
                />
              </label>
            </div>
          </PopoverContent>
        </Popover>

        {/* Expand / Collapse toggle */}
        <button
          onClick={onToggleExpanded}
          className={cn(
            "group/tip text-muted-foreground hover:bg-muted/60 hover:text-foreground relative flex items-center gap-3 rounded-lg transition-colors",
            expanded ? "px-3 py-2" : "justify-center p-2"
          )}
          aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? (
            <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
          ) : (
            <PanelLeftOpen className="h-[18px] w-[18px] shrink-0" />
          )}
          {expanded && <span className="min-w-0 truncate text-sm font-medium">Collapse</span>}
          {!expanded && (
            <span className="pointer-events-none absolute left-full z-50 ml-3 rounded-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 bg-[#f8fafc] text-[#0f172a] dark:bg-[#1e293b] dark:text-[#f1f5f9]">
              Expand
              <span className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-[#f8fafc] dark:border-r-[#1e293b]" />
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
