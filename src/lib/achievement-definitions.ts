/**
 * Achievement Definitions
 *
 * Comprehensive achievement system with 50+ pre-defined achievements
 * across Economic, Military, Diplomatic, Government, Social, and General categories.
 *
 * Each achievement includes:
 * - Unique ID and metadata (title, description, icon)
 * - Category and rarity classification
 * - Point value for leaderboard scoring
 * - Condition function for auto-unlock detection
 */

import { meetsScale, RARITY_PERCENTILE } from "./achievement-scaling";

export type AchievementCategory =
  | "Economic"
  | "Military"
  | "Diplomatic"
  | "Government"
  | "Social"
  | "General";

export type AchievementRarity = "Common" | "Uncommon" | "Rare" | "Epic" | "Legendary";

/**
 * Country data interface for achievement conditions
 * Subset of full Country model with fields used for achievement checking
 */
export interface CountryDataForAchievements {
  // Core economic metrics
  currentTotalGdp: number;
  currentGdpPerCapita: number;
  currentPopulation: number;
  economicTier: string;

  // Growth metrics
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  actualGdpGrowth: number;

  // Economic indicators
  unemploymentRate?: number | null;
  inflationRate?: number | null;
  taxRevenueGDPPercent?: number | null;

  // Social metrics
  lifeExpectancy?: number | null;
  literacyRate?: number | null;

  // Metadata
  createdAt: Date;
  id: string;
}

/**
 * Extended data for complex achievement conditions
 * Includes relational counts and external data
 */
export interface ExtendedAchievementData {
  country: CountryDataForAchievements;

  // Diplomatic counts
  embassyCount?: number;
  treatyCount?: number;
  tradePartnerCount?: number;
  allianceCount?: number;

  // Military data
  militaryBranchCount?: number;
  militarySpendingPercent?: number;
  totalMilitaryPersonnel?: number;

  // Government data
  atomicComponentCount?: number;
  governmentType?: string;

  // Social platform metrics
  thinkpageCount?: number;
  followerCount?: number;
  trendingPostCount?: number;

  // Activity metrics
  daysActive?: number;
  totalAchievements?: number;

  // Card metrics
  loreCardCount?: number;
  retiredCardCount?: number;
  distinctCountryIdCount?: number;

  /**
   * Live percentile thresholds for scale metrics (population/GDP/GDP-per-capita),
   * keyed by metric then percentile. Populated per-check by the achievement
   * service so scale achievements stay relative to the real country distribution.
   */
  scaleThresholds?: import("./achievement-scaling").ScaleThresholds;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  rarity: AchievementRarity;
  points: number;
  iconUrl: string;

  /**
   * Condition function to check if achievement should be unlocked
   * @param data Extended country and relational data
   * @returns true if achievement should be unlocked
   */
  condition: (data: ExtendedAchievementData) => boolean;
}

/**
 * Master Achievement Registry
 * 50+ pre-defined achievements across all categories
 */
export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // ==========================================
  // ECONOMIC ACHIEVEMENTS (15)
  // ==========================================
  {
    id: "econ-first-million",
    title: "Emerging Economy",
    description: "Rank in the top 75% of nations by total GDP",
    category: "Economic",
    rarity: "Common",
    points: 10,
    iconUrl: "💵",
    condition: (data) => meetsScale(data, "currentTotalGdp", RARITY_PERCENTILE.Common),
  },
  {
    id: "econ-millionaire-nation",
    title: "Major Economy",
    description: "Rank in the top 50% of nations by total GDP",
    category: "Economic",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "💰",
    condition: (data) => meetsScale(data, "currentTotalGdp", RARITY_PERCENTILE.Uncommon),
  },
  {
    id: "econ-economic-powerhouse",
    title: "Economic Powerhouse",
    description: "Rank in the top 25% of nations by total GDP",
    category: "Economic",
    rarity: "Rare",
    points: 50,
    iconUrl: "🏦",
    condition: (data) => meetsScale(data, "currentTotalGdp", RARITY_PERCENTILE.Rare),
  },
  {
    id: "econ-trillion-club",
    title: "Economic Heavyweight",
    description: "Rank in the top 10% of nations by total GDP",
    category: "Economic",
    rarity: "Epic",
    points: 100,
    iconUrl: "💎",
    condition: (data) => meetsScale(data, "currentTotalGdp", RARITY_PERCENTILE.Epic),
  },
  {
    id: "econ-global-titan",
    title: "Global Economic Titan",
    description: "Rank in the top 2% of nations by total GDP",
    category: "Economic",
    rarity: "Legendary",
    points: 250,
    iconUrl: "👑",
    condition: (data) => meetsScale(data, "currentTotalGdp", RARITY_PERCENTILE.Legendary),
  },
  {
    id: "econ-wealthy-citizens",
    title: "Wealthy Citizens",
    description: "Rank in the top 75% of nations by GDP per capita",
    category: "Economic",
    rarity: "Common",
    points: 15,
    iconUrl: "💳",
    condition: (data) => meetsScale(data, "currentGdpPerCapita", RARITY_PERCENTILE.Common),
  },
  {
    id: "econ-prosperity-nation",
    title: "Prosperity Nation",
    description: "Rank in the top 50% of nations by GDP per capita",
    category: "Economic",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "🏛️",
    condition: (data) => meetsScale(data, "currentGdpPerCapita", RARITY_PERCENTILE.Uncommon),
  },
  {
    id: "econ-first-world-status",
    title: "First World Status",
    description: "Rank in the top 25% of nations by GDP per capita",
    category: "Economic",
    rarity: "Rare",
    points: 60,
    iconUrl: "🌟",
    condition: (data) => meetsScale(data, "currentGdpPerCapita", RARITY_PERCENTILE.Rare),
  },
  {
    id: "econ-ultra-prosperity",
    title: "Ultra Prosperity",
    description: "Rank in the top 10% of nations by GDP per capita",
    category: "Economic",
    rarity: "Epic",
    points: 120,
    iconUrl: "💸",
    condition: (data) => meetsScale(data, "currentGdpPerCapita", RARITY_PERCENTILE.Epic),
  },
  {
    id: "econ-growth-rocket",
    title: "Growth Rocket",
    description: "Achieve 10% GDP growth rate",
    category: "Economic",
    rarity: "Rare",
    points: 50,
    iconUrl: "🚀",
    condition: (data) => data.country.adjustedGdpGrowth >= 10.0,
  },
  {
    id: "econ-boom-cycle",
    title: "Economic Boom",
    description: "Achieve 15% GDP growth rate",
    category: "Economic",
    rarity: "Epic",
    points: 100,
    iconUrl: "📈",
    condition: (data) => data.country.adjustedGdpGrowth >= 15.0,
  },
  {
    id: "econ-full-employment",
    title: "Full Employment",
    description: "Reach unemployment rate below 3%",
    category: "Economic",
    rarity: "Rare",
    points: 50,
    iconUrl: "👷",
    condition: (data) => (data.country.unemploymentRate ?? 100) < 3.0,
  },
  {
    id: "econ-price-stability",
    title: "Price Stability Master",
    description: "Maintain inflation below 2%",
    category: "Economic",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "⚖️",
    condition: (data) => (data.country.inflationRate ?? 100) < 2.0,
  },
  {
    id: "econ-tax-efficiency",
    title: "Tax Efficiency Expert",
    description: "Collect 30%+ tax revenue as % of GDP",
    category: "Economic",
    rarity: "Rare",
    points: 40,
    iconUrl: "🧾",
    condition: (data) => (data.country.taxRevenueGDPPercent ?? 0) >= 30.0,
  },
  {
    id: "econ-tier-advancement",
    title: "Economic Tier Advancement",
    description: "Reach Tier 1 economic status",
    category: "Economic",
    rarity: "Epic",
    points: 100,
    iconUrl: "🥇",
    condition: (data) => data.country.economicTier === "Tier 1",
  },

  // ==========================================
  // MILITARY ACHIEVEMENTS (10)
  // ==========================================
  {
    id: "mil-first-branch",
    title: "First Military Branch",
    description: "Establish your first military branch",
    category: "Military",
    rarity: "Common",
    points: 10,
    iconUrl: "⚔️",
    condition: (data) => (data.militaryBranchCount ?? 0) >= 1,
  },
  {
    id: "mil-armed-forces",
    title: "Armed Forces",
    description: "Establish three military branches",
    category: "Military",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "🪖",
    condition: (data) => (data.militaryBranchCount ?? 0) >= 3,
  },
  {
    id: "mil-full-spectrum",
    title: "Full Spectrum Military",
    description: "Establish five military branches",
    category: "Military",
    rarity: "Rare",
    points: 50,
    iconUrl: "🛡️",
    condition: (data) => (data.militaryBranchCount ?? 0) >= 5,
  },
  {
    id: "mil-defense-commitment",
    title: "Defense Commitment",
    description: "Spend 1% of GDP on military",
    category: "Military",
    rarity: "Common",
    points: 15,
    iconUrl: "💂",
    condition: (data) => (data.militarySpendingPercent ?? 0) >= 1.0,
  },
  {
    id: "mil-strong-defense",
    title: "Strong Defense",
    description: "Spend 3% of GDP on military",
    category: "Military",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "🏰",
    condition: (data) => (data.militarySpendingPercent ?? 0) >= 3.0,
  },
  {
    id: "mil-military-superpower",
    title: "Military Superpower",
    description: "Spend 5% of GDP on military",
    category: "Military",
    rarity: "Rare",
    points: 60,
    iconUrl: "⚡",
    condition: (data) => (data.militarySpendingPercent ?? 0) >= 5.0,
  },
  {
    id: "mil-standing-army",
    title: "Standing Army",
    description: "Recruit 10,000 military personnel",
    category: "Military",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "🎖️",
    condition: (data) => (data.totalMilitaryPersonnel ?? 0) >= 10_000,
  },
  {
    id: "mil-large-force",
    title: "Large Military Force",
    description: "Recruit 100,000 military personnel",
    category: "Military",
    rarity: "Rare",
    points: 50,
    iconUrl: "🪂",
    condition: (data) => (data.totalMilitaryPersonnel ?? 0) >= 100_000,
  },
  {
    id: "mil-massive-force",
    title: "Massive Military Force",
    description: "Recruit 1,000,000 military personnel",
    category: "Military",
    rarity: "Epic",
    points: 100,
    iconUrl: "🚁",
    condition: (data) => (data.totalMilitaryPersonnel ?? 0) >= 1_000_000,
  },
  {
    id: "mil-global-force",
    title: "Global Military Force",
    description: "Recruit 5,000,000 military personnel",
    category: "Military",
    rarity: "Legendary",
    points: 200,
    iconUrl: "✈️",
    condition: (data) => (data.totalMilitaryPersonnel ?? 0) >= 5_000_000,
  },

  // ==========================================
  // DIPLOMATIC ACHIEVEMENTS (10)
  // ==========================================
  {
    id: "dip-first-embassy",
    title: "First Embassy",
    description: "Establish your first embassy abroad",
    category: "Diplomatic",
    rarity: "Common",
    points: 10,
    iconUrl: "🏢",
    condition: (data) => (data.embassyCount ?? 0) >= 1,
  },
  {
    id: "dip-diplomatic-network",
    title: "Diplomatic Network",
    description: "Establish 5 embassies",
    category: "Diplomatic",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "🌐",
    condition: (data) => (data.embassyCount ?? 0) >= 5,
  },
  {
    id: "dip-global-presence",
    title: "Global Presence",
    description: "Establish 10 embassies",
    category: "Diplomatic",
    rarity: "Rare",
    points: 50,
    iconUrl: "🗺️",
    condition: (data) => (data.embassyCount ?? 0) >= 10,
  },
  {
    id: "dip-embassy-network",
    title: "Embassy Network",
    description: "Establish 25 embassies",
    category: "Diplomatic",
    rarity: "Epic",
    points: 100,
    iconUrl: "🏛️",
    condition: (data) => (data.embassyCount ?? 0) >= 25,
  },
  {
    id: "dip-first-treaty",
    title: "Treaty Maker",
    description: "Sign your first treaty",
    category: "Diplomatic",
    rarity: "Common",
    points: 10,
    iconUrl: "📜",
    condition: (data) => (data.treatyCount ?? 0) >= 1,
  },
  {
    id: "dip-treaty-network",
    title: "Treaty Network",
    description: "Sign 10 treaties",
    category: "Diplomatic",
    rarity: "Rare",
    points: 50,
    iconUrl: "📋",
    condition: (data) => (data.treatyCount ?? 0) >= 10,
  },
  {
    id: "dip-trade-partners",
    title: "Trade Partners",
    description: "Establish 25 trade partnerships",
    category: "Diplomatic",
    rarity: "Rare",
    points: 50,
    iconUrl: "🤝",
    condition: (data) => (data.tradePartnerCount ?? 0) >= 25,
  },
  {
    id: "dip-trade-hub",
    title: "Global Trade Hub",
    description: "Establish 50 trade partnerships",
    category: "Diplomatic",
    rarity: "Epic",
    points: 100,
    iconUrl: "🚢",
    condition: (data) => (data.tradePartnerCount ?? 0) >= 50,
  },
  {
    id: "dip-alliance-maker",
    title: "Alliance Maker",
    description: "Form 5 alliances",
    category: "Diplomatic",
    rarity: "Rare",
    points: 60,
    iconUrl: "🛡️",
    condition: (data) => (data.allianceCount ?? 0) >= 5,
  },
  {
    id: "dip-alliance-network",
    title: "Alliance Network",
    description: "Form 10 alliances",
    category: "Diplomatic",
    rarity: "Epic",
    points: 120,
    iconUrl: "⚔️",
    condition: (data) => (data.allianceCount ?? 0) >= 10,
  },

  // ==========================================
  // GOVERNMENT ACHIEVEMENTS (10)
  // ==========================================
  {
    id: "gov-first-component",
    title: "First Government Component",
    description: "Implement your first atomic component",
    category: "Government",
    rarity: "Common",
    points: 10,
    iconUrl: "⚙️",
    condition: (data) => (data.atomicComponentCount ?? 0) >= 1,
  },
  {
    id: "gov-building-blocks",
    title: "Government Building Blocks",
    description: "Implement 5 atomic components",
    category: "Government",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "🧱",
    condition: (data) => (data.atomicComponentCount ?? 0) >= 5,
  },
  {
    id: "gov-sophisticated",
    title: "Sophisticated Government",
    description: "Implement 10 atomic components",
    category: "Government",
    rarity: "Rare",
    points: 50,
    iconUrl: "🏢",
    condition: (data) => (data.atomicComponentCount ?? 0) >= 10,
  },
  {
    id: "gov-complex-system",
    title: "Complex Government System",
    description: "Implement 15 atomic components",
    category: "Government",
    rarity: "Epic",
    points: 100,
    iconUrl: "🏛️",
    condition: (data) => (data.atomicComponentCount ?? 0) >= 15,
  },
  {
    id: "gov-democracy",
    title: "Democratic Nation",
    description: "Implement democratic governance",
    category: "Government",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "🗳️",
    condition: (data) => data.governmentType?.toLowerCase().includes("democracy") ?? false,
  },
  {
    id: "gov-republic",
    title: "Republican Government",
    description: "Implement republican governance",
    category: "Government",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "🏛️",
    condition: (data) => data.governmentType?.toLowerCase().includes("republic") ?? false,
  },
  {
    id: "gov-monarchy",
    title: "Monarchist State",
    description: "Implement monarchist governance",
    category: "Government",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "👑",
    condition: (data) => data.governmentType?.toLowerCase().includes("monarchy") ?? false,
  },
  {
    id: "gov-federation",
    title: "Federal System",
    description: "Implement federal governance",
    category: "Government",
    rarity: "Rare",
    points: 50,
    iconUrl: "🗂️",
    condition: (data) => data.governmentType?.toLowerCase().includes("federal") ?? false,
  },
  {
    id: "gov-unitary",
    title: "Unitary State",
    description: "Implement unitary governance",
    category: "Government",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "📍",
    condition: (data) => data.governmentType?.toLowerCase().includes("unitary") ?? false,
  },
  {
    id: "gov-parliamentary",
    title: "Parliamentary System",
    description: "Implement parliamentary governance",
    category: "Government",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "🏛️",
    condition: (data) => data.governmentType?.toLowerCase().includes("parliament") ?? false,
  },

  // ==========================================
  // SOCIAL ACHIEVEMENTS (5)
  // ==========================================
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

  // ==========================================
  // GENERAL ACHIEVEMENTS (10)
  // ==========================================
  {
    id: "gen-welcome",
    title: "Welcome to IxStats",
    description: "Create your account",
    category: "General",
    rarity: "Common",
    points: 5,
    iconUrl: "👋",
    condition: (data) => true, // Auto-unlocked on account creation
  },
  {
    id: "gen-first-country",
    title: "First Country Claim",
    description: "Claim your first country",
    category: "General",
    rarity: "Common",
    points: 10,
    iconUrl: "🗺️",
    condition: (data) => !!data.country.id,
  },
  {
    id: "gen-one-week",
    title: "One Week Active",
    description: "Be active for one week",
    category: "General",
    rarity: "Common",
    points: 15,
    iconUrl: "📅",
    condition: (data) => (data.daysActive ?? 0) >= 7,
  },
  {
    id: "gen-one-month",
    title: "One Month Active",
    description: "Be active for one month",
    category: "General",
    rarity: "Uncommon",
    points: 30,
    iconUrl: "📆",
    condition: (data) => (data.daysActive ?? 0) >= 30,
  },
  {
    id: "gen-three-months",
    title: "Three Months Active",
    description: "Be active for three months",
    category: "General",
    rarity: "Rare",
    points: 60,
    iconUrl: "🗓️",
    condition: (data) => (data.daysActive ?? 0) >= 90,
  },
  {
    id: "gen-one-year",
    title: "One Year Anniversary",
    description: "Be active for one year",
    category: "General",
    rarity: "Epic",
    points: 120,
    iconUrl: "🎂",
    condition: (data) => (data.daysActive ?? 0) >= 365,
  },
  {
    id: "gen-achievement-hunter",
    title: "Achievement Hunter",
    description: "Unlock 10 achievements",
    category: "General",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "🏆",
    condition: (data) => (data.totalAchievements ?? 0) >= 10,
  },
  {
    id: "gen-achievement-master",
    title: "Achievement Master",
    description: "Unlock 25 achievements",
    category: "General",
    rarity: "Rare",
    points: 50,
    iconUrl: "🥇",
    condition: (data) => (data.totalAchievements ?? 0) >= 25,
  },
  {
    id: "gen-achievement-legend",
    title: "Achievement Legend",
    description: "Unlock 50 achievements",
    category: "General",
    rarity: "Epic",
    points: 100,
    iconUrl: "👑",
    condition: (data) => (data.totalAchievements ?? 0) >= 50,
  },
  {
    id: "pop-rising-nation",
    title: "Rising Nation",
    description: "Rank in the top 75% of nations by population",
    category: "General",
    rarity: "Common",
    points: 10,
    iconUrl: "🧑‍🤝‍🧑",
    condition: (data) => meetsScale(data, "currentPopulation", RARITY_PERCENTILE.Common),
  },
  {
    id: "gen-population-growth",
    title: "Population Boom",
    description: "Rank in the top 50% of nations by population",
    category: "General",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "👥",
    condition: (data) => meetsScale(data, "currentPopulation", RARITY_PERCENTILE.Uncommon),
  },
  {
    id: "pop-major-power",
    title: "Demographic Major Power",
    description: "Rank in the top 25% of nations by population",
    category: "General",
    rarity: "Rare",
    points: 50,
    iconUrl: "🏙️",
    condition: (data) => meetsScale(data, "currentPopulation", RARITY_PERCENTILE.Rare),
  },
  {
    id: "pop-superpower",
    title: "Demographic Superpower",
    description: "Rank in the top 10% of nations by population",
    category: "General",
    rarity: "Epic",
    points: 100,
    iconUrl: "🌆",
    condition: (data) => meetsScale(data, "currentPopulation", RARITY_PERCENTILE.Epic),
  },
  {
    id: "pop-demographic-titan",
    title: "Demographic Titan",
    description: "Rank in the top 2% of nations by population",
    category: "General",
    rarity: "Legendary",
    points: 250,
    iconUrl: "🌐",
    condition: (data) => meetsScale(data, "currentPopulation", RARITY_PERCENTILE.Legendary),
  },
  {
    id: "vid-end-of-days",
    title: "Vidmaster Challenge: End of Days",
    description: "Unlock all other achievements in the military, diplomatic, and economic trees",
    category: "General",
    rarity: "Legendary",
    points: 250,
    iconUrl: "🌟",
    condition: (data) => (data.totalAchievements ?? 0) >= 30,
  },
  {
    id: "vid-annual",
    title: "Vidmaster Challenge: Annual",
    description: "Establish your nation on a historic anniversary date",
    category: "General",
    rarity: "Legendary",
    points: 150,
    iconUrl: "📅",
    condition: (data) => {
      const days = data.daysActive ?? 0;
      return days > 0 && days % 365 === 0;
    },
  },
  {
    id: "vid-lightswitch",
    title: "Vidmaster Challenge: Lightswitch",
    description: "Have 25+ embassies with 0 active military personnel",
    category: "Diplomatic",
    rarity: "Legendary",
    points: 200,
    iconUrl: "💡",
    condition: (data) => (data.embassyCount ?? 0) >= 25 && (data.totalMilitaryPersonnel ?? 0) === 0,
  },
  {
    id: "meme-stonks",
    title: "Stonks Only Go Up",
    description: "Reach a negative total GDP growth rate",
    category: "Economic",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "📉",
    condition: (data) => data.country.adjustedGdpGrowth < 0,
  },
  {
    id: "meme-1337",
    title: "1337 H4x0r",
    description: "Maintain exactly 1,337,000 GDP per capita",
    category: "General",
    rarity: "Rare",
    points: 50,
    iconUrl: "💻",
    condition: (data) => Math.floor(data.country.currentGdpPerCapita) === 1337,
  },
  {
    id: "meme-bankruptcy",
    title: "Bankruptcy Speedrun",
    description: "Reach exactly $0 GDP per capita or zero population",
    category: "Economic",
    rarity: "Rare",
    points: 50,
    iconUrl: "💸",
    condition: (data) => data.country.currentGdpPerCapita <= 1.0,
  },
  {
    id: "meme-ns-ref",
    title: "NationStates Syndrome",
    description: "Reach 40+ total achievements and milestones",
    category: "General",
    rarity: "Epic",
    points: 100,
    iconUrl: "🎴",
    condition: (data) => (data.totalAchievements ?? 0) >= 40,
  },
  {
    id: "lore-scholar",
    title: "Wiki Scholar",
    description: "Create at least 5 ThinkPages",
    category: "Social",
    rarity: "Uncommon",
    points: 25,
    iconUrl: "📚",
    condition: (data) => (data.thinkpageCount ?? 0) >= 5,
  },
  {
    id: "lore-collector",
    title: "The Chronicles of Ix",
    description: "Gain 30+ followers and establish a large influence network",
    category: "Social",
    rarity: "Rare",
    points: 50,
    iconUrl: "📖",
    condition: (data) => (data.followerCount ?? 0) >= 30,
  },
  {
    id: "collect-lore-keeper",
    title: "Lore Keeper",
    description: "Own 50 or more Lore cards in your vault",
    category: "General",
    rarity: "Rare",
    points: 50,
    iconUrl: "📜",
    condition: (data) => (data.loreCardCount ?? 0) >= 50,
  },
  {
    id: "collect-archaeologist",
    title: "Archaeologist",
    description: "Own 10 or more Retired cards in your vault",
    category: "General",
    rarity: "Rare",
    points: 50,
    iconUrl: "🏺",
    condition: (data) => (data.retiredCardCount ?? 0) >= 10,
  },
  {
    id: "collect-diplomat",
    title: "Diplomat",
    description: "Own cards from at least 20 distinct countries",
    category: "Diplomatic",
    rarity: "Rare",
    points: 50,
    iconUrl: "🤝",
    condition: (data) => (data.distinctCountryIdCount ?? 0) >= 20,
  },
];

/**
 * Get achievement definition by ID
 */
export function getAchievementById(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENT_DEFINITIONS.find((achievement) => achievement.id === id);
}

/**
 * Get all achievements by category
 */
export function getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter((achievement) => achievement.category === category);
}

/**
 * Get all achievements by rarity
 */
export function getAchievementsByRarity(rarity: AchievementRarity): AchievementDefinition[] {
  return ACHIEVEMENT_DEFINITIONS.filter((achievement) => achievement.rarity === rarity);
}

/**
 * Check which achievements should be unlocked for given data
 * @param data Extended country and relational data
 * @param alreadyUnlocked Set of already unlocked achievement IDs
 * @returns Array of achievement IDs that should be unlocked
 */
export function checkAchievements(
  data: ExtendedAchievementData,
  alreadyUnlocked: Set<string>
): string[] {
  const toUnlock: string[] = [];

  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    // Skip if already unlocked
    if (alreadyUnlocked.has(achievement.id)) {
      continue;
    }

    // Check condition
    try {
      if (achievement.condition(data)) {
        toUnlock.push(achievement.id);
      }
    } catch (error) {
      console.error(`Error checking achievement ${achievement.id}:`, error);
    }
  }

  return toUnlock;
}

/**
 * Get total point value for a set of achievements
 */
export function calculateTotalPoints(achievementIds: string[]): number {
  return achievementIds.reduce((total, id) => {
    const achievement = getAchievementById(id);
    return total + (achievement?.points ?? 0);
  }, 0);
}

/**
 * Get achievement statistics
 */
export function getAchievementStats() {
  const stats = {
    total: ACHIEVEMENT_DEFINITIONS.length,
    byCategory: {} as Record<AchievementCategory, number>,
    byRarity: {} as Record<AchievementRarity, number>,
    totalPoints: 0,
  };

  for (const achievement of ACHIEVEMENT_DEFINITIONS) {
    // Count by category
    stats.byCategory[achievement.category] = (stats.byCategory[achievement.category] ?? 0) + 1;

    // Count by rarity
    stats.byRarity[achievement.rarity] = (stats.byRarity[achievement.rarity] ?? 0) + 1;

    // Sum total points
    stats.totalPoints += achievement.points;
  }

  return stats;
}
