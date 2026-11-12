"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Bookmark, Reply, Send, Xmark as X } from "iconoir-react";
import type { GlassPlateEditorRef } from "~/components/shared/editor/GlassPlateEditor";
import type { MentionSource } from "~/components/shared/editor/mention-source";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { stripTags } from "~/lib/messages/format";
import { memberMentionItems, mentionIdsFor, type ThreadMessage } from "~/lib/messages/thread";
import { MessagesStashAttachmentModal } from "./MessagesStashAttachmentModal";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  {
    loading: () => <Skeleton className="rounded-control h-10 flex-1" />,
    ssr: false,
  }
);

const TYPING_IDLE_MS = 3000;

interface MessagesInputBarProps {
  onSendMessage: (content: string, plainText: string, mentions: string[]) => void;
  onTyping: (isTyping: boolean) => void;
  replyingTo: Pick<ThreadMessage, "id" | "content" | "account"> | null;
  onCancelReply: () => void;
  /** The other people in the thread: the source of the @ menu and of the ids a mention is sent as. */
  participants: Parameters<typeof memberMentionItems>[0];
}

export function MessagesInputBar({
  onSendMessage,
  onTyping,
  replyingTo,
  onCancelReply,
  participants,
}: MessagesInputBarProps) {
  const editorRef = useRef<GlassPlateEditorRef>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [content, setContent] = useState("");
  const [plainText, setPlainText] = useState("");
  const [isStashModalOpen, setIsStashModalOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  const mentionSource: MentionSource = {
    items: memberMentionItems(participants, mentionQuery),
    isLoading: false,
    onQueryChange: setMentionQuery,
  };

  const handleEditorChange = (html: string, rawText: string) => {
    setContent(html);
    setPlainText(rawText);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (rawText.trim().length > 0) {
      onTyping(true);
      typingTimeoutRef.current = setTimeout(() => onTyping(false), TYPING_IDLE_MS);
    } else {
      onTyping(false);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  const canSend = plainText.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    onTyping(false);

    onSendMessage(content, plainText, mentionIdsFor(plainText, participants));
    setContent("");
    setPlainText("");
    editorRef.current?.clear();
  };

  const handleAttachStashItem = (item: { title: string; url: string }) => {
    editorRef.current?.insertText(` Stash: ${item.title} (${item.url}) `);
    editorRef.current?.focus();
  };

  return (
    <div className="border-separator bg-surface shrink-0 border-t p-3">
      {replyingTo && (
        <div className="bg-surface-secondary rounded-control mb-2 flex items-center gap-2 px-3 py-2">
          <Reply className="text-label-secondary size-3.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-caption text-label-secondary">
              Replying to {replyingTo.account?.displayName ?? "this message"}
            </p>
            <p className="text-footnote text-label truncate">
              {stripTags(replyingTo.content).slice(0, 80)}
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

      <Card variant="well" padding="none" content="input" className="flex items-end gap-1 p-1.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setIsStashModalOpen(true)}
          className="text-label-secondary hover:text-label shrink-0"
          title="Attach a Stash link"
          aria-label="Attach a Stash link"
        >
          <Bookmark aria-hidden />
        </Button>

        <div className="min-w-0 flex-1">
          <GlassPlateEditor
            ref={editorRef}
            variant="seamless"
            hideToolbar
            value={content}
            onChange={handleEditorChange}
            onSubmit={handleSend}
            submitOnEnter
            placeholder="Write a message"
            mentionSource={mentionSource}
            minHeight={40}
            maxHeight={140}
            contentClassName="py-2"
          />
        </div>

        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          size="icon"
          className="shrink-0"
          title="Send message"
          aria-label="Send message"
        >
          <Send aria-hidden />
        </Button>
      </Card>

      <MessagesStashAttachmentModal
        isOpen={isStashModalOpen}
        onClose={() => setIsStashModalOpen(false)}
        onAttachItem={handleAttachStashItem}
      />
    </div>
  );
}
