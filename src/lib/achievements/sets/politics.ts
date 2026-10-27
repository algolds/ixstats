/**
 * Politics achievements: bills, elections, the cabinet. Rules read the metrics of
 * `metrics/politics.ts`; floors in real weeks and months live in the loaders.
 */

import type { AchievementDefinition } from "../definitions";

export const POLITICS_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "pol-first-election",
    title: "First Election",
    description: "Hold an election",
    category: "Politics",
    rarity: "Common",
    points: 10,
    icon: "Megaphone",
    rule: ["POLITICS", "electionsHeld", ">=", 1],
  },
  {
    id: "pol-first-law",
    title: "First Law",
    description: "Pass a law",
    category: "Politics",
    rarity: "Common",
    points: 10,
    icon: "Journal",
    rule: ["POLITICS", "lawsPassed", ">=", 1],
  },
  {
    id: "pol-lawgiver",
    title: "Lawgiver",
    description: "Pass bills in 6 different months (a later repeal does not undo one)",
    category: "Politics",
    rarity: "Epic",
    points: 100,
    icon: "Hammer",
    rule: ["POLITICS", "lawMonths", ">=", 6],
  },
  {
    id: "pol-council-of-state",
    title: "Council of State",
    description: "Conclude 25 cabinet meetings with a decision, across 10 or more different weeks",
    category: "Politics",
    rarity: "Rare",
    points: 50,
    icon: "Group",
    rule: ["POLITICS", "meetingsWithDecisions", ">=", 25],
  },
  {
    id: "pol-seasoned-cabinet",
    title: "Seasoned Cabinet",
    description: "Have 5 officials who have each served 6 months or longer",
    category: "Politics",
    rarity: "Rare",
    points: 50,
    icon: "User",
    rule: ["POLITICS", "officials6m", ">=", 5],
  },
  {
    id: "pol-full-term",
    title: "Full Term",
    description:
      "Complete a general election 18 or more months after your first election (snap elections excluded)",
    category: "Politics",
    rarity: "Epic",
    points: 100,
    icon: "Timer",
    rule: ["POLITICS", "fullTerm", ">=", 1],
  },
  {
    id: "pol-peaceful-transitions",
    title: "Peaceful Transitions",
    description: "Complete 2 general elections spanning 3 or more years",
    category: "Politics",
    rarity: "Legendary",
    points: 250,
    icon: "Flare",
    rule: ["POLITICS", "peacefulTransitions", ">=", 2],
  },
];
