"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { GlassPlateEditorRef } from "~/components/thinkpages/GlassPlateEditor";

const GlassPlateEditor = dynamic(
  () => import("~/components/thinkpages/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  {
    loading: () => <Skeleton className="rounded-control h-12" />,
    ssr: false,
  }
);
import {
  Reply,
  Xmark as X,
  Bookmark as BookmarkPlus,
  Send,
  SystemRestart as Loader2,
} from "iconoir-react";
import { MessagesStashAttachmentModal } from "./MessagesStashAttachmentModal";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";

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
    <div className="border-separator bg-surface shrink-0 border-t p-3">
      {replyingTo && (
        <div className="bg-surface-secondary rounded-control mb-2 flex items-center gap-2 px-3 py-2">
          <Reply className="text-label-secondary size-3.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-label-secondary">
              Replying to {replyingTo.account.displayName}
            </p>
            <p className="text-footnote text-label truncate">
              {replyingTo.content.replace(/<[^>]*>/g, "").substring(0, 80)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            className="text-label-secondary hover:text-label"
          >
            <X aria-hidden />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon-lg"
          onClick={() => setIsStashModalOpen(true)}
          className="mb-1 shrink-0"
          title="Attach Lore Stash Link"
          aria-label="Attach Lore Stash Link"
        >
          <BookmarkPlus />
        </Button>

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
            className="border-separator bg-surface"
          />
        </div>

        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          size="icon-lg"
          className="mb-1 shrink-0"
          title="Send message (Enter)"
          aria-label="Send message"
        >
          {isSending ? <Loader2 className="animate-spin" /> : <Send />}
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
