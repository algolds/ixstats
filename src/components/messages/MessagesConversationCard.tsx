"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Users } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";
import { resolveIdentity, MessagesIdentityBadge } from "./MessagesIdentityBadge";

function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface MessagesConversationCardProps {
  conversation: ThinkShareConversation;
  isSelected: boolean;
  onClick: () => void;
  currentUserId: string;
  activeFolder: MessageFolder;
}

export const MessagesConversationCard = React.memo(
  function MessagesConversationCard({
    conversation,
    isSelected,
    onClick,
    currentUserId,
    activeFolder,
  }: MessagesConversationCardProps) {
    const otherParticipant = conversation.otherParticipants[0];
    const lastMessage = conversation.lastMessage;
    const hasUnread = conversation.unreadCount > 0;

    // Resolve identity based on folder context
    const participantName =
      otherParticipant?.account?.displayName ?? conversation.name ?? "Unknown";
    const participantAvatar = otherParticipant?.account?.profileImageUrl ?? null;
    const identity = resolveIdentity(
      participantName,
      participantAvatar,
      activeFolder
    );

    const initials = identity.displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    const isSelfMessage = otherParticipant?.accountId === currentUserId;

    return (
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
          isSelected
            ? "bg-primary/10 border border-primary/20"
            : "hover:bg-muted/50 border border-transparent",
          hasUnread && !isSelected && "bg-muted/30"
        )}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {conversation.type === "group" ? (
            <Avatar className="h-10 w-10">
              <AvatarImage src={conversation.avatar ?? undefined} />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-semibold text-white">
                <Users className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarImage src={identity.avatar ?? undefined} />
              <AvatarFallback
                className={cn(
                  "text-xs font-semibold text-white",
                  isSelfMessage
                    ? "bg-gradient-to-br from-blue-500 to-purple-600"
                    : "bg-gradient-to-br from-emerald-500 to-teal-600"
                )}
              >
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  "truncate text-sm",
                  hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                )}
              >
                {isSelfMessage
                  ? `${identity.displayName} (You)`
                  : conversation.type === "group"
                    ? conversation.name ?? "Group Chat"
                    : identity.displayName}
              </span>
              <MessagesIdentityBadge identity={identity} />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {lastMessage && (
                <span className="text-[11px] text-muted-foreground">
                  {formatRelativeTime(
                    lastMessage.createdAt ?? lastMessage.ixTimeTimestamp
                  )}
                </span>
              )}
              {hasUnread && (
                <Badge
                  variant="secondary"
                  className="h-5 min-w-[20px] bg-primary px-1.5 text-[10px] text-primary-foreground"
                >
                  {conversation.unreadCount}
                </Badge>
              )}
            </div>
          </div>

          {lastMessage && (
            <p
              className={cn(
                "line-clamp-1 text-xs",
                hasUnread
                  ? "font-medium text-foreground/70"
                  : "text-muted-foreground"
              )}
            >
              {lastMessage.accountId === currentUserId ? "You: " : ""}
              {lastMessage.content.replace(/<[^>]*>/g, "")}
            </p>
          )}
        </div>
      </button>
    );
  }
);
