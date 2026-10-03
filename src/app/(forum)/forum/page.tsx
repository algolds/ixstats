"use client";
// src/app/(forum)/forum/page.tsx
// Forum index — categories view by default, thread feed for Trending/New.

import { useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { FireFlame as Flame, Clock, HomeSimple as HomeIcon } from "iconoir-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ForumCategoryCard } from "~/components/forum/reader/ForumCategoryCard";
import { ThreadListItem } from "~/components/forum/reader/ThreadListItem";
import { ForumPagination } from "~/components/forum/reader/Pagination";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { withBasePath } from "~/lib/base-path";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";
import { api } from "~/trpc/react";
import { buttonVariants } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

type ViewMode = "categories" | "trending" | "new";

const TINT_RULE: CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, transparent, color-mix(in srgb, var(--tint) 20%, transparent), transparent)",
};

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
    // oxlint-disable-next-line
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
  const categories = forums.filter((f: any) => f.nodeType === "Category");
  const subForums = forums.filter((f: any) => f.nodeType === "Forum");

  const categoryMap = new Map<number, typeof subForums>();
  for (const forum of subForums) {
    const existing = categoryMap.get(forum.parentNodeId) ?? [];
    existing.push(forum);
    categoryMap.set(forum.parentNodeId, existing);
  }

  const orphanForums = subForums.filter(
    (f: any) => !categories.some((c: any) => c.nodeId === f.parentNodeId)
  );

  const isLoading = viewMode === "categories" ? forumsLoading : threadsLoading;

  return (
    <ForumLayout>
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Forum" className="max-w-4xl px-0 sm:px-0" />
      {/* Header — only shown for trending/new feed views */}
      {viewMode !== "categories" && (
        <div className="mx-auto mb-6 max-w-4xl">
          <h1 className="text-large-title text-label">
            {viewMode === "trending" ? "Trending threads" : "New posts"}
          </h1>
          <p className="text-body text-label-secondary mt-1">
            {viewMode === "trending"
              ? "Most active discussions across all forums"
              : "Latest threads and activity"}
          </p>
          <div aria-hidden="true" className="mt-3 h-px w-full" style={TINT_RULE} />
        </div>
      )}

      {/* View mode tabs (only show when in feed mode, to help navigate back) */}
      {viewMode !== "categories" && (
        <div className="mb-4 flex items-center gap-2">
          <Link
            href={withBasePath("/forum")}
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <HomeIcon />
            All forums
          </Link>
          <Link
            href={withBasePath("/forum?sort=trending")}
            aria-current={viewMode === "trending" ? "page" : undefined}
            className={buttonVariants({
              variant: viewMode === "trending" ? "secondary" : "ghost",
              size: "sm",
            })}
          >
            <Flame />
            Trending
          </Link>
          <Link
            href={withBasePath("/forum?sort=new")}
            aria-current={viewMode === "new" ? "page" : undefined}
            className={buttonVariants({
              variant: viewMode === "new" ? "secondary" : "ghost",
              size: "sm",
            })}
          >
            <Clock />
            New posts
          </Link>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="rounded-row h-16 w-full" />
          ))}
        </div>
      ) : viewMode === "categories" ? (
        /* ─── Categories View ─── */
        <div className="space-y-6">
          {categories.map((cat: any) => {
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
                {children.map((forum: any) => (
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
            <Card className="overflow-hidden">
              {orphanForums.map((forum: any) => (
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
            </Card>
          )}

          {forums.length === 0 && <EmptyState title="No forums available" />}
        </div>
      ) : (
        /* ─── Thread Feed View (Trending / New) ─── */
        <div>
          <Card className="overflow-hidden">
            {(threadsData?.threads ?? []).map((thread: any) => (
              <ThreadListItem key={thread.threadId} {...thread} />
            ))}

            {(threadsData?.threads ?? []).length === 0 && (
              <EmptyState compact title="No threads found" />
            )}
          </Card>

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
