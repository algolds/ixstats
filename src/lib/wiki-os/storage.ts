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

export interface WikiUserRecord {
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
