/**
 * Open nations, one rule for the realm directory (/realms "Open to join") and the front page: countries nobody
 * owns, and lore-index nation pages no country has taken yet.
 */
import type { PrismaClient } from "@prisma/client";
import { nationPageTaken } from "./realms.handover";

type NationPage = { realmId: string; title: string; wikiSource: string };

/**
 * The nation pages of realms' lore indexes that no country has taken yet: claimable through
 * `realms.claimNationPage`. A page is taken by the country carrying its page reference (even after a rename), or
 * by name for a country without one, as in getRealmHub.
 */
export async function unclaimedNationPages<P extends NationPage>(
  db: PrismaClient,
  pages: P[]
): Promise<P[]> {
  if (pages.length === 0) return [];
  const titles = [...new Set(pages.map((page) => page.title))];
  const countries = await db.country.findMany({
    where: {
      realmId: { in: [...new Set(pages.map((page) => page.realmId))] },
      OR: [{ wikiPageTitle: { in: titles } }, { wikiPageTitle: null, name: { in: titles } }],
    },
    select: { realmId: true, name: true, wikiSource: true, wikiPageTitle: true },
  });
  const taken = nationPageTaken(countries);
  return pages.filter((page) => !taken(page));
}

/** Per realm id: countries nobody owns (`nations`) and nation pages left to claim (`pages`). */
export async function openNationCounts(db: PrismaClient, realmIds: string[]) {
  const [unowned, nationPages] = await Promise.all([
    db.country.groupBy({
      by: ["realmId"],
      where: { realmId: { in: realmIds }, ownerUserId: null },
      _count: { _all: true },
    }),
    db.realmPage.findMany({
      where: { realmId: { in: realmIds }, kind: "nation" },
      select: { realmId: true, title: true, wikiSource: true },
    }),
  ]);
  const pages = new Map<string, number>();
  for (const page of await unclaimedNationPages(db, nationPages))
    pages.set(page.realmId, (pages.get(page.realmId) ?? 0) + 1);
  return { nations: new Map(unowned.map((row) => [row.realmId, row._count._all])), pages };
}
