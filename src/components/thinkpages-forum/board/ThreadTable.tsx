"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, Lock, Pin } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { timeAgo } from "~/lib/format/compact";
import { threadHref, unreadHref } from "~/lib/thinkpages-forum/links";
import { pageWindow } from "~/lib/thinkpages-forum/pagination";
import { pageCount, POSTS_PER_PAGE } from "~/lib/thinkpages-forum/paging";
import { sortHref, type ThreadSort } from "~/lib/thinkpages-forum/thread-sort";
import { cn } from "~/lib/utils/cn";
import { AdvertMark } from "../advert/AdvertMark";
import { AuthorFlag, resolveAuthor } from "../AuthorMark";
import { AuthorName, type ForumAuthors } from "../AuthorName";
import { ForumAvatar } from "../ForumAvatar";
import { pageHref } from "../Pagination";

/** What a row needs of a thread: a board's read, and the New posts and Watched lists, share it. */
export interface ThreadRowData {
  id: string;
  title: string;
  authorUserId: string | null;
  authorPersonaId: string | null;
  importedAuthorName: string | null;
  xenforoThreadId: number | null;
  pinned: boolean;
  locked: boolean;
  /** Moderators only: members never receive hidden threads. */
  hidden?: boolean;
  postCount: number;
  lastPostAt: Date;
  lastPoster?: {
    authorUserId: string | null;
    authorPersonaId: string | null;
    importedAuthorName: string | null;
  } | null;
  /** Signed-in viewers: the thread has posts the member has not read. */
  unread?: boolean;
  /** The list pages name each thread's board (and its realm). */
  board?: { name: string; realm: { name: string } | null };
  /** Find a Realm: the realm this thread advertises, else null. */
  advert?: {
    realmSlug: string;
    realmName: string;
    emblemUrl: string | null;
    thumbnail: string | null;
    claimsOpen: boolean;
  } | null;
}
type Thread = ThreadRowData;

/**
 * Phones: the thread on a line, then replies and the last post. md+: Thread / Replies / Last post columns, which the
 * table sizes once (the first fills, the others fit their widest cell) and every row, header and group shares by
 * subgrid, so the figures line up and no column keeps room it does not use.
 */
const TABLE = "md:grid md:grid-cols-[minmax(0,1fr)_auto_auto]";
const SPAN = "md:col-span-3 md:grid md:grid-cols-subgrid";
const GRID = `grid grid-cols-[minmax(0,1fr)_auto] ${SPAN}`;

const SORT_COLUMNS: ReadonlyArray<{ label: string; sort: ThreadSort; align?: "right" }> = [
  { label: "Thread", sort: "newest" },
  { label: "Replies", sort: "replies", align: "right" },
  { label: "Last post", sort: "latest" },
];

/** Sort links when the table belongs to a board (`basePath`); plain headings on the list pages, which have no sort. */
function SortHeaders({ basePath, sort }: { basePath?: string; sort?: ThreadSort }) {
  return (
    <div
      role="row"
      className={cn(
        GRID,
        // The column headings sit on a Well band, as each post starts on one.
        "facet-well text-footnote text-label-secondary border-separator items-center gap-x-4 border-b px-4 py-2 max-md:sr-only max-md:focus-within:not-sr-only sm:px-5"
      )}
    >
      {SORT_COLUMNS.map((column) => {
        const active = basePath !== undefined && column.sort === sort;
        return (
          <div
            key={column.label}
            role="columnheader"
            aria-sort={active ? "descending" : undefined}
            className={column.align === "right" ? "text-right" : undefined}
          >
            {basePath === undefined ? (
              column.label
            ) : (
              <Link
                href={sortHref(basePath, column.sort)}
                className={cn(
                  "hover:text-label focus-visible:outline-tint inline-flex items-center gap-1 focus-visible:outline-2 pointer-coarse:min-h-11",
                  active && "text-label"
                )}
              >
                {column.label}
                {active ? <ArrowDown aria-hidden className="size-3" /> : null}
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** `1 2 … 9`: links into a thread's pages, above the title link so they stay clickable. */
function PageShortcuts({ thread, last }: { thread: Thread; last: number }) {
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
            href={pageHref(threadHref(thread.id), entry)}
            aria-label={`Page ${entry} of ${thread.title}`}
            className="text-tint focus-visible:outline-tint inline-flex min-w-5 justify-center tabular-nums hover:underline focus-visible:outline-2 pointer-coarse:min-h-11 pointer-coarse:min-w-8 pointer-coarse:items-center"
          >
            {entry}
          </Link>
        )
      )}
    </span>
  );
}

/** Who wrote the thread's last post and when: avatar, name and time from md up, "name · time" on a phone. */
function LastPost({ thread, authors }: { thread: Thread; authors: ForumAuthors }) {
  const when = timeAgo(thread.lastPostAt);
  if (!thread.lastPoster) {
    return <span className="text-footnote text-label-secondary tabular-nums">{when}</span>;
  }
  const poster = resolveAuthor({
    authors,
    userId: thread.lastPoster.authorUserId,
    personaId: thread.lastPoster.authorPersonaId,
    importedName: thread.lastPoster.importedAuthorName,
  });
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <ForumAvatar
        name={poster.name}
        avatarUrl={poster.avatarUrl}
        size="sm"
        className="hidden md:flex"
      />
      <span className="flex min-w-0 items-baseline gap-1.5 md:flex-col md:items-start md:gap-0">
        <span className="text-footnote text-label md:text-callout max-w-40 truncate md:max-w-48">
          {poster.name}
        </span>
        <span aria-hidden className="text-footnote text-label-secondary md:hidden">
          ·
        </span>
        <span className="text-footnote text-label-secondary tabular-nums">{when}</span>
      </span>
    </span>
  );
}

/** The row's mark: an advert shows its realm's emblem, thumbnail or mark; any other thread its author's avatar. */
function RowAvatar({
  thread,
  author,
}: {
  thread: Thread;
  author: ReturnType<typeof resolveAuthor>;
}) {
  return thread.advert ? (
    <AdvertMark advert={thread.advert} />
  ) : (
    <ForumAvatar name={author.name} avatarUrl={author.avatarUrl} size="md" />
  );
}

/** The pills after the title: Hidden (moderators), Imported, and Open to join on an advert whose realm takes claims. */
function RowBadges({ thread }: { thread: Thread }) {
  return (
    <>
      {/* Moderators only: members never receive hidden threads. */}
      {thread.hidden ? <Badge variant="warning">Hidden</Badge> : null}
      {typeof thread.xenforoThreadId === "number" ? (
        <Badge variant="outline">Imported</Badge>
      ) : null}
      {thread.advert?.claimsOpen ? <Badge variant="success">Open to join</Badge> : null}
    </>
  );
}

interface ThreadRowProps {
  thread: Thread;
  authors: ForumAuthors;
  renderAction?: (thread: Thread) => React.ReactNode;
}

function ThreadRow({ thread, authors, renderAction }: ThreadRowProps) {
  const replies = Math.max(0, thread.postCount - 1);
  const last = pageCount(thread.postCount, POSTS_PER_PAGE);
  const author = resolveAuthor({
    authors,
    userId: thread.authorUserId,
    personaId: thread.authorPersonaId,
    importedName: thread.importedAuthorName,
  });
  const unread = thread.unread === true;
  const action = renderAction?.(thread);
  return (
    <div
      role="row"
      className={cn(
        GRID,
        "hover:bg-fill-4 relative items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-5 pointer-coarse:min-h-11",
        // An unread thread carries a wash of the tint, so new activity reads down the list at a glance.
        unread && "bg-tint-fill/50"
      )}
    >
      <div role="cell" className="col-span-2 flex min-w-0 items-center gap-3.5 md:col-span-1">
        <RowAvatar thread={thread} author={author} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {unread ? (
              <>
                <span aria-hidden className="bg-tint size-2 shrink-0 rounded-full" />
                <span className="sr-only">Unread</span>
              </>
            ) : null}
            {thread.pinned ? (
              <Pin aria-label="Pinned" role="img" className="text-tint size-4 shrink-0" />
            ) : null}
            {thread.locked ? (
              <Lock aria-label="Locked" className="text-label-secondary size-4 shrink-0" />
            ) : null}
            <Link
              href={unread ? unreadHref(thread.id) : threadHref(thread.id)}
              className={cn(
                "text-title-3 text-label focus-visible:outline-tint min-w-0 truncate after:absolute after:inset-0 focus-visible:outline-2",
                unread ? "font-bold" : "font-medium"
              )}
            >
              {thread.title}
            </Link>
            <RowBadges thread={thread} />
            {last > 1 || action ? (
              <span className="ml-auto flex shrink-0 items-center gap-2">
                {last > 1 ? (
                  <Link
                    href={pageHref(threadHref(thread.id), last)}
                    aria-label={`Last page of ${thread.title}`}
                    className="text-footnote text-tint relative z-10 shrink-0 hover:underline md:hidden pointer-coarse:min-h-11 pointer-coarse:items-center pointer-coarse:max-md:inline-flex"
                  >
                    Last page
                  </Link>
                ) : null}
                {action ? <span className="relative z-10 shrink-0">{action}</span> : null}
              </span>
            ) : null}
          </div>
          <div className="text-footnote text-label-secondary mt-0.5 flex min-w-0 items-center gap-2">
            {author.flagUrl ? <AuthorFlag url={author.flagUrl} /> : null}
            <AuthorName
              authors={authors}
              userId={thread.authorUserId}
              personaId={thread.authorPersonaId}
              importedName={thread.importedAuthorName}
            />
            {thread.board ? (
              <>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate">
                  {thread.board.realm
                    ? `${thread.board.realm.name} · ${thread.board.name}`
                    : thread.board.name}
                </span>
              </>
            ) : null}
            {last > 1 ? <PageShortcuts thread={thread} last={last} /> : null}
          </div>
        </div>
      </div>
      <div
        role="cell"
        className="text-footnote text-label-secondary col-start-1 tabular-nums md:col-start-2 md:row-start-1 md:text-right"
      >
        <span className="md:text-title-3 md:text-label md:block">{replies}</span>
        <span className="md:text-footnote md:block">{` ${replies === 1 ? "reply" : "replies"}`}</span>
      </div>
      <div
        role="cell"
        className="col-start-2 min-w-0 justify-self-end md:col-start-3 md:row-start-1 md:justify-self-start"
      >
        <LastPost thread={thread} authors={authors} />
      </div>
    </div>
  );
}

function Group({
  label,
  threads,
  authors,
  renderAction,
}: {
  label: string | null;
  threads: readonly Thread[];
  authors: ForumAuthors;
  renderAction?: (thread: Thread) => React.ReactNode;
}) {
  return (
    <div role="rowgroup" className={cn("divide-separator divide-y", SPAN)}>
      {label ? (
        <div role="row" className="md:col-span-3">
          <div
            role="rowheader"
            className="text-footnote text-label-secondary bg-fill-4 flex items-center gap-1.5 px-4 py-2 font-medium sm:px-5"
          >
            {label === "Pinned" ? <Pin aria-hidden className="text-tint size-3.5" /> : null}
            {label}
          </div>
        </div>
      ) : null}
      {threads.map((thread) => (
        <ThreadRow key={thread.id} thread={thread} authors={authors} renderAction={renderAction} />
      ))}
    </div>
  );
}

interface ThreadTableProps {
  threads: readonly Thread[];
  authors: ForumAuthors;
  /** The board's path, without `?sort=` or `?page=`; absent on the list pages, whose headings are not sort links. */
  basePath?: string;
  sort?: ThreadSort;
  /** A control at the end of each row's title line (the Watched page's Unwatch). */
  renderAction?: (thread: Thread) => React.ReactNode;
}

/** A board's threads: Thread / Replies / Last post with sortable headers, pinned threads grouped first. */
export function ThreadTable({ threads, authors, basePath, sort, renderAction }: ThreadTableProps) {
  const pinned = threads.filter((t) => t.pinned);
  const others = threads.filter((t) => !t.pinned);
  return (
    <div role="table" aria-label="Threads" className={TABLE}>
      <div role="rowgroup" className={SPAN}>
        <SortHeaders basePath={basePath} sort={sort} />
      </div>
      {pinned.length > 0 ? (
        <>
          <Group label="Pinned" threads={pinned} authors={authors} renderAction={renderAction} />
          {others.length > 0 ? (
            <Group label="Threads" threads={others} authors={authors} renderAction={renderAction} />
          ) : null}
        </>
      ) : (
        <Group label={null} threads={others} authors={authors} renderAction={renderAction} />
      )}
    </div>
  );
}
