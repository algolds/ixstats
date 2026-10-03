"use client";

import React from "react";
import { Settings, SoundHigh, ChatBubble, User } from "iconoir-react";
import { Button, buttonVariants } from "~/components/ui/button";
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
        "border-separator relative flex w-full shrink-0 items-center justify-between gap-2 border-b px-4 py-3"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="bg-tint-fill text-tint rounded-control flex size-8 items-center justify-center">
          <ChatBubble className="size-4" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-headline text-label">Messages</span>
          {totalUnread > 0 && (
            <span className="bg-tint text-caption text-on-tint flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 leading-none tabular-nums">
              {totalUnread > 99 ? "99+" : totalUnread}
            </span>
          )}
        </div>
      </div>

      {/* Settings popover button */}
      <Popover>
        <PopoverTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "text-label-secondary"
          )}
          aria-label="Message settings"
        >
          <Settings />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-64">
          <PopoverHeader>
            <PopoverTitle className="text-headline text-label">Message settings</PopoverTitle>
            <PopoverDescription className="text-footnote text-label-secondary mt-1">
              Customize your messaging experience.
            </PopoverDescription>
          </PopoverHeader>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="text-label flex items-center gap-2">
                <SoundHigh className="text-label-secondary size-4" aria-hidden="true" />
                <span className="text-body">Notification sounds</span>
              </div>
              <div className="flex items-center gap-2">
                {settings.notificationSounds && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      soundEffects.chime();
                    }}
                    title="Test notification sound"
                  >
                    Test
                  </Button>
                )}
                <Switch
                  checked={settings.notificationSounds}
                  onCheckedChange={() => toggleSetting("notificationSounds")}
                />
              </div>
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div className="text-label flex items-center gap-2">
                <User className="text-label-secondary size-4" aria-hidden="true" />
                <span className="text-body">Show account username</span>
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
