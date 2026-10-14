/**
 * Social achievement definitions (ThinkPages, story chains, followers, trending posts, recruiting).
 * Spread into ALL_DEFINITIONS in ./sets.
 */

import type { AchievementDefinition } from "./definitions";

export const SOCIAL_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "social-first-thinkpage",
    title: "First ThinkPage",
    description: "Publish your first ThinkPage",
    category: "Social",
    rarity: "Common",
    points: 10,
    icon: "PageEdit",
    rule: ["SOCIAL", "thinkpageCount", ">=", 1],
  },
  {
    id: "social-thinkpage-author",
    title: "ThinkPage Author",
    description: "Publish 10 ThinkPages",
    category: "Social",
    rarity: "Uncommon",
    points: 30,
    icon: "EditPencil",
    rule: ["SOCIAL", "thinkpageCount", ">=", 10],
  },
  {
    id: "social-prolific-author",
    title: "Prolific Author",
    description: "Publish 50 ThinkPages",
    category: "Social",
    rarity: "Rare",
    points: 60,
    icon: "Journal",
    rule: ["SOCIAL", "thinkpageCount", ">=", 50],
  },
  {
    id: "story-chain-1",
    title: "Chronicler",
    description: "Have a story chain approved",
    category: "Social",
    rarity: "Common",
    points: 10,
    icon: "Notes",
    condition: (data) => (data.storyChainCount ?? 0) >= 1,
  },
  {
    id: "story-chain-5",
    title: "Annalist",
    description: "Have 5 story chains approved",
    category: "Social",
    rarity: "Rare",
    points: 30,
    icon: "Book",
    condition: (data) => (data.storyChainCount ?? 0) >= 5,
  },
  {
    id: "story-chain-25",
    title: "Historian of the Realm",
    description: "Have 25 story chains approved",
    category: "Social",
    rarity: "Legendary",
    points: 100,
    icon: "Bank",
    condition: (data) => (data.storyChainCount ?? 0) >= 25,
  },
  {
    id: "social-popular",
    title: "Popular Nation",
    description: "Reach 100 followers",
    category: "Social",
    rarity: "Rare",
    points: 50,
    icon: "Star",
    rule: ["SOCIAL", "followerCount", ">=", 100],
  },
  {
    id: "social-trending",
    title: "Trending Post",
    description: "Have a post reach trending status",
    category: "Social",
    rarity: "Epic",
    points: 80,
    icon: "Flare",
    rule: ["SOCIAL", "trendingPostCount", ">=", 1],
  },
];

/** Recruiter achievements: players who joined a realm by the user's invite link. */
export const RECRUITER_ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "social-recruiter",
    title: "Recruiter",
    description: "Bring a player into a realm with your invite link",
    category: "Social",
    rarity: "Common",
    points: 10,
    icon: "Mail",
    rule: ["SOCIAL", "recruitedCount", ">=", 1],
  },
  {
    id: "social-envoy",
    title: "Envoy",
    description: "Bring 5 players into realms with your invite links",
    category: "Social",
    rarity: "Uncommon",
    points: 30,
    icon: "Send",
    rule: ["SOCIAL", "recruitedCount", ">=", 5],
  },
  {
    id: "social-founders-hand",
    title: "Founder's Hand",
    description: "Bring 25 players into realms with your invite links",
    category: "Social",
    rarity: "Rare",
    points: 60,
    icon: "Home",
    rule: ["SOCIAL", "recruitedCount", ">=", 25],
  },
];
