/**
 * ThinkTank invite privacy: which users may be invited by a given inviter.
 *
 * Honors the invitee's `thinktankInvites` preference ("everyone" | "followers" | "nobody", stored
 * in the JSON `privacy_config` UserConnection row, see users/preferences.ts) and their block list.
 * "followers" means the inviter's country follows the invitee's country (CountryFollow).
 */
import type { PrismaClient } from "@prisma/client";

type InviteDb = Pick<PrismaClient, "userConnection" | "user" | "countryFollow">;

type InvitePref = "everyone" | "followers" | "nobody";

async function loadPrefs(db: InviteDb, userIds: string[]) {
  const rows = await db.userConnection.findMany({
    where: {
      userId: { in: userIds },
      targetUserId: "global_privacy",
      connectionType: "privacy_config",
    },
    select: { userId: true, status: true },
  });
  const prefs = new Map<string, { invites: InvitePref; discoverable: boolean }>();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.status) as {
        thinktankInvites?: InvitePref;
        searchDiscoverable?: boolean;
      };
      prefs.set(row.userId, {
        invites: parsed.thinktankInvites ?? "everyone",
        discoverable: parsed.searchDiscoverable !== false,
      });
    } catch {
      // Unparseable config falls back to the defaults.
    }
  }
  return prefs;
}

/**
 * Filter `candidateIds` (Clerk user IDs) down to users the inviter is allowed to invite.
 * Inactive/unknown users, users who blocked the inviter and users whose privacy settings
 * disallow the invite are dropped. With `forSearch`, users hidden from search are dropped too.
 */
export async function filterInvitableUserIds(
  db: InviteDb,
  inviter: { clerkUserId: string; dbUserId?: string | null },
  candidateIds: string[],
  opts: { forSearch?: boolean } = {}
): Promise<string[]> {
  if (candidateIds.length === 0) return [];

  const [users, prefs, blocks, inviterRow] = await Promise.all([
    db.user.findMany({
      where: { clerkUserId: { in: candidateIds }, isActive: true },
      select: { clerkUserId: true, countryId: true },
    }),
    loadPrefs(db, candidateIds),
    db.userConnection.findMany({
      where: {
        userId: { in: candidateIds },
        connectionType: "blocked",
        targetUserId: {
          in: [inviter.clerkUserId, ...(inviter.dbUserId ? [inviter.dbUserId] : [])],
        },
      },
      select: { userId: true },
    }),
    db.user.findUnique({
      where: { clerkUserId: inviter.clerkUserId },
      select: { countryId: true },
    }),
  ]);

  const blockedBy = new Set(blocks.map((b) => b.userId));
  const activeUsers = new Map(users.map((u) => [u.clerkUserId, u.countryId]));

  // Countries following the invitee's country, only needed for "followers" preferences.
  const followerNeeded = candidateIds.filter(
    (id) => activeUsers.has(id) && prefs.get(id)?.invites === "followers"
  );
  const followedCountryIds = new Set<string>();
  if (followerNeeded.length > 0 && inviterRow?.countryId) {
    const follows = await db.countryFollow.findMany({
      where: { followerCountryId: inviterRow.countryId },
      select: { followedCountryId: true },
    });
    for (const f of follows) followedCountryIds.add(f.followedCountryId);
  }

  return candidateIds.filter((id) => {
    if (!activeUsers.has(id) || blockedBy.has(id)) return false;
    const pref = prefs.get(id);
    if (opts.forSearch && pref && !pref.discoverable) return false;
    switch (pref?.invites ?? "everyone") {
      case "nobody":
        return false;
      case "followers": {
        const countryId = activeUsers.get(id);
        return Boolean(countryId && followedCountryIds.has(countryId));
      }
      default:
        return true;
    }
  });
}
