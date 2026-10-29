"use client";
// src/context/theme-context.tsx

import React, { createContext, useContext, useEffect, useReducer } from "react";
import { APPEARANCE_STORAGE_KEYS, applyAppearance, clampTextScale } from "~/lib/design/appearance";

export type Theme = "light" | "dark" | "system";

const THEME_CYCLE: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };

/** The theme `toggleTheme` moves to next. */
export function nextTheme(theme: Theme): Theme {
  return THEME_CYCLE[theme];
}

/** Every stored appearance preference, in one object. */
export interface AppearancePrefs {
  theme: Theme;
  compactMode: boolean;
  reduceAnimations: boolean;
  enableTextures: boolean;
  /** Increase Contrast (`data-contrast="more"`); the OS setting applies regardless. */
  increaseContrast: boolean;
  /** Reduce Transparency (`data-transparency="reduced"`); the OS setting applies regardless. */
  reduceTransparency: boolean;
  /** Text size multiplier (`--text-scale`, 0.9–1.3). */
  textScale: number;
  /** Mirrors the Cuelume mute toggle (Cuelume owns its storage key). */
  soundOff: boolean;
}

// Initial values match the server render; the pre-paint script in layout.tsx has already
// written the stored preferences onto <html>, and the load effect brings them into state.
export const DEFAULT_PREFS: AppearancePrefs = {
  theme: "system",
  compactMode: false,
  reduceAnimations: false,
  enableTextures: true,
  increaseContrast: false,
  reduceTransparency: false,
  textScale: 1,
  soundOff: false,
};

type StoredPref = Exclude<keyof AppearancePrefs, "soundOff">;
const STORED_PREFS: StoredPref[] = [
  "theme",
  "compactMode",
  "reduceAnimations",
  "enableTextures",
  "increaseContrast",
  "reduceTransparency",
  "textScale",
];

export interface ThemeState {
  prefs: AppearancePrefs;
  systemTheme: "light" | "dark";
  /** False until stored prefs are read, so the defaults never overwrite the pre-paint script. */
  loaded: boolean;
}

export type ThemeAction =
  | { type: "loaded"; prefs: Partial<AppearancePrefs> }
  | { type: "set"; prefs: Partial<AppearancePrefs> }
  | { type: "system"; theme: "light" | "dark" };

export function themeReducer(state: ThemeState, action: ThemeAction): ThemeState {
  switch (action.type) {
    case "loaded":
      return { ...state, prefs: { ...state.prefs, ...action.prefs }, loaded: true };
    case "set":
      return { ...state, prefs: { ...state.prefs, ...action.prefs } };
    case "system":
      return { ...state, systemTheme: action.theme };
  }
}

/** Parses the stored values; unset or malformed keys are left out. */
export function parseStoredPrefs(read: (key: string) => string | null): Partial<AppearancePrefs> {
  const prefs: Partial<AppearancePrefs> = {};
  const k = APPEARANCE_STORAGE_KEYS;
  const theme = read(k.theme);
  if (theme === "light" || theme === "dark" || theme === "system") prefs.theme = theme;
  const bools = [
    "compactMode",
    "reduceAnimations",
    "enableTextures",
    "increaseContrast",
    "reduceTransparency",
  ] as const;
  for (const key of bools) {
    const value = read(k[key]);
    if (value !== null) prefs[key] = value === "true";
  }
  const scale = parseFloat(read(k.textScale) ?? "");
  if (!Number.isNaN(scale)) prefs.textScale = clampTextScale(scale);
  prefs.soundOff = read(k.soundEnabled) === "false";
  return prefs;
}

function persist(prefs: Partial<AppearancePrefs>): void {
  try {
    for (const key of STORED_PREFS) {
      const value = prefs[key];
      if (value !== undefined) localStorage.setItem(APPEARANCE_STORAGE_KEYS[key], String(value));
    }
  } catch (error) {
    console.warn("Failed to save appearance settings to localStorage:", error);
  }
}

interface ThemeContextType extends Omit<AppearancePrefs, "soundOff"> {
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setCompactMode: (compact: boolean) => void;
  toggleCompactMode: () => void;
  setReduceAnimations: (reduce: boolean) => void;
  setEnableTextures: (enable: boolean) => void;
  setIncreaseContrast: (more: boolean) => void;
  setReduceTransparency: (reduce: boolean) => void;
  setTextScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [{ prefs, systemTheme, loaded }, dispatch] = useReducer(themeReducer, {
    prefs: DEFAULT_PREFS,
    systemTheme: "dark",
    loaded: false,
  });

  // Load stored settings
  useEffect(() => {
    let stored: Partial<AppearancePrefs> = {};
    try {
      stored = parseStoredPrefs((key) => localStorage.getItem(key));
    } catch (error) {
      console.warn("Failed to load theme settings from localStorage:", error);
    }
    dispatch({ type: "loaded", prefs: stored });
  }, []);

  // Follow the OS appearance (used when theme === "system")
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    dispatch({ type: "system", theme: mediaQuery.matches ? "light" : "dark" });
    const handleChange = (e: MediaQueryListEvent) => {
      dispatch({ type: "system", theme: e.matches ? "light" : "dark" });
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Mirror the Cuelume mute toggle into data-sound
  useEffect(() => {
    const handleSound = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      if (typeof enabled === "boolean") dispatch({ type: "set", prefs: { soundOff: !enabled } });
    };
    window.addEventListener("ixstates-sound-settings-changed", handleSound);
    return () => window.removeEventListener("ixstates-sound-settings-changed", handleSound);
  }, []);

  const effectiveTheme: "light" | "dark" = prefs.theme === "system" ? systemTheme : prefs.theme;

  // Apply preferences to <html> (same writer as the pre-paint script)
  useEffect(() => {
    if (!loaded) return;
    applyAppearance(document.documentElement, {
      theme: effectiveTheme,
      compact: prefs.compactMode,
      reduceMotion: prefs.reduceAnimations,
      enableTextures: prefs.enableTextures,
      increaseContrast: prefs.increaseContrast,
      reduceTransparency: prefs.reduceTransparency,
      soundOff: prefs.soundOff,
      textScale: prefs.textScale,
    });

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", effectiveTheme === "dark" ? "#0f1114" : "#f2f3f6");
    }
  }, [loaded, effectiveTheme, prefs]);

  // One writer: save, then update state (state updates even when storage is unavailable).
  const set = (patch: Partial<AppearancePrefs>) => {
    persist(patch);
    dispatch({ type: "set", prefs: patch });
  };

  const { soundOff: _soundOff, ...publicPrefs } = prefs;
  const value: ThemeContextType = {
    ...publicPrefs,
    effectiveTheme,
    setTheme: (theme) => set({ theme }),
    toggleTheme: () => set({ theme: nextTheme(prefs.theme) }),
    setCompactMode: (compactMode) => set({ compactMode }),
    toggleCompactMode: () => set({ compactMode: !prefs.compactMode }),
    setReduceAnimations: (reduceAnimations) => set({ reduceAnimations }),
    setEnableTextures: (enableTextures) => set({ enableTextures }),
    setIncreaseContrast: (increaseContrast) => set({ increaseContrast }),
    setReduceTransparency: (reduceTransparency) => set({ reduceTransparency }),
    setTextScale: (scale) => set({ textScale: clampTextScale(scale) }),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
