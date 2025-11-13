/**
 * Achievement Card Rewards Configuration
 *
 * Maps major achievements to commemorative SPECIAL cards.
 * These cards are exclusive rewards that cannot be obtained through packs or trading.
 *
 * Integration: When an achievement is unlocked, the system checks this mapping
 * and awards the corresponding card (if defined) using AcquireMethod.ACHIEVEMENT.
 */

/**
 * Achievement to Card Reward Mapping
 *
 * Structure:
 * - achievementId: ID from achievement-definitions.ts
 * - cardId: ID of the commemorative card (must exist in database)
 * - description: Why this card is awarded for this achievement
 */
export interface AchievementCardReward {
  achievementId: string;
  cardId: string;
  description: string;
}

/**
 * Master list of achievement → card rewards
 *
 * Priority achievements that deserve commemorative cards:
 * 1. First nation created (onboarding milestone)
 * 2. Major economic milestones (100K GDP, Tier 1)
 * 3. Diplomatic achievements (25+ embassies)
 * 4. Social milestones (10K followers)
 * 5. Meta-achievements (50 achievements unlocked)
 * 6. Time-based milestones (1 year active)
 * 7. Excellence achievements (multiple high-tier stats)
 */
export const ACHIEVEMENT_CARD_REWARDS: AchievementCardReward[] = [
  // ==========================================
  // GENERAL MILESTONES
  // ==========================================
  {
    achievementId: "gen-first-country",
    cardId: "card-achievement-first-nation",
    description: "Welcome to IxStats! This commemorative card celebrates your first nation claim.",
  },
  {
    achievementId: "gen-one-year",
    cardId: "card-achievement-veteran",
    description: "One year of dedication! This veteran card honors your long-term commitment.",
  },
  {
    achievementId: "gen-achievement-legend",
    cardId: "card-achievement-completionist",
    description: "Master collector! This legendary card recognizes your achievement mastery.",
  },

  // ==========================================
  // ECONOMIC EXCELLENCE
  // ==========================================
  {
    achievementId: "econ-economic-powerhouse",
    cardId: "card-achievement-economic-titan",
    description: "$100 billion GDP milestone! Your economic prowess is commemorated forever.",
  },
  {
    achievementId: "econ-tier-advancement",
    cardId: "card-achievement-tier1-master",
    description: "Tier 1 economic status achieved! Join the elite ranks of global leaders.",
  },
  {
    achievementId: "econ-ultra-prosperity",
    cardId: "card-achievement-prosperity-peak",
    description: "$100K per capita! Your citizens enjoy unparalleled prosperity.",
  },

  // ==========================================
  // DIPLOMATIC MASTERY
  // ==========================================
  {
    achievementId: "dip-embassy-network",
    cardId: "card-achievement-diplomatic-architect",
    description: "25 embassies established! Your diplomatic network spans the globe.",
  },
  {
    achievementId: "dip-trade-hub",
    cardId: "card-achievement-trade-nexus",
    description: "50 trade partnerships! You've become a central hub of global commerce.",
  },

  // ==========================================
  // SOCIAL INFLUENCE
  // ==========================================
  {
    achievementId: "social-popular",
    cardId: "card-achievement-influencer",
    description: "10K followers reached! Your social influence shapes global discourse.",
  },
  {
    achievementId: "social-prolific-author",
    cardId: "card-achievement-thought-leader",
    description: "50 ThinkPages published! Your intellectual contributions are legendary.",
  },

  // ==========================================
  // MILITARY STRENGTH
  // ==========================================
  {
    achievementId: "mil-global-force",
    cardId: "card-achievement-military-superpower",
    description: "5M military personnel! Your armed forces are a global superpower.",
  },

  // ==========================================
  // SPECIAL COMBINATIONS
  // ==========================================
  // Note: These cards can be awarded for multiple related achievements
  // Implementation can check user's overall progress to award combination cards
];

/**
 * Get card reward for achievement
 * @param achievementId Achievement ID from achievement-definitions.ts
 * @returns Card ID to award, or null if no card reward
 */
export function getCardRewardForAchievement(achievementId: string): string | null {
  const reward = ACHIEVEMENT_CARD_REWARDS.find((r) => r.achievementId === achievementId);
  return reward?.cardId || null;
}

/**
 * Check if achievement has card reward
 * @param achievementId Achievement ID
 * @returns true if achievement has associated card reward
 */
export function hasCardReward(achievementId: string): boolean {
  return ACHIEVEMENT_CARD_REWARDS.some((r) => r.achievementId === achievementId);
}

/**
 * Get all achievements that have card rewards
 * @returns Array of achievement IDs with card rewards
 */
export function getAchievementsWithCardRewards(): string[] {
  return ACHIEVEMENT_CARD_REWARDS.map((r) => r.achievementId);
}

/**
 * Get card reward info including description
 * @param achievementId Achievement ID
 * @returns Full reward info or null
 */
export function getCardRewardInfo(achievementId: string): AchievementCardReward | null {
  return ACHIEVEMENT_CARD_REWARDS.find((r) => r.achievementId === achievementId) || null;
}

/**
 * Commemorative Card Metadata
 *
 * These are the actual card definitions that should be seeded into the database.
 * Each card is a SPECIAL type with EPIC or LEGENDARY rarity.
 */
export const COMMEMORATIVE_CARD_DEFINITIONS = [
  {
    id: "card-achievement-first-nation",
    title: "First Steps",
    description: "Commemorates your first nation claim on IxStats. Every journey begins with a single step.",
    artwork: "/cards/achievements/first-nation.png",
    rarity: "RARE",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 85,
      significance: "Onboarding Milestone",
      category: "General",
    },
    totalSupply: null, // Unlimited - every user gets one
    marketValue: 50,
  },
  {
    id: "card-achievement-veteran",
    title: "Veteran's Honor",
    description: "One full year of dedication to IxStats. Your commitment has shaped the platform's history.",
    artwork: "/cards/achievements/veteran.png",
    rarity: "EPIC",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 90,
      significance: "Time-Based Excellence",
      category: "General",
    },
    totalSupply: null,
    marketValue: 250,
  },
  {
    id: "card-achievement-completionist",
    title: "The Completionist",
    description: "50 achievements unlocked! A true master of IxStats gameplay and strategy.",
    artwork: "/cards/achievements/completionist.png",
    rarity: "LEGENDARY",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 98,
      significance: "Achievement Mastery",
      category: "General",
    },
    totalSupply: null,
    marketValue: 500,
  },
  {
    id: "card-achievement-economic-titan",
    title: "Economic Titan",
    description: "$100 billion GDP achieved. Your nation stands among the world's economic powerhouses.",
    artwork: "/cards/achievements/economic-titan.png",
    rarity: "EPIC",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 92,
      significance: "Economic Excellence",
      category: "Economic",
    },
    totalSupply: null,
    marketValue: 300,
  },
  {
    id: "card-achievement-tier1-master",
    title: "Tier 1 Ascension",
    description: "Reached Tier 1 economic status - the pinnacle of national development.",
    artwork: "/cards/achievements/tier1-master.png",
    rarity: "LEGENDARY",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 95,
      significance: "Economic Apex",
      category: "Economic",
    },
    totalSupply: null,
    marketValue: 500,
  },
  {
    id: "card-achievement-prosperity-peak",
    title: "Peak Prosperity",
    description: "$100K per capita GDP! Your citizens enjoy the highest standard of living.",
    artwork: "/cards/achievements/prosperity-peak.png",
    rarity: "EPIC",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 90,
      significance: "Citizen Prosperity",
      category: "Economic",
    },
    totalSupply: null,
    marketValue: 280,
  },
  {
    id: "card-achievement-diplomatic-architect",
    title: "Diplomatic Architect",
    description: "25 embassies established. Your diplomatic network connects the world.",
    artwork: "/cards/achievements/diplomatic-architect.png",
    rarity: "EPIC",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 88,
      significance: "Diplomatic Excellence",
      category: "Diplomatic",
    },
    totalSupply: null,
    marketValue: 275,
  },
  {
    id: "card-achievement-trade-nexus",
    title: "Global Trade Nexus",
    description: "50 trade partnerships! You are a central hub of international commerce.",
    artwork: "/cards/achievements/trade-nexus.png",
    rarity: "LEGENDARY",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 93,
      significance: "Trade Dominance",
      category: "Diplomatic",
    },
    totalSupply: null,
    marketValue: 450,
  },
  {
    id: "card-achievement-influencer",
    title: "Social Influencer",
    description: "10K ThinkPages followers! Your voice shapes global opinion and discourse.",
    artwork: "/cards/achievements/influencer.png",
    rarity: "EPIC",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 87,
      significance: "Social Impact",
      category: "Social",
    },
    totalSupply: null,
    marketValue: 260,
  },
  {
    id: "card-achievement-thought-leader",
    title: "Thought Leader",
    description: "50 ThinkPages published! Your intellectual contributions enrich the platform.",
    artwork: "/cards/achievements/thought-leader.png",
    rarity: "EPIC",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 89,
      significance: "Intellectual Excellence",
      category: "Social",
    },
    totalSupply: null,
    marketValue: 270,
  },
  {
    id: "card-achievement-military-superpower",
    title: "Military Superpower",
    description: "5M military personnel! Your armed forces are a force to be reckoned with globally.",
    artwork: "/cards/achievements/military-superpower.png",
    rarity: "LEGENDARY",
    cardType: "SPECIAL",
    season: 1,
    stats: {
      commemorative: 100,
      rarity: 94,
      significance: "Military Might",
      category: "Military",
    },
    totalSupply: null,
    marketValue: 480,
  },
];
