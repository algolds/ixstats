"use client";

import { Eye } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { usePageTitle } from "~/hooks/usePageTitle";
import { FORUM_HOME, WATCHED_HREF } from "~/lib/thinkpages-forum/links";
import { pageCount, THREADS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api } from "~/trpc/react";
import { ThreadTable, type ThreadRowData } from "../board";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import { Pagination, pageHref, useLastPageRedirect } from "../Pagination";
import { ForumPage } from "../shell";
import { useWatchToggle } from "../useWatchToggle";

/** One row's Unwatch: stops watching, then refreshes this list, the sidebar count and the thread's own button. */
function UnwatchButton({ thread }: { thread: ThreadRowData }) {
  const { setWatching, isPending } = useWatchToggle();
  return (
    <Button
      variant="ghost"
      size="xs"
      className="text-label-secondary pointer-coarse:min-h-11"
      aria-label={`Unwatch ${thread.title}`}
      disabled={isPending}
      onClick={() => void setWatching(thread.id, false)}
    >
      Unwatch
    </Button>
  );
}

/** Watched: the member's watched threads, unread first and then by last post. */
export function WatchedPage({ page }: { page: number }) {
  const { data, isLoading, refetch } = api.thinkpagesForum.watchedThreads.useQuery({ page });
  const totalPages = pageCount(data?.total ?? 0, THREADS_PER_PAGE);
  const redirecting = useLastPageRedirect(WATCHED_HREF, page, data?.total, totalPages);
  usePageTitle({ title: "Watched" });

  if (isLoading || redirecting) return <ForumPageSkeleton />;
  if (!data) {
    return (
      <ForumLoadError
        notFound={false}
        notFoundTitle=""
        notFoundMessage=""
        onRetry={() => void refetch()}
      />
    );
  }

  const hrefFor = (n: number) => pageHref(WATCHED_HREF, n);
  return (
    <ForumPage
      title="Watched"
      breadcrumbs={
        <p className="text-footnote text-label-tertiary tabular-nums">
          {data.total === 1 ? "1 thread" : `${data.total} threads`}
        </p>
      }
      back={{ href: FORUM_HOME, label: "ThinkPages" }}
    >
      <Pagination page={page} last={totalPages} hrefFor={hrefFor} />
      <Card content="data" className="overflow-hidden py-1">
        {data.threads.length > 0 ? (
          <ThreadTable
            threads={data.threads}
            authors={data.authors}
            renderAction={(thread) => <UnwatchButton thread={thread} />}
          />
        ) : (
          <EmptyState
            compact
            icon={<Eye className="text-tint" />}
            title="Watch a thread to follow its replies here."
          />
        )}
      </Card>
      <Pagination page={page} last={totalPages} hrefFor={hrefFor} />
    </ForumPage>
  );
}
