/**
 * The signed-in player's nations across every realm, for the nation switcher (nav user menu, passport).
 * Switching goes through users.setActiveNation (activateOwnedNation).
 */
import type { PrismaClient } from "@prisma/client";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { resolveDividendCountryId } from "~/lib/vault/dividend-nation";

type MyNationsDb = {
  country: Pick<PrismaClient["country"], "findMany" | "findFirst">;
};

interface MyNation {
  id: string;
  name: string;
  slug: string | null;
  flag: string | null;
}

interface MyNationsRealm {
  id: string;
  slug: string | null;
  name: string;
  nations: MyNation[];
}

export async function listMyNations(
  db: MyNationsDb,
  user: { id: string; countryId: string | null }
): Promise<{
  activeCountryId: string | null;
  /** The nation that pays the account's daily dividend (resolveDividendCountryId). */
  dividendCountryId: string | null;
  realms: MyNationsRealm[];
}> {
  const [owned, dividendCountryId] = await Promise.all([
    db.country.findMany({
      where: { ownerUserId: user.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        flag: true,
        realmId: true,
        realm: { select: { slug: true, name: true } },
      },
    }),
    resolveDividendCountryId(db, user),
  ]);

  const byRealm = new Map<string, MyNationsRealm>();
  for (const { realmId, realm, ...nation } of owned) {
    let group = byRealm.get(realmId);
    if (!group) {
      group = {
        id: realmId,
        slug: realm?.slug ?? null,
        // IxWorld may have no realm row (it predates realms).
        name: realm?.name ?? (realmId === DEFAULT_REALM_ID ? "IxWorld" : realmId),
        nations: [],
      };
      byRealm.set(realmId, group);
    }
    group.nations.push(nation);
  }
  const realms = [...byRealm.values()].sort(
    (a, b) =>
      Number(b.id === DEFAULT_REALM_ID) - Number(a.id === DEFAULT_REALM_ID) ||
      a.name.localeCompare(b.name)
  );
  return { activeCountryId: user.countryId, dividendCountryId, realms };
}
