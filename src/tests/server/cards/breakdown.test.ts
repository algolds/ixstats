/** @jest-environment node */
/**
 * Breaking copies down (cards refresh §2.2): each copy burns for its home realm's dust, and its trail and serial stay.
 * Bound, Serialised, signed and locked copies are refused, and so is a copy named in a pending trade offer. The burn's
 * DELETE holds only while every copy is still the player's, unlocked, unsigned and as read, so a race burns nothing and
 * credits nothing. The fake honours every `where` and rolls a throwing transaction back
 * (`~/tests/helpers/fake-workshop-db`).
 */
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { breakDownCopies } from "~/server/modules/cards/workshop/breakdown";
import { WORKSHOP_COPY_SELECT } from "~/server/modules/cards/workshop/copies";
import { DustError, MAX_DUST_BALANCE } from "~/server/modules/cards/workshop/dust-ledger";
import {
  copyOf,
  makeWorkshopDb,
  type FakeCopy,
  type FakeOffer,
} from "~/tests/helpers/fake-workshop-db";

type Fake = ReturnType<typeof makeWorkshopDb>;

const breakDown = ({ db }: Fake, ownershipIds: string[]) =>
  breakDownCopies(db as never, { userId: "u1", ownershipIds });

/** Three realms: a Standard Rare (50 dust), a Foil Common (5 × 3) and an imported Uncommon (15 × 0.25, so 3). */
const threeRealms = () => [
  copyOf("a", { cardId: "c1", serialNumber: 4 }),
  copyOf("b", {
    cardId: "c2",
    serialNumber: 2,
    finish: "FOIL",
    cards: { rarity: "COMMON", realmId: "iiwiki", isBound: false },
  }),
  copyOf("c", {
    cardId: "c3",
    serialNumber: 9,
    importDiscounted: true,
    cards: { rarity: "UNCOMMON", realmId: "nationstates", isBound: false },
  }),
];

/** Someone else's copy, which nothing here may touch. */
const THEIRS = copyOf("z", { ownerId: "u2", cardId: "c1", serialNumber: 1 });

/** Nothing burned, credited or written. */
function expectUntouched(fake: Fake, copies: string[]) {
  expect(fake.world.copies.map((c) => c.id)).toEqual(copies);
  expect(fake.world.balances).toEqual({});
  expect(fake.world.dustEvents).toEqual([]);
  expect(fake.world.events).toEqual([]);
}

beforeEach(() => clearEconomyConfigCache());

describe("breakDownCopies", () => {
  it("burns each copy once for its home realm's dust, one balance per realm and one ledger row per copy", async () => {
    const fake = makeWorkshopDb({
      copies: [...threeRealms(), THEIRS],
      balances: { "u1:default": 100 },
    });
    expect(await breakDown(fake, ["a", "b", "c", "a"])).toEqual({
      broken: 3,
      dust: [
        { realmId: "default", amount: 50 },
        { realmId: "iiwiki", amount: 15 },
        { realmId: "nationstates", amount: 3 },
      ],
    });
    expect(fake.world.copies.map((c) => c.id)).toEqual(["z"]);
    expect(fake.world.balances).toEqual({
      "u1:default": 150,
      "u1:iiwiki": 15,
      "u1:nationstates": 3,
    });
    expect(fake.world.dustEvents).toEqual([
      {
        userId: "u1",
        realmId: "default",
        delta: 50,
        balanceAfter: 150,
        source: "BREAKDOWN",
        cardId: "c1",
        ownershipId: "a",
      },
      {
        userId: "u1",
        realmId: "iiwiki",
        delta: 15,
        balanceAfter: 15,
        source: "BREAKDOWN",
        cardId: "c2",
        ownershipId: "b",
      },
      {
        userId: "u1",
        realmId: "nationstates",
        delta: 3,
        balanceAfter: 3,
        source: "BREAKDOWN",
        cardId: "c3",
        ownershipId: "c",
      },
    ]);
  });

  it("keeps each burned copy's serial and finish in its trail", async () => {
    const fake = makeWorkshopDb({ copies: threeRealms() });
    await breakDown(fake, ["a", "b", "c"]);
    const burn = { fromUserId: "u1", toUserId: null, action: "BREAKDOWN" };
    // ownershipId goes null with the copy (ON DELETE SET NULL); the card and serial keep the trail
    expect(fake.world.events).toEqual([
      { ownershipId: null, cardId: "c2", serialNumber: 2, finish: "FOIL", ...burn },
      { ownershipId: null, cardId: "c1", serialNumber: 4, finish: "STANDARD", ...burn },
      { ownershipId: null, cardId: "c3", serialNumber: 9, finish: "STANDARD", ...burn },
    ]);
    expect(
      fake.tx.cardTransferEvent.createMany.mock.calls[0]![0].data.map((e) => e.ownershipId)
    ).toEqual(["b", "a", "c"]);
  });

  it("stamps a copy's older events with its card and serial before it goes", async () => {
    const legacy = { ownershipId: "a", cardId: null, serialNumber: null, action: "PACK_OPEN" };
    const fake = makeWorkshopDb({ copies: threeRealms(), events: [legacy] });
    await breakDown(fake, ["a"]);
    expect(fake.tx.cardTransferEvent.updateMany).toHaveBeenCalledWith({
      where: { ownershipId: "a", cardId: null },
      data: { cardId: "c1", serialNumber: 4 },
    });
    expect(fake.world.events[0]).toEqual({
      ownershipId: null,
      cardId: "c1",
      serialNumber: 4,
      action: "PACK_OPEN",
    });
  });

  it("credits the dust first, then takes each card's serial lock once in card order, then burns", async () => {
    const fake = makeWorkshopDb({
      copies: [
        copyOf("a", { cardId: "c2", serialNumber: 1 }),
        copyOf("b", { cardId: "c1", serialNumber: 2 }),
        copyOf("c", { cardId: "c2", serialNumber: 3 }),
      ],
    });
    await breakDown(fake, ["a", "b", "c"]);
    expect(fake.world.locks).toEqual(["7331:c1", "7331:c2"]);
    const { tx } = fake;
    const order = [
      tx.$queryRaw.mock.invocationCallOrder[0]!,
      tx.$executeRaw.mock.invocationCallOrder[0]!,
      tx.$executeRaw.mock.invocationCallOrder[1]!,
      tx.cardTransferEvent.createMany.mock.invocationCallOrder[0]!,
      tx.cardOwnership.deleteMany.mock.invocationCallOrder[0]!,
    ];
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("burns in one statement that holds only while each copy is still the player's, unlocked, unsigned and as read", async () => {
    const fake = makeWorkshopDb({ copies: threeRealms() });
    await breakDown(fake, ["a", "b", "c"]);
    expect(fake.tx.cardOwnership.deleteMany).toHaveBeenCalledTimes(1);
    expect(fake.tx.cardOwnership.deleteMany).toHaveBeenCalledWith({
      where: {
        ownerId: "u1",
        isLocked: false,
        inscription: null,
        OR: [
          { id: "b", finish: "FOIL", importDiscounted: false },
          { id: "a", finish: "STANDARD", importDiscounted: false },
          { id: "c", finish: "STANDARD", importDiscounted: true },
        ],
      },
    });
  });

  it("reads the copies as the player's own, with no signer columns", async () => {
    const fake = makeWorkshopDb({ copies: threeRealms() });
    await breakDown(fake, ["a", "b"]);
    expect(fake.tx.cardOwnership.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] }, ownerId: "u1" },
      select: WORKSHOP_COPY_SELECT,
      orderBy: [{ serialNumber: "asc" }, { id: "asc" }],
    });
    expect(WORKSHOP_COPY_SELECT).not.toHaveProperty("inscribedById");
    expect(WORKSHOP_COPY_SELECT).not.toHaveProperty("inscribedName");
  });

  it.each<[string, Partial<FakeCopy>, string]>([
    [
      "signed",
      { inscription: "gg", inscribedById: "u9", inscribedName: "@nine" },
      "Signed copies can't be broken down.",
    ],
    ["Serialised", { finish: "SERIALISED" }, "Serialised copies can't be broken down."],
    [
      "listed, auctioned or offered",
      { isLocked: true },
      "A copy that is listed or in a trade can't be broken down.",
    ],
    [
      "bound",
      { cards: { rarity: "RARE", realmId: "default", isBound: true } },
      "Bound cards can't be broken down.",
    ],
  ])(
    "refuses a %s copy and burns nothing, the rest of the batch included",
    async (_label, over, message) => {
      const fake = makeWorkshopDb({
        copies: [copyOf("ok", { serialNumber: 1 }), copyOf("x", { cardId: "c9", ...over })],
      });
      await expect(breakDown(fake, ["ok", "x"])).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
        message,
      });
      // A signed copy keeps its inscription: a burn never takes one with it
      expect(fake.world.copies.find((c) => c.id === "x")).toMatchObject(over);
      expectUntouched(fake, ["ok", "x"]);
    }
  );

  it.each<[string, FakeOffer]>([
    ["asked for in", { status: "PENDING", initiatorCardIds: ["q"], recipientCardIds: ["p", "a"] }],
    ["offered in", { status: "PENDING", initiatorCardIds: ["a"], recipientCardIds: [] }],
  ])("refuses an unlocked copy %s a pending trade offer", async (_label, offer) => {
    const fake = makeWorkshopDb({ copies: threeRealms(), offers: [offer] });
    await expect(breakDown(fake, ["b", "a"])).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "A copy that is listed or in a trade can't be broken down.",
    });
    expect(fake.tx.tradeOffer.count).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        OR: [
          { initiatorCardIds: { array_contains: ["b"] } },
          { recipientCardIds: { array_contains: ["b"] } },
          { initiatorCardIds: { array_contains: ["a"] } },
          { recipientCardIds: { array_contains: ["a"] } },
        ],
      },
    });
    expectUntouched(fake, ["a", "b", "c"]);
  });

  it("breaks down a copy whose offer was answered", async () => {
    const offer = { status: "ACCEPTED", initiatorCardIds: ["a"], recipientCardIds: [] };
    const fake = makeWorkshopDb({ copies: threeRealms(), offers: [offer] });
    expect(await breakDown(fake, ["a"])).toEqual({
      broken: 1,
      dust: [{ realmId: "default", amount: 50 }],
    });
  });

  it.each([
    ["someone else's", ["a", "z"]],
    ["a copy that does not exist", ["a", "nope"]],
  ])("refuses %s copy", async (_label, ids) => {
    const fake = makeWorkshopDb({ copies: [...threeRealms(), THEIRS] });
    await expect(breakDown(fake, ids)).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Some of these copies are no longer yours.",
    });
    expectUntouched(fake, ["a", "b", "c", "z"]);
  });

  it.each<[string, Partial<FakeCopy>]>([
    ["listed", { isLocked: true }],
    ["sold or traded away", { ownerId: "u2" }],
    ["signed", { inscription: "gg" }],
    ["fused up a finish", { finish: "FOIL" }],
    ["fused with an imported copy", { importDiscounted: true }],
  ])(
    "burns nothing and credits nothing when a copy was %s after it was read",
    async (_label, change) => {
      const fake = makeWorkshopDb({ copies: threeRealms() });
      const read = fake.tx.cardOwnership.findMany.getMockImplementation()!;
      fake.tx.cardOwnership.findMany.mockImplementationOnce(async (args) => {
        const rows = await read(args);
        Object.assign(fake.world.copies[0]!, change);
        return rows;
      });
      await expect(breakDown(fake, ["a", "b", "c"])).rejects.toMatchObject({
        code: "CONFLICT",
        message: "These copies changed while you were breaking them down.",
      });
      expect(fake.world.balances).toEqual({});
      expect(fake.world.dustEvents).toEqual([]);
      expect(fake.world.events).toEqual([]);
    }
  );

  it("credits nothing on a second break-down of the same copies", async () => {
    const fake = makeWorkshopDb({ copies: threeRealms() });
    await breakDown(fake, ["a"]);
    await expect(breakDown(fake, ["a"])).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(fake.world.balances).toEqual({ "u1:default": 50 });
  });

  it("burns a copy that fills the realm's dust to the ceiling, and refuses one that would pass it", async () => {
    const fills = makeWorkshopDb({
      copies: threeRealms(),
      balances: { "u1:default": MAX_DUST_BALANCE - 50 },
    });
    await breakDown(fills, ["a"]);
    expect(fills.world.balances["u1:default"]).toBe(MAX_DUST_BALANCE);

    const passes = makeWorkshopDb({
      copies: threeRealms(),
      balances: { "u1:default": MAX_DUST_BALANCE - 49 },
    });
    await expect(breakDown(passes, ["b", "a"])).rejects.toBeInstanceOf(DustError);
    expect(passes.world.copies.map((c) => c.id)).toEqual(["a", "b", "c"]);
    expect(passes.world.balances).toEqual({ "u1:default": MAX_DUST_BALANCE - 49 });
    expect(passes.world.events).toEqual([]);
  });

  it("uses the Economy tab's dust numbers", async () => {
    const fake = makeWorkshopDb({
      copies: threeRealms(),
      config: [
        { key: "card_economy_dust_rare", value: "70" },
        { key: "card_economy_dust_common", value: "4" },
      ],
    });
    expect((await breakDown(fake, ["a", "b"])).dust).toEqual([
      { realmId: "default", amount: 70 },
      { realmId: "iiwiki", amount: 12 },
    ]);
  });
});
