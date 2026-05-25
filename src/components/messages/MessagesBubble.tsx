"use client";

import React, { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Heart, Reply, Edit, Trash2, Check, CheckCheck } from "lucide-react";
import { cn } from "~/lib/utils";

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
  onReply,
  actions,
}: MessagesBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);

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
        "group relative flex gap-2 px-4 py-0.5 transition-colors",
        isOwn ? "flex-row-reverse" : "flex-row",
        !isConsecutive && "mt-3 pt-1"
      )}
    >
      {/* Avatar column */}
      <div className={cn("w-8 shrink-0", isOwn && "hidden")}>
        {!isConsecutive && (
          <Avatar className="h-8 w-8">
            <AvatarImage src={account.profileImageUrl ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] font-semibold text-white">
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
              {account.displayName}
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
                {message.replyTo.account?.displayName}:{" "}
                {message.replyTo.content.replace(/<[^>]*>/g, "").substring(0, 30)}
              </span>
            </div>
          )}

          <div
            className={cn(
              "rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
              isOwn
                ? "rounded-tr-none bg-gradient-to-br from-blue-500 to-blue-600 text-white"
                : "bg-muted/80 text-foreground rounded-tl-none",
              message.replyTo && "rounded-t-none"
            )}
          >
            <div className="[&>p]:mb-0" dangerouslySetInnerHTML={{ __html: message.content }} />

            <div
              className={cn(
                "mt-1 flex items-center gap-1.5 text-[9px]",
                isOwn ? "justify-end text-blue-100/70" : "text-muted-foreground/70 justify-start"
              )}
            >
              <span>{formatTimestamp(message.createdAt ?? message.ixTimeTimestamp)}</span>
              {message.editedAt && <span>(edited)</span>}
              {isOwn && message.readReceipts && (
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
