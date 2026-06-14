"use client";

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
  // eslint-disable-next-line unused-imports/no-unused-vars
  onOpenGroupsDirectory,
  settings,
  mutedConversations = [],
}: MessagesConversationPanelProps) {
  const folderConfig = MESSAGE_FOLDERS.find((f) => f.id === activeFolder);

  // Folder-specific dynamic color accents for the search header background
  const folderBgs: Record<MessageFolder, string> = {
    conversations: "bg-emerald-500/10",
    system: "bg-rose-500/10",
    groups: "bg-blue-500/10",
  };
  const currentBg = folderBgs[activeFolder] || "bg-emerald-500/10";

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
      {/* Header */}
      <div
        className={cn(
          "relative z-10 flex shrink-0 items-center gap-2 border-b border-white/5 p-3",
          currentBg
        )}
      >
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        {activeFolder === "conversations" && (
          <Button
            size="icon"
            variant="ghost"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white"
            onClick={onNewConversation}
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
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
            {activeFolder === "conversations" && !searchQuery.trim() && (
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
          <div className="flex flex-col gap-2">
            {filtered.map((conversation) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
