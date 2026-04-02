"use client";

import React, { useRef } from "react";
import RichTextEditor, {
  type RichTextEditorRef,
} from "~/components/thinkpages/RichTextEditor";
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
    <div className="shrink-0 border-t border-border/50 bg-background/60 p-3">
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-4 border-primary bg-muted/30 px-3 py-1.5">
          <Reply className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              Replying to {replyingTo.account.displayName}
            </p>
            <p className="truncate text-xs text-foreground/70">
              {replyingTo.content.replace(/<[^>]*>/g, "").substring(0, 80)}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
