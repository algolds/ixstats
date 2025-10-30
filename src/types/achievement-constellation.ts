export interface AchievementConstellation {
  id: string;
  countryId: string;
  constellationName: string;
  totalAchievements: number;
  prestigeScore: number;
  visualLayout: ConstellationLayout;
  achievements: DiplomaticAchievement[];
  socialMetrics: ConstellationSocialMetrics;
  lastUpdated: string;
  ixTimeContext: number;
}

export interface DiplomaticAchievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  rarity: AchievementRarity;
  achievedAt: string;
  ixTimeContext: number;
  requirements: AchievementRequirement[];
  rewards: AchievementReward[];
  socialReactions: number;
  constellationPosition: ConstellationPosition;
  unlockConditions?: string[];
  dependsOn?: string[]; // Other achievement IDs this depends on
  progress?: AchievementProgress;
  hidden?: boolean; // Hidden until unlocked
}

export interface ConstellationLayout {
  centerX: number;
  centerY: number;
  radius: number;
  rotation: number;
  theme: ConstellationTheme;
  customPositions?: Record<string, ConstellationPosition>;
}

export interface ConstellationPosition {
  x: number;
  y: number;
  brightness: number;
  size: number;
  layer: number; // Z-index for overlapping stars
  connections?: string[]; // Connected achievement IDs
}

export interface ConstellationSocialMetrics {
  totalViews: number;
  socialShares: number;
  admirers: number; // Other countries following this constellation
  influenceScore: number;
  trendingAchievements: string[];
}

export interface AchievementRequirement {
  id: string;
  type: RequirementType;
  description: string;
  targetValue: number;
  currentValue: number;
  completed: boolean;
  metadata?: Record<string, any>;
}

export interface AchievementReward {
  id: string;
  type: RewardType;
  description: string;
  value: number;
  claimed: boolean;
  metadata?: Record<string, any>;
}

export interface AchievementProgress {
  percentage: number;
  currentStep: number;
  totalSteps: number;
  nextMilestone?: string;
  estimatedCompletion?: string;
}

// Enums and type definitions
export type AchievementCategory =
  | "diplomatic"
  | "cultural"
  | "economic"
  | "intelligence"
  | "social"
  | "military"
  | "environmental"
  | "technological";

export type AchievementTier = "bronze" | "silver" | "gold" | "diamond" | "legendary";

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type RequirementType =
  | "diplomatic_relationships"
  | "cultural_exchanges"
  | "economic_metrics"
  | "intelligence_operations"
  | "social_engagement"
  | "time_based"
  | "collaborative"
  | "milestone";

export type RewardType =
  | "prestige_points"
  | "social_boost"
  | "economic_bonus"
  | "diplomatic_influence"
  | "cultural_impact"
  | "intelligence_access"
  | "cosmetic_unlock"
  | "title_unlock";

export type ConstellationTheme =
  | "classic_gold"
  | "diplomatic_blue"
  | "cultural_rainbow"
  | "intelligence_stealth"
  | "economic_green"
  | "royal_purple"
  | "stellar_cosmic"
  | "aurora_borealis";

// Achievement templates and configurations
export const ACHIEVEMENT_TIER_CONFIG: Record<
  AchievementTier,
  {
    color: string;
    glow: string;
    size: number;
    prestigeMultiplier: number;
    description: string;
  }
> = {
  bronze: {
    color: "#CD7F32",
    glow: "drop-shadow(0 0 8px #CD7F32)",
    size: 12,
    prestigeMultiplier: 1,
    description: "Basic achievement",
  },
  silver: {
    color: "#C0C0C0",
    glow: "drop-shadow(0 0 12px #C0C0C0)",
    size: 16,
    prestigeMultiplier: 2,
    description: "Notable accomplishment",
  },
  gold: {
    color: "#FFD700",
    glow: "drop-shadow(0 0 16px #FFD700)",
    size: 20,
    prestigeMultiplier: 5,
    description: "Exceptional achievement",
  },
  diamond: {
    color: "#B9F2FF",
    glow: "drop-shadow(0 0 20px #B9F2FF)",
    size: 24,
    prestigeMultiplier: 10,
    description: "Rare and prestigious",
  },
  legendary: {
    color: "#FF6B6B",
    glow: "drop-shadow(0 0 24px #FF6B6B) drop-shadow(0 0 36px #FFD93D)",
    size: 28,
    prestigeMultiplier: 25,
    description: "Legendary accomplishment",
  },
};

export const ACHIEVEMENT_RARITY_CONFIG: Record<
  AchievementRarity,
  {
    probability: number;
    sparkleEffect: boolean;
    pulseAnimation: boolean;
    description: string;
  }
> = {
  common: {
    probability: 0.6,
    sparkleEffect: false,
    pulseAnimation: false,
    description: "Frequently achieved",
  },
  uncommon: {
    probability: 0.25,
    sparkleEffect: false,
    pulseAnimation: false,
    description: "Moderately rare",
  },
  rare: {
    probability: 0.1,
    sparkleEffect: true,
    pulseAnimation: false,
    description: "Rarely achieved",
  },
  epic: {
    probability: 0.04,
    sparkleEffect: true,
    pulseAnimation: true,
    description: "Exceptionally rare",
  },
  legendary: {
    probability: 0.01,
    sparkleEffect: true,
    pulseAnimation: true,
    description: "Legendary rarity",
  },
};

export const ACHIEVEMENT_CATEGORY_CONFIG: Record<
  AchievementCategory,
  {
    color: string;
    icon: string;
    description: string;
    constellationShape: "circle" | "star" | "diamond" | "triangle" | "hexagon";
  }
> = {
  diplomatic: {
    color: "#4F46E5",
    icon: "handshake",
    description: "Diplomatic excellence and relationship building",
    constellationShape: "circle",
  },
  cultural: {
    color: "#7C3AED",
    icon: "palette",
    description: "Cultural exchange and heritage preservation",
    constellationShape: "star",
  },
  economic: {
    color: "#059669",
    icon: "chart-line",
    description: "Economic growth and trade achievements",
    constellationShape: "diamond",
  },
  intelligence: {
    color: "#DC2626",
    icon: "spy",
    description: "Intelligence operations and strategic analysis",
    constellationShape: "triangle",
  },
  social: {
    color: "#DB2777",
    icon: "users",
    description: "Social influence and community engagement",
    constellationShape: "hexagon",
  },
  military: {
    color: "#991B1B",
    icon: "shield",
    description: "Defense and security achievements",
    constellationShape: "triangle",
  },
  environmental: {
    color: "#16A34A",
    icon: "leaf",
    description: "Environmental protection and sustainability",
    constellationShape: "circle",
  },
  technological: {
    color: "#0891B2",
    icon: "cpu",
    description: "Innovation and technological advancement",
    constellationShape: "hexagon",
  },
};

// Predefined achievement templates
export const ACHIEVEMENT_TEMPLATES: Partial<DiplomaticAchievement>[] = [
  // Diplomatic Achievements
  {
    id: "first_contact",
    title: "First Contact",
    description: "Establish your first diplomatic relationship",
    category: "diplomatic",
    tier: "bronze",
    rarity: "common",
    requirements: [
      {
        id: "establish_relationship",
        type: "diplomatic_relationships",
        description: "Establish 1 diplomatic relationship",
        targetValue: 1,
        currentValue: 0,
        completed: false,
      },
    ],
    rewards: [
      {
        id: "prestige_reward",
        type: "prestige_points",
        description: "+50 Prestige Points",
        value: 50,
        claimed: false,
      },
    ],
  },
  {
    id: "alliance_architect",
    title: "Alliance Architect",
    description: "Create 5 strategic diplomatic alliances",
    category: "diplomatic",
    tier: "gold",
    rarity: "rare",
    requirements: [
      {
        id: "create_alliances",
        type: "diplomatic_relationships",
        description: "Create 5 strategic alliances",
        targetValue: 5,
        currentValue: 0,
        completed: false,
      },
    ],
    dependsOn: ["first_contact"],
  },

  // Cultural Achievements
  {
    id: "festival_host",
    title: "Festival Host",
    description: "Successfully host a cultural exchange festival",
    category: "cultural",
    tier: "silver",
    rarity: "uncommon",
    requirements: [
      {
        id: "host_festival",
        type: "cultural_exchanges",
        description: "Host 1 cultural festival",
        targetValue: 1,
        currentValue: 0,
        completed: false,
      },
    ],
  },

  // Economic Achievements
  {
    id: "trade_pioneer",
    title: "Trade Pioneer",
    description: "Establish your first trade relationship",
    category: "economic",
    tier: "bronze",
    rarity: "common",
    requirements: [
      {
        id: "establish_trade",
        type: "economic_metrics",
        description: "Establish 1 trade relationship",
        targetValue: 1,
        currentValue: 0,
        completed: false,
      },
    ],
  },

  // Intelligence Achievements
  {
    id: "intelligence_analyst",
    title: "Intelligence Analyst",
    description: "Complete your first strategic assessment",
    category: "intelligence",
    tier: "bronze",
    rarity: "common",
    requirements: [
      {
        id: "complete_assessment",
        type: "intelligence_operations",
        description: "Complete 1 strategic assessment",
        targetValue: 1,
        currentValue: 0,
        completed: false,
      },
    ],
  },

  // Social Achievements
  {
    id: "rising_star",
    title: "Rising Star",
    description: "Gain your first diplomatic followers",
    category: "social",
    tier: "bronze",
    rarity: "common",
    requirements: [
      {
        id: "gain_followers",
        type: "social_engagement",
        description: "Gain 10 followers",
        targetValue: 10,
        currentValue: 0,
        completed: false,
      },
    ],
  },

  // Legendary Achievement
  {
    id: "diplomatic_legend",
    title: "Diplomatic Legend",
    description: "Achieve legendary status in all diplomatic categories",
    category: "diplomatic",
    tier: "legendary",
    rarity: "legendary",
    requirements: [
      {
        id: "complete_all_categories",
        type: "milestone",
        description: "Achieve gold tier in all categories",
        targetValue: 8,
        currentValue: 0,
        completed: false,
      },
    ],
    hidden: true,
    dependsOn: [
      "alliance_architect",
      "festival_host",
      "trade_pioneer",
      "intelligence_analyst",
      "rising_star",
    ],
  },
];

// Utility functions for achievements
export const calculatePrestigeScore = (achievements: DiplomaticAchievement[]): number => {
  return achievements.reduce((total, achievement) => {
    const tierConfig = ACHIEVEMENT_TIER_CONFIG[achievement.tier || "bronze"];
    const rarityConfig = ACHIEVEMENT_RARITY_CONFIG[achievement.rarity || "common"];
    const baseScore = 100;

    if (!tierConfig || !rarityConfig) {
      console.warn("Missing tier or rarity config for achievement:", achievement);
      return total + baseScore; // fallback to base score
    }

    return total + baseScore * tierConfig.prestigeMultiplier * (2 - rarityConfig.probability);
  }, 0);
};

export const getAchievementsByCategory = (
  achievements: DiplomaticAchievement[],
  category: AchievementCategory
): DiplomaticAchievement[] => {
  return achievements.filter((achievement) => achievement.category === category);
};

export const getUnlockedAchievements = (
  achievements: DiplomaticAchievement[]
): DiplomaticAchievement[] => {
  return achievements.filter((achievement) => achievement.achievedAt && !achievement.hidden);
};

export const getAvailableAchievements = (
  achievements: DiplomaticAchievement[],
  unlockedIds: string[]
): DiplomaticAchievement[] => {
  return achievements.filter((achievement) => {
    if (achievement.hidden && !unlockedIds.includes(achievement.id)) return false;
    if (unlockedIds.includes(achievement.id)) return false;
    if (achievement.dependsOn) {
      return achievement.dependsOn.every((depId) => unlockedIds.includes(depId));
    }
    return true;
  });
};
