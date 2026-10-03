import {
  ArrowRight,
  Book,
  Building,
  Camera,
  Cutlery,
  Flash,
  Gamepad,
  Globe,
  LightBulb,
  MusicNote,
  Palette,
  Star,
  ThumbsUp,
  Trophy,
  User,
} from "iconoir-react";

interface CulturalExchangeMetrics {
  participants: number;
  culturalImpact: number;
  diplomaticValue: number;
  socialEngagement: number;
  baseCulturalImpact?: number;
  baseDiplomaticValue?: number;
  missionBonus?: number;
  diplomaticBonus?: number;
}

export interface CulturalExchange {
  id: string;
  title: string;
  type:
    | "festival"
    | "exhibition"
    | "education"
    | "cuisine"
    | "arts"
    | "sports"
    | "technology"
    | "diplomacy";
  description: string;
  hostCountry: {
    id: string;
    name: string;
    flagUrl?: string;
  };
  participatingCountries: Array<{
    id: string;
    name: string;
    flagUrl?: string;
    role: "co-host" | "participant" | "observer";
  }>;
  status: "planning" | "active" | "completed" | "cancelled";
  startDate: string;
  endDate: string;
  ixTimeContext: number;
  metrics: CulturalExchangeMetrics;
  linkedMissions?: {
    total: number;
    completed: number;
    active: number;
  };
  bonusReasoning?: string[];
  achievements: string[];
  culturalArtifacts: Array<{
    id: string;
    type: "photo" | "video" | "document" | "artwork" | "recipe" | "music";
    title: string;
    thumbnailUrl?: string;
    contributor: string;
    countryId: string;
  }>;
  diplomaticOutcomes?: {
    newPartnerships: number;
    tradeAgreements: number;
    futureCollaborations: string[];
  };
}

export interface CulturalExchangeProgramProps {
  primaryCountry: {
    id: string;
    name: string;
    flagUrl?: string;
    economicTier?: string;
  };
  exchanges?: CulturalExchange[]; // Optional - will fetch internally if not provided
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
}

// Type aliases for exchange types and statuses
export type ExchangeType = keyof typeof EXCHANGE_TYPES;
export type ExchangeStatus = "planning" | "active" | "completed" | "cancelled";

export interface ExchangeTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  /** Used only in the plain-text ThinkPages share copy, never as a UI icon. */
  emoji: string;
}

export interface StatusConfig {
  color: string;
  label: string;
}

// Cultural exchange type configurations
export const EXCHANGE_TYPES = {
  festival: { icon: Star, label: "Cultural festival", emoji: "🎭" },
  exhibition: { icon: Building, label: "Cultural exhibition", emoji: "🏛️" },
  education: { icon: Book, label: "Educational exchange", emoji: "📚" },
  cuisine: { icon: Cutlery, label: "Culinary exchange", emoji: "🍜" },
  arts: { icon: Palette, label: "Arts exchange", emoji: "🎨" },
  sports: { icon: Trophy, label: "Sports exchange", emoji: "⚽" },
  technology: { icon: Gamepad, label: "Tech exchange", emoji: "💻" },
  diplomacy: { icon: Globe, label: "Diplomatic summit", emoji: "🤝" },
  music: { icon: MusicNote, label: "Music exchange", emoji: "🎵" },
  film: { icon: Camera, label: "Film festival", emoji: "🎬" },
  environmental: { icon: Flash, label: "Environmental initiative", emoji: "🌍" },
  science: { icon: LightBulb, label: "Scientific collaboration", emoji: "🔬" },
  trade: { icon: ArrowRight, label: "Trade partnership", emoji: "💼" },
  humanitarian: { icon: ThumbsUp, label: "Humanitarian aid", emoji: "❤️" },
  agriculture: { icon: Star, label: "Agricultural exchange", emoji: "🌾" },
  heritage: { icon: Building, label: "Heritage preservation", emoji: "🏺" },
  youth: { icon: User, label: "Youth exchange", emoji: "👥" },
} as const;

// Exchange status configurations. Status is semantic, so it keeps a status colour.
export const STATUS_STYLES = {
  planning: {
    color: "text-yellow",
    label: "Planning",
  },
  active: {
    color: "text-green",
    label: "Live",
  },
  completed: {
    color: "text-label",
    label: "Completed",
  },
  cancelled: {
    color: "text-label-secondary",
    label: "Cancelled",
  },
} as const;
