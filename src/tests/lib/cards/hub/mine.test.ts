/** @jest-environment node */
/** Mine (spec §2.3): every copy the player holds, retired ones too, with filters, search, sort and pages. */
jest.mock("~/lib/cards/copy-value", () => ({ copyValue: jest.fn() }));

import type { z } from "zod";
import { copyValue } from "~/lib/cards/copy-value";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { listMine, MineQuerySchema, selectMine, type MineEntry } from "~/lib/cards/hub/mine";

const IXNAY = { id: "default", slug: "ixnay", name: "Ixnay", emblemUrl: null, isSystem: false };
const NS = {
  id: "ns",
  slug: "nationstates",
  name: "NationStates",
  emblemUrl: null,
  isSystem: true,
};
let seq = 0;
function entry(
  card: Partial<MineEntry["row"]["cards"]>,
  copy: Partial<MineEntry["row"]> = {},
  value = 10
): MineEntry {
  seq += 1;
  const cardId = card.id ?? `c${seq}`;
  return {
    value,
    row: {
      id: `o${seq}`,
      finish: "STANDARD",
      serialNumber: seq,
      level: 1,
      cardId,
      acquiredAt: new Date(Date.UTC(2026, 9, seq)),
      isLocked: false,
      ...copy,
      cards: {
        id: cardId,
        title: `Card ${seq}`,
        rarity: "COMMON",
        cardType: "LORE",
        artwork: null,
        isRetired: false,
        collectorNumber: seq,
        season: 1,
        nsSeason: null,
        realm: IXNAY,
        category: "HISTORY",
        marketValue: 10,
        ...card,
      },
    },
  };
}
const query = (overrides: z.input<typeof MineQuerySchema> = {}) => MineQuerySchema.parse(overrides);

describe("selectMine", () => {
  const all = [
    entry({ id: "a", title: "Alpha", rarity: "EPIC" }, { finish: "FOIL", level: 3 }, 500),
    entry({ id: "a", title: "Alpha", rarity: "EPIC" }, {}, 150),
    entry({ id: "b", title: "Bravo", cardType: "NS", category: null, realm: NS }, {}, 30),
    entry(
      { id: "c", title: "Charlie", rarity: "RARE", isRetired: true, artwork: "https://art/c.png" },
      {},
      90
    ),
  ];

  it("keeps retired copies, newest first by default, and counts copies per card", () => {
    const page = selectMine(all, query());
    expect(page.rows.map((r) => r.face.title)).toEqual(["Charlie", "Bravo", "Alpha", "Alpha"]);
    // A retired copy still lists, with the placeholder face toCardFace gives it (no art).
    expect(page.rows.find((r) => r.face.title === "Charlie")!.face).toMatchObject({
      isRetired: true,
      artwork: null,
    });
    expect(page.rows.filter((r) => r.face.cardId === "a").map((r) => r.copies)).toEqual([2, 2]);
    expect(page.rows.find((r) => r.face.cardId === "b")!.copies).toBe(1);
    expect(page).toMatchObject({ total: 4, totalCopies: 4, nextCursor: null });
  });

  it("carries each copy's value, acquisition date and lock", () => {
    const locked = entry({ title: "Locked" }, { isLocked: true }, 42);
    const [row] = selectMine([locked], query()).rows;
    expect(row).toMatchObject({ value: 42, acquiredAt: locked.row.acquiredAt, isLocked: true });
    expect(row!.face.copy).toEqual({
      ownershipId: locked.row.id,
      finish: "STANDARD",
      serialNumber: locked.row.serialNumber,
      level: 1,
    });
  });

  it("filters by realm, rarity, finish, type, category and duplicates, and searches titles", () => {
    expect(selectMine(all, query({ realmId: "ns" })).rows.map((r) => r.face.cardId)).toEqual(["b"]);
    expect(selectMine(all, query({ rarities: ["EPIC"] })).total).toBe(2);
    expect(selectMine(all, query({ finishes: ["FOIL"] })).total).toBe(1);
    expect(selectMine(all, query({ types: ["NS"] })).total).toBe(1);
    expect(selectMine(all, query({ categories: ["HISTORY"] })).total).toBe(3);
    expect(selectMine(all, query({ duplicates: true })).rows.map((r) => r.face.cardId)).toEqual([
      "a",
      "a",
    ]);
    expect(selectMine(all, query({ search: "  CHAR " })).rows.map((r) => r.face.cardId)).toEqual([
      "c",
    ]);
  });

  it("treats an empty filter list, a false duplicates flag and a blank search as no filter", () => {
    const open = query({
      rarities: [],
      finishes: [],
      types: [],
      categories: [],
      duplicates: false,
      search: "   ",
    });
    expect(selectMine(all, open).total).toBe(4);
  });

  it("counts filtered-out copies toward the copy count and the realm list", () => {
    const page = selectMine(all, query({ finishes: ["FOIL"] }));
    expect(page.rows.map((r) => r.copies)).toEqual([2]);
    expect(page).toMatchObject({ total: 1, totalCopies: 4 });
    expect(page.realms.map((r) => r.id)).toEqual(["default", "ns"]);
  });

  it("sorts by rarity, value, title and level", () => {
    expect(selectMine(all, query({ sort: "rarity" })).rows.map((r) => r.face.title)).toEqual([
      "Alpha",
      "Alpha",
      "Charlie",
      "Bravo",
    ]);
    expect(selectMine(all, query({ sort: "value" })).rows.map((r) => r.value)).toEqual([
      500, 150, 90, 30,
    ]);
    expect(selectMine(all, query({ sort: "title" })).rows.map((r) => r.face.title)).toEqual([
      "Alpha",
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
    expect(selectMine(all, query({ sort: "level" })).rows[0]!.face.copy!.level).toBe(3);
  });

  it("breaks ties by title, and a title tie by serial", () => {
    const ties = [
      entry({ title: "Zulu", rarity: "RARE" }, { level: 2 }, 50),
      entry({ title: "Yankee", rarity: "RARE" }, { level: 2 }, 50),
    ];
    for (const sort of ["rarity", "value", "level"] as const) {
      expect(selectMine(ties, query({ sort })).rows.map((r) => r.face.title)).toEqual([
        "Yankee",
        "Zulu",
      ]);
    }
    const twins = [
      entry({ id: "t", title: "Twin" }, { serialNumber: 9 }),
      entry({ id: "t", title: "Twin" }, { serialNumber: 2 }),
    ];
    expect(
      selectMine(twins, query({ sort: "title" })).rows.map((r) => r.face.copy!.serialNumber)
    ).toEqual([2, 9]);
  });

  it("pages with a cursor, and lists every realm the player holds for the filter", () => {
    const first = selectMine(all, query({ limit: 3 }));
    expect(first.rows).toHaveLength(3);
    expect(first.nextCursor).toBe(3);
    const last = selectMine(all, query({ limit: 3, cursor: 3 }));
    expect(last.rows.map((r) => r.face.title)).toEqual(["Alpha"]);
    expect(last.nextCursor).toBeNull();
    expect(selectMine(all, query({ limit: 2, cursor: 2 })).nextCursor).toBeNull();
    expect(selectMine(all, query({ cursor: 9 }))).toMatchObject({
      rows: [],
      total: 4,
      nextCursor: null,
    });
    expect(first.realms.map((r) => r.name)).toEqual(["Ixnay", "NationStates"]);
  });

  it("shows the art of the player's own copies", () => {
    const page = selectMine([entry({ artwork: "https://art/x.png" })], query());
    expect(page.rows[0]!.face).toMatchObject({ artwork: "https://art/x.png", silhouette: false });
  });
});

describe("MineQuerySchema", () => {
  it("defaults to the newest 60 copies and bounds the page size", () => {
    expect(query()).toMatchObject({ sort: "acquired", limit: 60 });
    expect(MineQuerySchema.safeParse({ limit: 120 }).success).toBe(true);
    expect(MineQuerySchema.safeParse({ limit: 121 }).success).toBe(false);
    expect(MineQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(MineQuerySchema.safeParse({ cursor: -1 }).success).toBe(false);
    expect(MineQuerySchema.safeParse({ cursor: null }).success).toBe(true);
    expect(MineQuerySchema.safeParse({ rarities: ["MYTHIC"] }).success).toBe(false);
  });
});

describe("listMine", () => {
  beforeEach(() => jest.mocked(copyValue).mockReset());

  it("reads the owner's copies once and values each with the shared per-copy value", async () => {
    const db = createMockPrisma();
    const one = entry({ title: "Alpha" });
    db.cardOwnership.findMany.mockResolvedValue([one.row]);
    jest.mocked(copyValue).mockReturnValue(77);
    const page = await listMine(db as never, "u1", query());
    expect(db.cardOwnership.findMany).toHaveBeenCalledTimes(1);
    expect(db.cardOwnership.findMany.mock.calls[0]![0]).toMatchObject({
      where: { ownerId: "u1" },
      orderBy: [{ acquiredAt: "desc" }, { id: "asc" }],
      take: 5000,
    });
    expect(copyValue).toHaveBeenCalledWith(one.row);
    expect(page.rows[0]!.value).toBe(77);
  });

  it("values a hidden (retired) copy at 0 but still lists it", async () => {
    const db = createMockPrisma();
    const hidden = entry({ title: "Hidden", isRetired: true, marketValue: 400 });
    db.cardOwnership.findMany.mockResolvedValue([hidden.row]);
    jest.mocked(copyValue).mockReturnValue(400);
    const page = await listMine(db as never, "u1", query());
    expect(copyValue).not.toHaveBeenCalled();
    expect(page.rows.map((r) => [r.face.title, r.value])).toEqual([["Hidden", 0]]);
  });
});
