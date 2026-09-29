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
  type UserPageHistory,
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
  fetchUserPageHistory: (source: ProofSource, username: string) => Promise<UserPageHistory>;
  now?: () => Date;
  newToken?: () => string;
}

type WikiLinkDb = Pick<PrismaClient, "wikiAccountLink" | "user" | "$transaction">;
/** Shape a transaction client needs to expose for the legacy-column writes below. */
type WikiLinkTx = Pick<PrismaClient, "wikiAccountLink" | "user">;

export interface WikiLinkView {
  source: string;
  username: string;
  verified: boolean;
  pending: boolean;
}

type TokenProof = "SAVED_BY_ACCOUNT" | "NOT_ON_PAGE" | "SAVED_BY_SOMEONE_ELSE" | "OUT_OF_REACH";

/**
 * Ruling F-3 — who saved the token. The newest revision must contain it; walking back, the revision that
 * INTRODUCED it is the oldest of that unbroken run (its older neighbour lacks the token, or it created the page).
 * A run that reaches past the fetched window cannot be attributed.
 */
function proveToken(history: UserPageHistory, token: string, username: string): TokenProof {
  const { revisions, complete } = history;
  const runEnd = revisions.findIndex((revision) => !revision.content.includes(token));
  if (revisions.length === 0 || runEnd === 0) return "NOT_ON_PAGE";
  if (runEnd === -1 && !complete) return "OUT_OF_REACH";
  const introducer = revisions[runEnd === -1 ? revisions.length - 1 : runEnd - 1];
  return introducer?.author === username ? "SAVED_BY_ACCOUNT" : "SAVED_BY_SOMEONE_ELSE";
}

async function wikiCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new WikiLinkError("WIKI_UNREACHABLE", "The wiki could not be reached. Try again in a few minutes.");
  }
}

/** Legacy `User.wikiUsername`/`wikiUserId` columns (45 readers) — kept in sync with ixwiki links only.
 *  A squatter's unverified legacy link loses to the proven/authoritative owner. */
async function syncIxwikiLegacyColumns(
  tx: WikiLinkTx,
  userId: string,
  username: string,
  wikiUserId: number | null,
  verifiedAt: Date
): Promise<void> {
  await tx.user.updateMany({
    where: { wikiUsername: username, id: { not: userId } },
    data: { wikiUsername: null, wikiUserId: null },
  });
  await tx.user.update({
    where: { id: userId },
    data: { wikiUsername: username, wikiUserId, lastWikiSync: verifiedAt },
  });
}

export function createWikiLinkService(db: WikiLinkDb, deps: WikiLinkDeps) {
  const now = deps.now ?? (() => new Date());
  const newToken = deps.newToken ?? (() => `ixstates-verify-${randomBytes(5).toString("hex")}`);

  async function start(userId: string, source: ProofSource, rawUsername: string) {
    const wikiUser = await wikiCall(() => deps.fetchWikiUser(source, rawUsername));
    if (!wikiUser) throw new WikiLinkError("WIKI_USER_NOT_FOUND", `No ${source} user named "${rawUsername}"`);
    const username = normalizeWikiUsername(wikiUser.username);
    const token = newToken();
    const expiresAt = new Date(now().getTime() + TOKEN_TTL_MS);
    await db.$transaction(async (tx) => {
      // Re-check the holder inside the transaction: a verified row can only ever be taken over via
      // confirm's proof-of-ownership check, never here, however narrow the window looked outside a tx.
      const holder = await tx.wikiAccountLink.findUnique({ where: { source_username: { source, username } } });
      if (holder && holder.userId !== userId && holder.verifiedAt) {
        throw new WikiLinkError("TAKEN", `${username} is already verified by another player`);
      }
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
    const history = await wikiCall(() => deps.fetchUserPageHistory(source, link.username));
    const proof = proveToken(history, token, link.username);
    if (proof === "OUT_OF_REACH") {
      throw new WikiLinkError("TOKEN_NOT_FOUND", "Save the code on your user page yourself, then press Verify");
    }
    if (proof !== "SAVED_BY_ACCOUNT") {
      throw new WikiLinkError(
        "TOKEN_NOT_FOUND",
        `The code must be saved on User:${link.username} by ${link.username} themself`
      );
    }
    await db.$transaction(async (tx) => {
      const verifiedAt = now();
      // Re-check owner + token atomically: a concurrent start() may have re-owned this row (new
      // token) while we were waiting on the wiki fetch above.
      const claimed = await tx.wikiAccountLink.updateMany({
        where: { id: link.id, userId, token, verifiedAt: null },
        data: { verifiedAt, token: null, tokenExpiresAt: null },
      });
      if (claimed.count !== 1) {
        throw new WikiLinkError("NO_PENDING", "Your verification changed — start again");
      }
      if (source === "ixwiki") {
        await syncIxwikiLegacyColumns(tx, userId, link.username, link.wikiUserId, verifiedAt);
      }
    });
    return { username: link.username };
  }

  /**
   * Admin-confirmed link: the admin's authority is the proof, not a token. Used only by the admin
   * user-management router, never reachable from self-service `linkWiki`.
   */
  async function adminVerify(
    userId: string,
    source: ProofSource,
    rawUsername: string,
    wikiUserId: number | null
  ): Promise<{ username: string }> {
    const username = normalizeWikiUsername(rawUsername);
    const verifiedAt = now();
    await db.$transaction(async (tx) => {
      const holder = await tx.wikiAccountLink.findUnique({ where: { source_username: { source, username } } });
      if (holder && holder.userId !== userId && holder.verifiedAt) {
        throw new WikiLinkError("TAKEN", `${username} is already verified by another player`);
      }
      await tx.wikiAccountLink.deleteMany({ where: { userId, source, NOT: { username } } });
      await tx.wikiAccountLink.upsert({
        where: { source_username: { source, username } },
        update: { userId, wikiUserId, verifiedAt, token: null, tokenExpiresAt: null },
        create: { userId, source, username, wikiUserId, verifiedAt },
      });
      if (source === "ixwiki") {
        await syncIxwikiLegacyColumns(tx, userId, username, wikiUserId, verifiedAt);
      }
    });
    return { username };
  }

  async function unlink(userId: string, source: ProofSource): Promise<void> {
    await db.$transaction(async (tx) => {
      await tx.wikiAccountLink.deleteMany({ where: { userId, source } });
      if (source === "ixwiki") {
        await tx.user.update({ where: { id: userId }, data: { wikiUsername: null, wikiUserId: null, lastWikiSync: null } });
      }
    });
  }

  /** `pending` only while the code can still be confirmed — an expired one offers a fresh start (ruling F-4). */
  async function list(userId: string): Promise<WikiLinkView[]> {
    const links = await db.wikiAccountLink.findMany({ where: { userId }, orderBy: { source: "asc" } });
    const at = now();
    return links.map((l) => ({
      source: l.source,
      username: l.username,
      verified: !!l.verifiedAt,
      pending: !!l.token && !!l.tokenExpiresAt && l.tokenExpiresAt > at,
    }));
  }

  return { start, confirm, unlink, list, adminVerify };
}
