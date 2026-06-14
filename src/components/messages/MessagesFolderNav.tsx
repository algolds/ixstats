"use client";

import {
  Bell,
  Settings,
  Volume2,
  Eye,
  Rows3,
  MessageSquare,
  // eslint-disable-next-line unused-imports/no-unused-imports
  Bookmark,
  Users,
  User,
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
  displayNamePreference: "account" | "country";
}

export const DEFAULT_MESSAGES_SETTINGS: MessagesSettings = {
  notificationSounds: true,
  showReadReceipts: true,
  compactMode: false,
  displayNamePreference: "country",
};

export const MESSAGE_FOLDERS: MessageFolderConfig[] = [
  {
    id: "conversations",
    icon: MessageSquare,
    title: "Conversations",
    description: "All chat conversations",
    gradient: "text-emerald-500",
    activeGlow: "bg-emerald-500/10 border-emerald-500/40",
    emptyTitle: "No conversations yet",
    emptyDescription: "Start a conversation to see it here.",
  },
  {
    id: "system",
    icon: Bell,
    title: "System Alerts",
    description: "System notifications",
    gradient: "text-rose-500",
    activeGlow: "bg-rose-500/10 border-rose-500/40",
    emptyTitle: "No system alerts",
    emptyDescription: "Platform notifications will appear here.",
  },
  {
    id: "groups",
    icon: Users,
    title: "Groups",
    description: "ThinkTank group chats",
    gradient: "text-blue-500",
    activeGlow: "bg-blue-500/10 border-blue-500/40",
    emptyTitle: "No groups found",
    emptyDescription: "Join or create a ThinkTank group to start collaborating.",
  },
];

export function getFolderFromPathname(pathname: string): MessageFolder {
  const cleaned = pathname.replace(/^\/projects\/ixstats/, "");
  if (cleaned.startsWith("/messages/system")) return "system";
  if (cleaned.startsWith("/messages/groups")) return "groups";
  return "conversations";
}

interface MessagesFolderNavProps {
  activeFolder: MessageFolder;
  onNavigate: (folder: MessageFolder) => void;
  unreadCounts?: Record<MessageFolder, number>;
  settings?: MessagesSettings;
  onSettingsChange?: (settings: MessagesSettings) => void;
}

export function MessagesFolderNav({
  activeFolder,
  onNavigate,
  unreadCounts,
  settings = DEFAULT_MESSAGES_SETTINGS,
  onSettingsChange,
}: MessagesFolderNavProps) {
  const toggleSetting = (key: keyof MessagesSettings) => {
    onSettingsChange?.({ ...settings, [key]: !settings[key] });
  };

  // Folder-specific dynamic color accents for the cutout header background
  const folderThemes: Record<MessageFolder, { bg: string; border: string }> = {
    conversations: {
      bg: "bg-emerald-500/10",
      border: "border-b border-emerald-500/20",
    },
    system: {
      bg: "bg-rose-500/10",
      border: "border-b border-rose-500/20",
    },
    groups: {
      bg: "bg-blue-500/10",
      border: "border-b border-blue-500/20",
    },
  };

  const currentTheme = folderThemes[activeFolder] || folderThemes.conversations;

  return (
    <div
      className={cn(
        "relative z-20 flex w-full shrink-0 items-center gap-1.5 px-3 pt-3 pb-5 transition-colors duration-500",
        currentTheme.bg,
        currentTheme.border
      )}
    >
      <div className="relative z-10 flex flex-1 gap-1 rounded-xl border border-white/5 bg-black/20 p-1">
        {MESSAGE_FOLDERS.map((folder) => {
          const isActive = folder.id === activeFolder;
          const Icon = folder.icon;
          const count = unreadCounts?.[folder.id] ?? 0;

          return (
            <button
              key={folder.id}
              onClick={() => onNavigate(folder.id)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-bold transition-all duration-200 select-none",
                isActive
                  ? "border-white/10 bg-white/10 text-white shadow-sm"
                  : "border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
              )}
              aria-label={folder.title}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden truncate sm:inline">{folder.title}</span>
              {count > 0 && (
                <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] leading-none font-bold text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Settings popover button */}
      <Popover>
        <PopoverTrigger
          className="relative z-10 flex shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/5 bg-slate-950/30 p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          className="w-64 border-white/10 bg-slate-900 text-white backdrop-blur-xl"
        >
          <PopoverHeader>
            <PopoverTitle className="text-sm font-bold text-slate-200">
              Message Settings
            </PopoverTitle>
            <PopoverDescription className="mt-1 text-xs text-slate-400">
              Customize your messaging experience.
            </PopoverDescription>
          </PopoverHeader>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-300">
                <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold">Notification sounds</span>
              </div>
              <Switch
                checked={settings.notificationSounds}
                onCheckedChange={() => toggleSetting("notificationSounds")}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-300">
                <Eye className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold">Read receipts</span>
              </div>
              <Switch
                checked={settings.showReadReceipts}
                onCheckedChange={() => toggleSetting("showReadReceipts")}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-300">
                <Rows3 className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold">Compact mode</span>
              </div>
              <Switch
                checked={settings.compactMode}
                onCheckedChange={() => toggleSetting("compactMode")}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-300">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-xs font-semibold">Show account username</span>
              </div>
              <Switch
                checked={settings.displayNamePreference === "account"}
                onCheckedChange={(checked) =>
                  onSettingsChange?.({
                    ...settings,
                    displayNamePreference: checked ? "account" : "country",
                  })
                }
              />
            </label>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
