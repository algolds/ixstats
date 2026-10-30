/**
 * Presence-only mirror of the play-as localStorage entry. A server component cannot read localStorage
 * and its request never carries the `x-play-as-user` header, so it reads this cookie to know play-as
 * is active and skip prefetching data that would be the staff member's own. The value is never an
 * identity: the player is still named by the localStorage entry the tRPC client sends as a header.
 * `path=/` also covers the production base path. It lives a year, as long as the localStorage entry.
 */
export const PLAY_AS_COOKIE = "ixstats_play_as";
const STORAGE_KEY = "ixstats.play_as_user";
const ONE_YEAR_SECONDS = 31_536_000;

/** Call next to every write (`true`) or removal (`false`) of the `ixstats.play_as_user` localStorage entry. */
export function setPlayAsCookie(active: boolean): void {
  document.cookie = active
    ? `${PLAY_AS_COOKIE}=1; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`
    : `${PLAY_AS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Brings the cookie in line with localStorage on load: a browser restart or a play-as entry from before
 * the cookie existed leaves the entry without it. Writes only when the two disagree.
 */
export function syncPlayAsCookie(): void {
  try {
    const active = !!localStorage.getItem(STORAGE_KEY);
    const present = document.cookie.split("; ").some((c) => c.startsWith(`${PLAY_AS_COOKIE}=`));
    if (active !== present) setPlayAsCookie(active);
  } catch {
    // Storage or cookies are blocked: the server keeps prefetching, as before.
  }
}
