/**
 * Cuelume — IxStates' synthesized Web Audio cues (cuelume 0.2.8: fourteen cues named for their job,
 * with emphasis).
 *
 * Policy: on by default at master 0.25, but only **meaningful moments** make sound — success,
 * error, warning, destructive confirm, sheet/dialog present & dismiss, Vault reveals, Halo
 * notifications, things that need an answer, and page arrival. No hover, per-button press,
 * toggle, tab or select sounds. Play them only through {@link soundCues}.
 *
 * Muting (checked at play time, so it follows the live preference attributes on <html>):
 *  - the one mute toggle — `ixstates:sound-enabled` in localStorage (`setSoundEnabled`), mirrored
 *    onto `html[data-sound="off"]` by ThemeProvider; the Settings panel and Halo both use it via
 *    `useSoundSettings`;
 *  - `html[data-motion="reduced"]` (the in-app Reduce Motion setting).
 */

import {
  play as cuelumePlay,
  setEnabled as cuelumeSetEnabled,
  setVolume as cuelumeSetVolume,
  unlock as cuelumeUnlock,
  type Emphasis,
  type SoundName,
} from "cuelume";

export { sounds, type Emphasis, type SoundName } from "cuelume";

export const SOUND_STORAGE_KEYS = {
  ENABLED: "ixstates:sound-enabled",
  VOLUME: "ixstates:sound-volume",
} as const;

const DEFAULT_SOUND_SETTINGS = {
  enabled: true,
  volume: 0.25,
} as const;

/** Window event fired whenever the enabled flag or volume changes. */
const SOUND_SETTINGS_EVENT = "ixstates-sound-settings-changed";

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
 * True when cues must stay silent right now: sound is switched off (`data-sound="off"` or the
 * stored toggle) or the in-app Reduce Motion setting is on (`data-motion="reduced"`).
 */
export function isSoundMuted(): boolean {
  if (typeof document === "undefined") return true;
  const root = document.documentElement;
  if (root.getAttribute("data-sound") === "off") return true;
  if (root.getAttribute("data-motion") === "reduced") return true;
  return !getStoredSoundSettings().enabled;
}

/**
 * Initializes the cuelume engine with the persisted settings.
 */
export function initializeSoundEngine(): void {
  if (typeof window === "undefined" || isSoundInitialized) return;
  const { enabled, volume } = getStoredSoundSettings();
  cuelumeSetEnabled(enabled);
  cuelumeSetVolume(volume);
  isSoundInitialized = true;
}

/**
 * The one mute toggle: updates the engine, persists to localStorage and notifies listeners
 * (ThemeProvider mirrors it onto `html[data-sound]`; `useSoundSettings` re-reads it).
 */
export function setSoundEnabled(enabled: boolean): void {
  cuelumeSetEnabled(enabled);
  // Called from the gesture that turns sound on: some browsers start audio only there.
  if (enabled) void cuelumeUnlock();
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(SOUND_STORAGE_KEYS.ENABLED, String(enabled));
      window.dispatchEvent(new CustomEvent(SOUND_SETTINGS_EVENT, { detail: { enabled } }));
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
      window.dispatchEvent(new CustomEvent(SOUND_SETTINGS_EVENT, { detail: { volume: clamped } }));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Plays a sound unless muted ({@link isSoundMuted}), with optional volume scaling.
 */
export function playSound(
  name: SoundName,
  options?: { volume?: number; emphasis?: Emphasis }
): void {
  if (typeof window === "undefined" || isSoundMuted()) return;
  try {
    cuelumePlay(name, options);
  } catch {
    /* Safe no-op if audio context is blocked */
  }
}

/**
 * The meaningful moments — the only cues the app plays. Each takes an optional emphasis: `subtle`
 * for a toast or a small confirmation, `strong` when the moment matters more.
 */
export const soundCues = {
  /** A sheet or dialog is presented. */
  present: (emphasis?: Emphasis) => playSound("open", { volume: 0.16, emphasis }),
  /** A sheet, dialog or notification is dismissed. */
  dismiss: (emphasis?: Emphasis) => playSound("close", { volume: 0.18, emphasis }),
  /** An operation succeeded. */
  success: (emphasis?: Emphasis) => playSound("success", { volume: 0.2, emphasis }),
  /** Done, but it needs a look. */
  warning: (emphasis?: Emphasis) => playSound("warning", { volume: 0.18, emphasis }),
  /** An operation failed. */
  error: (emphasis?: Emphasis) => playSound("error", { volume: 0.2, emphasis }),
  /** A destructive action was confirmed. */
  destructive: () => playSound("close", { volume: 0.18, emphasis: "strong" }),
  /** Arrived on a new page (client navigation). */
  arrival: (emphasis?: Emphasis) => playSound("navigate", { volume: 0.14, emphasis }),
  /** A Vault reveal (pack opening, rare card). */
  reveal: () => playSound("success", { volume: 0.2, emphasis: "strong" }),
  /** A Halo notification or a new message arrived. */
  notify: (emphasis?: Emphasis) => playSound("ready", { volume: 0.16, emphasis }),
  /** Something is blocked until the user answers (a critical notice). */
  attention: () => playSound("attention", { volume: 0.18 }),
} as const;
