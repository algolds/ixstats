"use client";

import React, { useState } from "react";
import { Plus, Crown, Pin, OpenBook as BookOpen } from "iconoir-react";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { MESSAGE_FOLDERS, type MessagesSettings } from "./MessagesFolderNav";
import {
  MessagesConversationCard,
  getParticipantName,
  isCommunityConversation,
  isDiplomaticConversation,
} from "./MessagesConversationCard";
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

const CHANNEL_PREDICATES: Record<ChannelFilter, (c: ThinkShareConversation) => boolean> = {
  all: () => true,
  diplomatic: isDiplomaticConversation,
  direct: (c) => !isDiplomaticConversation(c) && !isCommunityConversation(c) && c.type !== "group",
  community: isCommunityConversation,
};

interface PinnedCardProps {
  title: string;
  preview: string;
  selected: boolean;
  onSelect: () => void;
  avatarClass: string;
  icon: React.ReactNode;
}

function PinnedConversationCard({
  title,
  preview,
  selected,
  onSelect,
  avatarClass,
  icon,
}: PinnedCardProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "group rounded-row relative flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors duration-150 select-none",
        selected ? "bg-tint-fill text-label" : "hover:bg-fill-4 text-label hover:text-label"
      )}
    >
      <div className="relative shrink-0">
        <div className={cn("flex size-10 items-center justify-center rounded-full", avatarClass)}>
          {icon}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "text-body text-label truncate",
                selected ? "font-semibold" : "font-medium"
              )}
            >
              {title}
            </span>
            <Crown className="text-yellow size-3.5 shrink-0" aria-label="Official" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Pin className="text-label-tertiary size-3.5" aria-label="Pinned" />
          </div>
        </div>

        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="text-footnote text-label-secondary line-clamp-1">{preview}</p>
        </div>
      </div>
    </button>
  );
}

function filterConversations(
  conversations: ThinkShareConversation[],
  {
    channel,
    searchQuery,
    settings,
  }: { channel: ChannelFilter; searchQuery: string; settings?: MessagesSettings }
) {
  const query = searchQuery.trim() && searchQuery.toLowerCase();
  return conversations.filter(
    (c) =>
      c.source !== "thinktank" &&
      CHANNEL_PREDICATES[channel](c) &&
      (!query || (getParticipantName(c, settings) ?? "").toLowerCase().includes(query))
  );
}

function usePinnedPreviews(currentUserId: string) {
  const { data: notificationData } = api.notifications.getUserNotifications.useQuery(
    { limit: 1 },
    { enabled: !!currentUserId, staleTime: 30000 }
  );
  const { data: wikiData } = api.wikios.getRecentChanges.useQuery(
    { limit: 1 },
    { staleTime: 30000 }
  );
  const notice = notificationData?.notifications?.[0];
  const wikiChange = (wikiData as any)?.[0];

  return {
    systemPreview: notice
      ? `${notice.title}: ${notice.description || notice.message || ""}`
      : "Official platform bulletins and simulation digests",
    lorebotPreview: wikiChange
      ? `Latest edit on ${wikiChange.title}: ${wikiChange.comment || `${wikiChange.user} updated article`}`
      : "WikiOS updates, watchlist activity & lore dispatches",
  };
}

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
  settings?: MessagesSettings;
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

  const { systemPreview, lorebotPreview } = usePinnedPreviews(currentUserId);

  const isConversations = activeFolder === "conversations";
  const filtered = filterConversations(conversations, {
    channel: isConversations ? activeFilter : "all",
    searchQuery,
    settings,
  });

  const showSystemCard = isConversations && (activeFilter === "all" || activeFilter === "direct");
  const showLoreBotCard = showSystemCard || (isConversations && activeFilter === "community");

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
          {isConversations && (
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

        {isConversations && (
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
        {showSystemCard && (
          <PinnedConversationCard
            title="System messages"
            selected={selectedConversationId === SYSTEM_CONVERSATION_ID}
            onSelect={() => onSelectConversation(SYSTEM_CONVERSATION_ID)}
            avatarClass="bg-yellow/15 text-yellow"
            icon={<Crown className="size-4" aria-hidden="true" />}
            preview={systemPreview}
          />
        )}

        {showLoreBotCard && (
          <PinnedConversationCard
            title="LoreBot"
            selected={selectedConversationId === LOREBOT_CONVERSATION_ID}
            onSelect={() => onSelectConversation(LOREBOT_CONVERSATION_ID)}
            avatarClass="bg-teal/15 text-teal"
            icon={<BookOpen className="size-4" aria-hidden="true" />}
            preview={lorebotPreview}
          />
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
              settings={settings}
              isMuted={mutedConversations.includes(conversation.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
