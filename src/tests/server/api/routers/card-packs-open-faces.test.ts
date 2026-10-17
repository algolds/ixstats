/** @jest-environment node */
/** openPack returns the faces of the copies it minted, in pull order, with their art. */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/cards/pack-service", () => ({
  ...jest.requireActual<typeof import("~/lib/cards/pack-service")>("~/lib/cards/pack-service"),
  openPack: jest.fn(async () => [
    { card: { id: "c1", rarity: "COMMON" }, ownershipId: "o1" },
    { card: { id: "c2", rarity: "EPIC" }, ownershipId: "o2" },
  ]),
}));
jest.mock("~/lib/cards/hub/faces", () => ({
  ownedFaces: jest.fn(async () => [{ cardId: "c1" }, { cardId: "c2" }]),
}));
jest.mock("~/lib/notifications/api", () => ({ notificationAPI: { create: jest.fn() } }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import { createCallerFactory } from "~/server/api/trpc";
import { cardPacksUserRouter } from "~/server/api/routers/card-packs/user";
import { ownedFaces } from "~/lib/cards/hub/faces";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

describe("cardPacks.openPack", () => {
  it("returns the minted copies as faces", async () => {
    const db = createMockPrisma();
    const caller = createCallerFactory(cardPacksUserRouter)(
      createMockRouterContext({
        db,
        user: { id: "db_me", clerkUserId: "c" },
        rateLimitIdentifier: `me_${Math.random()}`,
      }) as never
    );
    const result = await caller.openPack({ userPackId: "cm0000000000000000000000a" });
    expect(ownedFaces).toHaveBeenCalledWith(db, ["o1", "o2"]);
    expect(result.faces.map((f) => f.cardId)).toEqual(["c1", "c2"]);
    expect(result).not.toHaveProperty("cards");
  });
});
