import { loadPassportSettings } from "~/server/modules/identity/identity.privacy";
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
