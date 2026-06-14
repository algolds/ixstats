// src/components/forum/composer/ReplyComposer.tsx
// Inline reply composer at the bottom of a thread view.
// Starts minimal, expands on focus. Supports BBCode formatting toolbar.

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { Bold, Italic, Link2, ImageIcon, Quote, Code, Send, X } from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";

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
  const [message, setMessage] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Apply initial text (from quoting)
  useEffect(() => {
    if (initialText) {
      setMessage((prev) => prev + initialText);
      setIsExpanded(true);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            textareaRef.current.value.length,
            textareaRef.current.value.length
          );
        }
      }, 100);
      onClearQuote?.();
    }
  }, [initialText, onClearQuote]);

  const utils = api.useUtils();

  const createPost = api.forum.createPost.useMutation({
    onSuccess: () => {
      setMessage("");
      setIsExpanded(false);
      onPostCreated?.();
      // Invalidate thread cache to refetch posts without page reload
      utils.forum.getThread.invalidate({ threadId });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!message.trim() || createPost.isPending) return;
    createPost.mutate({ threadId, message: message.trim() });
  }, [message, threadId, createPost]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Cmd+Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const insertBBCode = useCallback(
    (tag: string, placeholder?: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = message.slice(start, end);
      const content = selected || placeholder || "";

      const before = message.slice(0, start);
      const after = message.slice(end);
      const insert = `[${tag}]${content}[/${tag}]`;

      setMessage(before + insert + after);

      // Set cursor position after tag
      setTimeout(() => {
        const newPos = start + tag.length + 2 + content.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    },
    [message]
  );

  return (
    <div className={cn("forum-composer", isExpanded && "forum-composer-expanded")}>
      {createPost.error && (
        <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {createPost.error.message}
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onFocus={() => setIsExpanded(true)}
        onKeyDown={handleKeyDown}
        placeholder="Write a reply..."
        className="forum-composer-input"
        rows={isExpanded ? 5 : 1}
      />

      {isExpanded && (
        <div className="forum-composer-toolbar">
          <button onClick={() => insertBBCode("b")} className="forum-action-btn" title="Bold">
            <Bold className="h-4 w-4" />
          </button>
          <button onClick={() => insertBBCode("i")} className="forum-action-btn" title="Italic">
            <Italic className="h-4 w-4" />
          </button>
          <button
            onClick={() => insertBBCode("url", "https://")}
            className="forum-action-btn"
            title="Link"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => insertBBCode("img", "https://")}
            className="forum-action-btn"
            title="Image"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button onClick={() => insertBBCode("quote")} className="forum-action-btn" title="Quote">
            <Quote className="h-4 w-4" />
          </button>
          <button onClick={() => insertBBCode("code")} className="forum-action-btn" title="Code">
            <Code className="h-4 w-4" />
          </button>

          <button
            onClick={handleSubmit}
            disabled={!message.trim() || createPost.isPending}
            className="forum-composer-submit"
          >
            <Send className="h-3.5 w-3.5" />
            {createPost.isPending ? "Sending..." : "Reply"}
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="mt-1 text-right text-[10px] text-[var(--forum-text-dim)]">
          ⌘+Enter to submit
        </div>
      )}
    </div>
  );
}
