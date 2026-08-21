/**
 * Centralized Cuelume Sound Engine for IxStates
 *
 * Provides synthesized Web Audio interaction sounds with Apple Design & Emil Kowalski
 * interaction principles (causality, harmony, utility, restraint).
 *
 * 17 Sound Palette:
 * - press, release, toggle, tick, chime, whisper, bloom, droplet,
 *   page, scan, loading, ready, arrival, pulse, sparkle, success, error.
 */

import {
  play as cuelumePlay,
  bind as cuelumeBind,
  setEnabled as cuelumeSetEnabled,
  setVolume as cuelumeSetVolume,
  sounds as cuelumeSounds,
  type SoundName,
} from "cuelume";

export { sounds, type SoundName } from "cuelume";

export const SOUND_STORAGE_KEYS = {
  ENABLED: "ixstates:sound-enabled",
  VOLUME: "ixstates:sound-volume",
} as const;

export const DEFAULT_SOUND_SETTINGS = {
  enabled: true,
  volume: 0.25,
} as const;

let isSoundInitialized = false;

/**
 * Reads the persisted sound settings from localStorage (safe for SSR).
 */
export function getStoredSoundSettings(): { enabled: boolean; volume: number } {
  if (typeof window === "undefined") {
    return {
      enabled: DEFAULT_SOUND_SETTINGS.enabled,
      volume: DEFAULT_SOUND_SETTINGS.volume,
    };
  }

  try {
    const storedEnabled = localStorage.getItem(SOUND_STORAGE_KEYS.ENABLED);
    const storedVolume = localStorage.getItem(SOUND_STORAGE_KEYS.VOLUME);

    let volume: number = DEFAULT_SOUND_SETTINGS.volume;
    if (storedVolume !== null) {
      const parsed = parseFloat(storedVolume);
      // Migrate old default of 0.6 to gentle 0.25
      if (parsed === 0.6) {
        volume = DEFAULT_SOUND_SETTINGS.volume;
      } else if (!isNaN(parsed)) {
        volume = Math.max(0, Math.min(1, parsed));
      }
    }

    return {
      enabled: storedEnabled !== null ? storedEnabled === "true" : DEFAULT_SOUND_SETTINGS.enabled,
      volume,
    };
  } catch {
    return {
      enabled: DEFAULT_SOUND_SETTINGS.enabled,
      volume: DEFAULT_SOUND_SETTINGS.volume,
    };
  }
}

/**
 * Initializes the cuelume engine with persisted settings and binds declarative data attributes.
 */
export function initializeSoundEngine(): void {
  if (typeof window === "undefined" || isSoundInitialized) return;

  const { enabled, volume } = getStoredSoundSettings();
  cuelumeSetEnabled(enabled);
  cuelumeSetVolume(volume);

  try {
    cuelumeBind(document);
    isSoundInitialized = true;
  } catch (err) {
    console.warn("[SoundEngine] Failed to bind cuelume listeners:", err);
  }
}

/**
 * Updates sound enabled state, persists to localStorage, and notifies listeners.
 */
export function setSoundEnabled(enabled: boolean): void {
  cuelumeSetEnabled(enabled);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SOUND_STORAGE_KEYS.ENABLED, String(enabled));
      window.dispatchEvent(new CustomEvent("ixstates-sound-settings-changed", { detail: { enabled } }));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Updates master sound volume (0 to 1), persists to localStorage, and notifies listeners.
 */
export function setSoundVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  cuelumeSetVolume(clamped);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SOUND_STORAGE_KEYS.VOLUME, String(clamped));
      window.dispatchEvent(new CustomEvent("ixstates-sound-settings-changed", { detail: { volume: clamped } }));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Safely plays a sound with optional volume scaling.
 */
export function playSound(name: SoundName, options?: { volume?: number }): void {
  if (typeof window === "undefined") return;
  try {
    cuelumePlay(name, options);
  } catch {
    /* Safe no-op if audio context is blocked */
  }
}

/**
 * Semantic high-level sound effect triggers mapped to IxStates interactions.
 * Calibrated with gentle gain for comfortable listening even at max system output.
 */
export const soundEffects = {
  // Tactile Chrome
  press: (vol?: number) => playSound("press", { volume: vol ?? 0.18 }),
  release: (vol?: number) => playSound("release", { volume: vol ?? 0.18 }),
  toggle: (vol?: number) => playSound("toggle", { volume: vol ?? 0.20 }),
  tick: (vol?: number) => playSound("tick", { volume: vol ?? 0.12 }),
  chime: (vol?: number) => playSound("chime", { volume: vol ?? 0.16 }),
  whisper: (vol?: number) => playSound("whisper", { volume: vol ?? 0.12 }),

  // Motion & Expansions
  bloom: (vol?: number) => playSound("bloom", { volume: vol ?? 0.16 }),
  droplet: (vol?: number) => playSound("droplet", { volume: vol ?? 0.18 }),
  page: (vol?: number) => playSound("page", { volume: vol ?? 0.15 }),
  scan: (vol?: number) => playSound("scan", { volume: vol ?? 0.16 }),

  // Async & Work Cycles
  loading: (vol?: number) => playSound("loading", { volume: vol ?? 0.14 }),
  ready: (vol?: number) => playSound("ready", { volume: vol ?? 0.18 }),
  arrival: (vol?: number) => playSound("arrival", { volume: vol ?? 0.14 }),

  // Status & Outcomes
  pulse: (vol?: number) => playSound("pulse", { volume: vol ?? 0.16 }),
  sparkle: (vol?: number) => playSound("sparkle", { volume: vol ?? 0.20 }),
  success: (vol?: number) => playSound("success", { volume: vol ?? 0.20 }),
  error: (vol?: number) => playSound("error", { volume: vol ?? 0.20 }),
};
