import { type PrismaClient } from "@prisma/client";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

type LorewardUserDb = Pick<PrismaClient, "wikiAccountLink" | "wikiRevision">;

/**
 * The platform user (`User.id`) behind a wiki username: a VERIFIED ixwiki `WikiAccountLink` (token proven on the
 * wiki user page, or admin-verified), else the WikiOS account whose edits carry the name. A revision's `authorId`
 * is always proven (the WikiOS session, or a verified link when imported), so no link is needed to be paid. The
 * legacy `User.wikiUsername` column is deliberately not consulted: paying through it would pay a squatter.
 */
export async function resolveLorewardUser(
  db: LorewardUserDb,
  wikiUser: string
): Promise<string | null> {
  const name = normalizeWikiUsername(wikiUser);
  const link = await db.wikiAccountLink.findFirst({
    where: {
      source: "ixwiki",
      verifiedAt: { not: null },
      username: { equals: name, mode: "insensitive" },
    },
    select: { userId: true },
  });
  if (link) return link.userId;
  const edit = await db.wikiRevision.findFirst({
    where: { author: { in: [wikiUser, name] }, authorId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { authorId: true },
  });
  return edit?.authorId ?? null;
}

/** The wiki name a user's Lorewards are kept under: their verified ixwiki link, else the name their latest WikiOS edit carries. */
export async function lorewardNameOf(db: LorewardUserDb, userId: string): Promise<string | null> {
  const link = await db.wikiAccountLink.findFirst({
    where: { userId, source: "ixwiki", verifiedAt: { not: null } },
    select: { username: true },
  });
  if (link) return link.username;
  const edit = await db.wikiRevision.findFirst({
    where: { authorId: userId, author: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { author: true },
  });
  return edit?.author ?? null;
}
