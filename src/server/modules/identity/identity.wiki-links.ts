/**
 * Verified sister wiki accounts (IIWiki, AltHistory). A link is trusted only after the user places a one-time token
 * on their wiki user page (proves control of the account). Only verified links count for realm claim auto-approval.
 * An old IxWiki name is not a link: it joins an account through a name claim (`identity.name-claims.ts`).
 */
import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import {
  normalizeWikiUsername,
  wikiUserPageUrl,
  type UserPageHistory,
  type WikiUser,
} from "~/lib/wiki-os/adapters/mediawiki/account-proof";
import { SISTER_READER_IDS, type SisterReaderId } from "~/lib/wiki-os/wiki-hosts";

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * The proof window opens this long before the code was issued, so a wiki clock running behind ours can't drop
 * the player's own save out of it. Safe: the random code cannot appear in any revision saved before it existed.
 */
const CLOCK_SKEW_MARGIN_MS = 5 * 60 * 1000;

type WikiLinkErrorCode =
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
  fetchWikiUser: (source: SisterReaderId, username: string) => Promise<WikiUser | null>;
  fetchUserPageHistory: (
    source: SisterReaderId,
    username: string,
    since: Date
  ) => Promise<UserPageHistory>;
  now?: () => Date;
  newToken?: () => string;
}

type WikiLinkDb = Pick<PrismaClient, "wikiAccountLink" | "$transaction">;

interface WikiLinkView {
  source: string;
  username: string;
  verified: boolean;
  pending: boolean;
}

type TokenProof = "SAVED_BY_ACCOUNT" | "NOT_ON_PAGE" | "SAVED_BY_SOMEONE_ELSE" | "UNATTRIBUTABLE";

/**
 * Rulings F-3/F-6 — who saved the token. `history` holds every revision since the code was issued, less the
 * clock-skew margin (oldest first); the code cannot exist before it was issued. The latest revision must contain it, and its FIRST appearance must
 * be the account's own — so a token planted by someone else can't be laundered by a later edit or a revert that
 * restores it. A truncated window, or any revision whose content or author is hidden, cannot be attributed.
 */
function proveToken(history: UserPageHistory, token: string, username: string): TokenProof {
  const { revisions, complete } = history;
  if (!complete || revisions.some((r) => r.content === null || r.author === null))
    return "UNATTRIBUTABLE";
  if (!revisions.at(-1)?.content?.includes(token)) return "NOT_ON_PAGE";
  const firstAppearance = revisions.find((r) => r.content?.includes(token));
  return firstAppearance?.author === username ? "SAVED_BY_ACCOUNT" : "SAVED_BY_SOMEONE_ELSE";
}

/** How a sister wiki reads in an error shown to the player. */
const SOURCE_NAME: Record<SisterReaderId, string> = {
  iiwiki: "IIWiki",
  althistory: "AltHistory",
};

async function wikiCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch {
    throw new WikiLinkError(
      "WIKI_UNREACHABLE",
      "The wiki could not be reached. Try again in a few minutes."
    );
  }
}

export function createWikiLinkService(db: WikiLinkDb, deps: WikiLinkDeps) {
  const now = deps.now ?? (() => new Date());
  const newToken = deps.newToken ?? (() => `ixstates-verify-${randomBytes(5).toString("hex")}`);

  async function start(userId: string, source: SisterReaderId, rawUsername: string) {
    const wikiUser = await wikiCall(() => deps.fetchWikiUser(source, rawUsername));
    if (!wikiUser)
      throw new WikiLinkError(
        "WIKI_USER_NOT_FOUND",
        `No ${SOURCE_NAME[source]} user named "${rawUsername}"`
      );
    const username = normalizeWikiUsername(wikiUser.username);
    const token = newToken();
    const expiresAt = new Date(now().getTime() + TOKEN_TTL_MS);
    await db.$transaction(async (tx) => {
      // Re-check the holder inside the transaction: a verified row can only ever be taken over via
      // confirm's proof-of-ownership check, never here, however narrow the window looked outside a tx.
      const holder = await tx.wikiAccountLink.findUnique({
        where: { source_username: { source, username } },
      });
      if (holder && holder.userId !== userId && holder.verifiedAt) {
        throw new WikiLinkError("TAKEN", `${username} is already verified by another player`);
      }
      // A user holds one link per wiki; an unverified squat on this username is taken over.
      await tx.wikiAccountLink.deleteMany({ where: { userId, source, NOT: { username } } });
      await tx.wikiAccountLink.upsert({
        where: { source_username: { source, username } },
        update: {
          userId,
          wikiUserId: wikiUser.userId,
          token,
          tokenExpiresAt: expiresAt,
          verifiedAt: null,
        },
        create: {
          userId,
          source,
          username,
          wikiUserId: wikiUser.userId,
          token,
          tokenExpiresAt: expiresAt,
        },
      });
    });
    return { token, username, expiresAt, userPageUrl: wikiUserPageUrl(source, username) };
  }

  async function confirm(userId: string, source: SisterReaderId): Promise<{ username: string }> {
    const link = await db.wikiAccountLink.findUnique({
      where: { userId_source: { userId, source } },
    });
    if (!link?.token || link.verifiedAt)
      throw new WikiLinkError("NO_PENDING", "Start verification first");
    if (!link.tokenExpiresAt || link.tokenExpiresAt < now()) {
      throw new WikiLinkError("EXPIRED", "That code expired — request a new one");
    }
    const token = link.token;
    const since = new Date(link.tokenExpiresAt.getTime() - TOKEN_TTL_MS - CLOCK_SKEW_MARGIN_MS);
    const history = await wikiCall(() => deps.fetchUserPageHistory(source, link.username, since));
    const proof = proveToken(history, token, link.username);
    if (proof === "UNATTRIBUTABLE") {
      throw new WikiLinkError(
        "TOKEN_NOT_FOUND",
        "Save the code on your user page yourself, then press Verify"
      );
    }
    if (proof !== "SAVED_BY_ACCOUNT") {
      throw new WikiLinkError(
        "TOKEN_NOT_FOUND",
        `The code must be saved on User:${link.username} by ${link.username} themself`
      );
    }
    // The account's age and edits at proof time decide whether the link alone autoconfirms (plan 409).
    const wikiUser = await wikiCall(() => deps.fetchWikiUser(source, link.username));
    // Re-check owner + token atomically: a concurrent start() may have re-owned this row (new
    // token) while we were waiting on the wiki fetch above.
    const claimed = await db.wikiAccountLink.updateMany({
      where: { id: link.id, userId, token, verifiedAt: null },
      data: {
        verifiedAt: now(),
        token: null,
        tokenExpiresAt: null,
        verifiedById: null,
        mwRegisteredAt: wikiUser?.registration ?? null,
        mwEditCount: wikiUser?.editCount ?? null,
      },
    });
    if (claimed.count !== 1) {
      throw new WikiLinkError("NO_PENDING", "Your verification changed — start again");
    }
    return { username: link.username };
  }

  async function unlink(userId: string, source: SisterReaderId): Promise<void> {
    await db.wikiAccountLink.deleteMany({ where: { userId, source } });
  }

  /**
   * The sister wiki links (an IxWiki row left from before claims is not one). `pending` only while the code can still
   * be confirmed — an expired one offers a fresh start (ruling F-4).
   */
  async function list(userId: string): Promise<WikiLinkView[]> {
    const links = await db.wikiAccountLink.findMany({
      where: { userId, source: { in: SISTER_READER_IDS } },
      orderBy: { source: "asc" },
    });
    const at = now();
    return links.map((l) => ({
      source: l.source,
      username: l.username,
      verified: !!l.verifiedAt,
      pending: !!l.token && !!l.tokenExpiresAt && l.tokenExpiresAt > at,
    }));
  }

  return { start, confirm, unlink, list };
}
