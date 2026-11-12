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
import { focusRing } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { assetUrl } from "~/lib/base-path";
import { stripHtml } from "~/lib/utils/sanitize-html";

/** The account fields a tray row shows, as `formatMessagesConversation` returns them. */
interface TrayAccount {
  displayName?: string | null;
  profileImageUrl?: string | null;
  countryName?: string | null;
  countryFlag?: string | null;
}

/** One row of the messages list (`api.messages.*`), in the shape `formatMessagesConversation` returns. */
export interface MessageTrayConversation {
  id: string;
  name?: string | null;
  type?: string;
  source?: string;
  lastMessageAt?: Date | string | number | null;
  unreadCount?: number;
  /** Everyone but the viewer; each entry carries its account under `account`. */
  otherParticipants?: Array<TrayAccount & { account?: TrayAccount | null }>;
  otherParticipant?: TrayAccount | null;
  lastMessage?: { content: string } | null;
}

interface MessageTrayItemProps {
  conversation: MessageTrayConversation;
  relativeTime: (ts: string | number | Date) => string;
  onClick: (conv: MessageTrayConversation) => void;
  onDismiss?: (conv: MessageTrayConversation) => void;
  isExpanded?: boolean;
  onExpandToggle?: () => void;
}

export function MessageTrayItem({
  conversation,
  relativeTime,
  onClick,
  onDismiss,
  isExpanded = false,
  onExpandToggle,
}: MessageTrayItemProps) {
  const isUnread = (conversation.unreadCount ?? 0) > 0;
  // The server already leaves the viewer out of the participants.
  const otherParticipant =
    conversation.otherParticipant ?? conversation.otherParticipants?.[0]?.account;

  const displayTitle =
    conversation.name ||
    otherParticipant?.displayName ||
    otherParticipant?.countryName ||
    "Dispatch";

  const lastText = conversation.lastMessage ? stripHtml(conversation.lastMessage.content) : "";
  const excerpt = lastText || "No messages yet";
  // oxlint-disable-next-line
  const timestamp = conversation.lastMessageAt ?? Date.now();

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
          role="button"
          tabIndex={0}
          onClick={() => onClick(conversation)}
          onKeyDown={(event) => {
            // Only the row itself: keys pressed inside nested controls keep their own meaning.
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onClick(conversation);
            }
          }}
          className={cn(
            focusRing,
            "focus-visible:-outline-offset-2",
            "group rounded-row duration-fast active:bg-fill-3 relative flex w-full cursor-pointer flex-col overflow-hidden border p-3 transition-[color,background-color,border-color,box-shadow,opacity,scale,translate]",
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
              ) : otherParticipant?.profileImageUrl ? (
                <img
                  src={assetUrl(otherParticipant.profileImageUrl) ?? undefined}
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
            <div className="text-label-tertiary group-hover:text-tint mt-1 shrink-0">
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </SwipeableRow.Content>
    </SwipeableRow>
  );
}
