"use client";

import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { placeLine } from "~/lib/discussed-in";
import { api, type RouterOutputs } from "~/trpc/react";

type Item = RouterOutputs["actionLinks"]["discussions"]["items"][number];

function Row({ item }: { item: Item }) {
  const when = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return (
    <li>
      <Link
        href={item.href}
        className="hover:bg-fill-4 rounded-row flex flex-col gap-0.5 px-2 py-2 pointer-coarse:min-h-11"
      >
        <span className="flex items-center gap-2">
          <span className="text-label text-callout min-w-0 truncate font-medium">{item.title}</span>
          {item.hidden ? <Badge variant="outline">Hidden from members</Badge> : null}
        </span>
        <span className="text-label-secondary text-footnote">
          {placeLine(item)} <span aria-hidden>{"·"}</span> {when}
        </span>
      </Link>
    </li>
  );
}

/**
 * The visible posts that link an action, newest first, a page at a time. `excludePostId` leaves out the post showing the
 * card. A page can come back short and still have a next one (hidden posts take no slots), so "Show more" follows the
 * server's cursor, never the page length.
 */
export function DiscussionList({
  activityId,
  excludePostId,
  id,
}: {
  activityId: string;
  excludePostId?: string;
  /** The list's element id, for a control that `aria-controls` it. */
  id?: string;
}) {
  const query = api.actionLinks.discussions.useInfiniteQuery(
    { activityId },
    { getNextPageParam: (last) => last.nextCursor ?? undefined, staleTime: 30_000 }
  );
  if (query.isLoading) return <Skeleton id={id} aria-busy="true" className="h-12 w-full" />;
  if (query.isError) {
    return (
      <div id={id} className="flex flex-col items-start gap-1">
        <p className="text-label-secondary text-footnote">Could not load the discussions.</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="pointer-coarse:min-h-11"
          onClick={() => void query.refetch()}
        >
          Retry
        </Button>
      </div>
    );
  }
  const items = (query.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (item) => item.postId !== excludePostId
  );
  return (
    <div id={id} className="flex flex-col gap-1">
      {items.length === 0 && !query.hasNextPage ? (
        <EmptyState compact title="No discussions to show" />
      ) : (
        <ul className="divide-separator divide-y">
          {items.map((item) => (
            <Row key={item.postId} item={item} />
          ))}
        </ul>
      )}
      {query.hasNextPage ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start pointer-coarse:min-h-11"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Show more
        </Button>
      ) : null}
    </div>
  );
}
