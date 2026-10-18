/**
 * The unread rule (docs/superpowers/specs/2026-10-10-thinkpages-forum-unread-notifications-design.md, sections 1 and
 * 2), pure so the server and the tests share it. A thread is unread for a member when its last post is newer than the
 * later of what they read of it and thirty days ago. A thread older than the window never
 * counts, which keeps the read table bounded and stops a new member seeing the whole archive as unread.
 */
export const UNREAD_WINDOW_DAYS = 30;
export const UNREAD_WINDOW_MS = UNREAD_WINDOW_DAYS * 24 * 60 * 60 * 1000;
/** The sidebar shows counts up to this and then "99+"; the server clamps one above it. */
export const NAV_COUNT_CAP = 99;

/** The time a thread's last post must be after to count as unread at all: 30 days back. */
export function unreadFloor(now: Date): Date {
  return new Date(now.getTime() - UNREAD_WINDOW_MS);
}

/** What a member has seen of a thread: the later of what they read of it and the cutoff floor. */
export function seenSince(readAt: Date | null | undefined, floor: Date): Date {
  return readAt && readAt > floor ? readAt : floor;
}

export function isUnread(
  lastPostAt: Date,
  readAt: Date | null | undefined,
  floor: Date
): boolean {
  return lastPostAt > seenSince(readAt, floor);
}

/** A badge count as the server sends it: exact up to the cap, then one above it, which the UI shows as "99+". */
export function capCount(count: number): number {
  return Math.min(count, NAV_COUNT_CAP + 1);
}

export function countLabel(count: number): string {
  return count > NAV_COUNT_CAP ? `${NAV_COUNT_CAP}+` : String(count);
}
