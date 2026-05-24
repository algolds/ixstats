// src/components/forum/reader/ThreadRenderer.tsx
// Full thread view with posts, pagination, and reply composer.
// Client-side pagination for hybrid routing pattern.

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Lock, Eye, MessageSquare } from "lucide-react";
import { api } from "~/trpc/react";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { PostCard } from "~/components/forum/reader/PostCard";
import { ForumBreadcrumbs } from "~/components/forum/reader/Breadcrumbs";
import { ForumPagination } from "~/components/forum/reader/Pagination";
import { ReplyComposer } from "~/components/forum/composer/ReplyComposer";

interface ThreadRendererProps {
  threadId: number;
  initialPage?: number;
}

export function ThreadRenderer({ threadId, initialPage = 1 }: ThreadRendererProps) {
  const [page, setPage] = useState(initialPage);
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
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

  const handleReply = useCallback(() => {
    composerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="forum-skeleton h-6 w-48" />
        <div className="forum-skeleton h-10 w-3/4" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="forum-skeleton h-40 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data?.thread) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-medium text-[var(--forum-text)]">Thread not found</h2>
        <p className="mt-1 text-sm text-[var(--forum-text-dim)]">
          This thread may have been deleted or you don&apos;t have permission to view it.
        </p>
      </div>
    );
  }

  const { thread, posts, pagination } = data;

  return (
    <div>
      {/* Breadcrumbs */}
      <ForumBreadcrumbs
        items={[
          ...(thread.forumName
            ? [{ label: thread.forumName, href: `/forum/${thread.nodeId}` }]
            : []),
          { label: thread.title },
        ]}
      />

      {/* Thread header */}
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-[var(--forum-text)] sm:text-2xl">
          {thread.title}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--forum-text-dim)]">
          <span>by {thread.authorName}</span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {thread.replyCount.toLocaleString()} replies
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {thread.viewCount.toLocaleString()} views
          </span>
          {!thread.isOpen && (
            <span className="forum-badge forum-badge-locked flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Closed
            </span>
          )}
        </div>
      </div>

      {/* Top pagination */}
      {pagination && pagination.last_page > 1 && (
        <ForumPagination
          currentPage={pagination.current_page}
          lastPage={pagination.last_page}
          onPageChange={handlePageChange}
        />
      )}

      {/* Posts */}
      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard
            key={post.postId}
            {...post}
            threadTitle={thread.title}
            currentForumUserId={currentForumUserId}
            onQuote={handleQuote}
            onReply={handleReply}
          />
        ))}
      </div>

      {/* Bottom pagination */}
      {pagination && pagination.last_page > 1 && (
        <ForumPagination
          currentPage={pagination.current_page}
          lastPage={pagination.last_page}
          onPageChange={handlePageChange}
        />
      )}

      {/* Reply composer */}
      {thread.isOpen && (
        <div ref={composerRef} className="mt-4">
          <ReplyComposer
            threadId={threadId}
            initialText={quoteText}
            onClearQuote={() => setQuoteText(null)}
          />
        </div>
      )}
    </div>
  );
}
