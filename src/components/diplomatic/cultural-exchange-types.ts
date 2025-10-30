import { easeInOut, easeOut } from "framer-motion";
import type { IconType } from "react-icons";
import {
  RiGlobalLine,
  RiStarLine,
  RiBookLine,
  RiPaletteLine,
  RiBuildingLine,
  RiCameraLine,
  RiMusicLine,
  RiGamepadLine,
  RiRestaurantLine,
  RiUserLine,
  RiTrophyLine,
  RiFlashlightLine,
  RiLightbulbLine,
  RiArrowRightLine,
  RiThumbUpLine,
} from "react-icons/ri";

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
  icon: IconType;
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
    icon: RiStarLine,
    color: "text-purple-600 dark:text-purple-400",
    bgColor:
      "bg-gradient-to-br from-purple-400/40 to-pink-500/40 dark:from-purple-500/20 dark:to-pink-500/20",
    borderColor: "border-purple-500/60 dark:border-purple-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Cultural Festival",
    description: "Celebration of traditions and customs",
    emoji: "🎭",
  },
  exhibition: {
    icon: RiBuildingLine,
    color: "text-blue-600 dark:text-blue-400",
    bgColor:
      "bg-gradient-to-br from-blue-400/40 to-indigo-500/40 dark:from-blue-500/20 dark:to-indigo-500/20",
    borderColor: "border-blue-500/60 dark:border-blue-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Cultural Exhibition",
    description: "Showcase of cultural heritage and artifacts",
    emoji: "🏛️",
  },
  education: {
    icon: RiBookLine,
    color: "text-green-600 dark:text-green-400",
    bgColor:
      "bg-gradient-to-br from-green-400/40 to-emerald-500/40 dark:from-green-500/20 dark:to-emerald-500/20",
    borderColor: "border-green-500/60 dark:border-green-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Educational Exchange",
    description: "Knowledge sharing and academic collaboration",
    emoji: "📚",
  },
  cuisine: {
    icon: RiRestaurantLine,
    color: "text-orange-600 dark:text-orange-400",
    bgColor:
      "bg-gradient-to-br from-orange-400/40 to-red-500/40 dark:from-orange-500/20 dark:to-red-500/20",
    borderColor: "border-orange-500/60 dark:border-orange-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Culinary Exchange",
    description: "Food culture and culinary traditions",
    emoji: "🍜",
  },
  arts: {
    icon: RiPaletteLine,
    color: "text-pink-600 dark:text-pink-400",
    bgColor:
      "bg-gradient-to-br from-pink-400/40 to-rose-500/40 dark:from-pink-500/20 dark:to-rose-500/20",
    borderColor: "border-pink-500/60 dark:border-pink-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Arts Exchange",
    description: "Visual arts and creative expression",
    emoji: "🎨",
  },
  sports: {
    icon: RiTrophyLine,
    color: "text-red-600 dark:text-red-400",
    bgColor:
      "bg-gradient-to-br from-red-400/40 to-orange-500/40 dark:from-red-500/20 dark:to-orange-500/20",
    borderColor: "border-red-500/60 dark:border-red-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Sports Exchange",
    description: "Athletic competition and physical culture",
    emoji: "⚽",
  },
  technology: {
    icon: RiGamepadLine,
    color: "text-cyan-600 dark:text-cyan-400",
    bgColor:
      "bg-gradient-to-br from-cyan-400/40 to-blue-500/40 dark:from-cyan-500/20 dark:to-blue-500/20",
    borderColor: "border-cyan-500/60 dark:border-cyan-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Tech Exchange",
    description: "Innovation and technological collaboration",
    emoji: "💻",
  },
  diplomacy: {
    icon: RiGlobalLine,
    color: "text-amber-600 dark:text-[--intel-gold]",
    bgColor:
      "bg-gradient-to-br from-amber-400/40 to-yellow-500/40 dark:from-[--intel-gold]/20 dark:to-yellow-500/20",
    borderColor: "border-amber-500/60 dark:border-[--intel-gold]/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Diplomatic Summit",
    description: "High-level diplomatic and cultural dialogue",
    emoji: "🤝",
  },
  music: {
    icon: RiMusicLine,
    color: "text-violet-600 dark:text-violet-400",
    bgColor:
      "bg-gradient-to-br from-violet-400/40 to-purple-500/40 dark:from-violet-500/20 dark:to-purple-500/20",
    borderColor: "border-violet-500/60 dark:border-violet-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Music Exchange",
    description: "Musical performances and cultural harmony",
    emoji: "🎵",
  },
  film: {
    icon: RiCameraLine,
    color: "text-indigo-600 dark:text-indigo-400",
    bgColor:
      "bg-gradient-to-br from-indigo-400/40 to-purple-500/40 dark:from-indigo-500/20 dark:to-purple-500/20",
    borderColor: "border-indigo-500/60 dark:border-indigo-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Film Festival",
    description: "Cinema and visual storytelling",
    emoji: "🎬",
  },
  environmental: {
    icon: RiFlashlightLine,
    color: "text-teal-600 dark:text-teal-400",
    bgColor:
      "bg-gradient-to-br from-teal-400/40 to-green-500/40 dark:from-teal-500/20 dark:to-green-500/20",
    borderColor: "border-teal-500/60 dark:border-teal-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Environmental Initiative",
    description: "Sustainability and ecological cooperation",
    emoji: "🌍",
  },
  science: {
    icon: RiLightbulbLine,
    color: "text-sky-600 dark:text-sky-400",
    bgColor:
      "bg-gradient-to-br from-sky-400/40 to-blue-500/40 dark:from-sky-500/20 dark:to-blue-500/20",
    borderColor: "border-sky-500/60 dark:border-sky-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Scientific Collaboration",
    description: "Research and scientific discovery",
    emoji: "🔬",
  },
  trade: {
    icon: RiArrowRightLine,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor:
      "bg-gradient-to-br from-emerald-400/40 to-teal-500/40 dark:from-emerald-500/20 dark:to-teal-500/20",
    borderColor: "border-emerald-500/60 dark:border-emerald-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Trade Partnership",
    description: "Economic and commercial cooperation",
    emoji: "💼",
  },
  humanitarian: {
    icon: RiThumbUpLine,
    color: "text-rose-600 dark:text-rose-400",
    bgColor:
      "bg-gradient-to-br from-rose-400/40 to-pink-500/40 dark:from-rose-500/20 dark:to-pink-500/20",
    borderColor: "border-rose-500/60 dark:border-rose-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Humanitarian Aid",
    description: "Relief and assistance programs",
    emoji: "❤️",
  },
  agriculture: {
    icon: RiStarLine,
    color: "text-lime-600 dark:text-lime-400",
    bgColor:
      "bg-gradient-to-br from-lime-400/40 to-green-500/40 dark:from-lime-500/20 dark:to-green-500/20",
    borderColor: "border-lime-500/60 dark:border-lime-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Agricultural Exchange",
    description: "Farming techniques and food security",
    emoji: "🌾",
  },
  heritage: {
    icon: RiBuildingLine,
    color: "text-stone-600 dark:text-stone-400",
    bgColor:
      "bg-gradient-to-br from-stone-400/40 to-amber-500/40 dark:from-stone-500/20 dark:to-amber-500/20",
    borderColor: "border-stone-500/60 dark:border-stone-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Heritage Preservation",
    description: "Historical and cultural conservation",
    emoji: "🏺",
  },
  youth: {
    icon: RiUserLine,
    color: "text-fuchsia-600 dark:text-fuchsia-400",
    bgColor:
      "bg-gradient-to-br from-fuchsia-400/40 to-pink-500/40 dark:from-fuchsia-500/20 dark:to-pink-500/20",
    borderColor: "border-fuchsia-500/60 dark:border-fuchsia-500/40",
    textColor: "text-gray-900 dark:text-white",
    label: "Youth Exchange",
    description: "Young leaders and future generations",
    emoji: "👥",
  },
} as const;

// Exchange status configurations
export const STATUS_STYLES = {
  planning: {
    color: "text-yellow-900 dark:text-yellow-300",
    bg: "bg-yellow-200/90 dark:bg-yellow-900/80",
    icon: "⏳",
    label: "Planning",
  },
  active: {
    color: "text-green-900 dark:text-green-300",
    bg: "bg-green-200/90 dark:bg-green-900/80",
    icon: "🔴",
    label: "Live",
  },
  completed: {
    color: "text-blue-900 dark:text-blue-300",
    bg: "bg-blue-200/90 dark:bg-blue-900/80",
    icon: "✓",
    label: "Completed",
  },
  cancelled: {
    color: "text-gray-900 dark:text-gray-300",
    bg: "bg-gray-200/90 dark:bg-gray-900/80",
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
