"use client";

import React from "react";
import { Settings, SoundHigh, ChatBubble, User, Mail, Archive } from "iconoir-react";
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
import { folderFromPath } from "~/lib/messages/deep-links";
import type { MessageFolder, MessageFolderConfig } from "~/types/messages";

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
  {
    id: "requests",
    icon: Mail as any,
    title: "Requests",
    description: "Messages from people outside your direct-message audience",
    emptyTitle: "No message requests",
    emptyDescription:
      "Messages from people outside your direct-message audience wait here until you accept them.",
  },
];

export function getFolderFromPathname(pathname?: string): MessageFolder {
  return folderFromPath(pathname);
}

interface MessagesFolderNavProps {
  activeFolder?: MessageFolder;
  onNavigate?: (folder: MessageFolder) => void;
  unreadCounts?: Record<MessageFolder, number>;
  settings?: MessagesSettings;
  onSettingsChange?: (settings: MessagesSettings) => void;
  /** Number of archived conversations, and whether the list shows them instead of the inbox. */
  archivedCount?: number;
  showArchived?: boolean;
  onToggleArchived?: () => void;
}

export function MessagesFolderNav({
  activeFolder = "conversations",
  onNavigate,
  unreadCounts,
  settings = DEFAULT_MESSAGES_SETTINGS,
  onSettingsChange,
  archivedCount = 0,
  showArchived = false,
  onToggleArchived,
}: MessagesFolderNavProps) {
  const requestCount = unreadCounts?.requests ?? 0;
  const showRequests = requestCount > 0 || activeFolder === "requests";
  const toggleSetting = (key: keyof MessagesSettings) => {
    onSettingsChange?.({ ...settings, [key]: !settings[key] });
  };

  const totalUnread = unreadCounts?.conversations ?? 0;

  return (
    <div
      className={cn(
        "border-separator relative flex w-full shrink-0 items-center justify-between gap-2 border-b px-4 py-3"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="bg-tint-fill text-tint-ink rounded-control flex size-8 items-center justify-center">
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

      {showRequests && (
        <Button
          type="button"
          variant={activeFolder === "requests" ? "secondary" : "ghost"}
          size="sm"
          className="ml-auto"
          aria-pressed={activeFolder === "requests"}
          onClick={() => onNavigate?.(activeFolder === "requests" ? "conversations" : "requests")}
        >
          <Mail aria-hidden="true" />
          {activeFolder === "requests" ? "Back to messages" : `Requests (${requestCount})`}
        </Button>
      )}

      {onToggleArchived && activeFolder === "conversations" && (
        <Button
          type="button"
          variant={showArchived ? "secondary" : "ghost"}
          size="icon-sm"
          className={cn("text-label-secondary", !showRequests && "ml-auto")}
          aria-pressed={showArchived}
          aria-label={showArchived ? "Back to inbox" : `Archived conversations (${archivedCount})`}
          title={showArchived ? "Back to inbox" : "Archived conversations"}
          onClick={onToggleArchived}
        >
          <Archive aria-hidden="true" />
        </Button>
      )}

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
              <Switch
                checked={settings.notificationSounds}
                onCheckedChange={() => toggleSetting("notificationSounds")}
              />
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
