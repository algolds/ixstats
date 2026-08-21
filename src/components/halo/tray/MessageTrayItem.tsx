"use client";

import React from "react";
import { MessageCircle, ChevronRight, Globe, Shield, Sparkles, X } from "lucide-react";
import { SwipeableRow, SwipeActionButton } from "~/components/ui/facet/swipeable";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { createAbsoluteUrl, cn } from "~/lib/utils";

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
    conversation.title ||
    otherParticipant?.name ||
    otherParticipant?.countryName ||
    "Dispatch";

  const excerpt = latestMessage?.content || "No messages yet";
  const timestamp = conversation.lastMessageAt || latestMessage?.createdAt || Date.now();

  const isDiplomatic = conversation.source === "diplomatic" || conversation.type === "diplomatic";

  return (
    <SwipeableRow
      id={`msg-tray-${conversation.id}`}
      className="mb-1.5 rounded-xl last:mb-0"
      springPreset="bouncy"
      expanded={isExpanded}
      onExpandedChange={(expanded) => {
        if (expanded !== isExpanded && onExpandToggle) onExpandToggle();
      }}
    >
      {/* Leading actions (swipe right -> open) */}
      <SwipeableRow.Leading
        commit={{ action: () => onClick(conversation), label: "Open", color: "#f59e0b" }}
      >
        <SwipeActionButton
          id="open-msg"
          icon={ChevronRight}
          label="Open"
          onClick={() => onClick(conversation)}
          color="#f59e0b"
        />
      </SwipeableRow.Leading>

      {/* Trailing actions (swipe left -> dismiss/clear) */}
      {onDismiss && (
        <SwipeableRow.Trailing
          commit={{ action: () => onDismiss(conversation), label: "Close", color: "#64748b" }}
        >
          <SwipeActionButton
            id="close-msg"
            icon={X}
            label="Close"
            onClick={() => onDismiss(conversation)}
            color="#64748b"
          />
        </SwipeableRow.Trailing>
      )}

      {/* Front Card Content */}
      <SwipeableRow.Content>
        <div
          onClick={() => onClick(conversation)}
          className={cn(
            "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border p-3 shadow-sm backdrop-blur-xl transition-all duration-200 active:scale-[0.985]",
            isUnread
              ? "border-amber-500/30 bg-amber-500/[0.04] shadow-xs hover:border-amber-500/50"
              : "border-border/50 bg-card/60 hover:border-border hover:bg-card/90"
          )}
        >
          <div className="flex items-start gap-3">
            {/* Sender Avatar / Country Flag */}
            <div className="relative mt-0.5 shrink-0">
              {otherParticipant?.countryFlag ? (
                <div className="h-7 w-9 overflow-hidden rounded-md border border-white/10 shadow-xs">
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
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-white/10"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-500 shadow-xs">
                  {isDiplomatic ? <Globe className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                </div>
              )}

              {/* Status Dot */}
              {isUnread && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
              )}
            </div>

            {/* Conversation Details */}
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-foreground truncate text-xs font-semibold tracking-tight">
                    {displayTitle}
                  </span>
                  {isDiplomatic && (
                    <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.2 text-[8px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                      Dispatch
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground/70 shrink-0 text-[9.5px] font-medium tabular-nums">
                  {relativeTime(timestamp)}
                </span>
              </div>

              <p className="text-muted-foreground group-hover:text-foreground/90 line-clamp-1 text-[11px] leading-relaxed font-medium transition-colors">
                {excerpt}
              </p>
            </div>

            {/* Right Action Hint */}
            <div className="text-muted-foreground/40 group-hover:text-primary mt-1 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5">
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </SwipeableRow.Content>
    </SwipeableRow>
  );
}
