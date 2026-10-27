import type { PrismaClient } from "@prisma/client";
import { canonicalArticleTitle, wikiFallbackRealm, wikiSourceKey } from "./legacy-mapping";

type RealmPageReader = { realmPage: Pick<PrismaClient["realmPage"], "findMany"> };

/** The page that makes an article's home: the earliest realm import of it, with the page's kind; null when none. */
export async function articleHomePage(
  db: RealmPageReader,
  wikiSource: string | null,
  title: string
): Promise<{ realmId: string; kind: string } | null> {
  const source = wikiSourceKey(wikiSource);
  const pages = await db.realmPage.findMany({
    where: {
      wikiSource: source,
      title: { equals: canonicalArticleTitle(title, source), mode: "insensitive" },
    },
    orderBy: [{ importedAt: "asc" }, { realmId: "asc" }],
    take: 1,
    select: { realmId: true, kind: true },
  });
  return pages[0] ?? null;
}

/**
 * The home realm of a new Lore or Trophy card (cards refresh §5.3, the rule the backfill applied): the realm that
 * imported the article's page earliest, else the wiki's own realm (IxWiki: Ixnay).
 */
export async function articleHomeRealm(
  db: RealmPageReader,
  wikiSource: string | null,
  title: string
): Promise<string> {
  return (await articleHomePage(db, wikiSource, title))?.realmId ?? wikiFallbackRealm(wikiSource);
}
