"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Users, BellOff } from "lucide-react";
import { cn } from "~/lib/utils";
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
  conversation: any;
  isSelected: boolean;
  onClick: () => void;
  currentUserId: string;
  activeFolder: MessageFolder;
  settings?: any;
  isMuted?: boolean;
}

export const MessagesConversationCard = React.memo(function MessagesConversationCard({
  conversation,
  isSelected,
  onClick,
  currentUserId,
  activeFolder,
  settings,
  isMuted = false,
}: MessagesConversationCardProps) {
  const otherParticipant = conversation.otherParticipants[0];
  const lastMessage = conversation.lastMessage;
  const hasUnread = conversation.unreadCount > 0;

  const typeTag = React.useMemo(() => {
    if (conversation.source === "diplomatic" || conversation.conversationType === "diplomatic") {
      return {
        label: "Diplomatic",
        classes: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      };
    }
    if (conversation.type === "group" || conversation.source === "thinktank") {
      return {
        label: "Group",
        classes: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
      };
    }
    if (conversation.source === "wiki") {
      return {
        label: "Wiki",
        classes: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      };
    }
    return {
      label: "Personal",
      classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    };
  }, [conversation]);

  // Resolve identity based on folder context
  const participantName =
    settings?.displayNamePreference === "account" && otherParticipant?.account?.username
      ? `@${otherParticipant.account.username}`
      : (otherParticipant?.account?.displayName ?? conversation.name ?? "Unknown");
  const participantAvatar = otherParticipant?.account?.profileImageUrl ?? null;
  const identity = resolveIdentity(
    participantName,
    participantAvatar,
    activeFolder,
    null,
    null,
    conversation.source,
    conversation.conversationType
  );

  const initials = identity.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  const isSelfMessage = otherParticipant?.accountId === currentUserId;

  const leftBorderClass = React.useMemo(() => {
    if (conversation.source === "diplomatic" || conversation.conversationType === "diplomatic") {
      return "border-l-2 border-l-amber-500";
    }
    if (conversation.type === "group" || conversation.source === "thinktank") {
      return "border-l-2 border-l-indigo-500";
    }
    if (conversation.source === "wiki") {
      return "border-l-2 border-l-purple-500";
    }
    return "border-l-2 border-l-emerald-500";
  }, [conversation]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex w-full cursor-pointer items-start gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-300 hover:scale-[1.01] hover:shadow-lg hover:shadow-black/10",
        leftBorderClass,
        isSelected
          ? "border-indigo-500/40 bg-indigo-600/20 shadow-indigo-950/20"
          : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.06]",
        hasUnread && !isSelected && "bg-white/[0.04]"
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
                hasUnread ? "text-foreground font-semibold" : "text-foreground/90 font-medium"
              )}
            >
              {isSelfMessage
                ? `${identity.displayName} (You)`
                : conversation.type === "group"
                  ? (conversation.name ?? "Group Chat")
                  : identity.displayName}
            </span>
            <MessagesIdentityBadge identity={identity} />
            <span
              className={cn(
                "shrink-0 rounded border px-1.5 py-0.5 text-[8px] font-bold",
                typeTag.classes
              )}
            >
              {typeTag.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isMuted && <BellOff className="h-3 w-3 shrink-0 text-slate-400" />}
            {lastMessage && (
              <span className="text-muted-foreground text-[11px]">
                {formatRelativeTime(lastMessage.createdAt ?? lastMessage.ixTimeTimestamp)}
              </span>
            )}
            {hasUnread && (
              <Badge
                variant="secondary"
                className={cn(
                  "h-5 min-w-[20px] px-1.5 text-[10px] transition-colors",
                  isMuted
                    ? "border-none bg-slate-700 text-slate-300 hover:bg-slate-700"
                    : "bg-primary text-primary-foreground"
                )}
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
              hasUnread ? "text-foreground/70 font-medium" : "text-muted-foreground"
            )}
          >
            {lastMessage.accountId === currentUserId ? "You: " : ""}
            {lastMessage.content.replace(/<[^>]*>/g, "")}
          </p>
        )}
      </div>
    </button>
  );
});
