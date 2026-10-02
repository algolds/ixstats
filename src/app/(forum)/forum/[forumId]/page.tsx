"use client";
// src/app/(forum)/forum/[forumId]/page.tsx
// Thread list for a specific forum.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { EditPencil as PenSquare, CheckCircle as CheckCheck } from "iconoir-react";
import { ForumLayout } from "~/components/forum/shared/ForumLayout";
import { ForumBreadcrumbs } from "~/components/forum/reader/Breadcrumbs";
import { ThreadListItem } from "~/components/forum/reader/ThreadListItem";
import { ForumPagination } from "~/components/forum/reader/Pagination";
import { useForumContext } from "~/components/forum/shared/ForumContext";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { Button, buttonVariants } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { Card } from "~/components/ui/card";

type SortOrder = "last_post_date" | "post_date" | "reply_count" | "view_count";

export default function ForumThreadListPage() {
  const params = useParams();
  const forumId = Number(params.forumId);
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<SortOrder>("last_post_date");
  const { setForumPage } = useForumContext();

  // Reset page when navigating between forums
  useEffect(() => {
    setPage(1);
    // oxlint-disable-next-line
  }, [forumId]);

  const { data, isLoading } = api.forum.getForum.useQuery(
    { forumId, page, order },
    { staleTime: 30_000, enabled: !isNaN(forumId) }
  );

  useEffect(() => {
    if (data?.forum) {
      setForumPage(null, { id: data.forum.nodeId, title: data.forum.title });
    }
  }, [data?.forum, setForumPage]);

  const forum = data?.forum;
  const threads = data?.threads ?? [];
  const pagination = data?.pagination;

  // Separate sticky and regular threads
  const stickyThreads = threads.filter((t: any) => t.isSticky);
  const regularThreads = threads.filter((t: any) => !t.isSticky);

  return (
    <ForumLayout>
      {/* Breadcrumbs */}
      <ForumBreadcrumbs items={forum ? [{ label: forum.title }] : []} />

      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-large-title text-label">{forum?.title ?? "Loading..."}</h1>
          {forum?.description && (
            <p className="text-body text-label-secondary mt-0.5">{forum.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MarkReadButton forumId={forumId} />
          <Link
            href={withBasePath(`/forum/new-thread?forum=${forumId}`)}
            className={buttonVariants({ size: "sm" })}
          >
            <PenSquare />
            New thread
          </Link>
        </div>
      </div>

      {/* Sort controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-footnote text-label-secondary">Sort by</span>
        <SegmentedControl
          size="sm"
          aria-label="Sort threads"
          value={order}
          onValueChange={(next) => {
            setOrder(next);
            setPage(1);
          }}
          options={[
            { value: "last_post_date", label: "Latest" },
            { value: "post_date", label: "Newest" },
            { value: "reply_count", label: "Most replies" },
            { value: "view_count", label: "Most viewed" },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="rounded-row h-16 w-full" />
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
          {/* Sticky threads */}
          {stickyThreads.map((thread: any) => (
            <ThreadListItem key={thread.threadId} {...thread} />
          ))}

          {/* Divider between sticky and regular */}
          {stickyThreads.length > 0 && regularThreads.length > 0 && (
            <div className="bg-separator mx-4 h-px" />
          )}

          {/* Regular threads */}
          {regularThreads.map((thread: any) => (
            <ThreadListItem key={thread.threadId} {...thread} />
          ))}

          {threads.length === 0 && (
            <EmptyState
              compact
              title="No threads yet"
              message="Be the first to start a discussion."
            />
          )}
        </Card>
      )}

      {/* Pagination */}
      {pagination && pagination.last_page > 1 && (
        <ForumPagination
          currentPage={pagination.current_page}
          lastPage={pagination.last_page}
          onPageChange={setPage}
        />
      )}
    </ForumLayout>
  );
}

function MarkReadButton({ forumId }: { forumId: number }) {
  const markRead = api.forum.markForumRead.useMutation();

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => markRead.mutate({ forumId })}
      disabled={markRead.isPending}
      title="Mark all threads as read"
    >
      <CheckCheck />
      {markRead.isPending ? "Marking..." : "Mark read"}
    </Button>
  );
}
