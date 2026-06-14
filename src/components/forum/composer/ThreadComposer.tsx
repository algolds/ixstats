// src/components/forum/composer/ThreadComposer.tsx
// Full-page new thread composer with title, forum selector, and rich text editor.

"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bold, Italic, Link2, ImageIcon, Quote, Code, Send, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
// eslint-disable-next-line unused-imports/no-unused-imports
import { cn } from "~/lib/utils";

interface ThreadComposerProps {
  /** Pre-select a forum if navigated from a specific forum */
  defaultForumId?: number;
}

export function ThreadComposer({ defaultForumId }: ThreadComposerProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [selectedForumId, setSelectedForumId] = useState<number | null>(defaultForumId ?? null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: forumsData } = api.forum.getForums.useQuery(undefined, {
    staleTime: 60_000,
  });

  const createThread = api.forum.createThread.useMutation({
    onSuccess: (data) => {
      router.push(withBasePath(`/forum/thread/${data.thread.threadId}`));
    },
  });

  const handleSubmit = useCallback(() => {
    if (!title.trim() || !message.trim() || !selectedForumId || createThread.isPending) return;
    createThread.mutate({
      forumId: selectedForumId,
      title: title.trim(),
      message: message.trim(),
    });
  }, [title, message, selectedForumId, createThread]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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

      setMessage(before + `[${tag}]${content}[/${tag}]` + after);

      setTimeout(() => {
        const newPos = start + tag.length + 2 + content.length;
        textarea.setSelectionRange(newPos, newPos);
        textarea.focus();
      }, 0);
    },
    [message]
  );

  // Filter to only forum nodes (not categories)
  const forumNodes = (forumsData?.forums ?? []).filter((f) => f.nodeType === "Forum");

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={withBasePath("/forum")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--forum-text-dim)] hover:bg-[var(--forum-surface-hover)] hover:text-[var(--forum-text)]"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-lg font-semibold text-[var(--forum-text)]">New Thread</h1>
      </div>

      {createThread.error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {createThread.error.message}
        </div>
      )}

      {/* Forum selector */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-[var(--forum-text-muted)]">
          Forum
        </label>
        <select
          value={selectedForumId ?? ""}
          onChange={(e) => setSelectedForumId(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-lg border border-[var(--forum-border)] bg-[var(--forum-surface)] px-3 py-2 text-sm text-[var(--forum-text)] outline-none focus:border-[var(--forum-accent)]"
        >
          <option value="">Select a forum...</option>
          {forumNodes.map((forum) => (
            <option key={forum.nodeId} value={forum.nodeId}>
              {forum.title}
            </option>
          ))}
        </select>
      </div>

      {/* Title */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-[var(--forum-text-muted)]">
          Thread Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter thread title..."
          className="w-full rounded-lg border border-[var(--forum-border)] bg-[var(--forum-surface)] px-3 py-2 text-sm text-[var(--forum-text)] outline-none placeholder:text-[var(--forum-text-dim)] focus:border-[var(--forum-accent)]"
          maxLength={200}
        />
      </div>

      {/* Message */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-[var(--forum-text-muted)]">
          Message
        </label>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your post..."
          className="forum-composer-input min-h-[200px]"
          rows={10}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-1">
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
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--forum-text-dim)]">⌘+Enter to submit</span>
        <button
          onClick={handleSubmit}
          disabled={!title.trim() || !message.trim() || !selectedForumId || createThread.isPending}
          className="forum-composer-submit"
        >
          <Send className="h-3.5 w-3.5" />
          {createThread.isPending ? "Creating..." : "Create Thread"}
        </button>
      </div>
    </div>
  );
}
