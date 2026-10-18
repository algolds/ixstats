/** @jest-environment node */
/**
 * Fusing copies (cards refresh §2.2): the Economy tab's number of copies of one card at one finish become one copy at
 * the next finish. The lowest serial is kept and upgraded in place, keeping its level, and the others burn with their
 * trail and serials. A fused copy is import-discounted when any input was. Bound, Serialised, signed, locked and
 * offered copies are refused. The burn and the upgrade each hold only while their copies are as read, and a lost race
 * rolls the whole fusion back. The fake honours every `where` (`~/tests/helpers/fake-workshop-db`).
 */
jest.mock("~/lib/cards/dust", () => {
  const actual = jest.requireActual<typeof import("~/lib/cards/dust")>("~/lib/cards/dust");
  return { ...actual, fusionBlocker: jest.fn(actual.fusionBlocker) };
});

import { fusionBlocker } from "~/lib/cards/dust";
import { clearEconomyConfigCache } from "~/lib/cards/economy-config";
import { fuseCopies } from "~/server/modules/cards/workshop/fusion";
import {
  copyOf,
  makeWorkshopDb,
  type FakeCopy,
  type FakeOffer,
} from "~/tests/helpers/fake-workshop-db";

type Fake = ReturnType<typeof makeWorkshopDb>;

const fuse = ({ db }: Fake, ownershipIds: string[]) =>
  fuseCopies(db as never, { userId: "u1", ownershipIds });

/** Three Standard copies of card c1, serials 3, 7 and 12, the lowest at level 4. */
const trio = (over: Partial<Record<"low" | "mid" | "high", Partial<FakeCopy>>> = {}) => [
  copyOf("high", { serialNumber: 12, ...over.high }),
  copyOf("low", { serialNumber: 3, level: 4, ...over.low }),
  copyOf("mid", { serialNumber: 7, ...over.mid }),
];

const THEIRS = copyOf("z", { ownerId: "u2", serialNumber: 1 });

/** Nothing burned, upgraded or written. */
function expectUntouched(fake: Fake) {
  expect(fake.world.copies).toEqual(trio());
  expect(fake.world.events).toEqual([]);
}

beforeEach(() => clearEconomyConfigCache());

describe("fuseCopies", () => {
  it("keeps the lowest serial, upgrades it one finish in place and burns the others", async () => {
    const fake = makeWorkshopDb({ copies: [...trio(), THEIRS] });
    expect(await fuse(fake, ["high", "low", "mid", "low"])).toEqual({
      ownershipId: "low",
      finish: "FOIL",
      serialNumber: 3,
    });
    // The kept copy keeps its own level; only its finish (and discount) change
    expect(fake.world.copies).toEqual([
      copyOf("low", { serialNumber: 3, level: 4, finish: "FOIL" }),
      THEIRS,
    ]);
    expect(fake.tx.cardOwnership.updateMany).toHaveBeenCalledWith({
      where: {
        id: "low",
        ownerId: "u1",
        isLocked: false,
        inscription: null,
        finish: "STANDARD",
        importDiscounted: false,
      },
      data: { finish: "FOIL", importDiscounted: false },
    });
    expect(fake.tx.cardOwnership.deleteMany).toHaveBeenCalledWith({
      where: {
        ownerId: "u1",
        isLocked: false,
        inscription: null,
        OR: [
          { id: "mid", finish: "STANDARD", importDiscounted: false },
          { id: "high", finish: "STANDARD", importDiscounted: false },
        ],
      },
    });
  });

  it("keeps the trail: a FUSE row for each burned copy with its serial, and one for the kept copy at its new finish", async () => {
    const legacy = { ownershipId: "mid", cardId: null, serialNumber: null, action: "PACK_OPEN" };
    const fake = makeWorkshopDb({ copies: trio(), events: [legacy] });
    await fuse(fake, ["high", "low", "mid"]);
    const burned = { finish: "STANDARD", fromUserId: "u1", toUserId: null, action: "FUSE" };
    expect(fake.world.events).toEqual([
      { ownershipId: null, cardId: "c1", serialNumber: 7, action: "PACK_OPEN" },
      { ownershipId: null, cardId: "c1", serialNumber: 7, ...burned },
      { ownershipId: null, cardId: "c1", serialNumber: 12, ...burned },
      {
        ownershipId: "low",
        cardId: "c1",
        serialNumber: 3,
        finish: "FOIL",
        fromUserId: "u1",
        toUserId: "u1",
        action: "FUSE",
        price: null,
      },
    ]);
    expect(fake.world.locks).toEqual(["7331:c1"]);
  });

  it("takes the card's serial lock before it burns, and burns before it upgrades", async () => {
    const fake = makeWorkshopDb({ copies: trio() });
    await fuse(fake, ["high", "low", "mid"]);
    const { tx } = fake;
    const order = [
      tx.$executeRaw.mock.invocationCallOrder[0]!,
      tx.cardOwnership.deleteMany.mock.invocationCallOrder[0]!,
      tx.cardOwnership.updateMany.mock.invocationCallOrder[0]!,
      tx.cardTransferEvent.create.mock.invocationCallOrder[0]!,
    ];
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("fuses Foil into Holo", async () => {
    const foil = { finish: "FOIL" } as const;
    const fake = makeWorkshopDb({ copies: trio({ low: foil, mid: foil, high: foil }) });
    expect(await fuse(fake, ["high", "low", "mid"])).toMatchObject({ finish: "HOLO" });
  });

  it.each<[string, Partial<Record<"low" | "mid" | "high", Partial<FakeCopy>>>, boolean]>([
    ["the kept copy was imported", { low: { importDiscounted: true } }, true],
    ["a burned copy was imported", { mid: { importDiscounted: true } }, true],
    ["the last copy was imported", { high: { importDiscounted: true } }, true],
    [
      "every copy was imported",
      {
        low: { importDiscounted: true },
        mid: { importDiscounted: true },
        high: { importDiscounted: true },
      },
      true,
    ],
    ["no copy was imported", {}, false],
  ])("is import-discounted when %s", async (_label, over, discounted) => {
    const fake = makeWorkshopDb({ copies: trio(over) });
    await fuse(fake, ["high", "low", "mid"]);
    expect(fake.world.copies).toEqual([
      expect.objectContaining({ id: "low", finish: "FOIL", importDiscounted: discounted }),
    ]);
  });

  it("takes the Economy tab's number of copies", async () => {
    const fake = makeWorkshopDb({
      copies: trio().slice(0, 2),
      config: [{ key: "card_economy_fusion_copies", value: "2" }],
    });
    expect(await fuse(fake, ["high", "low"])).toEqual({
      ownershipId: "low",
      finish: "FOIL",
      serialNumber: 3,
    });
  });

  it.each<[string, Partial<Record<"low" | "mid" | "high", Partial<FakeCopy>>>, string]>([
    [
      "a different finish",
      { high: { finish: "FOIL" } },
      "Fuse copies of one card at the same finish.",
    ],
    ["a different card", { mid: { cardId: "c2" } }, "Fuse copies of one card at the same finish."],
    ["a signed copy", { mid: { inscription: "gg" } }, "Signed copies can't be fused."],
    [
      "a locked copy",
      { high: { isLocked: true } },
      "A copy that is listed or in a trade can't be fused.",
    ],
    [
      "bound copies",
      { low: { cards: { rarity: "RARE", realmId: "default", isBound: true } } },
      "Bound cards can't be fused.",
    ],
    [
      "Holo copies",
      { low: { finish: "HOLO" }, mid: { finish: "HOLO" }, high: { finish: "HOLO" } },
      "Holo is the highest finish fusing reaches.",
    ],
  ])("refuses %s and changes nothing", async (_label, over, message) => {
    const fake = makeWorkshopDb({ copies: trio(over) });
    await expect(fuse(fake, ["high", "low", "mid"])).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message,
    });
    expect(fake.world.copies).toEqual(trio(over));
    expect(fake.world.events).toEqual([]);
  });

  it("refuses a set with no next finish even if the fusion rule stops refusing it, and changes nothing", async () => {
    const holo = { finish: "HOLO" } as const;
    const fake = makeWorkshopDb({ copies: trio({ low: holo, mid: holo, high: holo }) });
    jest.mocked(fusionBlocker).mockReturnValueOnce(null);
    await expect(fuse(fake, ["high", "low", "mid"])).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "These copies can't be fused any further.",
    });
    expect(fake.world.copies).toEqual(trio({ low: holo, mid: holo, high: holo }));
    expect(fake.world.events).toEqual([]);
    expect(fake.world.locks).toEqual([]);
  });

  it.each([
    ["two copies", ["low", "mid"]],
    ["three ids naming two copies", ["low", "mid", "low"]],
  ])("refuses %s", async (_label, ids) => {
    const fake = makeWorkshopDb({ copies: trio() });
    await expect(fuse(fake, ids)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Fusing takes 3 copies.",
    });
    expectUntouched(fake);
  });

  it.each<[string, FakeOffer]>([
    ["asked for in", { status: "PENDING", initiatorCardIds: [], recipientCardIds: ["mid"] }],
    ["offered in", { status: "PENDING", initiatorCardIds: ["high"], recipientCardIds: [] }],
  ])("refuses an unlocked copy %s a pending trade offer", async (_label, offer) => {
    const fake = makeWorkshopDb({ copies: trio(), offers: [offer] });
    await expect(fuse(fake, ["high", "low", "mid"])).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "A copy that is listed or in a trade can't be fused.",
    });
    expectUntouched(fake);
  });

  it("refuses copies that are not the player's", async () => {
    const fake = makeWorkshopDb({ copies: [...trio(), THEIRS] });
    await expect(fuse(fake, ["low", "mid", "z"])).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Some of these copies are no longer yours.",
    });
    expect(fake.world.copies).toEqual([...trio(), THEIRS]);
  });

  it.each<[string, "low" | "mid", Partial<FakeCopy>]>([
    ["a burned copy was listed", "mid", { isLocked: true }],
    ["a burned copy was traded away", "mid", { ownerId: "u2" }],
    ["a burned copy was fused elsewhere", "mid", { finish: "FOIL" }],
    ["the kept copy was listed", "low", { isLocked: true }],
    ["the kept copy was traded away", "low", { ownerId: "u2" }],
    ["the kept copy was signed", "low", { inscription: "gg" }],
    ["the kept copy was fused elsewhere", "low", { finish: "FOIL" }],
    ["the kept copy was marked imported", "low", { importDiscounted: true }],
  ])("rolls the whole fusion back when %s after the read", async (_label, id, change) => {
    const fake = makeWorkshopDb({ copies: trio() });
    const read = fake.tx.cardOwnership.findMany.getMockImplementation()!;
    fake.tx.cardOwnership.findMany.mockImplementationOnce(async (args) => {
      const rows = await read(args);
      Object.assign(
        fake.world.copies.find((c) => c.id === id)!,
        change
      );
      return rows;
    });
    await expect(fuse(fake, ["high", "low", "mid"])).rejects.toMatchObject({
      code: "CONFLICT",
      message: "These copies changed while you were fusing them.",
    });
    expectUntouched(fake);
  });
});
