"use client";
// src/components/wiki-os/shared/MediaThemeContext.tsx
// React Context and hooks for WikiOS dynamic & theme-compliant image/media switching.
// Canonical modes: Auto (Adaptive), Plinth (Frosted Plate).

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  type MediaThemeAttributes,
  type MediaThemeMode,
  type MediaType,
  MEDIA_THEME_EVENT_NAME,
  MEDIA_IMAGE_OVERRIDE_EVENT_NAME,
  getStoredMediaThemeMode,
  setStoredMediaThemeMode,
  mediaThemeAttributes,
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
  /** The attributes the stylesheet themes an image by (its kind and, if it has one, its own mode) */
  getImageAttributes: (src: string, mediaType?: MediaType) => MediaThemeAttributes;
}

const MediaThemeContext = createContext<MediaThemeContextType | undefined>(undefined);

function subscribeToMediaThemeMode(onChange: () => void): () => void {
  window.addEventListener(MEDIA_THEME_EVENT_NAME, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(MEDIA_THEME_EVENT_NAME, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const serverMediaThemeMode = (): "auto" | "plinth" => "auto";

/**
 * The reader's media mode. The server cannot read it, so the server render and the hydrating one
 * are "auto" and React re-renders with the stored mode once hydrated (reading it while rendering
 * gave the client something other than the server's HTML).
 */
function useStoredMediaThemeMode(): "auto" | "plinth" {
  return useSyncExternalStore(
    subscribeToMediaThemeMode,
    getStoredMediaThemeMode,
    serverMediaThemeMode
  );
}

export function MediaThemeProvider({ children }: { children: ReactNode }) {
  const mediaThemeMode = useStoredMediaThemeMode();
  const [imageOverrides, setImageOverrides] = useState<Record<string, "auto" | "plinth">>({});

  // Set global media mode
  const setMediaThemeMode = useCallback((mode: MediaThemeMode) => {
    setStoredMediaThemeMode(normalizeMediaMode(mode));
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

  // Attributes for an image: its kind, and its own mode if it has one. The reader's mode and the
  // theme are the stylesheet's to apply (from <html>), so these are the same on the server and in
  // the first client render, and a light-theme reader is never shown a dark-theme frame.
  const getImageAttributes = useCallback(
    (src: string, mediaType: MediaType = "unknown"): MediaThemeAttributes =>
      mediaThemeAttributes(mediaType, imageOverrides[getImageIdentifier(src)]),
    [imageOverrides]
  );

  const value = useMemo<MediaThemeContextType>(
    () => ({
      mediaThemeMode,
      setMediaThemeMode,
      cycleMediaThemeMode,
      imageOverrides,
      setImageOverride,
      clearImageOverride,
      clearAllOverrides,
      getEffectiveImageMode,
      getImageAttributes,
    }),
    [
      mediaThemeMode,
      setMediaThemeMode,
      cycleMediaThemeMode,
      imageOverrides,
      setImageOverride,
      clearImageOverride,
      clearAllOverrides,
      getEffectiveImageMode,
      getImageAttributes,
    ]
  );

  return <MediaThemeContext.Provider value={value}>{children}</MediaThemeContext.Provider>;
}

/**
 * Hook to consume MediaThemeContext.
 * If used outside of provider, gracefully falls back to local storage.
 */
export function useWikiMediaTheme(): MediaThemeContextType {
  const context = useContext(MediaThemeContext);
  const standaloneMode = useStoredMediaThemeMode();

  if (context) return context;

  // Standalone fallback
  const handleSetMode = (m: MediaThemeMode) => setStoredMediaThemeMode(normalizeMediaMode(m));

  return {
    mediaThemeMode: standaloneMode,
    setMediaThemeMode: handleSetMode,
    cycleMediaThemeMode: () => handleSetMode(standaloneMode === "auto" ? "plinth" : "auto"),
    imageOverrides: {},
    setImageOverride: () => {},
    clearImageOverride: () => {},
    clearAllOverrides: () => {},
    getEffectiveImageMode: () => standaloneMode,
    getImageAttributes: (_src: string, mediaType: MediaType = "unknown") =>
      mediaThemeAttributes(mediaType),
  };
}
