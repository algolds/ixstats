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
interface AchievementCardReward {
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
const ACHIEVEMENT_CARD_REWARDS: AchievementCardReward[] = [
  // GENERAL MILESTONES
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

  // ECONOMIC EXCELLENCE
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

  // DIPLOMATIC MASTERY
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

  // SOCIAL INFLUENCE
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

  // MILITARY STRENGTH
  {
    achievementId: "mil-global-force",
    cardId: "card-achievement-military-superpower",
    description: "5M military personnel! Your armed forces are a global superpower.",
  },

  // SPECIAL COMBINATIONS
  // Note: These cards can be awarded for multiple related achievements
  // Implementation can check user's overall progress to award combination cards
];

/**
 * A commemorative card row, seeded by `prisma/seeds/achievement-cards.ts`. SPECIAL cards
 * never drop from packs (`pack-service.ts`), so unlocking the achievement is the only source.
 */
interface CommemorativeCardDefinition {
  id: string;
  title: string;
  description: string;
  artwork: string | null;
  rarity: "COMMON" | "UNCOMMON" | "RARE" | "ULTRA_RARE" | "EPIC" | "LEGENDARY";
  cardType: "SPECIAL";
  category: "SPECIAL";
  season: number;
  stats: Record<string, never>;
  totalSupply: number | null;
  marketValue: number;
}

function commemorative(
  id: string,
  title: string,
  rarity: CommemorativeCardDefinition["rarity"],
  description: string
): CommemorativeCardDefinition {
  return {
    id,
    title,
    description,
    artwork: null,
    rarity,
    cardType: "SPECIAL",
    category: "SPECIAL",
    season: 1,
    stats: {},
    totalSupply: null,
    marketValue: 0,
  };
}

/** One card per `cardId` in ACHIEVEMENT_CARD_REWARDS; rarity follows the achievement's. */
export const COMMEMORATIVE_CARD_DEFINITIONS: CommemorativeCardDefinition[] = [
  commemorative(
    "card-achievement-first-nation",
    "First Nation",
    "COMMON",
    "Commemorates claiming your first country."
  ),
  commemorative(
    "card-achievement-veteran",
    "Veteran",
    "EPIC",
    "Commemorates one year of activity on IxStats."
  ),
  commemorative(
    "card-achievement-completionist",
    "Completionist",
    "EPIC",
    "Commemorates unlocking 50 achievements."
  ),
  commemorative(
    "card-achievement-economic-titan",
    "Economic Titan",
    "RARE",
    "Commemorates ranking in the top 25% of nations by total GDP."
  ),
  commemorative(
    "card-achievement-tier1-master",
    "Tier 1 Master",
    "EPIC",
    "Commemorates reaching Tier 1 economic status."
  ),
  commemorative(
    "card-achievement-prosperity-peak",
    "Prosperity Peak",
    "EPIC",
    "Commemorates ranking in the top 10% of nations by GDP per capita."
  ),
  commemorative(
    "card-achievement-diplomatic-architect",
    "Diplomatic Architect",
    "EPIC",
    "Commemorates establishing 25 embassies."
  ),
  commemorative(
    "card-achievement-trade-nexus",
    "Trade Nexus",
    "EPIC",
    "Commemorates establishing 50 trade partnerships."
  ),
  commemorative(
    "card-achievement-influencer",
    "Influencer",
    "RARE",
    "Commemorates reaching 100 followers."
  ),
  commemorative(
    "card-achievement-thought-leader",
    "Thought Leader",
    "RARE",
    "Commemorates publishing 50 ThinkPages."
  ),
  commemorative(
    "card-achievement-military-superpower",
    "Military Superpower",
    "LEGENDARY",
    "Commemorates recruiting 5,000,000 military personnel."
  ),
];

/** Every achievement → card pairing, for the seed's backfill of earlier unlocks. */
export function listAchievementCardRewards(): { achievementId: string; cardId: string }[] {
  return ACHIEVEMENT_CARD_REWARDS.map(({ achievementId, cardId }) => ({ achievementId, cardId }));
}

/**
 * Get card reward for achievement
 * @param achievementId Achievement ID from achievement-definitions.ts
 * @returns Card ID to award, or null if no card reward
 */
export function getCardRewardForAchievement(achievementId: string): string | null {
  const reward = ACHIEVEMENT_CARD_REWARDS.find((r) => r.achievementId === achievementId);
  return reward?.cardId || null;
}
