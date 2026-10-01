"use client";
// src/context/theme-context.tsx

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import {
  APPEARANCE_STORAGE_KEYS,
  applyAppearance,
  clampTextScale,
} from "~/lib/design/appearance";

export type Theme = "light" | "dark" | "system";
export type TypographyPreset = "sovereign" | "national" | "swiss" | "apple";

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  typographyPreset: TypographyPreset;
  setTypographyPreset: (preset: TypographyPreset) => void;
  compactMode: boolean;
  setCompactMode: (compact: boolean) => void;
  toggleCompactMode: () => void;
  reduceAnimations: boolean;
  setReduceAnimations: (reduce: boolean) => void;
  toggleReduceAnimations: () => void;
  lowFidelityMode: boolean;
  setLowFidelityMode: (lowFidelity: boolean) => void;
  toggleLowFidelityMode: () => void;
  enableTextures: boolean;
  setEnableTextures: (enable: boolean) => void;
  toggleEnableTextures: () => void;
  interactiveHover: boolean;
  setInteractiveHover: (hover: boolean) => void;
  toggleInteractiveHover: () => void;
  showNsImporter: boolean;
  setShowNsImporter: (show: boolean) => void;
  toggleShowNsImporter: () => void;
  /** Increase Contrast (`data-contrast="more"`); the OS setting applies regardless. */
  increaseContrast: boolean;
  setIncreaseContrast: (more: boolean) => void;
  /** Reduce Transparency (`data-transparency="reduced"`); the OS setting applies regardless. */
  reduceTransparency: boolean;
  setReduceTransparency: (reduce: boolean) => void;
  /** Text size multiplier (`--text-scale`, 0.9–1.3). */
  textScale: number;
  setTextScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = APPEARANCE_STORAGE_KEYS.theme,
}: ThemeProviderProps) {
  // Initial values match the server render; the pre-paint script in layout.tsx has already
  // written the stored preferences onto <html>, and the effect below loads them into state.
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("dark");
  const [compactMode, setCompactModeState] = useState<boolean>(false);
  const [reduceAnimations, setReduceAnimationsState] = useState<boolean>(false);
  const [lowFidelityMode, setLowFidelityModeState] = useState<boolean>(false);
  const [enableTextures, setEnableTexturesState] = useState<boolean>(true);
  const [interactiveHover, setInteractiveHoverState] = useState<boolean>(true);
  const [showNsImporter, setShowNsImporterState] = useState<boolean>(false);
  const [typographyPreset, setTypographyPresetState] = useState<TypographyPreset>("swiss");
  const [increaseContrast, setIncreaseContrastState] = useState<boolean>(false);
  const [reduceTransparency, setReduceTransparencyState] = useState<boolean>(false);
  const [textScale, setTextScaleState] = useState<number>(1);
  const [soundOff, setSoundOff] = useState<boolean>(false);
  // Don't write to <html> until stored settings are loaded, so the defaults above never
  // overwrite what the pre-paint script applied.
  const [loaded, setLoaded] = useState(false);

  // Initialize settings from localStorage
  useEffect(() => {
    const readBool = (key: string): boolean | null => {
      const value = localStorage.getItem(key);
      return value === null ? null : value === "true";
    };
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme | null;
      if (storedTheme && ["light", "dark", "system"].includes(storedTheme)) {
        setThemeState(storedTheme);
      }

      const storedTypography = localStorage.getItem(
        APPEARANCE_STORAGE_KEYS.typography
      ) as TypographyPreset | null;
      if (storedTypography && ["sovereign", "national", "swiss", "apple"].includes(storedTypography)) {
        setTypographyPresetState(storedTypography);
      } else {
        setTypographyPresetState("swiss");
      }

      const k = APPEARANCE_STORAGE_KEYS;
      const compact = readBool(k.compactMode);
      if (compact !== null) setCompactModeState(compact);
      const reduce = readBool(k.reduceAnimations);
      if (reduce !== null) setReduceAnimationsState(reduce);
      const lowFidelity = readBool(k.lowFidelity);
      if (lowFidelity !== null) setLowFidelityModeState(lowFidelity);
      const textures = readBool(k.enableTextures);
      if (textures !== null) setEnableTexturesState(textures);
      const hover = readBool(k.interactiveHover);
      if (hover !== null) setInteractiveHoverState(hover);
      const nsImporter = readBool("ixstats-show-ns-importer");
      if (nsImporter !== null) setShowNsImporterState(nsImporter);
      const contrast = readBool(k.increaseContrast);
      if (contrast !== null) setIncreaseContrastState(contrast);
      const transparency = readBool(k.reduceTransparency);
      if (transparency !== null) setReduceTransparencyState(transparency);
      const scale = parseFloat(localStorage.getItem(k.textScale) ?? "");
      if (!Number.isNaN(scale)) setTextScaleState(clampTextScale(scale));
      setSoundOff(localStorage.getItem(k.soundEnabled) === "false");
    } catch (error) {
      console.warn("Failed to load theme settings from localStorage:", error);
    }
    setLoaded(true);
  }, [storageKey]);

  // Follow the OS appearance (used when theme === "system")
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // Mirror the Cuelume mute toggle into data-sound
  useEffect(() => {
    const handleSound = (event: Event) => {
      const enabled = (event as CustomEvent<{ enabled?: boolean }>).detail?.enabled;
      if (typeof enabled === "boolean") setSoundOff(!enabled);
    };
    window.addEventListener("ixstates-sound-settings-changed", handleSound);
    return () => window.removeEventListener("ixstates-sound-settings-changed", handleSound);
  }, []);

  const effectiveTheme: "light" | "dark" = theme === "system" ? systemTheme : theme;

  // Apply preferences to <html> (same writer as the pre-paint script)
  useEffect(() => {
    if (!loaded) return;
    applyAppearance(document.documentElement, {
      theme: effectiveTheme,
      typography: typographyPreset,
      compact: compactMode,
      reduceMotion: reduceAnimations,
      lowFidelity: lowFidelityMode,
      enableTextures,
      interactiveHover,
      increaseContrast,
      reduceTransparency,
      soundOff,
      textScale,
    });

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", effectiveTheme === "dark" ? "#0b0c0f" : "#f2f3f6");
    }
  }, [
    loaded,
    effectiveTheme,
    typographyPreset,
    compactMode,
    reduceAnimations,
    lowFidelityMode,
    enableTextures,
    interactiveHover,
    increaseContrast,
    reduceTransparency,
    soundOff,
    textScale,
  ]);

  // Memoize theme functions to prevent re-renders
  const setTheme = useCallback(
    (newTheme: Theme) => {
      try {
        localStorage.setItem(storageKey, newTheme);
        setThemeState(newTheme);
      } catch (error) {
        console.warn("Failed to save theme to localStorage:", error);
        setThemeState(newTheme);
      }
    },
    [storageKey]
  );

  const toggleTheme = useCallback(() => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  }, [theme, setTheme]);

  // Compact mode functions
  const setCompactMode = useCallback((compact: boolean) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.compactMode, compact.toString());
      setCompactModeState(compact);
    } catch (error) {
      console.warn("Failed to save compact mode to localStorage:", error);
      setCompactModeState(compact);
    }
  }, []);

  const toggleCompactMode = useCallback(() => {
    setCompactMode(!compactMode);
  }, [compactMode, setCompactMode]);

  const setReduceAnimations = useCallback((reduce: boolean) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.reduceAnimations, reduce.toString());
      setReduceAnimationsState(reduce);
    } catch (error) {
      console.warn("Failed to save reduce animations to localStorage:", error);
      setReduceAnimationsState(reduce);
    }
  }, []);

  const toggleReduceAnimations = useCallback(() => {
    setReduceAnimations(!reduceAnimations);
  }, [reduceAnimations, setReduceAnimations]);

  const setLowFidelityMode = useCallback((lowFidelity: boolean) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.lowFidelity, lowFidelity.toString());
      setLowFidelityModeState(lowFidelity);
    } catch (error) {
      console.warn("Failed to save low fidelity to localStorage:", error);
      setLowFidelityModeState(lowFidelity);
    }
  }, []);

  const toggleLowFidelityMode = useCallback(() => {
    setLowFidelityMode(!lowFidelityMode);
  }, [lowFidelityMode, setLowFidelityMode]);

  const setEnableTextures = useCallback((enable: boolean) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.enableTextures, enable.toString());
      setEnableTexturesState(enable);
    } catch (error) {
      console.warn("Failed to save enable textures to localStorage:", error);
      setEnableTexturesState(enable);
    }
  }, []);

  const toggleEnableTextures = useCallback(() => {
    setEnableTextures(!enableTextures);
  }, [enableTextures, setEnableTextures]);

  const setInteractiveHover = useCallback((hover: boolean) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.interactiveHover, hover.toString());
      setInteractiveHoverState(hover);
    } catch (error) {
      console.warn("Failed to save interactive hover to localStorage:", error);
      setInteractiveHoverState(hover);
    }
  }, []);

  const toggleInteractiveHover = useCallback(() => {
    setInteractiveHover(!interactiveHover);
  }, [interactiveHover, setInteractiveHover]);

  const setShowNsImporter = useCallback((show: boolean) => {
    try {
      localStorage.setItem("ixstats-show-ns-importer", show.toString());
      setShowNsImporterState(show);
    } catch (error) {
      console.warn("Failed to save show NS importer to localStorage:", error);
      setShowNsImporterState(show);
    }
  }, []);

  const setTypographyPreset = useCallback((preset: TypographyPreset) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.typography, preset);
      setTypographyPresetState(preset);
    } catch (error) {
      console.warn("Failed to save typography preset to localStorage:", error);
      setTypographyPresetState(preset);
    }
  }, []);

  const toggleShowNsImporter = useCallback(() => {
    setShowNsImporter(!showNsImporter);
  }, [showNsImporter, setShowNsImporter]);

  const setIncreaseContrast = useCallback((more: boolean) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.increaseContrast, more.toString());
    } catch (error) {
      console.warn("Failed to save increase contrast to localStorage:", error);
    }
    setIncreaseContrastState(more);
  }, []);

  const setReduceTransparency = useCallback((reduce: boolean) => {
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.reduceTransparency, reduce.toString());
    } catch (error) {
      console.warn("Failed to save reduce transparency to localStorage:", error);
    }
    setReduceTransparencyState(reduce);
  }, []);

  const setTextScale = useCallback((scale: number) => {
    const next = clampTextScale(scale);
    try {
      localStorage.setItem(APPEARANCE_STORAGE_KEYS.textScale, next.toString());
    } catch (error) {
      console.warn("Failed to save text scale to localStorage:", error);
    }
    setTextScaleState(next);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value: ThemeContextType = useMemo(
    () => ({
      theme,
      effectiveTheme,
      setTheme,
      toggleTheme,
      typographyPreset,
      setTypographyPreset,
      compactMode,
      setCompactMode,
      toggleCompactMode,
      reduceAnimations,
      setReduceAnimations,
      toggleReduceAnimations,
      lowFidelityMode,
      setLowFidelityMode,
      toggleLowFidelityMode,
      enableTextures,
      setEnableTextures,
      toggleEnableTextures,
      interactiveHover,
      setInteractiveHover,
      toggleInteractiveHover,
      showNsImporter,
      setShowNsImporter,
      toggleShowNsImporter,
      increaseContrast,
      setIncreaseContrast,
      reduceTransparency,
      setReduceTransparency,
      textScale,
      setTextScale,
    }),
    [
      theme,
      effectiveTheme,
      setTheme,
      toggleTheme,
      typographyPreset,
      setTypographyPreset,
      compactMode,
      setCompactMode,
      toggleCompactMode,
      reduceAnimations,
      setReduceAnimations,
      toggleReduceAnimations,
      lowFidelityMode,
      setLowFidelityMode,
      toggleLowFidelityMode,
      enableTextures,
      setEnableTextures,
      toggleEnableTextures,
      interactiveHover,
      setInteractiveHover,
      toggleInteractiveHover,
      showNsImporter,
      setShowNsImporter,
      toggleShowNsImporter,
      increaseContrast,
      setIncreaseContrast,
      reduceTransparency,
      setReduceTransparency,
      textScale,
      setTextScale,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
