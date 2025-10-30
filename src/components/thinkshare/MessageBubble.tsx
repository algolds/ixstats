"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Heart, Reply, Edit, Trash2, Check, CheckCheck, Crown, Hash, Globe } from "lucide-react";
import { MessageTimestamp } from "./MessageTimestamp";
import { api } from "~/trpc/react";
import { toast } from "sonner";

interface ThinkshareMessage {
  id: string;
  conversationId: string;
  accountId: string;
  account: {
    id: string;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
    accountType: string;
  };
  content: string;
  messageType: string;
  ixTimeTimestamp: Date;
  createdAt?: Date;
  reactions?: any;
  mentions?: any;
  attachments?: any;
  replyTo?: any;
  readReceipts?: any[];
  isSystem?: boolean;
}

interface Account {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  accountType: string;
}

interface MessageBubbleProps {
  message: ThinkshareMessage;
  currentAccount: Account;
  refetchMessages: () => void;
  onReply: (message: ThinkshareMessage) => void;
  getAccountTypeIcon: (type: string) => React.ReactNode;
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  currentAccount,
  refetchMessages,
  onReply,
  getAccountTypeIcon,
}: MessageBubbleProps) {
  const [showQuickReactions, setShowQuickReactions] = useState<string | null>(null);

  // Stabilize the refetch function to prevent infinite loops
  const stableRefetch = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);

  const addReactionMutation = api.thinkpages.addReactionToMessage.useMutation({
    onSuccess: stableRefetch,
    onError: (error: any) => {
      toast.error(error.message || "Failed to add reaction");
    },
  });

  const removeReactionMutation = api.thinkpages.removeReactionFromMessage.useMutation({
    onSuccess: stableRefetch,
    onError: (error: any) => {
      toast.error(error.message || "Failed to remove reaction");
    },
  });

  const editMessageMutation = api.thinkpages.editMessage.useMutation({
    onSuccess: () => {
      stableRefetch();
      toast.success("Message edited");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to edit message");
    },
  });

  const deleteMessageMutation = api.thinkpages.deleteMessage.useMutation({
    onSuccess: () => {
      stableRefetch();
      toast.success("Message deleted");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete message");
    },
  });

  const isMyMessage = message.accountId === currentAccount?.id;

  // Safety check for account
  if (!message.account) {
    console.error("Message missing account data:", message);
    return null;
  }

  return (
    <div className={`group flex ${isMyMessage ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[70%] ${isMyMessage ? "order-2" : "order-1"}`}>
        {!isMyMessage && (
          <div className="mb-1 flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={message.account?.profileImageUrl || undefined} />
              <AvatarFallback className="text-xs">
                {message.account?.displayName
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .join("") || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground text-xs font-medium">
              {message.account?.displayName || "Unknown"}
            </span>
            {getAccountTypeIcon(message.account?.accountType || "user")}
          </div>
        )}

        <div
          className={`p-3 ${
            isMyMessage
              ? "ml-4 rounded-[18px] rounded-br-[4px] bg-[#10b981] text-white"
              : "bg-muted/80 dark:bg-muted/60 mr-4 rounded-[18px] rounded-bl-[4px]"
          }`}
        >
          <p className={`text-sm whitespace-pre-wrap ${isMyMessage ? "text-white" : ""}`}>
            {message.content.replace(/<[^>]*>/g, "")}
          </p>
        </div>

        {/* Message Actions - Reply, React, etc. */}
        <div
          className={`mt-1 flex items-center gap-1 px-3 ${
            isMyMessage ? "justify-end" : "justify-start"
          }`}
        >
          {/* Action buttons - visible on hover */}
          <div className="mr-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="relative">
              <button
                className="hover:bg-accent rounded-full p-1 transition-colors"
                title="React"
                onClick={() => {
                  setShowQuickReactions(showQuickReactions === message.id ? null : message.id);
                }}
              >
                <Heart className="h-3 w-3" />
              </button>

              {/* Quick Reactions Popup */}
              {showQuickReactions === message.id && (
                <div className="bg-background absolute bottom-full left-0 z-10 mb-2 flex gap-1 rounded-lg border p-2 shadow-lg">
                  {["❤️", "👍", "👎", "😂", "😮", "😢", "😡"].map((emoji) => (
                    <button
                      key={emoji}
                      className="hover:bg-accent rounded p-1 text-lg transition-colors"
                      onClick={() => {
                        if (!currentAccount) return;
                        addReactionMutation.mutate({
                          messageId: message.id,
                          userId: currentAccount.id,
                          reaction: emoji,
                        });
                        setShowQuickReactions(null);
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              className="hover:bg-accent rounded-full p-1 transition-colors"
              title="Reply"
              onClick={() => onReply(message)}
            >
              <Reply className="h-3 w-3" />
            </button>
            {isMyMessage && (
              <>
                <button
                  className="hover:bg-accent rounded-full p-1 transition-colors"
                  title="Edit"
                  onClick={() => {
                    const newContent = prompt("Edit your message:", message.content);
                    if (newContent) {
                      editMessageMutation.mutate({ messageId: message.id, content: newContent });
                    }
                  }}
                >
                  <Edit className="h-3 w-3" />
                </button>
                <button
                  className="hover:bg-destructive hover:text-destructive-foreground rounded-full p-1 transition-colors"
                  title="Delete"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this message?")) {
                      deleteMessageMutation.mutate({ messageId: message.id });
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Reactions Display */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1 px-3">
            {Object.entries(message.reactions).map(([emoji, count]) => (
              <button
                key={emoji}
                className="bg-accent/50 hover:bg-accent flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors"
                onClick={() => {
                  if (!currentAccount) return;
                  removeReactionMutation.mutate({ messageId: message.id, reaction: emoji });
                }}
              >
                <span>{emoji}</span>
                <span className="text-muted-foreground">{count as number}</span>
              </button>
            ))}
          </div>
        )}

        <div
          className={`mt-1 flex items-center gap-1 px-3 ${
            isMyMessage ? "justify-end" : "justify-start"
          }`}
        >
          <MessageTimestamp timestamp={message.createdAt || message.ixTimeTimestamp} />
          {isMyMessage && (
            <div className="flex items-center gap-1">
              {/* Enhanced read receipts */}
              {message.readReceipts && message.readReceipts.length > 0 ? (
                <div
                  className="flex items-center gap-1"
                  title={`Read by ${message.readReceipts.length} people`}
                >
                  <CheckCheck className="h-3 w-3 text-blue-500" />
                  {message.readReceipts.length > 1 && (
                    <span className="text-xs font-medium text-blue-500">
                      {message.readReceipts.length}
                    </span>
                  )}
                </div>
              ) : (
                <Check className="text-muted-foreground h-3 w-3" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export { MessageBubble };
