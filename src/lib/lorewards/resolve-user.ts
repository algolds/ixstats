import { type PrismaClient } from "@prisma/client";
import { normalizeWikiUsername } from "~/lib/wiki-os/adapters/mediawiki/account-proof";

/**
 * The platform user (`User.id`) behind a wiki username, through a VERIFIED ixwiki `WikiAccountLink` (token
 * proven on the wiki user page, or admin-verified). The legacy `User.wikiUsername` column is deliberately not
 * consulted: it can hold values that were never proven, so paying through it would pay whoever squatted the name.
 */
export async function resolveLorewardUser(
  db: Pick<PrismaClient, "wikiAccountLink">,
  wikiUser: string
): Promise<string | null> {
  const link = await db.wikiAccountLink.findFirst({
    where: {
      source: "ixwiki",
      verifiedAt: { not: null },
      username: { equals: normalizeWikiUsername(wikiUser), mode: "insensitive" },
    },
    select: { userId: true },
  });
  return link?.userId ?? null;
}
