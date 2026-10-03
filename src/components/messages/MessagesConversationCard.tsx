"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
// oxlint-disable-next-line eslint/no-unused-vars
import { Group as Users, BellOff, Globe, AntennaSignal as Radio } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { MessageFolder } from "~/types/messages";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { timeAgo } from "~/lib/format/compact";

const formatRelativeTime = (date: Date | string) => timeAgo(date, { suffix: false });

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
  // oxlint-disable-next-line eslint/no-unused-vars
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
    ? participantCountryName || rawName
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
      type="button"
      onClick={onClick}
      aria-current={isSelected || undefined}
      className={cn(
        "group rounded-row relative flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors duration-150 select-none",
        isSelected ? "bg-tint-fill text-label" : "hover:bg-fill-4 text-label hover:text-label"
      )}
    >
      {/* Avatar / Flag */}
      <div className="relative shrink-0">
        {isGroup ? (
          <Avatar className="border-separator size-10 border">
            <AvatarImage src={conversation.avatar ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
              <Users className="size-4" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
        ) : isDiplomatic && participantCountryFlag ? (
          <div className="border-separator rounded-control-sm h-7 w-10 overflow-hidden border">
            <UnifiedCountryFlag
              countryName={participantCountryName || displayName}
              flagUrl={normalizeFlagUrl(participantCountryFlag)}
              className="h-full w-full object-cover"
              showTooltip={false}
            />
          </div>
        ) : (
          <Avatar className="border-separator size-10 border">
            <AvatarImage src={participantAvatar ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
        )}

        {/* Crisp unread indicator dot */}
        {hasUnread && (
          <span
            className="bg-tint ring-surface absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content lines */}
      <div className="min-w-0 flex-1">
        {/* Row 1: Name + Metadata + Time */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "text-body truncate",
                hasUnread
                  ? "text-label font-semibold"
                  : isSelected
                    ? "text-label font-semibold"
                    : "text-label font-medium"
              )}
            >
              {isSelfMessage ? `${displayName} (You)` : displayName}
            </span>

            {/* Subtle contextual glyph for official / community channels */}
            {isDiplomatic && (
              <Globe className="text-label-secondary size-3.5 shrink-0" aria-label="Diplomatic" />
            )}
            {isCommunity && <span className="text-footnote text-label-secondary">• Community</span>}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isMuted && (
              <BellOff className="text-label-secondary size-3.5 shrink-0" aria-label="Muted" />
            )}
            {lastMessage && (
              <span className="text-footnote text-label-secondary tabular-nums">
                {formatRelativeTime(lastMessage.createdAt ?? lastMessage.ixTimeTimestamp)}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Message preview + Unread badge */}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p
            className={cn(
              "text-footnote line-clamp-1",
              hasUnread ? "text-label font-medium" : "text-label-secondary"
            )}
          >
            {lastMessage ? (
              <>
                {lastMessage.accountId === currentUserId ? "You: " : ""}
                {lastMessage.content.replace(/<[^>]*>/g, "")}
              </>
            ) : (
              <span className="text-label-tertiary italic">No messages yet</span>
            )}
          </p>

          {hasUnread && conversation.unreadCount > 0 && (
            <span className="bg-tint text-caption text-on-tint flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 tabular-nums">
              {conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
