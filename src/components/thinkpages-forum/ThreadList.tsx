"use client";

import Link from "next/link";
import { EditPencil, Lock, Pin } from "iconoir-react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { usePageTitle } from "~/hooks/usePageTitle";
import { timeAgo } from "~/lib/format/compact";
import {
  categoryHref,
  forumHomeHref,
  newThreadHref,
  threadHref,
} from "~/lib/thinkpages-forum/links";
import { pageCount, THREADS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { api, type RouterOutputs } from "~/trpc/react";
import { AuthorName, type ForumAuthors } from "./AuthorName";
import { ForumNotice } from "./BanNotice";
import { ForumBreadcrumbs, forumTrail } from "./ForumBreadcrumbs";
import { ForumLoadError, ForumPageSkeleton } from "./ForumPageState";
import { Pagination, useLastPageRedirect } from "./Pagination";

type Thread = RouterOutputs["thinkpagesForum"]["category"]["threads"][number];

function ThreadRow({ thread, authors }: { thread: Thread; authors: ForumAuthors }) {
  const replies = Math.max(0, thread.postCount - 1);
  return (
    <li>
      <Link
        href={threadHref(thread.id)}
        className="hover:bg-fill-4 focus-visible:outline-tint flex items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <div className="min-w-0 flex-1">
          <p className="text-headline text-label flex items-center gap-1.5">
            {thread.pinned ? (
              <Pin aria-label="Pinned" className="text-tint size-3.5 shrink-0" />
            ) : null}
            {thread.locked ? (
              <Lock aria-label="Locked" className="text-label-secondary size-3.5 shrink-0" />
            ) : null}
            <span className="min-w-0 truncate">{thread.title}</span>
            {/* Moderators only: members never receive hidden threads. */}
            {thread.hidden ? <Badge variant="warning">Hidden</Badge> : null}
            {typeof thread.xenforoThreadId === "number" ? (
              <Badge variant="outline">Imported</Badge>
            ) : null}
          </p>
          <p className="text-footnote text-label-secondary flex min-w-0 gap-1">
            <AuthorName
              authors={authors}
              userId={thread.authorUserId}
              personaId={thread.authorPersonaId}
              importedName={thread.importedAuthorName}
            />
          </p>
        </div>
        <div className="text-footnote text-label-secondary shrink-0 text-right tabular-nums">
          <p>{`${replies} ${replies === 1 ? "reply" : "replies"}`}</p>
          <p>{timeAgo(thread.lastPostAt)}</p>
        </div>
      </Link>
    </li>
  );
}

interface ThreadListProps {
  categoryKey: string;
  page: number;
  /** The realm's slug for a realm category; absent for the sitewide section. */
  realm?: string;
}

/** A category's threads, pinned first, with "New thread" for viewers who may start one. */
export function ThreadList({ categoryKey, page, realm }: ThreadListProps) {
  const { data, isLoading, error, refetch } = api.thinkpagesForum.category.useQuery({
    key: categoryKey,
    page,
    realm,
  });
  const basePath = categoryHref({ key: categoryKey, realm: realm ? { slug: realm } : null });
  const totalPages = pageCount(data?.total ?? 0, THREADS_PER_PAGE);
  const redirecting = useLastPageRedirect(basePath, page, data?.total, totalPages);
  usePageTitle({ title: data?.category.name ?? "ThinkPages Forum" });

  if (isLoading || redirecting) return <ForumPageSkeleton />;

  if (!data) {
    return (
      <ForumLoadError
        notFound={error?.data?.code === "NOT_FOUND"}
        notFoundTitle="Category not found"
        notFoundMessage="It may be private, or the link is incorrect."
        onRetry={() => void refetch()}
      />
    );
  }

  const { category } = data;

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-4 sm:py-6 md:py-8">
      <PageHeader
        title={category.name}
        subtitle={
          <>
            <ForumBreadcrumbs items={[...forumTrail(category.realm), { label: category.name }]} />
            {category.description ? <p>{category.description}</p> : null}
          </>
        }
        back={{ href: forumHomeHref(category.realm?.slug), label: "Forum" }}
        bleed
        actions={
          data.canStart ? (
            <Button asChild size="sm">
              <Link href={newThreadHref(category)}>
                <EditPencil aria-hidden />
                New thread
              </Link>
            </Button>
          ) : null
        }
      />
      {!data.canStart && data.notice ? (
        <ForumNotice notice={data.notice} banned={data.banned} />
      ) : null}
      <Card content="feed" className="overflow-hidden">
        {data.threads.length > 0 ? (
          <ul className="divide-separator divide-y">
            {data.threads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} authors={data.authors} />
            ))}
          </ul>
        ) : (
          <EmptyState compact title="No threads yet" message="Be the first to post" />
        )}
      </Card>
      <Pagination basePath={basePath} page={page} totalPages={totalPages} />
    </div>
  );
}
