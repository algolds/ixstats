import type { HubPlayer } from "~/lib/cards/hub/players";
import { db } from "~/server/db";
import { loadPassportHandle } from "~/server/modules/identity/identity.passport-handle";
import {
  loadPassportSettings,
  loadVaultCardsShown,
} from "~/server/modules/identity/identity.privacy";
import { resolveHandleUser } from "~/server/modules/identity/identity.resolve";

/**
 * Whether a player shows their Vault cards on their passport: the master switch for their showcases and displays
 * (spec §2.3 Other surfaces). Card routers pass it into `src/lib/cards/hub`, which may not import server modules.
 */
export async function vaultVisible(userId: string): Promise<boolean> {
  return (await loadPassportSettings(userId)).visibility.vaultCards;
}

/**
 * The user a `from=holder.<handle>` names: the stored handle, else the wiki name, forum name or Clerk id that
 * `passportHandleOf` falls back to (it only emits a name that resolves back to its user). Null when it names nobody
 * or the lookup fails, so the sheet keeps its silhouette.
 */
export async function holderOf(handle: string): Promise<string | null> {
  const user = await resolveHandleUser(handle).catch(() => null);
  return user?.id ?? null;
}

/**
 * The players a card surface names, in one batch: one user read and one passport read for all of them, then each
 * passport handle (`loadPassportHandle`, which reads nothing more for a stored handle). A user who no longer exists is
 * left out.
 */
export async function playersOf(userIds: readonly string[]): Promise<Map<string, HubPlayer>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const [users, shown] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, clerkUserId: true, handle: true, forumUsername: true },
    }),
    loadVaultCardsShown(ids),
  ]);
  const named = await Promise.all(
    users.map(async (user): Promise<[string, HubPlayer]> => [
      user.id,
      { handle: await loadPassportHandle(user), showsVault: shown.has(user.id) },
    ])
  );
  return new Map(named);
}
