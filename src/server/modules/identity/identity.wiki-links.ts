/**
 * Verified wiki accounts. A link is trusted only after the user places a one-time token on their wiki
 * user page (proves control of the account). Only verified links count for realm claim auto-approval.
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  normalizeWikiUsername,
  wikiUserPageUrl,
  type ProofSource,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export type WikiLinkErrorCode =
  | "TAKEN"
  | "WIKI_USER_NOT_FOUND"
  | "NO_PENDING"
  | "EXPIRED"
  | "TOKEN_NOT_FOUND"
  | "WIKI_UNREACHABLE";

export class WikiLinkError extends Error {
  constructor(
    public readonly code: WikiLinkErrorCode,
    message: string
  ) {
    super(message);
    this.name = "WikiLinkError";
  }
}

export interface WikiLinkDeps {
  fetchWikiUser: (source: ProofSource, username: string) => Promise<{ username: string; userId: number } | null>;
  fetchUserPageWikitext: (source: ProofSource, username: string) => Promise<string | null>;
  now?: () => Date;
  newToken?: () => string;
}

type WikiLinkDb = Pick<PrismaClient, "wikiAccountLink" | "user" | "$transaction">;

export interface WikiLinkView {
  source: string;
  username: string;
  verified: boolean;
  pending: boolean;
}

async function wikiCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new WikiLinkError("WIKI_UNREACHABLE", "The wiki could not be reached. Try again in a few minutes.");
  }
}

export function createWikiLinkService(db: WikiLinkDb, deps: WikiLinkDeps) {
  const now = deps.now ?? (() => new Date());
  const newToken = deps.newToken ?? (() => `ixstates-verify-${randomBytes(5).toString("hex")}`);

  async function start(userId: string, source: ProofSource, rawUsername: string) {
    const wikiUser = await wikiCall(() => deps.fetchWikiUser(source, rawUsername));
    if (!wikiUser) throw new WikiLinkError("WIKI_USER_NOT_FOUND", `No ${source} user named "${rawUsername}"`);
    const username = normalizeWikiUsername(wikiUser.username);
    const holder = await db.wikiAccountLink.findUnique({ where: { source_username: { source, username } } });
    if (holder && holder.userId !== userId && holder.verifiedAt) {
      throw new WikiLinkError("TAKEN", `${username} is already verified by another player`);
    }
    const token = newToken();
    const expiresAt = new Date(now().getTime() + TOKEN_TTL_MS);
    await db.$transaction(async (tx) => {
      // A user holds one link per wiki; an unverified squat on this username is taken over.
      await tx.wikiAccountLink.deleteMany({ where: { userId, source, NOT: { username } } });
      await tx.wikiAccountLink.upsert({
        where: { source_username: { source, username } },
        update: { userId, wikiUserId: wikiUser.userId, token, tokenExpiresAt: expiresAt, verifiedAt: null },
        create: { userId, source, username, wikiUserId: wikiUser.userId, token, tokenExpiresAt: expiresAt },
      });
    });
    return { token, username, expiresAt, userPageUrl: wikiUserPageUrl(source, username) };
  }

  async function confirm(userId: string, source: ProofSource): Promise<{ username: string }> {
    const link = await db.wikiAccountLink.findUnique({ where: { userId_source: { userId, source } } });
    if (!link?.token || link.verifiedAt) throw new WikiLinkError("NO_PENDING", "Start verification first");
    if (!link.tokenExpiresAt || link.tokenExpiresAt < now()) {
      throw new WikiLinkError("EXPIRED", "That code expired — request a new one");
    }
    const token = link.token;
    const wikitext = await wikiCall(() => deps.fetchUserPageWikitext(source, link.username));
    if (!wikitext?.includes(token)) {
      throw new WikiLinkError("TOKEN_NOT_FOUND", `The code was not found on User:${link.username}`);
    }
    await db.$transaction(async (tx) => {
      await tx.wikiAccountLink.update({
        where: { id: link.id },
        data: { verifiedAt: now(), token: null, tokenExpiresAt: null },
      });
      if (source === "ixwiki") {
        // Legacy columns (45 readers). A squatter's unverified legacy link loses to the proven owner.
        await tx.user.updateMany({
          where: { wikiUsername: link.username, id: { not: userId } },
          data: { wikiUsername: null, wikiUserId: null },
        });
        await tx.user.update({
          where: { id: userId },
          data: { wikiUsername: link.username, wikiUserId: link.wikiUserId, lastWikiSync: now() },
        });
      }
    });
    return { username: link.username };
  }

  async function unlink(userId: string, source: ProofSource): Promise<void> {
    await db.$transaction(async (tx) => {
      await tx.wikiAccountLink.deleteMany({ where: { userId, source } });
      if (source === "ixwiki") {
        await tx.user.update({ where: { id: userId }, data: { wikiUsername: null, wikiUserId: null, lastWikiSync: null } });
      }
    });
  }

  async function list(userId: string): Promise<WikiLinkView[]> {
    const links = await db.wikiAccountLink.findMany({ where: { userId }, orderBy: { source: "asc" } });
    return links.map((l) => ({ source: l.source, username: l.username, verified: !!l.verifiedAt, pending: !!l.token }));
  }

  return { start, confirm, unlink, list };
}
