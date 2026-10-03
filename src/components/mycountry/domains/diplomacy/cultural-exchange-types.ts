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

export interface CulturalExchangeMetrics {
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
export type ExchangeType =
  | "festival"
  | "exhibition"
  | "education"
  | "cuisine"
  | "arts"
  | "sports"
  | "technology"
  | "diplomacy"
  | "music"
  | "film"
  | "environmental"
  | "science"
  | "trade"
  | "humanitarian"
  | "agriculture"
  | "heritage"
  | "youth";
export type ExchangeStatus = "planning" | "active" | "completed" | "cancelled";

export interface ExchangeTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  label: string;
  description: string;
  /** Used only in the plain-text ThinkPages share copy, never as a UI icon. */
  emoji: string;
}

export interface StatusConfig {
  color: string;
  bg: string;
  label: string;
}

// Cultural exchange type configurations
export const EXCHANGE_TYPES = {
  festival: {
    icon: Star,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Cultural festival",
    description: "Celebration of traditions and customs",
    emoji: "🎭",
  },
  exhibition: {
    icon: Building,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Cultural exhibition",
    description: "Showcase of cultural heritage and artifacts",
    emoji: "🏛️",
  },
  education: {
    icon: Book,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Educational exchange",
    description: "Knowledge sharing and academic collaboration",
    emoji: "📚",
  },
  cuisine: {
    icon: Cutlery,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Culinary exchange",
    description: "Food culture and culinary traditions",
    emoji: "🍜",
  },
  arts: {
    icon: Palette,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Arts exchange",
    description: "Visual arts and creative expression",
    emoji: "🎨",
  },
  sports: {
    icon: Trophy,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Sports exchange",
    description: "Athletic competition and physical culture",
    emoji: "⚽",
  },
  technology: {
    icon: Gamepad,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Tech exchange",
    description: "Innovation and technological collaboration",
    emoji: "💻",
  },
  diplomacy: {
    icon: Globe,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Diplomatic summit",
    description: "High-level diplomatic and cultural dialogue",
    emoji: "🤝",
  },
  music: {
    icon: MusicNote,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Music exchange",
    description: "Musical performances and cultural harmony",
    emoji: "🎵",
  },
  film: {
    icon: Camera,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Film festival",
    description: "Cinema and visual storytelling",
    emoji: "🎬",
  },
  environmental: {
    icon: Flash,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Environmental initiative",
    description: "Sustainability and ecological cooperation",
    emoji: "🌍",
  },
  science: {
    icon: LightBulb,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Scientific collaboration",
    description: "Research and scientific discovery",
    emoji: "🔬",
  },
  trade: {
    icon: ArrowRight,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Trade partnership",
    description: "Economic and commercial cooperation",
    emoji: "💼",
  },
  humanitarian: {
    icon: ThumbsUp,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Humanitarian aid",
    description: "Relief and assistance programs",
    emoji: "❤️",
  },
  agriculture: {
    icon: Star,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Agricultural exchange",
    description: "Farming techniques and food security",
    emoji: "🌾",
  },
  heritage: {
    icon: Building,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Heritage preservation",
    description: "Historical and cultural conservation",
    emoji: "🏺",
  },
  youth: {
    icon: User,
    color: "text-label-secondary",
    bgColor: "bg-fill-3",
    borderColor: "border-separator",
    textColor: "text-label",
    label: "Youth exchange",
    description: "Young leaders and future generations",
    emoji: "👥",
  },
} as const;

// Exchange status configurations. Status is semantic, so it keeps a status colour.
export const STATUS_STYLES = {
  planning: {
    color: "text-yellow",
    bg: "bg-fill-3",
    label: "Planning",
  },
  active: {
    color: "text-green",
    bg: "bg-fill-3",
    label: "Live",
  },
  completed: {
    color: "text-label",
    bg: "bg-fill-3",
    label: "Completed",
  },
  cancelled: {
    color: "text-label-secondary",
    bg: "bg-fill-3",
    label: "Cancelled",
  },
} as const;
