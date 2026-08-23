"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { GlassPlateEditor, type GlassPlateEditorRef } from "~/components/thinkpages/GlassPlateEditor";
import { Reply, Xmark as X, Bookmark as BookmarkPlus, Send, SystemRestart as Loader2 } from "iconoir-react";
import { MessagesStashAttachmentModal } from "./MessagesStashAttachmentModal";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

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
  const editorRef = useRef<GlassPlateEditorRef>(null);
  const [content, setContent] = useState("");
  const [plainText, setPlainText] = useState("");
  const [isStashModalOpen, setIsStashModalOpen] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle typing indicator timeout
  const handleEditorChange = useCallback(
    (html: string, rawText: string) => {
      setContent(html);
      setPlainText(rawText);

      if (rawText.trim().length > 0) {
        onTyping(true);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
          onTyping(false);
        }, 3000);
      } else {
        onTyping(false);
      }
    },
    [onTyping]
  );

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSend = useCallback(() => {
    if (!plainText.trim() || isSending) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    onTyping(false);

    onSendMessage(content, plainText);
    setContent("");
    setPlainText("");
    editorRef.current?.clear();
  }, [content, plainText, isSending, onSendMessage, onTyping]);

  const handleAttachStashItem = useCallback((item: { title: string; url: string }) => {
    if (editorRef.current) {
      editorRef.current.insertText(` 📚 Stash: ${item.title} (${item.url}) `);
      editorRef.current.focus();
    }
  }, []);

  const canSend = plainText.trim().length > 0 && !isSending;

  return (
    <div className="border-border/50 bg-background/60 shrink-0 border-t p-3">
      {replyingTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5">
          <Reply className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-[11px] font-medium">
              Replying to {replyingTo.account.displayName}
            </p>
            <p className="text-foreground/80 truncate text-xs">
              {replyingTo.content.replace(/<[^>]*>/g, "").substring(0, 80)}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer rounded p-0.5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => setIsStashModalOpen(true)}
          className="hover:bg-accent/15 text-muted-foreground hover:text-foreground mb-1 flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border/50 bg-card/50 shadow-2xs backdrop-blur-xs transition-all active:scale-95"
          title="Attach Lore Stash Link"
        >
          <BookmarkPlus className="h-4.5 w-4.5 text-indigo-400" />
        </button>

        <div className="min-w-0 flex-1">
          <GlassPlateEditor
            ref={editorRef}
            value={content}
            onChange={handleEditorChange}
            onSubmit={handleSend}
            submitOnEnter={true}
            placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
            disabled={isSending}
            minHeight={44}
            maxHeight={140}
            className="border-border/60 bg-card/40"
          />
        </div>

        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            "mb-1 h-[44px] w-[44px] shrink-0 rounded-xl transition-all duration-200 active:scale-95",
            canSend
              ? "bg-blue-600 text-white shadow-md hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400"
              : "border border-border/50 bg-muted/40 text-muted-foreground opacity-50"
          )}
          title="Send message (Enter)"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      <MessagesStashAttachmentModal
        isOpen={isStashModalOpen}
        onClose={() => setIsStashModalOpen(false)}
        onAttachItem={handleAttachStashItem}
      />
    </div>
  );
}
