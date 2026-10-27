/**
 * Holographic Effects Utility Library
 * Foil gradients, foil stamps and embossed text for the pack cover (PackHolographicCover).
 */

import type { CardRarity } from "@prisma/client";

/**
 * Generate CSS gradient for rainbow holographic effect
 */
export function getRainbowHolographicGradient(angle: number = 45): string {
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
 * Generate Pokemon-style sparkle grid pattern
 */
export function getSparkleGridGradient(): string {
  return `
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.3) 2px,
      rgba(255, 255, 255, 0.3) 4px
    ),
    repeating-linear-gradient(
      90deg,
      transparent,
      transparent 2px,
      rgba(255, 255, 255, 0.3) 2px,
      rgba(255, 255, 255, 0.3) 4px
    ),
    linear-gradient(
      135deg,
      rgba(255, 0, 255, 0.2) 0%,
      rgba(0, 255, 255, 0.2) 25%,
      rgba(255, 255, 0, 0.2) 50%,
      rgba(0, 255, 255, 0.2) 75%,
      rgba(255, 0, 255, 0.2) 100%
    )
  `;
}

/**
 * Generate Pokemon-style prismatic wave pattern
 */
export function getPrismaticWaveGradient(): string {
  return `
    linear-gradient(
      45deg,
      rgba(255, 0, 0, 0.3) 0%,
      rgba(255, 127, 0, 0.3) 10%,
      rgba(255, 255, 0, 0.3) 20%,
      rgba(0, 255, 0, 0.3) 30%,
      rgba(0, 255, 255, 0.3) 40%,
      rgba(0, 0, 255, 0.3) 50%,
      rgba(127, 0, 255, 0.3) 60%,
      rgba(255, 0, 255, 0.3) 70%,
      rgba(255, 0, 127, 0.3) 80%,
      rgba(255, 0, 0, 0.3) 90%,
      rgba(255, 127, 0, 0.3) 100%
    )
  `;
}

/**
 * Generate Pokemon-style holofoil texture pattern
 */
export function getHolofoilTextureGradient(): string {
  return `
    linear-gradient(
      125deg,
      transparent 0%,
      rgba(255, 255, 255, 0.4) 40%,
      transparent 50%,
      rgba(255, 255, 255, 0.4) 90%,
      transparent 100%
    ),
    linear-gradient(
      55deg,
      transparent 0%,
      rgba(255, 200, 255, 0.3) 40%,
      transparent 50%,
      rgba(200, 255, 255, 0.3) 90%,
      transparent 100%
    )
  `;
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
