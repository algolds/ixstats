"use client";

import React from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { MESSAGE_FOLDERS } from "./MessagesFolderNav";
import { MessagesConversationCard } from "./MessagesConversationCard";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";

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
  onOpenGroupsDirectory?: () => void;
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
  onOpenGroupsDirectory,
  settings,
  mutedConversations = [],
}: MessagesConversationPanelProps) {
  const folderConfig = MESSAGE_FOLDERS.find((f) => f.id === activeFolder);

  // Folder-specific dynamic color accents for the search header background
  const folderBgs: Record<MessageFolder, string> = {
    conversations: "bg-emerald-500/[0.04] dark:bg-emerald-500/10",
    system: "bg-rose-500/[0.04] dark:bg-rose-500/10",
    groups: "bg-blue-500/[0.04] dark:bg-blue-500/10",
  };
  const currentBg = folderBgs[activeFolder] || "bg-emerald-500/[0.04]";

  // Filter conversations by search query
  const filtered = searchQuery.trim()
    ? conversations.filter((c) => {
        const otherParticipant = c.otherParticipants[0];
        const name =
          settings?.displayNamePreference === "account" && otherParticipant?.account?.username
            ? `@${otherParticipant.account.username}`
            : (otherParticipant?.account?.displayName ?? c.name ?? "");
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  return (
    <div className="flex h-full flex-col">
      {/* Search and Action Header */}
      <div
        className={cn(
          "relative z-10 flex shrink-0 items-center gap-2 border-b border-border/40 p-3",
          currentBg
        )}
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground/60 absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 border-border/50 bg-background/60 pl-8 text-xs shadow-2xs backdrop-blur-xs"
          />
        </div>
        {activeFolder === "conversations" && (
          <Button
            size="icon"
            variant="ghost"
            className="hover:bg-accent/15 text-muted-foreground hover:text-foreground flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/40 bg-card/40 transition-all active:scale-95"
            onClick={onNewConversation}
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Conversation List */}
      <div
        className="flex-1 space-y-1 overflow-y-auto p-2"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(128,128,128,0.2) transparent" }}
      >
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
            {activeFolder === "groups" && onOpenGroupsDirectory && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 text-xs"
                onClick={onOpenGroupsDirectory}
              >
                Browse Groups Directory
              </Button>
            )}
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
