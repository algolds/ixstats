/** @jest-environment node */
/** Explore (spec §2.3): realm shelves first, then a filtered grid, every card with its art, the uncollected marked. */
import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import {
  ExploreQuerySchema,
  exploreGrid,
  exploreRegions,
  exploreWhere,
} from "~/lib/cards/hub/explore";
const query = (overrides: z.input<typeof ExploreQuerySchema> = {}) =>
  ExploreQuerySchema.parse(overrides);
const PUBLISHED = { status: { notIn: ["draft", "generating"] } };
const NO_TROPHIES = { cardType: { not: "TROPHY" } };
describe("exploreWhere", () => {
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
});

describe("exploreGrid", () => {
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
describe("exploreRegions", () => {
  const regionsDb = () => {
    const db = createMockPrisma();
    db.$queryRaw = jest.fn().mockResolvedValue([{ region: "The Pacific" }, { region: "Lazarus" }]);
    return db;
  };
  const sentQuery = (db: ReturnType<typeof regionsDb>): Prisma.Sql =>
    db.$queryRaw.mock.calls[0]![0];
  it("searches regions case-insensitively through a bound parameter, still the 60 biggest", async () => {
    const db = regionsDb();
    await exploreRegions(db as never, " pacific ");
    const { sql, values } = sentQuery(db);
    expect(sql).toMatch(/metadata->'nsData'->>'region' ILIKE \?/);
    expect(sql).toMatch(/ORDER BY COUNT\(\*\) DESC, 1\s+LIMIT 60/);
    expect(sql).not.toContain("pacific");
    expect(values).toEqual(["%pacific%"]);
  });
});
