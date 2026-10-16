import { type PrismaClient } from "@prisma/client";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

type LorewardUserDb = Pick<PrismaClient, "wikiAccountLink" | "wikiRevision">;

/**
 * The platform user (`User.id`) behind a wiki username, or null when that cannot be told for certain. A VERIFIED
 * ixwiki `WikiAccountLink` (token proven on the wiki user page, or admin-verified) wins. Otherwise the name's ixwiki
 * revisions decide, and only when every one was made by the same WikiOS account. An `authorId` proves who made a
 * revision, not that the `author` label is theirs (it can be a country name, the legacy `User.wikiUsername` or
 * `User_<id>`), so an unverified MediaWiki edit under the name (no `authorId`) or a second account returns null:
 * pay no one rather than the wrong person. The legacy `User.wikiUsername` column is never consulted.
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
  const [only, ...others] = await db.wikiRevision.groupBy({
    by: ["authorId"],
    where: { source: "ixwiki", author: { in: [wikiUser, name] } },
  });
  return only && others.length === 0 ? only.authorId : null;
}

/**
 * The wiki name a user's Lorewards are kept under: their verified ixwiki link, else the label of their latest ixwiki
 * edit, but only when that label resolves back to them (`resolveLorewardUser`). A label shared with another account
 * or with an unverified MediaWiki editor gives null, so no one is shown another editor's wins.
 */
export async function lorewardNameOf(db: LorewardUserDb, userId: string): Promise<string | null> {
  const link = await db.wikiAccountLink.findFirst({
    where: { userId, source: "ixwiki", verifiedAt: { not: null } },
    select: { username: true },
  });
  if (link) return link.username;
  const edit = await db.wikiRevision.findFirst({
    where: { authorId: userId, source: "ixwiki", author: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { author: true },
  });
  if (!edit?.author) return null;
  return (await resolveLorewardUser(db, edit.author)) === userId ? edit.author : null;
}
