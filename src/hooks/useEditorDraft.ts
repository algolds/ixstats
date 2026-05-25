"use client";

/**
 * useEditorDraft — Persists editor form state to localStorage for crash recovery.
 *
 * Saves the current editor mode, form data, and pending coordinates so users
 * can resume editing after an accidental page close or browser crash.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  EditorMode,
  CityFormData,
  SubdivisionFormData,
  POIFormData,
  StoryPinFormData,
  MapLabelFormData,
} from "~/hooks/useMapEditor";

export interface DraftState {
  mode: EditorMode;
  cityForm?: CityFormData;
  subdivisionForm?: SubdivisionFormData;
  poiForm?: POIFormData;
  storyPinForm?: StoryPinFormData;
  mapLabelForm?: MapLabelFormData;
  pendingCoordinates?: [number, number] | null;
  savedAt: number;
}

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const SAVE_DEBOUNCE_MS = 1000;

function storageKey(countryId: string): string {
  return `ixworld-editor-draft-${countryId}`;
}

export function useEditorDraft(countryId: string) {
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(countryId));
      if (raw) {
        const parsed = JSON.parse(raw) as DraftState;
        const age = Date.now() - parsed.savedAt;
        setHasDraft(age < DRAFT_MAX_AGE_MS);
        if (age >= DRAFT_MAX_AGE_MS) {
          localStorage.removeItem(storageKey(countryId));
        }
      } else {
        setHasDraft(false);
      }
    } catch {
      setHasDraft(false);
    }
  }, [countryId]);

  const saveDraft = useCallback(
    (state: DraftState) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          const toSave: DraftState = { ...state, savedAt: Date.now() };
          localStorage.setItem(storageKey(countryId), JSON.stringify(toSave));
          setHasDraft(true);
        } catch {
          // localStorage quota exceeded or unavailable — silently ignore
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [countryId]
  );

  const restoreDraft = useCallback((): DraftState | null => {
    try {
      const raw = localStorage.getItem(storageKey(countryId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftState;
      const age = Date.now() - parsed.savedAt;
      if (age >= DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(storageKey(countryId));
        setHasDraft(false);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [countryId]);

  const clearDraft = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    try {
      localStorage.removeItem(storageKey(countryId));
    } catch {
      // ignore
    }
    setHasDraft(false);
  }, [countryId]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return {
    hasDraft,
    restoreDraft,
    saveDraft,
    clearDraft,
  };
}
