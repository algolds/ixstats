/** @jest-environment node */
/**
 * cards.getSheetEconomy: signed-in only (the sheet itself is public, M10). The name a signature would freeze comes from
 * the same rule `cards.inscribe` freezes with, which the router reads (card modules may not read identity).
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/modules/identity/identity.player-names", () => ({
  loadPlayerNames: jest.fn(),
}));
jest.mock("~/server/modules/cards/sheet-economy", () => ({ getSheetEconomy: jest.fn() }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardsSheetEconomyRouter } from "~/server/api/routers/cards/sheet-economy";
import { getSheetEconomy } from "~/server/modules/cards/sheet-economy";
import { loadPlayerNames } from "~/server/modules/identity/identity.player-names";
import { createMockPrisma } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const createCaller = createCallerFactory(cardsSheetEconomyRouter);
const signedIn = (db = createMockPrisma()) =>
  createCaller(createMockRouterContext({ db, user: { id: "u1", clerkUserId: "user_1" } }) as never);
const signedOut = () => createCaller(createMockRouterContext({ auth: null, user: null }) as never);

const economy = {
  cardId: "c1",
  isBound: false,
  wishlisted: false,
  signerName: "@ixnay",
  copies: [],
  fusionGroups: [],
  craft: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSheetEconomy).mockResolvedValue(economy);
});

describe("cards.getSheetEconomy", () => {
  it("reads the signed-in viewer's economy, naming them as other players read them", async () => {
    jest
      .mocked(loadPlayerNames)
      .mockResolvedValue(new Map([["u1", { handle: "ixnay", displayName: "@ixnay" }]]));
    const db = createMockPrisma();
    await expect(signedIn(db).getSheetEconomy({ cardId: "c1" })).resolves.toEqual(economy);
    const [passedDb, viewerId, cardId, nameOf] = jest.mocked(getSheetEconomy).mock.calls[0]!;
    expect([passedDb, viewerId, cardId]).toEqual([db, "u1", "c1"]);
    await expect(nameOf("u1")).resolves.toBe("@ixnay");
    expect(loadPlayerNames).toHaveBeenCalledWith(["u1"]);
  });

  it("names nobody who has no name other players can read", async () => {
    await signedIn().getSheetEconomy({ cardId: "c1" });
    const nameOf = jest.mocked(getSheetEconomy).mock.calls[0]![3];
    jest
      .mocked(loadPlayerNames)
      .mockResolvedValue(new Map([["u1", { handle: "user_1", displayName: null }]]));
    await expect(nameOf("u1")).resolves.toBeNull();
    jest.mocked(loadPlayerNames).mockResolvedValue(new Map());
    await expect(nameOf("u1")).resolves.toBeNull();
  });

  it("refuses a signed-out caller", async () => {
    await expect(signedOut().getSheetEconomy({ cardId: "c1" })).rejects.toMatchObject({
      cause: { code: "UNAUTHORIZED" },
    });
    expect(getSheetEconomy).not.toHaveBeenCalled();
  });

  it.each([
    ["no card", ""],
    ["an overlong card id", "c".repeat(65)],
  ])("refuses %s", async (_, cardId) => {
    await expect(signedIn().getSheetEconomy({ cardId })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
