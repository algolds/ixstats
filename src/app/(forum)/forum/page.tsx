"use client";

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

const FEED_VIEWS = {
  trending: {
    href: "/forum?sort=trending",
    label: "Trending",
    Icon: Flame,
    title: "Trending threads",
    subtitle: "Most active discussions across all forums",
    order: "reply_count",
  },
  new: {
    href: "/forum?sort=new",
    label: "New posts",
    Icon: Clock,
    title: "New posts",
    subtitle: "Latest threads and activity",
    order: "last_post_date",
  },
} as const;

const cardProps = (f: any) => ({
  nodeId: f.nodeId,
  title: f.title,
  description: f.description,
  threadCount: f.threadCount,
  messageCount: f.messageCount,
  lastPostDate: f.lastPostDate,
  lastPostUsername: f.lastPostUsername,
  lastThreadTitle: f.lastThreadTitle,
  lastThreadId: f.lastThreadId,
});

function FeedNav({ viewMode }: { viewMode: keyof typeof FEED_VIEWS }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <Link
        href={withBasePath("/forum")}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <HomeIcon />
        All forums
      </Link>
      {(Object.keys(FEED_VIEWS) as Array<keyof typeof FEED_VIEWS>).map((mode) => {
        const { href, label, Icon } = FEED_VIEWS[mode];
        return (
          <Link
            key={mode}
            href={withBasePath(href)}
            aria-current={viewMode === mode ? "page" : undefined}
            className={buttonVariants({
              variant: viewMode === mode ? "secondary" : "ghost",
              size: "sm",
            })}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function CategoriesView({ forums }: { forums: any[] }) {
  const categories = forums.filter((f) => f.nodeType === "Category");
  const subForums = forums.filter((f) => f.nodeType === "Forum");
  const orphanForums = subForums.filter(
    (f) => !categories.some((c) => c.nodeId === f.parentNodeId)
  );

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const children = subForums.filter((f) => f.parentNodeId === cat.nodeId);
        if (children.length === 0) return null;

        return (
          <ForumCategoryCard key={cat.nodeId} {...cardProps(cat)} isCategory>
            {children.map((forum) => (
              <ForumCategoryCard key={forum.nodeId} {...cardProps(forum)} />
            ))}
          </ForumCategoryCard>
        );
      })}

      {orphanForums.length > 0 && (
        <Card className="overflow-hidden">
          {orphanForums.map((forum) => (
            <ForumCategoryCard key={forum.nodeId} {...cardProps(forum)} />
          ))}
        </Card>
      )}

      {forums.length === 0 && <EmptyState title="No forums available" />}
    </div>
  );
}

export default function ForumIndexPage() {
  const { clearForumPage } = useForumContext();
  const sortParam = useSearchParams().get("sort");

  const viewMode: ViewMode =
    sortParam === "trending" || sortParam === "new" ? sortParam : "categories";
  const feed = viewMode === "categories" ? null : FEED_VIEWS[viewMode];

  const [page, setPage] = useState(1);

  useEffect(() => {
    clearForumPage();
  }, [clearForumPage]);

  useEffect(() => {
    setPage(1);
    // oxlint-disable-next-line
  }, [viewMode]);

  const { data: forumsData, isLoading: forumsLoading } = api.forum.getForums.useQuery(undefined, {
    staleTime: 60_000,
    enabled: !feed,
  });

  const { data: threadsData, isLoading: threadsLoading } = api.forum.getRecentThreads.useQuery(
    { order: feed?.order ?? "last_post_date", limit: 25, page },
    { staleTime: 30_000, enabled: !!feed }
  );

  const threads = threadsData?.threads ?? [];

  return (
    <ForumLayout>
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="Forum" className="max-w-4xl px-0 sm:px-0" />
      {feed && (
        <>
          <div className="mx-auto mb-6 max-w-4xl">
            <h1 className="text-large-title text-label">{feed.title}</h1>
            <p className="text-body text-label-secondary mt-1">{feed.subtitle}</p>
            <div aria-hidden="true" className="mt-3 h-px w-full" style={TINT_RULE} />
          </div>
          <FeedNav viewMode={viewMode as keyof typeof FEED_VIEWS} />
        </>
      )}

      {(feed ? threadsLoading : forumsLoading) ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="rounded-row h-16 w-full" />
          ))}
        </div>
      ) : !feed ? (
        <CategoriesView forums={forumsData?.forums ?? []} />
      ) : (
        <div>
          <Card className="overflow-hidden">
            {threads.map((thread: any) => (
              <ThreadListItem key={thread.threadId} {...thread} />
            ))}

            {threads.length === 0 && <EmptyState compact title="No threads found" />}
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
