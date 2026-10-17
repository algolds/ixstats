/** @jest-environment node */
/** Explore (spec §2.3): realm shelves first, then a filtered grid, with silhouettes for unowned art. */
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
  it("starts from the approved catalogue and adds each filter", () => {
    expect(exploreWhere(query(), "me")).toEqual({ ...CATALOGUE_WHERE });
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
      cardType: { in: ["NS"] },
      category: { in: ["HISTORY"] },
      season: 3,
      metadata: { path: ["nsData", "region"], equals: "The Pacific" },
      title: { contains: "caph", mode: "insensitive" },
    });
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

  it("leaves out draft and generating realms, and keeps trophy cards", async () => {
    const db = createMockPrisma();
    db.card.count.mockResolvedValue(1);
    db.card.findMany.mockResolvedValue([card("trophy", "default", "TROPHY")]);
    const page = await exploreGrid(db as never, "me", query());
    const where = db.card.findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({ realm: PUBLISHED });
    expect(where).not.toHaveProperty("cardType");
    expect(db.card.count.mock.calls[0]![0]).toEqual({ where });
    expect(page.faces.map((f) => f.cardType)).toEqual(["TROPHY"]);
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
    const shelves = await exploreShelves(db as never, "me");
    expect(shelves.map((s) => s.realm.name)).toEqual(["Ixnay", "Big", "Small"]);
    expect(shelves[1]).toMatchObject({ cardCount: 50, bannerUrl: "https://art/banner.png" });
    expect(shelves[0]!.newest[0]!.face).toMatchObject({
      cardId: "new",
      silhouette: true,
      artwork: null,
    });
    expect(shelves[0]!.mostWanted[0]).toMatchObject({ wanted: 2 });
  });

  it("shows art on the shelves for cards the viewer holds", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([{ realmId: "default", _count: { _all: 1 } }]);
    db.realm.findMany.mockResolvedValue([{ ...realm("default", "Ixnay"), bannerUrl: null }]);
    db.card.findMany.mockResolvedValue([card("mine")]);
    db.cardOwnership.findMany.mockResolvedValue([{ cardId: "mine" }]);
    const [shelf] = await exploreShelves(db as never, "me");
    expect(shelf!.newest[0]!.face).toMatchObject({
      silhouette: false,
      artwork: "https://art/mine.png",
    });
  });

  it("builds shelves only for public, published realms", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([]);
    await exploreShelves(db as never, "me");
    expect(db.card.groupBy.mock.calls[0]![0]).toMatchObject({
      by: ["realmId"],
      where: {
        reviewState: "APPROVED",
        isRetired: false,
        realm: { ...PUBLISHED, visibility: "public" },
      },
    });
  });

  it("leaves trophy cards out of the strips but in the realm's card count", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([{ realmId: "default", _count: { _all: 4 } }]);
    db.realm.findMany.mockResolvedValue([{ ...realm("default", "Ixnay"), bannerUrl: null }]);
    await exploreShelves(db as never, "me");
    const strips = db.card.findMany.mock.calls.map((call) => call[0].where);
    expect(strips).toHaveLength(2);
    for (const where of strips) {
      expect(where).toMatchObject({
        ...CATALOGUE_WHERE,
        realmId: "default",
        cardType: { not: "TROPHY" },
      });
    }
    expect(db.card.groupBy.mock.calls[0]![0].where).not.toHaveProperty("cardType");
  });

  it("has no shelves when nothing is in the catalogue", async () => {
    const db = createMockPrisma();
    db.card.groupBy.mockResolvedValue([]);
    await expect(exploreShelves(db as never, "me")).resolves.toEqual([]);
    expect(db.realm.findMany).not.toHaveBeenCalled();
  });
});

describe("exploreRegions", () => {
  it("lists the regions of approved, unhidden NationStates cards", async () => {
    const db = createMockPrisma();
    db.$queryRaw = jest.fn().mockResolvedValue([{ region: "The Pacific" }, { region: "Lazarus" }]);
    await expect(exploreRegions(db as never)).resolves.toEqual(["The Pacific", "Lazarus"]);
    const sql = (db.$queryRaw.mock.calls[0]![0] as TemplateStringsArray).join("?");
    expect(sql).toMatch(/"cardType" = 'NS'/);
    expect(sql).toMatch(/"reviewState" = 'APPROVED'/);
    expect(sql).toMatch(/"isRetired" = false/);
  });
});
