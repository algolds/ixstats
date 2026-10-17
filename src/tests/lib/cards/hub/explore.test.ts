/** @jest-environment node */
/** Explore (spec §2.3): realm shelves first, then a filtered grid, with silhouettes for unowned art. */
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { CATALOGUE_WHERE } from "~/lib/cards/hub/catalogue";
import {
  ExploreQuerySchema,
  exploreGrid,
  exploreOrderBy,
  exploreRegions,
  exploreShelves,
  exploreWhere,
} from "~/lib/cards/hub/explore";

const realm = (id: string, name: string) => ({
  id,
  slug: id,
  name,
  emblemUrl: null,
  isSystem: false,
});
const card = (id: string, realmId = "default", cardType: "LORE" | "TROPHY" = "LORE") => ({
  id,
  title: id,
  rarity: "RARE" as const,
  cardType,
  artwork: `https://art/${id}.png`,
  isRetired: false,
  collectorNumber: 1,
  season: 1,
  nsSeason: null,
  realm: realm(realmId, realmId),
  _count: { watchlist: 2 },
});
const query = (overrides: z.input<typeof ExploreQuerySchema> = {}) =>
  ExploreQuerySchema.parse(overrides);
const PUBLISHED = { status: { notIn: ["draft", "generating"] } };
const NO_TROPHIES = { cardType: { not: "TROPHY" } };

describe("CATALOGUE_WHERE", () => {
  it("holds approved, unhidden cards whose home realm is published", () => {
    expect(CATALOGUE_WHERE).toEqual({
      reviewState: "APPROVED",
      isRetired: false,
      realm: PUBLISHED,
    });
  });
});

describe("exploreWhere", () => {
  it("starts from the approved catalogue without trophy cards, and adds each filter", () => {
    expect(exploreWhere(query(), "me")).toEqual({ ...CATALOGUE_WHERE, ...NO_TROPHIES });
    expect(
      exploreWhere(
        query({
          realmId: "r1",
          rarities: ["EPIC"],
          types: ["NS"],
          categories: ["HISTORY"],
          season: 3,
          region: "The Pacific",
          search: "caph",
        }),
        "me"
      )
    ).toEqual({
      ...CATALOGUE_WHERE,
      realmId: "r1",
      rarity: { in: ["EPIC"] },
      cardType: { not: "TROPHY", in: ["NS"] },
      category: { in: ["HISTORY"] },
      season: 3,
      metadata: { path: ["nsData", "region"], equals: "The Pacific" },
      title: { contains: "caph", mode: "insensitive" },
    });
  });

  it("never lists a trophy card, even when the type filter asks for one", () => {
    expect(exploreWhere(query({ types: ["TROPHY", "LORE"] }), "me")).toMatchObject({
      cardType: { not: "TROPHY", in: ["TROPHY", "LORE"] },
    });
  });

  it("matches %, _ and \\ in a title search literally", () => {
    expect(exploreWhere(query({ search: "100%_a\\b" }), "me")).toMatchObject({
      title: { contains: "100\\%\\_a\\\\b", mode: "insensitive" },
    });
  });

  it("never lists a retired card, or one waiting in review, whatever the filters", () => {
    for (const filters of [
      {},
      { region: "Abydos" },
      { types: ["NS" as const], season: 2 },
      { owned: "owned" as const },
      { owned: "missing" as const },
    ]) {
      expect(exploreWhere(query(filters), "me")).toMatchObject({
        reviewState: "APPROVED",
        isRetired: false,
      });
    }
  });

  it("splits what the viewer has collected from what they are missing", () => {
    expect(exploreWhere(query({ owned: "owned" }), "me")).toMatchObject({
      CardOwnership: { some: { ownerId: "me" } },
    });
    expect(exploreWhere(query({ owned: "missing" }), "me")).toMatchObject({
      CardOwnership: { none: { ownerId: "me" } },
    });
  });

  it("orders by newest, title, rarity and most wanted, each with a stable tie-break for paging", () => {
    expect(exploreOrderBy("newest")).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
    expect(exploreOrderBy("title")).toEqual([{ title: "asc" }, { id: "asc" }]);
    expect(exploreOrderBy("rarity")).toEqual([{ rarity: "desc" }, { title: "asc" }, { id: "asc" }]);
    expect(exploreOrderBy("wanted")).toEqual([
      { watchlist: { _count: "desc" } },
      { createdAt: "desc" },
      { id: "asc" },
    ]);
  });
});

describe("exploreGrid", () => {
  it("pages the catalogue and strips art the viewer has not collected", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(3);
    db.card.findMany.mockResolvedValue([card("mine"), card("theirs")]);
    db.cardOwnership.findMany.mockResolvedValue([{ cardId: "mine" }]);
    const page = await exploreGrid(db as never, "me", query({ limit: 2 }));
    expect(page.faces.map((f) => [f.cardId, f.silhouette, f.artwork])).toEqual([
      ["mine", false, "https://art/mine.png"],
      ["theirs", true, null],
    ]);
    expect(page).toMatchObject({ total: 3, nextCursor: 2 });
    expect(db.card.findMany.mock.calls[0]![0]).toMatchObject({ skip: 0, take: 2 });
  });

  it("ends the pages at the last card", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(3);
    db.card.findMany.mockResolvedValue([card("last")]);
    const page = await exploreGrid(db as never, "me", query({ limit: 2, cursor: 2 }));
    expect(page.nextCursor).toBeNull();
    expect(db.card.findMany.mock.calls[0]![0]).toMatchObject({ skip: 2, take: 2 });
  });

  it("never hands back its own cursor for an empty page", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(5);
    db.card.findMany.mockResolvedValue([]);
    const page = await exploreGrid(db as never, "me", query({ limit: 2, cursor: 2 }));
    expect(page).toEqual({ faces: [], total: 5, nextCursor: null });
  });

  it("leaves out draft and generating realms and trophy cards, from the page and its count", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(0);
    db.card.findMany.mockResolvedValue([]);
    await exploreGrid(db as never, "me", query());
    const where = db.card.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ realm: PUBLISHED, ...NO_TROPHIES });
    expect(db.card.count.mock.calls[0]![0]).toEqual({ where });
  });
});

describe("exploreShelves", () => {
  it("puts Ixnay first, then realms by card count, with newest and most-wanted strips", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([
      { realmId: "small", _count: { _all: 3 } },
      { realmId: "default", _count: { _all: 10 } },
      { realmId: "big", _count: { _all: 50 } },
    ]);
    db.realm.findMany.mockResolvedValue([
      { ...realm("default", "Ixnay"), bannerUrl: null },
      { ...realm("big", "Big"), bannerUrl: "https://art/banner.png" },
      { ...realm("small", "Small"), bannerUrl: null },
    ]);
    db.card.findMany.mockImplementation(async (args: { where: { watchlist?: object } }) =>
      args.where.watchlist ? [card("wanted")] : [card("new")]
    );
    const { shelves } = await exploreShelves(db as never, "me");
    expect(shelves.map((s) => s.realm.name)).toEqual(["Ixnay", "Big", "Small"]);
    expect(shelves[1]).toMatchObject({ cardCount: 50, bannerUrl: "https://art/banner.png" });
    expect(shelves[0]!.newest[0]!.face).toMatchObject({
      cardId: "new",
      silhouette: true,
      artwork: null,
    });
    expect(shelves[0]!.mostWanted[0]).toMatchObject({ wanted: 2 });
  });

  it("breaks card-count ties by realm id, keeping Ixnay first", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([
      { realmId: "b", _count: { _all: 5 } },
      { realmId: "a", _count: { _all: 5 } },
      { realmId: "default", _count: { _all: 1 } },
    ]);
    db.realm.findMany.mockResolvedValue(
      ["b", "a", "default"].map((id) => ({ ...realm(id, id), bannerUrl: null }))
    );
    db.card.findMany.mockResolvedValue([card("new")]);
    const { shelves, realms } = await exploreShelves(db as never, "me");
    expect(shelves.map((s) => s.realm.id)).toEqual(["default", "a", "b"]);
    expect(realms.map((r) => r.id)).toEqual(["default", "a", "b"]);
  });

  it("keeps at most twelve shelves, and lists every realm with cards for the realm filters", async () => {
    const db = createMockPrisma();
    const ids = Array.from({ length: 13 }, (_, i) => `r${String(i).padStart(2, "0")}`);
    db.card.groupBy.mockResolvedValue(
      ids.map((id, i) => ({ realmId: id, _count: { _all: 100 - i } }))
    );
    db.realm.findMany.mockResolvedValue(ids.map((id) => ({ ...realm(id, id), bannerUrl: null })));
    db.card.findMany.mockResolvedValue([card("new")]);
    const { shelves, realms } = await exploreShelves(db as never, "me");
    expect(shelves.map((s) => s.realm.id)).toEqual(ids.slice(0, 12));
    expect(realms).toEqual(
      ids.map((id) => ({ id, slug: id, name: id, crestUrl: null, isSystem: false }))
    );
    expect(db.realm.findMany.mock.calls[0]![0]).toMatchObject({ where: { id: { in: ids } } });
    expect(db.card.findMany).toHaveBeenCalledTimes(24);
  });

  it("lists a realm whose strip came back empty in the filters, but gives it no shelf", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([
      { realmId: "default", _count: { _all: 4 } },
      { realmId: "emptied", _count: { _all: 2 } },
    ]);
    db.realm.findMany.mockResolvedValue([
      { ...realm("default", "Ixnay"), bannerUrl: null },
      { ...realm("emptied", "Emptied"), bannerUrl: null },
    ]);
    db.card.findMany.mockImplementation(async (args: { where: { realmId: string } }) =>
      args.where.realmId === "emptied" ? [] : [card("new")]
    );
    const { shelves, realms } = await exploreShelves(db as never, "me");
    expect(shelves.map((s) => [s.realm.id, s.cardCount, s.newest.length])).toEqual([
      ["default", 4, 1],
    ]);
    expect(realms.map((r) => r.id)).toEqual(["default", "emptied"]);
  });

  it("shows art on the shelves for cards the viewer holds", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([{ realmId: "default", _count: { _all: 1 } }]);
    db.realm.findMany.mockResolvedValue([{ ...realm("default", "Ixnay"), bannerUrl: null }]);
    db.card.findMany.mockResolvedValue([card("mine")]);
    db.cardOwnership.findMany.mockResolvedValue([{ cardId: "mine" }]);
    const {
      shelves: [shelf],
    } = await exploreShelves(db as never, "me");
    expect(shelf!.newest[0]!.face).toMatchObject({
      silhouette: false,
      artwork: "https://art/mine.png",
    });
  });

  it("counts and lists only public, published realms' cards, never trophy cards", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([]);
    await exploreShelves(db as never, "me");
    expect(db.card.groupBy.mock.calls[0]![0]).toMatchObject({
      by: ["realmId"],
      where: {
        reviewState: "APPROVED",
        isRetired: false,
        realm: { ...PUBLISHED, visibility: "public" },
        ...NO_TROPHIES,
      },
    });
  });

  it("leaves trophy cards out of the strips", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([{ realmId: "default", _count: { _all: 4 } }]);
    db.realm.findMany.mockResolvedValue([{ ...realm("default", "Ixnay"), bannerUrl: null }]);
    await exploreShelves(db as never, "me");
    const strips = db.card.findMany.mock.calls.map((call) => call[0]);
    expect(strips).toHaveLength(2);
    for (const args of strips) {
      expect(args.where).toMatchObject({ ...CATALOGUE_WHERE, realmId: "default", ...NO_TROPHIES });
    }
  });

  it("takes the six newest and the six most wanted, each with a stable order", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([{ realmId: "default", _count: { _all: 4 } }]);
    db.realm.findMany.mockResolvedValue([{ ...realm("default", "Ixnay"), bannerUrl: null }]);
    await exploreShelves(db as never, "me");
    const [newest, wanted] = db.card.findMany.mock.calls.map((call) => call[0]);
    const select = expect.objectContaining({ _count: { select: { watchlist: true } } });
    expect(newest).toMatchObject({ take: 6, orderBy: [{ createdAt: "desc" }, { id: "asc" }] });
    expect(newest.where).not.toHaveProperty("watchlist");
    expect(newest.select).toEqual(select);
    expect(wanted).toMatchObject({
      where: { watchlist: { some: {} } },
      take: 6,
      orderBy: [{ watchlist: { _count: "desc" } }, { id: "asc" }],
    });
    expect(wanted.select).toEqual(select);
  });

  it("has no shelves and no realms when nothing is in the catalogue", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([]);
    await expect(exploreShelves(db as never, "me")).resolves.toEqual({ shelves: [], realms: [] });
    expect(db.realm.findMany).not.toHaveBeenCalled();
  });
});

describe("exploreRegions", () => {
  const regionsDb = () => {
    const db = createMockPrisma();
    db.$queryRaw = jest.fn().mockResolvedValue([{ region: "The Pacific" }, { region: "Lazarus" }]);
    return db;
  };
  const sentQuery = (db: ReturnType<typeof regionsDb>): Prisma.Sql =>
    db.$queryRaw.mock.calls[0]![0];

  it("lists the 60 biggest regions of approved, unhidden NationStates cards", async () => {
    const db = regionsDb();
    await expect(exploreRegions(db as never)).resolves.toEqual(["The Pacific", "Lazarus"]);
    const { sql, values } = sentQuery(db);
    expect(sql).toMatch(/"cardType" = 'NS'/);
    expect(sql).toMatch(/"reviewState" = 'APPROVED'/);
    expect(sql).toMatch(/"isRetired" = false/);
    expect(sql).toMatch(/ORDER BY COUNT\(\*\) DESC, 1\s+LIMIT 60/);
    expect(sql).not.toMatch(/ILIKE/);
    expect(values).toEqual([]);
  });

  it("treats a blank search as none", async () => {
    const db = regionsDb();
    await exploreRegions(db as never, "   ");
    expect(sentQuery(db).sql).not.toMatch(/ILIKE/);
  });

  it("searches regions case-insensitively through a bound parameter, still the 60 biggest", async () => {
    const db = regionsDb();
    await exploreRegions(db as never, " pacific ");
    const { sql, values } = sentQuery(db);
    expect(sql).toMatch(/metadata->'nsData'->>'region' ILIKE \?/);
    expect(sql).toMatch(/ORDER BY COUNT\(\*\) DESC, 1\s+LIMIT 60/);
    expect(sql).not.toContain("pacific");
    expect(values).toEqual(["%pacific%"]);
  });

  it("matches %, _ and \\ literally", async () => {
    const db = regionsDb();
    await exploreRegions(db as never, "100%_a\\b");
    expect(sentQuery(db).values).toEqual(["%100\\%\\_a\\\\b%"]);
  });
});
