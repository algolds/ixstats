/** @jest-environment node */
/** An achievement unlock awards the Special card that names it as its reward. */
jest.mock("~/lib/vault/vault-bonus", () => ({
  achievementBonus: jest.fn().mockReturnValue(0),
  getBonusConfig: jest.fn().mockResolvedValue({}),
  grantBonus: jest.fn(),
}));
jest.mock("~/lib/cards/card-service", () => ({ awardAchievementCard: jest.fn() }));

import type { Achievement } from "@prisma/client";
import { awardAchievementCard } from "~/lib/cards/card-service";
import { unlockAchievement } from "~/lib/achievements/unlock";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const veteran = {
  key: "gen-one-year",
  title: "Veteran",
  rewardsJson: JSON.stringify({ credits: 50, cardIds: ["card_from_an_old_sync"] }),
} as Achievement;

/** A reward card the unlock awards: Special, live and approved. */
const live = { id: "card_1", cardType: "SPECIAL", isRetired: false, reviewState: "APPROVED" };

beforeEach(() => jest.clearAllMocks());

it("awards the Special card whose reward is this achievement", async () => {
  const db = createMockPrisma();
  db.card.findUnique.mockResolvedValue({ ...live, id: "card-achievement-veteran" });
  await expect(unlockAchievement(db as never, "user_db_1", veteran)).resolves.toBe(true);
  expect(db.card.findUnique).toHaveBeenCalledWith({
    where: { rewardAchievementKey: "gen-one-year" },
    select: { id: true, cardType: true, isRetired: true, reviewState: true },
  });
  expect(awardAchievementCard).toHaveBeenCalledTimes(1);
  expect(awardAchievementCard).toHaveBeenCalledWith(
    db,
    "user_db_1",
    "card-achievement-veteran",
    "gen-one-year",
    "Veteran"
  );
  const unlock = db.userAchievement.create.mock.calls[0]![0].data;
  expect(JSON.parse(unlock.metadata).rewards.cardIds).toEqual(["card-achievement-veteran"]);
});

it("awards nothing when no live, approved Special card names the achievement", async () => {
  const db = createMockPrisma();
  await unlockAchievement(db as never, "user_db_1", veteran);
  for (const card of [
    { ...live, isRetired: true },
    { ...live, cardType: "LORE" },
    { ...live, reviewState: "PENDING" },
    { ...live, reviewState: "REJECTED" },
  ]) {
    db.card.findUnique.mockResolvedValue(card);
    await unlockAchievement(db as never, "user_db_1", veteran);
  }
  expect(db.card.findUnique).toHaveBeenCalledTimes(5);
  expect(awardAchievementCard).not.toHaveBeenCalled();
});
it("awards nothing to an unlock that lost the race", async () => {
  const db = createMockPrisma();
  db.card.findUnique.mockResolvedValue(live);
  db.userAchievement.create.mockRejectedValue(Object.assign(new Error("dup"), { code: "P2002" }));
  await expect(unlockAchievement(db as never, "user_db_1", veteran)).resolves.toBe(false);
  expect(awardAchievementCard).not.toHaveBeenCalled();
});
