import { countLabel } from "~/lib/thinkpages-forum/unread";

/**
 * Unread, the same everywhere in the forum: a tint dot, then "N new" when there is a count (capped at 99+). Titles
 * beside it go semibold.
 */
export function UnreadMark({ count }: { count?: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <span aria-hidden className="bg-tint size-2 rounded-full" />
      {count === undefined ? (
        <span className="sr-only">Unread</span>
      ) : (
        <span className="text-footnote text-label-secondary tabular-nums">{`${countLabel(count)} new`}</span>
      )}
    </span>
  );
}
