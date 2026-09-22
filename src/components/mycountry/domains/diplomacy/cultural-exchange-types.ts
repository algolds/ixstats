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
import { easeInOut, easeOut } from "motion/react";

const linearEasing = (t: number) => t;

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
  emoji: string;
}

export interface StatusConfig {
  color: string;
  bg: string;
  icon: string;
  label: string;
}

// Cultural exchange type configurations
export const EXCHANGE_TYPES = {
  festival: {
    icon: Star,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10 dark:bg-indigo-500/15",
    borderColor: "border-indigo-500/30 dark:border-indigo-500/20",
    textColor: "text-foreground",
    label: "Cultural Festival",
    description: "Celebration of traditions and customs",
    emoji: "🎭",
  },
  exhibition: {
    icon: Building,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10 dark:bg-blue-500/15",
    borderColor: "border-blue-500/30 dark:border-blue-500/20",
    textColor: "text-foreground",
    label: "Cultural Exhibition",
    description: "Showcase of cultural heritage and artifacts",
    emoji: "🏛️",
  },
  education: {
    icon: Book,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderColor: "border-emerald-500/30 dark:border-emerald-500/20",
    textColor: "text-foreground",
    label: "Educational Exchange",
    description: "Knowledge sharing and academic collaboration",
    emoji: "📚",
  },
  cuisine: {
    icon: Cutlery,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10 dark:bg-amber-500/15",
    borderColor: "border-amber-500/30 dark:border-amber-500/20",
    textColor: "text-foreground",
    label: "Culinary Exchange",
    description: "Food culture and culinary traditions",
    emoji: "🍜",
  },
  arts: {
    icon: Palette,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10 dark:bg-blue-500/15",
    borderColor: "border-blue-500/30 dark:border-blue-500/20",
    textColor: "text-foreground",
    label: "Arts Exchange",
    description: "Visual arts and creative expression",
    emoji: "🎨",
  },
  sports: {
    icon: Trophy,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10 dark:bg-red-500/15",
    borderColor: "border-red-500/30 dark:border-red-500/20",
    textColor: "text-foreground",
    label: "Sports Exchange",
    description: "Athletic competition and physical culture",
    emoji: "⚽",
  },
  technology: {
    icon: Gamepad,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-500/10 dark:bg-cyan-500/15",
    borderColor: "border-cyan-500/30 dark:border-cyan-500/20",
    textColor: "text-foreground",
    label: "Tech Exchange",
    description: "Innovation and technological collaboration",
    emoji: "💻",
  },
  diplomacy: {
    icon: Globe,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10 dark:bg-amber-500/15",
    borderColor: "border-amber-500/30 dark:border-amber-500/20",
    textColor: "text-foreground",
    label: "Diplomatic Summit",
    description: "High-level diplomatic and cultural dialogue",
    emoji: "🤝",
  },
  music: {
    icon: MusicNote,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10 dark:bg-indigo-500/15",
    borderColor: "border-indigo-500/30 dark:border-indigo-500/20",
    textColor: "text-foreground",
    label: "Music Exchange",
    description: "Musical performances and cultural harmony",
    emoji: "🎵",
  },
  film: {
    icon: Camera,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10 dark:bg-indigo-500/15",
    borderColor: "border-indigo-500/30 dark:border-indigo-500/20",
    textColor: "text-foreground",
    label: "Film Festival",
    description: "Cinema and visual storytelling",
    emoji: "🎬",
  },
  environmental: {
    icon: Flash,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderColor: "border-emerald-500/30 dark:border-emerald-500/20",
    textColor: "text-foreground",
    label: "Environmental Initiative",
    description: "Sustainability and ecological cooperation",
    emoji: "🌍",
  },
  science: {
    icon: LightBulb,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor: "bg-cyan-500/10 dark:bg-cyan-500/15",
    borderColor: "border-cyan-500/30 dark:border-cyan-500/20",
    textColor: "text-foreground",
    label: "Scientific Collaboration",
    description: "Research and scientific discovery",
    emoji: "🔬",
  },
  trade: {
    icon: ArrowRight,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderColor: "border-emerald-500/30 dark:border-emerald-500/20",
    textColor: "text-foreground",
    label: "Trade Partnership",
    description: "Economic and commercial cooperation",
    emoji: "💼",
  },
  humanitarian: {
    icon: ThumbsUp,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500/10 dark:bg-red-500/15",
    borderColor: "border-red-500/30 dark:border-red-500/20",
    textColor: "text-foreground",
    label: "Humanitarian Aid",
    description: "Relief and assistance programs",
    emoji: "❤️",
  },
  agriculture: {
    icon: Star,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 dark:bg-emerald-500/15",
    borderColor: "border-emerald-500/30 dark:border-emerald-500/20",
    textColor: "text-foreground",
    label: "Agricultural Exchange",
    description: "Farming techniques and food security",
    emoji: "🌾",
  },
  heritage: {
    icon: Building,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/10 dark:bg-amber-500/15",
    borderColor: "border-amber-500/30 dark:border-amber-500/20",
    textColor: "text-foreground",
    label: "Heritage Preservation",
    description: "Historical and cultural conservation",
    emoji: "🏺",
  },
  youth: {
    icon: User,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10 dark:bg-blue-500/15",
    borderColor: "border-blue-500/30 dark:border-blue-500/20",
    textColor: "text-foreground",
    label: "Youth Exchange",
    description: "Young leaders and future generations",
    emoji: "👥",
  },
} as const;

// Exchange status configurations
export const STATUS_STYLES = {
  planning: {
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/15 dark:bg-amber-500/20",
    icon: "⏳",
    label: "Planning",
  },
  active: {
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
    icon: "🔴",
    label: "Live",
  },
  completed: {
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-500/15 dark:bg-blue-500/20",
    icon: "✓",
    label: "Completed",
  },
  cancelled: {
    color: "text-muted-foreground",
    bg: "bg-muted",
    icon: "✗",
    label: "Cancelled",
  },
} as const;

// Helper function to get type-specific icon animations (hover only)
export const getIconAnimation = (type: string) => {
  switch (type) {
    case "sports":
      // Soccer ball bounce and spin
      return {
        whileHover: {
          y: [0, -20, 0],
          rotate: [0, 360, 0],
          transition: {
            duration: 0.8,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
      };
    case "music":
      // Musical note wave
      return {
        whileHover: {
          x: [-2, 2, -2],
          rotate: [-5, 5, -5],
          transition: {
            duration: 0.6,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
      };
    case "cuisine":
      // Steam rising effect
      return {
        whileHover: {
          y: [0, -8, 0],
          opacity: [1, 0.7, 1],
          transition: {
            duration: 0.8,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
      };
    case "technology":
      // Glitch effect
      return {
        whileHover: {
          x: [-2, 2, -2, 2, 0],
          opacity: [1, 0.8, 1, 0.8, 1],
          transition: {
            duration: 0.4,
            repeat: Infinity,
            repeatDelay: 0.5,
          },
        },
      };
    case "arts":
      // Paint splash
      return {
        whileHover: {
          scale: [1, 1.2, 1],
          rotate: [-15, 15, -15],
          transition: {
            duration: 0.6,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
      };
    case "film":
      // Clapperboard snap
      return {
        whileHover: {
          rotate: [0, -20, 0],
          scale: [1, 0.9, 1],
          transition: {
            duration: 0.5,
            ease: easeOut,
            repeat: Infinity,
          },
        },
      };
    case "festival":
      // Masks swap
      return {
        whileHover: {
          scaleX: [1, 0.7, 1],
          rotate: [-8, 8, -8],
          transition: {
            duration: 0.7,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
      };
    case "education":
      // Book flip
      return {
        whileHover: {
          rotateY: [0, 180, 360],
          transition: {
            duration: 1,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
        style: {
          transformStyle: "preserve-3d" as const,
        },
      };
    case "diplomacy":
      // Handshake
      return {
        whileHover: {
          x: [-4, 0, -4],
          scale: [1, 0.95, 1],
          transition: {
            duration: 0.6,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
      };
    case "exhibition":
      // Building expand
      return {
        whileHover: {
          scale: [1, 1.15, 1],
          y: [0, -5, 0],
          transition: {
            duration: 0.7,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
      };
    case "environmental":
      // Globe spin
      return {
        whileHover: {
          rotate: [0, 360],
          scale: [1, 1.1, 1],
          transition: {
            duration: 1,
            ease: linearEasing,
            repeat: Infinity,
          },
        },
      };
    case "science":
      // Lightbulb flicker
      return {
        whileHover: {
          scale: [1, 1.15, 1.05, 1.15, 1],
          opacity: [1, 0.8, 1, 0.8, 1],
          transition: {
            duration: 0.5,
            repeat: Infinity,
          },
        },
      };
    default:
      // Default gentle bounce
      return {
        whileHover: {
          scale: [1, 1.1, 1],
          transition: {
            duration: 0.4,
            ease: easeInOut,
            repeat: Infinity,
          },
        },
      };
  }
};
