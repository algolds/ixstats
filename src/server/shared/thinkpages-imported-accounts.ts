/**
 * ThinkPages accounts the IxTwitter Discord sync (`~/lib/discord/ixtwitter-sync`) creates.
 *
 * The sync mirrors every IxTwitter poster and every `@handle` they post as into a ThinkPages
 * account owned by a synthetic Clerk id (`system_ixtwitter_<discord name>` or
 * `system_ixtwitter_handle_<handle>`). Those rows hold the unique username, so without a claim
 * path any name ever used on IxTwitter is unavailable to a real member forever.
 *
 * An unclaimed imported account is therefore claimable: creating a persona with its username
 * transfers the row (and its post history) to the member instead of failing. Imports tied to a
 * known nation (`verified`, set by the sync for mapped Discord users) may only be claimed for that
 * same nation; "Former Nation" imports (unverified, parked on a placeholder country) are open.
 */

/** The synthetic Clerk id prefix every IxTwitter-imported account carries until it is claimed. */
import type { PrismaClient } from "@prisma/client";

export const IXTWITTER_IMPORT_OWNER_PREFIX = "system_ixtwitter_";

/** True when the account was made by the IxTwitter sync and no member has claimed it yet. */
export function isUnclaimedImportedAccount(account: { clerkUserId: string }): boolean {
  return account.clerkUserId.startsWith(IXTWITTER_IMPORT_OWNER_PREFIX);
}

/**
 * Whether a member creating a persona for `targetCountryId` may claim this imported account.
 * Without a target country (the public availability check before a country is known) only
 * nation-agnostic imports count as claimable.
 */
export function canClaimImportedAccount(
  account: { clerkUserId: string; countryId: string | null; verified: boolean },
  targetCountryId?: string | null
): boolean {
  if (!isUnclaimedImportedAccount(account)) return false;
  if (!account.verified) return true;
  return !!targetCountryId && account.countryId === targetCountryId;
}

type AccountDb = Pick<PrismaClient, "thinkpagesAccount">;

/**
 * The sync's own account for a Discord poster: matched by username or by the `discord:<name>` bio tag,
 * and only while still sync-owned, since a claimed account is its member's and no longer the poster's.
 */
export function findSyncPosterAccount(db: AccountDb, discordUsername: string) {
  return db.thinkpagesAccount.findFirst({
    where: {
      clerkUserId: { startsWith: IXTWITTER_IMPORT_OWNER_PREFIX },
      OR: [{ username: discordUsername }, { bio: { contains: `discord:${discordUsername}` } }],
    },
  });
}

/** The username to mirror a poster under: their own, or `<name>_ixtwitter` once a member holds it. */
export async function posterMirrorUsername(db: AccountDb, discordUsername: string): Promise<string> {
  const taken = await db.thinkpagesAccount.findUnique({
    where: { username: discordUsername },
    select: { id: true },
  });
  return taken ? `${discordUsername}_ixtwitter` : discordUsername;
}
