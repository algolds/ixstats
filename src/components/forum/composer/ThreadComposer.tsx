"use client";
// Full-page new thread composer with title, forum selector, and unified GlassPlateEditor.

import { useState, useCallback, useRef } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft, SystemRestart as Loader2 } from "iconoir-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import type { GlassPlateEditorRef } from "~/components/shared/editor";

const GlassPlateEditor = dynamic(
  () => import("~/components/shared/editor/GlassPlateEditor").then((m) => m.GlassPlateEditor),
  {
    loading: () => <Skeleton className="rounded-control h-48" />,
    ssr: false,
  }
);
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";

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
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={withBasePath("/forum")}
          aria-label="Back to forums"
          className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
        >
          <ArrowLeft />
        </Link>
        <h1 className="text-large-title text-label">New thread</h1>
      </div>

      {createThread.error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive text-body rounded-row mb-4 px-4 py-3"
        >
          {createThread.error.message}
        </div>
      )}

      <div className="mb-4">
        <label
          htmlFor="forum-thread-forum"
          className="text-subhead text-label-secondary mb-2 block"
        >
          Forum
        </label>
        <Select
          value={selectedForumId != null ? String(selectedForumId) : undefined}
          onValueChange={(value) => setSelectedForumId(value ? Number(value) : null)}
        >
          <SelectTrigger id="forum-thread-forum" className="w-full">
            <SelectValue placeholder="Select a forum..." />
          </SelectTrigger>
          <SelectContent>
            {forumNodes.map((forum) => (
              <SelectItem key={forum.nodeId} value={String(forum.nodeId)}>
                {forum.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4">
        <label
          htmlFor="forum-thread-title"
          className="text-subhead text-label-secondary mb-2 block"
        >
          Thread title
        </label>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          id="forum-thread-title"
          placeholder="Enter thread title..."
          className="text-body w-full"
          maxLength={200}
        />
      </div>

      <div className="mb-4">
        <span className="text-subhead text-label-secondary mb-2 block">Message</span>
        <GlassPlateEditor
          ref={editorRef}
          value={content}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder="Compose your thread post..."
          disabled={createThread.isPending}
          minHeight={180}
          maxHeight={450}
          className="border-separator bg-surface"
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-footnote text-label-secondary">⌘+Enter / Ctrl+Enter to submit</span>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {createThread.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating...</span>
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              <span>Create thread</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
