/** @jest-environment node */
import type { PrismaClient } from "@prisma/client";
import { getFrontPage } from "~/server/modules/realms/realms.front-page";

interface FakeCountry {
  realmId: string;
  name: string;
  ownerUserId: string | null;
  currentTotalGdp: number;
}

const realms = [
  { id: "default", slug: "ixnay", name: "Ixnay", thumbnail: null },
  { id: "r_eurth", slug: "eurth", name: "Eurth", thumbnail: "/eurth.png" },
  { id: "r_small", slug: "small", name: "Small", thumbnail: null },
];

const country = (realmId: string, name: string, gdp: number, owned = true): FakeCountry => ({
  realmId,
  name,
  ownerUserId: owned ? "u1" : null,
  currentTotalGdp: gdp,
});

type FakePage = { realmId: string; title: string; wikiSource: string };

/** Just the calls getFrontPage makes, answered from in-memory rows. */
function fakeDb(countries: FakeCountry[], mappedRealmIds: string[], pages: FakePage[] = []) {
  const countBy = (rows: FakeCountry[]) =>
    [...new Set(rows.map((c) => c.realmId))].map((realmId) => ({
      realmId,
      _count: { _all: rows.filter((c) => c.realmId === realmId).length },
    }));
  const topNations = ({ where, take }: { where: { realmId: string }; take: number }) =>
    countries
      .filter((c) => c.realmId === where.realmId)
      .sort((a, b) => b.currentTotalGdp - a.currentTotalGdp)
      .slice(0, take)
      .map((c) => ({ ...c, id: c.name, slug: c.name.toLowerCase(), flag: " /f.png " }));
  // The open-nation rule asks for countries that may have taken a nation page (by name here: no page references).
  const findMany = jest.fn(
    async (args: { where: { realmId: string; OR?: unknown }; take: number }) =>
      args.where.OR
        ? countries.map((c) => ({ ...c, wikiSource: null, wikiPageTitle: null }))
        : topNations(args)
  );
  return {
    db: {
      realm: { findMany: async () => realms },
      country: {
        groupBy: async ({ where }: { where: { ownerUserId?: null } }) =>
          countBy("ownerUserId" in where ? countries.filter((c) => !c.ownerUserId) : countries),
        findMany,
      },
      realmPage: { findMany: async () => pages },
      mapLayer: { groupBy: async () => mappedRealmIds.map((realmId) => ({ realmId })) },
      user: { count: async () => 1204 },
    } as unknown as PrismaClient,
    findMany,
  };
}

const many = (realmId: string, n: number, owned = true) =>
  Array.from({ length: n }, (_, i) => country(realmId, `${realmId}-${i}`, i * 10, owned));

describe("getFrontPage", () => {
  it("counts listed realms, nations and every account", async () => {
    const { db } = fakeDb([...many("default", 4), ...many("r_eurth", 3)], ["default", "r_eurth"]);
    const page = await getFrontPage(db, 0);
    expect(page.facts).toEqual({ realms: 3, nations: 7, players: 1204 });
  });

  it("features a mapped realm with three or more nations, and falls back to Ixnay when none qualifies", async () => {
    const mapped = fakeDb([...many("default", 4), ...many("r_eurth", 3)], ["r_eurth"]);
    expect((await getFrontPage(mapped.db, 0)).featured?.slug).toBe("eurth");

    const unmapped = fakeDb([...many("default", 4), ...many("r_small", 2)], ["r_small"]);
    expect((await getFrontPage(unmapped.db, 0)).featured).toEqual({
      slug: "ixnay",
      name: "Ixnay",
      thumbnail: null,
      nationCount: 4,
    });
  });

  it("lists the featured realm's top ten nations by GDP with normalized flags", async () => {
    const { db, findMany } = fakeDb(many("default", 12), ["default"]);
    const page = await getFrontPage(db, 0);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { currentTotalGdp: "desc" }, take: 10 })
    );
    expect(page.nations).toHaveLength(10);
    expect(page.nations[0]).toMatchObject({ name: "default-11", flagUrl: "/f.png" });
    expect(page.nations[0]).not.toHaveProperty("flag");
  });

  it("counts nation pages nobody has taken as open, as /realms does", async () => {
    const page = (realmId: string, title: string) => ({ realmId, title, wikiSource: "ixwiki" });
    const { db } = fakeDb(
      many("default", 4),
      ["default"],
      [page("r_eurth", "Free Page"), page("default", "default-0")]
    );
    const { openRealms } = await getFrontPage(db, 0);
    expect(openRealms).toEqual([
      { slug: "eurth", name: "Eurth", thumbnail: "/eurth.png", openNationCount: 1 },
    ]);
  });

  it("ranks realms with unowned nations by open count, at most four", async () => {
    const { db } = fakeDb(
      [...many("default", 4), ...many("r_eurth", 2, false), ...many("r_small", 3, false)],
      ["default"]
    );
    const page = await getFrontPage(db, 0);
    expect(page.openRealms).toEqual([
      { slug: "small", name: "Small", thumbnail: null, openNationCount: 3 },
      { slug: "eurth", name: "Eurth", thumbnail: "/eurth.png", openNationCount: 2 },
    ]);
  });
});
