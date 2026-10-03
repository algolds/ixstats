"use client";

import React from "react";
import {
  ChatBubble as MessageCircle,
  NavArrowRight as ChevronRight,
  Globe,
  Xmark as X,
} from "iconoir-react";
import { SwipeableRow, SwipeActionButton } from "~/components/ui/facet/swipeable/SwipeableRow";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { cn } from "~/lib/utils";

export interface MessageTrayConversation {
  id: string;
  title?: string | null;
  type?: string;
  source?: string;
  lastMessageAt?: Date | string | number | null;
  unreadCount?: number;
  participants?: Array<{
    userId: string;
    name?: string | null;
    avatarUrl?: string | null;
    countryName?: string | null;
    countryFlag?: string | null;
  }>;
  messages?: Array<{
    id: string;
    content: string;
    createdAt: Date | string | number;
    userId: string;
  }>;
}

interface MessageTrayItemProps {
  conversation: MessageTrayConversation;
  currentUserId?: string | null;
  relativeTime: (ts: string | number | Date) => string;
  onClick: (conv: MessageTrayConversation) => void;
  onDismiss?: (conv: MessageTrayConversation) => void;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

export function MessageTrayItem({
  conversation,
  currentUserId,
  relativeTime,
  onClick,
  onDismiss,
  isExpanded = false,
  onExpandToggle,
}: MessageTrayItemProps) {
  const isUnread = (conversation.unreadCount ?? 0) > 0;
  const otherParticipant =
    conversation.participants?.find((p) => p.userId !== currentUserId) ??
    conversation.participants?.[0];

  const latestMessage = conversation.messages?.[0];
  const displayTitle =
    conversation.title || otherParticipant?.name || otherParticipant?.countryName || "Dispatch";

  const excerpt = latestMessage?.content || "No messages yet";
  // oxlint-disable-next-line
  const timestamp = conversation.lastMessageAt || latestMessage?.createdAt || Date.now();

  const isDiplomatic = conversation.source === "diplomatic" || conversation.type === "diplomatic";

  return (
    <SwipeableRow
      id={`msg-tray-${conversation.id}`}
      className="rounded-row mb-2 last:mb-0"
      springPreset="bouncy"
      expanded={isExpanded}
      onExpandedChange={(expanded) => {
        if (expanded !== isExpanded && onExpandToggle) onExpandToggle();
      }}
    >
      {/* Leading actions (swipe right -> open) */}
      <SwipeableRow.Leading
        commit={{
          action: () => onClick(conversation),
          label: "Open",
          color: "var(--color-yellow)",
        }}
      >
        <SwipeActionButton
          id="open-msg"
          icon={ChevronRight}
          label="Open"
          onClick={() => onClick(conversation)}
          color="var(--color-yellow)"
        />
      </SwipeableRow.Leading>

      {/* Trailing actions (swipe left -> dismiss/clear) */}
      {onDismiss && (
        <SwipeableRow.Trailing
          commit={{
            action: () => onDismiss(conversation),
            label: "Close",
            color: "var(--color-label-secondary)",
          }}
        >
          <SwipeActionButton
            id="close-msg"
            icon={X}
            label="Close"
            onClick={() => onDismiss(conversation)}
            color="var(--color-label-secondary)"
          />
        </SwipeableRow.Trailing>
      )}

      {/* Front Card Content */}
      <SwipeableRow.Content>
        <div
          onClick={() => onClick(conversation)}
          className={cn(
            "group rounded-row relative flex w-full cursor-pointer flex-col overflow-hidden border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 active:scale-[0.985]",
            isUnread
              ? "border-yellow/30 bg-yellow/6 hover:border-yellow/50"
              : "border-separator bg-fill-4 hover:border-separator-opaque hover:bg-fill-3"
          )}
        >
          <div className="flex items-start gap-3">
            {/* Sender Avatar / Country Flag */}
            <div className="relative mt-0.5 shrink-0">
              {otherParticipant?.countryFlag ? (
                <div className="rounded-control-sm border-separator h-7 w-9 overflow-hidden border">
                  <UnifiedCountryFlag
                    countryName={otherParticipant.countryName || "Country"}
                    flagUrl={normalizeFlagUrl(otherParticipant.countryFlag)}
                    className="h-full w-full object-cover"
                    showTooltip={false}
                  />
                </div>
              ) : otherParticipant?.avatarUrl ? (
                <img
                  src={otherParticipant.avatarUrl}
                  alt=""
                  className="ring-separator h-8 w-8 rounded-full object-cover ring-1"
                />
              ) : (
                <div className="rounded-control border-yellow/20 bg-yellow/10 text-yellow flex h-8 w-8 items-center justify-center border">
                  {isDiplomatic ? (
                    <Globe className="h-4 w-4" />
                  ) : (
                    <MessageCircle className="h-4 w-4" />
                  )}
                </div>
              )}

              {/* Status Dot */}
              {isUnread && (
                <span className="ring-background bg-yellow absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full ring-2" />
              )}
            </div>

            {/* Conversation Details */}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-label text-caption truncate font-semibold">
                    {displayTitle}
                  </span>
                  {isDiplomatic && (
                    <span className="rounded-control-sm bg-yellow/15 text-caption text-yellow shrink-0 px-1 py-0.5">
                      Dispatch
                    </span>
                  )}
                </div>
                <span className="text-label-secondary text-caption shrink-0 tabular-nums">
                  {relativeTime(timestamp)}
                </span>
              </div>

              <p className="text-label-secondary group-hover:text-label text-caption line-clamp-1 leading-relaxed transition-colors">
                {excerpt}
              </p>
            </div>

            {/* Right Action Hint */}
            <div className="text-label-tertiary group-hover:text-tint mt-1 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5">
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </SwipeableRow.Content>
    </SwipeableRow>
  );
}
