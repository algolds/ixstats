/** @jest-environment node */
/**
 * Loreward trophy cards: one one-of-one, bound Trophy card per recorded place, its copy Serialised, held unowned
 * until the place's account can be told (a plain name's approved name claim, or for a `wikios>` name the WikiOS
 * account behind its edits). Minting, granting and the backfill never write IxCredits.
 */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
jest.mock("~/lib/cards/mint", () => ({ mintCopy: jest.fn() }));
jest.mock("~/lib/cards/home-realm", () => ({
  articleHomeRealm: jest.fn().mockResolvedValue("default"),
}));

import { Prisma, type PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { ConflictError } from "~/lib/app-error";
import { mintCopy } from "~/lib/cards/mint";
import { matches, storedEntry } from "~/tests/helpers/loreward-entry-store";
import {
  backfillTrophyCards,
  grantUnownedTrophyCards,
  mintTrophyCards,
} from "~/lib/lorewards/trophy-cards";

interface EntryRow {
  id: string;
  type: string;
  date: string;
  dateStart: string | null;
  dateEnd: string | null;
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
  ownerId: string;
  serialNumber: number;
}

let entries: EntryRow[];
let cards: CardRow[];
let ownerships: OwnershipRow[];
/** The serials each card's transfer events record (they outlive a voided copy). */
let trail: Array<{ cardId: string; serialNumber: number }>;
let claims: Map<string, string>;
/** The authorIds of each page's edits under the queried label, by page title, as the place query groups them. */
let winningEdits: Map<string, Array<string | null>>;
/** The label and page of every place query the fake answered. */
let placeQueries: Array<{ author: string; title: string }>;
let creditWrites: string[];
let failNextCardCreate: boolean;
let failNextCardCreateAsConflict: boolean;

const entry = (over: Partial<EntryRow> = {}): EntryRow => ({
  id: "e1",
  type: "daily",
  date: "2026-10-16",
  dateStart: null,
  dateEnd: null,
  status: "approved",
  winnerUser: "Kir_Republic",
  winnerPage: "Seneca front",
  runnerUpUser: null,
  runnerUpPage: null,
  ...over,
});

const inList = (ids: string[] | undefined, id: string) => !ids || ids.includes(id);

/** The trophy-card filter of one contest place: its entries' cards of one edition. */
interface CardWhere {
  lorewardEntryId?: { in?: string[]; not?: null };
  lorewardEdition?: string;
}
const inContestPlace = (card: CardRow, where: CardWhere) =>
  inList(where.lorewardEntryId?.in, card.lorewardEntryId ?? "") &&
  (!where.lorewardEdition || card.lorewardEdition === where.lorewardEdition);

/** When each contest-place lock was taken (jest's invocation order), among all `$executeRaw` calls. */
function contestLockOrder(database: PrismaClient): number[] {
  const raw = (database as unknown as { $executeRaw: jest.Mock }).$executeRaw;
  return raw.mock.calls.flatMap(
    ([, ...values]: [string[], ...Array<string | number>], i: number) =>
      values.some((value) => typeof value === "string" && value.includes(":"))
        ? [raw.mock.invocationCallOrder[i]!]
        : []
  );
}

/** When a fake delegate method was first called (jest's invocation order). */
const firstCall = (method: object) => (method as jest.Mock).mock.invocationCallOrder[0];

function buildDb(): PrismaClient {
  const credit = (name: string) => () => {
    creditWrites.push(name);
    throw new Error(`${name} must not be called`);
  };
  const fake = {
    lorewardEntry: {
      // The real `where` (the contests read, and the contest re-read inside a place's lock); one page holds them all.
      findMany: jest.fn(async ({ where }: { where: Parameters<typeof matches>[1] }) =>
        entries.filter((e) => matches(storedEntry(e), where))
      ),
    },
    systemConfig: { findUnique: jest.fn(async () => ({ value: "3" })) },
    wikiNameClaim: {
      findFirst: jest.fn(async ({ where }: { where: { name: string } }) => {
        const userId = claims.get(where.name);
        return userId ? { userId } : null;
      }),
    },
    wikiRevision: {
      groupBy: jest.fn(
        async ({ where }: { where: { author: string; article: { title: string } } }) => {
          placeQueries.push({ author: where.author, title: where.article.title });
          return [...new Set(winningEdits.get(where.article.title) ?? [])].map((authorId) => ({
            authorId,
          }));
        }
      ),
    },
    card: {
      findMany: jest.fn(
        async ({
          where,
        }: {
          where: CardWhere & { CardOwnership?: { none: object }; isRetired?: boolean };
        }) =>
          cards.filter(
            (c) =>
              c.lorewardEntryId !== null &&
              inContestPlace(c, where) &&
              (where.isRetired === undefined || (c.isRetired ?? false) === where.isRetired) &&
              (!where.CardOwnership || !ownerships.some((o) => o.cardId === c.id))
          )
      ),
      count: jest.fn(
        async ({ where }: { where: CardWhere }) =>
          cards.filter((c) => inContestPlace(c, where)).length
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
        async ({ where }: { where: { cardId?: string; cards?: CardWhere } }) =>
          ownerships.filter((o) => {
            const card = cards.find((c) => c.id === o.cardId);
            return where.cards
              ? !!card && inContestPlace(card, where.cards)
              : o.cardId === where.cardId;
          }).length
      ),
      findFirst: jest.fn(async ({ where }: { where: { cardId: string } }) => {
        const serials = ownersOf(where.cardId).map((o) => o.serialNumber);
        return serials.length > 0 ? { serialNumber: Math.max(...serials) } : null;
      }),
    },
    cardTransferEvent: {
      findFirst: jest.fn(async ({ where }: { where: { cardId: string } }) => {
        const serials = trail.filter((t) => t.cardId === where.cardId).map((t) => t.serialNumber);
        return serials.length > 0 ? { serialNumber: Math.max(...serials) } : null;
      }),
    },
    vaultTransaction: { create: credit("vaultTransaction.create") },
    myVault: { update: credit("myVault.update"), upsert: credit("myVault.upsert") },
    $executeRaw: jest.fn(async () => 0),
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
      fn(fake)
    ),
  };
  return fake as unknown as PrismaClient;
}

let db: PrismaClient;
const ownersOf = (cardId: string) => ownerships.filter((o) => o.cardId === cardId);

/**
 * Runs every transaction on a client distinct from `db`, sharing its cards and copies but with its own entry reads
 * (and any `delegates` given): they see `inLock`, what an override wrote while the run waited for the lock, while the
 * run's listing through `db` still sees `entries`. A re-check made on `db` would read the listing and miss the change.
 */
function distinctTx(inLock: EntryRow[], delegates: Record<string, object> = {}) {
  const reread = jest.fn(async ({ where }: { where: Parameters<typeof matches>[1] }) =>
    inLock.filter((e) => matches(storedEntry(e), where))
  );
  const tx = Object.assign({}, db, { lorewardEntry: { findMany: reread } }, delegates);
  (db as unknown as { $transaction: jest.Mock }).$transaction.mockImplementation(
    async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx)
  );
  return { reread, listing: db.lorewardEntry.findMany as unknown as jest.Mock };
}

beforeEach(() => {
  entries = [entry()];
  cards = [];
  ownerships = [];
  trail = [];
  claims = new Map();
  winningEdits = new Map();
  placeQueries = [];
  creditWrites = [];
  failNextCardCreate = false;
  failNextCardCreateAsConflict = false;
  db = buildDb();
  // The real mintCopy (Task 4) is tested on its own; here it records the copy it would create.
  jest.mocked(mintCopy).mockReset();
  jest.mocked(mintCopy).mockImplementation(async (_tx, input) => {
    const serialNumber = ownersOf(input.cardId).length + 1;
    ownerships.push({
      id: `o${ownerships.length + 1}`,
      cardId: input.cardId,
      ownerId: input.ownerId,
      serialNumber,
    });
    return { id: `o${ownerships.length}` } as Awaited<ReturnType<typeof mintCopy>>;
  });
});
describe("mintTrophyCards", () => {
  it("mints one one-of-one, bound Trophy card per recorded place of the entry", async () => {
    entries = [entry({ runnerUpUser: "Urcea", runnerUpPage: "Caballian Wars" })];

    expect(await mintTrophyCards(db)).toEqual({ minted: 2 });

    expect(cards.map((c) => [c.lorewardEntryId, c.lorewardEdition, c.wikiArticleTitle])).toEqual([
      ["e1", "winner", "Seneca front"],
      ["e1", "runner-up", "Caballian Wars"],
    ]);
    expect(cards[0]).toMatchObject({
      title: "Seneca front",
      cardType: "TROPHY",
      isBound: true,
      realmId: "default",
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
  it("leaves a card unowned when the winner has no approved name claim", async () => {
    await mintTrophyCards(db);

    expect(cards).toHaveLength(1);
    expect(ownerships).toEqual([]);
  });
  it("writes no IxCredits", async () => {
    claims.set("Kir Republic", "u1");
    await mintTrophyCards(db);
    expect(creditWrites).toEqual([]);
  });
});

describe("grantUnownedTrophyCards", () => {
  beforeEach(async () => {
    await mintTrophyCards(db);
  });
  it("takes the per-card lock, after the contest place's, before it looks at the card or its owners", async () => {
    claims.set("Kir Republic", "u1");

    await grantUnownedTrophyCards(db);

    const raw = jest.mocked(db.$executeRaw as unknown as jest.Mock);
    const serialLock = raw.mock.calls.findIndex(([, space, key]) => space === 7331 && key === "c1");
    const cardLock = raw.mock.invocationCallOrder[serialLock];
    expect(cardLock).toBeDefined();
    // The grant's contest-place lock (7332) is taken first; the card's serial lock (7331) never before it.
    expect(contestLockOrder(db)[1]).toBeLessThan(cardLock!);
    expect(cardLock).toBeLessThan(firstCall(db.cardOwnership.count)!);
    expect(cardLock).toBeLessThan(firstCall(db.card.findUnique)!);
  });

  it("grants the card once after a claim is approved", async () => {
    claims.set("Kir Republic", "u1");

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 1 });
    expect(jest.mocked(mintCopy)).toHaveBeenCalledWith(expect.anything(), {
      cardId: "c1",
      ownerId: "u1",
      finish: "SERIALISED",
      source: "TROPHY",
    });
    expect(ownersOf("c1")).toEqual([expect.objectContaining({ ownerId: "u1", serialNumber: 1 })]);

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownersOf("c1")).toHaveLength(1);
  });
  it("grants nothing for a plain name without a claim, or for a label two accounts share", async () => {
    // A plain name is a MediaWiki editor: WikiOS edits under it on the page prove nothing.
    winningEdits.set("Seneca front", ["u9"]);
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    entries[0]!.winnerUser = "wikios>Kir_Republic";
    winningEdits.set("Seneca front", ["u9", "u3"]);
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
  });
  it("does not hand a card back that its owner has since removed", async () => {
    claims.set("Kir Republic", "u1");
    await grantUnownedTrophyCards(db);
    ownerships = [];

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
  });

  it("does not grant a card that gained an owner since it was listed", async () => {
    claims.set("Kir Republic", "u1");
    // The fake's card.findMany (a jest.fn over the in-memory rows), not Prisma's PrismaPromise-typed method
    const findMany = db.card.findMany as unknown as jest.Mock<
      Promise<CardRow[]>,
      [{ where: { CardOwnership?: unknown } }]
    >;
    const original = findMany;
    findMany.mockImplementationOnce(async (args) => {
      const listed = await original(args);
      ownerships.push({ id: "o", cardId: "c1", ownerId: "u9", serialNumber: 1 });
      return listed;
    });

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownersOf("c1")).toHaveLength(1);
  });

  it("writes no IxCredits", async () => {
    claims.set("Kir Republic", "u1");
    await grantUnownedTrophyCards(db);
    expect(creditWrites).toEqual([]);
  });

  it("grants a trophy its place gave up again under its serial, reissued, never a second one", async () => {
    // An override voided the copy (serial 1 lives on in the trail) and cleared the grant
    trail.push({ cardId: "c1", serialNumber: 1 });
    claims.set("Kir Republic", "u1");

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 1 });
    expect(jest.mocked(mintCopy)).toHaveBeenCalledWith(expect.anything(), {
      cardId: "c1",
      ownerId: "u1",
      finish: "SERIALISED",
      source: "TROPHY",
      serialNumber: 1,
    });
  });

  it("grants no retired trophy: a voided place waits for an override to fill it again", async () => {
    cards[0]!.isRetired = true;
    claims.set("Kir Republic", "u1");

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
  });
});

describe("grantUnownedTrophyCards over a scope of entries", () => {
  beforeEach(async () => {
    entries = [entry(), entry({ id: "e2", date: "2026-10-17", winnerPage: "Caballian Wars" })];
    await mintTrophyCards(db);
    claims.set("Kir Republic", "u1");
  });

  it("grants only the scoped contest's card, and the other waits", async () => {
    expect(await grantUnownedTrophyCards(db, ["e2"])).toEqual({ granted: 1 });
    expect(ownerships.map((o) => cards.find((c) => c.id === o.cardId)?.lorewardEntryId)).toEqual([
      "e2",
    ]);
    // The unowned-card read asks only for the scoped contests' cards.
    expect(db.card.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lorewardEntryId: { in: ["e2"] } }),
      })
    );
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 1 });
  });

  it("grants a scoped contest's card held by its twin", async () => {
    entries = weeklyTwins("Kir_Republic", "Kir_Republic");
    cards = [legacyCard("c-ool", "w-ool")];
    expect(await grantUnownedTrophyCards(db, ["w-state"])).toEqual({ granted: 1 });
    expect(ownersOf("c-ool")).toEqual([expect.objectContaining({ ownerId: "u1" })]);
  });

  it("grants nothing, and reads no card, for an empty scope or unknown entries", async () => {
    const findMany = db.card.findMany as unknown as jest.Mock;
    findMany.mockClear();
    expect(await grantUnownedTrophyCards(db, [])).toEqual({ granted: 0 });
    expect(await grantUnownedTrophyCards(db, ["gone"])).toEqual({ granted: 0 });
    expect(findMany).not.toHaveBeenCalled();
    expect(ownerships).toEqual([]);
  });
});

/** A weekly stored twice: by its first day (the OOL page) and as `2026-W42` with its range (the state file). */
const weeklyTwins = (oolWinner: string, stateWinner: string): EntryRow[] => [
  entry({ id: "w-ool", type: "weekly", date: "2026-10-12", winnerUser: oolWinner }),
  entry({
    id: "w-state",
    type: "weekly",
    date: "2026-W42",
    dateStart: "2026-10-12",
    dateEnd: "2026-10-18",
    winnerUser: stateWinner,
  }),
];

/** A trophy card minted before contests were told apart: one per entry of a pair. */
const legacyCard = (id: string, entryId: string): CardRow =>
  ({
    id,
    lorewardEntryId: entryId,
    lorewardEdition: "winner",
    title: "Seneca front",
    rarity: "EPIC",
    cardType: "TROPHY",
    totalSupply: 1,
    wikiArticleTitle: "Seneca front",
    metadata: { contest: "weekly", place: "winner", entryId, wikiUser: "Kir_Republic" },
  }) as CardRow;

describe("trophy cards of a contest stored twice", () => {
  it("mints one card for an agreeing pair, through its state-keyed entry", async () => {
    entries = weeklyTwins("Kir_Republic", "Kir_Republic");
    expect(await mintTrophyCards(db)).toEqual({ minted: 1 });
    expect(cards.map((c) => c.lorewardEntryId)).toEqual(["w-state"]);
  });

  it("mints no second card once either entry of the pair has one", async () => {
    entries = [weeklyTwins("Kir_Republic", "Kir_Republic")[0]!];
    await mintTrophyCards(db);
    entries = weeklyTwins("Kir_Republic", "Kir_Republic");
    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards).toHaveLength(1);
  });

  it("mints nothing for a place the pair disagrees on", async () => {
    entries = weeklyTwins("Urcea", "Nasastan");
    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
  });
});

describe("trophy cards when an override writes the place while a run waits", () => {
  it("mints nothing for a holder the place no longer records once the lock is held", async () => {
    claims.set("Kir Republic", "u1");
    const { reread } = distinctTx([entry({ winnerUser: "Cy" })]);

    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards).toEqual([]);
    expect(reread).toHaveBeenCalledTimes(1);
  });
});

describe("trophy cards under the contest place lock", () => {
  it("mints nothing when another sync minted the contest place's card while it waited", async () => {
    entries = weeklyTwins("Kir_Republic", "Kir_Republic");
    cards = [legacyCard("c-ool", "w-ool")];
    // This run listed the cards before the other sync's insert landed.
    const findMany = db.card.findMany as unknown as jest.Mock;
    findMany.mockImplementationOnce(async () => []);
    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards).toHaveLength(1);
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
    claims.set("Kir Republic", "u1");
  });
  it("is idempotent: a second apply finds nothing missing", async () => {
    await backfillTrophyCards(db, true);

    expect(await backfillTrophyCards(db, true)).toEqual({ missing: {}, minted: 0, granted: 0 });
    expect(cards).toHaveLength(4);
  });
});
