/** @jest-environment node */
/**
 * Loreward trophy cards: one one-of-one, bound Trophy card per recorded place, its copy Serialised, held unowned
 * until the place's account can be told (a plain name's verified wiki link, or for a `wikios>` name the WikiOS
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
  EXCLUDE_TROPHY_CARDS,
  grantUnownedTrophyCards,
  isTrophyCard,
  mintTrophyCards,
  trophyCardText,
  trophyRarity,
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
let links: Map<string, string>;
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

/** The values bound to the contest-place advisory lock calls, among all `$executeRaw` calls. */
function contestLocks(database: PrismaClient): string[] {
  const raw = (database as unknown as { $executeRaw: jest.Mock }).$executeRaw;
  return raw.mock.calls
    .filter(([strings]: [string[]]) => strings.join("?").includes("pg_advisory_xact_lock"))
    .flatMap(([, ...values]: [string[], ...Array<string | number>]) => values)
    .filter((value): value is string => typeof value === "string" && value.includes(":"));
}

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
    wikiAccountLink: {
      findFirst: jest.fn(async ({ where }: { where: { username: string } }) => {
        const userId = links.get(where.username);
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
  links = new Map();
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

describe("trophy exclusion", () => {
  it("leaves every trophy out, Loreward or sports, by type", () => {
    expect(EXCLUDE_TROPHY_CARDS).toEqual({ cardType: { not: "TROPHY" } });
    expect(isTrophyCard({ cardType: "TROPHY" })).toBe(true);
    expect(isTrophyCard({ cardType: "LORE" })).toBe(false);
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

describe("trophyCardText", () => {
  it("names the card after the page, or the contest when there is none", () => {
    expect(trophyCardText("weekly", "2026-10-20", "winner", "Amy", "Elm_Republic")).toEqual({
      title: "Elm_Republic",
      description: "Weekly Loreward winner, 2026-10-20. Won by Amy with Elm_Republic.",
      wikiArticleTitle: "Elm Republic",
    });
    expect(trophyCardText("daily", "2026-10-20", "runner-up", "Bee", null)).toEqual({
      title: "Daily Loreward 2026-10-20",
      description: "Daily Loreward runner-up, 2026-10-20. Won by Bee.",
      wikiArticleTitle: null,
    });
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

  it("mints a wikios> winner's card owned by the WikiOS account behind the label's edits", async () => {
    entries = [entry({ winnerUser: "wikios>Kir_Republic" })];
    winningEdits.set("Seneca front", ["u2"]);
    await mintTrophyCards(db);
    expect(ownersOf("c1")).toEqual([expect.objectContaining({ ownerId: "u2", serialNumber: 1 })]);
    expect(placeQueries).toEqual([{ author: "Kir_Republic", title: "Seneca front" }]);
  });

  it("mints a plain-named winner's card unowned without a link, even with WikiOS edits on the page", async () => {
    winningEdits.set("Seneca front", ["u2"]);
    await mintTrophyCards(db);
    expect(ownersOf("c1")).toEqual([]);
  });

  it("gives a linked winner a Serialised copy through mintCopy", async () => {
    links.set("Kir Republic", "u1");

    await mintTrophyCards(db);

    expect(jest.mocked(mintCopy)).toHaveBeenCalledWith(expect.anything(), {
      cardId: "c1",
      ownerId: "u1",
      finish: "SERIALISED",
      source: "TROPHY",
    });
    expect(ownersOf("c1")).toEqual([expect.objectContaining({ ownerId: "u1", serialNumber: 1 })]);
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

  it("takes the per-card lock, after the contest place's, before it looks at the card or its owners", async () => {
    links.set("Kir Republic", "u1");

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

  it("grants the card once after a link appears", async () => {
    links.set("Kir Republic", "u1");

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

  it("grants a wikios> winner's card to the WikiOS account behind the label's edits", async () => {
    entries[0]!.winnerUser = "wikios>Kir_Republic";
    winningEdits.set("Seneca front", ["u2", "u2"]);

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 1 });
    expect(ownersOf("c1")).toEqual([expect.objectContaining({ ownerId: "u2", serialNumber: 1 })]);
  });

  it("grants nothing for a plain name without a link, or for a label two accounts share", async () => {
    // A plain name is a MediaWiki editor: WikiOS edits under it on the page prove nothing.
    winningEdits.set("Seneca front", ["u9"]);
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    entries[0]!.winnerUser = "wikios>Kir_Republic";
    winningEdits.set("Seneca front", ["u9", "u3"]);
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
  });

  it("grants nothing for an entry that is no longer approved", async () => {
    links.set("Kir Republic", "u1");
    entries[0]!.status = "rejected";
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
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
    links.set("Kir Republic", "u1");
    await grantUnownedTrophyCards(db);
    expect(creditWrites).toEqual([]);
  });

  it("grants a trophy its place gave up again under its serial, reissued, never a second one", async () => {
    // An override voided the copy (serial 1 lives on in the trail) and cleared the grant
    trail.push({ cardId: "c1", serialNumber: 1 });
    links.set("Kir Republic", "u1");

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
    links.set("Kir Republic", "u1");

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
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

  it("grants one card per contest place, the state-keyed entry's, when the pair has two", async () => {
    entries = weeklyTwins("Kir_Republic", "Kir_Republic");
    cards = [legacyCard("c-ool", "w-ool"), legacyCard("c-state", "w-state")];
    links.set("Kir Republic", "u1");
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 1 });
    expect(ownerships.map((o) => o.cardId)).toEqual(["c-state"]);
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
  });

  it("grants nothing for a place the pair disagrees on", async () => {
    entries = weeklyTwins("Kir_Republic", "Nasastan");
    cards = [legacyCard("c-ool", "w-ool")];
    links.set("Kir Republic", "u1");
    links.set("Nasastan", "u2");
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
  });
});

describe("trophy cards when an override writes the place while a run waits", () => {
  it("mints nothing for a holder the place no longer records once the lock is held", async () => {
    links.set("Kir Republic", "u1");
    const { reread } = distinctTx([entry({ winnerUser: "Cy" })]);

    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards).toEqual([]);
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it("mints when the transaction's re-read still records the listed holder", async () => {
    links.set("Kir Republic", "u1");
    const { reread, listing } = distinctTx([entry()]);

    expect(await mintTrophyCards(db)).toEqual({ minted: 1 });
    expect(ownersOf("c1")).toEqual([expect.objectContaining({ ownerId: "u1" })]);
    expect(reread).toHaveBeenCalledTimes(1);
    // The root client only listed the contests
    expect(listing).toHaveBeenCalledTimes(1);
  });

  it("grants nothing to the listed holder once the place records another", async () => {
    await mintTrophyCards(db);
    links.set("Kir Republic", "u1");
    const { reread } = distinctTx([entry({ winnerUser: "Cy" })]);

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it("grants nothing once the place records nobody", async () => {
    await mintTrophyCards(db);
    links.set("Kir Republic", "u1");
    const { reread } = distinctTx([entry({ winnerUser: null, winnerPage: null })]);

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
    expect(reread).toHaveBeenCalledTimes(1);
  });

  it("grants nothing for a card retired after it was listed", async () => {
    await mintTrophyCards(db);
    links.set("Kir Republic", "u1");
    // Only the transaction's read sees the card retired
    const retiredRead = jest.fn(async (_args: object) => ({ ...cards[0], isRetired: true }));
    distinctTx([entry()], { card: { ...db.card, findUnique: retiredRead } });

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships).toEqual([]);
    expect(retiredRead).toHaveBeenCalledWith({
      where: { id: "c1" },
      select: { metadata: true, isRetired: true },
    });
  });

  it("grants when the transaction's re-read still records the listed holder", async () => {
    await mintTrophyCards(db);
    links.set("Kir Republic", "u1");
    const { reread } = distinctTx([entry()]);

    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 1 });
    expect(reread).toHaveBeenCalledTimes(1);
  });
});

describe("trophy cards under the contest place lock", () => {
  it("takes the contest place's lock, by its identity key, before each re-check", async () => {
    await mintTrophyCards(db);
    expect(contestLocks(db)).toEqual(["daily:2026-10-16:winner"]);
    // The mint's in-lock re-check (does a card of the place exist?) runs after the lock.
    expect(contestLockOrder(db)[0]).toBeLessThan(firstCall(db.card.count)!);

    links.set("Kir Republic", "u1");
    await grantUnownedTrophyCards(db);
    expect(contestLocks(db)).toEqual(["daily:2026-10-16:winner", "daily:2026-10-16:winner"]);
    // The grant's in-lock re-check (is a card of the place owned?) runs after its lock.
    expect(contestLockOrder(db)[1]).toBeLessThan(firstCall(db.cardOwnership.count)!);
  });

  it("mints a linked winner's copy through mintCopy only after the lock and its re-check", async () => {
    links.set("Kir Republic", "u1");
    await mintTrophyCards(db);
    const [copy] = jest.mocked(mintCopy).mock.invocationCallOrder;
    expect(contestLockOrder(db)[0]).toBeLessThan(firstCall(db.card.count)!);
    expect(firstCall(db.card.count)!).toBeLessThan(copy!);
  });

  it("grants the copy through mintCopy only after the lock and its re-check", async () => {
    await mintTrophyCards(db);
    links.set("Kir Republic", "u1");
    await grantUnownedTrophyCards(db);
    const [copy] = jest.mocked(mintCopy).mock.invocationCallOrder;
    expect(contestLockOrder(db)[1]).toBeLessThan(firstCall(db.cardOwnership.count)!);
    expect(firstCall(db.cardOwnership.count)!).toBeLessThan(copy!);
  });

  it("mints nothing when the lock's re-read finds a twin's card this run never listed", async () => {
    // Run B listed [ool, state] and minted the state entry's card; run A listed only [ool], then waited.
    entries = weeklyTwins("Kir_Republic", "Kir_Republic");
    cards = [legacyCard("c-state", "w-state")];
    const findMany = db.lorewardEntry.findMany as unknown as jest.Mock;
    findMany.mockImplementationOnce(async () => [entries[0]]);
    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards.map((card) => card.id)).toEqual(["c-state"]);
  });

  it("mints nothing when another sync minted the contest place's card while it waited", async () => {
    entries = weeklyTwins("Kir_Republic", "Kir_Republic");
    cards = [legacyCard("c-ool", "w-ool")];
    // This run listed the cards before the other sync's insert landed.
    const findMany = db.card.findMany as unknown as jest.Mock;
    findMany.mockImplementationOnce(async () => []);
    expect(await mintTrophyCards(db)).toEqual({ minted: 0 });
    expect(cards).toHaveLength(1);
  });

  it("grants nothing when another sync granted a twin's card while it waited", async () => {
    entries = weeklyTwins("Kir_Republic", "Kir_Republic");
    cards = [legacyCard("c-ool", "w-ool"), legacyCard("c-state", "w-state")];
    links.set("Kir Republic", "u1");
    // This run listed both cards unowned; the other sync then gave c-ool to its holder.
    const findMany = db.card.findMany as unknown as jest.Mock;
    findMany.mockImplementationOnce(async () => {
      const listed = cards.map((card) => ({ ...card }));
      ownerships.push({ id: "o-other", cardId: "c-ool", ownerId: "u1", serialNumber: 1 });
      return listed;
    });
    expect(await grantUnownedTrophyCards(db)).toEqual({ granted: 0 });
    expect(ownerships.map((o) => o.cardId)).toEqual(["c-ool"]);
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
    expect(ownerships.map((o) => o.ownerId)).toEqual(["u1", "u1", "u1"]);
    expect(creditWrites).toEqual([]);
  });

  it("is idempotent: a second apply finds nothing missing", async () => {
    await backfillTrophyCards(db, true);

    expect(await backfillTrophyCards(db, true)).toEqual({ missing: {}, minted: 0, granted: 0 });
    expect(cards).toHaveLength(4);
  });
});
