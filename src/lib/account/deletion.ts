/**
 * Account deletion (Privacy 5.2): the grace period between a request and the erasure, the sentinel an erased account
 * keeps in place of its Clerk id, and the name its public content is credited to afterwards. Pure: the router
 * (users/account-deletion.ts) and the erasure (server/orchestration/account-erasure.ts) share these.
 */

/** Days between a deletion request and the erasure; the user may cancel until then. */
export const ACCOUNT_DELETION_GRACE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;
/** Every erased account's `User.clerkUserId` starts with this; no Clerk id does. */
export const ERASED_CLERK_ID_PREFIX = "erased:";

/** Who public posts, personas and forum posts of an erased account are credited to (Terms 2.9, 6.1). */
export const FORMER_MEMBER = "a former member";

/** When a request made at `requestedAt` is erased; null when none is pending. */
export function erasesAt(requestedAt: Date | null): Date | null {
  return requestedAt
    ? new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS)
    : null;
}

/** Whether a request made at `requestedAt` is past its grace at `now`. */
export function isDue(requestedAt: Date | null, now: Date): boolean {
  const at = erasesAt(requestedAt);
  return at !== null && at.getTime() <= now.getTime();
}

/** Requests made at or before this instant are due at `now`. */
export function requestedBefore(now: Date): Date {
  return new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);
}

/** The value an erased account keeps in `User.clerkUserId` (and in columns that named it): never a Clerk id. */
export function erasedClerkId(userId: string): string {
  return `${ERASED_CLERK_ID_PREFIX}${userId}`;
}

export function isErasedClerkId(clerkUserId: string): boolean {
  return clerkUserId.startsWith(ERASED_CLERK_ID_PREFIX);
}

/** A renamed persona's username: unique (from the persona's own id), and saying nothing about who held it. */
export function formerUsername(accountId: string): string {
  return `former-${accountId.slice(-8).toLowerCase()}`;
}

/** The names a user may type to confirm a deletion request. */
export interface ConfirmationNames {
  handle: string | null;
  username: string | null;
  email: string | null;
}

const normalise = (value: string) => value.trim().replace(/^@/, "").toLowerCase();

/**
 * Whether `typed` confirms the request: the Passport handle when the user has one, otherwise their Clerk username
 * or the local part of their email address. Case and a leading @ are ignored; an empty answer never matches.
 */
export function confirmationMatches(typed: string, names: ConfirmationNames): boolean {
  const answer = normalise(typed);
  if (!answer) return false;
  const accepted = names.handle
    ? [names.handle]
    : [names.username, names.email?.split("@")[0]].filter((n): n is string => !!n);
  return accepted.some((name) => normalise(name) === answer);
}
