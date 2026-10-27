/**
 * Nation achievements (spec 5.3): stewardship of a nation over real time, its identity, heraldry,
 * map and chronicle. Stewardship reads `Country.ownedSince`; Heraldic house and Cartographer
 * follow the account, not a country.
 */

import type { AchievementDefinition } from "../definitions";

export const NATION_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "nation-first-arms",
    title: "Coat of Arms",
    description: "Attach a Vexel coat of arms to your nation",
    category: "Nation",
    rarity: "Common",
    points: 10,
    icon: "Shield",
    rule: ["NATION", "armsAttached", ">=", 1],
  },
  {
    id: "nation-stewardship-1",
    title: "Stewardship I",
    description: "Own your nation for 6 months",
    category: "Nation",
    rarity: "Uncommon",
    points: 25,
    icon: "Home",
    rule: ["NATION", "ownedMonths", ">=", 6],
  },
  {
    id: "nation-stewardship-2",
    title: "Stewardship II",
    description: "Own your nation for 18 months",
    category: "Nation",
    rarity: "Rare",
    points: 50,
    icon: "Bank",
    rule: ["NATION", "ownedMonths", ">=", 18],
  },
  {
    id: "nation-stewardship-3",
    title: "Stewardship III",
    description: "Own your nation for 3 years",
    category: "Nation",
    rarity: "Legendary",
    points: 200,
    icon: "Crown",
    rule: ["NATION", "ownedMonths", ">=", 36],
  },
  {
    id: "nation-identity",
    title: "National Identity",
    description:
      "Complete your core national identity: name, motto, demonym, currency, languages, anthem, national day, a linked capital and 3 national symbols",
    category: "Nation",
    rarity: "Uncommon",
    points: 25,
    icon: "Notes",
    rule: ["NATION", "identityComplete", ">=", 1],
  },
  {
    id: "nation-heraldic-house",
    title: "Heraldic House",
    description: "Publish 3 Vexel designs for institutions or dynasties",
    category: "Nation",
    rarity: "Rare",
    points: 50,
    icon: "Palette",
    rule: ["NATION", "heraldryPublishedInstitutions", ">=", 3],
  },
  {
    id: "nation-cartographer",
    title: "Cartographer",
    description: "Have 10 map edits approved",
    category: "Nation",
    rarity: "Rare",
    points: 50,
    icon: "Map",
    rule: ["NATION", "mapEditsApproved", ">=", 10],
  },
  {
    id: "nation-chronicler",
    title: "Chronicler",
    description:
      "Create 25 approved story pins across at least 6 different months and 5 different in-world years",
    category: "Nation",
    rarity: "Epic",
    points: 100,
    icon: "Journal",
    condition: (data) =>
      (data.metrics?.storyPinsApproved ?? 0) >= 25 && (data.metrics?.storyPinYears ?? 0) >= 5,
  },
];
