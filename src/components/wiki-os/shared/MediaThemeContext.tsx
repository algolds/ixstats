// src/components/wiki-os/shared/MediaThemeContext.tsx
// React Context and hooks for WikiOS dynamic & theme-compliant image/media switching.
// Canonical modes: Auto (Adaptive), Plinth (Frosted Plate).

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  type MediaThemeMode,
  type MediaType,
  type MediaFilterStyle,
  MEDIA_THEME_STORAGE_KEY,
  MEDIA_THEME_EVENT_NAME,
  MEDIA_IMAGE_OVERRIDE_EVENT_NAME,
  getStoredMediaThemeMode,
  setStoredMediaThemeMode,
  getMediaFilterStyle,
  getImageIdentifier,
  normalizeMediaMode,
} from "~/lib/wiki-os/transformers/media-theme";

interface MediaThemeContextType {
  /** Global media theme mode ("auto" | "plinth") */
  mediaThemeMode: "auto" | "plinth";
  /** Set global media theme mode */
  setMediaThemeMode: (mode: MediaThemeMode) => void;
  /** Toggle global media theme mode: auto <-> plinth */
  cycleMediaThemeMode: () => void;
  /** Whether the active UI theme is currently dark */
  isDarkTheme: boolean;
  /** Per-image overrides keyed by image identifier / URL */
  imageOverrides: Record<string, "auto" | "plinth">;
  /** Set override for a specific image */
  setImageOverride: (src: string, mode: MediaThemeMode) => void;
  /** Reset override for a specific image */
  clearImageOverride: (src: string) => void;
  /** Clear all image overrides */
  clearAllOverrides: () => void;
  /** Get effective mode for a specific image */
  getEffectiveImageMode: (src: string) => "auto" | "plinth";
  /** Get computed CSS filter style for an image */
  getImageStyle: (src: string, mediaType?: MediaType) => MediaFilterStyle;
}

const MediaThemeContext = createContext<MediaThemeContextType | undefined>(undefined);

export function MediaThemeProvider({ children }: { children: ReactNode }) {
  const [mediaThemeMode, setMediaThemeModeState] = useState<"auto" | "plinth">(
    getStoredMediaThemeMode
  );
  const [imageOverrides, setImageOverrides] = useState<Record<string, "auto" | "plinth">>({});
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
    if (typeof document === "undefined") return true;
    return document.documentElement.getAttribute("data-theme") !== "light";
  });

  // 1. Listen for global storage changes & custom events
  useEffect(() => {
    const handleThemeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: string }>;
      if (customEvent.detail?.mode) {
        setMediaThemeModeState(normalizeMediaMode(customEvent.detail.mode));
      } else {
        setMediaThemeModeState(getStoredMediaThemeMode());
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === MEDIA_THEME_STORAGE_KEY) {
        setMediaThemeModeState(getStoredMediaThemeMode());
      }
    };

    window.addEventListener(MEDIA_THEME_EVENT_NAME, handleThemeEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(MEDIA_THEME_EVENT_NAME, handleThemeEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // 2. Observe document data-theme mutations (Light <-> Dark mode changes)
  useEffect(() => {
    if (typeof document === "undefined") return;

    const checkTheme = () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      setIsDarkTheme(!isLight);
    };

    checkTheme();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "data-theme" || mutation.attributeName === "class")
        ) {
          checkTheme();
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => observer.disconnect();
  }, []);

  // Set global media mode
  const setMediaThemeMode = useCallback((mode: MediaThemeMode) => {
    const canonical = normalizeMediaMode(mode);
    setMediaThemeModeState(canonical);
    setStoredMediaThemeMode(canonical);
  }, []);

  // Toggle global media mode: auto <-> plinth
  const cycleMediaThemeMode = useCallback(() => {
    const nextMode: "auto" | "plinth" = mediaThemeMode === "auto" ? "plinth" : "auto";
    setMediaThemeMode(nextMode);
  }, [mediaThemeMode, setMediaThemeMode]);

  // Set per-image override
  const setImageOverride = useCallback((src: string, mode: MediaThemeMode) => {
    const id = getImageIdentifier(src);
    if (!id) return;
    const canonical = normalizeMediaMode(mode);

    setImageOverrides((prev) => {
      const next = { ...prev, [id]: canonical };
      window.dispatchEvent(
        new CustomEvent(MEDIA_IMAGE_OVERRIDE_EVENT_NAME, { detail: { id, mode: canonical } })
      );
      return next;
    });
  }, []);

  // Clear per-image override
  const clearImageOverride = useCallback((src: string) => {
    const id = getImageIdentifier(src);
    if (!id) return;

    setImageOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      window.dispatchEvent(
        new CustomEvent(MEDIA_IMAGE_OVERRIDE_EVENT_NAME, { detail: { id, mode: null } })
      );
      return next;
    });
  }, []);

  // Clear all overrides
  const clearAllOverrides = useCallback(() => {
    setImageOverrides({});
  }, []);

  // Get effective mode for image
  const getEffectiveImageMode = useCallback(
    (src: string): "auto" | "plinth" => {
      const id = getImageIdentifier(src);
      if (id && imageOverrides[id]) {
        return imageOverrides[id]!;
      }
      return mediaThemeMode;
    },
    [imageOverrides, mediaThemeMode]
  );

  // Get computed style for image
  const getImageStyle = useCallback(
    (src: string, mediaType: MediaType = "unknown"): MediaFilterStyle => {
      const mode = getEffectiveImageMode(src);
      return getMediaFilterStyle(mode, mediaType, isDarkTheme);
    },
    [getEffectiveImageMode, isDarkTheme]
  );

  const value = useMemo<MediaThemeContextType>(
    () => ({
      mediaThemeMode,
      setMediaThemeMode,
      cycleMediaThemeMode,
      isDarkTheme,
      imageOverrides,
      setImageOverride,
      clearImageOverride,
      clearAllOverrides,
      getEffectiveImageMode,
      getImageStyle,
    }),
    [
      mediaThemeMode,
      setMediaThemeMode,
      cycleMediaThemeMode,
      isDarkTheme,
      imageOverrides,
      setImageOverride,
      clearImageOverride,
      clearAllOverrides,
      getEffectiveImageMode,
      getImageStyle,
    ]
  );

  return <MediaThemeContext.Provider value={value}>{children}</MediaThemeContext.Provider>;
}

/**
 * Hook to consume MediaThemeContext.
 * If used outside of provider, gracefully falls back to local storage and document theme.
 */
export function useWikiMediaTheme(): MediaThemeContextType {
  const context = useContext(MediaThemeContext);
  const [standaloneMode, setStandaloneMode] = useState<"auto" | "plinth">(getStoredMediaThemeMode);

  useEffect(() => {
    if (context) return;
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: string }>;
      if (customEvent.detail?.mode) {
        setStandaloneMode(normalizeMediaMode(customEvent.detail.mode));
      } else {
        setStandaloneMode(getStoredMediaThemeMode());
      }
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === MEDIA_THEME_STORAGE_KEY) {
        setStandaloneMode(getStoredMediaThemeMode());
      }
    };
    window.addEventListener(MEDIA_THEME_EVENT_NAME, handleEvent);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(MEDIA_THEME_EVENT_NAME, handleEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, [context]);

  if (context) return context;

  // Standalone fallback
  const isDark =
    typeof document !== "undefined"
      ? document.documentElement.getAttribute("data-theme") !== "light"
      : true;

  const handleSetMode = (m: MediaThemeMode) => {
    const canonical = normalizeMediaMode(m);
    setStandaloneMode(canonical);
    setStoredMediaThemeMode(canonical);
  };

  return {
    mediaThemeMode: standaloneMode,
    setMediaThemeMode: handleSetMode,
    cycleMediaThemeMode: () => {
      const nextMode: "auto" | "plinth" = standaloneMode === "auto" ? "plinth" : "auto";
      handleSetMode(nextMode);
    },
    isDarkTheme: isDark,
    imageOverrides: {},
    setImageOverride: () => {},
    clearImageOverride: () => {},
    clearAllOverrides: () => {},
    getEffectiveImageMode: () => standaloneMode,
    getImageStyle: (_src: string, mediaType: MediaType = "unknown") =>
      getMediaFilterStyle(standaloneMode, mediaType, isDark),
  };
}
