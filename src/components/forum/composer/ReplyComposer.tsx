"use client";
// src/components/forum/composer/ReplyComposer.tsx
// Inline reply composer at the bottom of a thread view using unified GlassPlateEditor.

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, SystemRestart as Loader2 } from "iconoir-react";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";
import type { GlassPlateEditorRef } from "~/components/shared/editor";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  {
    loading: () => <div className="h-20 animate-pulse rounded-lg bg-white/5" />,
    ssr: false,
  }
);
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";

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
    <div className="forum-composer rounded-2xl border border-white/10 bg-black/20 p-2 backdrop-blur-xl transition-all">
      {createPost.error && (
        <div className="mb-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
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

        <div className="flex items-center justify-between border-t border-white/5 pt-2">
          <span className="text-[11px] text-[var(--forum-text-dim)]">
            Press{" "}
            <kbd className="rounded bg-white/10 px-1 py-0.5 text-[10px] text-zinc-300">Enter</kbd>{" "}
            to reply
          </span>

          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "h-8 gap-1.5 rounded-xl px-4 text-xs font-semibold transition-all duration-200 active:scale-95",
              canSubmit
                ? "bg-amber-600 text-white shadow-md hover:bg-amber-500"
                : "border border-white/10 bg-white/5 text-zinc-500 opacity-50"
            )}
          >
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
