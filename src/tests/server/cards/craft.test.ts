/** @jest-environment node */
/**
 * Crafting (cards refresh §2.2): any catalogue card of a realm up to Epic, for that realm's dust (8× the Standard
 * yield) plus the rarity floor in IxC, minted Standard. Inside one transaction the craft spends credits (the my_vault
 * row), then dust (the dust row), then takes capacity (7334) and mints (7331), the lock order every other path keeps.
 * The doubles write a world only through `tx`, and a throwing transaction puts the world back (a rollback), so a
 * refusal at any step charges nothing.
 */
jest.mock("~/lib/cards/capacity", () => ({
  ...jest.requireActual<typeof import("~/lib/cards/capacity")>("~/lib/cards/capacity"),
  assertCapacityTx: jest.fn(),
}));
jest.mock("~/lib/cards/mint", () => ({ mintCopy: jest.fn() }));
jest.mock("~/lib/vault/vault-ledger", () => ({
  ...jest.requireActual<typeof import("~/lib/vault/vault-ledger")>("~/lib/vault/vault-ledger"),
  spendCreditsTx: jest.fn(),
}));
jest.mock("~/server/modules/cards/workshop/dust-ledger", () => ({ spendDustTx: jest.fn() }));

import { Prisma, type CardRarity, type CardType } from "@prisma/client";
import { assertCapacityTx, CapacityError } from "~/lib/cards/capacity";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { mintCopy } from "~/lib/cards/mint";
import { clearValuationCache } from "~/lib/cards/valuation";
import { LedgerError, spendCreditsTx } from "~/lib/vault/vault-ledger";
import { craftCard, craftOfferFor } from "~/server/modules/cards/workshop/craft";
import { spendDustTx } from "~/server/modules/cards/workshop/dust-ledger";
import { DustError } from "~/server/modules/cards/workshop/errors";

interface CardRow {
  id: string;
  title: string;
  rarity: CardRarity;
  cardType: CardType;
  isBound: boolean;
  isRetired: boolean;
  realmId: string;
  reviewState: string;
  realm: { status: string };
}

/** The `where` shapes a catalogue read can send, honoured as Postgres reads them. */
interface CardWhere {
  id?: string;
  reviewState?: string;
  isRetired?: boolean;
  realm?: { status?: { notIn?: string[] } };
}

const CARD: CardRow = {
  id: "c1",
  title: "Aurelia",
  rarity: "EPIC",
  cardType: "LORE",
  isBound: false,
  isRetired: false,
  realmId: "default",
  reviewState: "APPROVED",
  realm: { status: "published" },
};

const matches = (card: CardRow, where: CardWhere) =>
  (where.id === undefined || card.id === where.id) &&
  (where.reviewState === undefined || card.reviewState === where.reviewState) &&
  (where.isRetired === undefined || card.isRetired === where.isRetired) &&
  !(where.realm?.status?.notIn?.includes(card.realm.status) ?? false);

/** Only the columns a `select` asks for, so a column the read leaves out stays out. */
const project = (card: CardRow, select: Record<string, boolean>) =>
  Object.fromEntries(Object.entries(card).filter(([key]) => select[key] === true));

function makeDb(
  card: CardRow = CARD,
  over: { config?: Array<{ key: string; value: string }>; dust?: number | null } = {}
) {
  const world = { credits: 5000, dust: 5000, copies: [] as string[] };
  /** The steps the transaction ran, in order; a rollback keeps it. */
  const log: string[] = [];
  const tx = { client: "tx" };
  const inTx = (client: object) => {
    if (!Object.is(client, tx)) throw new Error("written outside the transaction");
  };
  jest.mocked(spendCreditsTx).mockImplementation(async (client, input) => {
    inTx(client);
    log.push("credits");
    world.credits -= input.amount;
    return { newBalance: world.credits, amount: input.amount };
  });
  jest.mocked(spendDustTx).mockImplementation(async (client, input) => {
    inTx(client);
    log.push("dust");
    world.dust -= input.amount;
    return world.dust;
  });
  jest.mocked(assertCapacityTx).mockImplementation(async (client) => {
    inTx(client);
    log.push("capacity");
  });
  jest.mocked(mintCopy).mockImplementation(async (client) => {
    inTx(client);
    log.push("mint");
    world.copies.push("own_new");
    return { id: "own_new" } as never;
  });
  const db = {
    systemConfig: { findMany: jest.fn(async () => over.config ?? []) },
    card: {
      findFirst: jest.fn(
        async ({ where, select }: { where: CardWhere; select: Record<string, boolean> }) =>
          [card].filter((c) => matches(c, where)).map((c) => project(c, select))[0] ?? null
      ),
    },
    cardDustBalance: {
      findUnique: jest.fn(async () => (over.dust === null ? null : { balance: over.dust ?? 5000 })),
    },
    $transaction: jest.fn(async <T>(work: (client: typeof tx) => Promise<T>) => {
      const before = structuredClone(world);
      try {
        return await work(tx);
      } catch (error) {
        Object.assign(world, before);
        throw error;
      }
    }),
  };
  return { db, tx, world, log };
}

type Fake = ReturnType<typeof makeDb>;

const craft = ({ db }: Fake) => craftCard(db as never, { userId: "u1", cardId: "c1" });

const UNTOUCHED = { credits: 5000, dust: 5000, copies: [] };

/** Refused before the transaction opens: nothing spent, locked or minted. */
function expectNothingStarted(fake: Fake) {
  expect(fake.world).toEqual(UNTOUCHED);
  expect(fake.log).toEqual([]);
  expect(fake.db.$transaction).not.toHaveBeenCalled();
}

beforeEach(() => {
  jest.clearAllMocks();
  clearEconomyConfigCache();
  clearValuationCache();
});

describe("craftCard", () => {
  it("spends the rarity floor, then the realm's dust, then takes capacity and mints a Standard copy", async () => {
    const fake = makeDb();
    expect(await craft(fake)).toEqual({ ownershipId: "own_new", dust: 4000, credits: 1000 });
    expect(spendCreditsTx).toHaveBeenCalledWith(fake.tx, {
      userId: "u1",
      amount: 1000,
      type: "SPEND_CRAFT",
      source: "card_craft",
      metadata: { cardId: "c1", cardTitle: "Aurelia", dust: 4000 },
    });
    expect(spendDustTx).toHaveBeenCalledWith(fake.tx, {
      userId: "u1",
      realmId: "default",
      amount: 4000,
      source: "CRAFT",
      cardId: "c1",
    });
    expect(assertCapacityTx).toHaveBeenCalledWith(fake.tx, "u1", 1);
    expect(mintCopy).toHaveBeenCalledWith(fake.tx, {
      cardId: "c1",
      ownerId: "u1",
      source: "CRAFT",
      finish: "STANDARD",
    });
    expect(fake.db.$transaction).toHaveBeenCalledTimes(1);
    expect(fake.world).toEqual({ credits: 4000, dust: 1000, copies: ["own_new"] });
  });

  it("keeps the lock order: my_vault row, dust row, capacity (7334), serials (7331)", async () => {
    const fake = makeDb();
    await craft(fake);
    expect(fake.log).toEqual(["credits", "dust", "capacity", "mint"]);
  });

  it("prices the craft from the Economy tab and the valuation floors as stored, a part credit too", async () => {
    const fake = makeDb(CARD, {
      config: [
        { key: "card_economy_craft_dust_mult", value: "2" },
        { key: "card_valuation_floor_epic", value: "0.5" },
      ],
    });
    expect(await craft(fake)).toEqual({ ownershipId: "own_new", dust: 1000, credits: 0.5 });
    expect(fake.world).toEqual({ credits: 4999.5, dust: 4000, copies: ["own_new"] });
  });

  it("charges no credits for a floor of nothing (the ledger refuses a spend of 0)", async () => {
    const fake = makeDb(CARD, { config: [{ key: "card_valuation_floor_epic", value: "0" }] });
    expect(await craft(fake)).toEqual({ ownershipId: "own_new", dust: 4000, credits: 0 });
    expect(fake.log).toEqual(["dust", "capacity", "mint"]);
    expect(fake.world).toEqual({ credits: 5000, dust: 1000, copies: ["own_new"] });
  });

  it.each<[string, Partial<CardRow>, string]>([
    ["a Legendary card", { rarity: "LEGENDARY" }, "Legendary cards can't be crafted."],
    ["a bound card", { isBound: true }, "This card can't be crafted."],
    ["a Special event card", { cardType: "SPECIAL" }, "This card can't be crafted."],
    ["a trophy", { cardType: "TROPHY" }, "This card can't be crafted."],
  ])("refuses %s before anything is spent", async (_label, over, message) => {
    const fake = makeDb({ ...CARD, ...over });
    await expect(craft(fake)).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message });
    expectNothingStarted(fake);
  });

  it.each<[string, Partial<CardRow>]>([
    ["waiting in review", { reviewState: "PENDING" }],
    ["retired", { isRetired: true }],
    ["in a draft realm", { realm: { status: "draft" } }],
    ["in a realm still generating", { realm: { status: "generating" } }],
    ["unknown", { id: "c2" }],
  ])("refuses a card %s as not found", async (_label, over) => {
    const fake = makeDb({ ...CARD, ...over });
    await expect(craft(fake)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "This card can't be crafted right now.",
    });
    expectNothingStarted(fake);
  });

  it("charges nothing when the collection is full: the credit and dust spends roll back", async () => {
    const fake = makeDb();
    jest.mocked(assertCapacityTx).mockRejectedValueOnce(new CapacityError(0));
    await expect(craft(fake)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: new CapacityError(0).message,
    });
    expect(fake.log).toEqual(["credits", "dust"]);
    expect(fake.world).toEqual(UNTOUCHED);
  });

  it("spends no dust and mints nothing when the credits fall short", async () => {
    const fake = makeDb();
    jest
      .mocked(spendCreditsTx)
      .mockRejectedValueOnce(new LedgerError("INSUFFICIENT_CREDITS", "Insufficient credits."));
    await expect(craft(fake)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Insufficient credits.",
    });
    expect(fake.log).toEqual([]);
    expect(fake.world).toEqual(UNTOUCHED);
  });

  it("gives the credits back and mints nothing when the dust falls short", async () => {
    const fake = makeDb();
    jest
      .mocked(spendDustTx)
      .mockRejectedValueOnce(new DustError("You need 4000 dust from this card's realm."));
    await expect(craft(fake)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "You need 4000 dust from this card's realm.",
    });
    expect(fake.log).toEqual(["credits"]);
    expect(fake.world).toEqual(UNTOUCHED);
  });

  it("asks the player to try again after a lost deadlock, with everything rolled back", async () => {
    const fake = makeDb();
    jest.mocked(mintCopy).mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Transaction failed due to a deadlock", {
        code: "P2034",
        clientVersion: "test",
      })
    );
    await expect(craft(fake)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(fake.log).toEqual(["credits", "dust", "capacity"]);
    expect(fake.world).toEqual(UNTOUCHED);
  });
});

describe("craftOfferFor", () => {
  it("offers the quote with the player's dust in the card's realm", async () => {
    const fake = makeDb(CARD, { dust: 1200 });
    expect(await craftOfferFor(fake.db as never, "u1", "c1")).toEqual({
      cardId: "c1",
      realmId: "default",
      verdict: { ok: true },
      quote: { dust: 4000, credits: 1000 },
      dust: 1200,
    });
    expect(fake.db.cardDustBalance.findUnique).toHaveBeenCalledWith({
      where: { userId_realmId: { userId: "u1", realmId: "default" } },
      select: { balance: true },
    });
  });

  it("gives the verdict for an uncraftable card, and no dust as 0", async () => {
    const fake = makeDb({ ...CARD, rarity: "LEGENDARY", realmId: "iiwiki" }, { dust: null });
    expect(await craftOfferFor(fake.db as never, "u1", "c1")).toEqual({
      cardId: "c1",
      realmId: "iiwiki",
      verdict: { ok: false, reason: "Legendary cards can't be crafted." },
      quote: { dust: 12000, credits: 3000 },
      dust: 0,
    });
  });

  it("has no offer for a card outside the catalogue", async () => {
    const fake = makeDb({ ...CARD, reviewState: "PENDING" });
    expect(await craftOfferFor(fake.db as never, "u1", "c1")).toBeNull();
    expect(fake.db.cardDustBalance.findUnique).not.toHaveBeenCalled();
  });
});
