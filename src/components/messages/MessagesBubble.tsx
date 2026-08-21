"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Heart,
  Reply,
  Edit,
  Trash2,
  Check,
  CheckCheck,
  X,
  Shield,
  Smile,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { sanitizeUserContent } from "~/lib/utils/sanitize-html";
import { usePretextWithSegments, useShrinkwrap } from "~/lib/pretext/use-pretext";
import { soundEffects } from "~/lib/sound/cuelume";
import type { MessagesSettings } from "./MessagesFolderNav";

interface MessageAccount {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  accountType?: string;
  country?: {
    id?: string;
    name?: string;
    flag?: string | null;
  } | null;
}

interface Message {
  id: string;
  conversationId: string;
  accountId: string;
  account?: MessageAccount;
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
const BUBBLE_FONT = "13.5px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

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

  // Resilient fallback for account details
  const account: MessageAccount = useMemo(() => {
    return (
      message.account || {
        id: message.accountId,
        username: `user_${message.accountId?.slice(-6) || "guest"}`,
        displayName: isOwn ? "You" : `User ${message.accountId?.slice(-6) || "Guest"}`,
        profileImageUrl: null,
        accountType: "citizen",
      }
    );
  }, [message.account, message.accountId, isOwn]);

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

  const resolvedDisplayName = getDisplayName(account);

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
        '<mark class="bg-yellow-500/40 text-slate-100 rounded-xs px-0.5">$1</mark>'
      );
    });

    return highlightedParts.join("");
  }, [message.content, searchQuery]);

  return (
    <div
      className={cn(
        "group relative flex w-full transition-colors gap-2.5 px-3 md:px-4 py-0.5",
        isOwn ? "flex-row-reverse" : "flex-row",
        !isConsecutive && "mt-3 pt-0.5"
      )}
    >
      {/* Avatar column */}
      <div className={cn("w-8 shrink-0", isOwn && "hidden")}>
        {!isConsecutive ? (
          <Avatar className="h-8 w-8 rounded-full border border-border/50 shadow-2xs">
            <AvatarImage src={account.profileImageUrl ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              {account.country?.flag ? account.country.flag : initials}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="h-8 w-8" />
        )}
      </div>

      {/* Message content container */}
      <div className={cn("relative flex max-w-[85%] sm:max-w-[75%] flex-col", isOwn ? "items-end" : "items-start")}>
        {!isConsecutive && !isOwn && (
          <div className="mb-1 ml-1 flex items-baseline gap-1.5">
            <span className="text-[11px] font-semibold text-foreground/80">
              {resolvedDisplayName}
            </span>
            {account.country?.name && (
              <span className="text-[10px] text-muted-foreground">
                · {account.country.name}
              </span>
            )}
          </div>
        )}

        <div className="group/bubble relative">
          {/* Reply Context Header */}
          {message.replyTo && (
            <div
              className={cn(
                "mb-0.5 flex items-center gap-1.5 rounded-t-xl px-2.5 py-1 text-[10px] backdrop-blur-md",
                isOwn
                  ? "bg-emerald-700/60 text-emerald-100"
                  : "bg-muted/60 text-muted-foreground border border-b-0 border-border/40"
              )}
            >
              <Reply className="h-2.5 w-2.5 shrink-0" />
              <span className="max-w-[160px] truncate font-medium">
                {message.replyTo.account ? getDisplayName(message.replyTo.account) : "User"}:{" "}
                {message.replyTo.content.replace(/<[^>]*>/g, "").substring(0, 32)}
              </span>
            </div>
          )}

          {isEditing ? (
            <div className="w-full min-w-[280px] rounded-2xl border border-emerald-500/40 bg-card p-2.5 shadow-lg backdrop-blur-xl">
              <textarea
                ref={editInputRef}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                className="w-full resize-none bg-transparent text-xs text-foreground outline-none leading-relaxed"
              />
              <div className="mt-2 flex items-center justify-end gap-1.5 border-t border-border/30 pt-1.5">
                <button
                  onClick={() => setIsEditing(false)}
                  className="cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1 text-[10px] font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            /* Apple-Grade iMessage Bubble */
            <div
              className={cn(
                "relative overflow-hidden break-words px-3.5 py-2 text-[13.5px] leading-[1.42] tracking-[-0.01em] transition-all",
                isOwn
                  ? "rounded-[18px] rounded-br-[4px] bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 selection:bg-white/20 selection:text-white"
                  : "rounded-[18px] rounded-bl-[4px] border border-border/50 bg-card/85 text-foreground shadow-2xs backdrop-blur-md dark:border-white/10 dark:bg-zinc-800/90 dark:text-zinc-100",
                message.replyTo && "rounded-t-none"
              )}
              style={{
                maxWidth: MAX_BUBBLE_WIDTH,
                ...(bubbleWidth ? { width: bubbleWidth } : {}),
              }}
            >
              {message.classification && (
                <div className="mb-1 flex items-center gap-1">
                  <span className="flex items-center gap-1 rounded-md bg-amber-500/20 px-1.5 py-0.2 text-[8px] font-bold uppercase tracking-wider text-amber-200 border border-amber-400/30">
                    <Shield className="h-2.5 w-2.5" />
                    {message.classification}
                  </span>
                </div>
              )}

              <div
                className="[&>p]:mb-0 selection:bg-white/30"
                dangerouslySetInnerHTML={{ __html: sanitizeUserContent(highlightedContent) }}
              />

              {/* Timestamp & Delivery Indicators */}
              <div
                className={cn(
                  "mt-1 flex items-center gap-1.5 text-[9.5px] font-medium select-none tabular-nums",
                  isOwn
                    ? "text-white/70 justify-end"
                    : "text-muted-foreground/65 justify-start"
                )}
              >
                <span>{formatTimestamp(message.createdAt ?? message.ixTimeTimestamp)}</span>
                {message.editedAt && <span>· edited</span>}
                {isOwn && message.readReceipts && (
                  <span className="inline-flex items-center">
                    {message.readReceipts.length > 0 ? (
                      <CheckCheck className="h-3 w-3 text-white/90" />
                    ) : (
                      <Check className="h-3 w-3 text-white/70" />
                    )}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* iOS Tapback Reaction Badges */}
          {message.reactions && Object.keys(message.reactions).length > 0 && (
            <div
              className={cn(
                "absolute -bottom-2.5 z-10 flex flex-wrap gap-1",
                isOwn ? "right-2" : "left-2"
              )}
            >
              {Object.entries(message.reactions).map(([emoji, count]) => (
                <button
                  key={emoji}
                  className="flex items-center gap-1 rounded-full border border-border/60 bg-background/90 px-1.5 py-0.2 text-[10px] font-semibold text-foreground shadow-xs backdrop-blur-md transition-all hover:scale-105 active:scale-95"
                  onClick={() => actions.onRemoveReaction(message.id, emoji)}
                  title="Remove reaction"
                >
                  <span>{emoji}</span>
                  <span className="text-[9px] text-muted-foreground">{count as number}</span>
                </button>
              ))}
            </div>
          )}

          {/* Apple Floating Hover Action Bar */}
          {!isEditing && (
            <div
              className={cn(
                "absolute -top-3.5 z-20 hidden items-center gap-0.5 rounded-full border border-border/50 bg-background/90 px-1 py-0.5 shadow-md backdrop-blur-xl group-hover/bubble:flex transition-all duration-150 animate-in fade-in zoom-in-95",
                isOwn ? "right-1" : "left-1"
              )}
            >
              {/* React Trigger */}
              <div className="relative">
                <button
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors active:scale-90"
                  title="React"
                  onClick={() => {
                    soundEffects.press();
                    setShowReactions(!showReactions);
                  }}
                >
                  <Smile className="h-3.5 w-3.5" />
                </button>

                {/* Floating Tapback Emoji Picker */}
                {showReactions && (
                  <div
                    className={cn(
                      "absolute bottom-full z-30 mb-1.5 flex items-center gap-1 rounded-full border border-border/60 bg-background/95 p-1 shadow-xl backdrop-blur-2xl ring-1 ring-black/5 animate-in fade-in zoom-in-90",
                      isOwn ? "right-0" : "left-0"
                    )}
                  >
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-base transition-transform hover:scale-125 active:scale-90"
                        onClick={() => {
                          soundEffects.success();
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

              {/* Reply */}
              <button
                className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors active:scale-90"
                title="Reply"
                onClick={() => {
                  soundEffects.press();
                  onReply(message);
                }}
              >
                <Reply className="h-3.5 w-3.5" />
              </button>

              {/* Edit & Delete (Own messages only) */}
              {isOwn && (
                <>
                  <button
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors active:scale-90"
                    title="Edit"
                    onClick={() => {
                      soundEffects.press();
                      setIsEditing(true);
                    }}
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>

                  <div className="relative">
                    <button
                      className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors active:scale-90"
                      title="Delete"
                      onClick={() => {
                        soundEffects.press();
                        setShowDeleteConfirm(!showDeleteConfirm);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    {showDeleteConfirm && (
                      <div
                        className={cn(
                          "absolute bottom-full z-30 mb-1.5 flex flex-col gap-1.5 rounded-xl border border-border bg-popover p-2 text-xs shadow-xl backdrop-blur-md",
                          isOwn ? "right-0" : "left-0"
                        )}
                      >
                        <span className="text-[11px] font-semibold text-foreground">Delete message?</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="rounded-md px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              setShowDeleteConfirm(false);
                              actions.onDeleteMessage(message.id);
                            }}
                            className="rounded-md bg-destructive px-2 py-0.5 text-[10px] font-semibold text-destructive-foreground hover:bg-destructive/90"
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
      </div>
    </div>
  );
});
