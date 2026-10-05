/**
 * The public realm page (/r/[realm]): its nations, the nation pages of its lore index that no country has taken
 * yet (claimable — decision 8), and the size and wiki of that index (ruling E-a). Nations the signed-in viewer
 * owns are marked `mine` so the page can offer "Play as" (ruling F-1). A draft or generating realm is shown only
 * to its moderators; an archived realm stays readable but `claimsOpen` is false (AT-7).
 */
import type { PrismaClient } from "@prisma/client";
import { canModerateRealm, isRealmOpen, isRealmPublished, type RealmActor } from "./realms.access";

type HubDb = Pick<PrismaClient, "realm" | "realmPage">;

export async function getRealmHub(db: HubDb, slug: string, viewer: RealmActor | null) {
  const realm = await db.realm.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      thumbnail: true,
      ownerId: true,
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
  const { countries, pages, _count, ownerId, ...rest } = realm;
  const published = isRealmPublished(realm.id, realm.status);
  if (!published && !(viewer && canModerateRealm(viewer, { ownerId }))) return null;
  const viewerId = viewer?.id ?? null;
  const lore =
    _count.pages > 0
      ? await db.realmPage.findFirst({ where: { realmId: realm.id }, select: { wikiSource: true } })
      : null;
  // Country names are unique per realm (decision 5), and a claimed page's country carries the page title.
  const named = new Set(countries.map((c) => c.name));
  return {
    ...rest,
    claimsOpen: isRealmOpen(realm.id, realm.status),
    // Public endpoint: expose "claimed" and "mine", never internal user ids.
    countries: countries.map(({ ownerUserId, ...c }) => ({
      ...c,
      claimed: ownerUserId !== null,
      mine: viewerId !== null && ownerUserId === viewerId,
    })),
    nationPages: pages.filter((page) => !named.has(page.title)),
    lorePageCount: _count.pages,
    loreSource: lore?.wikiSource ?? null,
  };
}
