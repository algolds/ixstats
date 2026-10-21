/** @jest-environment node */
import { Prisma } from "@prisma/client";
import {
  deckValueOf,
  deckValuesByOwner,
  loadCopyValues,
  topCopiesByValue,
} from "~/lib/cards/copy-value";

type Finish = "STANDARD" | "FOIL" | "HOLO" | "SERIALISED";

interface Copy {
  id: string;
  ownerId: string;
  cardId: string;
  finish: Finish;
  level: number;
}

interface CardRow {
  id: string;
  rarity: string;
  cardType: string;
  firstSoldAt: Date | null;
  isRetired: boolean;
}

const CARDS: CardRow[] = [
  { id: "rare", rarity: "RARE", cardType: "LORE", firstSoldAt: null, isRetired: false },
  { id: "ns", rarity: "COMMON", cardType: "NS", firstSoldAt: null, isRetired: false },
  { id: "trophy", rarity: "EPIC", cardType: "TROPHY", firstSoldAt: null, isRetired: false },
];

interface Extra {
  cards?: CardRow[];
  banks?: Array<{ id: string; bank: number | null }>;
  medians?: Array<{ cardId: string; finish: Finish; median: number }>;
}

type IdsArgs = { where: { id: { in: string[] } } };

function makeDb(copies: Copy[], extra: Extra = {}) {
  const cards = extra.cards ?? CARDS;
  return {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    cardOwnership: { findMany: jest.fn().mockResolvedValue(copies) },
    card: {
      findMany: jest.fn(async ({ where }: IdsArgs) =>
        cards.filter((c) => where.id.in.includes(c.id))
      ),
    },
    cardMarketPrice: { findMany: jest.fn().mockResolvedValue(extra.medians ?? []) },
    $queryRaw: jest.fn().mockResolvedValue(extra.banks ?? []),
  };
}

const copy = (
  id: string,
  cardId: string,
  finish: Finish = "STANDARD",
  level = 1,
  ownerId = "u1"
) => ({
  id,
  ownerId,
  cardId,
  finish,
  level,
});

describe("copy values", () => {
  it("values each copy by finish, level, its finish's median and the NS term", async () => {
    const db = makeDb([copy("a", "rare", "FOIL", 6), copy("b", "rare"), copy("c", "ns")], {
      banks: [{ id: "ns", bank: 40 }],
      medians: [{ cardId: "rare", finish: "STANDARD", median: 400 }],
    });
    const values = await loadCopyValues(db as never, { ownerIds: ["u1"] });
    // a: Rare floor 100 x Foil 3 = 300, +10% at level 6 = 330. The Standard median (400) is not its finish's, so it
    // would wrongly give 440. b: the Standard median 400 beats the floor 100. c: the NS term 40 x 1.5 = 60 beats the
    // Common floor 10.
    expect(values).toEqual([
      {
        ownershipId: "a",
        ownerId: "u1",
        cardId: "rare",
        cardType: "LORE",
        finish: "FOIL",
        value: 330,
      },
      {
        ownershipId: "b",
        ownerId: "u1",
        cardId: "rare",
        cardType: "LORE",
        finish: "STANDARD",
        value: 400,
      },
      {
        ownershipId: "c",
        ownerId: "u1",
        cardId: "ns",
        cardType: "NS",
        finish: "STANDARD",
        value: 60,
      },
    ]);
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { ownerId: { in: ["u1"] }, cards: { isRetired: false } },
      select: { id: true, ownerId: true, cardId: true, finish: true, level: true },
    });
    expect(db.card.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["rare", "ns"] } },
      select: { id: true, rarity: true, cardType: true, firstSoldAt: true, isRetired: true },
    });
    expect(db.cardMarketPrice.findMany).toHaveBeenCalledWith({
      where: { cardId: { in: ["rare", "ns"] } },
      select: { cardId: true, finish: true, median: true },
    });
  });

  it("reads the bank value of unsold NS cards only, from their metadata", async () => {
    const sold = new Date("2026-10-01T00:00:00Z");
    const cards: CardRow[] = [
      ...CARDS,
      { id: "ns-sold", rarity: "COMMON", cardType: "NS", firstSoldAt: sold, isRetired: false },
    ];
    const db = makeDb([copy("a", "rare"), copy("c", "ns"), copy("d", "ns-sold")], {
      cards,
      banks: [{ id: "ns", bank: 40 }],
    });
    const values = await loadCopyValues(db as never, { ownerIds: ["u1"] });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = Prisma.sql(...(db.$queryRaw.mock.calls[0] as Parameters<typeof Prisma.sql>));
    expect(sql.text).toContain("metadata->'nsData'->>'market_value'");
    expect(sql.text).toContain("FROM cards c WHERE c.id IN ($1)");
    expect(sql.values).toEqual(["ns"]);
    // A sold NS card is valued by its floor alone.
    expect(values.map((v) => v.value)).toEqual([100, 60, 10]);
  });

  it("asks for no bank values when no card is an unsold NS card", async () => {
    const db = makeDb([copy("a", "rare")]);
    await loadCopyValues(db as never, { ownerIds: ["u1"] });
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("leaves retired cards out, and values a retired card's copy at 0 if one is read", async () => {
    const cards: CardRow[] = [
      { id: "gone", rarity: "LEGENDARY", cardType: "LORE", firstSoldAt: null, isRetired: true },
    ];
    const db = makeDb([copy("g", "gone", "HOLO", 10)], { cards });
    const values = await loadCopyValues(db as never, { ownershipIds: ["g"] });
    expect(values.map((v) => v.value)).toEqual([0]);
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["g"] }, cards: { isRetired: false } } })
    );
  });

  it("filters by type and skips a copy whose card is gone", async () => {
    const db = makeDb([copy("a", "rare"), copy("x", "missing")]);
    const values = await loadCopyValues(db as never, { excludeTypes: ["TROPHY"] });
    expect(values.map((v) => v.ownershipId)).toEqual(["a"]);
    expect(db.cardOwnership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cards: { isRetired: false, cardType: { notIn: ["TROPHY"] } } },
      })
    );
  });
});

describe("deck values", () => {
  it("totals a deck with and without trophies", async () => {
    const db = makeDb([copy("a", "rare"), copy("t", "trophy", "SERIALISED")]);
    // The trophy: Epic floor 1000 x trophy 0.25 = 250.
    expect(await deckValueOf(db as never, "u1")).toEqual({ total: 350, exTrophy: 100 });
  });

  it("rounds a deck's sums to the cent", async () => {
    const db = makeDb([copy("a", "rare"), copy("b", "ns"), copy("t", "trophy", "SERIALISED")], {
      medians: [
        { cardId: "rare", finish: "STANDARD", median: 100.1 },
        { cardId: "ns", finish: "STANDARD", median: 200.2 },
      ],
    });
    // 100.1 + 200.2 is 300.29999999999995 in floating point; with the trophy's 250, 550.3.
    expect(await deckValueOf(db as never, "u1")).toEqual({ total: 550.3, exTrophy: 300.3 });
  });

  it("sums each owner's copies to the cent", async () => {
    const db = makeDb(
      [
        copy("a", "rare", "STANDARD", 1, "u1"),
        copy("b", "ns", "STANDARD", 1, "u1"),
        copy("c", "rare", "FOIL", 1, "u2"),
      ],
      {
        medians: [
          { cardId: "rare", finish: "STANDARD", median: 100.1 },
          { cardId: "ns", finish: "STANDARD", median: 200.2 },
          { cardId: "rare", finish: "FOIL", median: 450.25 },
        ],
      }
    );
    const totals = await deckValuesByOwner(db as never, { excludeTypes: ["TROPHY"] });
    // u1: 100.1 + 200.2 is 300.29999999999995 in floating point. u2: the Foil copy reads the Foil median (450.25
    // beats 100 x 3 = 300), never the Standard one.
    expect([...totals]).toEqual([
      ["u1", 300.3],
      ["u2", 450.25],
    ]);
  });
});

describe("top copies", () => {
  it("returns the most valuable copy of each card, best first", async () => {
    const db = makeDb([
      copy("a", "rare"),
      copy("b", "rare", "HOLO"),
      copy("t", "trophy", "SERIALISED"),
    ]);
    expect((await topCopiesByValue(db as never, "u1", 2)).map((c) => c.ownershipId)).toEqual([
      "b",
      "t",
    ]);
  });

  it("breaks ties by card, then by copy, whatever order the copies are read in", async () => {
    const db = makeDb([copy("z", "rare"), copy("y", "rare"), copy("n", "ns")], {
      medians: [{ cardId: "ns", finish: "STANDARD", median: 100 }],
    });
    expect((await topCopiesByValue(db as never, "u1", 5)).map((c) => c.ownershipId)).toEqual([
      "n",
      "y",
    ]);
  });
});
