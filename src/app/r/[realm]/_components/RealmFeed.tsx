"use client";

import Link from "next/link";
import { api } from "~/trpc/react";
import { timeAgo } from "~/lib/format/compact";
import { stripHtml } from "~/lib/utils/sanitize-html";

/** Posts the compact rail feed lists. */
const COMPACT_ROWS = 5;
/** Characters of a post's text a compact row shows. */
const COMPACT_EXCERPT = 120;

/** The part of a post a compact row reads. */
interface FeedRow {
  id: string;
  content: string;
  timestamp: string;
  account: { displayName: string } | null;
}

function CompactRow({ row }: { row: FeedRow }) {
  const text = stripHtml(row.content);
  const excerpt = text.slice(0, COMPACT_EXCERPT);
  return (
    <li>
      <Link
        href={`/dashboard/post/${row.id}`}
        className="hover:bg-fill-3 rounded-row flex flex-col gap-0.5 p-2"
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-label text-body truncate">
            {row.account?.displayName ?? "Someone"}
          </span>
          <span className="text-label-secondary text-footnote shrink-0">
            {timeAgo(row.timestamp)}
          </span>
        </span>
        <span className="text-label-secondary text-footnote">
          {excerpt}
          {text.length > COMPACT_EXCERPT && "…"}
        </span>
      </Link>
    </li>
  );
}

/**
 * The rail's ThinkPages feed scoped to one realm (posts by its nations' personas), or to every realm when `realmId`
 * is null: up to five one-line rows linking to the posts.
 */
export function RealmFeed({ realmId }: { realmId: string | null }) {
  const { data, isLoading, error } = api.thinkpages.getFeed.useQuery(
    { realmId: realmId ?? undefined, limit: COMPACT_ROWS },
    { staleTime: 15_000 }
  );

  if (isLoading) return <p className="text-label-secondary text-body p-4">Loading posts…</p>;
  if (error)
    return <p className="text-label-secondary text-body p-4">The feed could not be loaded.</p>;
  if (!data?.posts.length)
    return (
      <p className="text-label-secondary text-body p-4">
        No posts yet. {realmId ? "Nations of this realm haven't posted." : ""}
      </p>
    );

  const rows: FeedRow[] = data.posts.slice(0, COMPACT_ROWS);
  return (
    <ul className="flex flex-col gap-1" aria-label="Recent posts">
      {rows.map((row) => (
        <CompactRow key={row.id} row={row} />
      ))}
    </ul>
  );
}
