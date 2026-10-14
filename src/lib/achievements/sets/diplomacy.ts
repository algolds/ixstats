/**
 * Diplomacy and Defense achievements (spec 5.3): long-lived embassies, alliances and peacekeeping,
 * measured in real time. Floors that pair a count with a duration are folded into the loader's
 * metric (`metrics/diplomacy.ts`), so each rule reads one number.
 */

import type { AchievementDefinition } from "../definitions";

export const DIPLOMACY_DEFINITIONS: AchievementDefinition[] = [
  {
    id: "dip-first-alliance",
    title: "Join an Alliance",
    description: "Become an active member of an alliance",
    category: "Diplomacy",
    rarity: "Common",
    points: 10,
    icon: "Link",
    rule: ["DIPLOMATIC", "allianceJoined", ">=", 1],
  },
  {
    id: "dip-lasting-embassies",
    title: "Lasting Embassies",
    description: "Keep 10 embassies open for 6 months with none closed or severed",
    category: "Diplomacy",
    rarity: "Rare",
    points: 50,
    icon: "Building",
    rule: ["DIPLOMATIC", "embassiesLasting6m", ">=", 10],
  },
  {
    id: "dip-good-neighbour",
    title: "Good Neighbour",
    description: "Have 5 cooperative foreign-policy actions accepted by player-owned nations",
    category: "Diplomacy",
    rarity: "Rare",
    points: 50,
    icon: "Heart",
    rule: ["DIPLOMATIC", "cooperativeAccepted", ">=", 5],
  },
  {
    id: "dip-winning-hearts",
    title: "Winning Hearts",
    description: "Have 3 NPC nations accept your alliance invites",
    category: "Diplomacy",
    rarity: "Rare",
    points: 50,
    icon: "Community",
    rule: ["DIPLOMATIC", "npcInvitesAccepted", ">=", 3],
  },
  {
    id: "dip-cultural-envoy",
    title: "Cultural Envoy",
    description:
      "Complete 20 embassy missions across at least 3 different months (a cultural exchange counts once)",
    category: "Diplomacy",
    rarity: "Rare",
    points: 50,
    icon: "Globe",
    rule: ["DIPLOMATIC", "missionsCompleted", ">=", 20],
  },
  {
    id: "dip-consensus-builder",
    title: "Consensus Builder",
    description:
      "Have 25 of your alliance proposals approved by members, in alliances of 3 or more",
    category: "Diplomacy",
    rarity: "Rare",
    points: 50,
    icon: "Group",
    rule: ["DIPLOMATIC", "proposalsApproved", ">=", 25],
  },
  {
    id: "dip-old-friends",
    title: "Old Friends",
    description: "Stay in an alliance for 18 months without leaving",
    category: "Diplomacy",
    rarity: "Epic",
    points: 100,
    icon: "Hourglass",
    rule: ["DIPLOMATIC", "allianceUnbroken18m", ">=", 1],
  },
  {
    id: "dip-alliance-architect",
    title: "Alliance Architect",
    description: "Found an alliance that reaches 12 months old with 5 or more active members",
    category: "Diplomacy",
    rarity: "Epic",
    points: 100,
    icon: "Network",
    rule: ["DIPLOMATIC", "allianceArchitect", ">=", 1],
  },
  {
    id: "dip-pacifist",
    title: "Pacifist",
    description:
      "Own your nation for 12 months with no hostile foreign-policy action and no embassy closed or severed",
    category: "Diplomacy",
    rarity: "Rare",
    points: 50,
    icon: "Leaf",
    rule: ["DIPLOMATIC", "pacifist12m", ">=", 1],
  },
  {
    id: "mil-peacekeeper",
    title: "Peacekeeper",
    description: "Complete 10 peacekeeping operations, each lasting 15 days or longer",
    category: "Defense",
    rarity: "Rare",
    points: 50,
    icon: "ShieldCheck",
    rule: ["MILITARY", "peacekeeping15d", ">=", 10],
  },
];
