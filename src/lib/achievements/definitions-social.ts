/**
 * Social achievement definitions (ThinkPages, story chains, followers, trending posts).
 * Spread into ACHIEVEMENT_DEFINITIONS in ./definitions at the Social position.
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
    iconUrl: "📝",
    condition: (data) => (data.thinkpageCount ?? 0) >= 1,
  },
  {
    id: "social-thinkpage-author",
    title: "ThinkPage Author",
    description: "Publish 10 ThinkPages",
    category: "Social",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "✍️",
    condition: (data) => (data.thinkpageCount ?? 0) >= 10,
  },
  {
    id: "social-prolific-author",
    title: "Prolific Author",
    description: "Publish 50 ThinkPages",
    category: "Social",
    rarity: "Rare",
    points: 60,
    iconUrl: "📚",
    condition: (data) => (data.thinkpageCount ?? 0) >= 50,
  },
  {
    id: "story-chain-1",
    title: "Chronicler",
    description: "Have a story chain approved",
    category: "Social",
    rarity: "Common",
    points: 10,
    iconUrl: "📜",
    condition: (data) => (data.storyChainCount ?? 0) >= 1,
  },
  {
    id: "story-chain-5",
    title: "Annalist",
    description: "Have 5 story chains approved",
    category: "Social",
    rarity: "Rare",
    points: 30,
    iconUrl: "📚",
    condition: (data) => (data.storyChainCount ?? 0) >= 5,
  },
  {
    id: "story-chain-25",
    title: "Historian of the Realm",
    description: "Have 25 story chains approved",
    category: "Social",
    rarity: "Legendary",
    points: 100,
    iconUrl: "🏛️",
    condition: (data) => (data.storyChainCount ?? 0) >= 25,
  },
  {
    id: "social-popular",
    title: "Popular Nation",
    description: "Reach 100 followers",
    category: "Social",
    rarity: "Rare",
    points: 50,
    iconUrl: "🌟",
    condition: (data) => (data.followerCount ?? 0) >= 100,
  },
  {
    id: "social-trending",
    title: "Trending Post",
    description: "Have a post reach trending status",
    category: "Social",
    rarity: "Epic",
    points: 80,
    iconUrl: "🔥",
    condition: (data) => (data.trendingPostCount ?? 0) >= 1,
  },
];
