/** @jest-environment node */
/** Cards refresh §3: an achievement's reward card rolls its finish at mint and never checks capacity. */
jest.mock("~/lib/cards/mint", () => ({ mintCopy: jest.fn() }));
jest.mock("~/lib/cards/capacity", () => ({
  assertCapacityTx: jest.fn(),
  lockedCopyRoomTx: jest.fn(),
}));

import { awardAchievementCard } from "~/lib/cards/card-service";
import { assertCapacityTx, lockedCopyRoomTx } from "~/lib/cards/capacity";
import { mintCopy } from "~/lib/cards/mint";
import { createMockPrisma } from "~/tests/helpers/mock-db";

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it("mints the reward through mintCopy with no finish, so the roll picks it, and no capacity check", async () => {
  const db = createMockPrisma();
  db.user.findFirst.mockResolvedValue({ id: "db_u1" });
  db.card.findUnique.mockResolvedValue({ id: "card_1", title: "Elm" });
  jest.mocked(mintCopy).mockResolvedValue({ id: "own_1", serialNumber: 4 } as never);

  await expect(
    awardAchievementCard(db as never, "clerk_u1", "card_1", "ach_1", "First steps")
  ).resolves.toMatchObject({ id: "own_1" });

  expect(mintCopy).toHaveBeenCalledWith(db, {
    cardId: "card_1",
    ownerId: "db_u1",
    source: "ACHIEVEMENT",
  });
  expect(assertCapacityTx).not.toHaveBeenCalled();
  expect(lockedCopyRoomTx).not.toHaveBeenCalled();
});
