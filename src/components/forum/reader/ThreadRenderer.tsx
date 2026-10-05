"use client";
// Full thread view with posts, pagination, and reply composer.
// Client-side pagination for hybrid routing pattern.

import { useState, useCallback, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { PostCard } from "~/components/forum/reader/PostCard";
import { ThreadHeader } from "~/components/forum/reader/ThreadHeader";
import { ForumBreadcrumbs } from "~/components/forum/reader/Breadcrumbs";
import { ForumPagination } from "~/components/forum/reader/Pagination";
import { ReplyComposer, type ReplyComposerHandle } from "~/components/forum/composer/ReplyComposer";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { useForumAuthorCosmetics } from "~/hooks/usePublicCosmetics";

interface ThreadRendererProps {
  threadId: number;
  initialPage?: number;
}

export function ThreadRenderer({ threadId, initialPage = 1 }: ThreadRendererProps) {
  const [page, setPage] = useState(initialPage);
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const composerHandle = useRef<ReplyComposerHandle>(null);
  const { setForumPage } = useForumContext();

  const { data, isLoading, error } = api.forum.getThread.useQuery(
    { threadId, page },
    { staleTime: 30_000 }
  );

  // Get the user's linked forum account ID for "own post" detection
  const { data: linkStatus } = api.forum.getLinkStatus.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });
  const currentForumUserId = linkStatus?.forumUserId ?? null;

  // Every author's equipped cosmetics on this page, in one request (VT-12)
  const cosmeticsFor = useForumAuthorCosmetics(data?.posts.map((post) => post.authorId) ?? []);

  // Update forum context when thread loads
  useEffect(() => {
    if (data?.thread) {
      setForumPage(
        {
          id: data.thread.threadId,
          title: data.thread.title,
          forumName: data.thread.forumName ?? "Forum",
        },
        data.thread.nodeId
          ? { id: data.thread.nodeId, title: data.thread.forumName ?? "Forum" }
          : null
      );
    }
  }, [data?.thread, setForumPage]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleQuote = useCallback((authorName: string, content: string) => {
    const quoted = `[quote=${authorName}]${content.slice(0, 500)}${content.length > 500 ? "..." : ""}[/quote]\n`;
    setQuoteText(quoted);
    // Scroll to composer
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, []);

  // Reply is a request to write: bring the composer into view, then put the caret in it (the
  // editor focuses without scrolling, so the smooth scroll is not cut short).
  const handleReply = useCallback(() => {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    composerHandle.current?.focus();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-3/4" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="rounded-card h-40 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data?.thread) {
    return (
      <EmptyState
        title="Thread not found"
        message="This thread may have been deleted or you don't have permission to view it."
      />
    );
  }

  const { thread, posts, pagination } = data;

  return (
    <div>
      <ForumBreadcrumbs
        items={[
          ...(thread.forumName
            ? [{ label: thread.forumName, href: `/forum/${thread.nodeId}` }]
            : []),
          { label: thread.title },
        ]}
      />

      <ThreadHeader thread={thread} onReply={handleReply} />

      {pagination && pagination.last_page > 1 && (
        <ForumPagination
          currentPage={pagination.current_page}
          lastPage={pagination.last_page}
          onPageChange={handlePageChange}
        />
      )}

      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard
            key={post.postId}
            {...post}
            threadTitle={thread.title}
            currentForumUserId={currentForumUserId}
            authorBadge={cosmeticsFor(post.authorId)?.chatBadge}
            onQuote={handleQuote}
            onReply={handleReply}
          />
        ))}
      </div>

      {pagination && pagination.last_page > 1 && (
        <ForumPagination
          currentPage={pagination.current_page}
          lastPage={pagination.last_page}
          onPageChange={handlePageChange}
        />
      )}

      {thread.isOpen && (
        <div ref={composerRef} className="mt-4">
          <ReplyComposer
            ref={composerHandle}
            threadId={threadId}
            initialText={quoteText}
            onClearQuote={() => setQuoteText(null)}
          />
        </div>
      )}
    </div>
  );
}
