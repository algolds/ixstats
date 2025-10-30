"use client";

import React, { useRef } from "react";
import RichTextEditor, { type RichTextEditorRef } from "~/components/thinkpages/RichTextEditor";
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
    <div className="border-border/50 bg-background/50 border-t p-4">
      {replyingToMessage && (
        <div className="mb-3">
          <div className="bg-muted/30 flex items-center gap-2 rounded-lg border-l-4 border-[#10b981] p-2">
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
