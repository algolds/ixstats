"use client";

import React, { useState, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Heart, Reply, Edit, Trash2, Check, CheckCheck } from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

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

interface MessagesBubbleProps {
  message: Message;
  currentUserId: string;
  /** Whether this message is from the same sender as the previous one (consecutive) */
  isConsecutive: boolean;
  refetchMessages: () => void;
  onReply: (message: Message) => void;
}

const QUICK_REACTIONS = ["❤️", "👍", "👎", "😂", "😮", "😢", "😡"];

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
  refetchMessages,
  onReply,
}: MessagesBubbleProps) {
  const notify = useNotify();
  const [showReactions, setShowReactions] = useState(false);

  const stableRefetch = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);

  const addReaction = api.messages.addReaction.useMutation({
    onSuccess: stableRefetch,
    onError: (err: any) => notify.error(err.message || "Failed to react"),
  });

  const removeReaction = api.messages.removeReaction.useMutation({
    onSuccess: stableRefetch,
    onError: (err: any) => notify.error(err.message || "Failed to remove reaction"),
  });

  const editMessage = api.messages.editMessage.useMutation({
    onSuccess: () => {
      stableRefetch();
      notify.success("Message edited");
    },
    onError: (err: any) => notify.error(err.message || "Failed to edit"),
  });

  const deleteMessage = api.messages.deleteMessage.useMutation({
    onSuccess: () => {
      stableRefetch();
      notify.success("Message deleted");
    },
    onError: (err: any) => notify.error(err.message || "Failed to delete"),
  });

  const isOwn = message.accountId === currentUserId;
  const account = message.account;

  if (!account) return null;

  const initials = (account.displayName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2);

  return (
    <div
      className={cn(
        "group relative flex gap-3 px-4 py-0.5 hover:bg-muted/30",
        !isConsecutive && "mt-3 pt-1"
      )}
    >
      {/* Avatar column — only show for first in sequence */}
      <div className="w-10 shrink-0">
        {!isConsecutive && (
          <Avatar className="h-10 w-10">
            <AvatarImage src={account.profileImageUrl ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
        )}
        {isConsecutive && (
          <span className="hidden text-[10px] text-muted-foreground group-hover:block">
            {formatTimestamp(message.createdAt ?? message.ixTimeTimestamp)}
          </span>
        )}
      </div>

      {/* Message content */}
      <div className="min-w-0 flex-1">
        {/* Name + timestamp header (first in sequence only) */}
        {!isConsecutive && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-foreground">
              {account.displayName}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {formatTimestamp(message.createdAt ?? message.ixTimeTimestamp)}
            </span>
            {message.editedAt && (
              <span className="text-[10px] text-muted-foreground">(edited)</span>
            )}
          </div>
        )}

        {/* Reply preview */}
        {message.replyTo && (
          <div className="mb-1 flex items-center gap-1.5 rounded border-l-2 border-primary/40 bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
            <Reply className="h-3 w-3 shrink-0" />
            <span className="font-medium">{message.replyTo.account?.displayName}</span>
            <span className="truncate">
              {message.replyTo.content.replace(/<[^>]*>/g, "").substring(0, 60)}
            </span>
          </div>
        )}

        {/* Message text */}
        <div
          className="text-sm leading-relaxed text-foreground/90 [&>p]:mb-0"
          dangerouslySetInnerHTML={{ __html: message.content }}
        />

        {/* Reactions */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(message.reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/50 px-1.5 py-0.5 text-xs transition-colors hover:bg-muted"
                onClick={() =>
                  removeReaction.mutate({
                    messageId: message.id,
                    reaction: emoji,
                  })
                }
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground">{count as number}</span>
              </button>
            ))}
          </div>
        )}

        {/* Read receipts for own messages */}
        {isOwn && message.readReceipts && (
          <div className="mt-0.5 flex items-center gap-1">
            {message.readReceipts.length > 0 ? (
              <CheckCheck className="h-3 w-3 text-blue-500" />
            ) : (
              <Check className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Hover action buttons */}
      <div className="absolute -top-3 right-4 hidden rounded-md border border-border bg-background shadow-sm group-hover:flex">
        <div className="relative">
          <button
            className="rounded-l-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="React"
            onClick={() => setShowReactions(!showReactions)}
          >
            <Heart className="h-3.5 w-3.5" />
          </button>
          {showReactions && (
            <div className="absolute bottom-full right-0 z-10 mb-1 flex gap-0.5 rounded-lg border border-border bg-background p-1.5 shadow-lg">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  className="rounded p-1 text-base transition-colors hover:bg-muted"
                  onClick={() => {
                    addReaction.mutate({
                      messageId: message.id,
                      userId: currentUserId,
                      reaction: emoji,
                    });
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
          className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Reply"
          onClick={() => onReply(message)}
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
        {isOwn && (
          <>
            <button
              className="p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Edit"
              onClick={() => {
                const newContent = prompt("Edit message:", message.content.replace(/<[^>]*>/g, ""));
                if (newContent) {
                  editMessage.mutate({ messageId: message.id, content: newContent });
                }
              }}
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
            <button
              className="rounded-r-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
              title="Delete"
              onClick={() => {
                if (confirm("Delete this message?")) {
                  deleteMessage.mutate({ messageId: message.id });
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
