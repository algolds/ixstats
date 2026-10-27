/**
 * The page title's unread "(N) " prefix, shared by `useNotificationBadge` and `usePageTitle`.
 *
 * Unread counts of the mounted badge instances live here. `usePageTitle` mounts one per page while
 * the app shell keeps another for the whole session, and a page's cleanup must not drop the badge
 * the others still show, so cleanups re-apply the highest remaining count. It is its own module so
 * `usePageTitle` does not depend on the hook file's exports.
 */

/** Matches the "(N) " prefix, so it can be re-applied or removed. */
const UNREAD_PREFIX = /^\(\d+\) /;

const mountedCounts = new Map<string, number>();

export function setBadgeCount(id: string, count: number): void {
  mountedCounts.set(id, count);
}

export function clearBadgeCount(id: string): void {
  mountedCounts.delete(id);
}

function remainingUnread(): number {
  return Math.max(0, ...mountedCounts.values());
}

/**
 * The current `document.title` with the prefix for `count`. The base is read at the moment of each
 * write, never cached: pages change the title (usePageTitle, Next metadata) while the shell's
 * instance stays mounted, so any remembered copy would revert to a stale page's title.
 */
export function withUnreadPrefix(count: number): string {
  const base = document.title.replace(UNREAD_PREFIX, "");
  return count > 0 ? `(${count}) ${base}` : base;
}

/** `document.title` re-prefixed for the badge instances that are still mounted. */
export function applyRemainingBadge(): string {
  return withUnreadPrefix(remainingUnread());
}

/**
 * Sets the title to `baseTitle`, prefixed with the unread count the still-mounted instances show.
 * For a page's title cleanup, which must not wipe a badge that outlives the page.
 */
export function restoreTitle(baseTitle: string): void {
  const count = remainingUnread();
  document.title = count > 0 ? `(${count}) ${baseTitle}` : baseTitle;
}
