/**
 * auth-store.ts — the Prisma side of bot-password logins (plan 410): `WikiBotPassword`,
 * `WikiApiSession`, and the WikiOS user a session or a browser login names.
 *
 * A bot password belongs to the account (IxnayID design decision 11). api.php knows a user by their passport
 * handle: a bot logs in as `handle@App`, a save is signed with the handle, and an approved claimed name (hidden
 * or shown) also logs in as an alias, so bots set up under an old wiki name keep running. An account without a
 * handle cannot log in.
 */

import { db } from "~/server/db";
import { accountOfWikiName, namesOfUser } from "~/lib/identity/wiki-names";
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

/**
 * The user `userId` named by their passport handle, as the permission services read them, with their first
 * claimed name's MediaWiki id when it is known; null without a handle.
 */
export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const [user, names] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        clerkUserId: true,
        handle: true,
        createdAt: true,
        role: { select: { id: true, name: true, level: true } },
      },
    }),
    namesOfUser(db, userId),
  ]);
  if (!user?.handle) return null;
  return {
    name: user.handle,
    mwUserId: names[0]?.mwUserId ?? syntheticUserId(user.id),
    ctx: {
      auth: { userId: user.clerkUserId },
      user: {
        id: user.id,
        clerkUserId: user.clerkUserId,
        handle: user.handle,
        createdAt: user.createdAt,
        role: user.role,
      },
    },
  };
}

/**
 * The account a bot's login name stands for: the account whose handle it is, as typed; else the account
 * `accountOfWikiName` finds (an approved claim of any visibility, then the handle the name spells). The typed
 * handle comes first so a handle still logs in when another account has claimed the wiki name it spells
 * (`old_name` against `Old name`).
 */
async function accountOfLogin(loginName: string): Promise<string | null> {
  const byHandle = await db.user.findUnique({ where: { handle: loginName }, select: { id: true } });
  return byHandle?.id ?? (await accountOfWikiName(db, loginName))?.userId ?? null;
}

export const prismaAuthStore: AuthStore = {
  async findBotPassword(loginName, appId) {
    const userId = await accountOfLogin(loginName);
    if (!userId) return null;
    const botPassword = await db.wikiBotPassword.findUnique({
      where: { userId_appId: { userId, appId } },
      select: { id: true, userId: true, appId: true, passwordHash: true, grants: true },
    });
    const user = botPassword ? await loadSessionUser(userId) : null;
    return botPassword && user ? { botPassword, user } : null;
  },

  async touchBotPassword(id, usedAt) {
    await db.wikiBotPassword.update({
      where: { id },
      data: { lastUsedAt: usedAt },
      select: { id: true },
    });
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
