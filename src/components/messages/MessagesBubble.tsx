"use client";

import React, { useState, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Heart, Reply, Edit, Trash2, Check, CheckCheck } from "lucide-react";
import { cn } from "~/lib/utils";
import { usePretextWithSegments, useShrinkwrap } from "~/lib/pretext/use-pretext";
import type { MessagesSettings } from "./MessagesFolderNav";

interface MessageAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  accountType: string;
}

interface Message {
  id: string;
  conversationId: string;
  accountId: string;
  account: MessageAccount;
  content: string;
  messageType: string;
  ixTimeTimestamp: Date;
  createdAt?: Date;
  reactions?: Record<string, number>;
  readReceipts?: { id: string; accountId: string; readAt: Date }[];
  editedAt?: Date;
  deletedAt?: Date;
  replyTo?: Message;
}

export type { Message };

export interface MessageActions {
  onAddReaction: (messageId: string, reaction: string) => void;
  onRemoveReaction: (messageId: string, reaction: string) => void;
  onEditMessage: (messageId: string, content: string) => void;
  onDeleteMessage: (messageId: string) => void;
}

interface MessagesBubbleProps {
  message: Message;
  currentUserId: string;
  isConsecutive: boolean;
  onReply: (message: Message) => void;
  actions: MessageActions;
  settings?: MessagesSettings;
  searchQuery?: string;
}

const QUICK_REACTIONS = ["❤️", "👍", "👎", "😂", "😮", "😢", "😡"];

// Pretext shrinkwrap constants
const BUBBLE_PADDING_X = 24; // px-3 = 12px * 2
const MAX_BUBBLE_WIDTH = 480; // max bubble content width in px
const BUBBLE_FONT = "14px ui-sans-serif, system-ui, sans-serif"; // matches text-sm

function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Strip HTML tags to get plain text for Pretext measurement */
// eslint-disable-next-line unused-imports/no-unused-vars
function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent ?? tmp.innerText ?? "";
  }
  return html.replace(/<[^>]*>/g, "");
}

export const MessagesBubble = React.memo(function MessagesBubble({
  message,
  currentUserId,
  isConsecutive,
  onReply,
  actions,
  settings,
  searchQuery,
}: MessagesBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);

  const isOwn = message.accountId === currentUserId;
  const account = message.account;

  // Only apply Pretext shrinkwrap to plain-text messages.
  // HTML content (wiki edits, forum messages) has bold/link formatting that
  // renders wider than the plain-text measurement, causing overflow.
  const hasHtml = useMemo(() => /<[a-z][\s\S]*>/i.test(message.content), [message.content]);
  const plainText = useMemo(() => (hasHtml ? "" : message.content), [hasHtml, message.content]);
  const textMaxWidth = MAX_BUBBLE_WIDTH - BUBBLE_PADDING_X;
  const prepared = usePretextWithSegments(plainText, BUBBLE_FONT);
  const shrinkwrappedWidth = useShrinkwrap(prepared, textMaxWidth);
  const bubbleWidth =
    !hasHtml && shrinkwrappedWidth > 0
      ? Math.min(MAX_BUBBLE_WIDTH, shrinkwrappedWidth + BUBBLE_PADDING_X)
      : undefined;

  const getDisplayName = (acc: { username?: string; displayName: string }) => {
    return settings?.displayNamePreference === "account" && acc.username
      ? `@${acc.username}`
      : acc.displayName;
  };

  const resolvedDisplayName = account ? getDisplayName(account) : "";

  const initials = (resolvedDisplayName ?? "?")
    .replace(/^@/, "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2);

  // Highlight matching search text
  const highlightedContent = useMemo(() => {
    const content = message.content;
    if (!searchQuery?.trim()) return content;

    const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const parts = content.split(/(<[^>]+>)/g);
    const highlightedParts = parts.map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) {
        return part;
      }
      const regex = new RegExp(`(${escapedQuery})`, "gi");
      return part.replace(
        regex,
        '<mark class="bg-yellow-500/40 text-slate-100 rounded-sm px-0.5">$1</mark>'
      );
    });

    return highlightedParts.join("");
  }, [message.content, searchQuery]);

  if (!account) return null;

  return (
    <div
      className={cn(
        "group relative flex transition-colors",
        settings?.compactMode ? "gap-1.5 px-2 py-px" : "gap-2 px-4 py-0.5",
        isOwn ? "flex-row-reverse" : "flex-row",
        !isConsecutive && (settings?.compactMode ? "mt-1 pt-0.5" : "mt-3 pt-1")
      )}
    >
      {/* Avatar column */}
      <div className={cn(settings?.compactMode ? "w-6" : "w-8", "shrink-0", isOwn && "hidden")}>
        {!isConsecutive && (
          <Avatar className={settings?.compactMode ? "h-6 w-6" : "h-8 w-8"}>
            <AvatarImage src={account.profileImageUrl ?? undefined} />
            <AvatarFallback
              className={cn(
                "bg-gradient-to-br from-emerald-500 to-teal-600 font-semibold text-white",
                settings?.compactMode ? "text-[8px]" : "text-[10px]"
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Message content container */}
      <div className={cn("flex max-w-[80%] flex-col", isOwn ? "items-end" : "items-start")}>
        {!isConsecutive && !isOwn && (
          <div className="mb-1 ml-1 flex items-baseline gap-2">
            <span className="text-foreground/70 text-[11px] font-semibold">
              {resolvedDisplayName}
            </span>
          </div>
        )}

        <div className="group/bubble relative">
          {message.replyTo && (
            <div
              className={cn(
                "bg-muted/40 text-muted-foreground mb-1 flex items-center gap-1.5 rounded-t-lg px-2 py-1 text-[10px]",
                isOwn ? "rounded-bl-lg" : "rounded-br-lg"
              )}
            >
              <Reply className="h-2.5 w-2.5 shrink-0" />
              <span className="max-w-[150px] truncate font-medium">
                {message.replyTo.account ? getDisplayName(message.replyTo.account) : "Unknown"}:{" "}
                {message.replyTo.content.replace(/<[^>]*>/g, "").substring(0, 30)}
              </span>
            </div>
          )}

          <div
            className={cn(
              "overflow-hidden break-words shadow-sm",
              settings?.compactMode
                ? "rounded-xl px-2 py-1 text-xs leading-normal"
                : "rounded-2xl px-3 py-2 text-sm leading-relaxed",
              isOwn
                ? "rounded-br-sm bg-blue-600 text-white"
                : "rounded-bl-sm border border-white/5 bg-white/10 text-slate-100",
              message.replyTo && "rounded-t-none"
            )}
            style={{
              maxWidth: MAX_BUBBLE_WIDTH,
              ...(bubbleWidth ? { width: bubbleWidth } : {}),
            }}
          >
            <div className="[&>p]:mb-0" dangerouslySetInnerHTML={{ __html: highlightedContent }} />

            <div
              className={cn(
                "mt-1 flex items-center gap-1.5 text-[9px]",
                isOwn
                  ? "text-primary-foreground/60 justify-end"
                  : "text-muted-foreground/70 justify-start"
              )}
            >
              <span>{formatTimestamp(message.createdAt ?? message.ixTimeTimestamp)}</span>
              {message.editedAt && <span>(edited)</span>}
              {isOwn && message.readReceipts && (!settings || settings.showReadReceipts) && (
                <span>
                  {message.readReceipts.length > 0 ? (
                    <CheckCheck className="h-2.5 w-2.5" />
                  ) : (
                    <Check className="h-2.5 w-2.5" />
                  )}
                </span>
              )}
            </div>
          </div>

          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div
              className={cn("mt-1 flex flex-wrap gap-1", isOwn ? "justify-end" : "justify-start")}
            >
              {Object.entries(message.reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  className="border-border/30 bg-background/50 hover:bg-muted flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors"
                  onClick={() => actions.onRemoveReaction(message.id, emoji)}
                >
                  <span>{emoji}</span>
                  <span className="opacity-70">{count as number}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hover action buttons */}
      <div
        className={cn(
          "border-border bg-background absolute -top-3 hidden rounded-md border shadow-sm group-hover:flex",
          isOwn ? "right-full mr-2" : "left-full ml-2"
        )}
      >
        <div className="relative">
          <button
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-l-md p-1.5 transition-colors"
            title="React"
            onClick={() => setShowReactions(!showReactions)}
          >
            <Heart className="h-3.5 w-3.5" />
          </button>
          {showReactions && (
            <div
              className={cn(
                "border-border bg-background absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-lg border p-1.5 shadow-lg",
                isOwn ? "left-0" : "right-0"
              )}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className="hover:bg-muted rounded p-1 text-base transition-colors"
                  onClick={() => {
                    actions.onAddReaction(message.id, emoji);
                    setShowReactions(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className="text-muted-foreground hover:bg-muted hover:text-foreground p-1.5 transition-colors"
          title="Reply"
          onClick={() => onReply(message)}
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
        {isOwn && (
          <>
            <button
              className="text-muted-foreground hover:bg-muted hover:text-foreground p-1.5 transition-colors"
              title="Edit"
              onClick={() => {
                const newContent = prompt("Edit message:", message.content.replace(/<[^>]*>/g, ""));
                if (newContent) actions.onEditMessage(message.id, newContent);
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              className="text-muted-foreground hover:bg-destructive hover:text-destructive-foreground rounded-r-md p-1.5 transition-colors"
              title="Delete"
              onClick={() => {
                if (confirm("Delete this message?")) {
                  actions.onDeleteMessage(message.id);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});
