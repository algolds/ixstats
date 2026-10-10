"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, Lock } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { timeAgo } from "~/lib/format/compact";
import { threadHref } from "~/lib/thinkpages-forum/links";
import { pageWindow } from "~/lib/thinkpages-forum/pagination";
import { pageCount, POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { sortHref, type ThreadSort } from "~/lib/thinkpages-forum/thread-sort";
import { cn } from "~/lib/utils/cn";
import type { RouterOutputs } from "~/trpc/react";
import { AuthorMark } from "../AuthorMark";
import { AuthorName, type ForumAuthors } from "../AuthorName";
import { pageHref } from "../Pagination";

type Thread = RouterOutputs["thinkpagesForum"]["category"]["threads"][number];

/** Phones: the title on a line, then author, replies and time. md+: Thread / Replies / Last post columns. */
const GRID = "grid grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_5rem_9rem]";

const SORT_COLUMNS: ReadonlyArray<{ label: string; sort: ThreadSort; align?: "right" }> = [
  { label: "Thread", sort: "newest" },
  { label: "Replies", sort: "replies", align: "right" },
  { label: "Last post", sort: "latest" },
];

function SortHeaders({ basePath, sort }: { basePath: string; sort: ThreadSort }) {
  return (
    <div
      role="row"
      className={cn(
        GRID,
        "text-footnote text-label-secondary border-separator hidden items-center gap-x-3 border-b px-5 pb-2 md:grid"
      )}
    >
      {SORT_COLUMNS.map((column) => {
        const active = column.sort === sort;
        return (
          <div
            key={column.label}
            role="columnheader"
            aria-sort={active ? "descending" : undefined}
            className={column.align === "right" ? "text-right" : undefined}
          >
            <Link
              href={sortHref(basePath, column.sort)}
              className={cn(
                "hover:text-label focus-visible:outline-tint inline-flex items-center gap-1 focus-visible:outline-2",
                active && "text-label"
              )}
            >
              {column.label}
              {active ? <ArrowDown aria-hidden className="size-3" /> : null}
            </Link>
          </div>
        );
      })}
    </div>
  );
}

/** `1 2 … 9`: links into a thread's pages, above the title link so they stay clickable. */
function PageShortcuts({ threadId, last }: { threadId: string; last: number }) {
  return (
    <span className="relative z-10 hidden items-center gap-0.5 md:inline-flex">
      {pageWindow(1, last).map((entry, index) =>
        entry === "gap" ? (
          <span key={`gap-${index}`} aria-hidden className="text-label-tertiary px-0.5">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={pageHref(threadHref(threadId), entry)}
            className="text-tint focus-visible:outline-tint inline-flex min-w-5 justify-center tabular-nums hover:underline focus-visible:outline-2 pointer-coarse:min-h-11 pointer-coarse:min-w-8 pointer-coarse:items-center"
          >
            {entry}
          </Link>
        )
      )}
    </span>
  );
}

function ThreadRow({ thread, authors }: { thread: Thread; authors: ForumAuthors }) {
  const replies = Math.max(0, thread.postCount - 1);
  const last = pageCount(thread.postCount, POSTS_PER_PAGE);
  return (
    <div
      role="row"
      className={cn(
        GRID,
        "hover:bg-fill-4 relative items-center gap-x-3 gap-y-1 px-5 py-3 pointer-coarse:min-h-11"
      )}
    >
      <div role="cell" className="col-span-3 flex min-w-0 items-center gap-1.5 md:col-span-1">
        {thread.locked ? (
          <Lock aria-label="Locked" className="text-label-secondary size-3.5 shrink-0" />
        ) : null}
        <Link
          href={threadHref(thread.id)}
          className="text-headline text-label focus-visible:outline-tint min-w-0 truncate after:absolute after:inset-0 focus-visible:outline-2"
        >
          {thread.title}
        </Link>
        {/* Moderators only: members never receive hidden threads. */}
        {thread.hidden ? <Badge variant="warning">Hidden</Badge> : null}
        {typeof thread.xenforoThreadId === "number" ? (
          <Badge variant="outline">Imported</Badge>
        ) : null}
        {last > 1 ? (
          <Link
            href={pageHref(threadHref(thread.id), last)}
            className="text-footnote text-tint relative z-10 ml-auto shrink-0 hover:underline md:hidden"
          >
            Last page
          </Link>
        ) : null}
      </div>
      <div
        role="cell"
        className="text-footnote text-label-secondary col-start-1 flex min-w-0 items-center gap-2"
      >
        <AuthorMark
          authors={authors}
          userId={thread.authorUserId}
          personaId={thread.authorPersonaId}
          importedName={thread.importedAuthorName}
        />
        <AuthorName
          authors={authors}
          userId={thread.authorUserId}
          personaId={thread.authorPersonaId}
          importedName={thread.importedAuthorName}
        />
        {last > 1 ? <PageShortcuts threadId={thread.id} last={last} /> : null}
      </div>
      <div
        role="cell"
        className="text-footnote text-label-secondary md:text-callout md:text-label tabular-nums md:col-start-2 md:row-span-2 md:row-start-1 md:self-center md:text-right"
      >
        <span>{replies}</span>
        <span className="md:hidden">{` ${replies === 1 ? "reply" : "replies"}`}</span>
      </div>
      <div
        role="cell"
        className="text-footnote text-label-secondary tabular-nums md:col-start-3 md:row-span-2 md:row-start-1 md:self-center"
      >
        {timeAgo(thread.lastPostAt)}
      </div>
    </div>
  );
}

function Group({
  label,
  threads,
  authors,
}: {
  label: string | null;
  threads: readonly Thread[];
  authors: ForumAuthors;
}) {
  return (
    <div role="rowgroup" className="divide-separator divide-y">
      {label ? (
        <div role="row">
          <div
            role="rowheader"
            className="text-footnote text-label-secondary bg-fill-3 px-5 py-1.5"
          >
            {label}
          </div>
        </div>
      ) : null}
      {threads.map((thread) => (
        <ThreadRow key={thread.id} thread={thread} authors={authors} />
      ))}
    </div>
  );
}

interface ThreadTableProps {
  threads: readonly Thread[];
  authors: ForumAuthors;
  /** The board's path, without `?sort=` or `?page=`. */
  basePath: string;
  sort: ThreadSort;
}

/** A board's threads: Thread / Replies / Last post with sortable headers, pinned threads grouped first. */
export function ThreadTable({ threads, authors, basePath, sort }: ThreadTableProps) {
  const pinned = threads.filter((t) => t.pinned);
  const others = threads.filter((t) => !t.pinned);
  return (
    <div role="table" aria-label="Threads">
      <div role="rowgroup">
        <SortHeaders basePath={basePath} sort={sort} />
      </div>
      {pinned.length > 0 ? (
        <>
          <Group label="Pinned" threads={pinned} authors={authors} />
          {others.length > 0 ? <Group label="Threads" threads={others} authors={authors} /> : null}
        </>
      ) : (
        <Group label={null} threads={others} authors={authors} />
      )}
    </div>
  );
}
