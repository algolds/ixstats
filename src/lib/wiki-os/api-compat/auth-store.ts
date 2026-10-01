/**
 * auth-store.ts — the Prisma side of bot-password logins (plan 410): `WikiBotPassword`,
 * `WikiApiSession`, and the WikiOS user a session or a browser login names.
 *
 * A user is known to api.php by their VERIFIED wiki link (`WikiAccountLink`): the bot logs in as that
 * wiki name, and a save is attributed to it. Nobody without a verified link can log in.
 */

import { db } from "~/server/db";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import type { AuthStore, SessionUser } from "./types";

/**
 * A user id for the account when MediaWiki never told WikiOS theirs: a stable number in
 * 1,000,000,000..1,999,999,999 (FNV-1a of the WikiOS user id), above any real MediaWiki id. Bots
 * treat id 0 as "not logged in", so a logged-in account must never report it.
 */
export function syntheticUserId(userId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 1_000_000_000 + (hash % 1_000_000_000);
}

/** The user `userId` with their verified wiki name, as the permission services read them; null without a verified link. */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const [user, link] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clerkUserId: true,
        createdAt: true,
        role: { select: { id: true, name: true, level: true } },
      },
    }),
    db.wikiAccountLink.findFirst({
      where: { userId, source: "ixwiki", verifiedAt: { not: null } },
      select: { username: true, wikiUserId: true },
    }),
  ]);
  if (!user || !link) return null;
  return {
    name: link.username,
    mwUserId: link.wikiUserId ?? syntheticUserId(user.id),
    ctx: {
      auth: { userId: user.clerkUserId },
      user: {
        id: user.id,
        clerkUserId: user.clerkUserId,
        wikiUsername: link.username,
        createdAt: user.createdAt,
        role: user.role,
      },
    },
  };
}

export const prismaAuthStore: AuthStore = {
  async findBotPassword(wikiUsername, appId) {
    const link = await db.wikiAccountLink.findFirst({
      where: {
        source: "ixwiki",
        username: normalizeWikiUsername(wikiUsername),
        verifiedAt: { not: null },
      },
      select: { userId: true },
    });
    if (!link) return null;
    const botPassword = await db.wikiBotPassword.findUnique({
      where: { userId_appId: { userId: link.userId, appId } },
      select: { id: true, userId: true, appId: true, passwordHash: true, grants: true },
    });
    const user = botPassword ? await loadSessionUser(link.userId) : null;
    return botPassword && user ? { botPassword, user } : null;
  },

  async touchBotPassword(id, usedAt) {
    await db.wikiBotPassword.update({ where: { id }, data: { lastUsedAt: usedAt }, select: { id: true } });
  },

  async createSession(input) {
    await db.wikiApiSession.create({ data: input, select: { id: true } });
  },

  async findSession(id) {
    const session = await db.wikiApiSession.findUnique({
      where: { id },
      select: {
        id: true,
        botPasswordId: true,
        userId: true,
        expiresAt: true,
        botPassword: { select: { grants: true } },
      },
    });
    if (!session) return null;
    const user = await loadSessionUser(session.userId);
    if (!user) return null;
    const { botPassword, ...rest } = session;
    return { session: { ...rest, grants: botPassword.grants }, user };
  },

  async extendSession(id, expiresAt) {
    await db.wikiApiSession.updateMany({ where: { id }, data: { expiresAt } });
  },

  async pruneSessions(botPasswordId, now, keep) {
    await db.wikiApiSession.deleteMany({ where: { expiresAt: { lt: now } } });
    const surplus = await db.wikiApiSession.findMany({
      where: { botPasswordId },
      orderBy: { createdAt: "desc" },
      skip: keep,
      take: 1000,
      select: { id: true },
    });
    if (surplus.length > 0) {
      await db.wikiApiSession.deleteMany({ where: { id: { in: surplus.map((row) => row.id) } } });
    }
  },

  async deleteSession(id) {
    await db.wikiApiSession.deleteMany({ where: { id } });
  },

  async findWebUser(authId) {
    const user = await db.user.findUnique({ where: { clerkUserId: authId }, select: { id: true } });
    return user ? loadSessionUser(user.id) : null;
  },
};
