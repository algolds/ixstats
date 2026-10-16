import type { PrismaClient } from "@prisma/client";
import { canonicalArticleTitle, wikiFallbackRealm, wikiSourceKey } from "./legacy-mapping";

/**
 * The home realm of a new Lore or Trophy card (cards refresh §5.3, the rule the backfill applied): the realm that
 * imported the article's page earliest, else the wiki's own realm (IxWiki: Ixnay).
 */
export async function articleHomeRealm(
  db: { realmPage: Pick<PrismaClient["realmPage"], "findMany"> },
  wikiSource: string | null,
  title: string
): Promise<string> {
  const source = wikiSourceKey(wikiSource);
  const pages = await db.realmPage.findMany({
    where: {
      wikiSource: source,
      title: { equals: canonicalArticleTitle(title, source), mode: "insensitive" },
    },
    orderBy: [{ importedAt: "asc" }, { realmId: "asc" }],
    take: 1,
    select: { realmId: true },
  });
  return pages[0]?.realmId ?? wikiFallbackRealm(source);
}
