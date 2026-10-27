import { api } from "~/trpc/react";
import { type PublicCosmetics } from "~/lib/vault/public-cosmetics";

const STALE_MS = 60_000;

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
