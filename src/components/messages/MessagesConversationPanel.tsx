"use client";

import React, { useState } from "react";
import { Search, Plus, Crown, Pin, BookOpen } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { motion } from "motion/react";
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

  const currentBg = "bg-emerald-500/[0.03] dark:bg-emerald-500/10";

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
      <div
        className={cn(
          "relative z-10 flex shrink-0 flex-col gap-2.5 border-b border-border/40 p-3 pb-2.5",
          currentBg
        )}
      >
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="text-muted-foreground/60 absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-9 rounded-xl border-border/50 bg-background/70 pl-9 pr-3 text-xs shadow-2xs backdrop-blur-xs"
            />
          </div>
          {activeFolder === "conversations" && (
            <Button
              size="sm"
              className="h-9 shrink-0 cursor-pointer gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs transition-all duration-150 hover:bg-primary/90 active:scale-[0.96]"
              onClick={onNewConversation}
              title="Start a new conversation"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span className="font-semibold">New</span>
            </Button>
          )}
        </div>

        {/* Channel filter chips (Conversations folder only) */}
        {activeFolder === "conversations" && (
          <div className="flex items-center gap-1 overflow-x-auto pt-0.5 scrollbar-none">
            {CHANNEL_FILTERS.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  onClick={() => setActiveFilter(filter.id)}
                  className={cn(
                    "relative cursor-pointer rounded-lg px-2.5 py-1 text-[10.5px] font-semibold tracking-tight transition-all select-none active:scale-95",
                    isActive
                      ? "text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/10"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="messages-channel-chip"
                      className="absolute inset-0 rounded-lg border border-border/60 bg-card shadow-xs"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{filter.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Conversation List */}
      <div
        className="flex-1 space-y-1 overflow-y-auto p-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(128,128,128,0.2) transparent" }}
      >
        {/* Pinned System Messages Card (Conversations folder only) */}
        {activeFolder === "conversations" && (activeFilter === "all" || activeFilter === "direct") && (
          <button
            onClick={() => onSelectConversation(SYSTEM_CONVERSATION_ID)}
            className={cn(
              "group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.985] select-none",
              isSystemSelected
                ? "bg-accent/80 text-accent-foreground shadow-2xs ring-1 ring-border/50"
                : "hover:bg-accent/20 text-foreground/90 hover:text-foreground"
            )}
          >
            {/* System Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20 shadow-2xs">
                <Crown className="h-4 w-4" />
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[13px] tracking-[-0.01em]",
                      isSystemSelected
                        ? "text-foreground font-semibold"
                        : "text-foreground/90 font-medium"
                    )}
                  >
                    System Messages
                  </span>
                  <Crown className="h-3 w-3 shrink-0 text-amber-500/80" />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Pin className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </div>

              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-[12px] leading-normal text-muted-foreground font-normal">
                  {latestSystemNotice
                    ? `${latestSystemNotice.title}: ${latestSystemNotice.description || latestSystemNotice.message || ""}`
                    : "Official platform bulletins and simulation digests"}
                </p>
              </div>
            </div>
          </button>
        )}

        {/* Pinned LoreBot Card (Conversations folder only) */}
        {activeFolder === "conversations" && (activeFilter === "all" || activeFilter === "community" || activeFilter === "direct") && (
          <button
            onClick={() => onSelectConversation(LOREBOT_CONVERSATION_ID)}
            className={cn(
              "group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.985] select-none",
              isLoreBotSelected
                ? "bg-accent/80 text-accent-foreground shadow-2xs ring-1 ring-border/50"
                : "hover:bg-accent/20 text-foreground/90 hover:text-foreground"
            )}
          >
            {/* LoreBot Avatar */}
            <div className="relative shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20 shadow-2xs">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "truncate text-[13px] tracking-[-0.01em]",
                      isLoreBotSelected
                        ? "text-foreground font-semibold"
                        : "text-foreground/90 font-medium"
                    )}
                  >
                    LoreBot
                  </span>
                  <Crown className="h-3 w-3 shrink-0 text-amber-500/80" />
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Pin className="h-3 w-3 text-muted-foreground/50" />
                </div>
              </div>

              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="line-clamp-1 text-[12px] leading-normal text-muted-foreground font-normal">
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
            <div className="border-primary h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <p className="text-foreground text-xs font-semibold">
              {folderConfig?.emptyTitle || "No conversations found"}
            </p>
            <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
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

