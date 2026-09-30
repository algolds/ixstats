"use client";

import React, { useState } from "react";
import { Plus, Crown, Pin, OpenBook as BookOpen } from "iconoir-react";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { MESSAGE_FOLDERS } from "./MessagesFolderNav";
import { MessagesConversationCard } from "./MessagesConversationCard";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder, ChannelFilter } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID, LOREBOT_CONVERSATION_ID } from "~/types/messages";
import { api } from "~/trpc/react";

const CHANNEL_FILTERS: { id: ChannelFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "diplomatic", label: "Diplomatic" },
  { id: "direct", label: "Direct" },
  { id: "community", label: "Community" },
];

interface MessagesConversationPanelProps {
  activeFolder: MessageFolder;
  conversations: ThinkShareConversation[];
  isLoading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  currentUserId: string;
  onNewConversation: () => void;
  settings?: any;
  mutedConversations?: string[];
}

export function MessagesConversationPanel({
  activeFolder,
  conversations,
  isLoading,
  searchQuery,
  onSearchChange,
  selectedConversationId,
  onSelectConversation,
  currentUserId,
  onNewConversation,
  settings,
  mutedConversations = [],
}: MessagesConversationPanelProps) {
  const folderConfig = MESSAGE_FOLDERS.find((f) => f.id === activeFolder);
  const [activeFilter, setActiveFilter] = useState<ChannelFilter>("all");

  // Fetch latest system notification for pinned preview
  const { data: latestNotificationData } = api.notifications.getUserNotifications.useQuery(
    { limit: 1 },
    { enabled: !!currentUserId, staleTime: 30000 }
  );

  const latestSystemNotice = latestNotificationData?.notifications?.[0];

  // Fetch latest wiki activity for LoreBot preview
  const { data: latestWikiData } = api.wikios.getRecentChanges.useQuery(
    { limit: 1 },
    { staleTime: 30000 }
  );
  const latestWikiChange = (latestWikiData as any)?.[0];

  // Filter conversations by sub-filter & search query
  const filtered = conversations.filter((c) => {
    // Exclude thinktanks from main messaging feed
    if (c.source === "thinktank") return false;

    // 1. Channel filter
    if (activeFolder === "conversations") {
      if (activeFilter === "diplomatic") {
        if (c.source !== "diplomatic" && c.conversationType !== "diplomatic") return false;
      } else if (activeFilter === "direct") {
        if (
          c.source === "diplomatic" ||
          c.conversationType === "diplomatic" ||
          c.source === "wiki" ||
          c.source === "forum" ||
          c.source === "community" ||
          c.type === "group"
        ) {
          return false;
        }
      } else if (activeFilter === "community") {
        if (c.source !== "wiki" && c.source !== "forum" && c.source !== "community") return false;
      }
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const otherParticipant = c.otherParticipants[0];
      const name =
        settings?.displayNamePreference === "account" && otherParticipant?.account?.username
          ? `@${otherParticipant.account.username}`
          : (otherParticipant?.account?.displayName ?? c.name ?? "");
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    }

    return true;
  });

  const isSystemSelected = selectedConversationId === SYSTEM_CONVERSATION_ID;
  const isLoreBotSelected = selectedConversationId === LOREBOT_CONVERSATION_ID;

  return (
    <div className="flex h-full flex-col">
      {/* Search Header */}
      <div className={cn("border-separator relative flex shrink-0 flex-col gap-3 border-b p-3")}>
        <div className="flex items-center gap-2">
          <SearchField
            containerClassName="flex-1"
            placeholder="Search messages..."
            aria-label="Search messages"
            value={searchQuery}
            onValueChange={onSearchChange}
          />
          {activeFolder === "conversations" && (
            <Button
              size="sm"
              className="shrink-0"
              onClick={onNewConversation}
              title="Start a new conversation"
            >
              <Plus aria-hidden="true" />
              New
            </Button>
          )}
        </div>

        {/* Channel filter (Conversations folder only) */}
        {activeFolder === "conversations" && (
          <SegmentedControl
            size="sm"
            fullWidth
            aria-label="Channel filter"
            value={activeFilter}
            onValueChange={setActiveFilter}
            options={CHANNEL_FILTERS.map((filter) => ({ value: filter.id, label: filter.label }))}
          />
        )}
      </div>

      {/* Conversation List */}
      <div className="flex-1 space-y-1 overflow-y-auto p-2" style={{ scrollbarWidth: "thin" }}>
        {/* Pinned System Messages Card (Conversations folder only) */}
        {activeFolder === "conversations" &&
          (activeFilter === "all" || activeFilter === "direct") && (
            <button
              onClick={() => onSelectConversation(SYSTEM_CONVERSATION_ID)}
              className={cn(
                "group rounded-row relative flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-[background-color,scale] duration-150 select-none active:scale-[0.98]",
                isSystemSelected
                  ? "bg-tint-fill text-label"
                  : "hover:bg-fill-4 text-label hover:text-label"
              )}
            >
              {/* System Avatar */}
              <div className="relative shrink-0">
                <div className="bg-yellow/15 text-yellow flex size-10 items-center justify-center rounded-full">
                  <Crown className="size-4" aria-hidden="true" />
                </div>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "text-body truncate",
                        isSystemSelected ? "text-label font-semibold" : "text-label font-medium"
                      )}
                    >
                      System Messages
                    </span>
                    <Crown className="text-yellow size-3.5 shrink-0" aria-label="Official" />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Pin className="text-label-tertiary size-3.5" aria-label="Pinned" />
                  </div>
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="text-footnote text-label-secondary line-clamp-1">
                    {latestSystemNotice
                      ? `${latestSystemNotice.title}: ${latestSystemNotice.description || latestSystemNotice.message || ""}`
                      : "Official platform bulletins and simulation digests"}
                  </p>
                </div>
              </div>
            </button>
          )}

        {/* Pinned LoreBot Card (Conversations folder only) */}
        {activeFolder === "conversations" &&
          (activeFilter === "all" || activeFilter === "community" || activeFilter === "direct") && (
            <button
              onClick={() => onSelectConversation(LOREBOT_CONVERSATION_ID)}
              className={cn(
                "group rounded-row relative flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-[background-color,scale] duration-150 select-none active:scale-[0.98]",
                isLoreBotSelected
                  ? "bg-tint-fill text-label"
                  : "hover:bg-fill-4 text-label hover:text-label"
              )}
            >
              {/* LoreBot Avatar */}
              <div className="relative shrink-0">
                <div className="bg-teal/15 text-teal flex size-10 items-center justify-center rounded-full">
                  <BookOpen className="size-4" aria-hidden="true" />
                </div>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "text-body truncate",
                        isLoreBotSelected ? "text-label font-semibold" : "text-label font-medium"
                      )}
                    >
                      LoreBot
                    </span>
                    <Crown className="text-yellow size-3.5 shrink-0" aria-label="Official" />
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Pin className="text-label-tertiary size-3.5" aria-label="Pinned" />
                  </div>
                </div>

                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="text-footnote text-label-secondary line-clamp-1">
                    {latestWikiChange
                      ? `Latest edit on ${latestWikiChange.title}: ${latestWikiChange.comment || `${latestWikiChange.user} updated article`}`
                      : "WikiOS updates, watchlist activity & lore dispatches"}
                  </p>
                </div>
              </div>
            </button>
          )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="border-tint size-5 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-headline text-label">
              {folderConfig?.emptyTitle || "No conversations found"}
            </p>
            <p className="text-callout text-label-secondary mt-1">
              {searchQuery
                ? `No conversations match "${searchQuery}"`
                : (folderConfig?.emptyDescription ?? "")}
            </p>
          </div>
        ) : (
          filtered.map((conversation) => (
            <MessagesConversationCard
              key={conversation.id}
              conversation={conversation}
              isSelected={conversation.id === selectedConversationId}
              onClick={() => onSelectConversation(conversation.id)}
              currentUserId={currentUserId}
              activeFolder={activeFolder}
              settings={settings}
              isMuted={mutedConversations.includes(conversation.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
