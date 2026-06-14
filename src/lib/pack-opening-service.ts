// src/lib/pack-opening-service.ts
// Pack opening service with animation helpers

import type { CardRarity } from "@prisma/client";
import type { Particle, HapticPattern } from "~/types/pack-opening";

/**
 * Rarity color mapping for particles and effects
 */
const RARITY_COLORS: Record<CardRarity, string> = {
  COMMON: "#9ca3af", // gray-400
  UNCOMMON: "#3b82f6", // blue-500
  RARE: "#8b5cf6", // violet-500
  ULTRA_RARE: "#ec4899", // pink-500
  EPIC: "#f59e0b", // amber-500
  LEGENDARY: "#eab308", // yellow-500
};

/**
 * Sound file paths for different rarities
 */
// eslint-disable-next-line unused-imports/no-unused-vars
const RARITY_SOUNDS: Record<CardRarity, string> = {
  COMMON: "/sounds/common-reveal.mp3",
  UNCOMMON: "/sounds/common-reveal.mp3",
  RARE: "/sounds/rare-reveal.mp3",
  ULTRA_RARE: "/sounds/rare-reveal.mp3",
  EPIC: "/sounds/legendary-reveal.mp3",
  LEGENDARY: "/sounds/legendary-reveal.mp3",
};

/**
 * Haptic vibration patterns (in milliseconds)
 */
const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 50,
  medium: [100, 50, 100],
  heavy: [200, 100, 200, 100, 200],
};

/**
 * Pack Opening Service
 * Coordinates animations, sounds, and haptic feedback
 */
export class PackOpeningService {
  private audioContext: Map<string, HTMLAudioElement> = new Map();

  /**
   * Preload sound files for smoother playback (silenced)
   */
  preloadSounds(): void {
    // Silenced for compliance with no-audio constraints
  }

  /**
   * Play rarity-specific sound effect (silenced)
   */
  // eslint-disable-next-line unused-imports/no-unused-vars
  playRaritySound(rarity: CardRarity): void {
    // Silenced for compliance with no-audio constraints
  }

  /**
   * Play pack opening sound (silenced)
   */
  playPackOpenSound(): void {
    // Silenced for compliance with no-audio constraints
  }

  /**
   * Trigger haptic feedback (mobile only)
   */
  triggerHaptic(pattern: HapticPattern): void {
    try {
      if (typeof window === "undefined") return;
      if (!("vibrate" in navigator)) return;

      const vibrationPattern = HAPTIC_PATTERNS[pattern];
      navigator.vibrate(vibrationPattern);
      // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
      // Silently fail - haptic is optional
    }
  }

  /**
   * Generate particle data for explosion effect
   */
  generateParticles(count: number): Particle[] {
    const particles: Particle[] = [];
    const centerX = 50; // percentage
    const centerY = 50; // percentage

    for (let i = 0; i < count; i++) {
      // Random angle and velocity
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const velocity = 3 + Math.random() * 5;

      // Random color from rarity palette
      const colors = Object.values(RARITY_COLORS);
      const color = colors[Math.floor(Math.random() * colors.length)]!;

      particles.push({
        id: `particle-${i}`,
        x: centerX,
        y: centerY,
        velocityX: Math.cos(angle) * velocity,
        velocityY: Math.sin(angle) * velocity,
        color,
        size: 4 + Math.random() * 8,
      });
    }

    return particles;
  }

  /**
   * Get color for rarity
   */
  getRarityColor(rarity: CardRarity): string {
    return RARITY_COLORS[rarity] ?? RARITY_COLORS.COMMON;
  }

  /**
   * Cleanup audio resources
   */
  cleanup(): void {
    this.audioContext.forEach((audio) => {
      audio.pause();
      audio.src = "";
    });
    this.audioContext.clear();
  }
}

/**
 * Singleton instance for reuse
 */
let serviceInstance: PackOpeningService | null = null;

export function getPackOpeningService(): PackOpeningService {
  if (!serviceInstance) {
    serviceInstance = new PackOpeningService();
    // Preload sounds on first access
    if (typeof window !== "undefined") {
      serviceInstance.preloadSounds();
    }
  }
  return serviceInstance;
}

/**
 * Helper to detect mobile device for particle optimization
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < 768;
}

/**
 * Helper to get optimal particle count for device
 */
export function getOptimalParticleCount(): number {
  return isMobileDevice() ? 25 : 50;
}
