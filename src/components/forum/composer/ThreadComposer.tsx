// src/components/forum/composer/ThreadComposer.tsx
// Full-page new thread composer with title, forum selector, and unified GlassPlateEditor.

"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft, SystemRestart as Loader2 } from "iconoir-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { GlassPlateEditor, type GlassPlateEditorRef } from "~/components/shared/editor";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ThreadComposerProps {
  /** Pre-select a forum if navigated from a specific forum */
  defaultForumId?: number;
}

export function ThreadComposer({ defaultForumId }: ThreadComposerProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [plainText, setPlainText] = useState("");
  const [bbcode, setBbcode] = useState("");
  const [selectedForumId, setSelectedForumId] = useState<number | null>(defaultForumId ?? null);
  const editorRef = useRef<GlassPlateEditorRef>(null);

  const { data: forumsData } = api.forum.getForums.useQuery(undefined, {
    staleTime: 60_000,
  });

  const createThread = api.forum.createThread.useMutation({
    onSuccess: (data) => {
      router.push(withBasePath(`/forum/thread/${data.thread.threadId}`));
    },
  });

  const handleSubmit = useCallback(() => {
    const messageToSend = bbcode.trim() || plainText.trim();
    if (!title.trim() || !messageToSend || !selectedForumId || createThread.isPending) return;
    createThread.mutate({
      forumId: selectedForumId,
      title: title.trim(),
      message: messageToSend,
    });
  }, [title, bbcode, plainText, selectedForumId, createThread]);

  const handleChange = useCallback((html: string, rawText: string, code: string) => {
    setContent(html);
    setPlainText(rawText);
    setBbcode(code);
  }, []);

  const forumNodes = (forumsData?.forums ?? []).filter((f) => f.nodeType === "Forum");
  const canSubmit =
    title.trim().length > 0 &&
    (plainText.trim().length > 0 || bbcode.trim().length > 0) &&
    !!selectedForumId &&
    !createThread.isPending;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={withBasePath("/forum")}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--forum-text-dim)] transition-colors hover:bg-[var(--forum-surface-hover)] hover:text-[var(--forum-text)]"
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
          className="w-full rounded-xl border border-[var(--forum-border)] bg-[var(--forum-surface)] px-3 py-2.5 text-sm text-[var(--forum-text)] transition-colors outline-none focus:border-[var(--forum-accent)]"
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
          className="w-full rounded-xl border border-[var(--forum-border)] bg-[var(--forum-surface)] px-3 py-2.5 text-sm text-[var(--forum-text)] transition-colors outline-none placeholder:text-[var(--forum-text-dim)] focus:border-[var(--forum-accent)]"
          maxLength={200}
        />
      </div>

      {/* Message Editor */}
      <div className="mb-4">
        <label className="mb-1.5 block text-xs font-medium text-[var(--forum-text-muted)]">
          Message
        </label>
        <GlassPlateEditor
          ref={editorRef}
          value={content}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="Compose your thread post..."
          disabled={createThread.isPending}
          minHeight={180}
          maxHeight={450}
          className="border-[var(--forum-border)] bg-[var(--forum-surface)]"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--forum-text-dim)]">
          ⌘+Enter / Ctrl+Enter to submit
        </span>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            "h-9 gap-1.5 rounded-xl px-5 text-xs font-semibold transition-all duration-200 active:scale-95",
            canSubmit
              ? "bg-amber-600 text-white shadow-md hover:bg-amber-500"
              : "border border-white/10 bg-white/5 text-zinc-500 opacity-50"
          )}
        >
          {createThread.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              <span>Create Thread</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
