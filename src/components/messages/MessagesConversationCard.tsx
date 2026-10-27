"use client";

import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Group as Users, BellOff, Globe } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessagesSettings } from "./MessagesFolderNav";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { timeAgo } from "~/lib/format/compact";

type CardSettings = Partial<Pick<MessagesSettings, "displayNamePreference">>;

/** Name shown for the other participant, honouring the account-vs-country preference. */
export function getParticipantName(conversation: ThinkShareConversation, settings?: CardSettings) {
  const account = conversation.otherParticipants?.[0]?.account;
  return settings?.displayNamePreference === "account" && account?.username
    ? `@${account.username}`
    : (account?.displayName ?? conversation.name);
}

export const isDiplomaticConversation = (c: ThinkShareConversation) =>
  c.source === "diplomatic" || c.conversationType === "diplomatic";

export const isCommunityConversation = (c: ThinkShareConversation) =>
  ["wiki", "forum", "community"].includes(c.source ?? "");

function getCardIdentity(conversation: ThinkShareConversation, settings?: CardSettings) {
  const other = conversation.otherParticipants?.[0];
  const isDiplomatic = isDiplomaticConversation(conversation);
  const isGroup = conversation.type === "group" || conversation.source === "thinktank";
  const countryName = other?.account?.countryName || other?.countryName || null;
  const rawName = getParticipantName(conversation, settings) ?? "Unknown";

  return {
    other,
    isDiplomatic,
    isGroup,
    isCommunity: isCommunityConversation(conversation),
    countryName,
    countryFlag: other?.account?.countryFlag || other?.countryFlag || null,
    displayName: isDiplomatic
      ? countryName || rawName
      : isGroup
        ? (conversation.name ?? "Group Chat")
        : rawName,
  };
}

function CardAvatar({
  conversation,
  identity,
}: {
  conversation: ThinkShareConversation;
  identity: ReturnType<typeof getCardIdentity>;
}) {
  const { isGroup, isDiplomatic, countryFlag, countryName, displayName, other } = identity;

  if (!isGroup && isDiplomatic && countryFlag) {
    return (
      <div className="border-separator rounded-control-sm h-7 w-10 overflow-hidden border">
        <UnifiedCountryFlag
          countryName={countryName || displayName}
          flagUrl={normalizeFlagUrl(countryFlag)}
          className="h-full w-full object-cover"
          showTooltip={false}
        />
      </div>
    );
  }

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <Avatar className="border-separator size-10 border">
      <AvatarImage
        src={(isGroup ? conversation.avatar : other?.account?.profileImageUrl) ?? undefined}
        alt={displayName}
      />
      <AvatarFallback className="bg-fill-3 text-caption text-label-secondary">
        {isGroup ? <Users className="size-4" aria-hidden="true" /> : initials || "?"}
      </AvatarFallback>
    </Avatar>
  );
}

interface MessagesConversationCardProps {
  conversation: ThinkShareConversation;
  isSelected: boolean;
  onClick: () => void;
  currentUserId: string;
  settings?: CardSettings;
  isMuted?: boolean;
}

export const MessagesConversationCard = React.memo(function MessagesConversationCard({
  conversation,
  isSelected,
  onClick,
  currentUserId,
  settings,
  isMuted = false,
}: MessagesConversationCardProps) {
  const { lastMessage, unreadCount } = conversation;
  const hasUnread = unreadCount > 0;
  const identity = getCardIdentity(conversation, settings);
  const { displayName, isDiplomatic, isCommunity, other } = identity;
  const isSelfMessage = other?.accountId === currentUserId;

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
      <div className="relative shrink-0">
        <CardAvatar conversation={conversation} identity={identity} />
        {hasUnread && (
          <span
            className="bg-tint ring-surface absolute -top-0.5 -right-0.5 size-2.5 rounded-full ring-2"
            aria-hidden="true"
          />
        )}
        {conversation.type === "direct" && other?.isOnline && (
          <span
            className="bg-success ring-surface absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2"
            aria-label="Online"
            role="img"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "text-body text-label truncate",
                hasUnread || isSelected ? "font-semibold" : "font-medium"
              )}
            >
              {isSelfMessage ? `${displayName} (You)` : displayName}
            </span>
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
                {timeAgo(lastMessage.createdAt ?? lastMessage.ixTimeTimestamp, { suffix: false })}
              </span>
            )}
          </div>
        </div>

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

          {hasUnread && (
            <span className="bg-tint text-caption text-on-tint flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-1 tabular-nums">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
