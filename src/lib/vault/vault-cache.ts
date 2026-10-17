import { globalCache } from "~/lib/cache";

/** Drop the cached vault stats and balances (keyed by both DB and Clerk id) of the given users. */
export async function clearVaultCaches(
  ...users: Array<{ id: string; clerkUserId?: string | null }>
): Promise<void> {
  await Promise.all(
    users.flatMap((user) => [
      globalCache.delete(`user_vault_stats:${user.id}`),
      globalCache.delete(`user_vault_balance:${user.id}`),
      ...(user.clerkUserId ? [globalCache.delete(`user_vault_balance:${user.clerkUserId}`)] : []),
    ])
  );
}
