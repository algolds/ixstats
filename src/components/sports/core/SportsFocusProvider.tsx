"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  type SportsFocus,
  type SportsFocusType,
  parseSportsFocus,
  serializeSportsFocus,
} from "~/lib/sports/contracts";

interface SportsFocusContextValue {
  focus: SportsFocus | null;
  setFocus: (focus: SportsFocus | null, syncUrl?: boolean) => void;
  focusAthlete: (athleteId: string) => void;
  focusMatch: (matchId: string) => void;
  focusOrganization: (organizationId: string) => void;
  focusCompetition: (competitionId: string) => void;
  clearFocus: () => void;
  isFocused: (type: SportsFocusType, id: string) => boolean;
}

const SportsFocusContext = createContext<SportsFocusContextValue | null>(null);

export interface SportsFocusProviderProps {
  children: React.ReactNode;
  initialFocus?: SportsFocus | null;
}

export function SportsFocusProvider({ children, initialFocus = null }: SportsFocusProviderProps) {
  const searchParams = useSearchParams();
  const urlFocusParam = searchParams.get("focus");

  const [focus, setFocusState] = useState<SportsFocus | null>(() => {
    if (urlFocusParam) {
      return parseSportsFocus(urlFocusParam);
    }
    return initialFocus;
  });

  // Sync state if URL changes externally
  useEffect(() => {
    if (urlFocusParam) {
      const parsed = parseSportsFocus(urlFocusParam);
      if (parsed && (parsed.type !== focus?.type || parsed.id !== focus?.id)) {
        setFocusState(parsed);
      }
    } else if (!urlFocusParam && focus) {
      // If URL focus was cleared externally, clear it
      setFocusState(null);
    }
  }, [urlFocusParam]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const focusParam = currentParams.get("focus");
      setFocusState(parseSportsFocus(focusParam));
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setFocus = useCallback((nextFocus: SportsFocus | null, syncUrl = true) => {
    setFocusState(nextFocus);

    if (syncUrl && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const serialized = serializeSportsFocus(nextFocus);

      if (serialized) {
        url.searchParams.set("focus", serialized);
      } else {
        url.searchParams.delete("focus");
      }

      window.history.pushState(null, "", url.toString());
    }
  }, []);

  const focusAthlete = useCallback(
    (athleteId: string) => {
      if (!athleteId) return;
      setFocus({ type: "athlete", id: athleteId }, true);
    },
    [setFocus]
  );

  const focusMatch = useCallback(
    (matchId: string) => {
      if (!matchId) return;
      setFocus({ type: "match", id: matchId }, true);
    },
    [setFocus]
  );

  const focusOrganization = useCallback(
    (organizationId: string) => {
      if (!organizationId) return;
      setFocus({ type: "organization", id: organizationId }, true);
    },
    [setFocus]
  );

  const focusCompetition = useCallback(
    (competitionId: string) => {
      if (!competitionId) return;
      setFocus({ type: "competition", id: competitionId }, true);
    },
    [setFocus]
  );

  const clearFocus = useCallback(() => {
    setFocus(null, true);
  }, [setFocus]);

  const isFocused = useCallback(
    (type: SportsFocusType, id: string) => {
      return focus?.type === type && focus?.id === id;
    },
    [focus]
  );

  const value = useMemo<SportsFocusContextValue>(
    () => ({
      focus,
      setFocus,
      focusAthlete,
      focusMatch,
      focusOrganization,
      focusCompetition,
      clearFocus,
      isFocused,
    }),
    [focus, setFocus, focusAthlete, focusMatch, focusOrganization, focusCompetition, clearFocus, isFocused]
  );

  return <SportsFocusContext.Provider value={value}>{children}</SportsFocusContext.Provider>;
}

export function useSportsFocus(): SportsFocusContextValue {
  const context = useContext(SportsFocusContext);
  if (!context) {
    // Return a graceful fallback if used outside of a provider
    return {
      focus: null,
      setFocus: () => {},
      focusAthlete: () => {},
      focusMatch: () => {},
      focusOrganization: () => {},
      focusCompetition: () => {},
      clearFocus: () => {},
      isFocused: () => false,
    };
  }
  return context;
}
