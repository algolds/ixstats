"use client";

import { Search, Plus } from "lucide-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
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
}: MessagesConversationPanelProps) {
  const folderConfig = MESSAGE_FOLDERS.find((f) => f.id === activeFolder);

  // Filter conversations by search query
  const filtered = searchQuery.trim()
    ? conversations.filter((c) => {
        const name = c.otherParticipants[0]?.account?.displayName ?? c.name ?? "";
        return name.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : conversations;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-border/50 shrink-0 border-b p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-foreground text-sm font-semibold">
            {folderConfig?.title ?? "Messages"}
          </h2>
          {activeFolder === "personal" && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={onNewConversation}
              title="New conversation"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <p className="text-muted-foreground text-sm font-medium">
              {searchQuery.trim()
                ? "No matching conversations"
                : (folderConfig?.emptyTitle ?? "No conversations")}
            </p>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              {searchQuery.trim()
                ? "Try a different search term"
                : (folderConfig?.emptyDescription ?? "")}
            </p>
            {activeFolder === "personal" && !searchQuery.trim() && (
              <Button
                size="sm"
                className="mt-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                onClick={onNewConversation}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New Conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filtered.map((conversation) => (
              <MessagesConversationCard
                key={conversation.id}
                conversation={conversation}
                isSelected={conversation.id === selectedConversationId}
                onClick={() => onSelectConversation(conversation.id)}
                currentUserId={currentUserId}
                activeFolder={activeFolder}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
