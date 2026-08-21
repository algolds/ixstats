"use client";

import React from "react";
import { motion } from "motion/react";
import {
  Settings,
  SoundHigh,
  ChatBubble,
  Group,
  User,
} from "iconoir-react";
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
import { soundEffects } from "~/lib/sound/cuelume";

export interface MessagesSettings {
  notificationSounds: boolean;
  displayNamePreference: "account" | "country";
}

export const DEFAULT_MESSAGES_SETTINGS: MessagesSettings = {
  notificationSounds: true,
  displayNamePreference: "country",
};

export const MESSAGE_FOLDERS: MessageFolderConfig[] = [
  {
    id: "conversations",
    icon: ChatBubble,
    title: "Messages",
    description: "Direct, diplomatic, and wiki discussions",
    gradient: "text-emerald-500",
    activeGlow: "bg-emerald-500/10 border-emerald-500/40",
    emptyTitle: "No messages yet",
    emptyDescription: "Start a conversation to see it here.",
  },
  {
    id: "groups",
    icon: Group,
    title: "ThinkTanks",
    description: "ThinkTank group chats and research rooms",
    gradient: "text-emerald-500",
    activeGlow: "bg-emerald-500/10 border-emerald-500/40",
    emptyTitle: "No ThinkTanks found",
    emptyDescription: "Join or create a ThinkTank group to start collaborating.",
  },
];

export function getFolderFromPathname(pathname: string): MessageFolder {
  const cleaned = pathname.replace(/^\/projects\/ixstats/, "");
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
    const nextValue = !settings[key];
    if (key === "notificationSounds") {
      if (nextValue) {
        soundEffects.chime();
      } else {
        soundEffects.toggle();
      }
    } else {
      soundEffects.toggle();
    }
    onSettingsChange?.({ ...settings, [key]: nextValue });
  };

  // Folder-specific dynamic color accents for the cutout header background
  const folderThemes: Record<MessageFolder, { bg: string; border: string }> = {
    conversations: {
      bg: "bg-emerald-500/[0.04] dark:bg-emerald-500/10",
      border: "border-b border-emerald-500/20",
    },
    groups: {
      bg: "bg-emerald-500/[0.04] dark:bg-emerald-500/10",
      border: "border-b border-emerald-500/20",
    },
  };

  const currentTheme = folderThemes[activeFolder] || folderThemes.conversations;

  return (
    <div
      className={cn(
        "relative z-20 flex w-full shrink-0 items-center gap-1.5 px-3 pt-3 pb-4 transition-colors duration-500",
        currentTheme.bg,
        currentTheme.border
      )}
    >
      <div className="relative z-10 flex flex-1 items-center gap-1 rounded-xl border border-border/40 bg-accent/10 p-1">
        {MESSAGE_FOLDERS.map((folder) => {
          const isActive = folder.id === activeFolder;
          const Icon = folder.icon;
          const count = unreadCounts?.[folder.id] ?? 0;

          return (
            <button
              key={folder.id}
              onClick={() => onNavigate(folder.id)}
              className={cn(
                "relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-[11px] font-semibold tracking-tight transition-all select-none active:scale-[0.97]",
                isActive
                  ? "text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
              )}
              aria-label={folder.title}
            >
              {isActive && (
                <motion.div
                  layoutId="messages-folder-tab"
                  className="absolute inset-0 rounded-lg border border-border/60 bg-card shadow-xs"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Icon className={cn("h-3.5 w-3.5", isActive && folder.gradient)} />
                <span className="hidden truncate sm:inline">{folder.title}</span>
                {count > 0 && (
                  <span className="flex h-3.5 min-w-[14px] shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1 text-[8.5px] leading-none font-bold text-white shadow-2xs tabular-nums">
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Settings popover button */}
      <Popover>
        <PopoverTrigger
          className="hover:bg-accent/15 text-muted-foreground hover:text-foreground relative z-10 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border/40 bg-card/50 transition-all active:scale-95"
          aria-label="Message settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          className="border-border/60 bg-popover/95 text-popover-foreground w-64 shadow-xl backdrop-blur-xl"
        >
          <PopoverHeader>
            <PopoverTitle className="text-foreground text-sm font-semibold tracking-tight">
              Message Settings
            </PopoverTitle>
            <PopoverDescription className="text-muted-foreground mt-1 text-xs">
              Customize your messaging experience.
            </PopoverDescription>
          </PopoverHeader>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="text-foreground/90 flex items-center gap-2">
                <SoundHigh className="text-muted-foreground h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Notification sounds</span>
              </div>
              <div className="flex items-center gap-2">
                {settings.notificationSounds && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      soundEffects.chime();
                    }}
                    title="Test notification sound"
                    className="text-muted-foreground hover:text-foreground hover:bg-accent/20 cursor-pointer rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors"
                  >
                    Test
                  </button>
                )}
                <Switch
                  checked={settings.notificationSounds}
                  onCheckedChange={() => toggleSetting("notificationSounds")}
                />
              </div>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="text-foreground/90 flex items-center gap-2">
                <User className="text-muted-foreground h-3.5 w-3.5" />
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
