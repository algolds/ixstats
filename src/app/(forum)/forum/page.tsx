// src/app/(forum)/forum/page.tsx
// Forum index — categories view by default, thread feed for Trending/New.

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Flame, Clock, Home as HomeIcon } from "lucide-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ForumCategoryCard } from "~/components/forum/reader/ForumCategoryCard";
import { ThreadListItem } from "~/components/forum/reader/ThreadListItem";
import { ForumPagination } from "~/components/forum/reader/Pagination";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";

type ViewMode = "categories" | "trending" | "new";

export default function ForumIndexPage() {
  const { clearForumPage } = useForumContext();
  const searchParams = useSearchParams();
  const sortParam = searchParams.get("sort");

  const viewMode: ViewMode =
    sortParam === "trending" ? "trending" : sortParam === "new" ? "new" : "categories";

  const [page, setPage] = useState(1);

  useEffect(() => {
    clearForumPage();
  }, [clearForumPage]);

  // Reset page when view mode changes
  useEffect(() => {
    setPage(1);
  }, [viewMode]);

  // Category data (only when in categories mode)
  const { data: forumsData, isLoading: forumsLoading } = api.forum.getForums.useQuery(undefined, {
    staleTime: 60_000,
    enabled: viewMode === "categories",
  });

  // Thread feed data (for trending/new modes)
  const threadOrder =
    viewMode === "trending" ? ("reply_count" as const) : ("last_post_date" as const);
  const { data: threadsData, isLoading: threadsLoading } = api.forum.getRecentThreads.useQuery(
    { order: threadOrder, limit: 25, page },
    { staleTime: 30_000, enabled: viewMode !== "categories" }
  );

  const forums = forumsData?.forums ?? [];
  const categories = forums.filter((f) => f.nodeType === "Category");
  const subForums = forums.filter((f) => f.nodeType === "Forum");

  const categoryMap = new Map<number, typeof subForums>();
  for (const forum of subForums) {
    const existing = categoryMap.get(forum.parentNodeId) ?? [];
    existing.push(forum);
    categoryMap.set(forum.parentNodeId, existing);
  }

  const orphanForums = subForums.filter(
    (f) => !categories.some((c) => c.nodeId === f.parentNodeId)
  );

  const isLoading = viewMode === "categories" ? forumsLoading : threadsLoading;

  return (
    <ForumLayout>
      {/* Header — only shown for trending/new feed views */}
      {viewMode !== "categories" && (
        <div className="mx-auto mb-6 max-w-4xl">
          <h1 className="text-2xl font-bold text-[var(--forum-text)]">
            {viewMode === "trending" ? "Trending Threads" : "New Posts"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--forum-text-dim)]">
            {viewMode === "trending"
              ? "Most active discussions across all forums"
              : "Latest threads and activity"}
          </p>
          <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-[var(--forum-accent)]/20 to-transparent" />
        </div>
      )}

      {/* View mode tabs (only show when in feed mode, to help navigate back) */}
      {viewMode !== "categories" && (
        <div className="mb-4 flex items-center gap-2">
          <Link
            href={withBasePath("/forum")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "categories"
                ? "bg-orange-500/15 text-orange-400"
                : "text-[var(--forum-text-dim)] hover:text-[var(--forum-text-muted)]"
            }`}
          >
            <HomeIcon className="h-3.5 w-3.5" />
            All Forums
          </Link>
          <Link
            href={withBasePath("/forum?sort=trending")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "trending"
                ? "bg-orange-500/15 text-orange-400"
                : "text-[var(--forum-text-dim)] hover:text-[var(--forum-text-muted)]"
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Trending
          </Link>
          <Link
            href={withBasePath("/forum?sort=new")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === "new"
                ? "bg-orange-500/15 text-orange-400"
                : "text-[var(--forum-text-dim)] hover:text-[var(--forum-text-muted)]"
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            New Posts
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="forum-skeleton h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : viewMode === "categories" ? (
        /* ─── Categories View ─── */
        <div className="space-y-6">
          {categories.map((cat) => {
            const children = categoryMap.get(cat.nodeId) ?? [];
            if (children.length === 0) return null;

            return (
              <ForumCategoryCard
                key={cat.nodeId}
                nodeId={cat.nodeId}
                title={cat.title}
                description={cat.description}
                threadCount={cat.threadCount}
                messageCount={cat.messageCount}
                lastPostDate={cat.lastPostDate}
                lastPostUsername={cat.lastPostUsername}
                lastThreadTitle={cat.lastThreadTitle}
                lastThreadId={cat.lastThreadId}
                isCategory
              >
                {children.map((forum) => (
                  <ForumCategoryCard
                    key={forum.nodeId}
                    nodeId={forum.nodeId}
                    title={forum.title}
                    description={forum.description}
                    threadCount={forum.threadCount}
                    messageCount={forum.messageCount}
                    lastPostDate={forum.lastPostDate}
                    lastPostUsername={forum.lastPostUsername}
                    lastThreadTitle={forum.lastThreadTitle}
                    lastThreadId={forum.lastThreadId}
                  />
                ))}
              </ForumCategoryCard>
            );
          })}

          {orphanForums.length > 0 && (
            <div className="glass-forum-parent space-y-0.5 overflow-hidden p-1">
              {orphanForums.map((forum) => (
                <ForumCategoryCard
                  key={forum.nodeId}
                  nodeId={forum.nodeId}
                  title={forum.title}
                  description={forum.description}
                  threadCount={forum.threadCount}
                  messageCount={forum.messageCount}
                  lastPostDate={forum.lastPostDate}
                  lastPostUsername={forum.lastPostUsername}
                  lastThreadTitle={forum.lastThreadTitle}
                  lastThreadId={forum.lastThreadId}
                />
              ))}
            </div>
          )}

          {forums.length === 0 && (
            <div className="py-12 text-center text-sm text-[var(--forum-text-dim)]">
              No forums available.
            </div>
          )}
        </div>
      ) : (
        /* ─── Thread Feed View (Trending / New) ─── */
        <div>
          <div className="glass-forum-parent overflow-hidden p-1">
            {(threadsData?.threads ?? []).map((thread) => (
              <ThreadListItem key={thread.threadId} {...thread} />
            ))}

            {(threadsData?.threads ?? []).length === 0 && (
              <div className="py-12 text-center text-sm text-[var(--forum-text-dim)]">
                No threads found.
              </div>
            )}
          </div>

          {threadsData?.pagination && threadsData.pagination.last_page > 1 && (
            <ForumPagination
              currentPage={threadsData.pagination.current_page}
              lastPage={threadsData.pagination.last_page}
              onPageChange={setPage}
            />
          )}
        </div>
      )}
    </ForumLayout>
  );
}
