/**
 * The public realm page (/r/[realm]): its nations, the nation pages of its lore index that no country has taken
 * yet (claimable — decision 8), and the size and wiki of that index (ruling E-a).
 */
import type { PrismaClient } from "@prisma/client";

type HubDb = Pick<PrismaClient, "realm" | "realmPage">;

export async function getRealmHub(db: HubDb, slug: string) {
  const realm = await db.realm.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      thumbnail: true,
      status: true,
      visibility: true,
      countries: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, flag: true, ownerUserId: true },
      },
      pages: {
        where: { kind: "nation" },
        orderBy: { title: "asc" },
        select: { title: true, wikiSource: true },
      },
      _count: { select: { pages: true } },
    },
  });
  if (!realm) return null;
  const { countries, pages, _count, ...rest } = realm;
  const lore =
    _count.pages > 0
      ? await db.realmPage.findFirst({ where: { realmId: realm.id }, select: { wikiSource: true } })
      : null;
  // Country names are unique per realm (decision 5), and a claimed page's country carries the page title.
  const named = new Set(countries.map((c) => c.name));
  return {
    ...rest,
    // Public endpoint: expose "claimed", never internal user ids.
    countries: countries.map(({ ownerUserId, ...c }) => ({ ...c, claimed: ownerUserId !== null })),
    nationPages: pages.filter((page) => !named.has(page.title)),
    lorePageCount: _count.pages,
    loreSource: lore?.wikiSource ?? null,
  };
}
