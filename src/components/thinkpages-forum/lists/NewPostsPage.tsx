"use client";

import { ChatLines } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { useNotify } from "~/hooks/useNotify";
import { usePageTitle } from "~/hooks/usePageTitle";
import { FORUM_HOME, NEW_POSTS_HREF } from "~/lib/thinkpages-forum/links";
import { pageCount, THREADS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api } from "~/trpc/react";
import { ThreadTable } from "../board";
import { ForumLoadError, ForumPageSkeleton } from "../ForumPageState";
import { Pagination, pageHref, useLastPageRedirect } from "../Pagination";
import { ForumPage } from "../shell";
import { useReadStateRefresh } from "../useReadStateRefresh";

/** New posts: the unread threads of the last 30 days across the boards the member can see, newest first. */
export function NewPostsPage({ page }: { page: number }) {
  const notify = useNotify();
  const refresh = useReadStateRefresh();
  const { data, isLoading, refetch } = api.thinkpagesForum.newPosts.useQuery({ page });
  const { mutateAsync: markAll, isPending } = api.thinkpagesForum.markAllRead.useMutation();
  const totalPages = pageCount(data?.total ?? 0, THREADS_PER_PAGE);
  const redirecting = useLastPageRedirect(NEW_POSTS_HREF, page, data?.total, totalPages);
  usePageTitle({ title: "New posts" });

  const markEverythingRead = async () => {
    try {
      await markAll();
    } catch (e) {
      notify.error("Could not mark everything read", e instanceof Error ? e.message : undefined);
      return;
    }
    // The mark is saved; a failed refresh of the lists is not an error to report.
    await refresh().catch(() => undefined);
  };

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

  const hrefFor = (n: number) => pageHref(NEW_POSTS_HREF, n);
  return (
    <ForumPage
      title="New posts"
      breadcrumbs={
        <p className="text-footnote text-label-tertiary tabular-nums">
          {data.total === 1 ? "1 unread thread" : `${data.total} unread threads`}
        </p>
      }
      back={{ href: FORUM_HOME, label: "ThinkPages" }}
      wideActions={
        <Button
          size="sm"
          variant="ghost"
          className="text-label-secondary"
          disabled={isPending || data.total === 0}
          onClick={() => void markEverythingRead()}
        >
          Mark all read
        </Button>
      }
    >
      <Pagination page={page} last={totalPages} hrefFor={hrefFor} />
      <Card content="data" className="overflow-hidden py-1">
        {data.threads.length > 0 ? (
          <ThreadTable threads={data.threads} authors={data.authors} />
        ) : (
          <EmptyState
            compact
            icon={<ChatLines className="text-tint" />}
            title="You're all caught up"
          />
        )}
      </Card>
      <Pagination page={page} last={totalPages} hrefFor={hrefFor} />
    </ForumPage>
  );
}
