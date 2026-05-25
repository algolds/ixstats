"use client";

import React, { useRef } from "react";
import RichTextEditor, { type RichTextEditorRef } from "~/components/thinkpages/RichTextEditor";
import { Reply, X } from "lucide-react";

interface ReplyMessage {
  id: string;
  account: {
    displayName: string;
  };
  content: string;
}

interface MessagesInputBarProps {
  onSendMessage: (content?: string, plainText?: string) => void;
  onTyping: (isTyping: boolean) => void;
  isSending: boolean;
  replyingTo: ReplyMessage | null;
  onCancelReply: () => void;
}

export function MessagesInputBar({
  onSendMessage,
  onTyping,
  isSending,
  replyingTo,
  onCancelReply,
}: MessagesInputBarProps) {
  const editorRef = useRef<RichTextEditorRef>(null);

  return (
    <div className="border-border/50 bg-background/60 shrink-0 border-t p-3">
      {replyingTo && (
        <div className="border-primary bg-muted/30 mb-2 flex items-center gap-2 rounded-lg border-l-4 px-3 py-1.5">
          <Reply className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-medium">
              Replying to {replyingTo.account.displayName}
            </p>
            <p className="text-foreground/70 truncate text-xs">
              {replyingTo.content.replace(/<[^>]*>/g, "").substring(0, 80)}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="text-muted-foreground hover:bg-muted hover:text-foreground rounded p-0.5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <RichTextEditor
        ref={editorRef}
        placeholder="Type a message..."
        onSubmit={onSendMessage}
        onTyping={onTyping}
        disabled={isSending}
        minHeight={44}
        maxHeight={120}
        showToolbar={true}
        submitButtonText="Send"
        className="w-full"
      />
    </div>
  );
}
