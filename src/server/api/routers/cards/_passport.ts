import { loadPassportSettings } from "~/server/modules/identity/identity.privacy";

/**
 * Whether a player shows their Vault cards on their passport: the master switch for their showcases and displays
 * (spec §2.3 Other surfaces). Card routers pass it into `src/lib/cards/hub`, which may not import server modules.
 */
export async function vaultVisible(userId: string): Promise<boolean> {
  return (await loadPassportSettings(userId)).visibility.vaultCards;
}
