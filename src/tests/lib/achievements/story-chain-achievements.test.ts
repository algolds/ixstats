/** @jest-environment node */
import { getAchievementById } from "~/lib/achievements/definitions";
import { achievementRequiresCountry } from "~/lib/achievements/scope";

const base = { country: { id: "c1" } } as never;

describe.each([
  ["story-chain-1", 1],
  ["story-chain-5", 5],
  ["story-chain-25", 25],
])("%s", (id, threshold) => {
  const def = getAchievementById(id)!;

  it("unlocks at its threshold of approved chains", () => {
    expect(def.condition({ ...base, storyChainCount: threshold })).toBe(true);
    expect(def.condition({ ...base, storyChainCount: threshold - 1 })).toBe(false);
  });

  it("is a country achievement", () => {
    expect(achievementRequiresCountry({ key: id })).toBe(true);
  });
});
