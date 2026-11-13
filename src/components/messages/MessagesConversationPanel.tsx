"use client";

import React from "react";
import { Plus, Crown, Pin, OpenBook as BookOpen } from "iconoir-react";
import { SearchField } from "~/components/ui/search-field";
import { Button, focusRing } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { MESSAGE_FOLDERS, type MessagesSettings } from "./MessagesFolderNav";
import { MessagesConversationCard, getParticipantName } from "./MessagesConversationCard";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID, LOREBOT_CONVERSATION_ID } from "~/types/messages";
import { api } from "~/trpc/react";

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
      type="button"
      onClick={onSelect}
      className={cn(
        "group rounded-row relative flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors duration-150 select-none pointer-coarse:min-h-11",
        focusRing,
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
            <Crown className="text-yellow-ink size-3.5 shrink-0" aria-label="Official" />
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
  { searchQuery, settings }: { searchQuery: string; settings?: MessagesSettings }
) {
  const query = searchQuery.trim() && searchQuery.toLowerCase();
  return conversations.filter(
    (c) =>
      c.source !== "thinktank" &&
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
  const wikiChange = wikiData?.[0];

  return {
    systemPreview: notice
      ? `${notice.title}: ${notice.description || notice.message || ""}`
      : "Official platform bulletins and simulation digests",
    lorebotPreview: wikiChange
      ? `Latest edit on ${wikiChange.title}: ${wikiChange.comment || `${wikiChange.user} updated article`}`
      : "WikiOS updates, watchlist activity and lore dispatches",
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
  /** The list shows the archived threads, not the inbox. */
  showArchived?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
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
  showArchived = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: MessagesConversationPanelProps) {
  const folderConfig = MESSAGE_FOLDERS.find((f) => f.id === activeFolder);

  const { systemPreview, lorebotPreview } = usePinnedPreviews(currentUserId);

  const isConversations = activeFolder === "conversations" && !showArchived;
  const filtered = filterConversations(conversations, {
    searchQuery,
    settings,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="border-separator relative flex shrink-0 items-center gap-2 border-b p-3">
        <SearchField
          containerClassName="flex-1"
          placeholder="Search messages"
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

      <div className="flex-1 space-y-1 overflow-y-auto p-2" style={{ scrollbarWidth: "thin" }}>
        {isConversations && (
          <>
            <PinnedConversationCard
              title="System messages"
              selected={selectedConversationId === SYSTEM_CONVERSATION_ID}
              onSelect={() => onSelectConversation(SYSTEM_CONVERSATION_ID)}
              avatarClass="bg-yellow/15 text-yellow-ink"
              icon={<Crown className="size-4" aria-hidden="true" />}
              preview={systemPreview}
            />

            <PinnedConversationCard
              title="LoreBot"
              selected={selectedConversationId === LOREBOT_CONVERSATION_ID}
              onSelect={() => onSelectConversation(LOREBOT_CONVERSATION_ID)}
              avatarClass="bg-teal/15 text-teal-ink"
              icon={<BookOpen className="size-4" aria-hidden="true" />}
              preview={lorebotPreview}
            />
          </>
        )}

        {isLoading ? (
          <ConversationListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-headline text-label">
              {showArchived
                ? "No archived conversations"
                : (folderConfig?.emptyTitle ?? "No conversations found")}
            </p>
            <p className="text-callout text-label-secondary mt-1">
              {searchQuery
                ? `No conversations match "${searchQuery}"`
                : showArchived
                  ? "Archive a thread from its menu to keep it out of your inbox."
                  : (folderConfig?.emptyDescription ?? "")}
            </p>
            {hasMore && <LoadMoreButton isLoading={isLoadingMore} onLoadMore={onLoadMore} />}
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

        {hasMore && filtered.length > 0 && (
          <LoadMoreButton isLoading={isLoadingMore} onLoadMore={onLoadMore} />
        )}
      </div>
    </div>
  );
}

function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadMoreButton({
  isLoading,
  onLoadMore,
}: {
  isLoading: boolean;
  onLoadMore?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mt-2 w-full"
      disabled={isLoading}
      onClick={onLoadMore}
    >
      {isLoading ? "Loading more" : "Load more conversations"}
    </Button>
  );
}
