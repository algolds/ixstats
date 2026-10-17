/** @jest-environment node */
/** The one-time import of the five Special cards the CLI seed used to create. */
import { LEGACY_SPECIAL_CARDS, planSpecialCardImport } from "~/lib/cards/special-card-import";
import { getAchievementById } from "~/lib/achievements/definitions";

const imported = { specialKind: "ACHIEVEMENT_REWARD", isBound: true } as const;
const seeded = { specialKind: null, rewardAchievementKey: null, isBound: false };
const [first, second, third] = LEGACY_SPECIAL_CARDS;

describe("LEGACY_SPECIAL_CARDS", () => {
  it("names a live achievement for every card, one card each", () => {
    const keys = LEGACY_SPECIAL_CARDS.map((card) => card.achievementKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(getAchievementById(key)).toBeDefined();
      expect(getAchievementById(key)?.retired).toBeUndefined();
    }
  });
});

describe("planSpecialCardImport", () => {
  it("creates missing cards and points the old seed's rows at their achievement", () => {
    const plan = planSpecialCardImport(
      new Map([
        [first!.id, seeded],
        [second!.id, { ...imported, rewardAchievementKey: second!.achievementKey }],
      ])
    );
    expect(plan.updates).toEqual([
      { id: first!.id, data: { ...imported, rewardAchievementKey: first!.achievementKey } },
    ]);
    expect(plan.creates.map((card) => card.id)).toEqual(
      LEGACY_SPECIAL_CARDS.slice(2).map((card) => card.id)
    );
    expect(plan.skipped).toEqual([]);
    expect(plan.rewards).toEqual(
      LEGACY_SPECIAL_CARDS.map((card) => ({ cardId: card.id, achievementKey: card.achievementKey }))
    );
  });

  it("plans nothing once imported, and still names every reward for the backfill", () => {
    const done = new Map(
      LEGACY_SPECIAL_CARDS.map((card) => [
        card.id,
        { ...imported, rewardAchievementKey: card.achievementKey },
      ])
    );
    const holders = new Map(LEGACY_SPECIAL_CARDS.map((card) => [card.achievementKey, card.id]));
    const plan = planSpecialCardImport(done, holders);
    expect(plan).toMatchObject({ creates: [], updates: [], skipped: [] });
    expect(plan.rewards).toHaveLength(LEGACY_SPECIAL_CARDS.length);
  });

  it("leaves an achievement another card already rewards, and a card an admin changed, alone", () => {
    const plan = planSpecialCardImport(
      new Map([
        [second!.id, seeded],
        [third!.id, { specialKind: "EVENT", rewardAchievementKey: null, isBound: false }],
      ]),
      new Map([
        [first!.achievementKey, "card_designed_1"],
        [second!.achievementKey, "card_designed_2"],
      ])
    );
    expect(plan.skipped).toEqual([
      expect.objectContaining({
        id: first!.id,
        reason: expect.stringContaining("card_designed_1"),
      }),
      expect.objectContaining({
        id: second!.id,
        reason: expect.stringContaining("card_designed_2"),
      }),
      expect.objectContaining({ id: third!.id, reason: expect.stringContaining("Designer") }),
    ]);
    expect(plan.updates).toEqual([]);
    expect(plan.creates.map((card) => card.id)).toEqual(
      LEGACY_SPECIAL_CARDS.slice(3).map((card) => card.id)
    );
    expect(plan.rewards.map((reward) => reward.cardId)).toEqual(
      LEGACY_SPECIAL_CARDS.slice(3).map((card) => card.id)
    );
  });
});
