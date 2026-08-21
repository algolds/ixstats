"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Users, BellOff } from "lucide-react";
import { cn } from "~/lib/utils";
import type { MessageFolder } from "~/types/messages";
import { resolveIdentity, MessagesIdentityBadge } from "./MessagesIdentityBadge";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";

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
        classes: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      };
    }
    if (conversation.type === "group" || conversation.source === "thinktank") {
      return {
        label: "Group",
        classes: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
      };
    }
    if (conversation.source === "wiki") {
      return {
        label: "Wiki",
        classes: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
      };
    }
    return {
      label: "Personal",
      classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    };
  }, [conversation]);

  // Resolve identity based on folder context
  const participantName =
    settings?.displayNamePreference === "account" && otherParticipant?.account?.username
      ? `@${otherParticipant.account.username}`
      : (otherParticipant?.account?.displayName ?? conversation.name ?? "Unknown");
  const participantAvatar = otherParticipant?.account?.profileImageUrl ?? null;
  const participantCountryFlag =
    otherParticipant?.account?.countryFlag || otherParticipant?.countryFlag || null;
  const participantCountryName =
    otherParticipant?.account?.countryName || otherParticipant?.countryName || null;

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
      return "border-l-[3px] border-l-amber-500";
    }
    if (conversation.type === "group" || conversation.source === "thinktank") {
      return "border-l-[3px] border-l-indigo-500";
    }
    if (conversation.source === "wiki") {
      return "border-l-[3px] border-l-purple-500";
    }
    return "border-l-[3px] border-l-emerald-500";
  }, [conversation]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full cursor-pointer items-start gap-3 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all duration-200 active:scale-[0.985]",
        leftBorderClass,
        isSelected
          ? "border-primary/50 bg-primary/10 shadow-xs"
          : "border-border/40 bg-card/40 hover:border-border/80 hover:bg-card/80",
        hasUnread && !isSelected && "border-blue-500/30 bg-blue-500/[0.04]"
      )}
    >
      {/* Avatar or National Flag */}
      <div className="relative mt-0.5 shrink-0">
        {conversation.type === "group" ? (
          <Avatar className="h-9 w-9">
            <AvatarImage src={conversation.avatar ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-blue-600 text-xs font-semibold text-white">
              <Users className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        ) : participantCountryFlag ? (
          <div className="h-8 w-10 overflow-hidden rounded-md border border-border/50 shadow-2xs">
            <UnifiedCountryFlag
              countryName={participantCountryName || identity.displayName}
              flagUrl={normalizeFlagUrl(participantCountryFlag)}
              className="h-full w-full object-cover"
              showTooltip={false}
            />
          </div>
        ) : (
          <Avatar className="h-9 w-9">
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

        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "truncate text-xs tracking-tight",
                hasUnread ? "text-foreground font-bold" : "text-foreground/90 font-semibold"
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
                "shrink-0 rounded border px-1 py-0.2 text-[8px] font-bold tracking-wider uppercase",
                typeTag.classes
              )}
            >
              {typeTag.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {isMuted && <BellOff className="text-muted-foreground/60 h-3 w-3 shrink-0" />}
            {lastMessage && (
              <span className="text-muted-foreground/70 text-[9.5px] font-medium tabular-nums">
                {formatRelativeTime(lastMessage.createdAt ?? lastMessage.ixTimeTimestamp)}
              </span>
            )}
            {hasUnread && (
              <Badge
                variant="secondary"
                className={cn(
                  "h-4.5 min-w-[18px] rounded-full px-1 text-[9px] font-bold tabular-nums shadow-2xs",
                  isMuted
                    ? "bg-muted text-muted-foreground"
                    : "bg-blue-500 text-white"
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
              "line-clamp-1 text-[11px] leading-relaxed",
              hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground"
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
