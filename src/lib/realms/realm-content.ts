/**
 * Realm content terms (ToS §2.6 to §2.8, docs/specs/2026-10-11-realm-content-licensing-drafts.md): the version a
 * claim's consent records, the removal and reclaim deadlines, and when an inactive nation is warned and released.
 * Pure and client-safe.
 */
import { DEFAULT_REALM_ID } from "./realm-ids";

/** Stored on each claim; bump it when §2.6 changes so old consents stay distinguishable. */
export const REALM_CONTENT_TERMS_VERSION = "realm-content-1";

const DAY_MS = 86_400_000;
/** §2.7: material of a nation its holder released comes down within 30 days (restorable by them until then). */
export const RELEASE_REMOVAL_DAYS = 30;
/** §2.8(c): an inactive nation's former holder may reclaim it, material restored, for 180 days. */
export const RECLAIM_WINDOW_DAYS = 180;
/** §2.8(a): the holder is warned at least 14 days before release. */
export const INACTIVITY_NOTICE_DAYS = 14;
/** §2.8: the default period, and the range a realm's rules may set. */
export const INACTIVITY_DEFAULT_DAYS = 90;
export const INACTIVITY_MIN_DAYS = 30;
export const INACTIVITY_MAX_DAYS = 365;

export type HoldReason = "released" | "inactive";

/** When a hold made at `now` is purged. */
export function holdPurgeAfter(reason: HoldReason, now: Date): Date {
  const days = reason === "inactive" ? RECLAIM_WINDOW_DAYS : RELEASE_REMOVAL_DAYS;
  return new Date(now.getTime() + days * DAY_MS);
}

function isRealmObject(settings: unknown): settings is Record<string, unknown> {
  return !!settings && typeof settings === "object" && !Array.isArray(settings);
}

/**
 * The realm's inactivity period in days, or null when inactivity release is off. `settings.inactivityDays`: a
 * whole number in range sets it, `null` turns it off. Unset, every realm uses the default except Ixnay (the
 * platform's own world), which opts in by setting it.
 */
export function realmInactivityDays(realmId: string, settings: unknown): number | null {
  const stored = isRealmObject(settings) ? settings.inactivityDays : undefined;
  if (stored === undefined) return realmId === DEFAULT_REALM_ID ? null : INACTIVITY_DEFAULT_DAYS;
  if (stored === null) return null;
  if (
    typeof stored === "number" &&
    Number.isInteger(stored) &&
    stored >= INACTIVITY_MIN_DAYS &&
    stored <= INACTIVITY_MAX_DAYS
  )
    return stored;
  return INACTIVITY_DEFAULT_DAYS;
}

/** §2.8(c): whether the realm keeps an inactive nation for its former holder during the reclaim window. */
export function realmReclaimWindowExclusive(settings: unknown): boolean {
  return isRealmObject(settings) && settings.reclaimWindowExclusive === true;
}

export type InactivityStep = "none" | "reset" | "notify" | "wait" | "release";

/**
 * What the daily job does with one held nation. Activity is the owner's `lastSeenAt` (touched at most daily on
 * any signed-in request). An owner never seen is left alone: there is no evidence they went quiet.
 */
export function inactivityStep(input: {
  lastSeenAt: Date | null;
  noticeAt: Date | null;
  now: Date;
  days: number;
}): InactivityStep {
  const { lastSeenAt, noticeAt, now, days } = input;
  if (!lastSeenAt) return "none";
  const inactive = lastSeenAt.getTime() < now.getTime() - days * DAY_MS;
  if (!inactive) return noticeAt ? "reset" : "none";
  if (!noticeAt) return "notify";
  return now.getTime() - noticeAt.getTime() >= INACTIVITY_NOTICE_DAYS * DAY_MS ? "release" : "wait";
}

/** The release date a notice sent at `noticeAt` names. */
export function inactivityReleaseDate(noticeAt: Date): Date {
  return new Date(noticeAt.getTime() + INACTIVITY_NOTICE_DAYS * DAY_MS);
}
