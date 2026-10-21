import "react";
import { render, screen } from "@testing-library/react";

import { AllAchievementsTab } from "~/components/achievements/tabs/AllAchievementsTab";
import {
  groupAchievements,
} from "~/components/achievements/constants";
import type { RouterOutputs } from "~/trpc/react";

/** A standard catalogue row of `achievements.getAllWithStatus` (medals and wiki awards have no `isLegacy`). */
type StandardRow = Extract<
  RouterOutputs["achievements"]["getAllWithStatus"][number],
  { isLegacy: boolean }
>;

const row = (
  over: Pick<StandardRow, "key" | "title"> &
    Partial<Pick<StandardRow, "category" | "rarity" | "isUnlocked" | "unlockedAt" | "isLegacy">>
): StandardRow => ({
  description: `${over.title} description`,
  category: "General",
  rarity: "Common",
  points: 10,
  iconUrl: "Trophy",
  isLegacy: false,
  triggerType: "STAT",
  conditionJson: null,
  isUnlocked: true,
  unlockedAt: "2026-10-01T00:00:00.000Z",
  metadata: null,
  rewards: null,
  globalUnlockPercent: 50,
  ...over,
});

const ACHIEVEMENTS = [
  row({ key: "gen-welcome", title: "Welcome" }),
  row({ key: "gen-one-week", title: "One week", isUnlocked: false, unlockedAt: null }),
  row({
    key: "econ-first-million",
    title: "Emerging Economy",
    category: "Economic",
    rarity: "Legendary",
    isLegacy: true,
  }),
];

describe("Legacy in the catalogue", () => {
  it("counts active achievements only in the rarity filter", () => {
    render(<AllAchievementsTab achievements={ACHIEVEMENTS} />);

    const all = screen.getByRole("radio", { name: /^All/ });
    const legendary = screen.getByRole("radio", { name: /^Legendary/ });
    // Two active achievements; the Legacy Legendary counts in no total
    expect(all).toHaveTextContent("2");
    expect(legendary).toHaveTextContent("0");
  });

  it("lists Legacy cards after the active ones", () => {
    expect(
      groupAchievements(ACHIEVEMENTS).map((g) => [g.activeAchievement.key, g.isLegacy])
    ).toEqual([
      ["gen-welcome", false],
      ["gen-one-week", false],
      ["econ-first-million", true],
    ]);
  });

  it("never folds a Legacy unlock into a series of active tiers", () => {
    const grouped = groupAchievements([
      row({ key: "social-first-thinkpage", title: "First" }),
      row({ key: "social-thinkpage-author", title: "Author", isLegacy: true }),
    ]);
    const series = grouped.find((g) => g.isSeries)!;
    expect(series.levels.map((l) => l.key)).toEqual(["social-first-thinkpage"]);
    expect(
      grouped.find((g) => g.activeAchievement.key === "social-thinkpage-author")?.isLegacy
    ).toBe(true);
  });
});
