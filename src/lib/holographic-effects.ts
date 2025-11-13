/**
 * Holographic Effects Utility Library
 * Provides premium holographic, foil, and metallic effects for IxCards
 * Implements Yu-Gi-Oh style digital card treatment with glass physics
 */

import type { CardRarity } from "@prisma/client";

/**
 * Holographic pattern types
 */
export type HolographicPattern =
  | "rainbow-shimmer" // Classic rainbow holographic
  | "radial-burst" // Radial light burst from center
  | "diagonal-sweep" // Diagonal sweeping light
  | "cross-hatch" // Cross-hatched metallic pattern
  | "cosmic" // Cosmic/space holographic for legendary
  | "liquid-glass"; // IxStats signature liquid glass effect

/**
 * Holographic intensity levels
 */
export type HolographicIntensity = "subtle" | "medium" | "intense" | "legendary";

/**
 * Get holographic pattern based on card rarity
 */
export function getHolographicPattern(rarity: CardRarity): HolographicPattern {
  const patterns: Record<CardRarity, HolographicPattern> = {
    COMMON: "diagonal-sweep",
    UNCOMMON: "diagonal-sweep",
    RARE: "rainbow-shimmer",
    ULTRA_RARE: "radial-burst",
    EPIC: "radial-burst",
    LEGENDARY: "cosmic",
  };

  return patterns[rarity] || "diagonal-sweep";
}

/**
 * Get holographic intensity based on card rarity
 */
export function getHolographicIntensity(rarity: CardRarity): HolographicIntensity {
  const intensities: Record<CardRarity, HolographicIntensity> = {
    COMMON: "subtle",
    UNCOMMON: "subtle",
    RARE: "medium",
    ULTRA_RARE: "medium",
    EPIC: "intense",
    LEGENDARY: "legendary",
  };

  return intensities[rarity] || "subtle";
}

/**
 * Generate CSS gradient for rainbow holographic effect
 */
export function getRainbowHolographicGradient(
  angle: number = 45,
  animated: boolean = true
): string {
  const gradient = `linear-gradient(
    ${angle}deg,
    rgba(255, 0, 0, 0.3) 0%,
    rgba(255, 127, 0, 0.3) 14%,
    rgba(255, 255, 0, 0.3) 28%,
    rgba(0, 255, 0, 0.3) 42%,
    rgba(0, 0, 255, 0.3) 57%,
    rgba(75, 0, 130, 0.3) 71%,
    rgba(148, 0, 211, 0.3) 85%,
    rgba(255, 0, 0, 0.3) 100%
  )`;

  return gradient;
}

/**
 * Generate CSS gradient for metallic foil effect
 */
export function getMetallicGradient(baseColor: string = "gold"): string {
  const colorStops: Record<string, string> = {
    gold: `linear-gradient(
      135deg,
      rgba(255, 215, 0, 0.2) 0%,
      rgba(255, 235, 120, 0.4) 25%,
      rgba(255, 215, 0, 0.6) 50%,
      rgba(218, 165, 32, 0.4) 75%,
      rgba(255, 215, 0, 0.2) 100%
    )`,
    silver: `linear-gradient(
      135deg,
      rgba(192, 192, 192, 0.2) 0%,
      rgba(220, 220, 220, 0.4) 25%,
      rgba(245, 245, 245, 0.6) 50%,
      rgba(192, 192, 192, 0.4) 75%,
      rgba(169, 169, 169, 0.2) 100%
    )`,
    purple: `linear-gradient(
      135deg,
      rgba(147, 51, 234, 0.2) 0%,
      rgba(168, 85, 247, 0.4) 25%,
      rgba(192, 132, 252, 0.6) 50%,
      rgba(168, 85, 247, 0.4) 75%,
      rgba(147, 51, 234, 0.2) 100%
    )`,
    blue: `linear-gradient(
      135deg,
      rgba(59, 130, 246, 0.2) 0%,
      rgba(96, 165, 250, 0.4) 25%,
      rgba(147, 197, 253, 0.6) 50%,
      rgba(96, 165, 250, 0.4) 75%,
      rgba(59, 130, 246, 0.2) 100%
    )`,
  };

  return colorStops[baseColor] || colorStops.gold;
}

/**
 * Get rarity-specific holographic CSS classes
 */
export function getHolographicClasses(rarity: CardRarity): string {
  const pattern = getHolographicPattern(rarity);
  const intensity = getHolographicIntensity(rarity);

  const baseClasses = [
    "absolute",
    "inset-0",
    "pointer-events-none",
    "mix-blend-overlay",
  ];

  const patternClasses: Record<HolographicPattern, string[]> = {
    "rainbow-shimmer": ["bg-gradient-to-br", "animate-holographic-shimmer"],
    "radial-burst": ["bg-radial", "animate-radial-pulse"],
    "diagonal-sweep": ["bg-gradient-to-br", "animate-diagonal-sweep"],
    "cross-hatch": ["bg-cross-hatch", "animate-cross-fade"],
    cosmic: ["bg-cosmic", "animate-cosmic-drift"],
    "liquid-glass": ["bg-liquid-glass", "animate-liquid-flow"],
  };

  const intensityClasses: Record<HolographicIntensity, string> = {
    subtle: "opacity-20",
    medium: "opacity-40",
    intense: "opacity-60",
    legendary: "opacity-80",
  };

  return [
    ...baseClasses,
    ...(patternClasses[pattern] || []),
    intensityClasses[intensity],
  ].join(" ");
}

/**
 * Generate light ray positions for animated rays
 */
export function generateLightRays(count: number = 8): Array<{
  angle: number;
  length: number;
  delay: number;
}> {
  const rays: Array<{ angle: number; length: number; delay: number }> = [];
  const angleStep = 360 / count;

  for (let i = 0; i < count; i++) {
    rays.push({
      angle: angleStep * i,
      length: 80 + Math.random() * 40, // 80-120% length variation
      delay: i * 0.1, // Staggered animation
    });
  }

  return rays;
}

/**
 * Get foil stamp effect configuration
 */
export function getFoilStampConfig(rarity: CardRarity): {
  enabled: boolean;
  color: string;
  position: "top-right" | "bottom-right" | "center";
  symbol: string;
} {
  const configs: Record<
    CardRarity,
    {
      enabled: boolean;
      color: string;
      position: "top-right" | "bottom-right" | "center";
      symbol: string;
    }
  > = {
    COMMON: {
      enabled: false,
      color: "",
      position: "bottom-right",
      symbol: "",
    },
    UNCOMMON: {
      enabled: false,
      color: "",
      position: "bottom-right",
      symbol: "",
    },
    RARE: {
      enabled: true,
      color: "from-blue-400 to-purple-400",
      position: "bottom-right",
      symbol: "◆",
    },
    ULTRA_RARE: {
      enabled: true,
      color: "from-purple-400 to-pink-400",
      position: "bottom-right",
      symbol: "★",
    },
    EPIC: {
      enabled: true,
      color: "from-orange-400 to-red-400",
      position: "bottom-right",
      symbol: "✦",
    },
    LEGENDARY: {
      enabled: true,
      color: "from-yellow-400 via-orange-400 to-red-400",
      position: "center",
      symbol: "✧",
    },
  };

  return configs[rarity] || configs.COMMON;
}

/**
 * Get embossed text shadow for premium text effect
 */
export function getEmbossedTextShadow(color: string = "gold"): string {
  const shadows: Record<string, string> = {
    gold: "0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(255,215,0,0.4), 0 3px 0 rgba(0,0,0,0.6), 0 0 20px rgba(255,215,0,0.6)",
    silver:
      "0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(192,192,192,0.4), 0 3px 0 rgba(0,0,0,0.6), 0 0 20px rgba(192,192,192,0.6)",
    purple:
      "0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(147,51,234,0.4), 0 3px 0 rgba(0,0,0,0.6), 0 0 20px rgba(147,51,234,0.6)",
    blue: "0 1px 0 rgba(0,0,0,0.8), 0 2px 0 rgba(59,130,246,0.4), 0 3px 0 rgba(0,0,0,0.6), 0 0 20px rgba(59,130,246,0.6)",
  };

  return shadows[color] || shadows.gold;
}

/**
 * Get premium border configuration for rarity
 */
export function getPremiumBorderConfig(rarity: CardRarity): {
  width: number;
  gradient: string;
  glow: string;
  animated: boolean;
} {
  const configs: Record<
    CardRarity,
    {
      width: number;
      gradient: string;
      glow: string;
      animated: boolean;
    }
  > = {
    COMMON: {
      width: 2,
      gradient: "from-gray-400 to-gray-600",
      glow: "shadow-none",
      animated: false,
    },
    UNCOMMON: {
      width: 2,
      gradient: "from-green-400 to-green-600",
      glow: "shadow-sm shadow-green-400/20",
      animated: false,
    },
    RARE: {
      width: 3,
      gradient: "from-blue-400 via-purple-400 to-blue-400",
      glow: "shadow-lg shadow-purple-400/40",
      animated: true,
    },
    ULTRA_RARE: {
      width: 3,
      gradient: "from-purple-400 via-pink-400 to-purple-400",
      glow: "shadow-xl shadow-pink-400/50",
      animated: true,
    },
    EPIC: {
      width: 4,
      gradient: "from-orange-400 via-red-400 to-orange-400",
      glow: "shadow-2xl shadow-orange-400/60",
      animated: true,
    },
    LEGENDARY: {
      width: 4,
      gradient: "from-yellow-400 via-orange-400 via-red-400 to-yellow-400",
      glow: "shadow-2xl shadow-yellow-400/80",
      animated: true,
    },
  };

  return configs[rarity] || configs.COMMON;
}

/**
 * Get particle configuration for rarity-specific effects
 */
export function getParticleConfig(rarity: CardRarity): {
  count: number;
  colors: string[];
  size: { min: number; max: number };
  speed: { min: number; max: number };
  lifetime: number;
} {
  const configs: Record<
    CardRarity,
    {
      count: number;
      colors: string[];
      size: { min: number; max: number };
      speed: { min: number; max: number };
      lifetime: number;
    }
  > = {
    COMMON: {
      count: 0,
      colors: [],
      size: { min: 1, max: 2 },
      speed: { min: 0.5, max: 1 },
      lifetime: 1000,
    },
    UNCOMMON: {
      count: 5,
      colors: ["#10b981", "#34d399"],
      size: { min: 1, max: 3 },
      speed: { min: 0.5, max: 1.5 },
      lifetime: 1500,
    },
    RARE: {
      count: 10,
      colors: ["#3b82f6", "#8b5cf6", "#a855f7"],
      size: { min: 2, max: 4 },
      speed: { min: 1, max: 2 },
      lifetime: 2000,
    },
    ULTRA_RARE: {
      count: 15,
      colors: ["#8b5cf6", "#ec4899", "#f472b6"],
      size: { min: 2, max: 5 },
      speed: { min: 1, max: 2.5 },
      lifetime: 2500,
    },
    EPIC: {
      count: 20,
      colors: ["#f97316", "#ef4444", "#dc2626"],
      size: { min: 3, max: 6 },
      speed: { min: 1.5, max: 3 },
      lifetime: 3000,
    },
    LEGENDARY: {
      count: 30,
      colors: ["#fbbf24", "#f97316", "#ef4444", "#eab308"],
      size: { min: 4, max: 8 },
      speed: { min: 2, max: 4 },
      lifetime: 4000,
    },
  };

  return configs[rarity] || configs.COMMON;
}

/**
 * Get CSS animation keyframe name for rarity
 */
export function getHolographicAnimation(rarity: CardRarity): string {
  const animations: Record<CardRarity, string> = {
    COMMON: "",
    UNCOMMON: "shimmer-subtle 3s ease-in-out infinite",
    RARE: "shimmer-medium 2.5s ease-in-out infinite",
    ULTRA_RARE: "shimmer-intense 2s ease-in-out infinite",
    EPIC: "shimmer-epic 1.5s ease-in-out infinite",
    LEGENDARY: "shimmer-legendary 1s ease-in-out infinite",
  };

  return animations[rarity] || "";
}

/**
 * Generate holographic shimmer keyframes (for CSS-in-JS)
 */
export function generateShimmerKeyframes(): string {
  return `
    @keyframes holographic-shimmer {
      0%, 100% {
        background-position: 0% 50%;
        opacity: 0.3;
      }
      50% {
        background-position: 100% 50%;
        opacity: 0.6;
      }
    }

    @keyframes radial-pulse {
      0%, 100% {
        transform: scale(1);
        opacity: 0.4;
      }
      50% {
        transform: scale(1.1);
        opacity: 0.7;
      }
    }

    @keyframes diagonal-sweep {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    @keyframes cosmic-drift {
      0% {
        background-position: 0% 0%;
      }
      50% {
        background-position: 100% 100%;
      }
      100% {
        background-position: 0% 0%;
      }
    }

    @keyframes liquid-flow {
      0%, 100% {
        background-position: 0% 50%;
        filter: hue-rotate(0deg);
      }
      50% {
        background-position: 100% 50%;
        filter: hue-rotate(45deg);
      }
    }

    @keyframes shimmer-subtle {
      0%, 100% { opacity: 0.2; }
      50% { opacity: 0.3; }
    }

    @keyframes shimmer-medium {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.5; }
    }

    @keyframes shimmer-intense {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.7; }
    }

    @keyframes shimmer-epic {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 0.8; }
    }

    @keyframes shimmer-legendary {
      0%, 100% {
        opacity: 0.6;
        transform: scale(1);
      }
      50% {
        opacity: 0.9;
        transform: scale(1.02);
      }
    }

    @keyframes shimmer-mythic {
      0%, 100% {
        opacity: 0.7;
        transform: scale(1) rotate(0deg);
        filter: hue-rotate(0deg);
      }
      50% {
        opacity: 1;
        transform: scale(1.05) rotate(1deg);
        filter: hue-rotate(30deg);
      }
    }
  `;
}

/**
 * Get light refraction effect (for glass physics integration)
 */
export function getLightRefractionStyle(
  mouseX: number,
  mouseY: number,
  elementWidth: number,
  elementHeight: number
): {
  transform: string;
  filter: string;
} {
  // Calculate light source position relative to card center
  const centerX = elementWidth / 2;
  const centerY = elementHeight / 2;
  const deltaX = mouseX - centerX;
  const deltaY = mouseY - centerY;

  // Calculate angle and intensity
  const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
  const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  const maxDistance = Math.sqrt(centerX * centerX + centerY * centerY);
  const intensity = 1 - Math.min(distance / maxDistance, 1);

  return {
    transform: `perspective(1000px) rotateY(${(deltaX / centerX) * 5}deg) rotateX(${-(deltaY / centerY) * 5}deg)`,
    filter: `brightness(${1 + intensity * 0.2}) contrast(${1 + intensity * 0.1})`,
  };
}
