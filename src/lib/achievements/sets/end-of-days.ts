/**
 * `vid-end-of-days`: every active Executive, Politics and Diplomacy achievement unlocked. It
 * reads the whole registry, so it takes the list as a getter instead of importing it.
 */

import type { AchievementCategory, AchievementDefinition } from "../definitions";

const TREES: ReadonlySet<AchievementCategory> = new Set(["Executive", "Politics", "Diplomacy"]);

export function endOfDays(all: () => readonly AchievementDefinition[]): AchievementDefinition {
  return {
    id: "vid-end-of-days",
    title: "Vidmaster Challenge: End of Days",
    description: "Unlock every active Executive, Politics and Diplomacy achievement",
    category: "General",
    rarity: "Legendary",
    points: 250,
    icon: "Sparks",
    accountLevel: true,
    condition: (data) => {
      const held = new Set(data.existingKeys);
      const targets = all().filter(
        (d) => !d.retired && d.id !== "vid-end-of-days" && TREES.has(d.category)
      );
      return targets.length > 0 && targets.every((d) => held.has(d.id));
    },
  };
}
