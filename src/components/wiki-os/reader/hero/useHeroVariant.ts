"use client";

import { useSyncExternalStore } from "react";
import type { WikiHeroVariant } from "./types";

const STORAGE_KEY = "wikios:heroVariant";
const DEFAULT_VARIANT: WikiHeroVariant = "sculpted-emblem";

const listeners = new Set<() => void>();
/** The choice made in this document, which holds even when storage is blocked (private mode). */
let chosen: WikiHeroVariant | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function readVariant(): WikiHeroVariant {
  if (chosen) return chosen;
  try {
    return localStorage.getItem(STORAGE_KEY) === "editorial-masthead"
      ? "editorial-masthead"
      : DEFAULT_VARIANT;
  } catch {
    return DEFAULT_VARIANT;
  }
}

function saveVariant(variant: WikiHeroVariant): void {
  chosen = variant;
  try {
    localStorage.setItem(STORAGE_KEY, variant);
  } catch {
    // storage unavailable: the choice is not persisted
  }
  for (const listener of listeners) listener();
}

/**
 * The main page's chosen hero, kept in localStorage. The server and the hydrating pass render the
 * default, and the stored choice applies right after hydration.
 */
export function useHeroVariant(): [WikiHeroVariant, (variant: WikiHeroVariant) => void] {
  const variant = useSyncExternalStore(subscribe, readVariant, () => DEFAULT_VARIANT);
  return [variant, saveVariant];
}
