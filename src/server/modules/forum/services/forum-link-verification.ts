/**
 * Verified forum account linking (WK-1).
 *
 * A forum link is stored only after the player proves control of the XenForo account: they put a
 * short-lived code in their forum profile's Location or About field, and confirm() reads the
 * profile through the XenForo API. Only the account holder (or forum staff) can edit those fields.
 *
 * The code is stateless: an HMAC over (IxStats user, forum user, time window), so nothing is stored
 * until the proof succeeds. A code is valid for the window it was issued in and the next one
 * (30–60 minutes), and only for the IxStats user and forum account it was issued for.
 */
import { createHmac } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

export const FORUM_CODE_WINDOW_MS = 30 * 60 * 1000;

export type ForumLinkErrorCode =
  "NOT_CONFIGURED" | "FORUM_USER_NOT_FOUND" | "FORUM_UNREACHABLE" | "CODE_NOT_FOUND";

export class ForumLinkError extends Error {
  constructor(
    public readonly code: ForumLinkErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ForumLinkError";
  }
}

/** The profile fields a player can write the code into. */
export interface ForumProfileProof {
  location?: string | null;
  about?: string | null;
}

export interface ForumLinkDeps {
  /** HMAC key for the codes; null when no secret is configured. */
  secret: string | null;
  lookupUser: (username: string) => Promise<{ userId: number; username: string } | null>;
  /** The forum user's profile, or null when it can't be read. */
  fetchProfile: (forumUserId: number) => Promise<ForumProfileProof | null>;
  /** Push IxStats stats to the newly linked forum profile. */
  syncProfile?: (userId: string) => Promise<unknown>;
  /** System owners may link one forum account to several IxStats users (test accounts). */
  isSystemOwner?: (clerkUserId: string) => boolean;
  now?: () => Date;
}

type ForumLinkDb = Pick<PrismaClient, "user" | "$transaction">;

export function forumVerificationCode(
  secret: string,
  userId: string,
  forumUserId: number,
  window: number
): string {
  const digest = createHmac("sha256", secret)
    .update(`forum-link:${userId}:${forumUserId}:${window}`)
    .digest("hex");
  return `ixstates-${digest.slice(0, 12)}`;
}

export function createForumLinkService(db: ForumLinkDb, deps: ForumLinkDeps) {
  const now = deps.now ?? (() => new Date());

  function requireSecret(): string {
    if (!deps.secret) {
      throw new ForumLinkError(
        "NOT_CONFIGURED",
        "Forum verification is not configured on this server. Ask an admin."
      );
    }
    return deps.secret;
  }

  async function findForumUser(forumUsername: string) {
    const forumUser = await deps.lookupUser(forumUsername.trim());
    if (!forumUser) {
      throw new ForumLinkError("FORUM_USER_NOT_FOUND", `Forum user "${forumUsername}" not found`);
    }
    return forumUser;
  }

  /** Issue the code the player must put on their forum profile. Stores nothing. */
  async function start(userId: string, forumUsername: string) {
    const secret = requireSecret();
    const forumUser = await findForumUser(forumUsername);
    const window = Math.floor(now().getTime() / FORUM_CODE_WINDOW_MS);
    return {
      code: forumVerificationCode(secret, userId, forumUser.userId, window),
      forumUserId: forumUser.userId,
      forumUsername: forumUser.username,
      expiresAt: new Date((window + 2) * FORUM_CODE_WINDOW_MS),
    };
  }

  /** Read the forum profile, check the code, then store the link. */
  async function confirm(userId: string, clerkUserId: string, forumUsername: string) {
    const secret = requireSecret();
    const forumUser = await findForumUser(forumUsername);
    const profile = await deps.fetchProfile(forumUser.userId);
    if (!profile) {
      throw new ForumLinkError(
        "FORUM_UNREACHABLE",
        "Your forum profile could not be read. Try again in a few minutes."
      );
    }

    const window = Math.floor(now().getTime() / FORUM_CODE_WINDOW_MS);
    const validCodes = [window, window - 1].map((w) =>
      forumVerificationCode(secret, userId, forumUser.userId, w)
    );
    const fields = [profile.location ?? "", profile.about ?? ""];
    const proven = validCodes.some((code) => fields.some((field) => field.includes(code)));
    if (!proven) {
      throw new ForumLinkError(
        "CODE_NOT_FOUND",
        `The code was not found on ${forumUser.username}'s forum profile. Save it in the Location or About field, or get a new code if it expired.`
      );
    }

    const keepOtherLinks = deps.isSystemOwner?.(clerkUserId) ?? false;
    await db.$transaction(async (tx) => {
      // The proven owner takes the forum account over from any unproven earlier link.
      if (!keepOtherLinks) {
        await tx.user.updateMany({
          where: { forumUserId: forumUser.userId, id: { not: userId } },
          data: { forumUserId: null, forumUsername: null, lastForumSync: null },
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: { forumUserId: forumUser.userId, forumUsername: forumUser.username },
      });
    });

    await deps.syncProfile?.(userId);
    return { forumUserId: forumUser.userId, forumUsername: forumUser.username };
  }

  return { start, confirm };
}
