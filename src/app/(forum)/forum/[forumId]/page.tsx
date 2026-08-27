// src/app/(forum)/forum/[forumId]/page.tsx
// Thread list for a specific forum.

"use client";

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
          <h1 className="text-xl font-semibold text-[var(--forum-text)]">
            {forum?.title ?? "Loading..."}
          </h1>
          {forum?.description && (
            <p className="mt-0.5 text-sm text-[var(--forum-text-dim)]">{forum.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MarkReadButton forumId={forumId} />
          <Link
            href={withBasePath(`/forum/new-thread?forum=${forumId}`)}
            className="forum-composer-submit flex items-center gap-1.5"
          >
            <PenSquare className="h-3.5 w-3.5" />
            New Thread
          </Link>
        </div>
      </div>

      {/* Sort controls */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-[var(--forum-text-dim)]">Sort by:</span>
        {(
          [
            { key: "last_post_date", label: "Latest" },
            { key: "post_date", label: "Newest" },
            { key: "reply_count", label: "Most Replies" },
            { key: "view_count", label: "Most Viewed" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            onClick={() => {
              setOrder(opt.key);
              setPage(1);
            }}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              order === opt.key
                ? "bg-orange-500/15 text-orange-400"
                : "text-[var(--forum-text-dim)] hover:text-[var(--forum-text-muted)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="forum-skeleton h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="glass-forum-parent overflow-hidden p-1">
          {/* Sticky threads */}
          {stickyThreads.map((thread: any) => (
            <ThreadListItem key={thread.threadId} {...thread} />
          ))}

          {/* Divider between sticky and regular */}
          {stickyThreads.length > 0 && regularThreads.length > 0 && (
            <div className="mx-4 my-1 h-px bg-gradient-to-r from-transparent via-[var(--forum-accent)]/10 to-transparent" />
          )}

          {/* Regular threads */}
          {regularThreads.map((thread: any) => (
            <ThreadListItem key={thread.threadId} {...thread} />
          ))}

          {threads.length === 0 && (
            <div className="py-12 text-center text-sm text-[var(--forum-text-dim)]">
              No threads yet. Be the first to start a discussion!
            </div>
          )}
        </div>
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
    <button
      onClick={() => markRead.mutate({ forumId })}
      disabled={markRead.isPending}
      className="flex items-center gap-1.5 rounded-lg border border-[var(--forum-border)] px-3 py-1.5 text-xs font-medium text-[var(--forum-text-dim)] transition-colors hover:border-[var(--forum-accent-border)] hover:text-[var(--forum-accent)]"
      title="Mark all threads as read"
    >
      <CheckCheck className="h-3.5 w-3.5" />
      {markRead.isPending ? "Marking..." : "Mark Read"}
    </button>
  );
}
