import { countLabel } from "~/lib/thinkpages-forum/unread";

/**
 * Unread, the same everywhere in the forum: a tint dot placed immediately before the title or name, read as "Unread"
 * by screen readers. The title beside it goes semibold; a count, where there is one, follows the name as an
 * `UnreadCount`.
 */
export function UnreadMark() {
  return (
    <span className="inline-flex shrink-0 items-center self-center">
      <span aria-hidden className="bg-tint size-2 rounded-full" />
      <span className="sr-only">Unread</span>
    </span>
  );
}

/** The quiet "N new" that follows an unread name (capped at 99+), with an optional context after it ("on the board"). */
export function UnreadCount({ count, suffix }: { count: number; suffix?: string }) {
  const label = `${countLabel(count)} new`;
  return (
    <span className="text-footnote text-label-secondary shrink-0 tabular-nums">
      {suffix ? `${label} ${suffix}` : label}
    </span>
  );
}
