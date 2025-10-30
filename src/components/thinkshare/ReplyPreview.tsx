"use client";

import React from "react";
import { Reply, X } from "lucide-react";

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

interface ReplyPreviewProps {
  replyingToMessage: ThinkshareMessage | null;
  setReplyingToMessage: (message: ThinkshareMessage | null) => void;
}

export function ReplyPreview({ replyingToMessage, setReplyingToMessage }: ReplyPreviewProps) {
  if (!replyingToMessage) return null;

  return (
    <div className="px-4 pt-3 pb-0">
      <div className="bg-muted/30 border-primary flex items-center gap-2 rounded-lg border-l-4 p-2">
        <Reply className="text-muted-foreground h-4 w-4" />
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-xs">
            Replying to {replyingToMessage.account.displayName}
          </p>
          <p className="truncate text-sm">
            {replyingToMessage.content.replace(/<[^>]*>/g, "").substring(0, 50)}...
          </p>
        </div>
        <button
          onClick={() => setReplyingToMessage(null)}
          className="hover:bg-accent rounded p-1 transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
