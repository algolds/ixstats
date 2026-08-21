import React, { useRef, useState } from "react";
import RichTextEditor, { type RichTextEditorRef } from "~/components/thinkpages/RichTextEditor";
import { Reply, X, BookmarkPlus } from "lucide-react";
import { MessagesStashAttachmentModal } from "./MessagesStashAttachmentModal";

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
  const [isStashModalOpen, setIsStashModalOpen] = useState(false);

  const handleAttachStashItem = (item: { title: string; url: string }) => {
    if (editorRef.current) {
      const current = editorRef.current.getContent();
      // Embed an inline link with icons/badge styling
      const linkHtml = `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-semibold underline">📚 Stash: ${item.title}</a>`;
      editorRef.current.setContent(current + (current.trim() ? " " : "") + linkHtml);
      editorRef.current.focus();
    }
  };

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

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setIsStashModalOpen(true)}
          className="hover:bg-accent/15 text-muted-foreground hover:text-foreground mb-1 flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border/50 bg-card/50 shadow-2xs backdrop-blur-xs transition-all active:scale-95"
          title="Attach Lore Stash Link"
        >
          <BookmarkPlus className="h-4.5 w-4.5 text-indigo-400" />
        </button>

        <div className="min-w-0 flex-1">
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
      </div>

      <MessagesStashAttachmentModal
        isOpen={isStashModalOpen}
        onClose={() => setIsStashModalOpen(false)}
        onAttachItem={handleAttachStashItem}
      />
    </div>
  );
}
