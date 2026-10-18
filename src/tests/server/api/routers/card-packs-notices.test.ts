/** @jest-environment node */
/** Pack notices go in their own category, in sentence case, and a failed notice never fails the purchase or open. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cards/pack-service", () => ({
  ...jest.requireActual<typeof import("~/lib/cards/pack-service")>("~/lib/cards/pack-service"),
  purchasePack: jest.fn(async () => ({ id: "up1" })),
  openPack: jest.fn(async () => [
    { card: { id: "c1", rarity: "COMMON" }, ownershipId: "o1" },
    { card: { id: "c2", rarity: "EPIC" }, ownershipId: "o2" },
  ]),
}));
jest.mock("~/lib/cards/hub/faces", () => ({ ownedFaces: jest.fn(async () => []) }));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardPacksUserRouter } from "~/server/api/routers/card-packs/user";
import { openPack } from "~/lib/cards/pack-service";
import { notificationAPI } from "~/lib/notifications/api";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const create = jest.mocked(notificationAPI.create);
const caller = () =>
  createCallerFactory(cardPacksUserRouter)(
    createMockRouterContext({
      db: createMockPrisma(),
      user: { id: "db_me", clerkUserId: "c" },
      rateLimitIdentifier: `me_${Math.random()}`,
    }) as never
  );

beforeEach(() => create.mockReset().mockResolvedValue("n1"));

describe("pack notices", () => {
  it("tells the buyer their pack is ready, in the packs category", async () => {
    await caller().purchasePack({ packId: "pack_1" });
    expect(create).toHaveBeenCalledWith({
      userId: "db_me",
      title: "Pack bought",
      message: "Your card pack is ready to open.",
      type: "info",
      priority: "medium",
      category: "packs",
      source: "cards",
      href: null,
      metadata: { packId: "pack_1" },
    });
  });

  it("names the best pull of an opened pack by its label", async () => {
    await caller().openPack({ userPackId: "cm0000000000000000000000a" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Cards revealed",
        message: "2 cards. Best: Epic.",
        category: "packs",
        priority: "high",
        metadata: { cardCount: 2, bestRarity: "EPIC" },
      })
    );
  });

  it("counts a one-card pack in the singular", async () => {
    // The router reads only each pull's rarity and copy.
    jest
      .mocked(openPack)
      .mockResolvedValueOnce([
        { card: { id: "c3", rarity: "ULTRA_RARE" }, ownershipId: "o3" },
      ] as never);
    await caller().openPack({ userPackId: "cm0000000000000000000000a" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ message: "1 card. Best: Ultra Rare.", priority: "medium" })
    );
  });

  it("still completes the purchase when the notice fails", async () => {
    create.mockRejectedValueOnce(new Error("down"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(caller().purchasePack({ packId: "pack_1" })).resolves.toMatchObject({
        success: true,
      });
    } finally {
      warn.mockRestore();
    }
  });
});
