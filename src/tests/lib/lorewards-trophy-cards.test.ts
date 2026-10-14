/** @jest-environment node */
/**
 * Loreward trophy cards: one one-of-one lore card per recorded place, held unowned until the winner's wiki
 * account is verified-linked. Minting, granting and the backfill never write IxCredits.
 */
import { Prisma, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { ConflictError } from "~/lib/app-error";
import {
  backfillTrophyCards,
  grantUnownedTrophyCards,
  isTrophyCard,
  mintTrophyCards,
  trophyRarity,
} from "~/lib/lorewards/trophy-cards";

interface EntryRow {
  id: string;
  type: string;
  date: string;
  status: string;
  winnerUser: string | null;
  winnerPage: string | null;
  runnerUpUser: string | null;
  runnerUpPage: string | null;
}
interface CardRow {
  id: string;
  lorewardEntryId: string | null;
  lorewardEdition: string | null;
  title: string;
  rarity: string;
  cardType: string;
  totalSupply: number;
  wikiArticleTitle: string | null;
  metadata: Prisma.JsonObject;
  [field: string]: unknown;
}
interface OwnershipRow {
  id: string;
  cardId: string;
  userId: string;
  ownerId: string;
  serialNumber: number;
  isLocked: boolean;
  quantity: number;
}

let entries: EntryRow[];
let cards: CardRow[];
let ownerships: OwnershipRow[];
let links: Map<string, string>;
let creditWrites: string[];
let failNextCardCreate: boolean;
let failNextCardCreateAsConflict: boolean;

const entry = (over: Partial<EntryRow> = {}): EntryRow => ({
  id: "e1",
  type: "daily",
  date: "2026-10-16",
  status: "approved",
  winnerUser: "Kir_Republic",
  winnerPage: "Seneca front",
  runnerUpUser: null,
  runnerUpPage: null,
  ...over,
});

const inList = (ids: string[] | undefined, id: string) => !ids || ids.includes(id);

function buildDb(): PrismaClient {
  const credit = (name: string) => () => {
    creditWrites.push(name);
    throw new Error(`${name} must not be called`);
  };
  const fake = {
    lorewardEntry: {
      findMany: jest.fn(
        async ({ where }: { where: { id?: { in: string[] }; type: { in: string[] } } }) =>
          entries.filter(
            (e) =>
              e.status === "approved" &&
              where.type.in.includes(e.type) &&
              inList(where.id?.in, e.id)
          )
      ),
    },
    systemConfig: { findUnique: jest.fn(async () => ({ value: "3" })) },
    wikiAccountLink: {
      findFirst: jest.fn(async ({ where }: { where: { username: { equals: string } } }) => {
        const userId = links.get(where.username.equals);
        return userId ? { userId } : null;
      }),
    },
    card: {
      findMany: jest.fn(async ({ where }: { where: { CardOwnership?: unknown } }) =>
        cards.filter(
          (c) =>
            c.lorewardEntryId !== null &&
            (!where.CardOwnership || !ownerships.some((o) => o.cardId === c.id))
        )
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        cards.find((c) => c.id === where.id)
      ),
      create: jest.fn(async ({ data }: { data: Omit<CardRow, "id"> }) => {
        if (failNextCardCreateAsConflict) {
          failNextCardCreateAsConflict = false;
          throw new ConflictError("Unique constraint failed");
        }
        if (failNextCardCreate) {
          failNextCardCreate = false;
          throw new Prisma.PrismaClientKnownRequestError("unique", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        const row = { ...data, id: `c${cards.length + 1}` } as CardRow;
        cards.push(row);
        return row;
      }),
      update: jest.fn(
        async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { metadata: Prisma.JsonObject };
        }) => {
          const row = cards.find((c) => c.id === where.id);
          if (row) row.metadata = data.metadata;
          return row;
        }
      ),
    },
    cardOwnership: {
      count: jest.fn(
        async ({ where }: { where: { cardId: string } }) =>
          ownerships.filter((o) => o.cardId === where.cardId).length
      ),
      findFirst: jest.fn(async ({ where }: { where: { cardId: string } }) => {
        const mine = ownerships.filter((o) => o.cardId === where.cardId);
        return mine.length ? { serialNumber: Math.max(...mine.map((o) => o.serialNumber)) } : null;
      }),
      create: jest.fn(async ({ data }: { data: OwnershipRow }) => {
        ownerships.push(data);
        return data;
      }),
    },
    vaultTransaction: { create: credit("vaultTransaction.create") },
    myVault: { update: credit("myVault.update"), upsert: credit("myVault.upsert") },
    $executeRaw: jest.fn(async () => 0),
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(fake)),
  };
  return fake as unknown as PrismaClient;
}

let db: PrismaClient;
const ownersOf = (cardId: string) => ownerships.filter((o) => o.cardId === cardId);

beforeEach(() => {
  entries = [entry()];
  cards = [];
  ownerships = [];
  links = new Map();
  creditWrites = [];
  failNextCardCreate = false;
  failNextCardCreateAsConflict = false;
  db = buildDb();
});

describe("isTrophyCard", () => {
  it("is true for a card stamped with a Loreward entry and false otherwise", () => {
    expect(isTrophyCard({ lorewardEntryId: "e1" })).toBe(true);
    expect(isTrophyCard({ lorewardEntryId: null })).toBe(false);
  });
});

describe("trophyRarity", () => {
  it("ranks monthly winners Legendary, weekly winners and monthly runner-ups Epic, the rest Rare", () => {
    expect(trophyRarity("monthly", "winner")).toBe("LEGENDARY");
    expect(trophyRarity("weekly", "winner")).toBe("EPIC");
    expect(trophyRarity("monthly", "runner-up")).toBe("EPIC");
    expect(trophyRarity("weekly", "runner-up")).toBe("RARE");
    expect(trophyRarity("daily", "winner")).toBe("RARE");
    expect(trophyRarity("daily", "runner-up")).toBe("RARE");
  });
});

describe("mintTrophyCards", () => {
  it("mints one one-of-one lore card per recorded place of the entry", async () => {
    entries = [entry({ runnerUpUser: "Urcea", runnerUpPage: "Caballian Wars" })];

    expect(await mintTrophyCards(db)).toEqual({ minted: 2 });

    expect(cards.map((c) => [c.lorewardEntryId, c.lorewardEdition, c.wikiArticleTitle])).toEqual([
      ["e1", "winner", "Seneca front"],
      ["e1", "runner-up", "Caballian Wars"],
    ]);
    expect(cards[0]).toMatchObject({
      title: "Seneca front",
      cardType: "LORE",
      rarity: "RARE",
      totalSupply: 1,
      season: 3,
      wikiSource: "ixwiki",
    });
    expect(cards[0]?.metadata).toMatchObject({
      contest: "daily",
      place: "winner",
      date: "2026-10-16",
      entryId: "e1",
      wikiUser: "Kir_Republic",
    });
  });

  it("mints nothing on a re-run", async () => {
    entries = [entry({ runnerUpUser: "Urcea", runnerUpPage: "Caballian Wars" })];
    await mintTrophyCards(db);

    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards).toHaveLength(2);
  });

  it("skips a place that is not recorded, an unapproved entry and the annual contest", async () => {
    entries = [
      entry({ id: "none", winnerUser: null, winnerPage: null }),
      entry({ id: "draft", status: "pending", date: "2026-10-17" }),
      entry({ id: "year", type: "annual", date: "2026-12-31" }),
    ];

    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
  });

  it("titles a place with no recorded page after the contest and date", async () => {
    entries = [entry({ id: "w", type: "weekly", date: "2026-W34", winnerPage: null })];

    await mintTrophyCards(db);

    expect(cards[0]).toMatchObject({
      title: "Weekly Loreward 2026-W34",
      rarity: "EPIC",
      wikiArticleTitle: null,
    });
  });

  it("mints only the entries it is asked for", async () => {
    entries = [entry({ id: "a" }), entry({ id: "b", date: "2026-10-17" })];

    expect(await mintTrophyCards(db, ["b"])).toEqual({ minted: 1 });
    expect(cards.map((c) => c.lorewardEntryId)).toEqual(["b"]);
  });

  it("leaves a card unowned when the winner has no verified link", async () => {
    await mintTrophyCards(db);

    expect(cards).toHaveLength(1);
    expect(ownerships).toEqual([]);
  });

  it("gives a linked winner an unlocked, tradeable copy as serial 1", async () => {
    links.set("Kir Republic", "u1");

    await mintTrophyCards(db);

    expect(ownersOf("c1")).toEqual([
      expect.objectContaining({
        userId: "u1",
        ownerId: "u1",
        serialNumber: 1,
        quantity: 1,
        isLocked: false,
      }),
    ]);
    expect(cards[0]?.metadata).toMatchObject({ grantedTo: "u1" });
  });

  it("counts a place another run already minted as not minted", async () => {
    failNextCardCreate = true;

    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards).toEqual([]);
  });

  it("counts a unique violation surfaced as a ConflictError as not minted", async () => {
    failNextCardCreateAsConflict = true;

    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards).toEqual([]);
  });

  it("writes no IxCredits", async () => {
    links.set("Kir Republic", "u1");
    await mintTrophyCards(db);
    expect(creditWrites).toEqual([]);
  });
});

describe("grantUnownedTrophyCards", () => {
  beforeEach(async () => {
    await mintTrophyCards(db);
  });

  it("grants nothing while the winner is still unlinked", async () => {
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
  });

  it("grants the card once after a link appears", async () => {
    links.set("Kir Republic", "u1");

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 1 });
    expect(ownersOf("c1")).toEqual([
      expect.objectContaining({ userId: "u1", ownerId: "u1", serialNumber: 1, isLocked: false }),
    ]);

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownersOf("c1")).toHaveLength(1);
  });

  it("does not hand a card back that its owner has since removed", async () => {
    links.set("Kir Republic", "u1");
    await grantUnownedTrophyCards(db);
    ownerships = [];

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
  });

  it("does not grant a card that gained an owner since it was listed", async () => {
    links.set("Kir Republic", "u1");
    const original = db.card.findMany;
    jest.mocked(db.card.findMany).mockImplementationOnce(async (args) => {
      const listed = await original(args);
      ownerships.push({
        id: "o",
        cardId: "c1",
        userId: "u9",
        ownerId: "u9",
        serialNumber: 1,
        isLocked: false,
        quantity: 1,
      });
      return listed;
    });

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownersOf("c1")).toHaveLength(1);
  });

  it("writes no IxCredits", async () => {
    links.set("Kir Republic", "u1");
    await grantUnownedTrophyCards(db);
    expect(creditWrites).toEqual([]);
  });
});

describe("backfillTrophyCards", () => {
  beforeEach(() => {
    entries = [
      entry({
        id: "d1",
        date: "2017-03-18",
        runnerUpUser: "Urcea",
        runnerUpPage: "Caballian Wars",
      }),
      entry({ id: "d2", date: "2017-03-19" }),
      entry({ id: "m1", type: "monthly", date: "2020-01-01", winnerPage: null }),
    ];
    links.set("Kir Republic", "u1");
  });

  it("on a dry run writes nothing and reports what is missing by contest and place", async () => {
    const report = await backfillTrophyCards(db, false);

    expect(report).toEqual({
      missing: { "daily:winner": 2, "daily:runner-up": 1, "monthly:winner": 1 },
      minted: 0,
      granted: 0,
    });
    expect(cards).toEqual([]);
    expect(ownerships).toEqual([]);
    expect(db.card.create).not.toHaveBeenCalled();
  });

  it("on apply mints every place, grants the linked winner's cards and pays no credits", async () => {
    const report = await backfillTrophyCards(db, true);

    expect(report).toMatchObject({ minted: 4, granted: 0 });
    expect(cards).toHaveLength(4);
    expect(ownerships.map((o) => o.userId)).toEqual(["u1", "u1", "u1"]);
    expect(creditWrites).toEqual([]);
  });

  it("is idempotent: a second apply finds nothing missing", async () => {
    await backfillTrophyCards(db, true);

    expect(await backfillTrophyCards(db, true)).toEqual({ missing: {}, minted: 0, granted: 0 });
    expect(cards).toHaveLength(4);
  });
});
