/**
 * Privacy permissions the server enforces (Settings → Privacy & Security, SL-4).
 *
 * The options live in each user's JSON `privacy_config` UserConnection row (users/preferences.ts):
 *
 * - `directMessages` ("everyone" | "followers" | "verified" | "nobody"): who may start a
 *   conversation with the user or message them in a direct conversation (messaging module).
 * - `mentions` ("everyone" | "followers" | "nobody"): whose @mentions notify the user
 *   (`thinkpages.createPost`); the mention is still recorded on the post.
 * - `tradeOffers` ("everyone" | "followers" | "nobody"): who may send the user a card trade
 *   offer (`trading.createtradeOffer`).
 * - Muted words (`connectionType: "keyword"` rows): posts containing one are left out of the
 *   user's ThinkPages, activity and Following feeds.
 *
 * "followers" means the sender follows the recipient: one of the sender's ThinkPages personas
 * follows one of the recipient's (ThinkpagesFollow), or the sender's country follows the
 * recipient's country (CountryFollow, as ThinkTank invites use). "verified" means the sender
 * owns a verified ThinkPages persona. A missing or unreadable config is "everyone".
 */
import type { PrismaClient } from "@prisma/client";

export type PermissionKey = "directMessages" | "mentions" | "tradeOffers";
type Audience = "everyone" | "followers" | "verified" | "nobody";

type PrivacyDb = Pick<
  PrismaClient,
  "userConnection" | "user" | "countryFollow" | "thinkpagesFollow" | "thinkpagesAccount"
>;

const AUDIENCES = new Set<Audience>(["everyone", "followers", "verified", "nobody"]);

/** Each user's stored audience for `key` (users without a stored config are absent). */
async function loadAudiences(
  db: Pick<PrismaClient, "userConnection">,
  clerkIds: string[],
  key: PermissionKey
): Promise<Map<string, Audience>> {
  const rows = await db.userConnection.findMany({
    where: {
      userId: { in: clerkIds },
      targetUserId: "global_privacy",
      connectionType: "privacy_config",
    },
    select: { userId: true, status: true },
  });
  const audiences = new Map<string, Audience>();
  for (const row of rows ?? []) {
    try {
      const value = (JSON.parse(row.status) as Record<string, unknown>)[key];
      if (typeof value === "string" && AUDIENCES.has(value as Audience)) {
        audiences.set(row.userId, value as Audience);
      }
    } catch {
      // Unreadable config: the default ("everyone") applies.
    }
  }
  return audiences;
}

/** Which of `recipientClerkIds` the sender follows (by persona or by country). */
async function recipientsFollowedBy(
  db: PrivacyDb,
  senderClerkId: string,
  recipientClerkIds: string[]
): Promise<Set<string>> {
  const followed = new Set<string>();
  if (recipientClerkIds.length === 0) return followed;

  const [accounts, users] = await Promise.all([
    db.thinkpagesAccount.findMany({
      where: { clerkUserId: { in: recipientClerkIds } },
      select: { id: true, clerkUserId: true },
    }),
    db.user.findMany({
      where: { clerkUserId: { in: [senderClerkId, ...recipientClerkIds] } },
      select: { clerkUserId: true, countryId: true },
    }),
  ]);

  const ownerOfAccount = new Map(accounts.map((a) => [a.id, a.clerkUserId]));
  if (ownerOfAccount.size > 0) {
    const follows = await db.thinkpagesFollow.findMany({
      where: {
        followerClerkUserId: senderClerkId,
        followedAccountId: { in: [...ownerOfAccount.keys()] },
      },
      select: { followedAccountId: true },
    });
    for (const f of follows) {
      const owner = ownerOfAccount.get(f.followedAccountId);
      if (owner) followed.add(owner);
    }
  }

  const senderCountry = users.find((u) => u.clerkUserId === senderClerkId)?.countryId;
  const recipientCountries = new Map(
    users
      .filter((u) => u.clerkUserId !== senderClerkId && u.countryId)
      .map((u) => [u.clerkUserId, u.countryId!])
  );
  if (senderCountry && recipientCountries.size > 0) {
    const countryFollows = await db.countryFollow.findMany({
      where: {
        followerCountryId: senderCountry,
        followedCountryId: { in: [...new Set(recipientCountries.values())] },
      },
      select: { followedCountryId: true },
    });
    const followedCountries = new Set(countryFollows.map((f) => f.followedCountryId));
    for (const [clerkId, countryId] of recipientCountries) {
      if (followedCountries.has(countryId)) followed.add(clerkId);
    }
  }
  return followed;
}

/**
 * Which of `recipientClerkIds` do not accept `key` from the sender. The sender never refuses
 * themself.
 */
export async function recipientsRefusing(
  db: PrivacyDb,
  senderClerkId: string,
  recipientClerkIds: string[],
  key: PermissionKey
): Promise<string[]> {
  const recipients = [...new Set(recipientClerkIds)].filter((id) => id && id !== senderClerkId);
  if (recipients.length === 0) return [];
  const audiences = await loadAudiences(db, recipients, key);
  if (audiences.size === 0) return [];

  const needFollow = recipients.filter((id) => audiences.get(id) === "followers");
  const followed = needFollow.length
    ? await recipientsFollowedBy(db, senderClerkId, needFollow)
    : new Set<string>();
  const needsVerified = recipients.some((id) => audiences.get(id) === "verified");
  const senderVerified = needsVerified
    ? !!(await db.thinkpagesAccount.findFirst({
        where: { clerkUserId: senderClerkId, verified: true },
        select: { id: true },
      }))
    : false;

  return recipients.filter((id) => {
    switch (audiences.get(id) ?? "everyone") {
      case "nobody":
        return true;
      case "followers":
        return !followed.has(id);
      case "verified":
        return !senderVerified;
      default:
        return false;
    }
  });
}

/** The viewer's muted words, lower-cased. Empty for anonymous viewers. */
export async function mutedKeywords(
  db: Pick<PrismaClient, "userConnection">,
  viewerClerkId: string | null | undefined
): Promise<string[]> {
  if (!viewerClerkId) return [];
  const rows = await db.userConnection.findMany({
    where: { userId: viewerClerkId, connectionType: "keyword" },
    select: { targetUserId: true, status: true },
  });
  const words = (rows ?? [])
    .map((r) => (r.targetUserId || r.status || "").trim().toLowerCase())
    .filter((w) => w.length > 0);
  return [...new Set(words)];
}

/** Whether `text` contains any of the (lower-cased) muted words, case-insensitively. */
export function containsMutedKeyword(text: string | null | undefined, keywords: string[]): boolean {
  if (!text || keywords.length === 0) return false;
  const haystack = text.toLowerCase();
  return keywords.some((word) => haystack.includes(word));
}
