import { useCallback, useMemo } from "react";
import { api } from "~/trpc/react";
import { MAX_PUBLIC_COSMETICS_LOOKUP, type PublicCosmetics } from "~/lib/vault/public-cosmetics";

const STALE_MS = 60_000;

/** Distinct, sorted and capped, so the query key is stable across renders and refetches. */
function lookupKeys<T extends string | number>(ids: ReadonlyArray<T | null | undefined>): T[] {
  const distinct = [...new Set(ids.filter((id): id is T => id !== null && id !== undefined))];
  distinct.sort((a, b) => String(a).localeCompare(String(b)));
  return distinct.slice(0, MAX_PUBLIC_COSMETICS_LOOKUP);
}

/**
 * Another player's equipped cosmetics, as everyone sees them (VT-12). `userId` is the internal
 * `User.id` or the Clerk id. Null while loading or when nothing is equipped.
 */
export function useUserCosmetics(userId: string | null | undefined): PublicCosmetics | null {
  const { data } = api.vault.getEquippedCosmeticsFor.useQuery(
    { userIds: userId ? [userId] : [] },
    { enabled: Boolean(userId), staleTime: STALE_MS }
  );
  return (userId && data?.users[userId]) || null;
}

/**
 * Equipped cosmetics for every forum author on a page, in one request. Returns a lookup by
 * XenForo user id (null when the author has nothing equipped or no linked account).
 */
export function useForumAuthorCosmetics(
  forumUserIds: ReadonlyArray<number | null | undefined>
): (forumUserId: number | null | undefined) => PublicCosmetics | null {
  const keys = useMemo(() => lookupKeys(forumUserIds), [forumUserIds]);
  const { data } = api.vault.getEquippedCosmeticsFor.useQuery(
    { forumUserIds: keys },
    { enabled: keys.length > 0, staleTime: STALE_MS }
  );
  const byForumUser = data?.forumUsers;
  return useCallback(
    (forumUserId) =>
      forumUserId === null || forumUserId === undefined
        ? null
        : (byForumUser?.[String(forumUserId)] ?? null),
    [byForumUser]
  );
}
