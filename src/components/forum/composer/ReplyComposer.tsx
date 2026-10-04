"use client";
// Inline reply composer at the bottom of a thread view using unified GlassPlateEditor.

import { useState, useRef, useEffect, useCallback } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { Send, SystemRestart as Loader2 } from "iconoir-react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import type { GlassPlateEditorRef } from "~/components/shared/editor";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  {
    loading: () => <Skeleton className="rounded-control h-20" />,
    ssr: false,
  }
);
import { Button } from "~/components/ui/button";

interface ReplyComposerProps {
  threadId: number;
  initialText?: string | null;
  onClearQuote?: () => void;
  onPostCreated?: () => void;
}

export function ReplyComposer({
  threadId,
  initialText,
  onClearQuote,
  onPostCreated,
}: ReplyComposerProps) {
  const [content, setContent] = useState("");
  const [plainText, setPlainText] = useState("");
  const [bbcode, setBbcode] = useState("");
  const editorRef = useRef<GlassPlateEditorRef>(null);

  // Apply initial text (from quoting)
  useEffect(() => {
    if (initialText) {
      editorRef.current?.insertText(`\n${initialText}\n`);
      editorRef.current?.focus();
      onClearQuote?.();
    }
  }, [initialText, onClearQuote]);

  const utils = api.useUtils();

  const createPost = api.forum.createPost.useMutation({
    onSuccess: () => {
      setContent("");
      setPlainText("");
      setBbcode("");
      editorRef.current?.clear();
      onPostCreated?.();
      utils.forum.getThread.invalidate({ threadId });
    },
  });

  const handleSubmit = useCallback(() => {
    const messageToSend = bbcode.trim() || plainText.trim();
    if (!messageToSend || createPost.isPending) return;
    createPost.mutate({ threadId, message: messageToSend });
  }, [bbcode, plainText, threadId, createPost]);

  const handleChange = useCallback((html: string, rawText: string, code: string) => {
    setContent(html);
    setPlainText(rawText);
    setBbcode(code);
  }, []);

  const canSubmit =
    (plainText.trim().length > 0 || bbcode.trim().length > 0) && !createPost.isPending;

  return (
    <div className="forum-composer facet-chrome rounded-card p-2">
      {createPost.error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive text-footnote rounded-control mb-2 px-3 py-2"
        >
          {createPost.error.message}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <GlassPlateEditor
          ref={editorRef}
          value={content}
          onChange={handleChange}
          onSubmit={handleSubmit}
          submitOnEnter={true}
          placeholder="Write a reply... (Enter to send, Shift+Enter for newline)"
          disabled={createPost.isPending}
          minHeight={64}
          maxHeight={220}
          className="border-transparent bg-transparent shadow-none"
        />

        <div className="border-separator flex items-center justify-between border-t pt-2">
          <span className="text-footnote text-label-secondary">
            Press{" "}
            <kbd className="bg-fill-3 text-label-secondary text-footnote rounded-control-sm px-1 py-0.5">
              Enter
            </kbd>{" "}
            to reply
          </span>

          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {createPost.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Sending...</span>
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                <span>Reply</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
