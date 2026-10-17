/** @jest-environment node */
/** The one-time import of the five Special cards the CLI seed used to create. */
import {
  LEGACY_SPECIAL_CARDS,
  awaitsSpecialCardImport,
  planSpecialCardImport,
  type ExistingSpecialCard,
} from "~/lib/cards/special-card-import";
import { getAchievementById } from "~/lib/achievements/definitions";

const imported = { specialKind: "ACHIEVEMENT_REWARD", isBound: true } as const;
const seeded = { specialKind: null, rewardAchievementKey: null, isBound: false, isRetired: false };
/** A legacy card the import already pointed at its achievement. */
const done = (achievementKey: string, isRetired = false) => ({
  ...imported,
  rewardAchievementKey: achievementKey,
  isRetired,
});
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
      new Map<string, ExistingSpecialCard>([
        [first!.id, seeded],
        [second!.id, done(second!.achievementKey)],
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
    const rows = new Map(LEGACY_SPECIAL_CARDS.map((card) => [card.id, done(card.achievementKey)]));
    const holders = new Map(LEGACY_SPECIAL_CARDS.map((card) => [card.achievementKey, card.id]));
    const plan = planSpecialCardImport(rows, holders);
    expect(plan).toMatchObject({ creates: [], updates: [], skipped: [] });
    expect(plan.rewards).toHaveLength(LEGACY_SPECIAL_CARDS.length);
  });

  it("leaves an achievement another card already rewards, and a card an admin changed, alone", () => {
    const plan = planSpecialCardImport(
      new Map<string, ExistingSpecialCard>([
        [second!.id, seeded],
        [
          third!.id,
          { specialKind: "EVENT", rewardAchievementKey: null, isBound: false, isRetired: false },
        ],
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

  it("points a retired legacy card at its achievement but never backfills it", () => {
    const plan = planSpecialCardImport(
      new Map<string, ExistingSpecialCard>([
        [first!.id, { ...seeded, isRetired: true }],
        [second!.id, done(second!.achievementKey, true)],
      ])
    );
    expect(plan.updates.map((update) => update.id)).toEqual([first!.id]);
    expect(plan.rewards.map((r) => r.cardId)).toEqual(
      LEGACY_SPECIAL_CARDS.slice(2).map((card) => card.id)
    );
  });
});

describe("awaitsSpecialCardImport", () => {
  it("names the old seed's rows only, until the import gives them a kind", () => {
    expect(awaitsSpecialCardImport({ id: first!.id, specialKind: null })).toBe(true);
    expect(awaitsSpecialCardImport({ id: first!.id, specialKind: "ACHIEVEMENT_REWARD" })).toBe(
      false
    );
    expect(awaitsSpecialCardImport({ id: "card_designed", specialKind: null })).toBe(false);
  });
});
