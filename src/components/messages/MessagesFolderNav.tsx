"use client";

import React from "react";
import {
  Settings,
  SoundHigh,
  ChatBubble,
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
    icon: ChatBubble as any,
    title: "Messages",
    description: "Direct, diplomatic, and wiki discussions",
    gradient: "text-emerald-500",
    activeGlow: "bg-emerald-500/10 border-emerald-500/40",
    emptyTitle: "No messages yet",
    emptyDescription: "Start a conversation to see it here.",
  },
];

export function getFolderFromPathname(_pathname?: string): MessageFolder {
  return "conversations";
}

interface MessagesFolderNavProps {
  activeFolder?: MessageFolder;
  onNavigate?: (folder: MessageFolder) => void;
  unreadCounts?: Record<MessageFolder, number>;
  settings?: MessagesSettings;
  onSettingsChange?: (settings: MessagesSettings) => void;
}

export function MessagesFolderNav({
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

  const totalUnread = unreadCounts?.conversations ?? 0;

  return (
    <div
      className={cn(
        "relative z-20 flex w-full shrink-0 items-center justify-between gap-1.5 px-3.5 py-3 border-b border-border/40 bg-emerald-500/[0.04] dark:bg-emerald-500/10 transition-colors duration-500"
      )}
    >
      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 shadow-2xs">
          <ChatBubble className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold tracking-tight text-foreground">Messages</span>
          {totalUnread > 0 && (
            <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] leading-none font-bold text-white shadow-2xs tabular-nums">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
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

