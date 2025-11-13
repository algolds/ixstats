// src/lib/sound-service.ts
// Comprehensive sound system with volume controls and settings persistence

import type { CardRarity } from "@prisma/client";

/**
 * Sound effect identifiers
 */
export type SoundEffect =
  | "pack-open"
  | "card-flip"
  | "card-hover"
  | "card-select"
  | "common-reveal"
  | "rare-reveal"
  | "epic-reveal"
  | "legendary-reveal"
  | "auction-bid"
  | "craft-success"
  | "craft-fail"
  | "trade-complete";

/**
 * Sound settings stored in localStorage
 */
export interface SoundSettings {
  masterVolume: number; // 0-1
  sfxVolume: number; // 0-1
  musicVolume: number; // 0-1
  enabled: boolean;
  mutedSounds: Set<SoundEffect>;
}

/**
 * Sound file mapping
 */
const SOUND_PATHS: Record<SoundEffect, string> = {
  "pack-open": "/sounds/cards/pack-open.mp3",
  "card-flip": "/sounds/cards/card-flip.mp3",
  "card-hover": "/sounds/cards/card-hover.mp3",
  "card-select": "/sounds/cards/card-select.mp3",
  "common-reveal": "/sounds/cards/common-reveal.mp3",
  "rare-reveal": "/sounds/cards/rare-reveal.mp3",
  "epic-reveal": "/sounds/cards/epic-reveal.mp3",
  "legendary-reveal": "/sounds/cards/legendary-reveal.mp3",
  "auction-bid": "/sounds/cards/auction-bid.mp3",
  "craft-success": "/sounds/cards/craft-success.mp3",
  "craft-fail": "/sounds/cards/craft-fail.mp3",
  "trade-complete": "/sounds/cards/trade-complete.mp3",
};

/**
 * Rarity to sound mapping
 */
const RARITY_SOUND_MAP: Record<CardRarity, SoundEffect> = {
  COMMON: "common-reveal",
  UNCOMMON: "common-reveal",
  RARE: "rare-reveal",
  ULTRA_RARE: "rare-reveal",
  EPIC: "epic-reveal",
  LEGENDARY: "legendary-reveal",
};

/**
 * Default sound settings
 */
const DEFAULT_SETTINGS: SoundSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.5,
  enabled: true,
  mutedSounds: new Set(),
};

/**
 * Comprehensive sound service with volume controls and settings
 */
export class SoundService {
  private audioContext: Map<string, HTMLAudioElement> = new Map();
  private settings: SoundSettings;
  private initialized = false;

  constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): SoundSettings {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;

    try {
      const stored = localStorage.getItem("ixcards-sound-settings");
      if (!stored) return DEFAULT_SETTINGS;

      const parsed = JSON.parse(stored) as Record<string, unknown>;
      return {
        masterVolume: Number(parsed.masterVolume) || DEFAULT_SETTINGS.masterVolume,
        sfxVolume: Number(parsed.sfxVolume) || DEFAULT_SETTINGS.sfxVolume,
        musicVolume: Number(parsed.musicVolume) || DEFAULT_SETTINGS.musicVolume,
        enabled: Boolean(parsed.enabled ?? DEFAULT_SETTINGS.enabled),
        mutedSounds: new Set(
          Array.isArray(parsed.mutedSounds) ? parsed.mutedSounds : []
        ),
      };
    } catch (error) {
      console.warn("[SoundService] Failed to load settings:", error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    if (typeof window === "undefined") return;

    try {
      const serialized = {
        masterVolume: this.settings.masterVolume,
        sfxVolume: this.settings.sfxVolume,
        musicVolume: this.settings.musicVolume,
        enabled: this.settings.enabled,
        mutedSounds: Array.from(this.settings.mutedSounds),
      };
      localStorage.setItem("ixcards-sound-settings", JSON.stringify(serialized));
    } catch (error) {
      console.warn("[SoundService] Failed to save settings:", error);
    }
  }

  /**
   * Initialize and preload sound files
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (typeof window === "undefined") return;

    try {
      // Preload all sound files
      const preloadPromises = Object.entries(SOUND_PATHS).map(
        async ([key, path]) => {
          try {
            const audio = new Audio(path);
            audio.preload = "auto";
            audio.volume = 0; // Silent preload

            // Wait for audio to be loadable
            await new Promise<void>((resolve, reject) => {
              audio.addEventListener("canplaythrough", () => resolve(), {
                once: true,
              });
              audio.addEventListener("error", (e) => reject(e), { once: true });

              // Timeout after 5 seconds
              setTimeout(() => resolve(), 5000);
            });

            this.audioContext.set(key, audio);
          } catch (error) {
            console.warn(`[SoundService] Failed to preload ${key}:`, error);
          }
        }
      );

      await Promise.allSettled(preloadPromises);
      this.initialized = true;
      console.log(
        `[SoundService] Initialized with ${this.audioContext.size}/${Object.keys(SOUND_PATHS).length} sounds`
      );
    } catch (error) {
      console.warn("[SoundService] Initialization failed:", error);
    }
  }

  /**
   * Play a sound effect
   */
  play(sound: SoundEffect, volumeOverride?: number): void {
    if (!this.settings.enabled) return;
    if (this.settings.mutedSounds.has(sound)) return;

    try {
      let audio = this.audioContext.get(sound);

      // Create audio on-demand if not preloaded
      if (!audio) {
        audio = new Audio(SOUND_PATHS[sound]);
        this.audioContext.set(sound, audio);
      }

      // Calculate final volume
      const baseVolume = volumeOverride ?? this.settings.sfxVolume;
      const finalVolume = baseVolume * this.settings.masterVolume;

      // Reset and play
      audio.currentTime = 0;
      audio.volume = Math.max(0, Math.min(1, finalVolume));

      audio.play().catch((err) => {
        console.warn(`[SoundService] Failed to play ${sound}:`, err);
      });
    } catch (error) {
      console.warn(`[SoundService] Error playing ${sound}:`, error);
    }
  }

  /**
   * Play rarity-specific reveal sound
   */
  playRarityReveal(rarity: CardRarity): void {
    const sound = RARITY_SOUND_MAP[rarity];
    if (sound) {
      this.play(sound);
    }
  }

  /**
   * Play preview of a sound (for settings UI)
   */
  preview(sound: SoundEffect): void {
    // Temporarily ignore mute for preview
    const wasMuted = this.settings.mutedSounds.has(sound);
    if (wasMuted) {
      this.settings.mutedSounds.delete(sound);
    }

    this.play(sound);

    if (wasMuted) {
      this.settings.mutedSounds.add(sound);
    }
  }

  /**
   * Update master volume
   */
  setMasterVolume(volume: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * Update SFX volume
   */
  setSfxVolume(volume: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * Update music volume
   */
  setMusicVolume(volume: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * Enable/disable all sounds
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.saveSettings();
  }

  /**
   * Mute/unmute specific sound
   */
  toggleSoundMute(sound: SoundEffect): void {
    if (this.settings.mutedSounds.has(sound)) {
      this.settings.mutedSounds.delete(sound);
    } else {
      this.settings.mutedSounds.add(sound);
    }
    this.saveSettings();
  }

  /**
   * Get current settings
   */
  getSettings(): SoundSettings {
    return { ...this.settings };
  }

  /**
   * Reset to default settings
   */
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS };
    this.saveSettings();
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
    this.initialized = false;
  }
}

/**
 * Singleton instance for reuse across app
 */
let serviceInstance: SoundService | null = null;

export function getSoundService(): SoundService {
  if (!serviceInstance) {
    serviceInstance = new SoundService();

    // Initialize on first access (client-side only)
    if (typeof window !== "undefined") {
      serviceInstance.initialize().catch(console.warn);
    }
  }
  return serviceInstance;
}

/**
 * Hook for React components to access sound service
 */
export function useSoundService() {
  if (typeof window === "undefined") {
    return null;
  }
  return getSoundService();
}
