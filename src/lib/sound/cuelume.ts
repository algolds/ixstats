/**
 * Cuelume — IxStates' synthesized Web Audio cues (Facet 3 spec §9).
 *
 * Policy: on by default at master 0.25, but only **meaningful moments** make sound —
 * success, error, destructive confirm, sheet/dialog present & dismiss, Vault reveals, Halo
 * notifications and page arrival. No hover ticks, per-button presses, tab or select ticks.
 * Use the semantic {@link soundCues}; `soundEffects` is the raw palette kept for callers that
 * have not migrated yet.
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

/** Window event fired whenever the enabled flag or volume changes. */
export const SOUND_SETTINGS_EVENT = "ixstates-sound-settings-changed";

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

const SOUND_NAMES: ReadonlySet<string> = new Set(cuelumeSounds);

function isSoundName(value: string | null): value is SoundName {
  return value !== null && SOUND_NAMES.has(value);
}

/**
 * Delegated `data-cuelume-press` / `data-cuelume-release` / `data-cuelume-toggle` handling,
 * routed through {@link playSound} so the mute rules apply. `data-cuelume-hover` is deliberately
 * not bound — hover ticks are retired (§9). Primitives no longer set these attributes; the
 * mechanism stays for the few meaningful feature-level cues that still use it.
 */
function bindDelegatedCues(root: Document): void {
  const bindings: [keyof DocumentEventMap, string, SoundName][] = [
    ["pointerdown", "data-cuelume-press", "press"],
    ["pointerup", "data-cuelume-release", "release"],
    ["click", "data-cuelume-toggle", "toggle"],
  ];
  for (const [eventName, attr, fallback] of bindings) {
    root.addEventListener(
      eventName,
      (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const element = target.closest(`[${attr}]`);
        if (!element) return;
        const requested = element.getAttribute(attr);
        playSound(isSoundName(requested) ? requested : fallback);
      },
      true
    );
  }
}

/**
 * Initializes the cuelume engine with persisted settings and binds the delegated listeners.
 */
export function initializeSoundEngine(): void {
  if (typeof window === "undefined" || isSoundInitialized) return;

  const { enabled, volume } = getStoredSoundSettings();
  cuelumeSetEnabled(enabled);
  cuelumeSetVolume(volume);

  try {
    bindDelegatedCues(document);
    isSoundInitialized = true;
  } catch (err) {
    console.warn("[SoundEngine] Failed to bind cuelume listeners:", err);
  }
}

/**
 * The one mute toggle: updates the engine, persists to localStorage and notifies listeners
 * (ThemeProvider mirrors it onto `html[data-sound]`; `useSoundSettings` re-reads it).
 */
export function setSoundEnabled(enabled: boolean): void {
  cuelumeSetEnabled(enabled);
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
export function playSound(name: SoundName, options?: { volume?: number }): void {
  if (typeof window === "undefined" || isSoundMuted()) return;
  try {
    cuelumePlay(name, options);
  } catch {
    /* Safe no-op if audio context is blocked */
  }
}

/**
 * The §9 moments — the only cues new code should play.
 */
export const soundCues = {
  /** A sheet or dialog is presented. */
  present: () => playSound("bloom", { volume: 0.16 }),
  /** A sheet or dialog is dismissed. */
  dismiss: () => playSound("droplet", { volume: 0.18 }),
  /** An operation succeeded. */
  success: () => playSound("success", { volume: 0.2 }),
  /** An operation failed. */
  error: () => playSound("error", { volume: 0.2 }),
  /** A destructive action was confirmed. */
  destructive: () => playSound("pulse", { volume: 0.18 }),
  /** Arrived on a new page (client navigation). */
  arrival: () => playSound("arrival", { volume: 0.14 }),
  /** A Vault reveal (pack opening, rare card). */
  reveal: () => playSound("sparkle", { volume: 0.2 }),
  /** A Halo notification arrived. */
  notify: () => playSound("chime", { volume: 0.16 }),
} as const;

export type SoundMoment = keyof typeof soundCues;

/**
 * Raw palette (legacy). Prefer {@link soundCues}; hover/press/tick cues are retired by §9 and
 * remain only until feature code migrates.
 */
export const soundEffects = {
  // Tactile Chrome
  press: (vol?: number) => playSound("press", { volume: vol ?? 0.18 }),
  release: (vol?: number) => playSound("release", { volume: vol ?? 0.18 }),
  toggle: (vol?: number) => playSound("toggle", { volume: vol ?? 0.2 }),
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
  sparkle: (vol?: number) => playSound("sparkle", { volume: vol ?? 0.2 }),
  success: (vol?: number) => playSound("success", { volume: vol ?? 0.2 }),
  error: (vol?: number) => playSound("error", { volume: vol ?? 0.2 }),
};
