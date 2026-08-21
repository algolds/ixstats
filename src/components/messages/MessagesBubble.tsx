"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Heart, Reply, Edit, Trash2, Check, CheckCheck, X, Shield } from "lucide-react";
import { cn } from "~/lib/utils";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";
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
  classification?: string | null;
  priority?: string | null;
  source?: string;
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

const QUICK_REACTIONS = ["❤️", "👍", "👎", "😂", "😮", "😢", "🔥"];

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
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const isOwn = message.accountId === currentUserId;
  const account = message.account;

  useEffect(() => {
    if (isEditing) {
      setEditContent(message.content.replace(/<[^>]*>/g, ""));
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [isEditing, message.content]);

  const handleSaveEdit = () => {
    if (editContent.trim() && editContent !== message.content) {
      actions.onEditMessage(message.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

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

          {isEditing ? (
            <div className="w-full min-w-[280px] rounded-xl border border-primary/40 bg-card p-2 shadow-md">
              <textarea
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                className="w-full resize-none bg-transparent text-xs text-foreground outline-none"
              />
              <div className="mt-1.5 flex items-center justify-end gap-1.5 border-t border-border/40 pt-1.5">
                <button
                  onClick={() => setIsEditing(false)}
                  className="cursor-pointer rounded px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="cursor-pointer rounded bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground shadow-2xs hover:bg-primary/90"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "overflow-hidden break-words shadow-sm",
                settings?.compactMode
                  ? "rounded-xl px-2 py-1 text-xs leading-normal"
                  : "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                isOwn
                  ? "rounded-br-xs bg-primary text-primary-foreground shadow-xs"
                  : "rounded-bl-xs border border-border/60 bg-card text-foreground shadow-xs dark:bg-card/80 dark:border-white/10 dark:text-slate-100",
                message.replyTo && "rounded-t-none"
              )}
              style={{
                maxWidth: MAX_BUBBLE_WIDTH,
                ...(bubbleWidth ? { width: bubbleWidth } : {}),
              }}
            >
              {message.classification && (
                <div className="mb-1 flex items-center gap-1">
                  <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-amber-300 border border-amber-400/30">
                    <Shield className="h-2.5 w-2.5" />
                    {message.classification}
                  </span>
                </div>
              )}

              <div
                className="[&>p]:mb-0"
                dangerouslySetInnerHTML={{ __html: sanitizeUserContent(highlightedContent) }}
              />

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
          )}

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
      {!isEditing && (
        <div
          className={cn(
            "border-border bg-card absolute -top-3 hidden rounded-md border shadow-xs group-hover:flex items-center",
            isOwn ? "right-full mr-2" : "left-full ml-2"
          )}
        >
          <div className="relative">
            <button
              className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded-l-md p-1.5 transition-colors"
              title="React"
              onClick={() => setShowReactions(!showReactions)}
            >
              <Heart className="h-3.5 w-3.5" />
            </button>
            {showReactions && (
              <div
                className={cn(
                  "border-border bg-card absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-lg border p-1.5 shadow-lg backdrop-blur-md",
                  isOwn ? "left-0" : "right-0"
                )}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    className="hover:bg-muted cursor-pointer rounded p-1 text-base transition-colors hover:scale-110 active:scale-95"
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
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer p-1.5 transition-colors"
            title="Reply"
            onClick={() => onReply(message)}
          >
            <Reply className="h-3.5 w-3.5" />
          </button>
          {isOwn && (
            <>
              <button
                className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer p-1.5 transition-colors"
                title="Edit"
                onClick={() => setIsEditing(true)}
              >
                <Edit className="h-3.5 w-3.5" />
              </button>

              <div className="relative">
                <button
                  className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive cursor-pointer rounded-r-md p-1.5 transition-colors"
                  title="Delete"
                  onClick={() => setShowDeleteConfirm(!showDeleteConfirm)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {showDeleteConfirm && (
                  <div
                    className={cn(
                      "border-border bg-popover text-popover-foreground absolute bottom-full z-20 mb-1 flex flex-col gap-1.5 rounded-lg border p-2 text-xs shadow-lg",
                      isOwn ? "right-0" : "left-0"
                    )}
                  >
                    <span className="text-[11px] font-semibold">Delete message?</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="cursor-pointer rounded px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          actions.onDeleteMessage(message.id);
                        }}
                        className="cursor-pointer rounded bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});
