"use client";

import React, { useRef } from 'react';
import RichTextEditor, { type RichTextEditorRef } from '~/components/thinkpages/RichTextEditor';
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

interface MessageInputProps {
  onSendMessage: (content?: string, plainText?: string) => void;
  onTyping: (isTyping: boolean) => void;
  isSending: boolean;
  replyingToMessage: ThinkshareMessage | null;
  setReplyingToMessage: (message: ThinkshareMessage | null) => void;
}

export function MessageInput({
  onSendMessage,
  onTyping,
  isSending,
  replyingToMessage,
  setReplyingToMessage,
}: MessageInputProps) {
  const richTextEditorRef = useRef<RichTextEditorRef>(null);

  return (
    <div className="p-4 border-t border-border/50 bg-background/50">
      {replyingToMessage && (
        <div className="mb-3">
          <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg border-l-4 border-[#10b981]">
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
      )}
      <RichTextEditor
        ref={richTextEditorRef}
        placeholder="Type a message..."
        onSubmit={onSendMessage}
        onTyping={onTyping}
        disabled={isSending}
        minHeight={60}
        maxHeight={150}
        showToolbar={true}
        submitButtonText="Send"
        className="w-full"
      />
    </div>
  );
}
