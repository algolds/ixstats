// src/lib/wiki-os/storage.ts
// WikiOS storage/identity seam (Workstream C3).
//
// WikiOS resolves the active user and their country through these helpers, never
// naming the IxStats-specific `User.clerkUserId` column directly. A different
// deployer maps their own user store into these functions — feature code is
// unchanged. See plans/wikios-workstream-c-packaging.md.
//
// NOTE: WikiOS keeps using the shared Prisma client (`~/server/db`) — Prisma is
// part of WikiOS's own stack. What's IxStats-specific is the *column name* and
// the User↔Country relationship, both of which live only in this file.

import { db } from "~/server/db";
import { getWikiAuth, type WikiAuthContext } from "~/lib/wiki-os/auth";
import type { WikiSource } from "~/lib/wiki-os/config";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

interface WikiUserRecord {
  id: string;
  countryId: string | null;
}

/** Look up the platform user record for an auth id (IxStats: `User.clerkUserId`). */
export async function findWikiUserByAuthId(authId: string): Promise<WikiUserRecord | null> {
  const user = await db.user.findFirst({
    where: { clerkUserId: authId },
    select: { id: true, countryId: true },
  });
  return user ?? null;
}

/** Resolve the signed-in user's active country id, or null when signed out / unlinked. */
export async function resolveActiveCountryId(ctx: WikiAuthContext): Promise<string | null> {
  const { userId } = getWikiAuth(ctx);
  if (!userId) return null;
  const user = await findWikiUserByAuthId(userId);
  return user?.countryId ?? null;
}

/**
 * A user's VERIFIED wiki account on `source`, with what the rights engine needs to judge how far to
 * trust it. Verified means the user proved control of the account (`WikiAccountLink.verifiedAt`);
 * `User.wikiUsername` is never consulted because it can hold an unverified display fallback. This is
 * the only source of wiki identity for authorization.
 */
export interface VerifiedWikiLink {
  username: string;
  /** null = proven by the account's own token; else the id of the admin who confirmed it. */
  verifiedById: string | null;
  /** The wiki account's registration date and edit count when the link was proven; null = not recorded. */
  mwRegisteredAt: Date | null;
  mwEditCount: number | null;
}

/** The user's verified link on `source`, or null. */
export async function getVerifiedWikiLink(
  userId: string,
  source: WikiSource = "ixwiki"
): Promise<VerifiedWikiLink | null> {
  const link = await db.wikiAccountLink.findFirst({
    where: { userId, source, verifiedAt: { not: null } },
    select: { username: true, verifiedById: true, mwRegisteredAt: true, mwEditCount: true },
  });
  if (!link) return null;
  return {
    username: link.username,
    verifiedById: link.verifiedById ?? null,
    mwRegisteredAt: link.mwRegisteredAt ?? null,
    mwEditCount: link.mwEditCount ?? null,
  };
}

/** What a wiki profile may show about the account's owner: no user, role or Clerk ids. */
const PROFILE_USER_SELECT = {
  country: { select: { id: true, name: true, flag: true } },
  role: { select: { name: true, level: true } },
} as const;

/**
 * The platform user a wiki profile named `wikiName` belongs to: the owner of a VERIFIED ixwiki link
 * first, then the legacy `User.wikiUsername` column. Resolved by name only, so callers never see
 * their own (or an arbitrary) user's data under someone else's name.
 */
export async function findWikiProfileUser(wikiName: string) {
  const link = await db.wikiAccountLink.findFirst({
    where: { source: "ixwiki", username: normalizeWikiUsername(wikiName), verifiedAt: { not: null } },
    select: { user: { select: PROFILE_USER_SELECT } },
  });
  if (link) return link.user;
  return db.user.findFirst({ where: { wikiUsername: wikiName }, select: PROFILE_USER_SELECT });
}
