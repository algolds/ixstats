"use client";

import React from 'react';
import { Reply, X } from 'lucide-react';

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

export function ReplyPreview({
  replyingToMessage,
  setReplyingToMessage,
}: ReplyPreviewProps) {
  if (!replyingToMessage) return null;

  return (
    <div className="px-4 pt-3 pb-0">
      <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border-l-4 border-primary">
        <Reply className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            Replying to {replyingToMessage.account.displayName}
          </p>
          <p className="text-sm truncate">
            {replyingToMessage.content.replace(/<[^>]*>/g, '').substring(0, 50)}...
          </p>
        </div>
        <button
          onClick={() => setReplyingToMessage(null)}
          className="p-1 hover:bg-accent rounded transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
