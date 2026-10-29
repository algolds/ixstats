/**
 * Presence-only mirror of the play-as localStorage entry. A server component cannot read localStorage
 * and its request never carries the `x-play-as-user` header, so it reads this cookie to know play-as
 * is active and skip prefetching data that would be the staff member's own. The value is never an
 * identity: the player is still named by the localStorage entry the tRPC client sends as a header.
 * `path=/` also covers the production base path.
 */
export const PLAY_AS_COOKIE = "ixstats_play_as";

/** Call next to every write (`true`) or removal (`false`) of the `ixstats.play_as_user` localStorage entry. */
export function setPlayAsCookie(active: boolean): void {
  document.cookie = active
    ? `${PLAY_AS_COOKIE}=1; path=/; SameSite=Lax`
    : `${PLAY_AS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
