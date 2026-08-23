"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Group as Users, BellOff, Globe, Shield, AntennaSignal as Radio, Pin } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { MessageFolder } from "~/types/messages";
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
  const otherParticipant = conversation.otherParticipants?.[0];
  const lastMessage = conversation.lastMessage;
  const hasUnread = conversation.unreadCount > 0;

  // Resolve identity based on settings & domain
  const isDiplomatic =
    conversation.source === "diplomatic" || conversation.conversationType === "diplomatic";
  const isGroup = conversation.type === "group" || conversation.source === "thinktank";
  const isCommunity =
    conversation.source === "wiki" ||
    conversation.source === "forum" ||
    conversation.source === "community";

  const participantCountryFlag =
    otherParticipant?.account?.countryFlag || otherParticipant?.countryFlag || null;
  const participantCountryName =
    otherParticipant?.account?.countryName || otherParticipant?.countryName || null;

  const rawName =
    settings?.displayNamePreference === "account" && otherParticipant?.account?.username
      ? `@${otherParticipant.account.username}`
      : (otherParticipant?.account?.displayName ?? conversation.name ?? "Unknown");

  const displayName = isDiplomatic
    ? (participantCountryName || rawName)
    : isGroup
      ? (conversation.name ?? "Group Chat")
      : rawName;

  const participantAvatar = otherParticipant?.account?.profileImageUrl ?? null;
  const isSelfMessage = otherParticipant?.accountId === currentUserId;

  const initials = displayName
    .split(" ")
    .map((n: string) => n[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.985] select-none",
        isSelected
          ? "bg-accent/80 text-accent-foreground shadow-2xs ring-1 ring-border/50"
          : "hover:bg-accent/20 text-foreground/90 hover:text-foreground"
      )}
    >
      {/* Avatar / Flag */}
      <div className="relative shrink-0">
        {isGroup ? (
          <Avatar className="h-10 w-10 ring-1 ring-border/30">
            <AvatarImage src={conversation.avatar ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
              <Users className="h-4 w-4 opacity-80" />
            </AvatarFallback>
          </Avatar>
        ) : isDiplomatic && participantCountryFlag ? (
          <div className="h-7 w-10 overflow-hidden rounded-md ring-1 ring-border/30 shadow-2xs">
            <UnifiedCountryFlag
              countryName={participantCountryName || displayName}
              flagUrl={normalizeFlagUrl(participantCountryFlag)}
              className="h-full w-full object-cover"
              showTooltip={false}
            />
          </div>
        ) : (
          <Avatar className="h-10 w-10 ring-1 ring-border/25">
            <AvatarImage src={participantAvatar ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Crisp unread indicator dot */}
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
        )}
      </div>

      {/* Content lines */}
      <div className="min-w-0 flex-1">
        {/* Row 1: Name + Metadata + Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "truncate text-[13px] tracking-[-0.01em]",
                hasUnread
                  ? "text-foreground font-semibold"
                  : isSelected
                    ? "text-foreground font-semibold"
                    : "text-foreground/90 font-medium"
              )}
            >
              {isSelfMessage ? `${displayName} (You)` : displayName}
            </span>

            {/* Subtle contextual glyph for official / community channels */}
            {isDiplomatic && (
              <Globe className="h-3 w-3 shrink-0 text-amber-500/80" />
            )}
            {isCommunity && (
              <span className="text-muted-foreground/60 text-[10.5px] font-normal">
                • Community
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {isMuted && <BellOff className="text-muted-foreground/50 h-3 w-3 shrink-0" />}
            {lastMessage && (
              <span className="text-muted-foreground/60 text-[11px] font-normal tabular-nums">
                {formatRelativeTime(lastMessage.createdAt ?? lastMessage.ixTimeTimestamp)}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Message preview + Unread badge */}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "line-clamp-1 text-[12px] leading-normal",
              hasUnread
                ? "text-foreground font-medium"
                : "text-muted-foreground font-normal"
            )}
          >
            {lastMessage ? (
              <>
                {lastMessage.accountId === currentUserId ? "You: " : ""}
                {lastMessage.content.replace(/<[^>]*>/g, "")}
              </>
            ) : (
              <span className="italic opacity-60">No messages yet</span>
            )}
          </p>

          {hasUnread && conversation.unreadCount > 0 && (
            <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums shadow-2xs">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
