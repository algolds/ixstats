/**
 * The signed-out front page's realm-scoped and aggregate data: today's featured realm and its top nations, the
 * platform's headline counts, and the realms with open nations (the directory's rule).
 */
import type { PrismaClient } from "@prisma/client";
import { normalizeFlagUrl } from "~/lib/flags/normalization";
import { pickFeaturedRealm } from "~/lib/front-page";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import { openNationCounts } from "./realms.open-nations";

const NATIONS_SHOWN = 10;
const OPEN_REALMS_SHOWN = 4;

const countByRealm = (rows: Array<{ realmId: string; _count: { _all: number } }>) =>
  new Map(rows.map((row) => [row.realmId, row._count._all]));

export async function getFrontPage(db: PrismaClient, now = Date.now()) {
  const realms = await db.realm.findMany({
    where: DIRECTORY_REALM_WHERE,
    select: { id: true, slug: true, name: true, thumbnail: true },
  });
  const realmIds = realms.map((realm) => realm.id);
  const nations = { realmId: { in: realmIds }, isDemo: false };

  const [nationRows, open, mappedRows, players] = await Promise.all([
    db.country.groupBy({ by: ["realmId"], where: nations, _count: { _all: true } }),
    openNationCounts(db, realmIds),
    db.mapLayer.groupBy({
      by: ["realmId"],
      where: { realmId: { in: realmIds }, layerType: "political" },
    }),
    db.user.count(),
  ]);
  const nationCount = countByRealm(nationRows);
  const mapped = new Set(mappedRows.map((row) => row.realmId));

  const listed = realms.map((realm) => ({
    ...realm,
    nationCount: nationCount.get(realm.id) ?? 0,
    // The number /realms shows under Open to join.
    openNationCount: (open.nations.get(realm.id) ?? 0) + (open.pages.get(realm.id) ?? 0),
    hasPoliticalMap: mapped.has(realm.id),
  }));
  const featured =
    pickFeaturedRealm(listed, now) ?? listed.find((realm) => realm.id === DEFAULT_REALM_ID) ?? null;

  const topNations = featured
    ? await db.country.findMany({
        where: { realmId: featured.id, isDemo: false },
        orderBy: { currentTotalGdp: "desc" },
        take: NATIONS_SHOWN,
        select: {
          id: true,
          slug: true,
          name: true,
          flag: true,
          currentPopulation: true,
          currentTotalGdp: true,
          currentGdpPerCapita: true,
          economicTier: true,
          governmentType: true,
        },
      })
    : [];

  return {
    featured: featured && {
      slug: featured.slug,
      name: featured.name,
      thumbnail: featured.thumbnail,
      nationCount: featured.nationCount,
    },
    facts: {
      realms: listed.length,
      nations: listed.reduce((sum, realm) => sum + realm.nationCount, 0),
      players,
    },
    nations: topNations.map(({ flag, ...nation }) => ({
      ...nation,
      flagUrl: normalizeFlagUrl(flag),
    })),
    openRealms: listed
      .filter((realm) => realm.openNationCount > 0)
      .sort((a, b) => b.openNationCount - a.openNationCount || a.name.localeCompare(b.name))
      .slice(0, OPEN_REALMS_SHOWN)
      .map(({ slug, name, thumbnail, openNationCount }) => ({
        slug,
        name,
        thumbnail,
        openNationCount,
      })),
  };
}
